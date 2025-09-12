import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DraftNameHeader from '../components/DraftNameHeader';
import { LoadingSpinner, LoadingSkeleton } from '../components/loading';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Button,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Breadcrumbs,
  Link,
  Collapse,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  CheckCircle as CheckIcon,
  BarChart as ChartIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  ThumbUp as KeepIcon,
  Clear as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
  TableChart as TableIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ParsedCsvData } from '../utils/csvParser';
import { scheduleStorage } from '../services/scheduleStorage';
import { draftService } from '../services/draftService';
import { firebaseStorage } from '../services/firebaseStorage';
import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs';
import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import { 
  TimePointData as WorkflowTimePointData,
  OutlierData,
  TimepointsModification
} from '../types/workflow';
import { ServiceBand as WorkflowServiceBand } from '../types/schedule';
import { AUTO_SAVE_CONFIG } from '../config/autoSave';

// Local TimePointData interface that's different from workflow
interface TimePointData {
  fromTimePoint: string;
  toTimePoint: string;
  timePeriod: string;
  percentile50: number;
  percentile80: number;
  isOutlier?: boolean;
  outlierType?: 'high' | 'low';
  outlierDeviation?: number;
}

interface ChartData {
  timePeriod: string;
  totalTravelTime: number;
  color: string;
  timebandName: string;
  hasOutliers: boolean;
  outlierCount: number;
  isDeleted: boolean;
}

interface TimeBand {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  travelTimeMultiplier: number;
  color: string;
  description?: string;
}

interface TimeBandEditData {
  name: string;
  startTime: string;
  endTime: string;
  travelTimeMultiplier: number;
  description: string;
}

const TimePoints: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get draft from location state or session
  const { draftId: locationDraftId, fromUpload } = location.state || {};
  const { 
    draft, 
    createDraftFromUpload,
    updateTimepointsAnalysis,
    loading: draftLoading,
    error: draftError,
    isSaving: isDraftSaving
  } = useWorkflowDraft(locationDraftId); // Use draft ID from navigation or session
  
  // Firebase connection status
  const isFirebaseConnected = false; // No auth needed
  
  const [timePointData, setTimePointData] = useState<TimePointData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  
  // Draft management state
  const [fileName, setFileName] = useState<string>('');
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  
  // Timeband management state
  const [timeBands, setTimeBands] = useState<TimeBand[]>([]);
  const [selectedTimeband, setSelectedTimeband] = useState<TimeBand | null>(null);
  const [timebandEditDialogOpen, setTimebandEditDialogOpen] = useState(false);
  const [timebandEditData, setTimebandEditData] = useState<TimeBandEditData>({
    name: '',
    startTime: '',
    endTime: '',
    travelTimeMultiplier: 1.0,
    description: ''
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Outlier management state
  const [outliers, setOutliers] = useState<TimePointData[]>([]);
  const [removedOutliers, setRemovedOutliers] = useState<Set<string>>(new Set());
  const [outlierDialogOpen, setOutlierDialogOpen] = useState(false);
  
  // Service Band Data table assignments - this is the single source of truth
  const [serviceBandDataAssignments, setServiceBandDataAssignments] = useState<{ [timePeriod: string]: string }>({});
  
  // Service period deletion state
  const [deletedPeriods, setDeletedPeriods] = useState<Set<string>>(new Set());
  
  // Detailed table collapse state
  const [detailedTableExpanded, setDetailedTableExpanded] = useState(false);
  
  // Chart/Table tab state
  const [chartTableTab, setChartTableTab] = useState(0);
  
  // Service period management state
  const [selectedPeriod, setSelectedPeriod] = useState<ChartData | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);

  // Get data from location state (passed during navigation)
  const { csvData: initialCsvData, dayType, savedScheduleId } = location.state || {};
  
  // Auto-save state
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Analyze travel time data and create data-driven service bands
  const createDataDrivenTimebands = (timePointData: TimePointData[], excludeDeleted: boolean = true): TimeBand[] => {
    if (timePointData.length === 0) return [];

    // Group data by time period and calculate total travel times, excluding deleted periods if specified
    const timePeriodsMap = new Map<string, number>();
    timePointData.forEach(row => {
      if (excludeDeleted && deletedPeriods.has(row.timePeriod)) return; // Skip deleted periods
      const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
      timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);
    });

    // Convert to array and sort by travel time
    const sortedPeriods = Array.from(timePeriodsMap.entries())
      .map(([timePeriod, totalTravelTime]) => ({
        timePeriod,
        totalTravelTime: Math.round(totalTravelTime)
      }))
      .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

    if (sortedPeriods.length === 0) return [];

    // Calculate percentile-based bands from travel time distribution
    const travelTimes = sortedPeriods.map(p => p.totalTravelTime);
    const bands: TimeBand[] = [];
    const colors = ['#2e7d32', '#388e3c', '#f9a825', '#f57c00', '#d32f2f']; // Green to Red gradient with better yellow
    const bandNames = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];

    if (travelTimes.length === 0) return bands;

    // Calculate percentile thresholds based on travel time distribution
    const getPercentile = (arr: number[], percentile: number): number => {
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    // Define percentile ranges for each band
    const percentileRanges = [
      { min: 0, max: 20 },     // Very Fast Service: 0-20th percentile
      { min: 20, max: 40 },    // Fast Service: 20-40th percentile  
      { min: 40, max: 60 },    // Standard Service: 40-60th percentile
      { min: 60, max: 80 },    // Slow Service: 60-80th percentile
      { min: 80, max: 100 }    // Very Slow Service: 80-100th percentile
    ];

    for (let i = 0; i < 5; i++) {
      const range = percentileRanges[i];
      const minThreshold = getPercentile(travelTimes, range.min);
      const maxThreshold = getPercentile(travelTimes, range.max);
      
      // Find periods that fall within this percentile range
      const bandPeriods = sortedPeriods.filter(p => 
        p.totalTravelTime >= minThreshold && 
        (i === 4 ? p.totalTravelTime <= maxThreshold : p.totalTravelTime < maxThreshold)
      );
      
      if (bandPeriods.length === 0) continue;

      // Find time range for this band
      const allTimes = bandPeriods.map(p => p.timePeriod);
      const startTimes = allTimes.map(t => t.split(' - ')[0]);
      const endTimes = allTimes.map(t => t.split(' - ')[1]);
      
      // Find earliest start and latest end
      const earliestStart = startTimes.sort()[0];
      const latestEnd = endTimes.sort()[endTimes.length - 1];

      // Calculate average travel time
      const avgTravelTime = bandPeriods.reduce((sum, p) => sum + p.totalTravelTime, 0) / bandPeriods.length;

      bands.push({
        id: `band_${i + 1}`,
        name: bandNames[i],
        startTime: earliestStart,
        endTime: latestEnd,
        travelTimeMultiplier: 1.0, // Keep for interface compatibility but not used
        color: colors[i],
        description: `${bandPeriods.length} periods • Avg: ${Math.round(avgTravelTime)} min • Range: ${Math.min(...bandPeriods.map(p => p.totalTravelTime))}-${Math.max(...bandPeriods.map(p => p.totalTravelTime))} min • ${range.min}-${range.max}th percentile`
      });
    }

    return bands;
  };

  // Detect outliers in travel time data
  const detectOutliers = (data: TimePointData[]): TimePointData[] => {
    if (data.length < 3) return data; // Need at least 3 items to have 2nd highest/lowest

    // Sort by travel time to identify 2nd highest and 2nd lowest
    const sortedByTime = [...data].sort((a, b) => a.percentile50 - b.percentile50);
    const outlierThreshold = 0.1; // 10% threshold
    
    // Get 2nd lowest and 2nd highest values
    const secondLowest = sortedByTime[1]; // Index 1 is 2nd lowest
    const secondHighest = sortedByTime[sortedByTime.length - 2]; // Index -2 is 2nd highest
    
    return data.map(item => {
      const itemTime = item.percentile50;
      let deviation = 0;
      let outlierType: 'high' | 'low' | undefined;
      let isOutlier = false;
      
      // Check if this item is a high outlier (10% or more above 2nd highest)
      if (itemTime > secondHighest.percentile50) {
        deviation = ((itemTime - secondHighest.percentile50) / secondHighest.percentile50) * 100;
        if (deviation >= outlierThreshold * 100) { // Convert 10% threshold to percentage
          isOutlier = true;
          outlierType = 'high';
        }
      }
      // Check if this item is a low outlier (10% or more below 2nd lowest)
      else if (itemTime < secondLowest.percentile50) {
        deviation = ((secondLowest.percentile50 - itemTime) / secondLowest.percentile50) * 100;
        if (deviation >= outlierThreshold * 100) { // Convert 10% threshold to percentage
          isOutlier = true;
          outlierType = 'low';
        }
      }
      
      return {
        ...item,
        isOutlier,
        outlierType,
        outlierDeviation: isOutlier ? deviation : undefined
      };
    });
  };

  useEffect(() => {
    const loadTimePointData = async () => {
      setLoading(true);
      setError(null);

      try {
        let data: ParsedCsvData | null = null;
        
        // First priority: Check if we have the draft loaded
        if (draft && draft.originalData && draft.originalData.uploadedData && draft.originalData.fileType === 'csv') {
          console.log('✅ Loading data from draft:', draft.draftId);
          data = draft.originalData.uploadedData as ParsedCsvData;
          
          // Set clean route name from draft
          const cleanName = draft.originalData.fileName?.replace(/\.[^/.]+$/, '') || 'Route Schedule';
          setFileName(cleanName);
          setOriginalFileName(cleanName);
          setCurrentDraftId(draft.draftId);
          
          // If draft has existing timepoints analysis, load it
          if (draft.timepointsAnalysis) {
            // Restore previous state from draft
            if (draft.timepointsAnalysis.deletedPeriods) {
              setDeletedPeriods(new Set(draft.timepointsAnalysis.deletedPeriods));
            }
            if (draft.timepointsAnalysis.serviceBands) {
              // Map ServiceBand to TimeBand, ensuring all required properties
              const timeBands: TimeBand[] = draft.timepointsAnalysis.serviceBands.map((band, index) => ({
                id: band.id || `band_${index + 1}`,
                name: band.name,
                startTime: band.startTime || '00:00',
                endTime: band.endTime || '23:59',
                travelTimeMultiplier: band.travelTimeMultiplier || 1.0,
                color: band.color,
                description: band.description
              }));
              setTimeBands(timeBands);
            }
            // Load service band assignments from draft - this is the source of truth
            if (draft.timepointsAnalysis.timePeriodServiceBands) {
              setServiceBandDataAssignments(draft.timepointsAnalysis.timePeriodServiceBands);
            }
          }
        }
        // Fallback: If we have CSV data from navigation state
        else if (initialCsvData) {
          console.log('⚠️ Using CSV data from navigation state');
          data = initialCsvData;
          if (savedScheduleId) {
            setScheduleId(savedScheduleId);
          }
        } 
        // Final fallback: Try to load the draft directly from service if we have a draft ID
        else if (locationDraftId) {
          console.log('🔄 Attempting to load draft directly:', locationDraftId);
          try {
            const loadedDraft = await draftService.getDraftById(locationDraftId);
            if (loadedDraft && loadedDraft.originalData && loadedDraft.originalData.uploadedData && loadedDraft.originalData.fileType === 'csv') {
              data = loadedDraft.originalData.uploadedData as ParsedCsvData;
              const cleanName = loadedDraft.originalData.fileName?.replace(/\.[^/.]+$/, '') || 'Route Schedule';
              setFileName(cleanName);
              setOriginalFileName(cleanName);
              setCurrentDraftId(loadedDraft.draftId);
              console.log('✅ Loaded draft data:', loadedDraft.draftId);
            }
          } catch (draftError) {
            console.warn('⚠️ Could not load draft:', draftError);
          }
        }

        // Ensure we have a clean name set if not already done
        if (!fileName || fileName === 'Draft Schedule') {
          const cleanName = draft?.originalData?.fileName?.replace(/\.[^/.]+$/, '') || 'Route Schedule';
          setFileName(cleanName);
          setOriginalFileName(cleanName);
        }
        
        // Set schedule ID if available
        if (savedScheduleId) {
          setScheduleId(savedScheduleId);
        }

        if (!data) {
          setError('No timepoint data available. Please upload a CSV file first.');
          return;
        }

        // Convert CSV data to table format
        const tableData: TimePointData[] = [];
        
        // Process each segment
        data.segments.forEach(segment => {
          const row: TimePointData = {
            fromTimePoint: segment.fromLocation,
            toTimePoint: segment.toLocation,
            timePeriod: segment.timeSlot,
            percentile50: segment.percentile50 || 0,
            percentile80: segment.percentile80 || 0,
          };
          
          tableData.push(row);
        });

        // Detect outliers in the data
        const dataWithOutliers = detectOutliers(tableData);
        setTimePointData(dataWithOutliers);
        
        // Identify and store outliers for user review
        const foundOutliers = dataWithOutliers.filter(item => item.isOutlier);
        setOutliers(foundOutliers);
        
        // Create data-driven timebands based on travel time analysis (excluding deleted periods)
        const dataDrivenBands = createDataDrivenTimebands(dataWithOutliers, true);
        setTimeBands(dataDrivenBands);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timepoint data');
      } finally {
        setLoading(false);
      }
    };

    loadTimePointData();
  }, [initialCsvData, dayType, savedScheduleId, draft, locationDraftId]);

  // Recalculate timebands when deletedPeriods changes
  useEffect(() => {
    if (timePointData.length > 0) {
      const recalculatedBands = createDataDrivenTimebands(timePointData, true);
      setTimeBands(recalculatedBands);
    }
  }, [deletedPeriods, timePointData]);
  
  // Auto-save functionality - triggers on page load and when key data changes
  useEffect(() => {
    const performAutoSave = async () => {
      // Skip auto-save if we're already saving, don't have a draft, or don't have data
      if (isAutoSaving || !draft || timePointData.length === 0) {
        return;
      }
      
      setIsAutoSaving(true);
      console.log('🔄 Auto-saving TimePoints analysis...');
      
      try {
        // Create time period to service band mapping
        const timePeriodServiceBands: { [timePeriod: string]: string } = {};
        chartData.forEach(item => {
          if (!item.isDeleted) {
            timePeriodServiceBands[item.timePeriod] = item.timebandName;
          }
        });
        
        // Convert local TimePointData to workflow format
        const workflowTimePointData: WorkflowTimePointData[] = timePointData.map(tp => ({
          timePeriod: tp.timePeriod,
          from: tp.fromTimePoint,
          to: tp.toTimePoint,
          percentile25: tp.percentile50 * 0.9,
          percentile50: tp.percentile50,
          percentile75: tp.percentile80,
          percentile90: tp.percentile80 * 1.1,
          isOutlier: tp.isOutlier,
          outlierType: tp.outlierType
        }));
        
        // Convert outliers to OutlierData format
        const workflowOutliers: OutlierData[] = outliers
          .filter(o => !removedOutliers.has(`${o.timePeriod}-${o.fromTimePoint}-${o.toTimePoint}`))
          .map(o => ({
            timePeriod: o.timePeriod,
            segment: `${o.fromTimePoint} to ${o.toTimePoint}`,
            value: o.percentile50,
            deviation: o.outlierDeviation || 0,
            type: o.outlierType || 'high'
          }));
        
        // Convert TimeBand to ServiceBand format
        const workflowServiceBands: WorkflowServiceBand[] = timeBands.map(tb => ({
          id: tb.id,
          name: tb.name,
          startTime: tb.startTime,
          endTime: tb.endTime,
          travelTimeMultiplier: tb.travelTimeMultiplier,
          color: tb.color,
          description: tb.description
        }));
        
        // Save analysis to workflow draft
        const analysisData = {
          serviceBands: workflowServiceBands,
          travelTimeData: workflowTimePointData,
          outliers: workflowOutliers,
          userModifications: [] as TimepointsModification[],
          deletedPeriods: Array.from(deletedPeriods),
          timePeriodServiceBands
        };
        
        const result = await updateTimepointsAnalysis(analysisData);
        
        if (result.success) {
          setLastAutoSave(new Date());
          console.log('✅ TimePoints analysis auto-saved to unified draft system');
        } else {
          console.error('❌ Auto-save failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Auto-save error:', error);
      } finally {
        setIsAutoSaving(false);
      }
    };
    
    // Perform auto-save on initial load (after data is loaded)
    const autoSaveTimer = setTimeout(() => {
      performAutoSave();
    }, AUTO_SAVE_CONFIG.FORM_INPUT_SAVE); // 2s delay for initial load
    
    return () => clearTimeout(autoSaveTimer);
  }, []); // Run once on mount
  
  // Auto-save when key data changes (with debouncing)
  useEffect(() => {
    // Skip if we don't have a draft or data
    if (!draft || timePointData.length === 0) {
      return;
    }
    
    const performAutoSave = async () => {
      if (isAutoSaving) {
        return;
      }
      
      setIsAutoSaving(true);
      console.log('🔄 Auto-saving changes to TimePoints analysis...');
      
      try {
        // Create time period to service band mapping
        const timePeriodServiceBands: { [timePeriod: string]: string } = {};
        chartData.forEach(item => {
          if (!item.isDeleted) {
            timePeriodServiceBands[item.timePeriod] = item.timebandName;
          }
        });
        
        // Convert local TimePointData to workflow format
        const workflowTimePointData: WorkflowTimePointData[] = timePointData.map(tp => ({
          timePeriod: tp.timePeriod,
          from: tp.fromTimePoint,
          to: tp.toTimePoint,
          percentile25: tp.percentile50 * 0.9,
          percentile50: tp.percentile50,
          percentile75: tp.percentile80,
          percentile90: tp.percentile80 * 1.1,
          isOutlier: tp.isOutlier,
          outlierType: tp.outlierType
        }));
        
        // Convert outliers to OutlierData format
        const workflowOutliers: OutlierData[] = outliers
          .filter(o => !removedOutliers.has(`${o.timePeriod}-${o.fromTimePoint}-${o.toTimePoint}`))
          .map(o => ({
            timePeriod: o.timePeriod,
            segment: `${o.fromTimePoint} to ${o.toTimePoint}`,
            value: o.percentile50,
            deviation: o.outlierDeviation || 0,
            type: o.outlierType || 'high'
          }));
        
        // Convert TimeBand to ServiceBand format
        const workflowServiceBands: WorkflowServiceBand[] = timeBands.map(tb => ({
          id: tb.id,
          name: tb.name,
          startTime: tb.startTime,
          endTime: tb.endTime,
          travelTimeMultiplier: tb.travelTimeMultiplier,
          color: tb.color,
          description: tb.description
        }));
        
        // Save analysis to workflow draft
        const analysisData = {
          serviceBands: workflowServiceBands,
          travelTimeData: workflowTimePointData,
          outliers: workflowOutliers,
          userModifications: [] as TimepointsModification[],
          deletedPeriods: Array.from(deletedPeriods),
          timePeriodServiceBands
        };
        
        const result = await updateTimepointsAnalysis(analysisData);
        
        if (result.success) {
          setLastAutoSave(new Date());
          console.log('✅ TimePoints analysis auto-saved to unified draft system');
        } else {
          console.error('❌ Auto-save failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Auto-save error:', error);
      } finally {
        setIsAutoSaving(false);
      }
    };
    
    // Debounce auto-save to avoid too frequent saves
    const autoSaveTimer = setTimeout(() => {
      performAutoSave();
    }, AUTO_SAVE_CONFIG.USER_TYPING_DEBOUNCE); // 1.5s optimal debounce
    
    return () => clearTimeout(autoSaveTimer);
  }, [deletedPeriods, serviceBandDataAssignments, removedOutliers, timeBands]);


  const handleGenerateSummary = async () => {
    let workingDraftId = draft?.draftId;
    
    // Ensure we have a draft ID to work with
    if (!workingDraftId) {
      console.log('⚠️ No draft ID available');
      setError('No draft found. Please start from the upload page.');
      return;
    }
    
    // Create direct time period to service band mapping
    const timePeriodServiceBands: { [timePeriod: string]: string } = {};
    chartData.forEach(item => {
      if (!item.isDeleted) {
        timePeriodServiceBands[item.timePeriod] = item.timebandName;
      }
    });
    
    // Convert local TimePointData to workflow format
    const workflowTimePointData: WorkflowTimePointData[] = timePointData.map(tp => ({
      timePeriod: tp.timePeriod,
      from: tp.fromTimePoint,
      to: tp.toTimePoint,
      percentile25: tp.percentile50 * 0.9,
      percentile50: tp.percentile50,
      percentile75: tp.percentile80,
      percentile90: tp.percentile80 * 1.1,
      isOutlier: tp.isOutlier,
      outlierType: tp.outlierType
    }));
    
    // Convert outliers to OutlierData format
    const workflowOutliers: OutlierData[] = outliers
      .filter(o => !removedOutliers.has(`${o.timePeriod}-${o.fromTimePoint}-${o.toTimePoint}`))
      .map(o => ({
        timePeriod: o.timePeriod,
        segment: `${o.fromTimePoint} to ${o.toTimePoint}`,
        value: o.percentile50,
        deviation: o.outlierDeviation || 0,
        type: o.outlierType || 'high'
      }));
    
    // Convert TimeBand to ServiceBand format
    const workflowServiceBands: WorkflowServiceBand[] = timeBands.map(tb => ({
      id: tb.id,
      name: tb.name,
      startTime: tb.startTime,
      endTime: tb.endTime,
      travelTimeMultiplier: tb.travelTimeMultiplier,
      color: tb.color,
      description: tb.description
    }));
    
    // Save analysis to workflow draft
    const analysisData = {
      serviceBands: workflowServiceBands,
      travelTimeData: workflowTimePointData,
      outliers: workflowOutliers,
      userModifications: [] as TimepointsModification[],
      deletedPeriods: Array.from(deletedPeriods),
      timePeriodServiceBands
    };
    
    const result = await updateTimepointsAnalysis(analysisData);
    
    if (result.success) {
      // Mark the TimePoints step as complete
      draftService.completeStep('timepoints', {
        timePointData,
        serviceBands: timeBands,
        deletedPeriods: Array.from(deletedPeriods)
      });
      
      console.log('🔍 DEBUG: Created service band mapping:', timePeriodServiceBands);
      
      // Store state data in localStorage for persistence across navigation
      localStorage.setItem('currentTimePointData', JSON.stringify(timePointData));
      localStorage.setItem('currentServiceBands', JSON.stringify(timeBands));
      
      // Mark timepoints step as completed
      draftService.updateStepStatus(workingDraftId, 'timepoints', 'completed');
      
      // Pass draft ID and analysis data to BlockConfiguration
      navigate('/block-configuration', {
        state: {
          draftId: workingDraftId,
          timePointData,
          serviceBands: timeBands,
          deletedPeriods: Array.from(deletedPeriods),
          timePeriodServiceBands,
          scheduleId,
          fileName
        }
      });
    } else {
      console.error('Failed to save timepoints analysis:', result.error);
      setError(result.error || 'Failed to save analysis');
    }
  };

  const handleToggleDetailedTable = () => {
    setDetailedTableExpanded(!detailedTableExpanded);
  };



  const handleTimebandClick = (timeband: TimeBand) => {
    setSelectedTimeband(timeband);
    setTimebandEditData({
      name: timeband.name,
      startTime: timeband.startTime,
      endTime: timeband.endTime,
      travelTimeMultiplier: 1.0, // Keep for interface compatibility
      description: timeband.description || ''
    });
    setTimebandEditDialogOpen(true);
  };

  const handleTimebandSave = () => {
    if (!selectedTimeband) return;
    
    const updatedTimebands = timeBands.map(tb => 
      tb.id === selectedTimeband.id
        ? {
            ...tb,
            name: timebandEditData.name,
            startTime: timebandEditData.startTime,
            endTime: timebandEditData.endTime,
            description: timebandEditData.description
          }
        : tb
    );
    
    setTimeBands(updatedTimebands);
    setTimebandEditDialogOpen(false);
    setSelectedTimeband(null);
  };

  const handleTimebandCancel = () => {
    setTimebandEditDialogOpen(false);
    setSelectedTimeband(null);
  };

  const handleDeleteTimeband = () => {
    if (!selectedTimeband) return;
    
    const updatedTimebands = timeBands.filter(tb => tb.id !== selectedTimeband.id);
    setTimeBands(updatedTimebands);
    setTimebandEditDialogOpen(false);
    setDeleteConfirmOpen(false);
    setSelectedTimeband(null);
  };

  const handleDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
  };

  // Outlier management functions
  const handleRemoveOutlier = (outlier: TimePointData) => {
    const outlierKey = `${outlier.timePeriod}_${outlier.fromTimePoint}_${outlier.toTimePoint}`;
    setRemovedOutliers(prev => {
      const newSet = new Set(prev);
      newSet.add(outlierKey);
      return newSet;
    });
    
    // Update the data to exclude this outlier
    setTimePointData(prev => prev.filter(item => 
      !(item.timePeriod === outlier.timePeriod && 
        item.fromTimePoint === outlier.fromTimePoint && 
        item.toTimePoint === outlier.toTimePoint)
    ));
    
    // Update outliers list
    setOutliers(prev => prev.filter(item => 
      !(item.timePeriod === outlier.timePeriod && 
        item.fromTimePoint === outlier.fromTimePoint && 
        item.toTimePoint === outlier.toTimePoint)
    ));
  };

  const handleKeepOutlier = (outlier: TimePointData) => {
    // Mark outlier as accepted (remove from outliers list but keep in data)
    setOutliers(prev => prev.filter(item => 
      !(item.timePeriod === outlier.timePeriod && 
        item.fromTimePoint === outlier.fromTimePoint && 
        item.toTimePoint === outlier.toTimePoint)
    ));
    
    // Update the data to mark this outlier as no longer flagged
    setTimePointData(prev => prev.map(item => 
      (item.timePeriod === outlier.timePeriod && 
       item.fromTimePoint === outlier.fromTimePoint && 
       item.toTimePoint === outlier.toTimePoint)
        ? { ...item, isOutlier: false }
        : item
    ));
  };

  const handleViewOutliers = () => {
    setOutlierDialogOpen(true);
  };

  // Service period deletion functions
  const handleDeletePeriod = (timePeriod: string) => {
    setDeletedPeriods(prev => {
      const newSet = new Set(prev);
      newSet.add(timePeriod);
      return newSet;
    });
  };

  const handleResetDeletions = () => {
    setDeletedPeriods(new Set());
  };

  // Service period management functions
  const handleChangePeriodServiceBand = (timePeriod: string, newServiceBandName: string) => {
    // TODO(human): Update the serviceBandDataAssignments state when user changes service band
  };
  
  const handleChangePeriodTimeband = (timePeriod: string, newTimebandIndex: number) => {
    // This would update the timeband assignment for a specific period
    // For now, we'll show a notification that this is a future feature
    console.log(`Change ${timePeriod} to timeband ${newTimebandIndex}`);
  };

  const handleRestorePeriod = (timePeriod: string) => {
    setDeletedPeriods(prev => {
      const newSet = new Set(prev);
      newSet.delete(timePeriod);
      return newSet;
    });
    setPeriodDialogOpen(false);
  };

  const handleDeletePeriodFromDialog = (timePeriod: string) => {
    handleDeletePeriod(timePeriod);
    setPeriodDialogOpen(false);
  };

  const handleClosePeriodDialog = () => {
    setPeriodDialogOpen(false);
    setSelectedPeriod(null);
  };

  // Workflow navigation functions
  const handleGoBack = () => {
    // Navigate to the previous step in workflow (Upload Schedule)
    navigate('/upload', {
      state: {
        // Pass current state if needed
        returnFrom: 'timepoints'
      }
    });
  };

  const handleGoForward = () => {
    // Navigate to the next step in workflow (Block Configuration)
    // This uses the same logic as handleGenerateSummary
    handleGenerateSummary();
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Calculate chart data - sum of travel times by time period with timeband colors
  const chartData = useMemo((): ChartData[] => {
    if (timePointData.length === 0) return [];

    const timePeriodsMap = new Map<string, number>();
    const timePeriodsOutliersMap = new Map<string, { count: number; hasOutliers: boolean }>();
    
    timePointData.forEach(row => {
      const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
      // Use 50th percentile as the primary travel time for summing
      timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);

      // Track outliers by time period
      const outlierInfo = timePeriodsOutliersMap.get(row.timePeriod) || { count: 0, hasOutliers: false };
      if (row.isOutlier) {
        outlierInfo.count += 1;
        outlierInfo.hasOutliers = true;
      }
      timePeriodsOutliersMap.set(row.timePeriod, outlierInfo);
    });

    // TODO(human): Add debug logging for deleted periods
    
    // Separate deleted and active periods for band calculations
    const activePeriods = Array.from(timePeriodsMap.entries())
      .filter(([timePeriod]) => !deletedPeriods.has(timePeriod))
      .map(([timePeriod, totalTravelTime]) => ({
        timePeriod,
        totalTravelTime: Math.round(totalTravelTime)
      }))
      .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

    // All periods including deleted ones
    const allPeriods = Array.from(timePeriodsMap.entries())
      .map(([timePeriod, totalTravelTime]) => ({
        timePeriod,
        totalTravelTime: Math.round(totalTravelTime),
        isDeleted: deletedPeriods.has(timePeriod)
      }));

    // Assign bands based on travel time percentiles (only active periods)
    const travelTimes = activePeriods.map(p => p.totalTravelTime);
    const bandColors = ['#2e7d32', '#388e3c', '#f9a825', '#f57c00', '#d32f2f'];
    const bandNames = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];

    // Calculate percentile thresholds
    const getPercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const percentileThresholds = [
      getPercentile(travelTimes, 20),  // 20th percentile
      getPercentile(travelTimes, 40),  // 40th percentile
      getPercentile(travelTimes, 60),  // 60th percentile
      getPercentile(travelTimes, 80),  // 80th percentile
    ];

    return allPeriods.map((period) => {
      const outlierInfo = timePeriodsOutliersMap.get(period.timePeriod) || { count: 0, hasOutliers: false };
      
      let color: string;
      let timebandName: string;
      
      if (period.isDeleted) {
        // Deleted periods get white fill
        color = 'white';
        timebandName = 'Deleted';
      } else {
        // Use Service Band Data table assignment as the single source of truth
        const serviceBandAssignment = serviceBandDataAssignments[period.timePeriod];
        
        if (serviceBandAssignment) {
          // Use the assignment from Service Band Data table
          timebandName = serviceBandAssignment;
          const bandIndex = bandNames.indexOf(serviceBandAssignment);
          color = bandIndex >= 0 ? bandColors[bandIndex] : bandColors[2]; // Default to standard service color
        } else {
          // Determine band based on percentile thresholds
          let bandIndex = 4; // Default to slowest band
          const travelTime = period.totalTravelTime;
          
          for (let i = 0; i < percentileThresholds.length; i++) {
            if (travelTime < percentileThresholds[i]) {
              bandIndex = i;
              break;
            }
          }
          
          color = bandColors[bandIndex];
          timebandName = bandNames[bandIndex];
        }
        
        // Modify color for periods with outliers - darken the color
        if (outlierInfo.hasOutliers) {
          if (color.startsWith('#')) {
            const darkened = parseInt(color.substring(1), 16);
            const r = Math.max(0, ((darkened >> 16) & 0xFF) - 40);
            const g = Math.max(0, ((darkened >> 8) & 0xFF) - 40);
            const b = Math.max(0, (darkened & 0xFF) - 40);
            color = `rgb(${r}, ${g}, ${b})`;
          }
        }
      }
      
      return {
        timePeriod: period.timePeriod,
        totalTravelTime: period.totalTravelTime,
        color: color,
        timebandName: timebandName,
        hasOutliers: outlierInfo.hasOutliers,
        outlierCount: outlierInfo.count,
        isDeleted: period.isDeleted
      };
    }).sort((a, b) => a.timePeriod.localeCompare(b.timePeriod));
  }, [timePointData, deletedPeriods, serviceBandDataAssignments]);


  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartData;
      const matchingTimeband = timeBands.find(tb => tb.name === data.timebandName);

      return (
        <Box
          sx={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 1,
            p: 1,
            boxShadow: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'black' }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'black' }}>
            Total Travel Time: {formatTime(payload[0].value)}
          </Typography>
          {matchingTimeband && (
            <>
              <Typography variant="body2" sx={{ color: 'black', fontWeight: 'bold' }}>
                Timeband: {matchingTimeband.name}
              </Typography>
            </>
          )}
          {data.isDeleted && (
            <>
              <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
                🗑️ Deleted Period
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                Click Reset Deletions to restore this period
              </Typography>
            </>
          )}
          {!data.isDeleted && data.hasOutliers && (
            <>
              <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                ⚠️ Contains {data.outlierCount} outlier{data.outlierCount !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                Darker color indicates periods with outlier data
              </Typography>
            </>
          )}
        </Box>
      );
    }
    return null;
  };

  // Custom bar click handler
  const handleBarClick = (data: any, index: number) => {
    const chartDataItem = chartData[index];
    if (chartDataItem) {
      setSelectedPeriod(chartDataItem);
      setPeriodDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <DraftNameHeader />
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 3, mb: 3 }}>
          TimePoints Analysis
        </Typography>
        <LoadingSkeleton variant="dashboard" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Draft Name Header */}
      <DraftNameHeader />

      {/* Simplified Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          TimePoints Analysis
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {dayType && (
            <Chip 
              label={dayType.charAt(0).toUpperCase() + dayType.slice(1)} 
              color="primary" 
              size="small"
              sx={{ mr: 1 }}
            />
          )}
          Review travel times between consecutive timepoints
        </Typography>
      </Box>

      {/* Workflow Navigation Buttons */}
      <Box sx={{ 
        mb: 3, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleGoBack}
          size="large"
          sx={{ minWidth: 140 }}
        >
          Back to Upload
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Step 2 of 5
          </Typography>
          <Typography variant="body1" color="primary" fontWeight="bold">
            Timepoint Analysis
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleGoForward}
          size="large"
          sx={{ minWidth: 160 }}
          disabled={timePointData.length === 0}
        >
          Continue to Blocks
        </Button>
      </Box>

      <Card>
        <CardContent>

          {/* Chart/Table Section with Tabs */}
          {chartData.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ChartIcon color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6" sx={{ color: 'black' }}>
                    Service Bands Summary
                  </Typography>
                </Box>
                {deletedPeriods.size > 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleResetDeletions}
                    sx={{ ml: 2 }}
                  >
                    Reset Deletions ({deletedPeriods.size})
                  </Button>
                )}
              </Box>
              <Box sx={{ mb: 2, p: 2, backgroundColor: 'info.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Interactive Data:</strong> Click on chart bars or table rows to manage service periods. 
                  You can delete periods from analysis or change their timeband assignment. 
                  Deleted periods appear with white fill and are excluded from timeband calculations.
                </Typography>
              </Box>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Tabs 
                    value={chartTableTab} 
                    onChange={(event, newValue) => setChartTableTab(newValue)}
                    aria-label="chart and table tabs"
                  >
                    <Tab 
                      icon={<ChartIcon />} 
                      iconPosition="start" 
                      label="Chart View" 
                      sx={{ textTransform: 'none' }}
                    />
                    <Tab 
                      icon={<TableIcon />} 
                      iconPosition="start" 
                      label="Service Band Data" 
                      sx={{ textTransform: 'none' }}
                    />
                  </Tabs>
                </Box>

                {/* Chart Tab Content */}
                {chartTableTab === 0 && (
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timePeriod" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 12, fill: 'black' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: 'black' }}
                        label={{ 
                          value: 'Total Travel Time (minutes)', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { textAnchor: 'middle', fill: 'black' }
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="totalTravelTime" 
                        onClick={handleBarClick}
                        style={{ cursor: 'pointer' }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            stroke={entry.isDeleted ? '#666' : 'none'}
                            strokeWidth={entry.isDeleted ? 2 : 0}
                            strokeDasharray={entry.isDeleted ? '5,5' : 'none'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Table Tab Content */}
                {chartTableTab === 1 && (
                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', color: 'black' }}>
                            Time Period
                          </TableCell>
                          <TableCell align="right" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', color: 'black' }}>
                            Total Travel Time
                          </TableCell>
                          <TableCell align="center" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', color: 'black' }}>
                            Service Band
                          </TableCell>
                          <TableCell align="center" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', color: 'black' }}>
                            Status
                          </TableCell>
                          <TableCell align="center" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', color: 'black' }}>
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...chartData]
                          .sort((a, b) => a.timePeriod.localeCompare(b.timePeriod))
                          .map((row, index) => (
                            <TableRow
                              key={index}
                              hover
                              sx={{ 
                                cursor: 'pointer',
                                '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                                ...(row.isDeleted && {
                                  backgroundColor: 'grey.50',
                                  '&:hover': { backgroundColor: 'grey.100' }
                                })
                              }}
                              onClick={() => {
                                setSelectedPeriod(row);
                                setPeriodDialogOpen(true);
                              }}
                            >
                              <TableCell component="th" scope="row">
                                <Typography variant="body2" sx={{ color: 'black', fontWeight: 'medium' }}>
                                  {row.timePeriod}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ color: 'black', fontWeight: 'bold' }}>
                                  {formatTime(row.totalTravelTime)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={row.timebandName}
                                  size="small"
                                  sx={{
                                    backgroundColor: row.isDeleted ? 'grey.300' : row.color,
                                    color: 'white',
                                    fontWeight: 'bold'
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                  {row.isDeleted ? (
                                    <Chip label="Deleted" color="error" size="small" />
                                  ) : (
                                    <Chip label="Active" color="success" size="small" />
                                  )}
                                  {!row.isDeleted && row.hasOutliers && (
                                    <Chip 
                                      label={`${row.outlierCount} outlier${row.outlierCount !== 1 ? 's' : ''}`}
                                      color="warning" 
                                      size="small"
                                      icon={<WarningIcon />}
                                    />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPeriod(row);
                                    setPeriodDialogOpen(true);
                                  }}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Manage
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        }
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Box>
          )}

          {/* Outlier Detection Section */}
          {outliers.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Alert 
                severity="warning" 
                sx={{ mb: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={handleViewOutliers}
                    startIcon={<VisibilityIcon />}
                  >
                    View All ({outliers.length})
                  </Button>
                }
              >
                <strong>{outliers.length} potential outlier{outliers.length !== 1 ? 's' : ''} detected!</strong> 
                These trips deviate 10% or more from neighboring travel times. Review them to keep or remove.
              </Alert>

              {/* Outlier Summary Statistics */}
              <Paper sx={{ p: 2, backgroundColor: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="warning" />
                  Outlier Summary Statistics
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      High Outliers (Unusually Slow)
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {outliers.filter(o => o.outlierType === 'high').length}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Low Outliers (Unusually Fast)
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      {outliers.filter(o => o.outlierType === 'low').length}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average Deviation
                    </Typography>
                    <Typography variant="h6" color="text.primary">
                      {outliers.length > 0 
                        ? `${(outliers.reduce((sum, o) => sum + (o.outlierDeviation || 0), 0) / outliers.length).toFixed(1)}%`
                        : '0%'
                      }
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Max Deviation
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {outliers.length > 0 
                        ? `${Math.max(...outliers.map(o => o.outlierDeviation || 0)).toFixed(1)}%`
                        : '0%'
                      }
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Data Quality Impact
                    </Typography>
                    <Typography variant="h6" color="text.primary">
                      {((outliers.length / timePointData.length) * 100).toFixed(1)}% of data
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                  <strong>Detection Method:</strong> Outliers are trips that deviate 10% or more from the 2nd highest or 2nd lowest travel times in your dataset. 
                  Consider removing outliers with extreme deviations (&gt;20%) that may represent data collection errors or unusual operating conditions.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Timepoint Travel Times by Service Band Table */}
          {timeBands.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'black' }}>
                Timepoint Travel Times by Service Band
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.50' }}>
                      <TableCell sx={{ color: 'black', fontWeight: 'bold' }}>Route Segment</TableCell>
                      {timeBands.map((band) => (
                        <TableCell 
                          key={band.id} 
                          align="center" 
                          sx={{ 
                            color: 'white', 
                            backgroundColor: band.color,
                            fontWeight: 'bold',
                            minWidth: 120
                          }}
                        >
                          {band.name}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      // Get unique route segments (from-to pairs)
                      const routeSegments = Array.from(new Set(
                        timePointData.map(row => `${row.fromTimePoint}|${row.toTimePoint}`)
                      )).map(segment => {
                        const [from, to] = segment.split('|');
                        return { from, to };
                      });

                      return routeSegments.map((segment, segmentIndex) => {
                        return (
                          <TableRow 
                            key={segmentIndex}
                            hover
                            sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}
                          >
                            <TableCell component="th" scope="row">
                              <Typography variant="body2" fontWeight="medium" sx={{ color: 'black' }}>
                                {segment.from} → {segment.to}
                              </Typography>
                            </TableCell>
                            {timeBands.map((band) => {
                              // Calculate average travel time for this segment in this band
                              const bandPeriods = new Set();
                              
                              // Get all periods that belong to this band (excluding deleted periods)
                              chartData
                                .filter(item => !item.isDeleted && item.timebandName === band.name)
                                .forEach(item => bandPeriods.add(item.timePeriod));

                              // Get travel times for this segment in these periods
                              const segmentTimes = timePointData
                                .filter(row => 
                                  row.fromTimePoint === segment.from && 
                                  row.toTimePoint === segment.to &&
                                  bandPeriods.has(row.timePeriod)
                                )
                                .map(row => row.percentile50);

                              const avgTime = segmentTimes.length > 0 
                                ? Math.round(segmentTimes.reduce((sum, time) => sum + time, 0) / segmentTimes.length)
                                : null;

                              return (
                                <TableCell 
                                  key={band.id} 
                                  align="center"
                                  sx={{ 
                                    backgroundColor: segmentTimes.length > 0 ? `${band.color}20` : 'grey.100',
                                    border: `1px solid ${band.color}40`
                                  }}
                                >
                                  {avgTime !== null ? (
                                    <Typography 
                                      variant="body2" 
                                      fontWeight="bold" 
                                      sx={{ color: band.color }}
                                    >
                                      {formatTime(avgTime)}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                      N/A
                                    </Typography>
                                  )}
                                  {segmentTimes.length > 0 && (
                                    <Typography 
                                      variant="caption" 
                                      display="block" 
                                      sx={{ color: 'text.secondary' }}
                                    >
                                      ({segmentTimes.length} periods)
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      });
                    })()}
                    {/* Totals Row */}
                    <TableRow sx={{ backgroundColor: 'grey.100', borderTop: '2px solid #ccc' }}>
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" fontWeight="bold" sx={{ color: 'black' }}>
                          Total Travel Time
                        </Typography>
                      </TableCell>
                      {timeBands.map((band) => {
                        // Calculate total travel time for this band across all segments
                        const routeSegments = Array.from(new Set(
                          timePointData.map(row => `${row.fromTimePoint}|${row.toTimePoint}`)
                        )).map(segment => {
                          const [from, to] = segment.split('|');
                          return { from, to };
                        });

                        let totalBandTime = 0;
                        let segmentsWithData = 0;

                        routeSegments.forEach(segment => {
                          const bandPeriods = new Set();
                          
                          // Get all periods that belong to this band (excluding deleted periods)
                          chartData
                            .filter(item => !item.isDeleted && item.timebandName === band.name)
                            .forEach(item => bandPeriods.add(item.timePeriod));

                          // Get travel times for this segment in these periods
                          const segmentTimes = timePointData
                            .filter(row => 
                              row.fromTimePoint === segment.from && 
                              row.toTimePoint === segment.to &&
                              bandPeriods.has(row.timePeriod)
                            )
                            .map(row => row.percentile50);

                          if (segmentTimes.length > 0) {
                            const avgTime = segmentTimes.reduce((sum, time) => sum + time, 0) / segmentTimes.length;
                            totalBandTime += avgTime;
                            segmentsWithData++;
                          }
                        });

                        return (
                          <TableCell 
                            key={band.id} 
                            align="center"
                            sx={{ 
                              backgroundColor: 'grey.200',
                              border: `2px solid ${band.color}`,
                              fontWeight: 'bold'
                            }}
                          >
                            {segmentsWithData > 0 ? (
                              <Typography 
                                variant="body1" 
                                fontWeight="bold" 
                                sx={{ color: band.color }}
                              >
                                {formatTime(Math.round(totalBandTime))}
                              </Typography>
                            ) : (
                              <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 'bold' }}>
                                N/A
                              </Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, p: 2, backgroundColor: 'info.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Travel Time Matrix:</strong> This table shows the average travel time for each route segment 
                  within each service band. Travel times are calculated by averaging all trips for that segment during 
                  the time periods assigned to each service band. "N/A" indicates no data available for that combination.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Detailed Travel Times Table */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'black', flex: 1 }}>
                Detailed Travel Times by Time Period
              </Typography>
              <IconButton
                onClick={handleToggleDetailedTable}
                sx={{
                  transform: detailedTableExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            
            <Collapse in={detailedTableExpanded}>
              {timePointData.length === 0 ? (
                <Alert severity="info">
                  No timepoint data available for the selected day type.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.50' }}>
                        <TableCell sx={{ color: 'black' }}><strong>From TimePoint</strong></TableCell>
                        <TableCell sx={{ color: 'black' }}><strong>To TimePoint</strong></TableCell>
                        <TableCell sx={{ color: 'black' }}><strong>Time Period</strong></TableCell>
                        <TableCell align="right" sx={{ color: 'black' }}><strong>50th Percentile</strong></TableCell>
                        <TableCell align="right" sx={{ color: 'black' }}><strong>80th Percentile</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timePointData.map((row, index) => {
                        const isOutlierRow = row.isOutlier && !removedOutliers.has(`${row.timePeriod}_${row.fromTimePoint}_${row.toTimePoint}`);
                        
                        return (
                          <TableRow 
                            key={index}
                            hover
                            sx={{ 
                              '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                              ...(isOutlierRow && {
                                backgroundColor: row.outlierType === 'high' ? 'error.50' : 'warning.50',
                                border: '2px solid',
                                borderColor: row.outlierType === 'high' ? 'error.main' : 'warning.main'
                              })
                            }}
                          >
                          <TableCell component="th" scope="row">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {isOutlierRow && (
                                <WarningIcon 
                                  color={row.outlierType === 'high' ? 'error' : 'warning'} 
                                  fontSize="small"
                                />
                              )}
                              <Typography variant="body2" fontWeight="medium" sx={{ color: 'black' }}>
                                {row.fromTimePoint}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium" sx={{ color: 'black' }}>
                              {row.toTimePoint}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={row.timePeriod} 
                              size="small" 
                              variant="outlined"
                              color="secondary"
                              sx={{ color: 'black', borderColor: 'black' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: 'black' }}>
                                {formatTime(row.percentile50)}
                              </Typography>
                              {isOutlierRow && (
                                <Chip 
                                  label={`${row.outlierDeviation?.toFixed(1)}% ${row.outlierType}`}
                                  size="small"
                                  color={row.outlierType === 'high' ? 'error' : 'warning'}
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: 'black' }}>
                                {formatTime(row.percentile80)}
                              </Typography>
                              {isOutlierRow && (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    onClick={() => handleKeepOutlier(row)}
                                    startIcon={<KeepIcon />}
                                    sx={{ minWidth: 'auto', px: 1 }}
                                  >
                                    Keep
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => handleRemoveOutlier(row)}
                                    startIcon={<RemoveIcon />}
                                    sx={{ minWidth: 'auto', px: 1 }}
                                  >
                                    Remove
                                  </Button>
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Collapse>
          </Box>

          <Box sx={{ mt: 3, p: 2, backgroundColor: 'info.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Legend:</strong> 50th percentile represents typical travel time, 
              80th percentile represents travel time including delays. 
              Time bands show when this data was collected.
            </Typography>
          </Box>
        </CardContent>
      </Card>


      {/* Timeband Edit Dialog */}
      <Dialog 
        open={timebandEditDialogOpen} 
        onClose={handleTimebandCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Timeband: {selectedTimeband?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              fullWidth
              value={timebandEditData.name}
              onChange={(e) => setTimebandEditData(prev => ({ ...prev, name: e.target.value }))}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time"
                type="time"
                value={timebandEditData.startTime}
                onChange={(e) => setTimebandEditData(prev => ({ ...prev, startTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="End Time"
                type="time"
                value={timebandEditData.endTime}
                onChange={(e) => setTimebandEditData(prev => ({ ...prev, endTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 300 }}
                sx={{ flex: 1 }}
              />
            </Box>
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={timebandEditData.description}
              onChange={(e) => setTimebandEditData(prev => ({ ...prev, description: e.target.value }))}
              helperText="Optional description of this timeband"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error"
            startIcon={<DeleteIcon />}
            disabled={timeBands.length <= 1}
          >
            Delete
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleTimebandCancel}>Cancel</Button>
          <Button onClick={handleTimebandSave} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Timeband</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the timeband "{selectedTimeband?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteTimeband} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Outlier Management Dialog */}
      <Dialog 
        open={outlierDialogOpen} 
        onClose={() => setOutlierDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            Outlier Management ({outliers.length} outliers found)
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            These trips have travel times that deviate 10% or more from the 2nd highest or 2nd lowest travel times in your dataset.
            Review each outlier and decide whether to keep or remove it from your analysis.
          </Typography>
          
          {outliers.length === 0 ? (
            <Alert severity="success">
              All outliers have been reviewed! No outliers remaining.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Route Segment</strong></TableCell>
                    <TableCell><strong>Time Period</strong></TableCell>
                    <TableCell align="right"><strong>Travel Time</strong></TableCell>
                    <TableCell align="center"><strong>Deviation</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outliers.map((outlier, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        backgroundColor: outlier.outlierType === 'high' ? 'error.50' : 'warning.50'
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2">
                          {outlier.fromTimePoint} → {outlier.toTimePoint}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={outlier.timePeriod} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatTime(outlier.percentile50)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={`${outlier.outlierDeviation?.toFixed(1)}% ${outlier.outlierType}`}
                          size="small"
                          color={outlier.outlierType === 'high' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => handleKeepOutlier(outlier)}
                            startIcon={<KeepIcon />}
                          >
                            Keep
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleRemoveOutlier(outlier)}
                            startIcon={<RemoveIcon />}
                          >
                            Remove
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOutlierDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Service Period Management Dialog */}
      <Dialog 
        open={periodDialogOpen} 
        onClose={handleClosePeriodDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChartIcon color="primary" />
            Manage Service Period: {selectedPeriod?.timePeriod}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPeriod && (
            <Box sx={{ mt: 2 }}>
              {/* Period Information */}
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Period Information
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Time Period:</strong> {selectedPeriod.timePeriod}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Total Travel Time:</strong> {formatTime(selectedPeriod.totalTravelTime)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Current Status:</strong> {selectedPeriod.isDeleted ? 
                    <Chip label="Deleted" color="error" size="small" /> : 
                    <Chip label={selectedPeriod.timebandName} sx={{ backgroundColor: selectedPeriod.color, color: 'white' }} size="small" />
                  }
                </Typography>
                {selectedPeriod.hasOutliers && (
                  <Typography variant="body2" color="warning.main" gutterBottom>
                    <strong>⚠️ Contains {selectedPeriod.outlierCount} outlier{selectedPeriod.outlierCount !== 1 ? 's' : ''}</strong>
                  </Typography>
                )}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedPeriod.isDeleted ? (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleRestorePeriod(selectedPeriod.timePeriod)}
                    startIcon={<AddIcon />}
                    fullWidth
                  >
                    Restore Period to Analysis
                  </Button>
                ) : (
                  <>
                    <Typography variant="subtitle1" gutterBottom>
                      <strong>Choose Action:</strong>
                    </Typography>
                    
                    {/* Timeband Assignment Section */}
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
                      <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                        Change Timeband Assignment
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Select a new timeband for this service period:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'].map((bandName, index) => {
                          const bandColor = ['#2e7d32', '#388e3c', '#f9a825', '#f57c00', '#d32f2f'][index];
                          const isCurrentBand = selectedPeriod.timebandName === bandName;
                          
                          return (
                            <Button
                              key={bandName}
                              variant={isCurrentBand ? "contained" : "outlined"}
                              size="small"
                              onClick={() => handleChangePeriodTimeband(selectedPeriod.timePeriod, index)}
                              sx={{
                                backgroundColor: isCurrentBand ? bandColor : 'transparent',
                                borderColor: bandColor,
                                color: isCurrentBand ? 'white' : bandColor,
                                '&:hover': {
                                  backgroundColor: bandColor,
                                  color: 'white'
                                }
                              }}
                            >
                              {bandName}
                            </Button>
                          );
                        })}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                        Note: This feature is planned for future implementation
                      </Typography>
                    </Box>

                    {/* Delete Option */}
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleDeletePeriodFromDialog(selectedPeriod.timePeriod)}
                      startIcon={<DeleteIcon />}
                      fullWidth
                    >
                      Remove Period from Analysis
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePeriodDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimePoints;
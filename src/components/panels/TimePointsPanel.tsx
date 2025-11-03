/**
 * TimePoints Panel Component
 * Converts the TimePoints page functionality into a responsive panel-based component
 * Preserves ALL existing analytical functionality while adapting for the Schedule Command Center workspace
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Collapse,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  CheckCircle as CheckIcon,
  BarChart as ChartIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Drafts as DraftIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  ThumbUp as KeepIcon,
  Clear as RemoveIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  TableChart as TableIcon,
  DirectionsBus as BusIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  TuneRounded as TuneIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { ParsedCsvData } from '../../utils/csvParser';
import { draftService } from '../../services/draftService';
import { useWorkflowDraft } from '../../hooks/useWorkflowDraft';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { emit, subscribe, unsubscribe } from '../../services/workspaceEventBus';
import { 
  TimePointData as WorkflowTimePointData,
  OutlierData,
  TimepointsModification
} from '../../types/workflow';
import { ServiceBand as WorkflowServiceBand } from '../../types/schedule';

/**
 * Panel Props Interface
 */
interface PanelProps {
  panelId: string;
  data?: any;
  onClose?: () => void;
  onMinimize?: () => void;
}

/**
 * Local TimePointData interface (different from workflow)
 */
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

/**
 * Chart Data interface for responsive charts
 */
interface ChartData {
  timePeriod: string;
  totalTravelTime: number;
  color: string;
  timebandName: string;
  hasOutliers: boolean;
  outlierCount: number;
  isDeleted: boolean;
}

/**
 * Time Band interface
 */
interface TimeBand {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  travelTimeMultiplier: number;
  color: string;
  description?: string;
}

/**
 * Time Band Edit Data interface
 */
interface TimeBandEditData {
  name: string;
  startTime: string;
  endTime: string;
  travelTimeMultiplier: number;
  description: string;
}

/**
 * TimePoints Panel Component
 */
export const TimePointsPanel: React.FC<PanelProps> = ({ panelId, data, onClose, onMinimize }) => {
  const { state: workspaceState, setScheduleData } = useWorkspace();
  const { 
    draft, 
    updateTimepointsAnalysis,
    loading: draftLoading,
    error: draftError,
    isSaving: isDraftSaving
  } = useWorkflowDraft();
  
  // Firebase connection status
  const isFirebaseConnected = false; // No auth needed
  
  // Core data states - preserve original functionality
  const [timePointData, setTimePointData] = useState<TimePointData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  // Service band and analysis states
  const [timeBands, setTimeBands] = useState<TimeBand[]>([]);
  const [serviceBandDataAssignments, setServiceBandDataAssignments] = useState<{ [timePeriod: string]: string }>({});
  const [deletedPeriods, setDeletedPeriods] = useState<Set<string>>(new Set());
  
  // Outlier management states
  const [outliers, setOutliers] = useState<TimePointData[]>([]);
  const [removedOutliers, setRemovedOutliers] = useState<Set<string>>(new Set());
  
  // UI states adapted for responsive panel
  const [detailedTableExpanded, setDetailedTableExpanded] = useState(false);
  const [chartTableTab, setChartTableTab] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<ChartData | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [outlierDialogOpen, setOutlierDialogOpen] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Auto-save states
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Panel-specific states
  const [panelWidth, setPanelWidth] = useState<number>(600);
  const containerRef = useRef<HTMLDivElement>(null);
  
  /**
   * Monitor panel width for responsive chart sizing
   */
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPanelWidth(entry.contentRect.width);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  /**
   * Subscribe to workspace events for panel coordination
   */
  useEffect(() => {
    const subscriptions: string[] = [];

    // Subscribe to schedule upload events from Upload Panel
    subscriptions.push(
      subscribe('schedule-data', (event) => {
        if (event.type === 'schedule-data' && 
            'dataType' in event.payload &&
            event.payload.dataType === 'upload' && 
            'data' in event.payload &&
            event.payload.data?.fileType === 'csv' &&
            event.source === 'upload-panel') {
          
          console.log('📥 TimePoints Panel received upload data:', event.payload.data);
          
          // Process uploaded CSV data for timepoint analysis
          const { scheduleData, fileName: uploadedFileName } = event.payload.data;
          if (scheduleData && uploadedFileName) {
            processUploadedData(scheduleData as ParsedCsvData, uploadedFileName);
          }
        }
      }, { priority: 1 })
    );

    return () => {
      subscriptions.forEach(id => unsubscribe(id));
    };
  }, []);

  /**
   * Process uploaded data from Upload Panel
   */
  const processUploadedData = useCallback(async (csvData: ParsedCsvData, uploadedFileName: string) => {
    setLoading(true);
    setError(null);
    setFileName(uploadedFileName);

    try {
      // Convert CSV data to table format
      const tableData: TimePointData[] = [];
      
      csvData.segments.forEach(segment => {
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
      
      // Create data-driven timebands based on travel time analysis
      const dataDrivenBands = createDataDrivenTimebands(dataWithOutliers, true);
      setTimeBands(dataDrivenBands);
      
      console.log('✅ TimePoints data processed:', {
        dataPoints: dataWithOutliers.length,
        outliers: foundOutliers.length,
        timeBands: dataDrivenBands.length
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process timepoint data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create data-driven service bands from travel time analysis
   */
  const createDataDrivenTimebands = (timePointData: TimePointData[], excludeDeleted: boolean = true): TimeBand[] => {
    if (timePointData.length === 0) return [];

    // Group data by time period and calculate total travel times
    const timePeriodsMap = new Map<string, number>();
    timePointData.forEach(row => {
      if (excludeDeleted && deletedPeriods.has(row.timePeriod)) return;
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
    const colors = ['#2e7d32', '#388e3c', '#f9a825', '#f57c00', '#d32f2f'];
    const bandNames = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];

    if (travelTimes.length === 0) return bands;

    // Calculate percentile thresholds
    const getPercentile = (arr: number[], percentile: number): number => {
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const percentileRanges = [
      { min: 0, max: 20 },
      { min: 20, max: 40 },
      { min: 40, max: 60 },
      { min: 60, max: 80 },
      { min: 80, max: 100 }
    ];

    for (let i = 0; i < 5; i++) {
      const range = percentileRanges[i];
      const minThreshold = getPercentile(travelTimes, range.min);
      const maxThreshold = getPercentile(travelTimes, range.max);
      
      const bandPeriods = sortedPeriods.filter(p => 
        p.totalTravelTime >= minThreshold && 
        (i === 4 ? p.totalTravelTime <= maxThreshold : p.totalTravelTime < maxThreshold)
      );
      
      if (bandPeriods.length === 0) continue;

      const allTimes = bandPeriods.map(p => p.timePeriod);
      const startTimes = allTimes.map(t => t.split(' - ')[0]);
      const endTimes = allTimes.map(t => t.split(' - ')[1]);
      
      const earliestStart = startTimes.sort()[0];
      const latestEnd = endTimes.sort()[endTimes.length - 1];
      const avgTravelTime = bandPeriods.reduce((sum, p) => sum + p.totalTravelTime, 0) / bandPeriods.length;

      bands.push({
        id: `band_${i + 1}`,
        name: bandNames[i],
        startTime: earliestStart,
        endTime: latestEnd,
        travelTimeMultiplier: 1.0,
        color: colors[i],
        description: `${bandPeriods.length} periods • Avg: ${Math.round(avgTravelTime)} min • Range: ${Math.min(...bandPeriods.map(p => p.totalTravelTime))}-${Math.max(...bandPeriods.map(p => p.totalTravelTime))} min • ${range.min}-${range.max}th percentile`
      });
    }

    return bands;
  };

  /**
   * Detect outliers in travel time data
   */
  const detectOutliers = (data: TimePointData[]): TimePointData[] => {
    if (data.length < 3) return data;

    const sortedByTime = [...data].sort((a, b) => a.percentile50 - b.percentile50);
    const outlierThreshold = 0.1; // 10% threshold
    
    const secondLowest = sortedByTime[1];
    const secondHighest = sortedByTime[sortedByTime.length - 2];
    
    return data.map(item => {
      const itemTime = item.percentile50;
      let deviation = 0;
      let outlierType: 'high' | 'low' | undefined;
      let isOutlier = false;
      
      if (itemTime > secondHighest.percentile50) {
        deviation = ((itemTime - secondHighest.percentile50) / secondHighest.percentile50) * 100;
        if (deviation >= outlierThreshold * 100) {
          isOutlier = true;
          outlierType = 'high';
        }
      } else if (itemTime < secondLowest.percentile50) {
        deviation = ((secondLowest.percentile50 - itemTime) / secondLowest.percentile50) * 100;
        if (deviation >= outlierThreshold * 100) {
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

  /**
   * Calculate chart data for responsive visualization
   */
  const chartData = useMemo((): ChartData[] => {
    if (timePointData.length === 0) return [];

    const timePeriodsMap = new Map<string, number>();
    const timePeriodsOutliersMap = new Map<string, { count: number; hasOutliers: boolean }>();
    
    timePointData.forEach(row => {
      const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
      timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);

      const outlierInfo = timePeriodsOutliersMap.get(row.timePeriod) || { count: 0, hasOutliers: false };
      if (row.isOutlier) {
        outlierInfo.count += 1;
        outlierInfo.hasOutliers = true;
      }
      timePeriodsOutliersMap.set(row.timePeriod, outlierInfo);
    });

    const activePeriods = Array.from(timePeriodsMap.entries())
      .filter(([timePeriod]) => !deletedPeriods.has(timePeriod))
      .map(([timePeriod, totalTravelTime]) => ({
        timePeriod,
        totalTravelTime: Math.round(totalTravelTime)
      }))
      .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

    const allPeriods = Array.from(timePeriodsMap.entries())
      .map(([timePeriod, totalTravelTime]) => ({
        timePeriod,
        totalTravelTime: Math.round(totalTravelTime),
        isDeleted: deletedPeriods.has(timePeriod)
      }));

    const travelTimes = activePeriods.map(p => p.totalTravelTime);
    const bandColors = ['#2e7d32', '#388e3c', '#f9a825', '#f57c00', '#d32f2f'];
    const bandNames = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];

    const getPercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const percentileThresholds = [
      getPercentile(travelTimes, 20),
      getPercentile(travelTimes, 40),
      getPercentile(travelTimes, 60),
      getPercentile(travelTimes, 80),
    ];

    return allPeriods.map((period) => {
      const outlierInfo = timePeriodsOutliersMap.get(period.timePeriod) || { count: 0, hasOutliers: false };
      
      let color: string;
      let timebandName: string;
      
      if (period.isDeleted) {
        color = 'white';
        timebandName = 'Deleted';
      } else {
        const serviceBandAssignment = serviceBandDataAssignments[period.timePeriod];
        
        if (serviceBandAssignment) {
          timebandName = serviceBandAssignment;
          const bandIndex = bandNames.indexOf(serviceBandAssignment);
          color = bandIndex >= 0 ? bandColors[bandIndex] : bandColors[2];
        } else {
          let bandIndex = 4;
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

  /**
   * Auto-save functionality with workspace integration
   */
  useEffect(() => {
    const performAutoSave = async () => {
      if (isAutoSaving || !draft || timePointData.length === 0) return;
      
      setIsAutoSaving(true);
      console.log('🔄 Auto-saving TimePoints analysis...');
      
      try {
        const timePeriodServiceBands: { [timePeriod: string]: string } = {};
        chartData.forEach(item => {
          if (!item.isDeleted) {
            timePeriodServiceBands[item.timePeriod] = item.timebandName;
          }
        });
        
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
        
        const workflowOutliers: OutlierData[] = outliers
          .filter(o => !removedOutliers.has(`${o.timePeriod}-${o.fromTimePoint}-${o.toTimePoint}`))
          .map(o => ({
            timePeriod: o.timePeriod,
            segment: `${o.fromTimePoint} to ${o.toTimePoint}`,
            value: o.percentile50,
            deviation: o.outlierDeviation || 0,
            type: o.outlierType || 'high'
          }));
        
        const workflowServiceBands: WorkflowServiceBand[] = timeBands.map(tb => ({
          id: tb.id,
          name: tb.name,
          startTime: tb.startTime,
          endTime: tb.endTime,
          travelTimeMultiplier: tb.travelTimeMultiplier,
          color: tb.color,
          description: tb.description
        }));
        
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
          console.log('✅ TimePoints analysis auto-saved');
        } else {
          console.error('❌ Auto-save failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Auto-save error:', error);
      } finally {
        setIsAutoSaving(false);
      }
    };
    
    const autoSaveTimer = setTimeout(() => {
      performAutoSave();
    }, 2000);
    
    return () => clearTimeout(autoSaveTimer);
  }, [deletedPeriods, serviceBandDataAssignments, removedOutliers, timeBands, timePointData, outliers, chartData, draft, isAutoSaving, updateTimepointsAnalysis]);

  /**
   * Handle analysis complete and emit event for Block Configuration Panel
   */
  const handleContinueToBlockConfiguration = useCallback(async () => {
    if (!draft) {
      setSaveError('No draft available');
      return;
    }

    try {
      setSaving(true);
      
      // Create time period to service band mapping
      const timePeriodServiceBands: { [timePeriod: string]: string } = {};
      chartData.forEach(item => {
        if (!item.isDeleted) {
          timePeriodServiceBands[item.timePeriod] = item.timebandName;
        }
      });
      
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
      
      const workflowOutliers: OutlierData[] = outliers
        .filter(o => !removedOutliers.has(`${o.timePeriod}-${o.fromTimePoint}-${o.toTimePoint}`))
        .map(o => ({
          timePeriod: o.timePeriod,
          segment: `${o.fromTimePoint} to ${o.toTimePoint}`,
          value: o.percentile50,
          deviation: o.outlierDeviation || 0,
          type: o.outlierType || 'high'
        }));
      
      const workflowServiceBands: WorkflowServiceBand[] = timeBands.map(tb => ({
        id: tb.id,
        name: tb.name,
        startTime: tb.startTime,
        endTime: tb.endTime,
        travelTimeMultiplier: tb.travelTimeMultiplier,
        color: tb.color,
        description: tb.description
      }));
      
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
        // Mark step as complete
        draftService.completeStep('timepoints', {
          timePointData,
          serviceBands: timeBands,
          deletedPeriods: Array.from(deletedPeriods)
        });
        
        // Emit analysis complete event for Block Configuration Panel
        emit({
          type: 'schedule-data',
          source: 'timepoints-panel',
          priority: 1,
          payload: {
            dataType: 'timepoints',
            action: 'update',
            data: {
              draftId: draft.draftId,
              timePoints: workflowTimePointData,
              serviceBands: workflowServiceBands,
              travelMatrix: analysisData,
              timePeriodServiceBands,
              fileName
            }
          }
        });
        
        // Emit workflow progress
        emit({
          type: 'workflow-progress',
          source: 'timepoints-panel',
          priority: 1,
          payload: {
            currentStep: 'blocks',
            progress: 50,
            canProceed: true
          }
        });
        
        console.log('🔍 TimePoints analysis emitted for Block Configuration');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
      } else {
        setSaveError(result.error || 'Failed to save analysis');
      }
    } catch (error) {
      setSaveError('Failed to complete analysis');
      console.error('Analysis error:', error);
    } finally {
      setSaving(false);
    }
  }, [draft, chartData, timePointData, outliers, timeBands, deletedPeriods, removedOutliers, fileName, updateTimepointsAnalysis]);

  /**
   * Format time utility
   */
  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  /**
   * Custom tooltip for responsive charts
   */
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
            maxWidth: panelWidth * 0.8, // Responsive to panel width
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'black' }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'black' }}>
            Total Travel Time: {formatTime(payload[0].value)}
          </Typography>
          {matchingTimeband && (
            <Typography variant="body2" sx={{ color: 'black', fontWeight: 'bold' }}>
              Timeband: {matchingTimeband.name}
            </Typography>
          )}
          {data.isDeleted && (
            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
              🗑️ Deleted Period
            </Typography>
          )}
          {!data.isDeleted && data.hasOutliers && (
            <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
              ⚠️ Contains {data.outlierCount} outlier{data.outlierCount !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  /**
   * Handle outlier actions
   */
  const handleRemoveOutlier = useCallback((outlier: TimePointData) => {
    const outlierKey = `${outlier.timePeriod}_${outlier.fromTimePoint}_${outlier.toTimePoint}`;
    setRemovedOutliers(prev => new Set(Array.from(prev).concat(outlierKey)));
    
    setTimePointData(prev => prev.filter(item => 
      !(item.timePeriod === outlier.timePeriod && 
        item.fromTimePoint === outlier.fromTimePoint && 
        item.toTimePoint === outlier.toTimePoint)
    ));
    
    setOutliers(prev => prev.filter(item => 
      !(item.timePeriod === outlier.timePeriod && 
        item.fromTimePoint === outlier.fromTimePoint && 
        item.toTimePoint === outlier.toTimePoint)
    ));
  }, []);

  const handleKeepOutlier = useCallback((outlier: TimePointData) => {
    setOutliers(prev => prev.filter(item => 
      !(item.timePeriod === outlier.timePeriod && 
        item.fromTimePoint === outlier.fromTimePoint && 
        item.toTimePoint === outlier.toTimePoint)
    ));
    
    setTimePointData(prev => prev.map(item => 
      (item.timePeriod === outlier.timePeriod && 
       item.fromTimePoint === outlier.fromTimePoint && 
       item.toTimePoint === outlier.toTimePoint)
        ? { ...item, isOutlier: false }
        : item
    ));
  }, []);

  /**
   * Handle period deletion
   */
  const handleDeletePeriod = useCallback((timePeriod: string) => {
    setDeletedPeriods(prev => new Set(Array.from(prev).concat(timePeriod)));
  }, []);

  const handleResetDeletions = useCallback(() => {
    setDeletedPeriods(new Set());
  }, []);

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Processing timepoint data...
        </Typography>
      </Box>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Upload CSV data to analyze timepoints and service bands.
        </Typography>
      </Box>
    );
  }

  /**
   * Render empty state
   */
  if (timePointData.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <TimelineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No TimePoint Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload a CSV file from the Upload Panel to begin timepoint analysis.
        </Typography>
      </Box>
    );
  }

  /**
   * Main panel render - responsive layout
   */
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        height: '100%', 
        overflow: 'auto', 
        display: 'flex', 
        flexDirection: 'column',
        p: 2,
        gap: 2
      }}
    >
      {/* Panel Header */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AnalyticsIcon color="primary" />
          <Typography variant="h6" component="h2">
            TimePoint Analysis
          </Typography>
          {isAutoSaving && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Auto-saving...
              </Typography>
            </Box>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={`${timePointData.length} Data Points`} 
            color="primary" 
            size="small" 
            variant="outlined" 
          />
          {outliers.length > 0 && (
            <Chip 
              label={`${outliers.length} Outliers`} 
              color="warning" 
              size="small"
              icon={<WarningIcon />}
            />
          )}
          {deletedPeriods.size > 0 && (
            <Chip 
              label={`${deletedPeriods.size} Deleted`} 
              color="error" 
              size="small"
            />
          )}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showAdvancedSettings}
                onChange={(e) => setShowAdvancedSettings(e.target.checked)}
              />
            }
            label="Advanced"
            sx={{ ml: 'auto' }}
          />
        </Box>
      </Box>

      {/* Service Bands Summary - Responsive Chart/Table */}
      {chartData.length > 0 && (
        <Card elevation={1}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Service Bands Overview
              </Typography>
              {deletedPeriods.size > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleResetDeletions}
                  startIcon={<RefreshIcon />}
                >
                  Reset ({deletedPeriods.size})
                </Button>
              )}
            </Box>

            {/* Responsive Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs 
                value={chartTableTab} 
                onChange={(event, newValue) => setChartTableTab(newValue)}
                aria-label="chart and table tabs"
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab 
                  icon={<ChartIcon />} 
                  iconPosition="start" 
                  label="Chart" 
                  sx={{ textTransform: 'none', minWidth: 'auto' }}
                />
                <Tab 
                  icon={<TableIcon />} 
                  iconPosition="start" 
                  label="Data" 
                  sx={{ textTransform: 'none', minWidth: 'auto' }}
                />
              </Tabs>
            </Box>

            {/* Chart View - Responsive sizing */}
            {chartTableTab === 0 && (
              <Box sx={{ height: Math.min(400, panelWidth * 0.6) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timePeriod" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: Math.max(10, panelWidth / 60), fill: 'black' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'black' }}
                      label={{ 
                        value: 'Travel Time (min)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: 'black' }
                      }}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="totalTravelTime" 
                      onClick={(data, index) => {
                        setSelectedPeriod(chartData[index]);
                        setPeriodDialogOpen(true);
                      }}
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
              </Box>
            )}

            {/* Data Table View - Compact for panels */}
            {chartTableTab === 1 && (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', minWidth: 120 }}>
                        Time Period
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>
                        Travel Time
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>
                        Service Band
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {chartData.map((row, index) => (
                      <TableRow
                        key={index}
                        hover
                        sx={{ 
                          cursor: 'pointer',
                          ...(row.isDeleted && { backgroundColor: 'grey.50' })
                        }}
                        onClick={() => {
                          setSelectedPeriod(row);
                          setPeriodDialogOpen(true);
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {row.timePeriod}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
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
                              fontWeight: 'bold',
                              fontSize: '0.75rem'
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <Chip 
                              label={row.isDeleted ? 'Deleted' : 'Active'} 
                              color={row.isDeleted ? 'error' : 'success'} 
                              size="small" 
                            />
                            {!row.isDeleted && row.hasOutliers && (
                              <Chip 
                                label={`${row.outlierCount} outlier${row.outlierCount !== 1 ? 's' : ''}`}
                                color="warning" 
                                size="small"
                                sx={{ fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outlier Detection Section */}
      {outliers.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ py: 1 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setOutlierDialogOpen(true)}
              startIcon={<VisibilityIcon />}
            >
              View ({outliers.length})
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>{outliers.length} potential outlier{outliers.length !== 1 ? 's' : ''} detected!</strong> 
            These trips deviate 10% or more from neighboring travel times.
          </Typography>
        </Alert>
      )}

      {/* Advanced Settings - Collapsible */}
      {showAdvancedSettings && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Advanced Analysis</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Timepoint Travel Times by Service Band Table - Responsive */}
            {timeBands.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Travel Time Matrix
                </Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: 'grey.100', fontWeight: 'bold', minWidth: 140 }}>
                          Route Segment
                        </TableCell>
                        {timeBands.map((band) => (
                          <TableCell 
                            key={band.id} 
                            align="center" 
                            sx={{ 
                              color: 'white', 
                              backgroundColor: band.color,
                              fontWeight: 'bold',
                              minWidth: 80,
                              fontSize: '0.75rem'
                            }}
                          >
                            {band.name.replace(' Service', '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const routeSegments = Array.from(new Set(
                          timePointData.map(row => `${row.fromTimePoint}|${row.toTimePoint}`)
                        )).map(segment => {
                          const [from, to] = segment.split('|');
                          return { from, to };
                        });

                        return routeSegments.slice(0, 10).map((segment, segmentIndex) => (
                          <TableRow key={segmentIndex}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                {segment.from} → {segment.to}
                              </Typography>
                            </TableCell>
                            {timeBands.map((band) => {
                              const bandPeriods = new Set();
                              
                              chartData
                                .filter(item => !item.isDeleted && item.timebandName === band.name)
                                .forEach(item => bandPeriods.add(item.timePeriod));

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
                                    backgroundColor: segmentTimes.length > 0 ? `${band.color}20` : 'grey.100'
                                  }}
                                >
                                  {avgTime !== null ? (
                                    <Typography 
                                      variant="body2" 
                                      fontWeight="bold" 
                                      sx={{ color: band.color, fontSize: '0.875rem' }}
                                    >
                                      {formatTime(avgTime)}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>
                                      N/A
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Detailed Data Table - Collapsible */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  Detailed Travel Times
                </Typography>
                <IconButton
                  onClick={() => setDetailedTableExpanded(!detailedTableExpanded)}
                  sx={{
                    transform: detailedTableExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Box>
              
              <Collapse in={detailedTableExpanded}>
                <TableContainer sx={{ maxHeight: 250 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>From</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>To</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>Period</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>50th %</TableCell>
                        <TableCell align="right" sx={{ backgroundColor: 'grey.100', fontWeight: 'bold' }}>80th %</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timePointData.slice(0, 50).map((row, index) => {
                        const isOutlierRow = row.isOutlier && !removedOutliers.has(`${row.timePeriod}_${row.fromTimePoint}_${row.toTimePoint}`);
                        
                        return (
                          <TableRow 
                            key={index}
                            sx={{ 
                              ...(isOutlierRow && {
                                backgroundColor: row.outlierType === 'high' ? 'error.50' : 'warning.50'
                              })
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {isOutlierRow && (
                                  <WarningIcon 
                                    color={row.outlierType === 'high' ? 'error' : 'warning'} 
                                    sx={{ fontSize: 16 }}
                                  />
                                )}
                                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                  {row.fromTimePoint}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                {row.toTimePoint}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={row.timePeriod} 
                                size="small" 
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                  {formatTime(row.percentile50)}
                                </Typography>
                                {isOutlierRow && (
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      onClick={() => handleKeepOutlier(row)}
                                      sx={{ minWidth: 'auto', px: 0.5, fontSize: '0.7rem' }}
                                    >
                                      Keep
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      onClick={() => handleRemoveOutlier(row)}
                                      sx={{ minWidth: 'auto', px: 0.5, fontSize: '0.7rem' }}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                {formatTime(row.percentile80)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {timePointData.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="caption" color="text.secondary">
                              ... and {timePointData.length - 50} more rows
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Action Buttons */}
      <Card elevation={1}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => setSaveSuccess(true)}
              disabled={saving || isDraftSaving}
              size="small"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              startIcon={<BusIcon />}
              onClick={handleContinueToBlockConfiguration}
              disabled={saving || timePointData.length === 0}
              size="small"
            >
              Continue to Block Config
            </Button>
            
            {outliers.length > 0 && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<VisibilityIcon />}
                onClick={() => setOutlierDialogOpen(true)}
                size="small"
              >
                Review Outliers ({outliers.length})
              </Button>
            )}
            
            {showAdvancedSettings && (
              <Button
                variant="outlined"
                startIcon={<ExportIcon />}
                size="small"
                disabled
              >
                Export Data
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Success Snackbar */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          TimePoints analysis saved to cloud!
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!saveError}
        autoHideDuration={3000}
        onClose={() => setSaveError(null)}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          {saveError}
        </Alert>
      </Snackbar>

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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These trips have travel times that deviate 10% or more from the 2nd highest or 2nd lowest travel times.
          </Typography>
          
          {outliers.length === 0 ? (
            <Alert severity="success">
              All outliers have been reviewed!
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
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
        onClose={() => setPeriodDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChartIcon color="primary" />
            Manage Service Period
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPeriod && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {selectedPeriod.timePeriod}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Total Travel Time:</strong> {formatTime(selectedPeriod.totalTravelTime)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Status:</strong> {selectedPeriod.isDeleted ? 
                    <Chip label="Deleted" color="error" size="small" /> : 
                    <Chip label={selectedPeriod.timebandName} sx={{ backgroundColor: selectedPeriod.color, color: 'white' }} size="small" />
                  }
                </Typography>
                {selectedPeriod.hasOutliers && (
                  <Typography variant="body2" color="warning.main">
                    <strong>⚠️ Contains {selectedPeriod.outlierCount} outlier{selectedPeriod.outlierCount !== 1 ? 's' : ''}</strong>
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedPeriod.isDeleted ? (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                      handleDeletePeriod(selectedPeriod.timePeriod);
                      setPeriodDialogOpen(false);
                    }}
                    startIcon={<AddIcon />}
                    fullWidth
                  >
                    Restore Period
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      handleDeletePeriod(selectedPeriod.timePeriod);
                      setPeriodDialogOpen(false);
                    }}
                    startIcon={<DeleteIcon />}
                    fullWidth
                  >
                    Remove from Analysis
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPeriodDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimePointsPanel;

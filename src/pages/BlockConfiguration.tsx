import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Save as SaveIcon, 
  Download as DownloadIcon, 
  AccessTime as ClockIcon, 
  DirectionsBus as BusIcon, 
  Settings as SettingsIcon, 
  CalendarToday as CalendarIcon, 
  ArrowBack as BackIcon,
  Timeline as TimelineIcon,
  Home as HomeIcon,
  Drafts as DraftIcon,
  NavigateNext as NavigateNextIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { scheduleStorage } from '../services/scheduleStorage';
import { SummarySchedule } from '../types/schedule';
import { workflowStateService } from '../services/workflowStateService';
import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs';
import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  Paper,
  Link,
  Breadcrumbs,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';

// ==================== TYPES ====================
interface TimePoint {
  id: string;
  name: string;
}

// TimePoints analysis data from TimePoints page
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

interface TimeBand {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  travelTimeMultiplier: number;
  color: string;
  description?: string;
}

interface ServiceBand {
  name: 'Fastest Service' | 'Fast Service' | 'Standard Service' | 'Slow Service' | 'Slowest Service';
  color: string;
  segmentTimes: Array<{
    from: string;
    to: string;
    travelMinutes: number;
  }>;
  totalMinutes: number;
}

interface TimePeriod {
  startTime: string;
  endTime: string;
  serviceBand: ServiceBand['name'];
}

interface Trip {
  tripNumber: number;
  blockNumber: number;
  departureTime: string;
  arrivalTimes: { [timePointId: string]: string };
  departureTimes: { [timePointId: string]: string };
  recoveryTimes: { [timePointId: string]: number };
  serviceBand: ServiceBand['name'];
  recoveryMinutes: number;
}

interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

interface Schedule {
  id: string;
  name: string;
  timePoints: TimePoint[];
  serviceBands: ServiceBand[];
  timePeriods: TimePeriod[];
  trips: Trip[];
  blockConfigurations: BlockConfiguration[];
  cycleTimeMinutes: number;
  automateBlockStartTimes: boolean;
  firstTripTime: string;
  lastTripTime: string;
  updatedAt: string;
  // TimePoints data for service band mapping
  timePointData?: TimePointData[];
  deletedPeriods?: string[];
}

// ==================== UTILITY FUNCTIONS ====================
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return 0;
  
  return Math.max(0, Math.min(1440, hours * 60 + minutes)); // Bound between 0 and 24 hours
};

const minutesToTime = (minutes: number): string => {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '00:00';
  
  const boundedMinutes = Math.max(0, Math.min(1440, Math.round(minutes))); // Bound and round
  const hours = Math.floor(boundedMinutes / 60);
  const mins = boundedMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  return minutesToTime(totalMinutes);
};

const getTimeWithDefault = (time: string | undefined, defaultTime: string): string => {
  return time && time.trim() ? time : defaultTime;
};

/**
 * Validates service band name and provides fallback
 */
const validateServiceBandName = (name: string): ServiceBand['name'] => {
  const validNames: ServiceBand['name'][] = [
    'Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'
  ];
  
  if (validNames.includes(name as ServiceBand['name'])) {
    return name as ServiceBand['name'];
  }
  
  return 'Standard Service'; // Fallback
};

/**
 * Finds service band by name, handling both full names and short names
 */
const findServiceBand = (serviceBands: ServiceBand[], targetName: string): ServiceBand | undefined => {
  // First try exact match
  let found = serviceBands.find(sb => sb.name === targetName);
  if (found) return found;
  
  // If not found, try matching without "Service" suffix
  const shortName = targetName.replace(' Service', '');
  found = serviceBands.find(sb => sb.name === shortName || sb.name.replace(' Service', '') === shortName);
  if (found) {
    console.log(`🔧 Service band name mapping: "${targetName}" → "${found.name}"`);
    return found;
  }
  
  // Try the opposite - add "Service" if target doesn't have it
  const longName = targetName.includes('Service') ? targetName : `${targetName} Service`;
  found = serviceBands.find(sb => sb.name === longName);
  if (found) {
    console.log(`🔧 Service band name mapping: "${targetName}" → "${found.name}"`);
    return found;
  }
  
  return undefined;
};

/**
 * Builds service bands with actual travel times from TimePoints data
 */
const buildServiceBandsFromTimePointsData = (
  timePointData: TimePointData[],
  timePeriodServiceBands: { [timePeriod: string]: string },
  deletedPeriods: string[] = []
): ServiceBand[] => {
  if (!timePointData || timePointData.length === 0) {
    console.log('⚠️ No TimePoints data available for building service bands');
    return [];
  }

  // Create mapping if not provided
  let workingMapping = timePeriodServiceBands;
  if (!workingMapping || Object.keys(workingMapping).length === 0) {
    console.log('🔧 Creating service band mapping from TimePoints data...');
    workingMapping = createTimePeriodServiceBandMapping(timePointData, deletedPeriods);
    
    if (Object.keys(workingMapping).length === 0) {
      console.warn('⚠️ Failed to create service band mapping from TimePoints data');
      return [];
    }
  }

  console.log('🔧 Building service bands from TimePoints data...');
  console.log('🔧 Available timePeriodServiceBands:', workingMapping);
  console.log('🔧 TimePointData length:', timePointData?.length || 0);

  // Group data by time period and service band
  const serviceBandData = new Map<string, TimePointData[]>();

  timePointData.forEach(row => {
    const serviceBand = workingMapping[row.timePeriod];
    if (serviceBand) {
      if (!serviceBandData.has(serviceBand)) {
        serviceBandData.set(serviceBand, []);
        console.log(`🔧 Creating service band group: ${serviceBand}`);
      }
      serviceBandData.get(serviceBand)!.push(row);
    } else {
      console.warn(`⚠️ No service band found for time period: ${row.timePeriod}`);
    }
  });
  
  console.log('🔧 Service band data groups:', Array.from(serviceBandData.keys()));

  // Build service bands with actual travel times
  const serviceBands: ServiceBand[] = [];
  const bandNames: ServiceBand['name'][] = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];
  
  bandNames.forEach(bandName => {
    const bandData = serviceBandData.get(bandName);
    if (!bandData) return;

    console.log(`📊 Processing ${bandName}: ${bandData.length} data points`);

    // Get unique route segments
    const segments = new Map<string, TimePointData[]>();
    bandData.forEach(row => {
      const segmentKey = `${row.fromTimePoint}|${row.toTimePoint}`;
      if (!segments.has(segmentKey)) {
        segments.set(segmentKey, []);
      }
      segments.get(segmentKey)!.push(row);
    });

    // Calculate average travel times for each segment
    const segmentTimes: Array<{ from: string, to: string, travelMinutes: number }> = [];
    let totalMinutes = 0;

    Array.from(segments.entries()).forEach(([segmentKey, segmentData]) => {
      const [fromPoint, toPoint] = segmentKey.split('|');
      const avgTravelTime = Math.round(
        segmentData.reduce((sum, row) => sum + row.percentile50, 0) / segmentData.length
      );
      
      // Convert timepoint names to IDs (simple mapping)
      const fromId = fromPoint.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const toId = toPoint.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      segmentTimes.push({
        from: fromId,
        to: toId,
        travelMinutes: avgTravelTime
      });
      
      totalMinutes += avgTravelTime;
      
      console.log(`  🛤️ ${fromPoint} → ${toPoint}: ${avgTravelTime}min (${segmentData.length} data points)`);
    });

    serviceBands.push({
      name: bandName,
      color: getServiceBandColor(bandName),
      segmentTimes,
      totalMinutes
    });
    
    console.log(`✅ Created service band: "${bandName}"`); // Debug to see actual names

    console.log(`✅ ${bandName}: ${segmentTimes.length} segments, ${totalMinutes}min total`);
  });

  console.log(`🎯 Built ${serviceBands.length} service bands from TimePoints data`);
  console.log(`🎯 Service band names:`, serviceBands.map(sb => sb.name));
  return serviceBands;
};

/**
 * Creates a default service band mapping for when no TimePoints data is available
 * This provides a reasonable fallback based on typical traffic patterns
 */
const createDefaultServiceBandMapping = (): { [timePeriod: string]: string } => {
  const mapping: { [timePeriod: string]: string } = {};
  
  // Generate time periods for a typical service day (7:00 AM to 10:00 PM)
  for (let hour = 7; hour < 22; hour++) {
    for (let half = 0; half < 2; half++) {
      const startHour = hour;
      const startMin = half * 30;
      const endMin = startMin + 29;
      
      const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      const endTime = `${String(startHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
      const timePeriod = `${startTime} - ${endTime}`;
      
      // Assign service bands based on typical traffic patterns
      if (hour >= 7 && hour < 9) {
        mapping[timePeriod] = 'Slow Service'; // Morning rush
      } else if (hour >= 9 && hour < 12) {
        mapping[timePeriod] = 'Fast Service'; // Mid-morning
      } else if (hour >= 12 && hour < 14) {
        mapping[timePeriod] = 'Standard Service'; // Lunch
      } else if (hour >= 14 && hour < 16) {
        mapping[timePeriod] = 'Fast Service'; // Early afternoon
      } else if (hour >= 16 && hour < 19) {
        mapping[timePeriod] = 'Slowest Service'; // Evening rush
      } else if (hour >= 19 && hour < 21) {
        mapping[timePeriod] = 'Standard Service'; // Evening
      } else {
        mapping[timePeriod] = 'Fastest Service'; // Late evening
      }
    }
  }
  
  console.log('🏗️ Created default service band mapping with', Object.keys(mapping).length, 'periods');
  return mapping;
};

/**
 * Creates time period to service band mapping from TimePoints data
 * This recreates the mapping logic that was working before
 */
const createTimePeriodServiceBandMapping = (
  timePointData: TimePointData[], 
  deletedPeriods: string[] = []
): { [timePeriod: string]: string } => {
  console.log('📊 createTimePeriodServiceBandMapping called with:');
  console.log('  - timePointData length:', timePointData?.length || 0);
  console.log('  - deletedPeriods:', deletedPeriods);
  
  if (!timePointData || timePointData.length === 0) {
    console.log('⚠️ No timePointData provided, returning empty mapping');
    return {};
  }
  
  // Group data by time period and calculate total travel times, excluding deleted periods
  const timePeriodsMap = new Map<string, number>();
  const deletedSet = new Set(deletedPeriods);
  
  console.log('🔄 Processing timePointData...');
  timePointData.forEach(row => {
    if (deletedSet.has(row.timePeriod)) {
      console.log(`  - Skipping deleted period: ${row.timePeriod}`);
      return; // Skip deleted periods
    }
    const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
    timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);
  });
  
  console.log('📈 Time periods found:', timePeriodsMap.size);

  // Sort periods by total travel time to determine service bands
  const sortedPeriods = Array.from(timePeriodsMap.entries())
    .map(([timePeriod, totalTravelTime]) => ({
      timePeriod,
      totalTravelTime: Math.round(totalTravelTime)
    }))
    .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

  if (sortedPeriods.length === 0) {
    console.log('⚠️ No time periods after processing, returning empty mapping');
    return {};
  }
  
  console.log('📊 Sorted periods:', sortedPeriods.length, 'periods');
  console.log('📊 Sample periods:', sortedPeriods.slice(0, 3));

  // Calculate percentile thresholds for service band assignment
  const travelTimes = sortedPeriods.map(p => p.totalTravelTime);
  const getPercentile = (arr: number[], percentile: number): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  const p20 = getPercentile(travelTimes, 20);
  const p40 = getPercentile(travelTimes, 40);
  const p60 = getPercentile(travelTimes, 60);
  const p80 = getPercentile(travelTimes, 80);

  // Create the mapping
  const mapping: { [timePeriod: string]: string } = {};
  
  sortedPeriods.forEach(({ timePeriod, totalTravelTime }) => {
    let serviceBand: string;
    if (totalTravelTime <= p20) serviceBand = 'Fastest Service';
    else if (totalTravelTime <= p40) serviceBand = 'Fast Service';
    else if (totalTravelTime <= p60) serviceBand = 'Standard Service';
    else if (totalTravelTime <= p80) serviceBand = 'Slow Service';
    else serviceBand = 'Slowest Service';
    
    mapping[timePeriod] = serviceBand;
  });

  console.log(`🎯 Created service band mapping from ${timePointData?.length || 0} data points:`);
  console.log(`📊 Percentile thresholds: P20=${p20}, P40=${p40}, P60=${p60}, P80=${p80}`);
  console.log(`🗺️ Time period mappings:`, mapping);
  
  return mapping;
};

/**
 * Gets service band for a departure time using TimePoints analysis data
 * Provides fallback handling for times outside the TimePoints data range
 */
const getServiceBandForTime = (
  departureTime: string,
  timePeriodServiceBands: { [timePeriod: string]: string }
): ServiceBand['name'] => {
  // Parse the departure time
  const [hours, minutes] = departureTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  console.log(`🔍 getServiceBandForTime: Looking up service band for ${departureTime} (${totalMinutes} minutes)`);
  console.log(`🔍 Available mapping keys:`, Object.keys(timePeriodServiceBands || {}));
  
  // Check if we have any mappings at all
  if (!timePeriodServiceBands || Object.keys(timePeriodServiceBands).length === 0) {
    console.warn(`⚠️ WARNING: No service band mappings available from TimePoints data. Using fallback 'Standard Service' for ${departureTime}`);
    return 'Standard Service';
  }
  
  // Find matching time period
  for (const [timePeriod, serviceBand] of Object.entries(timePeriodServiceBands)) {
    const [startTime, endTime] = timePeriod.split(' - ');
    
    // Parse start time
    const [startHours, startMins] = startTime.split(':').map(Number);
    const startMinutes = startHours * 60 + startMins;
    
    // Parse end time 
    const [endHours, endMins] = endTime.split(':').map(Number);
    const endMinutes = endHours * 60 + endMins;
    
    // Check if departure time falls within this period
    if (totalMinutes >= startMinutes && totalMinutes <= endMinutes) {
      console.log(`✅ DEBUG: Found match - ${departureTime} in period ${timePeriod} = ${serviceBand}`);
      return validateServiceBandName(serviceBand);
    }
  }
  
  // No mapping found - use intelligent fallback based on time of day
  const availablePeriods = Object.keys(timePeriodServiceBands);
  console.warn(`⚠️ WARNING: No service band mapping found for departure time ${departureTime}. Available periods: ${availablePeriods.join(', ')}`);
  
  // Early morning or late evening: use slower service (more conservative)
  if (hours < 7 || hours >= 21) {
    console.log(`🔄 FALLBACK: Using 'Slow Service' for early/late hours (${departureTime})`);
    return 'Slow Service';
  }
  
  // Rush hours: use standard service
  if ((hours >= 7 && hours <= 9) || (hours >= 16 && hours <= 18)) {
    console.log(`🔄 FALLBACK: Using 'Standard Service' for peak hours (${departureTime})`);
    return 'Standard Service';
  }
  
  // Off-peak hours: use faster service
  console.log(`🔄 FALLBACK: Using 'Fast Service' for off-peak hours (${departureTime})`);
  return 'Fast Service';
};

// ==================== COLOR UTILITIES ====================
// Diverse professional colors for bus block cards
const getProfessionalColor = (index: number): string => {
  const colors = [
    'rgb(63, 81, 181)',     // Indigo
    'rgb(76, 175, 80)',     // Green
    'rgb(255, 87, 34)',     // Deep Orange
    'rgb(156, 39, 176)',    // Purple
    'rgb(255, 152, 0)',     // Orange
    'rgb(96, 125, 139)',    // Blue Grey
    'rgb(233, 30, 99)',     // Pink
    'rgb(0, 150, 136)',     // Teal
    'rgb(121, 85, 72)',     // Brown
    'rgb(158, 158, 158)',   // Grey
  ];
  return colors[index % colors.length];
};

const getServiceBandColor = (bandName: ServiceBand['name']): string => {
  const colorMap: Record<ServiceBand['name'], string> = {
    'Fastest Service': '#22c55e',   // Green
    'Fast Service': '#3b82f6',      // Blue  
    'Standard Service': '#f59e0b',  // Amber
    'Slow Service': '#ef4444',      // Red
    'Slowest Service': '#dc2626'    // Dark Red
  };
  return colorMap[bandName] || '#6b7280';
};

// ==================== MAIN COMPONENT ====================
export default function BlockConfiguration() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Extract TimePoints data from navigation state
  const {
    draftId: locationDraftId,
    timePointData = [],
    serviceBands = [],
    deletedPeriods = [],
    timePeriodServiceBands = {}
  } = location.state || {};
  
  // Get workflow draft
  const { 
    draft, 
    updateBlockConfiguration,
    updateTimepointsAnalysis,
    loading: draftLoading,
    error: draftError,
    isSaving: isDraftSaving
  } = useWorkflowDraft(locationDraftId);

  // Click and drag scrolling state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenTableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [saveNotification, setSaveNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Initialize default schedule configuration
  const [schedule, setSchedule] = useState<Schedule>(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem('busSchedule');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate and migrate data structure if needed
        if (parsed.serviceBands) {
          parsed.serviceBands.forEach((band: any) => {
            if (band.segmentTimes) {
              band.segmentTimes.forEach((segment: any, idx: number) => {
                // Ensure from/to properties exist
                if (!segment.from || !segment.to) {
                  const defaultSegments = [
                    { from: 'downtown_terminal', to: 'johnson_napier' },
                    { from: 'johnson_napier', to: 'rvh_entrance' },
                    { from: 'rvh_entrance', to: 'georgian_college' },
                    { from: 'georgian_college', to: 'georgian_mall' },
                    { from: 'georgian_mall', to: 'bayfield_mall' },
                    { from: 'bayfield_mall', to: 'downtown_return' }
                  ];
                  if (defaultSegments[idx]) {
                    segment.from = defaultSegments[idx].from;
                    segment.to = defaultSegments[idx].to;
                  }
                }
              });
            }
          });
        }
        return parsed;
      } catch (error) {
        console.error('Failed to parse saved schedule:', error);
      }
    }
    
    // Default configuration
    return {
      id: `schedule_${Date.now()}`,
      name: 'Route 101 - Blue',
      firstTripTime: '07:00',
      lastTripTime: '22:00',
      timePoints: [
        { id: 'downtown_terminal', name: 'Downtown Terminal' },
        { id: 'johnson_napier', name: 'Johnson at Napier' },
        { id: 'rvh_entrance', name: 'RVH Entrance' },
        { id: 'georgian_college', name: 'Georgian College' },
        { id: 'georgian_mall', name: 'Georgian Mall' },
        { id: 'bayfield_mall', name: 'Bayfield Mall' },
        { id: 'downtown_return', name: 'Downtown Terminal' }
      ],
      serviceBands: (() => {
        // Build service bands from TimePoints data if available
        const timePointsServiceBands = buildServiceBandsFromTimePointsData(timePointData || [], timePeriodServiceBands || {}, deletedPeriods || []);
        if (timePointsServiceBands && timePointsServiceBands.length > 0) {
          console.log('✅ Using service bands built from TimePoints data:');
          console.log(timePointsServiceBands.map(sb => `  - ${sb.name}: ${sb.segmentTimes.length} segments`));
          return timePointsServiceBands;
        }
        
        // Use passed serviceBands from navigation state if available
        if (serviceBands && serviceBands.length > 0) {
          console.log('✅ Using service bands from navigation state');
          return serviceBands;
        }
        
        // Fallback to hardcoded service bands
        console.log('⚠️ Using fallback hardcoded service bands');
        return [
        // Fallback service bands if no TimePoints data available
        {
          name: 'Fastest Service',
          color: getServiceBandColor('Fastest Service'),
          segmentTimes: [
            { from: 'downtown_terminal', to: 'johnson_napier', travelMinutes: 8 },
            { from: 'johnson_napier', to: 'rvh_entrance', travelMinutes: 12 },
            { from: 'rvh_entrance', to: 'georgian_college', travelMinutes: 15 },
            { from: 'georgian_college', to: 'georgian_mall', travelMinutes: 10 },
            { from: 'georgian_mall', to: 'bayfield_mall', travelMinutes: 18 },
            { from: 'bayfield_mall', to: 'downtown_return', travelMinutes: 25 }
          ],
          totalMinutes: 88
        },
        {
          name: 'Standard Service',
          color: getServiceBandColor('Standard Service'),
          segmentTimes: [
            { from: 'downtown_terminal', to: 'johnson_napier', travelMinutes: 12 },
            { from: 'johnson_napier', to: 'rvh_entrance', travelMinutes: 16 },
            { from: 'rvh_entrance', to: 'georgian_college', travelMinutes: 20 },
            { from: 'georgian_college', to: 'georgian_mall', travelMinutes: 15 },
            { from: 'georgian_mall', to: 'bayfield_mall', travelMinutes: 23 },
            { from: 'bayfield_mall', to: 'downtown_return', travelMinutes: 32 }
          ],
          totalMinutes: 118
        }
        ];
      })(),
      timePeriods: [],
      trips: [],
      blockConfigurations: [
        { blockNumber: 1, startTime: '07:00', endTime: '22:00' },
        { blockNumber: 2, startTime: '07:20', endTime: '22:20' },
        { blockNumber: 3, startTime: '07:40', endTime: '22:40' }
      ],
      cycleTimeMinutes: 120,
      automateBlockStartTimes: true,
      updatedAt: new Date().toISOString()
    };
  });

  // Get additional data from navigation state
  const {
    scheduleId,
    fileName
  } = location.state || {};

  // Store the service band mapping for reuse
  const [serviceBandMapping, setServiceBandMapping] = useState<{ [timePeriod: string]: string }>(() => {
    // Get data from location state inside initializer
    const {
      timePointData: initTimePointData = [],
      deletedPeriods: initDeletedPeriods = [],
      timePeriodServiceBands: initTimePeriodServiceBands = {}
    } = location.state || {};
    
    console.log('🔍 Initializing serviceBandMapping state...');
    console.log('  - timePointData length:', initTimePointData?.length || 0);
    console.log('  - timePeriodServiceBands:', initTimePeriodServiceBands);
    console.log('  - deletedPeriods:', initDeletedPeriods);
    
    // First check for direct mapping from TimePoints page
    if (initTimePeriodServiceBands && Object.keys(initTimePeriodServiceBands).length > 0) {
      console.log('✅ Using provided timePeriodServiceBands with', Object.keys(initTimePeriodServiceBands).length, 'periods');
      return initTimePeriodServiceBands;
    }
    
    // Create initial mapping if we have TimePoints data
    if (initTimePointData && initTimePointData.length > 0) {
      const mapping = createTimePeriodServiceBandMapping(initTimePointData, initDeletedPeriods);
      console.log('🎯 Initial service band mapping created with', Object.keys(mapping).length, 'periods');
      console.log('🎯 Mapping:', mapping);
      return mapping;
    }
    
    console.log('⚠️ No initial mapping available, using default');
    const defaultMapping = createDefaultServiceBandMapping();
    console.log('📦 Created default mapping with', Object.keys(defaultMapping).length, 'periods');
    return defaultMapping;
  });
  
  // Update service bands when TimePoints data changes or on initial mount
  useEffect(() => {
    console.log('📌 useEffect triggered - checking location.state');
    console.log('  - location.state:', location.state);
    console.log('  - timePointData length:', timePointData?.length || 0);
    console.log('  - timePeriodServiceBands:', timePeriodServiceBands);
    
    // First try to use the direct mapping if available
    if (timePeriodServiceBands && Object.keys(timePeriodServiceBands).length > 0) {
      console.log('✅ Using direct time period service band mapping from TimePoints');
      setServiceBandMapping(timePeriodServiceBands);
      
      // Build service bands using the direct mapping
      const newServiceBands = buildServiceBandsFromTimePointsData(timePointData || [], timePeriodServiceBands, deletedPeriods || []);
      if (newServiceBands.length > 0) {
        setSchedule(prev => ({
          ...prev,
          serviceBands: newServiceBands,
          updatedAt: new Date().toISOString()
        }));
        console.log('✅ Service bands updated using direct mapping');
      }
    } else if (timePointData && timePointData.length > 0) {
      console.log('📊 TimePoints data available, rebuilding service bands...');
      console.log('📊 Sample TimePoints data:', timePointData?.slice(0, 2) || []);
      
      // Create the mapping from TimePoints data
      const newMapping = createTimePeriodServiceBandMapping(timePointData || [], deletedPeriods || []);
      setServiceBandMapping(newMapping);
      
      // Then build service bands using the mapping
      const newServiceBands = buildServiceBandsFromTimePointsData(timePointData || [], newMapping, deletedPeriods || []);
      
      if (newServiceBands.length > 0) {
        setSchedule(prev => ({
          ...prev,
          serviceBands: newServiceBands,
          updatedAt: new Date().toISOString()
        }));
        console.log('✅ Service bands updated from TimePoints data');
        console.log('🗺️ Service band mapping:', newMapping);
      }
    } else {
      console.log('⚠️ No TimePoints data available in useEffect');
      // Create a default mapping for testing/fallback
      const defaultMapping = createDefaultServiceBandMapping();
      setServiceBandMapping(defaultMapping);
      console.log('📦 Using default service band mapping:', defaultMapping);
    }
  }, [location.state]); // React to changes in location.state
  
  // Mouse event handlers for drag scrolling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    const container = tableContainerRef.current;
    if (container) {
      setScrollStart({
        left: container.scrollLeft,
        top: container.scrollTop
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    tableContainerRef.current.scrollLeft = scrollStart.left - deltaX;
    tableContainerRef.current.scrollTop = scrollStart.top - deltaY;
  }, [isDragging, dragStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Auto-save functionality with debounce
  const autoSave = useCallback(() => {
    localStorage.setItem('busSchedule', JSON.stringify(schedule));
    console.log('🔄 Auto-saved schedule configuration');
  }, [schedule]);

  // Debounced auto-save - saves 1 second after user stops typing
  const debouncedAutoSave = useCallback(() => {
    const timeoutId = setTimeout(autoSave, 1000);
    return () => clearTimeout(timeoutId);
  }, [autoSave]);

  // Calculate automated start time for blocks
  const calculateAutomatedStartTime = useCallback((
    blockIndex: number, 
    frequencyMinutes: number, 
    firstBlockStartTime: string
  ): string => {
    const baseMinutes = timeToMinutes(firstBlockStartTime);
    const offsetMinutes = blockIndex * frequencyMinutes;
    return minutesToTime(baseMinutes + offsetMinutes);
  }, []);

  // Update block configurations when number changes
  const updateBlockCount = (newCount: number) => {
    const currentConfigs = [...schedule.blockConfigurations];
    
    if (newCount > currentConfigs.length) {
      // Add new blocks
      for (let i = currentConfigs.length; i < newCount; i++) {
        const blockNumber = i + 1;
        let startTime = '07:00';
        let endTime = currentConfigs[0]?.endTime || '22:00'; // Default to Block 1's end time
        
        if (schedule.automateBlockStartTimes && i > 0) {
          const frequencyMinutes = Math.round(schedule.cycleTimeMinutes / newCount);
          startTime = calculateAutomatedStartTime(i, frequencyMinutes, currentConfigs[0].startTime);
          endTime = currentConfigs[0]?.endTime || '22:00'; // Keep Block 1's end time even when automated
        }
        
        currentConfigs.push({
          blockNumber,
          startTime,
          endTime
        });
      }
    } else if (newCount < currentConfigs.length) {
      // Remove excess blocks
      currentConfigs.splice(newCount);
    }
    
    setSchedule(prev => ({
      ...prev,
      blockConfigurations: currentConfigs,
      updatedAt: new Date().toISOString()
    }));
  };

  // Update automated start times when settings change
  useEffect(() => {
    if (schedule.automateBlockStartTimes && schedule.blockConfigurations.length > 1) {
      const frequencyMinutes = Math.round(schedule.cycleTimeMinutes / schedule.blockConfigurations.length);
      const updatedConfigs = schedule.blockConfigurations.map((config, index) => {
        if (index === 0) return config; // Keep first block manual
        
        const startTime = calculateAutomatedStartTime(index, frequencyMinutes, schedule.blockConfigurations[0].startTime);
        return {
          ...config,
          startTime,
          endTime: schedule.blockConfigurations[0].endTime // Use Block 1's end time
        };
      });
      
      setSchedule(prev => ({
        ...prev,
        blockConfigurations: updatedConfigs,
        updatedAt: new Date().toISOString()
      }));
    }
  }, [schedule.cycleTimeMinutes, schedule.automateBlockStartTimes, schedule.blockConfigurations.length, calculateAutomatedStartTime]);

  // Auto-save whenever schedule changes
  useEffect(() => {
    const cleanup = debouncedAutoSave();
    return cleanup;
  }, [schedule, debouncedAutoSave]);

  // Auto-generate time periods based on service hours and traffic patterns
  const generateTimePeriods = () => {
    const periods: TimePeriod[] = [];
    const startHour = Math.floor(timeToMinutes(schedule.firstTripTime) / 60);
    const endHour = Math.ceil(timeToMinutes(schedule.lastTripTime) / 60);
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let half = 0; half < 2; half++) {
        const startMinutes = hour * 60 + half * 30;
        const endMinutes = startMinutes + 30;
        
        // Skip if outside service hours
        if (startMinutes < timeToMinutes(schedule.firstTripTime) || 
            endMinutes > timeToMinutes(schedule.lastTripTime)) {
          continue;
        }
        
        // Get service band from TimePoints analysis data (with fallback handling)
        const currentTime = minutesToTime(startMinutes);
        const serviceBand = getServiceBandForTime(currentTime, timePeriodServiceBands);
        
        periods.push({
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes),
          serviceBand
        });
      }
    }
    
    setSchedule(prev => ({
      ...prev,
      timePeriods: periods,
      updatedAt: new Date().toISOString()
    }));
  };

  // Generate trips based on block configurations
  const generateTrips = async () => {
    console.log('Generate trips button clicked!');
    console.log('Schedule configuration:', {
      blockConfigurations: schedule.blockConfigurations,
      cycleTimeMinutes: schedule.cycleTimeMinutes,
      automateBlockStartTimes: schedule.automateBlockStartTimes
    });
    
    // Auto-save TimePoints data before generating schedule
    if (updateTimepointsAnalysis && timePointData.length > 0) {
      console.log('💾 Auto-saving TimePoints analysis before schedule generation...');
      try {
        const saveResult = await updateTimepointsAnalysis({
          serviceBands,
          travelTimeData: timePointData,
          outliers: [], // We don't have outliers data in this context
          userModifications: [], // We don't have user modifications in this context
          deletedPeriods: Array.from(deletedPeriods),
          timePeriodServiceBands
        });
        
        if (saveResult.success) {
          console.log('✅ TimePoints analysis auto-saved successfully');
        } else {
          console.warn('⚠️ TimePoints auto-save failed:', saveResult.error);
        }
      } catch (error) {
        console.error('❌ Error during TimePoints auto-save:', error);
        // Continue with schedule generation even if auto-save fails
      }
    }
    
    // Safety validation to prevent infinite loops
    if (!schedule.cycleTimeMinutes || schedule.cycleTimeMinutes <= 0) {
      console.error('Invalid cycle time:', schedule.cycleTimeMinutes);
      alert('Error: Cycle time must be greater than 0 minutes. Please set a valid cycle time.');
      return;
    }
    
    if (schedule.blockConfigurations.length === 0) {
      console.error('No block configurations found');
      alert('Error: No bus blocks configured. Please add at least one bus block.');
      return;
    }
    
    // Use the service band mapping from state
    const workingTimePeriodServiceBands = serviceBandMapping;
    
    if (!workingTimePeriodServiceBands || Object.keys(workingTimePeriodServiceBands).length === 0) {
      console.warn('⚠️ No service band mapping available. Will use fallback service band assignment.');
      console.log('Available TimePoints data:', timePointData?.length || 0, 'records');
      console.log('Service band mapping state:', serviceBandMapping);
    } else {
      console.log('✅ Using service band mapping with', Object.keys(workingTimePeriodServiceBands).length, 'time periods');
      console.log('📊 Sample mappings:', Object.entries(workingTimePeriodServiceBands).slice(0, 3));
    }
    
    const trips: Trip[] = [];
    
    const firstMinutes = timeToMinutes(getTimeWithDefault(schedule.firstTripTime, '07:00'));
    const lastMinutes = timeToMinutes(getTimeWithDefault(schedule.lastTripTime, '22:00'));
    
    // Additional safety checks
    if (firstMinutes >= lastMinutes) {
      console.error('Invalid time range:', { firstMinutes, lastMinutes });
      alert('Error: First trip time must be earlier than last trip time.');
      return;
    }
    
    // Maximum safety limits to prevent infinite loops and memory issues
    const MAX_TRIPS_PER_BLOCK = 50; // Reasonable limit for a single bus block
    const MAX_TOTAL_TRIPS = 500; // Overall safety limit
    const MAX_LOOP_ITERATIONS = 1000; // Circuit breaker for while loops
    
    // Auto-generate time periods if they don't exist
    let currentTimePeriods = schedule.timePeriods;
    if (currentTimePeriods.length === 0) {
      const periods: TimePeriod[] = [];
      
      // Use the actual range from firstTripTime and lastTripTime, or derive from TimePoints data
      const startHour = Math.floor(timeToMinutes(getTimeWithDefault(schedule.firstTripTime, '07:00')) / 60);
      const endHour = Math.ceil(timeToMinutes(getTimeWithDefault(schedule.lastTripTime, '22:00')) / 60);
      
      // If we have TimePoints service bands, only generate periods within their range
      if (timePeriodServiceBands && Object.keys(timePeriodServiceBands).length > 0) {
        // Extract available time periods from TimePoints data
        const availablePeriods = Object.keys(timePeriodServiceBands);
        for (const timePeriod of availablePeriods) {
          const serviceBand = timePeriodServiceBands[timePeriod];
          const [startTime, endTime] = timePeriod.split(' - ');
          
          periods.push({
            startTime,
            endTime,
            serviceBand: validateServiceBandName(serviceBand)
          });
        }
      } else {
        // Fallback: generate periods within service hours with default service band
        for (let hour = startHour; hour <= endHour; hour++) {
          for (let half = 0; half < 2; half++) {
            const startMinutes = hour * 60 + half * 30;
            const endMinutes = startMinutes + 30;
            
            // Skip if outside service hours
            if (startMinutes < timeToMinutes(getTimeWithDefault(schedule.firstTripTime, '07:00')) || 
                endMinutes > timeToMinutes(getTimeWithDefault(schedule.lastTripTime, '22:00'))) {
              continue;
            }
            
            periods.push({
              startTime: minutesToTime(startMinutes),
              endTime: minutesToTime(endMinutes),
              serviceBand: 'Standard Service' // Default fallback
            });
          }
        }
      }
      currentTimePeriods = periods;
    }
    
    // Generate trips for each block configuration
    for (let blockIndex = 0; blockIndex < schedule.blockConfigurations.length; blockIndex++) {
      const blockConfig = schedule.blockConfigurations[blockIndex];
      
      // Use automated start time if automation is enabled, otherwise use configured time
      let blockStartTime: string;
      if (schedule.automateBlockStartTimes && blockIndex > 0) {
        const frequencyMinutes = Math.round(schedule.cycleTimeMinutes / schedule.blockConfigurations.length);
        blockStartTime = calculateAutomatedStartTime(
          blockIndex,
          frequencyMinutes,
          schedule.blockConfigurations[0].startTime
        );
      } else {
        blockStartTime = getTimeWithDefault(blockConfig.startTime, '07:00');
      }
      
      const blockEndTime = getTimeWithDefault(blockConfig.endTime, '22:00');
      
      let currentDepartureTime = blockStartTime;
      let blockTripCount = 0;
      let loopIterations = 0;
      
      // Determine service band for this block based on its start time from TimePoints data
      const blockServiceBand = getServiceBandForTime(blockStartTime, workingTimePeriodServiceBands);
      console.log(`🚌 BLOCK ${blockConfig.blockNumber}: Start time ${blockStartTime} → Service Band: ${blockServiceBand}`);
      
      // First, calculate the actual trip time for this service band to use in loop condition
      const serviceBandName = blockServiceBand;
      const serviceBand = findServiceBand(schedule.serviceBands, serviceBandName);
      
      if (!serviceBand) {
        console.error('Service band not found:', serviceBandName);
        console.error('Available service bands in schedule:', schedule.serviceBands.map(sb => sb.name));
        console.error('Looking for service band:', serviceBandName);
        continue; // Skip to next block
      }
      
      // Calculate actual trip time from service band (matching the exact recovery time logic)
      let totalTravelTime = serviceBand.segmentTimes.reduce((total, segment) => total + segment.travelMinutes, 0);
      let totalRecoveryTime = 0;
      
      // Calculate recovery time using the same logic as the detailed calculation
      for (let i = 1; i < schedule.timePoints.length; i++) {
        const recoveryMinutes = i === schedule.timePoints.length - 1 ? 3 : 
                               i === Math.floor(schedule.timePoints.length / 2) ? 2 : 1;
        totalRecoveryTime += recoveryMinutes;
      }
      
      const actualTripTimeMinutes = totalTravelTime + totalRecoveryTime;
      
      console.log(`🚌 BLOCK ${blockConfig.blockNumber}: Using service band "${serviceBandName}"`);
      console.log(`  📊 Service band travel time: ${totalTravelTime} minutes`);
      console.log(`  ⏱️  Recovery time breakdown: ${totalRecoveryTime} minutes`);
      console.log(`  🔄 Total actual trip time: ${actualTripTimeMinutes} minutes`);
      console.log(`  📋 Service band segments:`, serviceBand.segmentTimes.map(s => `${s.travelMinutes}min`).join(' + '));
      
      // Generate trips for this block using actual trip time from service band
      while (
        timeToMinutes(currentDepartureTime) + actualTripTimeMinutes <= timeToMinutes(blockEndTime) &&
        blockTripCount < MAX_TRIPS_PER_BLOCK &&
        trips.length < MAX_TOTAL_TRIPS &&
        loopIterations < MAX_LOOP_ITERATIONS
      ) {
        loopIterations++;
        
        // Determine service band for THIS TRIP based on its departure time (not block start time)
        const tripServiceBandName = getServiceBandForTime(currentDepartureTime, workingTimePeriodServiceBands);
        const tripServiceBand = findServiceBand(schedule.serviceBands, tripServiceBandName);
        
        if (!tripServiceBand) {
          console.error(`Service band not found for trip at ${currentDepartureTime}:`, tripServiceBandName);
          console.error('Available service bands:', schedule.serviceBands.map(sb => sb.name));
          break;
        }
        
        console.log(`  🎯 Trip ${blockTripCount + 1} at ${currentDepartureTime}: Using service band "${tripServiceBandName}" (trip-specific, not block-wide)`);
        console.log(`  📊 Trip service band travel time: ${tripServiceBand.segmentTimes.reduce((sum, seg) => sum + seg.travelMinutes, 0)} minutes`);
        
        // Calculate arrival and departure times for each timepoint using trip-specific service band
        const arrivalTimes: { [timePointId: string]: string } = {};
        const departureTimes: { [timePointId: string]: string } = {};
        const recoveryTimes: { [timePointId: string]: number } = {};
        
        let currentMinutes = timeToMinutes(currentDepartureTime);
        const tripStartMinutes = currentMinutes; // Save start time for calculating total trip time
        
        schedule.timePoints.forEach((timePoint, index) => {
          if (index === 0) {
            // First timepoint - departure time
            arrivalTimes[timePoint.id] = currentDepartureTime;
            departureTimes[timePoint.id] = currentDepartureTime;
            recoveryTimes[timePoint.id] = 0;
          } else {
            // Subsequent timepoints - add travel time from trip-specific service band
            const segmentTime = tripServiceBand.segmentTimes[index - 1];
            if (segmentTime) {
              currentMinutes += segmentTime.travelMinutes;
              const arrivalTime = minutesToTime(currentMinutes);
              arrivalTimes[timePoint.id] = arrivalTime;
              
              // Add recovery time (1-3 minutes depending on timepoint)
              const recoveryMinutes = index === schedule.timePoints.length - 1 ? 3 : 
                                    index === Math.floor(schedule.timePoints.length / 2) ? 2 : 1;
              recoveryTimes[timePoint.id] = recoveryMinutes;
              currentMinutes += recoveryMinutes;
              departureTimes[timePoint.id] = minutesToTime(currentMinutes);
            }
          }
        });
        
        // Note: actualTripTimeMinutes is already calculated outside the loop for consistency
        
        console.log(`  📍 Trip departure ${currentDepartureTime} → Service Band: ${tripServiceBandName}`);
        
        trips.push({
          tripNumber: 0, // Will be assigned after sorting by departure time
          blockNumber: blockConfig.blockNumber,
          departureTime: currentDepartureTime,
          arrivalTimes,
          departureTimes,
          recoveryTimes,
          serviceBand: tripServiceBandName, // Each trip gets its own service band based on its departure time
          recoveryMinutes: 5 // Default recovery time at end of trip
        });
        
        blockTripCount++;
        
        // Move to next trip departure time - block cycling logic
        // Next trip in same block starts when the bus arrives back at the origin
        const finalTimePointId = schedule.timePoints[schedule.timePoints.length - 1].id;
        const finalArrivalTime = arrivalTimes[finalTimePointId]; // Use arrival time at final stop
        const finalRecoveryTime = recoveryTimes[finalTimePointId]; // Get recovery time at final stop
        
        // Next trip starts after: final arrival + recovery time
        // Note: finalArrivalTime is the actual arrival time without recovery, so we add recovery time
        const nextDepartureMinutes = timeToMinutes(finalArrivalTime) + finalRecoveryTime;
        currentDepartureTime = minutesToTime(nextDepartureMinutes);
        
        console.log(`  🔄 Trip arrives at final stop at ${finalArrivalTime}, +${finalRecoveryTime}min recovery = next trip starts at ${currentDepartureTime}`);
        
        // Debug logging for trip timing validation
        console.log(`  📊 Trip ${blockTripCount + 1} Block ${blockConfig.blockNumber}: Previous trip ended ${finalArrivalTime}, next starts ${currentDepartureTime}`);
        console.log(`  ⏰ Block cycling calculation: ${finalArrivalTime} + ${finalRecoveryTime}min recovery = ${currentDepartureTime}`);
        console.log(`  🚌 Block ${blockConfig.blockNumber} trip count: ${blockTripCount}, total trips so far: ${trips.length}`)
        
      }
      
      console.log(`Block ${blockConfig.blockNumber}: Generated ${blockTripCount} trips`);
    }
    
    console.log(`Total trips generated: ${trips.length}`);
    
    if (trips.length === 0) {
      console.error('❌ No trips were generated!');
      console.error('Debug info:', {
        blockConfigurations: schedule.blockConfigurations,
        cycleTimeMinutes: schedule.cycleTimeMinutes,
        firstMinutes,
        lastMinutes,
        timePeriodServiceBands,
        currentTimePeriods: currentTimePeriods.length
      });
      alert('Error: No trips were generated. Check console for debug information.');
      return;
    }
    
    // Sort trips by departure time and assign trip numbers chronologically
    trips.sort((a, b) => {
      const aMinutes = timeToMinutes(a.departureTime);
      const bMinutes = timeToMinutes(b.departureTime);
      return aMinutes - bMinutes;
    });
    
    // Assign trip numbers based on chronological order (earliest departure = trip #1)
    trips.forEach((trip, index) => {
      trip.tripNumber = index + 1;
    });
    
    console.log(`✅ Trips sorted chronologically and numbered. First trip: ${trips[0]?.departureTime}, Last trip: ${trips[trips.length - 1]?.departureTime}`);
    
    // Update schedule with generated trips and time periods
    const updatedSchedule = {
      ...schedule,
      trips,
      timePeriods: currentTimePeriods,
      updatedAt: new Date().toISOString()
    };
    
    setSchedule(updatedSchedule);
    
    // Save the generated schedule
    try {
      const summaryScheduleData: SummarySchedule = {
        routeId: updatedSchedule.id,
        routeName: updatedSchedule.name,
        direction: 'Outbound', // Default direction
        timePoints: updatedSchedule.timePoints.map((tp, index) => ({
          id: tp.id,
          name: tp.name,
          sequence: index + 1
        })),
        weekday: [], // Empty schedule matrix for now
        saturday: [], // Empty schedule matrix for now 
        sunday: [], // Empty schedule matrix for now
        effectiveDate: new Date(),
        metadata: {
          weekdayTrips: updatedSchedule.trips.length,
          saturdayTrips: 0,
          sundayTrips: 0,
          frequency: 30, // default frequency
          operatingHours: {
            start: updatedSchedule.firstTripTime,
            end: updatedSchedule.lastTripTime
          }
        }
      };
      
      // Auto-save the schedule
      const result = scheduleStorage.saveSchedule(
        summaryScheduleData,
        'excel',
        updatedSchedule.name,
        null // no raw data since this is generated
      );
      
      // Also save as a draft for better persistence
      // Create minimal upload data structure for generated schedules
      const generatedData = {
        sheets: [],
        metadata: {
          fileName: `${updatedSchedule.name}_generated`,
          generatedFromBlocks: true,
          blockConfigurations: updatedSchedule.blockConfigurations,
          trips: updatedSchedule.trips
        }
      };
      
      const draftResult = scheduleStorage.saveDraftSchedule(
        `${updatedSchedule.name}_generated_${new Date().toISOString().split('T')[0]}`,
        'excel',
        generatedData as any, // Minimal structure for generated schedules
        {
          summarySchedule: summaryScheduleData,
          processingStep: 'completed',
          autoSaved: true
        }
      );
      
      if (result.success && result.scheduleId) {
        console.log('✅ Schedule auto-saved successfully with ID:', result.scheduleId);
        console.log('✅ Also saved as draft with ID:', draftResult.draftId);
        
        // Show success notification
        setSaveNotification({
          open: true,
          message: '✅ Schedule auto-saved successfully!',
          severity: 'success'
        });
        
        // Save block configuration to workflow draft if available
        if (draft && updateBlockConfiguration) {
          const blockConfigData = {
            numberOfBuses: schedule.blockConfigurations.length,
            cycleTimeMinutes: schedule.cycleTimeMinutes,
            automateBlockStartTimes: schedule.automateBlockStartTimes,
            blockConfigurations: schedule.blockConfigurations.map(bc => ({
              blockNumber: bc.blockNumber,
              startTime: bc.startTime,
              endTime: bc.endTime
            }))
          };
          
          await updateBlockConfiguration(blockConfigData);
          console.log('✅ Block configuration saved to workflow draft');
        }
        
        // Save complete schedule to localStorage for persistence
        const completeSchedule = { 
          ...updatedSchedule, 
          timePointData: timePointData,
          deletedPeriods: deletedPeriods,
          timePeriodServiceBands: timePeriodServiceBands
        };
        localStorage.setItem('currentSummarySchedule', JSON.stringify(completeSchedule));
        console.log('💾 Summary schedule saved to localStorage for persistence');
        
        // Mark the Block Configuration step as complete
        workflowStateService.completeStep('block-config', {
          schedule: completeSchedule,
          trips: updatedSchedule.trips
        });
        
        // Navigate to BlockSummarySchedule page with the generated schedule and draft ID
        navigate('/block-summary-schedule', { 
          state: { 
            schedule: completeSchedule,
            draftId: draft?.draftId
          } 
        });
      } else {
        // If save fails, still navigate but without saved ID
        const completeSchedule = { 
          ...updatedSchedule, 
          timePointData: timePointData,
          deletedPeriods: deletedPeriods,
          timePeriodServiceBands: timePeriodServiceBands
        };
        localStorage.setItem('currentSummarySchedule', JSON.stringify(completeSchedule));
        console.log('💾 Summary schedule saved to localStorage for persistence (save failed)');
        
        // Mark the Block Configuration step as complete even if save failed
        workflowStateService.completeStep('block-config', {
          schedule: completeSchedule,
          trips: updatedSchedule.trips
        });
        
        navigate('/block-summary-schedule', { 
          state: { 
            schedule: completeSchedule,
            draftId: draft?.draftId
          } 
        });
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      // Still navigate to show the generated schedule even if save fails
      const completeSchedule = { 
        ...updatedSchedule, 
        timePointData: timePointData,
        deletedPeriods: deletedPeriods,
        timePeriodServiceBands: timePeriodServiceBands
      };
      localStorage.setItem('currentSummarySchedule', JSON.stringify(completeSchedule));
      console.log('💾 Summary schedule saved to localStorage for persistence (catch error)');
      
      // Mark the Block Configuration step as complete even in error case
      workflowStateService.completeStep('block-config', {
        schedule: completeSchedule,
        trips: updatedSchedule.trips
      });
      
      navigate('/block-summary-schedule', { 
        state: { 
          schedule: completeSchedule
        } 
      });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/timepoints', {
            state: {
              timePointData,
              serviceBands,
              deletedPeriods,
              timePeriodServiceBands,
              scheduleId,
              fileName
            }
          })}
          sx={{ mr: 2 }}
        >
          Back to Timepoints
        </Button>
      </Box>
      {/* Configuration Content - No Tabs */}
      <Grid container spacing={4}>
        {/* Block Configuration */}
        <Grid size={12}>
          <Card elevation={2}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight="600" gutterBottom sx={{ color: 'rgb(0, 75, 128)', mb: 1 }}>
                🚌 Bus Block Configuration
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3, lineHeight: 1.6 }}>
                Configure individual bus blocks with professional scheduling interface
              </Typography>
              
              {/* Bus Count Control */}
              <Box sx={{ mb: 3, p: 3, backgroundColor: 'rgb(0, 75, 128)', borderRadius: 2, color: 'white' }}>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                  Bus Fleet Configuration
                </Typography>
                <Grid container spacing={3} alignItems="flex-start">
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6,
                      md: 4,
                      lg: 3
                    }}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontWeight: 500 }}>
                        Number of Buses
                      </Typography>
                      <TextField
                        type="number"
                        size="small"
                        value={schedule.blockConfigurations.length}
                        onChange={(e) => {
                          const newCount = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                          updateBlockCount(newCount);
                        }}
                        onBlur={() => {
                          autoSave(); // Immediate save when user finishes input
                        }}
                        inputProps={{ min: 1, max: 10 }}
                        sx={{ 
                          backgroundColor: 'white', 
                          borderRadius: 1,
                          width: '100px',
                          '& .MuiOutlinedInput-root': {
                            fontSize: '1rem'
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mt: 0.5 }}>
                        Max: 10 buses
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6,
                      md: 8,
                      lg: 9
                    }}>
                    <Box sx={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                      borderRadius: 2, 
                      px: 3, 
                      py: 2,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      mt: 1
                    }}>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
                        🚌 {schedule.blockConfigurations.length} bus{schedule.blockConfigurations.length !== 1 ? 'es' : ''} configured • {schedule.cycleTimeMinutes} minute cycle time
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
              
              {/* Cycle Time Control */}
              <Box sx={{ mb: 3, p: 3, backgroundColor: 'grey.50', borderRadius: 2, border: '1px solid rgba(0, 75, 128, 0.1)' }}>
                <Typography variant="h6" sx={{ color: 'rgb(0, 75, 128)', fontWeight: 600, mb: 2 }}>
                  Service Timing Configuration
                </Typography>
                <Grid container spacing={3} alignItems="flex-start">
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6,
                      md: 4,
                      lg: 3
                    }}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ color: 'rgb(0, 75, 128)', mb: 1, fontWeight: 500 }}>
                        Cycle Time (minutes)
                      </Typography>
                      <TextField
                        type="number"
                        size="small"
                        value={schedule.cycleTimeMinutes}
                        onChange={(e) => {
                          const newCycleTime = parseInt(e.target.value) || 0;
                          setSchedule(prev => ({
                            ...prev,
                            cycleTimeMinutes: newCycleTime,
                            updatedAt: new Date().toISOString()
                          }));
                        }}
                        onBlur={() => {
                          autoSave(); // Immediate save when user finishes input
                        }}
                        inputProps={{ min: 1 }}
                        sx={{ 
                          backgroundColor: 'white', 
                          borderRadius: 1, 
                          width: '120px',
                          '& .MuiOutlinedInput-root': {
                            fontSize: '1rem'
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgba(0, 75, 128, 0.7)', display: 'block', mt: 0.5 }}>
                        Round-trip time
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6,
                      md: 8,
                      lg: 9
                    }}>
                    <Box sx={{ 
                      backgroundColor: 'rgba(0, 75, 128, 0.05)', 
                      borderRadius: 2, 
                      px: 3, 
                      py: 2,
                      border: '1px solid rgba(0, 75, 128, 0.2)',
                      mt: 1
                    }}>
                      <Typography variant="body1" sx={{ color: 'rgb(0, 75, 128)', fontWeight: 500 }}>
                        ⏱️ Complete round-trip cycle time • All buses follow this pattern
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Frequency Display */}
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(0, 75, 128, 0.1)', borderRadius: 2, textAlign: 'center', border: '1px solid rgba(0, 75, 128, 0.3)' }}>
                <Typography variant="h6" fontWeight="bold" sx={{ color: 'rgb(0, 75, 128)' }}>
                  Service Frequency: {Math.round((schedule.cycleTimeMinutes / schedule.blockConfigurations.length) * 10) / 10} minutes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  A bus arrives every {Math.round((schedule.cycleTimeMinutes / schedule.blockConfigurations.length) * 10) / 10} minutes (Cycle Time ÷ Number of Buses)
                </Typography>
              </Box>

              {/* Automate Block Start Times Toggle */}
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(0, 75, 128, 0.05)', borderRadius: 2, border: '1px solid rgba(0, 75, 128, 0.2)' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={schedule.automateBlockStartTimes}
                      onChange={(e) => {
                        setSchedule(prev => ({
                          ...prev,
                          automateBlockStartTimes: e.target.checked,
                          updatedAt: new Date().toISOString()
                        }));
                        autoSave(); // Immediate save when toggle is changed
                      }}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        Automate Block Start Times
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatically calculate start times based on frequency (Block 1 remains manual)
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              {/* Bus Block Cards - Modern Professional Design */}
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: 'repeat(auto-fit, minmax(192px, 1fr))', 
                    lg: 'repeat(auto-fit, minmax(210px, 1fr))' 
                  },
                  gap: 4,
                  mb: 4,
                  maxWidth: '100%'
                }}
              >
                {schedule.blockConfigurations.map((blockConfig, index) => {
                  const isAutomated = schedule.automateBlockStartTimes && index > 0;
                  const cardColor = getProfessionalColor(index);
                  
                  // Use solid color background
                  const solidColor = cardColor;
                  
                  return (
                    <Card
                      key={blockConfig.blockNumber}
                      elevation={6}
                      sx={{
                        borderRadius: '24px',
                        backgroundColor: solidColor,
                        position: 'relative',
                        overflow: 'visible',
                        transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        cursor: isAutomated ? 'default' : 'pointer',
                        transform: 'translateY(0)',
                        '&:hover': {
                          transform: isAutomated ? 'translateY(0)' : 'translateY(-8px)',
                          boxShadow: isAutomated 
                            ? '0 10px 40px rgba(0,0,0,0.15)' 
                            : '0 20px 60px rgba(0,0,0,0.25)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          borderRadius: '24px',
                          padding: '2px',
                          background: `linear-gradient(135deg, rgba(255,255,255,0.3), transparent)`,
                          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          maskComposite: 'exclude'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 0, height: '100%', minHeight: '168px' }}>
                        {/* Header Section */}
                        <Box 
                          sx={{ 
                            position: 'relative',
                            background: `linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))`,
                            borderRadius: '24px 24px 0 0',
                            p: 3,
                            pb: 2,
                            textAlign: 'center'
                          }}
                        >
                          <Typography 
                            variant="h5" 
                            sx={{ 
                              color: 'white',
                              fontWeight: 800,
                              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              letterSpacing: '0.5px',
                              fontSize: '1.4rem',
                              mb: 1
                            }}
                          >
                            Bus Block {blockConfig.blockNumber}
                          </Typography>
                          
                          {/* Status Indicator */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Box 
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: isAutomated ? '#FFD700' : '#00E676',
                                boxShadow: `0 0 8px ${isAutomated ? '#FFD700' : '#00E676'}`,
                                animation: 'pulse 2s infinite'
                              }}
                            />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'rgba(255,255,255,0.9)',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                              }}
                            >
                              {isAutomated ? 'Automated' : 'Manual'}
                            </Typography>
                          </Box>
                          
                          {isAutomated && (
                            <Chip 
                              label="AUTO" 
                              size="small" 
                              sx={{ 
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                bgcolor: '#FFD700', 
                                color: '#1a1a1a',
                                fontWeight: 800,
                                fontSize: '0.65rem',
                                letterSpacing: '0.5px',
                                boxShadow: '0 2px 8px rgba(255,215,0,0.4)'
                              }} 
                            />
                          )}
                        </Box>

                        {/* Time Configuration Section */}
                        <Box sx={{ p: 3, pt: 2 }}>
                          <Grid container spacing={3}>
                            <Grid size={6}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                    mb: 2,
                                    letterSpacing: '0.8px',
                                    textTransform: 'uppercase'
                                  }}
                                >
                                  Start Time
                                </Typography>
                                <Paper
                                  elevation={3}
                                  sx={{
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    background: 'linear-gradient(145deg, #ffffff, #f8f9fa)',
                                    border: '1px solid rgba(255,255,255,0.8)'
                                  }}
                                >
                                  <TextField
                                    type="time"
                                    size="medium"
                                    value={blockConfig.startTime}
                                    onChange={(e) => {
                                      if (!isAutomated) {
                                        const newConfigs = [...schedule.blockConfigurations];
                                        newConfigs[index].startTime = e.target.value;
                                        setSchedule(prev => ({
                                          ...prev,
                                          blockConfigurations: newConfigs,
                                          updatedAt: new Date().toISOString()
                                        }));
                                      }
                                    }}
                                    onBlur={() => {
                                      if (!isAutomated) {
                                        autoSave(); // Immediate save when user finishes input
                                      }
                                    }}
                                    disabled={isAutomated}
                                    sx={{ 
                                      width: '100%',
                                      '& .MuiInputBase-input': { 
                                        fontSize: '1.1rem',
                                        fontWeight: 700,
                                        color: isAutomated ? '#9e9e9e' : '#1976d2',
                                        textAlign: 'center',
                                        padding: '16px 12px',
                                        letterSpacing: '1px',
                                        fontFamily: 'monospace'
                                      },
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        border: 'none'
                                      },
                                      '& .MuiInputBase-root': {
                                        borderRadius: '16px'
                                      }
                                    }}
                                  />
                                </Paper>
                              </Box>
                            </Grid>
                            
                            <Grid size={6}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                    mb: 2,
                                    letterSpacing: '0.8px',
                                    textTransform: 'uppercase'
                                  }}
                                >
                                  End Time
                                </Typography>
                                <Paper
                                  elevation={3}
                                  sx={{
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    background: 'linear-gradient(145deg, #ffffff, #f8f9fa)',
                                    border: '1px solid rgba(255,255,255,0.8)'
                                  }}
                                >
                                  <TextField
                                    type="time"
                                    size="medium"
                                    value={blockConfig.endTime}
                                    onChange={(e) => {
                                      const newConfigs = [...schedule.blockConfigurations];
                                      newConfigs[index].endTime = e.target.value;
                                      setSchedule(prev => ({
                                        ...prev,
                                        blockConfigurations: newConfigs,
                                        updatedAt: new Date().toISOString()
                                      }));
                                    }}
                                    onBlur={() => {
                                      autoSave(); // Immediate save when user finishes input
                                    }}
                                    sx={{ 
                                      width: '100%',
                                      '& .MuiInputBase-input': { 
                                        fontSize: '1.1rem',
                                        fontWeight: 700,
                                        color: '#1976d2',
                                        textAlign: 'center',
                                        padding: '16px 12px',
                                        letterSpacing: '1px',
                                        fontFamily: 'monospace'
                                      },
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        border: 'none'
                                      },
                                      '& .MuiInputBase-root': {
                                        borderRadius: '16px'
                                      }
                                    }}
                                  />
                                </Paper>
                              </Box>
                            </Grid>
                          </Grid>

                          {/* Duration Display */}
                          <Box sx={{ mt: 3, textAlign: 'center' }}>
                            <Paper 
                              elevation={2}
                              sx={{ 
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))', 
                                borderRadius: '20px', 
                                py: 2.5, 
                                px: 3,
                                border: '2px solid rgba(255,255,255,0.6)',
                                backdropFilter: 'blur(10px)',
                                position: 'relative',
                                overflow: 'hidden',
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: 0,
                                  left: '-100%',
                                  width: '100%',
                                  height: '100%',
                                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                  animation: 'shimmer 3s infinite'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                <ClockIcon sx={{ color: cardColor, fontSize: '1.2rem' }} />
                                <Typography 
                                  variant="h6" 
                                  sx={{ 
                                    color: cardColor,
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    letterSpacing: '0.5px',
                                    textShadow: 'none'
                                  }}
                                >
                                  {(() => {
                                    const startTime = getTimeWithDefault(blockConfig.startTime, '07:00');
                                    const endTime = getTimeWithDefault(blockConfig.endTime, '22:00');
                                    const startMin = timeToMinutes(startTime);
                                    const endMin = timeToMinutes(endTime);
                                    const duration = Math.max(0, endMin - startMin);
                                    const hours = Math.floor(duration / 60);
                                    const minutes = duration % 60;
                                    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
                                  })()}
                                </Typography>
                              </Box>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'rgba(0,0,0,0.6)',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  display: 'block',
                                  mt: 0.5
                                }}
                              >
                                Total Duration
                              </Typography>
                            </Paper>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Add New Block Button - Modern Design */}
                {schedule.blockConfigurations.length < 10 && (
                  <Card
                    onClick={() => {
                      const newConfigs = [...schedule.blockConfigurations];
                      newConfigs.push({
                        blockNumber: newConfigs.length + 1,
                        startTime: '07:00',
                        endTime: newConfigs[0]?.endTime || '22:00' // Default to Block 1's end time
                      });
                      setSchedule(prev => ({
                        ...prev,
                        blockConfigurations: newConfigs,
                        updatedAt: new Date().toISOString()
                      }));
                      autoSave(); // Immediate save when new block is added
                    }}
                    elevation={2}
                    sx={{
                      borderRadius: '24px',
                      minHeight: '168px',
                      border: '3px dashed rgba(0, 75, 128, 0.3)',
                      backgroundColor: 'rgba(0, 75, 128, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 75, 128, 0.08)',
                        borderColor: 'rgba(0, 75, 128, 0.5)',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 15px 40px rgba(0, 75, 128, 0.15)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(45deg, rgba(0, 75, 128, 0.05), rgba(0, 75, 128, 0.02))',
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                      },
                      '&:hover::before': {
                        opacity: 1
                      }
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 4 }}>
                      <Box 
                        sx={{ 
                          width: 80, 
                          height: 80, 
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 75, 128, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mx: 'auto',
                          mb: 3,
                          border: '2px dashed rgba(0, 75, 128, 0.3)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 75, 128, 0.15)',
                            borderColor: 'rgba(0, 75, 128, 0.5)',
                            transform: 'scale(1.1)'
                          }
                        }}
                      >
                        <BusIcon sx={{ fontSize: 36, color: 'rgb(0, 75, 128)' }} />
                      </Box>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          color: 'rgb(0, 75, 128)', 
                          fontWeight: 700, 
                          mb: 1,
                          letterSpacing: '0.5px'
                        }}
                      >
                        Add New Bus Block
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: 'rgba(0, 75, 128, 0.7)', 
                          fontWeight: 500,
                          fontSize: '0.95rem'
                        }}
                      >
                        Click to add Bus Block #{schedule.blockConfigurations.length + 1}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'rgba(0, 75, 128, 0.5)', 
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          display: 'block',
                          mt: 2
                        }}
                      >
                        {10 - schedule.blockConfigurations.length} slots remaining
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>

              {/* Generate Schedule Button */}
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={generateTrips}
                  startIcon={<CalendarIcon />}
                  sx={{
                    fontSize: '1.2rem',
                    py: 2.5,
                    px: 5,
                    borderRadius: 3,
                    backgroundColor: 'rgb(0, 75, 128)',
                    boxShadow: '0 4px 12px rgba(0, 75, 128, 0.3)',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: 'rgb(20, 85, 138)',
                      boxShadow: '0 6px 16px rgba(0, 75, 128, 0.4)'
                    }
                  }}
                >
                  Generate Schedule with Block-Based Cycling
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
      {/* End of Configuration Content */}
      {/* Save Notification Snackbar */}
      <Snackbar
        open={saveNotification.open}
        autoHideDuration={4000}
        onClose={() => setSaveNotification({ ...saveNotification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSaveNotification({ ...saveNotification, open: false })}
          severity={saveNotification.severity}
          sx={{ width: '100%' }}
        >
          {saveNotification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
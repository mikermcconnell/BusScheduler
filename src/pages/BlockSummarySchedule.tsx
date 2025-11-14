import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ArrowForwardIcon,
  Fullscreen as FullscreenIcon,
  Publish as PublishIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
  SwapHoriz as ConnectionsIcon,
  FileDownload as ExportIcon,
  Autorenew as RebuildIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { calculateTripTime as calculateTripDurationMinutes, calculateTripRecoveryTime, calculateTravelTime } from '../domain/schedule/calculations';
import { scheduleStorage } from '../services/scheduleStorage';
import { SummarySchedule } from '../types/schedule';
import { draftService } from '../services/draftService';
import { exportService } from '../services/exportService';
import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs';
import { SaveToDraft, AutoSaveStatus } from '../components/SaveToDraft';
import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import { reassignBlocksIfNeeded, normalizeSummaryScheduleTrips } from '../utils/blockAssignment';
import quickAdjustStorage from '../services/quickAdjustStorage';
import rebuildQuickAdjustSchedule from '../services/quickAdjustRebuild';

// TODO(human): Add comprehensive component documentation here

// Service Band Types based on travel time data from TimePoints analysis
export type ServiceBand =
  | 'Fastest Service'
  | 'Fast Service'
  | 'Standard Service'
  | 'Slow Service'
  | 'Slowest Service'
  | 'Legacy Import'
  | string;

interface TimePoint {
  id: string;
  name: string;
  sequence: number;
  aliasFor?: string;
}

interface ServiceBandInfo {
  name: ServiceBand;
  color: string;
  totalMinutes?: number;
}

interface Trip {
  tripNumber: number;
  blockNumber: number;
  departureTime: string;
  serviceBand: ServiceBand;
  arrivalTimes: { [timePointId: string]: string };
  departureTimes: { [timePointId: string]: string };
  recoveryTimes: { [timePointId: string]: number };
  serviceBandInfo?: ServiceBandInfo;
  recoveryMinutes: number;
  tripEndIndex?: number; // Index of the timepoint where trip ends (all subsequent points are inactive)
  originalArrivalTimes?: { [timePointId: string]: string }; // Preserved original times for restoration
  originalDepartureTimes?: { [timePointId: string]: string }; // Preserved original times for restoration
  originalRecoveryTimes?: { [timePointId: string]: number }; // Preserved original recovery times for restoration
  hiddenTailRecoveryTimes?: { [timePointId: string]: number }; // Stored tail recovery for reinstatement
}

interface Schedule {
  id: string;
  name: string;
  routeId?: string;
  routeName?: string;
  direction?: string;
  dayType?: string;
  timePoints: TimePoint[];
  serviceBands: ServiceBandInfo[];
  trips: Trip[];
  createdAt?: string;
  updatedAt: string;
  tripDetails?: {
    weekday?: Trip[];
    saturday?: Trip[];
    sunday?: Trip[];
  };
  blockConfigurations?: BlockConfiguration[];
  cycleTimeMinutes?: number;
  // TimePoints data for service band mapping
  timePointData?: TimePointData[];
  // Service band mapping by time period
  timePeriodServiceBands?: { [timePeriod: string]: string };
}

// TimePoint data structure from TimePoints analysis
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

interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

type RecoveryViewMode = 'base' | 'fullscreen';

interface EditingRecoveryState {
  tripId: string;
  tripNumber: number;
  timePointId: string;
  viewMode: RecoveryViewMode;
}

const timeStringToMinutes = (timeString: string): number => {
  if (!timeString || timeString.trim() === '' || timeString.includes('NaN')) {
    console.warn(`Invalid time string provided: "${timeString}"`);
    return NaN;
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    console.warn(`Could not parse time string: "${timeString}"`);
    return NaN;
  }
  return hours * 60 + minutes;
};

const deriveTripStartTime = (trip: Trip, timePoints: TimePoint[]): string | undefined => {
  if (!trip || !Array.isArray(timePoints) || timePoints.length === 0) {
    return trip?.departureTime;
  }

  const orderedTimePoints = [...timePoints].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  for (const tp of orderedTimePoints) {
    const departure = trip.departureTimes?.[tp.id];
    if (departure) return departure;
    const arrival = trip.arrivalTimes?.[tp.id];
    if (arrival) return arrival;
  }

  const departureCandidates = Object.values(trip.departureTimes || {}).filter(Boolean);
  if (departureCandidates.length > 0) {
    return departureCandidates.reduce((earliest, candidate) => {
      return timeStringToMinutes(candidate) < timeStringToMinutes(earliest) ? candidate : earliest;
    }, departureCandidates[0]);
  }

  return trip.departureTime;
};

const syncTripStartTime = (trip: Trip, timePoints: TimePoint[] | undefined): Trip => {
  const effectiveTimePoints = Array.isArray(timePoints) ? timePoints : [];
  const derived = deriveTripStartTime(trip, effectiveTimePoints);
  if (!derived || derived === trip.departureTime) {
    return trip;
  }
  return {
    ...trip,
    departureTime: derived
  };
};

const syncTripCollection = (trips: Trip[], timePoints: TimePoint[] | undefined): Trip[] => {
  if (!Array.isArray(trips) || trips.length === 0) {
    return trips;
  }
  return trips.map(trip => syncTripStartTime(trip, timePoints));
};

const sortTripsChronologically = (trips: Trip[]): Trip[] => {
  return [...trips].sort((a, b) => {
    const aMinutes = timeStringToMinutes(a.departureTime);
    const bMinutes = timeStringToMinutes(b.departureTime);

    if (!isNaN(aMinutes) && !isNaN(bMinutes) && aMinutes !== bMinutes) {
      return aMinutes - bMinutes;
    }

    const timeCompare = (a.departureTime || '').localeCompare(b.departureTime || '');
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return a.blockNumber - b.blockNumber;
  });
};

const sumRecoveryTimeValues = (recoveryTimes: { [timePointId: string]: number } | undefined): number => {
  if (!recoveryTimes) return 0;
  return Object.values(recoveryTimes).reduce((total, value) => total + (value || 0), 0);
};

const areRecoveryMapsEqual = (
  a: { [timePointId: string]: number } | undefined,
  b: { [timePointId: string]: number } | undefined
): boolean => {
  const keys = new Set([
    ...Object.keys(a || {}),
    ...Object.keys(b || {})
  ]);

  for (const key of Array.from(keys)) {
    const aVal = a?.[key] ?? 0;
    const bVal = b?.[key] ?? 0;
    if (aVal !== bVal) {
      return false;
    }
  }

  return true;
};

const zeroOutRecoveryTimes = (
  ...maps: Array<{ [timePointId: string]: number } | undefined>
): { [timePointId: string]: number } => {
  const zeroed: { [timePointId: string]: number } = {};
  maps.forEach(map => {
    Object.keys(map || {}).forEach(key => {
      zeroed[key] = 0;
    });
  });
  return zeroed;
};

const enforceTailRecoveryRules = (trips: Trip[]): Trip[] => {
  if (!Array.isArray(trips) || trips.length === 0) {
    return trips;
  }

  const blocks = new Map<number, Trip[]>();
  trips.forEach(trip => {
    if (!blocks.has(trip.blockNumber)) {
      blocks.set(trip.blockNumber, []);
    }
    blocks.get(trip.blockNumber)!.push(trip);
  });

  const tripIndexMap = new Map<number, number>();
  trips.forEach((trip, idx) => {
    tripIndexMap.set(trip.tripNumber, idx);
  });

  let didMutate = false;
  const updatedTrips = trips.map(trip => ({
    ...trip,
    recoveryTimes: { ...trip.recoveryTimes }
  }));

  blocks.forEach(blockTrips => {
    const sortedBlockTrips = sortTripsChronologically(blockTrips);

    sortedBlockTrips.forEach((trip, index) => {
      const globalIndex = tripIndexMap.get(trip.tripNumber);
      if (globalIndex === undefined) {
        return;
      }

      const targetTrip = updatedTrips[globalIndex];

      if (index === sortedBlockTrips.length - 1) {
        const preservedRecovery = trip.hiddenTailRecoveryTimes || trip.recoveryTimes;

        if (preservedRecovery && !areRecoveryMapsEqual(targetTrip.hiddenTailRecoveryTimes, preservedRecovery)) {
          targetTrip.hiddenTailRecoveryTimes = { ...preservedRecovery };
          didMutate = true;
        } else if (!preservedRecovery && targetTrip.hiddenTailRecoveryTimes) {
          targetTrip.hiddenTailRecoveryTimes = undefined;
          didMutate = true;
        }

        const zeroedRecovery = zeroOutRecoveryTimes(targetTrip.recoveryTimes, targetTrip.hiddenTailRecoveryTimes);
        if (!areRecoveryMapsEqual(targetTrip.recoveryTimes, zeroedRecovery)) {
          targetTrip.recoveryTimes = zeroedRecovery;
          didMutate = true;
        }

        if (targetTrip.recoveryMinutes !== 0) {
          targetTrip.recoveryMinutes = 0;
          didMutate = true;
        }
      } else if (targetTrip.hiddenTailRecoveryTimes) {
        const restoredRecovery = { ...targetTrip.hiddenTailRecoveryTimes };

        if (!areRecoveryMapsEqual(targetTrip.recoveryTimes, restoredRecovery)) {
          targetTrip.recoveryTimes = restoredRecovery;
          didMutate = true;
        }

        const restoredMinutes = sumRecoveryTimeValues(restoredRecovery);
        if (targetTrip.recoveryMinutes !== restoredMinutes) {
          targetTrip.recoveryMinutes = restoredMinutes;
          didMutate = true;
        }

        delete targetTrip.hiddenTailRecoveryTimes;
        didMutate = true;
      }
    });
  });

  return didMutate ? updatedTrips : trips;
};

const applyTailRecoveryPolicy = (scheduleToAdjust: Schedule): Schedule => {
  if (!scheduleToAdjust) {
    return scheduleToAdjust;
  }

  const enforcedTrips = enforceTailRecoveryRules(scheduleToAdjust.trips);
  if (enforcedTrips === scheduleToAdjust.trips) {
    return scheduleToAdjust;
  }

  return {
    ...scheduleToAdjust,
    trips: enforcedTrips
  };
};

/**
 * Determines service band based on trip departure time using TimePoints analysis data
 */
const getServiceBand = (
  timeString: string, 
  timePointData: TimePointData[] = [], 
  deletedPeriods: Set<string> = new Set()
): ServiceBand => {
  if (timePointData.length === 0) {
    // Fallback to time-based logic if no TimePoints data available
    const [hours] = timeString.split(':').map(Number);
    if (hours >= 6 && hours < 9) return 'Fastest Service';
    if (hours >= 9 && hours < 12) return 'Fast Service';
    if (hours >= 12 && hours < 15) return 'Standard Service';
    if (hours >= 15 && hours < 18) return 'Slow Service';
    return 'Slowest Service';
  }

  // Find the time period that contains this trip time
  const [tripHours, tripMinutes] = timeString.split(':').map(Number);
  const tripTotalMinutes = tripHours * 60 + tripMinutes;
  
  // Find matching time period from TimePoints data
  let matchingPeriod: string | null = null;
  
  for (const data of timePointData) {
    const timePeriod = data.timePeriod;
    const [startTime, endTime] = timePeriod.split(' - ');
    const [startHours, startMins] = startTime.split(':').map(Number);
    const [endHours, endMins] = endTime.split(':').map(Number);
    
    const startMinutes = startHours * 60 + startMins;
    const endMinutes = endHours * 60 + endMins;
    
    if (tripTotalMinutes >= startMinutes && tripTotalMinutes < endMinutes) {
      matchingPeriod = timePeriod;
      break;
    }
  }
  
  if (!matchingPeriod) {
    return 'Standard Service'; // Default fallback
  }
  
  // Calculate service bands based on travel time percentiles (same logic as TimePoints page)
  const timePeriodsMap = new Map<string, number>();
  timePointData.forEach(row => {
    if (deletedPeriods.has(row.timePeriod)) return;
    const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
    timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);
  });

  const sortedPeriods = Array.from(timePeriodsMap.entries())
    .map(([timePeriod, totalTravelTime]) => ({
      timePeriod,
      totalTravelTime: Math.round(totalTravelTime)
    }))
    .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

  const travelTimes = sortedPeriods.map(p => p.totalTravelTime);
  
  // Get the travel time for the matching period
  const periodTravelTime = timePeriodsMap.get(matchingPeriod) || 0;
  
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

  // Determine band based on percentile thresholds
  if (periodTravelTime < percentileThresholds[0]) return 'Fastest Service';
  if (periodTravelTime < percentileThresholds[1]) return 'Fast Service';
  if (periodTravelTime < percentileThresholds[2]) return 'Standard Service';
  if (periodTravelTime < percentileThresholds[3]) return 'Slow Service';
  return 'Slowest Service';
};

/**
 * Gets color for service band (matching TimePoints page colors)
 */
const getServiceBandColor = (serviceBand: ServiceBand): string => {
  switch (serviceBand) {
    case 'Fastest Service': return '#2e7d32';  // Green
    case 'Fast Service': return '#388e3c';     // Light Green
    case 'Standard Service': return '#f9a825'; // Amber
    case 'Slow Service': return '#f57c00';     // Orange  
    case 'Slowest Service': return '#d32f2f';  // Red
    default: return '#9b9b9b';
  }
};

const BlockSummarySchedule: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildDialogOpen, setRebuildDialogOpen] = useState(false);
  const [rebuildFeedback, setRebuildFeedback] = useState<{
    open: boolean;
    severity: 'success' | 'error';
    message: string;
  }>({ open: false, severity: 'success', message: '' });
  const generatedScheduleKeyRef = useRef<string | null>(null);
  const quickAdjustSummaryRef = useRef<SummarySchedule | null>(null);

  // Workflow draft management
  const locationDraftId = location.state?.draftId;
  const {
    draft,
    updateSummarySchedule,
    loading: draftLoading,
    error: draftError
  } = useWorkflowDraft(locationDraftId);
  const isQuickAdjustMode = Boolean(
    location.state?.fromQuickAdjust ||
    draft?.workflowMode === 'quick-adjust' ||
    draft?.metadata?.isQuickAdjust ||
    quickAdjustSummaryRef.current
  );

  // Recovery time editing state
  const [editingRecovery, setEditingRecovery] = useState<EditingRecoveryState | null>(null);
  const [tempRecoveryValue, setTempRecoveryValue] = useState<string>('');
  
  // Trip end functionality state
  const [tripEndDialog, setTripEndDialog] = useState<{
    open: boolean;
    tripNumber: number;
    timePointId: string;
    timePointIndex: number;
  } | null>(null);

  // Trip restoration functionality state
  const [tripRestoreDialog, setTripRestoreDialog] = useState<{
    open: boolean;
    tripNumber: number;
    timePointId: string;
    timePointIndex: number;
  } | null>(null);
  const [deleteTripDialog, setDeleteTripDialog] = useState<{
    open: boolean;
    tripNumber: number;
    blockNumber: number;
    departureTime?: string;
  } | null>(null);

  // Add trip functionality state
  const [addTripDialog, setAddTripDialog] = useState<{
    open: boolean;
    blockNumber?: number;
    startTime?: string;
    isEarlyTrip?: boolean;  // Flag for early trip (before first existing trip)
    isMidRouteTrip?: boolean; // Flag for trip inserted between existing trips
    afterTripNumber?: number; // The trip number this new trip should come after
    beforeTripNumber?: number; // The trip number this new trip should come before
  } | null>(null);
  const [newTripBlockNumber, setNewTripBlockNumber] = useState<string>('');
  const [newTripStartTime, setNewTripStartTime] = useState<string>('');
  const [newTripEndTime, setNewTripEndTime] = useState<string>(''); // For mid-route trips
  
  // Service band editing state
  const [serviceBandDialog, setServiceBandDialog] = useState<{
    open: boolean;
    tripNumber: number;
    currentBand: ServiceBand;
  } | null>(null);
  
  // Recovery time templates state
  interface RecoveryTemplate {
    [serviceBandName: string]: number[];
  }
  
  const [recoveryTemplates, setRecoveryTemplates] = useState<RecoveryTemplate>(() => {
    // Initialize with default templates
    const defaultTemplates: RecoveryTemplate = {
      'Fastest Service': [0, 1, 1, 2, 3],
      'Fast Service': [0, 1, 2, 2, 4],
      'Standard Service': [0, 2, 2, 3, 5],
      'Slow Service': [0, 2, 3, 3, 6],
      'Slowest Service': [0, 3, 3, 4, 7]
    };
    
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem('recoveryTemplates');
      return stored ? JSON.parse(stored) : defaultTemplates;
    } catch {
      return defaultTemplates;
    }
  });

  // Target recovery percentage state
  const [targetRecoveryPercentage, setTargetRecoveryPercentage] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('targetRecoveryPercentage');
      return stored ? parseFloat(stored) : 15; // Default to 15%
    } catch {
      return 15;
    }
  });

  // Mark summary step as completed when schedule is loaded
  React.useEffect(() => {
    const markSummaryStepComplete = async () => {
      const draftId = location.state?.draftId || draftService.getCurrentSessionDraftId();
      
      if (draftId && schedule && schedule.trips && schedule.trips.length > 0) {
        try {
          await draftService.updateStepStatus(draftId, 'summary', 'completed', 100, {
            scheduleGenerated: true,
            tripCount: schedule.trips.length,
            timePointCount: schedule.timePoints.length,
            serviceBands: schedule.serviceBands?.map(sb => ({
              name: sb.name,
              color: sb.color,
              count: schedule.trips.filter(t => t.serviceBand === sb.name).length
            })) || [],
            summarySchedule: {
              id: schedule.id,
              name: schedule.name,
              timePoints: schedule.timePoints,
              trips: schedule.trips.length, // Don't store full trips, just count
              serviceBands: schedule.serviceBands,
              updatedAt: schedule.updatedAt
            }
          });
          console.log('✅ Summary step marked as completed in workflow');
        } catch (error) {
          console.warn('Failed to mark summary step as completed:', error);
        }
      }
    };

    // Only run once when component mounts with a valid schedule
    markSummaryStepComplete();
  }, []); // Empty dependency array - only run on mount

  // Master recovery times state for "Apply to All Templates" functionality
  const [masterRecoveryTimes, setMasterRecoveryTimes] = useState<number[]>([0, 1, 1, 2, 3]);

  // Helper function to add minutes to time string (needed for schedule generation)
  const addMinutesToTime = (timeString: string, minutes: number): string => {
    const [hours, mins] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  // Compute a trip's operating window in minutes, rolling across midnight if needed


  // Helper function to determine time period from departure time
  const getTimePeriodForTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // Find the 30-minute period this time falls into
    const periodStart = Math.floor(totalMinutes / 30) * 30;
    const periodEnd = periodStart + 29;
    
    const startHours = Math.floor(periodStart / 60);
    const startMins = periodStart % 60;
    const endHours = Math.floor(periodEnd / 60);
    const endMins = periodEnd % 60;
    
    return `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')} - ${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  // Helper function to determine service band name based on departure time
  const determineServiceBandForTime = (
    departureTime: string,
    timePeriodServiceBands?: { [timePeriod: string]: string }
  ): ServiceBand => {
    const timePeriod = getTimePeriodForTime(departureTime);
    
    // First try to use the timePeriodServiceBands mapping if available
    if (timePeriodServiceBands && timePeriodServiceBands[timePeriod]) {
      return timePeriodServiceBands[timePeriod] as ServiceBand;
    }
    
    // Fallback logic based on time of day
    const [hours] = departureTime.split(':').map(Number);
    
    if (hours >= 6 && hours < 9) return 'Fast Service';
    if (hours >= 9 && hours < 15) return 'Fastest Service';
    if (hours >= 15 && hours < 18) return 'Slow Service';
    if (hours >= 18 && hours < 22) return 'Standard Service';
    return 'Slowest Service';
  };

  // Mark the summary step as completed when the component loads
  useEffect(() => {
    draftService.completeStep('summary', {
      scheduleGenerated: true,
      timestamp: new Date().toISOString()
    });
  }, []);

  // State restoration when coming from draft
  useEffect(() => {
    // Check if we're restoring from a draft
    if (location.state?.fromDraft && location.state?.draftId) {
      console.log('📋 Restoring BlockSummarySchedule state from draft:', location.state.draftId);
      
      // Restore summary schedule
      if (location.state.summarySchedule) {
        console.log('✅ Restoring summary schedule');
        const restoredSchedule = location.state.summarySchedule;
        
        setSchedule(prev => applyTailRecoveryPolicy({
          ...prev,
          ...restoredSchedule,
          trips: restoredSchedule.trips || prev.trips,
          timePoints: restoredSchedule.timePoints || prev.timePoints,
          serviceBands: restoredSchedule.serviceBands || prev.serviceBands
        }));
      }
      
      // Restore trips array if available separately
      if (location.state.trips && Array.isArray(location.state.trips)) {
        console.log('✅ Restoring trips:', location.state.trips.length);
        setSchedule(prev => applyTailRecoveryPolicy({
          ...prev,
          trips: location.state.trips
        }));
      }
      
      // Restore recovery times if they were modified
      if (location.state.masterRecoveryTimes && Array.isArray(location.state.masterRecoveryTimes)) {
        console.log('✅ Restoring master recovery times');
        setMasterRecoveryTimes(location.state.masterRecoveryTimes);
      }
      
      console.log('📋 BlockSummarySchedule state restoration complete');
    }
  }, [location.state?.fromDraft, location.state?.draftId]);

  // Generate schedule from block configuration if coming from Block Configuration page
  useEffect(() => {
    const blockConfigurations = location.state?.bus_block_configurations;
    if (!Array.isArray(blockConfigurations) || blockConfigurations.length === 0) {
      return;
    }

    // Build a stable hash so we only regenerate when the payload truly changes
    let generationKey: string | null = null;
    try {
      generationKey = JSON.stringify({
        draftId: location.state?.draftId ?? null,
        blockConfigurations,
        timePointData: location.state?.timePointData ?? [],
        serviceBands: location.state?.serviceBands ?? [],
        timePeriodServiceBands: location.state?.timePeriodServiceBands ?? {}
      });
    } catch (error) {
      console.warn('Unable to create schedule generation key, falling back to timestamp:', error);
      generationKey = `fallback-${Date.now()}`;
    }

    if (generatedScheduleKeyRef.current === generationKey) {
      return;
    }

    console.log('📋 Generating schedule from block configurations:', blockConfigurations);

    const timePointData = location.state?.timePointData || [];
    const serviceBands = location.state?.serviceBands || [];
    const timePeriodServiceBands = location.state?.timePeriodServiceBands || {};

    const generatedTrips: Trip[] = [];
    let tripNumber = 1;

    blockConfigurations.forEach((block: any) => {
      const blockNumber = block.blockNumber;
      const startTime = block.startTime;
      const cycleTime = block.cycleTime || 60; // Default 60 minutes if not specified

      let currentTime = startTime;
      const endTime = '22:00'; // Default end time

      while (currentTime < endTime) {
        const serviceBand = determineServiceBandForTime(currentTime, timePeriodServiceBands);

        const trip: Trip = {
          tripNumber,
          blockNumber: block.blockNumber,
          departureTime: currentTime,
          serviceBand,
          arrivalTimes: {},
          departureTimes: {},
          recoveryTimes: {},
          recoveryMinutes: 0
        };

        if (timePointData.length > 0) {
          let accumulatedTime = 0;
          timePointData.forEach((tp: any, index: number) => {
            const timePointId = tp.fromTimePoint || tp.id || `tp_${index}`;
            const arrivalTime = addMinutesToTime(currentTime, accumulatedTime);
            const recoveryTime = index === 0 ? 0 : index === timePointData.length - 1 ? 5 : 2;

            trip.arrivalTimes[timePointId] = arrivalTime;
            trip.departureTimes[timePointId] = addMinutesToTime(arrivalTime, recoveryTime);
            trip.recoveryTimes[timePointId] = recoveryTime;
            trip.recoveryMinutes += recoveryTime;

            accumulatedTime += 10 + recoveryTime; // Simplified travel time plus recovery
          });
        }

        generatedTrips.push(trip);
        tripNumber++;

        currentTime = addMinutesToTime(currentTime, cycleTime);
      }
    });

    const generatedSchedule: Schedule = {
      id: `schedule_${Date.now()}`,
      name: 'Generated Schedule',
      timePoints: timePointData.map((tp: any) => ({
        id: tp.fromTimePoint,
        name: tp.fromTimePoint,
        isTimingPoint: true
      })),
      serviceBands: serviceBands,
      trips: generatedTrips,
      updatedAt: new Date().toISOString(),
      blockConfigurations,
      timePointData: timePointData,
      timePeriodServiceBands: timePeriodServiceBands
    };

    generatedScheduleKeyRef.current = generationKey;

    setSchedule(applyTailRecoveryPolicy(generatedSchedule));

    try {
      localStorage.setItem('currentSummarySchedule', JSON.stringify(generatedSchedule));
    } catch (error) {
      console.warn('Could not save generated schedule to localStorage:', error);
    }
  }, [location.state]);


  // Load schedule data from multiple sources with fallback logic
  const [schedule, setSchedule] = useState<Schedule>(() => {
    // First try location.state (direct navigation)
    if (location.state?.schedule) {
      console.log('📋 Loading schedule from navigation state');
      return location.state.schedule;
    }
    
    // Second try localStorage (persistence across page refreshes)
    try {
      const storedSchedule = localStorage.getItem('currentSummarySchedule');
      if (storedSchedule) {
        console.log('📋 Loading schedule from localStorage');
        return JSON.parse(storedSchedule);
      }
    } catch (error) {
      console.warn('Error loading schedule from localStorage:', error);
    }
    
    // Third try most recent saved schedule
    try {
      const savedSchedules = scheduleStorage.getAllSchedules();
      const mostRecentSchedule = savedSchedules
        .filter(s => s.summarySchedule)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      
      if (mostRecentSchedule?.summarySchedule) {
        console.log('📋 Loading most recent saved schedule');
        // Convert saved schedule format to component format
        return {
          id: mostRecentSchedule.id,
          name: mostRecentSchedule.routeName,
          timePoints: mostRecentSchedule.summarySchedule.timePoints,
          serviceBands: [],
          trips: mostRecentSchedule.summarySchedule.weekday || [],
          updatedAt: mostRecentSchedule.updatedAt,
          timePointData: (mostRecentSchedule as any).timePointData || []
        };
      }
    } catch (error) {
      console.warn('Error loading saved schedules:', error);
    }
    
    // Final fallback - empty schedule
    console.log('📋 No schedule data found, using empty schedule');
    return {
      id: '',
      name: 'Generated Schedule',
      timePoints: [],
      serviceBands: [],
      trips: [],
      updatedAt: new Date().toISOString(),
      timePointData: []
    };
  });

  useEffect(() => {
    setSchedule(prev => applyTailRecoveryPolicy(prev));
  }, []);

  const getTripMetrics = useCallback((trip: Trip, timePointsParam?: TimePoint[]) => {
    const referencePoints = (timePointsParam && timePointsParam.length > 0)
      ? timePointsParam
      : schedule.timePoints || [];

    if (!trip || referencePoints.length === 0) {
      return {
        tripMinutes: 0,
        recoveryMinutes: 0,
        travelMinutes: 0,
        recoveryPercent: 0
      };
    }

    const rawTripMinutes = calculateTripDurationMinutes(trip, referencePoints);
    const tripMinutes = Number.isFinite(rawTripMinutes) ? Math.max(0, Math.round(rawTripMinutes)) : 0;

    const rawRecoveryMinutes = calculateTripRecoveryTime(trip, referencePoints);
    const recoveryMinutes = Number.isFinite(rawRecoveryMinutes) ? Math.max(0, Math.round(rawRecoveryMinutes)) : 0;

    const rawTravelMinutes = calculateTravelTime(tripMinutes, recoveryMinutes);
    const travelMinutes = Number.isFinite(rawTravelMinutes) ? Math.max(0, Math.round(rawTravelMinutes)) : 0;

    const recoveryPercent = travelMinutes > 0 ? (recoveryMinutes / travelMinutes) * 100 : 0;

    return {
      tripMinutes,
      recoveryMinutes,
      travelMinutes,
      recoveryPercent
    };
  }, [schedule.timePoints]);

  useEffect(() => {
    if (location.state?.fromQuickAdjust && location.state?.summarySchedule) {
      const summary: SummarySchedule = location.state.summarySchedule;
      quickAdjustSummaryRef.current = summary;

      const weekdayTrips = (location.state.trips as Trip[]) || [];
      const quickName = summary.routeName || location.state.draftName || 'Quick Adjust Schedule';

      setSchedule(applyTailRecoveryPolicy({
        id: summary.routeId,
        name: quickName,
        routeId: summary.routeId,
        routeName: quickName,
        direction: summary.direction || 'Outbound',
        dayType: 'weekday',
        timePoints: summary.timePoints,
        serviceBands: [],
        trips: weekdayTrips,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
  }, [location.state?.fromQuickAdjust, location.state?.summarySchedule, location.state?.draftName, location.state?.trips]);

  useEffect(() => {
    if (!isQuickAdjustMode) {
      return;
    }

    const draftId = locationDraftId || draft?.draftId;
    const rawRows = location.state?.rawCsvRows as string[][] | undefined;
    if (!draftId || !Array.isArray(rawRows) || rawRows.length === 0) {
      return;
    }

    if (quickAdjustStorage.load(draftId)) {
      return;
    }

    quickAdjustStorage.save(draftId, {
      rows: rawRows,
      fileName: location.state?.draftName || draft?.originalData?.fileName,
      savedAt: new Date().toISOString()
    });
  }, [draft?.draftId, draft?.originalData?.fileName, isQuickAdjustMode, location.state?.draftName, location.state?.rawCsvRows, locationDraftId]);

  useEffect(() => {
    if (!isQuickAdjustMode) {
      return;
    }
    if (!schedule.trips || schedule.trips.length === 0) {
      return;
    }
    if (!schedule.timePoints || schedule.timePoints.length === 0) {
      return;
    }

    const reassignedTrips = reassignBlocksIfNeeded(schedule.trips, schedule.timePoints);
    if (!reassignedTrips || reassignedTrips === schedule.trips) {
      return;
    }

    setSchedule(prevSchedule => {
      const quickSummary = quickAdjustSummaryRef.current;
      const baseMatrix = (trips: Trip[], timePoints: TimePoint[]): string[][] =>
        trips.map(trip =>
          timePoints.map(tp => trip.departureTimes?.[tp.id] || trip.arrivalTimes?.[tp.id] || '')
        );

      const summaryForNormalization: SummarySchedule = quickSummary
        ? {
            ...quickSummary,
            tripDetails: {
              ...(quickSummary.tripDetails || {}),
              weekday: reassignedTrips
            }
          }
        : {
            routeId: prevSchedule.routeId || prevSchedule.id || `schedule-${Date.now()}`,
            routeName: prevSchedule.routeName || prevSchedule.name || 'Generated Schedule',
            direction: prevSchedule.direction || 'Outbound',
            timePoints: prevSchedule.timePoints,
            weekday: baseMatrix(reassignedTrips, prevSchedule.timePoints),
            saturday: [],
            sunday: [],
            effectiveDate: new Date(),
            metadata: {
              weekdayTrips: reassignedTrips.length,
              saturdayTrips: 0,
              sundayTrips: 0
            },
            tripDetails: {
              weekday: reassignedTrips
            }
          };

      const normalized = normalizeSummaryScheduleTrips(summaryForNormalization);
      quickAdjustSummaryRef.current = normalized.summary;

      const timePointsForSync = (prevSchedule.timePoints && prevSchedule.timePoints.length > 0)
        ? prevSchedule.timePoints
        : normalized.summary.timePoints || [];

      const normalizedTrips = sortTripsChronologically(
        syncTripCollection(normalized.tripsByDay.weekday || [], timePointsForSync)
      );

      const updatedSchedule = {
        ...prevSchedule,
        trips: normalizedTrips,
        tripDetails: normalized.summary.tripDetails
      };

      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
      } catch (error) {
        console.warn('Failed to persist normalized block numbers:', error);
      }

      return applyTailRecoveryPolicy(updatedSchedule);
    });
  }, [isQuickAdjustMode, schedule.trips, schedule.timePoints]);

  // Save schedule data to workflow draft whenever it changes
  // SAFETY: Already has cleanup with isMounted flag
  useEffect(() => {
    let isMounted = true;

    const saveScheduleData = async () => {
      if (!isMounted) return; // Check if still mounted

      if (!schedule || !schedule.trips || schedule.trips.length === 0 || !updateSummarySchedule) {
        return;
      }

      if (!isMounted) return; // Check again before state updates

      setIsSaving(true);
      setSaveError(null);

      try {
        // Convert trips to schedule matrix format for weekday
        const weekdayMatrix: string[][] = schedule.trips.map(trip =>
          schedule.timePoints.map(tp => {
            // Use departure time if available, otherwise arrival time
            return trip.departureTimes?.[tp.id] || trip.arrivalTimes?.[tp.id] || '';
          })
        );

        const quickSummary = quickAdjustSummaryRef.current;
        const tripDetailsPayload: SummarySchedule['tripDetails'] = {
          weekday: schedule.trips
        };
        if (quickSummary?.tripDetails?.saturday) {
          tripDetailsPayload.saturday = quickSummary.tripDetails.saturday;
        }
        if (quickSummary?.tripDetails?.sunday) {
          tripDetailsPayload.sunday = quickSummary.tripDetails.sunday;
        }

        const summaryScheduleData = {
          schedule: {
            routeId: quickSummary?.routeId || schedule.id || `route_${Date.now()}`,
            routeName: quickSummary?.routeName || schedule.name || 'Bus Route',
            direction: quickSummary?.direction || 'Outbound',
            timePoints: schedule.timePoints || quickSummary?.timePoints || [],
            weekday: weekdayMatrix,
            saturday: quickSummary?.saturday || [],
            sunday: quickSummary?.sunday || [],
            effectiveDate: quickSummary?.effectiveDate || new Date(),
            metadata: {
              weekdayTrips: schedule.trips?.length || quickSummary?.metadata.weekdayTrips || 0,
              saturdayTrips: quickSummary?.metadata.saturdayTrips || 0,
              sundayTrips: quickSummary?.metadata.sundayTrips || 0,
              operatingHours: quickSummary?.metadata.operatingHours,
              lastModified: new Date().toISOString()
            },
            tripDetails: tripDetailsPayload
          },
          metadata: quickSummary ? {
            generationMethod: 'quick-adjust' as const,
            parameters: {
              mode: 'quick-adjust'
            },
            validationResults: [],
            performanceMetrics: {
              generationTimeMs: 0,
              tripCount: schedule.trips?.length || quickSummary.metadata.weekdayTrips || 0,
              memoryUsageMB: 0
            }
          } : {
            generationMethod: 'block-based' as const,
            parameters: {
              numberOfBuses: Math.max(...(schedule.trips?.map(t => t.blockNumber) || [0])),
              tripCount: schedule.trips?.length || 0
            },
            validationResults: [],
            performanceMetrics: {
              generationTimeMs: 0,
              tripCount: schedule.trips?.length || 0,
              memoryUsageMB: 0
            }
          }
        };

        // Save to workflow draft and await completion
        const result = await updateSummarySchedule(summaryScheduleData);

        if (!result.success) {
          throw new Error(result.error || 'Failed to save schedule data');
        }

        console.log('✅ Successfully saved schedule data to workflow draft');

        if (quickSummary) {
          quickAdjustSummaryRef.current = {
            ...quickSummary,
            timePoints: summaryScheduleData.schedule.timePoints,
            weekday: summaryScheduleData.schedule.weekday,
            saturday: summaryScheduleData.schedule.saturday,
            sunday: summaryScheduleData.schedule.sunday,
            tripDetails: tripDetailsPayload,
            metadata: {
              ...quickSummary.metadata,
              weekdayTrips: summaryScheduleData.schedule.weekday.length,
              saturdayTrips: summaryScheduleData.schedule.metadata.saturdayTrips,
              sundayTrips: summaryScheduleData.schedule.metadata.sundayTrips,
              operatingHours: summaryScheduleData.schedule.metadata.operatingHours
            }
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save schedule data';
        console.error('❌ Failed to save schedule to workflow draft:', errorMessage);

        if (isMounted) {
          setSaveError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsSaving(false);
        }
      }
    };

    saveScheduleData();

    return () => {
      isMounted = false;
    };
  }, [schedule, updateSummarySchedule]);

  // Initialize master recovery times based on schedule timepoints
  useEffect(() => {
    if (schedule.timePoints && schedule.timePoints.length > 0) {
      const defaultTimes: number[] = [];
      for (let i = 0; i < schedule.timePoints.length; i++) {
        if (i === 0) {
          defaultTimes.push(0); // First timepoint (departure) - no recovery
        } else if (i === schedule.timePoints.length - 1) {
          defaultTimes.push(3); // Last timepoint - end-of-route recovery
        } else {
          defaultTimes.push(1); // Middle timepoints - minimal recovery
        }
      }
      setMasterRecoveryTimes(defaultTimes);
    }
  }, [schedule.timePoints]);

  // Process trips to add service bands based on TimePoints data
  useEffect(() => {
    if (schedule?.trips && schedule.trips.length > 0) {
      // Update trips with service bands if not already present
      const updatedTrips = schedule.trips.map(trip => ({
        ...trip,
        serviceBand: trip.serviceBand || getServiceBand(trip.departureTime, schedule.timePointData, new Set())
      }));
      
      // Only update if we actually added service bands
      if (schedule.trips && updatedTrips.some(trip => {
        const existingTrip = schedule.trips.find(t => t.tripNumber === trip.tripNumber);
        return existingTrip && !existingTrip.serviceBand;
      })) {
        // In a real app, we'd update the state/context here
        // For now, we'll handle it in the processing logic below
      }
    }
  }, [schedule?.trips, schedule?.timePointData]);


  // Helper function to convert minutes to time string
  const minutesToTime = (minutes: number): string => {
    if (typeof minutes !== 'number' || isNaN(minutes)) {
      console.warn(`Invalid minutes value provided: ${minutes}`);
      return '00:00';
    }
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Recovery time editing functions
  const handleRecoveryClick = useCallback((tripId: string, timePointId: string, currentValue: number, viewMode: RecoveryViewMode = 'base') => {
    const tripIdentifier = `${tripId}-${timePointId}`;
    const parsedTripNumber = parseInt(tripId, 10);

    setEditingRecovery({
      tripId: tripIdentifier,
      tripNumber: Number.isNaN(parsedTripNumber) ? 0 : parsedTripNumber,
      timePointId,
      viewMode
    });
    setTempRecoveryValue(currentValue.toString());
    
    // Auto-select the value after React renders the input
    setTimeout(() => {
      const selector = `input[data-recovery-edit="true"][data-view-mode="${viewMode}"]`;
      const input = document.querySelector(selector) as HTMLInputElement | null;
      if (input) {
        input.select();
      }
    }, 0);
  }, []);

  const handleRecoveryChange = useCallback((value: string) => {
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setTempRecoveryValue(value);
    }
  }, []);

  const handleRecoverySubmit = useCallback(() => {
    if (!editingRecovery) return;
    
    const newRecoveryTime = parseInt(tempRecoveryValue) || 0;
    const timePointId = editingRecovery.timePointId;
    let tripNumber = editingRecovery.tripNumber;
    if (!tripNumber) {
      const [tripIdStr] = editingRecovery.tripId.split('-');
      tripNumber = parseInt(tripIdStr, 10);
    }
    if (!tripNumber || Number.isNaN(tripNumber)) {
      console.warn('Invalid trip number when submitting recovery edit', editingRecovery);
      return;
    }
    
    // Calculate recovery difference first
    const targetTrip = schedule.trips?.find(t => t.tripNumber === tripNumber);
    const oldRecoveryTime = targetTrip?.recoveryTimes[timePointId] || 0;
    const recoveryDifference = newRecoveryTime - oldRecoveryTime;
    
    // Update the schedule with new recovery time
    setSchedule(prevSchedule => {
      // Track service band updates for logging
      const serviceBandUpdates: Array<{
        tripNumber: number;
        oldServiceBand: string;
        newServiceBand: string;
        oldDepartureTime: string;
        newDepartureTime: string;
      }> = [];
      
      // SAFETY: Add null checks for trips array
      const updatedTrips = (prevSchedule?.trips || []).map(trip => {
        // SAFETY: Ensure trip exists before processing
        if (!trip) {
          console.warn('Encountered null trip in schedule, skipping');
          return trip;
        }

        if (trip.tripNumber === tripNumber) {
          // Update recovery time for this timepoint
          const updatedRecoveryTimes = {
            ...(trip.recoveryTimes || {}),
            [timePointId]: newRecoveryTime
          };

          // Update subsequent trip times within this trip
          const updatedTrip = updateSubsequentTripTimes(trip, timePointId, recoveryDifference, prevSchedule?.timePoints || []);

          return {
            ...updatedTrip,
            recoveryTimes: updatedRecoveryTimes
          };
        }
        return trip;
      }).filter(Boolean); // Remove any null/undefined entries
      
      // Update subsequent trips in the same block for ANY recovery time change
      // because any change affects when the trip ends and thus when the next trip can start
      const finalTimePointId = prevSchedule.timePoints[prevSchedule.timePoints.length - 1]?.id;
      if (recoveryDifference !== 0) {
        // Find the trip that was modified
        const modifiedTrip = updatedTrips.find(t => t.tripNumber === tripNumber);
        if (modifiedTrip) {
          const blockNumber = modifiedTrip.blockNumber;
          
          // Find all trips in the same block and sort them by departure time
          // SAFETY: Add null checks and default values
          const blockTrips = sortTripsChronologically(
            updatedTrips.filter(t => t && t.blockNumber === blockNumber)
          );
          
          // Find the position of the modified trip in the block
          const modifiedTripIndexInBlock = blockTrips.findIndex(t => t.tripNumber === tripNumber);

          // SAFETY: Add iteration limits and timeout to prevent infinite loops
          const MAX_CASCADE_ITERATIONS = 100;
          const CASCADE_TIMEOUT = 5000; // 5 seconds
          let iterations = 0;
          const cascadeStartTime = Date.now();

          // Update all subsequent trips in this block (based on block cycling order)
          for (let i = modifiedTripIndexInBlock + 1; i < blockTrips.length; i++) {
            // Check safety limits to prevent browser freeze
            if (++iterations > MAX_CASCADE_ITERATIONS) {
              console.error(`⚠️ Cascade iteration limit (${MAX_CASCADE_ITERATIONS}) reached - aborting to prevent infinite loop`);
              break;
            }

            if (Date.now() - cascadeStartTime > CASCADE_TIMEOUT) {
              console.error(`⚠️ Cascade timeout (${CASCADE_TIMEOUT}ms) reached - aborting to prevent browser freeze`);
              break;
            }

            const subsequentTrip = blockTrips[i];
            const originalDepartureTime = subsequentTrip.departureTime;
            const originalServiceBand = subsequentTrip.serviceBand;
            
            // Calculate new start time based on simplified logic:
            // Next trip starts when previous trip departs from final stop
            const prevTripInBlock = blockTrips[i - 1];
            
            // Get the updated previous trip from our working array
            const updatedPrevTrip = updatedTrips.find(t => t.tripNumber === prevTripInBlock.tripNumber) || prevTripInBlock;
            
            // Use the updated departure time from the final stop
            const prevTripFinalDeparture = updatedPrevTrip.departureTimes[finalTimePointId] || 
              addMinutesToTime(updatedPrevTrip.arrivalTimes[finalTimePointId], updatedPrevTrip.recoveryTimes[finalTimePointId] || 0);
            const newStartMinutes = timeStringToMinutes(prevTripFinalDeparture);
            const newDepartureTime = minutesToTime(newStartMinutes);
            
            // Re-evaluate service band if departure time changed significantly
            let newServiceBand = originalServiceBand;
            if (newDepartureTime !== originalDepartureTime) {
              const originalTimePeriod = getTimePeriodForTime(originalDepartureTime);
              const newTimePeriod = getTimePeriodForTime(newDepartureTime);
              
              // Only update service band if time period changed
              if (originalTimePeriod !== newTimePeriod) {
                newServiceBand = determineServiceBandForTime(newDepartureTime, prevSchedule.timePeriodServiceBands);
                
                if (newServiceBand !== originalServiceBand) {
                  serviceBandUpdates.push({
                    tripNumber: subsequentTrip.tripNumber,
                    oldServiceBand: originalServiceBand,
                    newServiceBand,
                    oldDepartureTime: originalDepartureTime,
                    newDepartureTime
                  });
                  
                  // TODO: Implement full travel time recalculation when service band changes
                  // For now, we update the service band but keep the existing travel time intervals
                  // Ideally, we would recalculate segment-by-segment travel times using the new service band's data
                  console.log(`⚠️ Service band changed for trip ${subsequentTrip.tripNumber}: ${originalServiceBand} → ${newServiceBand}. Travel times may need manual adjustment.`);
                }
              }
            }
            
            // Calculate the time shift for this trip
            const tripShift = newStartMinutes - timeStringToMinutes(subsequentTrip.departureTime);
            
            // Update all times for this trip
            const updatedDepartureTimes = { ...subsequentTrip.departureTimes };
            const updatedArrivalTimes = { ...subsequentTrip.arrivalTimes };
            
            Object.keys(updatedDepartureTimes).forEach(tpId => {
              if (updatedDepartureTimes[tpId]) {
                updatedDepartureTimes[tpId] = addMinutesToTime(updatedDepartureTimes[tpId], tripShift);
              }
              if (updatedArrivalTimes[tpId]) {
                updatedArrivalTimes[tpId] = addMinutesToTime(updatedArrivalTimes[tpId], tripShift);
              }
            });
            
            // Find and update this trip in the main array
            const tripIndex = updatedTrips.findIndex(t => t.tripNumber === subsequentTrip.tripNumber);
            if (tripIndex !== -1) {
              updatedTrips[tripIndex] = syncTripStartTime({
                ...subsequentTrip,
                departureTime: newDepartureTime,
                serviceBand: newServiceBand,
                departureTimes: updatedDepartureTimes,
                arrivalTimes: updatedArrivalTimes
              }, prevSchedule.timePoints);
              
              console.log(`🔄 Updated trip ${subsequentTrip.tripNumber} in block ${blockNumber}: ${subsequentTrip.departureTime} → ${newDepartureTime} (shift: ${tripShift}min)`);
              
              // Log service band change if it occurred
              if (newServiceBand !== originalServiceBand) {
                console.log(`🎯 Service band updated for trip ${subsequentTrip.tripNumber}: ${originalServiceBand} → ${newServiceBand}`);
              }
            }
          }
        }
      }
      
      // Normalize trip start times prior to resorting so updated per-stop edits are reflected
      const normalizedTrips = syncTripCollection(updatedTrips as Trip[], prevSchedule.timePoints);

      // Force re-sort trips to ensure display order is maintained
      const sortedUpdatedTrips = sortTripsChronologically(normalizedTrips);
      
      const updatedSchedule = {
        ...prevSchedule,
        trips: sortedUpdatedTrips
      };
      
      // Log service band update summary
      if (serviceBandUpdates.length > 0) {
        console.log(`🎯 Service band updates applied to ${serviceBandUpdates.length} trips:`);
        serviceBandUpdates.forEach(update => {
          console.log(`  Trip ${update.tripNumber}: ${update.oldServiceBand} → ${update.newServiceBand} (${update.oldDepartureTime} → ${update.newDepartureTime})`);
        });
      }
      
      // Persist to localStorage for consistency
      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
        console.log('✅ Schedule updated and persisted with cascading changes');
      } catch (error) {
        console.warn('Failed to persist schedule updates:', error);
      }
      
      return applyTailRecoveryPolicy(updatedSchedule);
    });
    
    // Special logic for RVH entrance affecting downstream stops
    if (timePointId === 'rvh-entrance' && newRecoveryTime === 0) {
      handleRVHEntranceZeroRecovery(tripNumber);
    }
    
    setEditingRecovery(null);
    setTempRecoveryValue('');
  }, [editingRecovery, tempRecoveryValue]);

  const handleRecoveryCancel = useCallback(() => {
    setEditingRecovery(null);
    setTempRecoveryValue('');
  }, []);
  
  const handleRecoveryKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRecoverySubmit();
    }
    if (e.key === 'Escape') {
      handleRecoveryCancel();
    }
  }, [handleRecoverySubmit, handleRecoveryCancel]);
  
  const handleTripEnd = useCallback((tripNumber: number, timePointId: string, timePointIndex: number) => {
    setTripEndDialog({
      open: true,
      tripNumber,
      timePointId,
      timePointIndex
    });
  }, []);
  
  const handleTripRestore = useCallback((tripNumber: number, timePointId: string, timePointIndex: number) => {
    setTripRestoreDialog({
      open: true,
      tripNumber,
      timePointId,
      timePointIndex
    });
  }, []);

  const handleDeleteTripPrompt = useCallback((trip: Trip) => {
    if (!trip) {
      return;
    }

    setDeleteTripDialog({
      open: true,
      tripNumber: trip.tripNumber,
      blockNumber: trip.blockNumber,
      departureTime: trip.departureTime
    });
  }, []);

  const handleDeleteTripCancel = useCallback(() => {
    setDeleteTripDialog(null);
  }, []);

  const handleDeleteTripConfirm = useCallback(() => {
    if (!deleteTripDialog) return;

    const { tripNumber } = deleteTripDialog;

    setSchedule(prevSchedule => {
      if (!prevSchedule?.trips) {
        return prevSchedule;
      }

      const remainingTrips = prevSchedule.trips.filter(trip => trip.tripNumber !== tripNumber);
      const normalizedTrips = syncTripCollection(remainingTrips, prevSchedule.timePoints);
      const sorted = sortTripsChronologically(normalizedTrips);

      const renumberedTrips = sorted.map((trip, index) => ({
        ...trip,
        tripNumber: index + 1
      }));

      const updatedSchedule = {
        ...prevSchedule,
        trips: renumberedTrips
      };

      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
        console.log(`Deleted trip ${tripNumber}`);
      } catch (error) {
        console.warn('Failed to persist schedule updates:', error);
      }

      return applyTailRecoveryPolicy(updatedSchedule);
    });

    setEditingRecovery(null);
    setTripEndDialog(prev => (prev?.tripNumber === tripNumber ? null : prev));
    setTripRestoreDialog(prev => (prev?.tripNumber === tripNumber ? null : prev));
    setDeleteTripDialog(null);
  }, [deleteTripDialog]);

  // Trip end and restoration functionality handlers
  const handleTimePointClick = useCallback((tripNumber: number, timePointId: string, timePointIndex: number, event: React.MouseEvent, isInactive: boolean = false) => {
    event.stopPropagation();
    
    if (isInactive) {
      // This is a black/inactive timepoint - show restoration dialog
      setTripRestoreDialog({
        open: true,
        tripNumber,
        timePointId,
        timePointIndex
      });
    } else if (timePointIndex > 0) {
      // This is an active timepoint and not the first one - show trip end dialog
      setTripEndDialog({
        open: true,
        tripNumber,
        timePointId,
        timePointIndex
      });
    }
  }, []);

  const handleTripEndConfirm = useCallback(() => {
    if (!tripEndDialog) return;

    const { tripNumber, timePointIndex } = tripEndDialog;

    setSchedule(prevSchedule => {
      // Find the target trip to get its block number
      const targetTrip = prevSchedule.trips?.find(t => t.tripNumber === tripNumber);
      if (!targetTrip) return prevSchedule;

      const targetBlockNumber = targetTrip.blockNumber;

      // Find all trips for this block, sorted by departure time
      const blockTrips = sortTripsChronologically(
        prevSchedule.trips.filter(t => t.blockNumber === targetBlockNumber)
      );

      // Find the index of the target trip within its block
      const targetTripIndexInBlock = blockTrips.findIndex(t => t.tripNumber === tripNumber);

      const updatedTrips = prevSchedule.trips.filter(trip => {
        // If this is a different block, keep the trip
        if (trip.blockNumber !== targetBlockNumber) {
          return true;
        }

        // For trips in the same block
        const tripIndexInBlock = blockTrips.findIndex(t => t.tripNumber === trip.tripNumber);
        
        // Keep trips that come before the target trip in the block
        if (tripIndexInBlock < targetTripIndexInBlock) {
          return true;
        }
        
        // For the target trip, modify it to end at the specified timepoint
        if (trip.tripNumber === tripNumber) {
          const updatedTrip = { ...trip };
          
          // Set the trip end index
          updatedTrip.tripEndIndex = timePointIndex;
          
          // Preserve original times before clearing them (for restoration)
          if (!updatedTrip.originalArrivalTimes) {
            updatedTrip.originalArrivalTimes = { ...trip.arrivalTimes };
            updatedTrip.originalDepartureTimes = { ...trip.departureTimes };
            updatedTrip.originalRecoveryTimes = { ...trip.recoveryTimes };
          }
          
          // Clear all arrival and departure times for timepoints after the end point
          const updatedArrivalTimes = { ...trip.arrivalTimes };
          const updatedDepartureTimes = { ...trip.departureTimes };
          const updatedRecoveryTimes = { ...trip.recoveryTimes };
          
          prevSchedule.timePoints.forEach((tp, index) => {
            if (index === timePointIndex) {
              // At the end point: keep arrival, remove departure and set recovery to 0
              delete updatedDepartureTimes[tp.id];
              updatedRecoveryTimes[tp.id] = 0;
            } else if (index > timePointIndex) {
              // After the end point: remove everything
              delete updatedArrivalTimes[tp.id];
              delete updatedDepartureTimes[tp.id];
              updatedRecoveryTimes[tp.id] = 0;
            }
          });
          
          updatedTrip.arrivalTimes = updatedArrivalTimes;
          updatedTrip.departureTimes = updatedDepartureTimes;
          updatedTrip.recoveryTimes = updatedRecoveryTimes;
          
          // Update the trips array with the modified trip
          const tripIndex = prevSchedule.trips?.findIndex(t => t.tripNumber === tripNumber) ?? -1;
          const newTripsArray = [...prevSchedule.trips];
          newTripsArray[tripIndex] = updatedTrip;
          return true; // Keep this trip (but it will be modified)
        }
        
        // Remove all subsequent trips in the same block (tripIndexInBlock > targetTripIndexInBlock)
        return false;
      }).map(trip => {
        // Apply the modification to the target trip
        if (trip.tripNumber === tripNumber) {
          const updatedTrip = { ...trip };
          
          // Set the trip end index
          updatedTrip.tripEndIndex = timePointIndex;
          
          // Preserve original times before clearing them (for restoration)
          if (!updatedTrip.originalArrivalTimes) {
            updatedTrip.originalArrivalTimes = { ...trip.arrivalTimes };
            updatedTrip.originalDepartureTimes = { ...trip.departureTimes };
            updatedTrip.originalRecoveryTimes = { ...trip.recoveryTimes };
          }
          
          // Clear all arrival and departure times for timepoints after the end point
          const updatedArrivalTimes = { ...trip.arrivalTimes };
          const updatedDepartureTimes = { ...trip.departureTimes };
          const updatedRecoveryTimes = { ...trip.recoveryTimes };
          
          prevSchedule.timePoints.forEach((tp, index) => {
            if (index === timePointIndex) {
              // At the end point: keep arrival, remove departure and set recovery to 0
              delete updatedDepartureTimes[tp.id];
              updatedRecoveryTimes[tp.id] = 0;
            } else if (index > timePointIndex) {
              // After the end point: remove everything
              delete updatedArrivalTimes[tp.id];
              delete updatedDepartureTimes[tp.id];
              updatedRecoveryTimes[tp.id] = 0;
            }
          });
          
          updatedTrip.arrivalTimes = updatedArrivalTimes;
          updatedTrip.departureTimes = updatedDepartureTimes;
          updatedTrip.recoveryTimes = updatedRecoveryTimes;
          
          return updatedTrip;
        }
        return trip;
      });

      const normalizedTrips = syncTripCollection(updatedTrips, prevSchedule.timePoints);

      const updatedSchedule = {
        ...prevSchedule,
        trips: normalizedTrips
      };

      // Count how many trips were removed
      const removedTripsCount = prevSchedule.trips.length - updatedTrips.length;
      
      // Persist to localStorage
      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
        console.log(`✅ Trip ${tripNumber} (Block ${targetBlockNumber}) ended at timepoint index ${timePointIndex}`);
        if (removedTripsCount > 0) {
          console.log(`🚫 Removed ${removedTripsCount} subsequent trips for Block ${targetBlockNumber}`);
        }
      } catch (error) {
        console.warn('Failed to persist schedule updates:', error);
      }

      return applyTailRecoveryPolicy(updatedSchedule);
    });

    setTripEndDialog(null);
  }, [tripEndDialog]);

  const handleTripEndCancel = useCallback(() => {
    setTripEndDialog(null);
  }, []);

  // Trip restoration functionality handlers
  const handleTripRestoreConfirm = useCallback(() => {
    if (!tripRestoreDialog) return;

    const { tripNumber } = tripRestoreDialog;

    setSchedule(prevSchedule => {
      // Find the target trip to get its block number
      const targetTrip = prevSchedule.trips?.find(t => t.tripNumber === tripNumber);
      if (!targetTrip) return prevSchedule;

      const targetBlockNumber = targetTrip.blockNumber;

      // Restore the trip by removing tripEndIndex and restoring original times
      const updatedTrips = prevSchedule.trips.map(trip => {
        if (trip.tripNumber === tripNumber) {
          // Create a new trip object without the tripEndIndex and original backups
          const { 
            tripEndIndex, 
            originalArrivalTimes, 
            originalDepartureTimes, 
            originalRecoveryTimes,
            ...restoredTripBase 
          } = trip;
          
          // Restore the original times if they were preserved
          const restoredTrip = {
            ...restoredTripBase,
            arrivalTimes: originalArrivalTimes || trip.arrivalTimes,
            departureTimes: originalDepartureTimes || trip.departureTimes,
            recoveryTimes: originalRecoveryTimes || trip.recoveryTimes
          };
          
          console.log(`Restoring trip ${tripNumber} - removing tripEndIndex, restoring original times`);
          console.log('Original arrival times:', originalArrivalTimes);
          console.log('Original departure times:', originalDepartureTimes);
          console.log('Original recovery times:', originalRecoveryTimes);
          
          return restoredTrip;
        }
        return trip;
      });

      // TODO: Block-level trip restoration
      // To fully restore block-level trips that were removed, we would need to:
      // 1. Store removed trip data before deletion
      // 2. Regenerate subsequent trips in the block based on cycle times
      // 3. Maintain proper service band logic for new trips
      // For now, the current implementation only restores the individual trip
      
      const normalizedTrips = syncTripCollection(updatedTrips, prevSchedule.timePoints);

      const updatedSchedule = {
        ...prevSchedule,
        trips: normalizedTrips
      };

      // Persist to localStorage
      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
        console.log(`✅ Trip ${tripNumber} (Block ${targetBlockNumber}) fully restored with original schedule times`);
        console.log(`ℹ️ Note: Block-level trip restoration (regenerating removed subsequent trips) is not yet implemented`);
      } catch (error) {
        console.warn('Failed to persist schedule updates:', error);
      }

      return applyTailRecoveryPolicy(updatedSchedule);
    });

    setTripRestoreDialog(null);
  }, [tripRestoreDialog]);

  const handleTripRestoreCancel = useCallback(() => {
    setTripRestoreDialog(null);
  }, []);

  // Helper function to get the next start time for a specific block
  const getNextStartTimeForBlock = useCallback((blockNumber: number): string => {
    // Find all trips for this block
    const blockTrips = sortTripsChronologically(
      schedule.trips.filter(t => t.blockNumber === blockNumber)
    );
    
    if (blockTrips.length === 0) {
      // No trips for this block yet, return default
      return '06:00';
    }
    
    // Get the last trip for this block
    const lastBlockTrip = blockTrips[blockTrips.length - 1];
    
    // Get the departure time from the last timepoint (end of route)
    const lastTimePointId = schedule.timePoints[schedule.timePoints.length - 1]?.id;
    const lastDepartureTime = lastBlockTrip.departureTimes[lastTimePointId];
    
    if (lastDepartureTime) {
      // The next trip starts when the previous one departs from the last stop
      return lastDepartureTime;
    } else {
      // Fallback: estimate based on trip start + cycle time
      const cycleTime = schedule.cycleTimeMinutes || 30;
      const nextTime = timeStringToMinutes(lastBlockTrip.departureTime) + cycleTime;
      return minutesToTime(nextTime);
    }
  }, [schedule.trips, schedule.timePoints, schedule.cycleTimeMinutes]);

  // Add trip functionality handlers  
  const handleAddTripOpen = useCallback(() => {
    // Find the most recently used block number by finding the last trip overall
    const lastTrip = schedule.trips.reduce((latest, trip) => {
      if (!latest) return trip;
      const latestTime = timeStringToMinutes(latest.departureTime);
      const tripTime = timeStringToMinutes(trip.departureTime);
      return tripTime > latestTime ? trip : latest;
    }, null as Trip | null);

    const defaultBlockNumber = lastTrip ? lastTrip.blockNumber : 1;
    
    // Set block number first
    setNewTripBlockNumber(defaultBlockNumber.toString());
    
    // Get the appropriate start time for this block
    const suggestedTime = getNextStartTimeForBlock(defaultBlockNumber);
    setNewTripStartTime(suggestedTime);

    setAddTripDialog({
      open: true
    });
  }, [schedule.trips, getNextStartTimeForBlock]);

  // Handle block number change in dialog
  const handleBlockNumberChange = useCallback((value: string) => {
    setNewTripBlockNumber(value);
    
    // Update start time based on the new block number
    const blockNumber = parseInt(value);
    if (!isNaN(blockNumber)) {
      if (addTripDialog?.isEarlyTrip) {
        // For early trips, calculate backward from first trip
        const blockTrips = sortTripsChronologically(
          schedule.trips.filter(t => t.blockNumber === blockNumber)
        );
        
        if (blockTrips.length > 0) {
          const firstTrip = blockTrips[0];
          const cycleTime = schedule.cycleTimeMinutes || 30;
          const suggestedTime = minutesToTime(timeStringToMinutes(firstTrip.departureTime) - cycleTime);
          setNewTripStartTime(suggestedTime);
        } else {
          setNewTripStartTime('05:30'); // Default early start
        }
      } else {
        const suggestedTime = getNextStartTimeForBlock(blockNumber);
        setNewTripStartTime(suggestedTime);
      }
    }
  }, [getNextStartTimeForBlock, addTripDialog, schedule.trips, schedule.cycleTimeMinutes]);
  
  // Handle adding early trip (before first existing trip)
  const handleAddEarlyTripOpen = useCallback(() => {
    // Find the earliest trip
    const earliestTrip = schedule.trips.reduce((earliest, trip) => {
      if (!earliest) return trip;
      const earliestTime = timeStringToMinutes(earliest.departureTime);
      const tripTime = timeStringToMinutes(trip.departureTime);
      return tripTime < earliestTime ? trip : earliest;
    }, null as Trip | null);

    if (earliestTrip) {
      const blockNumber = earliestTrip.blockNumber;
      const cycleTime = schedule.cycleTimeMinutes || 30;
      const suggestedTime = minutesToTime(timeStringToMinutes(earliestTrip.departureTime) - cycleTime);
      
      setNewTripBlockNumber(blockNumber.toString());
      setNewTripStartTime(suggestedTime);
    } else {
      setNewTripBlockNumber('1');
      setNewTripStartTime('05:30');
    }

    setAddTripDialog({
      open: true,
      isEarlyTrip: true
    });
  }, [schedule.trips, schedule.cycleTimeMinutes]);
  
  // Handle adding mid-route trip (between existing trips)
  const handleAddMidRouteTripOpen = useCallback((afterTripNumber: number, beforeTripNumber: number) => {
    const afterTrip = schedule.trips?.find(t => t.tripNumber === afterTripNumber);
    const beforeTrip = schedule.trips?.find(t => t.tripNumber === beforeTripNumber);
    
    if (!afterTrip || !beforeTrip) return;
    
    // Find next available block number
    const usedBlocks = new Set(schedule.trips.map(t => t.blockNumber));
    let suggestedBlock = 1;
    while (usedBlocks.has(suggestedBlock)) {
      suggestedBlock++;
    }
    
    // Calculate suggested start time (midpoint between trips)
    const afterEndTime = afterTrip.departureTimes[schedule.timePoints[schedule.timePoints.length - 1]?.id] || afterTrip.departureTime;
    const beforeStartTime = beforeTrip.departureTime;
    
    const afterMinutes = timeStringToMinutes(afterEndTime);
    const beforeMinutes = timeStringToMinutes(beforeStartTime);
    const midMinutes = Math.floor((afterMinutes + beforeMinutes) / 2);
    
    setNewTripBlockNumber(suggestedBlock.toString());
    setNewTripStartTime(minutesToTime(afterMinutes + 5)); // Start 5 minutes after previous trip ends
    setNewTripEndTime(minutesToTime(beforeMinutes - 5)); // End 5 minutes before next trip starts
    
    setAddTripDialog({
      open: true,
      isMidRouteTrip: true,
      afterTripNumber,
      beforeTripNumber
    });
  }, [schedule.trips, schedule.timePoints]);
  
  // Handle service band click
  const handleServiceBandClick = useCallback((tripNumber: number, currentBand: ServiceBand) => {
    setServiceBandDialog({
      open: true,
      tripNumber,
      currentBand
    });
  }, []);
  
  // Handle service band change
  const handleServiceBandChange = useCallback((newBand: ServiceBand) => {
    if (!serviceBandDialog) return;
    
    setSchedule(prevSchedule => {
      const updatedTrips = prevSchedule.trips.map(trip => {
        if (trip.tripNumber === serviceBandDialog.tripNumber) {
          console.log(`Manually changed service band for trip ${trip.tripNumber} from ${trip.serviceBand} to ${newBand}`);
          return {
            ...trip,
            serviceBand: newBand
          };
        }
        return trip;
      });
      
      const normalizedTrips = syncTripCollection(updatedTrips, prevSchedule.timePoints);

      const updatedSchedule = {
        ...prevSchedule,
        trips: normalizedTrips
      };
      
      // Persist to localStorage
      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
      } catch (error) {
        console.warn('Failed to persist schedule updates:', error);
      }
      
      return applyTailRecoveryPolicy(updatedSchedule);
    });
    
    setServiceBandDialog(null);
  }, [serviceBandDialog]);

  const handleAddTripConfirm = useCallback(() => {
    if (!addTripDialog || !newTripBlockNumber || !newTripStartTime) return;

    const blockNumber = parseInt(newTripBlockNumber);
    if (isNaN(blockNumber)) {
      console.error('Invalid block number');
      return;
    }

    setSchedule(prevSchedule => {
      // Generate new trip number
      const maxTripNumber = prevSchedule.trips.reduce((max, trip) => 
        Math.max(max, trip.tripNumber), 0);
      const newTripNumber = maxTripNumber + 1;
      
      // Calculate end time based on trip type
      let calculatedEndTime: string | null = null;
      if (addTripDialog.isEarlyTrip) {
        const blockTrips = sortTripsChronologically(
          prevSchedule.trips.filter(t => t.blockNumber === blockNumber)
        );
        
        if (blockTrips.length > 0) {
          const firstTrip = blockTrips[0];
          // The early trip should end (depart from last stop) when the first trip starts
          calculatedEndTime = firstTrip.departureTime;
        }
      } else if (addTripDialog.isMidRouteTrip && newTripEndTime) {
        // For mid-route trips, use the user-specified end time
        calculatedEndTime = newTripEndTime;
      }

      // Determine service band based on start time
      let serviceBand = determineServiceBandForTime(newTripStartTime, prevSchedule.timePeriodServiceBands);
      
      // If no service band data exists for this time, use the previous trip's service band
      const timePeriod = getTimePeriodForTime(newTripStartTime);
      if (!prevSchedule.timePeriodServiceBands || !prevSchedule.timePeriodServiceBands[timePeriod]) {
        // Find the previous trip in the same block
        const blockTrips = sortTripsChronologically(
          prevSchedule.trips.filter(t => t.blockNumber === blockNumber)
        );
        
        if (blockTrips.length > 0) {
          const previousTrip = blockTrips[blockTrips.length - 1];
          serviceBand = previousTrip.serviceBand || serviceBand;
          console.log(`No service band data for ${timePeriod}, using previous trip's service band: ${serviceBand}`);
        }
      }

      // Get recovery template for this service band
      const recoveryTemplate = recoveryTemplates[serviceBand] || recoveryTemplates['Standard Service'] || [0, 2, 2, 3, 5];
      console.log(`Using recovery template for ${serviceBand}:`, recoveryTemplate);
      
      // Create new trip with generated times based on service band
      const newTrip: Trip = {
        tripNumber: newTripNumber,
        blockNumber,
        departureTime: newTripStartTime,
        serviceBand,
        arrivalTimes: {},
        departureTimes: {},
        recoveryTimes: {},
        recoveryMinutes: 0
      };

      // Generate times for each timepoint
      if ((addTripDialog.isEarlyTrip || addTripDialog.isMidRouteTrip) && calculatedEndTime) {
        // For early trips, work backward from the end time
        const totalTripTime = timeStringToMinutes(calculatedEndTime) - timeStringToMinutes(newTripStartTime);
        const numTimepoints = prevSchedule.timePoints.length;
        
        // Calculate total recovery from template
        const estimatedTotalRecovery = recoveryTemplate.slice(0, numTimepoints).reduce((sum, r) => sum + r, 0);
        const travelTimePerSegment = Math.floor((totalTripTime - estimatedTotalRecovery) / (numTimepoints - 1));
        
        let currentTime = timeStringToMinutes(newTripStartTime);
        prevSchedule.timePoints.forEach((tp, index) => {
          if (index === 0) {
            // First timepoint - only departure
            newTrip.departureTimes[tp.id] = newTripStartTime;
            newTrip.recoveryTimes[tp.id] = recoveryTemplate[index] || 0;
          } else {
            // Add travel time
            currentTime += travelTimePerSegment;
            newTrip.arrivalTimes[tp.id] = minutesToTime(currentTime);
            
            // Add recovery time from template
            const recoveryTime = recoveryTemplate[index] || 0;
            newTrip.recoveryTimes[tp.id] = recoveryTime;
            
            // For last stop of early trip, ensure departure matches first trip's start
            if (index === prevSchedule.timePoints.length - 1) {
              newTrip.departureTimes[tp.id] = calculatedEndTime;
            } else {
              newTrip.departureTimes[tp.id] = minutesToTime(currentTime + recoveryTime);
            }
            currentTime += recoveryTime;
          }
        });
      } else {
        // Normal trip generation
        let currentTime = timeStringToMinutes(newTripStartTime);
        
        prevSchedule.timePoints.forEach((tp, index) => {
          if (index === 0) {
            // First timepoint - only departure
            newTrip.departureTimes[tp.id] = newTripStartTime;
            newTrip.recoveryTimes[tp.id] = recoveryTemplate[index] || 0;
          } else {
            // Add default 6-minute travel time
            currentTime += 6;
            newTrip.arrivalTimes[tp.id] = minutesToTime(currentTime);
            
            // Add recovery time from template
            const recoveryTime = recoveryTemplate[index] || 0;
            newTrip.recoveryTimes[tp.id] = recoveryTime;
            newTrip.departureTimes[tp.id] = minutesToTime(currentTime + recoveryTime);
            currentTime += recoveryTime;
          }
        });
      }

      const syncedTrips = syncTripCollection(
        [...prevSchedule.trips, newTrip],
        prevSchedule.timePoints
      );

      const sortedTrips = sortTripsChronologically(syncedTrips);
      
      // Renumber trips based on chronological order
      const renumberedTrips = sortedTrips.map((trip, index) => ({
        ...trip,
        tripNumber: index + 1
      }));

      const updatedSchedule = {
        ...prevSchedule,
        trips: renumberedTrips
      };

      // Persist to localStorage
      try {
        localStorage.setItem('currentSummarySchedule', JSON.stringify(updatedSchedule));
        const finalTripNumber = renumberedTrips.find(t => 
          t.departureTime === newTripStartTime && t.blockNumber === blockNumber
        )?.tripNumber || newTripNumber;
        console.log(`✅ Added trip (now Trip ${finalTripNumber}) for Block ${blockNumber} at ${newTripStartTime}`);
      } catch (error) {
        console.warn('Failed to persist schedule updates:', error);
      }

      return applyTailRecoveryPolicy(updatedSchedule);
    });

    setAddTripDialog(null);
    setNewTripBlockNumber('');
    setNewTripStartTime('');
    setNewTripEndTime('');
  }, [addTripDialog, newTripBlockNumber, newTripStartTime, newTripEndTime, determineServiceBandForTime, recoveryTemplates]);

  const handleAddTripCancel = useCallback(() => {
    setAddTripDialog(null);
    setNewTripBlockNumber('');
    setNewTripStartTime('');
    setNewTripEndTime('');
  }, []);

  // Calculate summary statistics for the schedule
  const calculateSummaryStats = useCallback(() => {
    if (!schedule.trips || !Array.isArray(schedule.trips) || schedule.trips.length === 0) {
      return {
        totalTravelTime: '0:00',
        totalTripTime: '0:00',
        totalRecoveryTime: '0:00',
        averageRecoveryPercent: '0.0',
        tripCount: 0
      };
    }

    let totalTravelMinutes = 0;
    let totalTripMinutes = 0;
    let totalRecoveryMinutes = 0;
    let validTripCount = 0;

    schedule.trips.forEach(trip => {
      const { tripMinutes, recoveryMinutes, travelMinutes } = getTripMetrics(trip, schedule.timePoints);

      if (tripMinutes > 0) {
        totalTripMinutes += tripMinutes;
        totalRecoveryMinutes += recoveryMinutes;
        totalTravelMinutes += travelMinutes;
        validTripCount += 1;
      }
    });

    const averageRecoveryPercent = totalTravelMinutes > 0
      ? (totalRecoveryMinutes / totalTravelMinutes) * 100
      : 0;

    return {
      totalTravelTime: formatMinutesToHours(totalTravelMinutes),
      totalTripTime: formatMinutesToHours(totalTripMinutes),
      totalRecoveryTime: formatMinutesToHours(totalRecoveryMinutes),
      averageRecoveryPercent: averageRecoveryPercent.toFixed(1),
      tripCount: validTripCount
    };
  }, [getTripMetrics, schedule.timePoints, schedule.trips]);

  // Helper function to format minutes to hours:minutes
  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
  };

  // Function to update subsequent trip times when recovery changes
  const updateSubsequentTripTimes = useCallback((trip: Trip, changedTimePointId: string, recoveryDifference: number, timePoints: TimePoint[]) => {
    if (recoveryDifference === 0) return trip;
    
    const timePointIndex = timePoints.findIndex(tp => tp.id === changedTimePointId);
    if (timePointIndex === -1) return trip;
    
    // Update departure time at the changed timepoint first
    const updatedDepartureTimes = { ...trip.departureTimes };
    const updatedArrivalTimes = { ...trip.arrivalTimes };
    
    // The departure time at the changed point needs to be recalculated
    // Departure = Arrival + Recovery
    if (updatedArrivalTimes[changedTimePointId]) {
      const newRecovery = (trip.recoveryTimes[changedTimePointId] || 0) + recoveryDifference;
      updatedDepartureTimes[changedTimePointId] = addMinutesToTime(
        updatedArrivalTimes[changedTimePointId], 
        newRecovery
      );
    }
    
    // Update all subsequent timepoints in this trip
    for (let i = timePointIndex + 1; i < timePoints.length; i++) {
      const timePointId = timePoints[i].id;
      
      // Both arrival and departure shift by the recovery difference
      if (updatedArrivalTimes[timePointId]) {
        updatedArrivalTimes[timePointId] = addMinutesToTime(updatedArrivalTimes[timePointId], recoveryDifference);
      }
      
      if (updatedDepartureTimes[timePointId]) {
        updatedDepartureTimes[timePointId] = addMinutesToTime(updatedDepartureTimes[timePointId], recoveryDifference);
      }
    }
    
    const updatedTrip = {
      ...trip,
      departureTimes: updatedDepartureTimes,
      arrivalTimes: updatedArrivalTimes
    };
    return syncTripStartTime(updatedTrip, timePoints);
  }, []);

  // Special logic for RVH entrance affecting downstream stops
  const handleRVHEntranceZeroRecovery = useCallback((tripNumber: number) => {
    const downstreamStops = ['georgian-college', 'georgian-mall', 'bayfield-mall', 'downtown-terminal'];
    
    setSchedule(prevSchedule => {
      const updatedTrips = prevSchedule.trips.map(trip => {
        if (trip.tripNumber === tripNumber) {
          const updatedRecoveryTimes = { ...trip.recoveryTimes };
          
          // Reduce recovery time by 1 minute for downstream stops
          downstreamStops.forEach(stopId => {
            if (updatedRecoveryTimes[stopId] > 0) {
              updatedRecoveryTimes[stopId] = Math.max(0, updatedRecoveryTimes[stopId] - 1);
            }
          });
          
          return {
            ...trip,
            recoveryTimes: updatedRecoveryTimes
          };
        }
        return trip;
      });
      
      const normalizedTrips = syncTripCollection(updatedTrips, prevSchedule.timePoints);

      return {
        ...prevSchedule,
        trips: normalizedTrips
      };
    });
  }, []);

  // Recovery template management functions
  const updateRecoveryTemplate = useCallback((serviceBandName: string, timepointIndex: number, newValue: number) => {
    setRecoveryTemplates(prev => {
      const updated = {
        ...prev,
        [serviceBandName]: [...prev[serviceBandName]]
      };
      updated[serviceBandName][timepointIndex] = newValue;
      
      // Save to localStorage
      try {
        localStorage.setItem('recoveryTemplates', JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to save recovery templates:', error);
      }
      
      return updated;
    });
  }, []);

  const applyRecoveryTemplate = useCallback((serviceBandName: string) => {
    const template = recoveryTemplates[serviceBandName];
    if (!template) return;

    setSchedule(prevSchedule => {
      let updatedTrips = [...prevSchedule.trips];
      
      // First pass: Update recovery times and recalculate times for trips in this service band
      updatedTrips = updatedTrips.map(trip => {
        if (trip.serviceBand !== serviceBandName) return trip;

        const updatedRecoveryTimes = { ...trip.recoveryTimes };
        let currentTrip = { ...trip };
        
        // Apply template to each timepoint and recalculate times
        prevSchedule.timePoints.forEach((timePoint, index) => {
          if (index < template.length) {
            const oldRecoveryTime = currentTrip.recoveryTimes[timePoint.id] || 0;
            const newRecoveryTime = template[index];
            const recoveryDifference = newRecoveryTime - oldRecoveryTime;
            
            // Update recovery time
            updatedRecoveryTimes[timePoint.id] = newRecoveryTime;
            
            // If there's a difference, update subsequent times in this trip
            if (recoveryDifference !== 0) {
              currentTrip = updateSubsequentTripTimes(currentTrip, timePoint.id, recoveryDifference, prevSchedule.timePoints);
            }
          }
        });

        return {
          ...currentTrip,
          recoveryTimes: updatedRecoveryTimes
        };
      });

      // Second pass: Cascade changes to subsequent trips in the same blocks
      const affectedBlocks = new Set<number>();
      updatedTrips.forEach(trip => {
        if (trip.serviceBand === serviceBandName) {
          affectedBlocks.add(trip.blockNumber);
        }
      });

      // For each affected block, recalculate subsequent trip times
      affectedBlocks.forEach(blockNumber => {
        const blockTrips = sortTripsChronologically(
          updatedTrips.filter(t => t.blockNumber === blockNumber)
        );
        
        // Find the first trip that was modified
        let firstModifiedIndex = blockTrips.findIndex(t => t.serviceBand === serviceBandName);
        
        if (firstModifiedIndex >= 0) {
          // Update all trips after the first modified one
          for (let i = firstModifiedIndex + 1; i < blockTrips.length; i++) {
            const prevTrip = blockTrips[i - 1];
            const currentTripIndex = updatedTrips.findIndex(t => t.tripNumber === blockTrips[i].tripNumber);
            
            if (currentTripIndex >= 0) {
              const finalTimePointId = prevSchedule.timePoints[prevSchedule.timePoints.length - 1]?.id;
              
              // Calculate new start time based on when previous trip departs from final stop
              const prevTripFinalDeparture = prevTrip.departureTimes[finalTimePointId] || 
                addMinutesToTime(prevTrip.arrivalTimes[finalTimePointId], prevTrip.recoveryTimes[finalTimePointId] || 0);
              
              const timeDifference = timeStringToMinutes(prevTripFinalDeparture) - timeStringToMinutes(updatedTrips[currentTripIndex].departureTime);
              
              if (timeDifference !== 0) {
                // Update all times in this trip
                const updatedArrivalTimes = { ...updatedTrips[currentTripIndex].arrivalTimes };
                const updatedDepartureTimes = { ...updatedTrips[currentTripIndex].departureTimes };
                
                prevSchedule.timePoints.forEach(tp => {
                  if (updatedArrivalTimes[tp.id]) {
                    updatedArrivalTimes[tp.id] = addMinutesToTime(updatedArrivalTimes[tp.id], timeDifference);
                  }
                  if (updatedDepartureTimes[tp.id]) {
                    updatedDepartureTimes[tp.id] = addMinutesToTime(updatedDepartureTimes[tp.id], timeDifference);
                  }
                });
                
                updatedTrips[currentTripIndex] = syncTripStartTime({
                  ...updatedTrips[currentTripIndex],
                  departureTime: prevTripFinalDeparture,
                  arrivalTimes: updatedArrivalTimes,
                  departureTimes: updatedDepartureTimes
                }, prevSchedule.timePoints);
                
                // Update the reference in blockTrips for the next iteration
                blockTrips[i] = updatedTrips[currentTripIndex];
              }
            }
          }
        }
      });

      const normalizedTrips = syncTripCollection(updatedTrips, prevSchedule.timePoints);
      const sortedTrips = sortTripsChronologically(normalizedTrips);

      return {
        ...prevSchedule,
        trips: sortedTrips
      };
    });
    
    // Save to localStorage after applying template
    setTimeout(() => {
      const updatedSchedule = schedule;
      if (updatedSchedule) {
        localStorage.setItem('summarySchedule', JSON.stringify(updatedSchedule));
      }
    }, 100);
  }, [recoveryTemplates, schedule.timePoints]);

  const resetRecoveryTemplates = useCallback(() => {
    const defaultTemplates: RecoveryTemplate = {
      'Fastest Service': [0, 1, 1, 2, 3],
      'Fast Service': [0, 1, 2, 2, 4],
      'Standard Service': [0, 2, 2, 3, 5],
      'Slow Service': [0, 2, 3, 3, 6],
      'Slowest Service': [0, 3, 3, 4, 7]
    };
    
    setRecoveryTemplates(defaultTemplates);
    try {
      localStorage.setItem('recoveryTemplates', JSON.stringify(defaultTemplates));
    } catch (error) {
      console.warn('Failed to save recovery templates:', error);
    }
  }, []);

  const getServiceBandTravelMinutes = useCallback((serviceBandName: string): number => {
    const serviceBandInfo = schedule.serviceBands.find(sb => sb.name === serviceBandName);
    const totalMinutes = serviceBandInfo?.totalMinutes;
    if (typeof totalMinutes === 'number' && Number.isFinite(totalMinutes)) {
      return Math.round(totalMinutes);
    }

    const representativeTrip = schedule.trips.find(trip => trip.serviceBand === serviceBandName);
    if (representativeTrip) {
      const tripMinutes = calculateTripDurationMinutes(representativeTrip, schedule.timePoints);
      const recoveryMinutes = calculateTripRecoveryTime(representativeTrip, schedule.timePoints);
      const travelMinutes = calculateTravelTime(tripMinutes, recoveryMinutes);
      if (Number.isFinite(travelMinutes) && travelMinutes > 0) {
        return Math.round(travelMinutes);
      }
    }

    return 0;
  }, [schedule.serviceBands, schedule.trips, schedule.timePoints]);

  // Apply target recovery percentage to all service bands
  const applyTargetRecoveryPercentage = useCallback((percentage: number) => {
    const newTemplates: RecoveryTemplate = {};

    Object.keys(recoveryTemplates).forEach(serviceBandName => {
      const totalTravelTime = getServiceBandTravelMinutes(serviceBandName);

      // Calculate total recovery time as percentage of travel time
      const totalRecoveryTime = Math.round((totalTravelTime * percentage) / 100);

      // Distribute recovery time evenly across timepoints (excluding first departure point)
      const template: number[] = [];
      const totalPoints = schedule.timePoints.length;
      const numRecoveryPoints = Math.max(1, totalPoints - 1);

      for (let i = 0; i < totalPoints; i++) {
        if (i === 0) {
          // First timepoint (departure) - no recovery
          template.push(0);
        } else {
          const recoveryPerPoint = numRecoveryPoints > 0 ? Math.floor(totalRecoveryTime / numRecoveryPoints) : 0;
          const remainder = numRecoveryPoints > 0 ? totalRecoveryTime % numRecoveryPoints : 0;
          const isLastPoint = i === totalPoints - 1;
          const recoveryTime = recoveryPerPoint + (isLastPoint ? remainder : 0);

          template.push(Math.max(0, recoveryTime));
        }
      }

      newTemplates[serviceBandName] = template;
    });

    setRecoveryTemplates(newTemplates);
    try {
      localStorage.setItem('recoveryTemplates', JSON.stringify(newTemplates));
      localStorage.setItem('targetRecoveryPercentage', percentage.toString());
    } catch (error) {
      console.warn('Failed to save recovery templates:', error);
    }
  }, [getServiceBandTravelMinutes, recoveryTemplates, schedule.timePoints]);

  // Apply master recovery times to all service band templates
  const applyMasterRecoveryTimes = useCallback(() => {
    const newTemplates: RecoveryTemplate = {};
    
    // Copy master recovery times to all service bands
    Object.keys(recoveryTemplates).forEach(serviceBandName => {
      newTemplates[serviceBandName] = [...masterRecoveryTimes];
    });

    setRecoveryTemplates(newTemplates);
    try {
      localStorage.setItem('recoveryTemplates', JSON.stringify(newTemplates));
    } catch (error) {
      console.warn('Failed to save recovery templates:', error);
    }
  }, [masterRecoveryTimes, recoveryTemplates]);

  // Update master recovery time at specific index
  const updateMasterRecoveryTime = useCallback((index: number, value: number) => {
    setMasterRecoveryTimes(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  // New simplified trip row component - optimized with proper memoization
  const TripRow = memo(({ 
    trip, 
    idx, 
    timePoints,
    viewMode,
    onRecoveryClick,
    onServiceBandClick,
    onTripEnd,
    onTripRestore,
    onDeleteTrip,
    editingRecovery,
    tempRecoveryValue,
    onRecoveryChange,
    onRecoverySubmit,
    onRecoveryKeyDown
  }: { 
    trip: Trip; 
    idx: number;
    timePoints: TimePoint[];
    viewMode: RecoveryViewMode;
    onRecoveryClick: (tripId: string, timePointId: string, value: number, view: RecoveryViewMode) => void;
    onServiceBandClick: (tripNumber: number, band: ServiceBand) => void;
    onTripEnd: (tripNumber: number, timePointId: string, timePointIndex: number) => void;
    onTripRestore: (tripNumber: number, timePointId: string, timePointIndex: number) => void;
    onDeleteTrip: (trip: Trip) => void;
    editingRecovery: EditingRecoveryState | null;
    tempRecoveryValue: string;
    onRecoveryChange: (value: string) => void;
    onRecoverySubmit: (tripNumber: number, timePointId: string, newValue: number) => void;
    onRecoveryKeyDown: (e: React.KeyboardEvent) => void;
  }) => {
    const serviceBandColor = getServiceBandColor(trip.serviceBand);
    const { tripMinutes, recoveryMinutes, travelMinutes, recoveryPercent } = getTripMetrics(trip, timePoints);
    const tripTimeLabel = `${tripMinutes}min`;
    const recoveryTimeLabel = `${recoveryMinutes}min`;
    const travelTimeLabel = `${travelMinutes}min`;
    const roundedRecoveryPercent = Math.round(recoveryPercent);
    
    return (
      <TableRow
        key={trip.tripNumber}
        sx={{
          height: '48px',
          backgroundColor: idx % 2 === 0 ? '#fafbfc' : '#ffffff',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: '#e3f2fd',
            transform: 'translateY(-1px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            '& .MuiTableCell-root': {
              fontWeight: '500'
            }
          }
        }}
      >
        {/* Delete Trip */}
        <TableCell sx={{ 
          p: '4px',
          textAlign: 'center',
          borderRight: '1px solid #e2e8f0',
          minWidth: '56px'
        }}>
          <Tooltip title="Delete trip" arrow>
            <IconButton
              aria-label={`Delete trip ${trip.tripNumber}`}
              color="error"
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteTrip(trip);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>

        {/* Block Number */}
        <TableCell sx={{ 
          p: '12px', 
          fontSize: '14px', 
          textAlign: 'center', 
          fontWeight: '600',
          color: '#475569',
          borderRight: '1px solid #e2e8f0',
          minWidth: '80px'
        }}>
          {trip.blockNumber}
        </TableCell>
        
        {/* Trip Number */}
        <TableCell sx={{ 
          p: '12px', 
          fontSize: '16px', 
          textAlign: 'center', 
          fontWeight: 'bold',
          color: theme.palette.primary.dark,
          borderRight: '1px solid #e2e8f0',
          minWidth: '80px'
        }}>
          {trip.tripNumber}
        </TableCell>
        
        {/* Service Band */}
        <TableCell sx={{ 
          p: '8px', 
          textAlign: 'center',
          borderRight: '1px solid #e2e8f0',
          minWidth: '140px'
        }}>
          <Chip 
            label={trip.serviceBand}
            size="small"
            onClick={() => onServiceBandClick(trip.tripNumber, trip.serviceBand)}
            sx={{
              backgroundColor: `${serviceBandColor}20`,
              color: serviceBandColor,
              border: `1px solid ${serviceBandColor}40`,
              fontWeight: '600',
              fontSize: '0.75rem',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: `${serviceBandColor}30`,
                transform: 'scale(1.05)'
              }
            }}
          />
        </TableCell>
        
        {/* Time Points */}
        {timePoints.map((tp, tpIndex) => {
          const isActive = trip.tripEndIndex === undefined || tpIndex <= trip.tripEndIndex;
          const isInactive = !isActive;
          const isClickable = (tpIndex > 0 && isActive) || isInactive; // Can end active trips or restore inactive ones
          const isEditingRecoveryCell =
            editingRecovery?.tripId === `${trip.tripNumber}-${tp.id}` &&
            (!editingRecovery?.viewMode || editingRecovery.viewMode === viewMode);
          
          return (
            <TableCell 
              key={tp.id}
              onClick={isClickable ? (e) => handleTimePointClick(trip.tripNumber, tp.id, tpIndex, e, isInactive) : undefined}
              sx={{ 
                p: '12px', 
                fontSize: '13px', 
                textAlign: 'center',
                fontFamily: 'monospace',
                fontWeight: '500',
                color: isActive ? '#334155' : '#9ca3af',
                backgroundColor: isActive ? 'transparent' : '#1f2937', // Black background for inactive
                borderRight: '1px solid #f1f5f9',
                minWidth: '80px',
                cursor: isClickable ? 'pointer' : 'default',
                '&:hover': isClickable ? {
                  backgroundColor: isActive ? '#f0f9ff' : '#374151', // Different hover colors
                  transform: 'scale(1.02)',
                  color: isActive ? '#334155' : '#ffffff' // White text on hover for inactive
                } : {}
              }}
            >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              {isActive ? (
                <>
                  {/* Main Time Area - Click to End Trip */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    width: '100%',
                    padding: '4px 2px',
                    borderRadius: '3px',
                    backgroundColor: 'transparent',
                    transition: 'all 0.15s ease-in-out',
                    cursor: isClickable ? 'pointer' : 'default',
                    '&:hover': isClickable ? {
                      backgroundColor: '#fef3c7',
                      transform: 'scale(1.02)'
                    } : {}
                  }}>
                    <Typography component="div" sx={{ 
                      fontSize: '11px',
                      color: '#94a3b8',
                      fontWeight: '400',
                      minWidth: '20px',
                      textAlign: 'right'
                    }}>
                      {tpIndex === 0 ? 'dep:' : 'arr:'}
                    </Typography>
                    <Typography component="div" sx={{ 
                      fontSize: '12px',
                      fontWeight: '600',
                      color: tpIndex === 0 ? '#3b82f6' : '#1e293b'
                    }}>
                      {tpIndex === 0
                        ? (trip.departureTimes[tp.id] || trip.arrivalTimes[tp.id] || '-')
                        : (trip.arrivalTimes[tp.id] || '-')}
                    </Typography>
                  </Box>
                </>
              ) : (
                // Show restoration hint and recovery time for inactive timepoints
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '40px', gap: '2px' }}>
                  <Typography sx={{ 
                    fontSize: '10px',
                    color: '#9ca3af',
                    fontStyle: 'italic'
                  }}>
                    ---
                  </Typography>
                  {/* Show recovery time if it exists in original recovery times */}
                  {trip.originalRecoveryTimes && trip.originalRecoveryTimes[tp.id] !== undefined && (
                    <Typography 
                      component="div"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the restore dialog
                        onRecoveryClick(trip.tripNumber.toString(), tp.id, trip.originalRecoveryTimes?.[tp.id] || 0, viewMode);
                      }}
                      sx={{ 
                        fontSize: '11px',
                        color: '#60a5fa',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        display: 'inline-block',
                        transition: 'all 0.15s ease-in-out',
                        '&:hover': {
                          backgroundColor: 'rgba(96, 165, 250, 0.2)',
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      R: {trip.originalRecoveryTimes[tp.id]}min
                    </Typography>
                  )}
                  <Typography sx={{ 
                    fontSize: '8px',
                    color: '#6b7280',
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    Click box to restore
                  </Typography>
                </Box>
              )}
              
              {/* Departure time (if different from arrival due to recovery, but not for first timepoint) */}
              {isActive && tpIndex > 0 && trip.recoveryTimes && trip.recoveryTimes[tp.id] > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  width: '100%',
                  padding: '4px 2px',
                  borderRadius: '3px',
                  backgroundColor: 'transparent',
                  transition: 'all 0.15s ease-in-out',
                  cursor: isClickable ? 'pointer' : 'default',
                  '&:hover': isClickable ? {
                    backgroundColor: '#fef3c7',
                    transform: 'scale(1.02)'
                  } : {}
                }}>
                  <Typography component="div" sx={{ 
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontWeight: '400',
                    minWidth: '20px',
                    textAlign: 'right'
                  }}>
                    dep:
                  </Typography>
                  <Typography component="div" sx={{ 
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#3b82f6'
                  }}>
                    {trip.departureTimes[tp.id] || '-'}
                  </Typography>
                </Box>
              )}
              
              {/* Visual separator */}
              {isActive && trip.recoveryTimes && trip.recoveryTimes[tp.id] !== undefined && (
                <Box sx={{ width: '100%', height: '1px', backgroundColor: '#e2e8f0', my: '2px' }} />
              )}
              
              {/* Recovery time display - editable (always show, including 0min) */}
              {isActive && trip.recoveryTimes && trip.recoveryTimes[tp.id] !== undefined && (
                <Box sx={{ mt: '1px' }}>
                  {isEditingRecoveryCell ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <input
                        type="text"
                        data-recovery-edit="true"
                        data-view-mode={viewMode}
                        value={tempRecoveryValue}
                        onChange={(e) => onRecoveryChange(e.target.value)}
                        onKeyDown={(e) => {
                          onRecoveryKeyDown(e);
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            onRecoverySubmit(trip.tripNumber, tp.id, parseInt(tempRecoveryValue) || 0);
                          }
                        }}
                        onBlur={() => onRecoverySubmit(trip.tripNumber, tp.id, parseInt(tempRecoveryValue) || 0)}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        style={{
                          width: '45px',
                          fontSize: '10px',
                          padding: '1px 2px',
                          border: '2px solid #3b82f6',
                          borderRadius: '2px',
                          textAlign: 'center',
                          backgroundColor: '#eff6ff',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '10px', color: '#64748b' }}>min</span>
                    </Box>
                  ) : (
                    <Typography 
                      component="div" 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering trip end dialog
                        onRecoveryClick(trip.tripNumber.toString(), tp.id, trip.recoveryTimes[tp.id] || 0, viewMode);
                      }}
                      sx={{ 
                        fontSize: '11px',
                        color: '#0ea5e9',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#f0f9ff',
                        border: '2px solid #7dd3fc',
                        display: 'inline-block',
                        transition: 'all 0.2s ease-in-out',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        minWidth: '45px',
                        textAlign: 'center',
                        '&:hover': {
                          backgroundColor: '#dbeafe',
                          color: '#0369a1',
                          borderColor: '#0ea5e9',
                          transform: 'scale(1.08)',
                          boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)'
                        },
                        '&:active': {
                          transform: 'scale(1.02)'
                        }
                      }}
                    >
                      {`R: ${trip.recoveryTimes[tp.id]}min`}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </TableCell>
          );
        })}
        
        {/* Trip Time */}
        <TableCell sx={{ 
          p: '12px', 
          fontSize: '13px', 
          textAlign: 'center',
          fontFamily: 'monospace',
          fontWeight: '600',
          color: '#1976d2',
          backgroundColor: '#f3f7ff',
          minWidth: '80px'
        }}>
          {tripTimeLabel}
        </TableCell>
        
        {/* Recovery Time */}
        <TableCell sx={{ 
          p: '12px', 
          fontSize: '13px', 
          textAlign: 'center',
          fontFamily: 'monospace',
          fontWeight: '600',
          color: '#0d9488',
          backgroundColor: '#f0f9ff',
          minWidth: '80px'
        }}>
          {recoveryTimeLabel}
        </TableCell>
        
        {/* Travel Time */}
        <TableCell sx={{ 
          p: '12px', 
          fontSize: '13px', 
          textAlign: 'center',
          fontFamily: 'monospace',
          fontWeight: '600',
          color: '#059669',
          backgroundColor: '#ecfdf5',
          minWidth: '80px'
        }}>
          {travelTimeLabel}
        </TableCell>
        
        {/* Recovery Percentage */}
        <TableCell sx={{ 
          p: '12px', 
          fontSize: '13px', 
          textAlign: 'center',
          fontFamily: 'monospace',
          fontWeight: '600',
          minWidth: '100px'
        }}>
          {(() => {
            if (travelMinutes <= 0) {
              return (
                <Tooltip title="Not enough recovery time" arrow>
                  <Box sx={{ 
                    color: '#dc2626',
                    backgroundColor: '#fef2f2',
                    borderRadius: '4px',
                    py: '2px',
                    px: '6px',
                    display: 'inline-block',
                    cursor: 'help'
                  }}>
                    0%
                  </Box>
                </Tooltip>
              );
            }

            const percentage = roundedRecoveryPercent;
            const percentageText = `${percentage}%`;

            let color: string;
            let backgroundColor: string;
            let tooltipText: string;

            if (percentage < 10) {
              color = '#dc2626';
              backgroundColor = '#fef2f2';
              tooltipText = 'Not enough recovery time';
            } else if (percentage >= 10 && percentage < 15) {
              color = '#ca8a04';
              backgroundColor = '#fefce8';
              tooltipText = 'Okay recovery time';
            } else if (percentage >= 15 && percentage <= 18) {
              color = '#059669';
              backgroundColor = '#ecfdf5';
              tooltipText = 'Good recovery time';
            } else {
              color = '#dc2626';
              backgroundColor = '#fef2f2';
              tooltipText = 'Too much recovery time';
            }

            return (
              <Tooltip title={tooltipText} arrow>
                <Box sx={{ 
                  color,
                  backgroundColor,
                  borderRadius: '4px',
                  py: '2px',
                  px: '6px',
                  display: 'inline-block',
                  cursor: 'help'
                }}>
                  {percentageText}
                </Box>
              </Tooltip>
            );
          })()}
        </TableCell>
      </TableRow>
    );
  });

  // Process trips to ensure they have service bands
  const processedTrips = useMemo(() => {
    return schedule.trips.map(trip => ({
      ...trip,
      serviceBand: trip.serviceBand || getServiceBand(trip.departureTime, schedule.timePointData, new Set())
    }));
  }, [schedule.trips, schedule.timePointData]);

  const blockStats = useMemo(() => {
    const blocks = new Map<number, Trip[]>();
    processedTrips.forEach((trip: Trip) => {
      if (!blocks.has(trip.blockNumber)) {
        blocks.set(trip.blockNumber, []);
      }
      blocks.get(trip.blockNumber)!.push(trip);
    });
    
    return Array.from(blocks.entries()).map(([blockNum, trips]) => {
      const firstTrip = trips[0];
      const lastTrip = trips[trips.length - 1];
      
      return {
        blockNumber: blockNum,
        tripCount: trips.length,
        startTime: firstTrip.departureTime,
        endTime: lastTrip.departureTime
      };
    });
  }, [processedTrips]);


  // Sort trips by departure time
  const sortedTrips = useMemo(() => {
    return sortTripsChronologically(processedTrips);
  }, [processedTrips]);

  const totalTripTableColumns = schedule.timePoints.length + 8;


  const handleOpenRebuildDialog = useCallback(() => {
    setRebuildDialogOpen(true);
  }, []);

  const handleCloseRebuildDialog = useCallback(() => {
    if (!isRebuilding) {
      setRebuildDialogOpen(false);
    }
  }, [isRebuilding]);

  const handleRebuildSnackbarClose = useCallback(() => {
    setRebuildFeedback(prev => (prev ? { ...prev, open: false } : prev));
  }, []);

  const handleConfirmRebuild = useCallback(async () => {
    if (!isQuickAdjustMode) {
      setRebuildFeedback({
        open: true,
        severity: 'error',
        message: 'Rebuild is only available for quick adjust schedules.'
      });
      setRebuildDialogOpen(false);
      return;
    }

    const draftId = locationDraftId || draft?.draftId || quickAdjustSummaryRef.current?.routeId || schedule.id;
    if (!draftId) {
      setRebuildFeedback({
        open: true,
        severity: 'error',
        message: 'Unable to determine the current draft. Rebuild aborted.'
      });
      setRebuildDialogOpen(false);
      return;
    }

    setIsRebuilding(true);

    try {
      const storedPayload = quickAdjustStorage.load(draftId);
      let rows: string[][] | null = storedPayload?.rows || null;

      if (!rows || rows.length === 0) {
        const locationRows = location.state?.rawCsvRows as string[][] | undefined;
        if (Array.isArray(locationRows) && locationRows.length > 0) {
          rows = locationRows;
        }
      }

      if (!rows || rows.length === 0) {
        const uploadedData = draft?.originalData?.uploadedData as any;
        const uploadedRows = uploadedData?.rawCsvRows || uploadedData?.rawRows || uploadedData?.rows;
        if (Array.isArray(uploadedRows) && uploadedRows.length > 0) {
          rows = uploadedRows;
        }
      }

      if (!rows || rows.length === 0) {
        throw new Error('Original upload could not be located. Please re-upload the schedule to rebuild it.');
      }

      const rebuildResult = rebuildQuickAdjustSchedule(rows, { routeId: draftId });
      quickAdjustSummaryRef.current = rebuildResult.summary;

      setSchedule(prevSchedule => {
        const syncTimePoints = (rebuildResult.summary.timePoints && rebuildResult.summary.timePoints.length > 0)
          ? rebuildResult.summary.timePoints
          : prevSchedule.timePoints;

        const normalizedTrips = sortTripsChronologically(
          syncTripCollection(rebuildResult.weekdayTrips || [], syncTimePoints)
        );

        const nextSchedule: Schedule = {
          ...prevSchedule,
          id: rebuildResult.summary.routeId || prevSchedule.id,
          name: rebuildResult.summary.routeName || prevSchedule.name || 'Base Schedule',
          routeId: rebuildResult.summary.routeId || prevSchedule.routeId,
          routeName: rebuildResult.summary.routeName || prevSchedule.routeName,
          direction: rebuildResult.summary.direction || prevSchedule.direction || 'Outbound',
          timePoints: rebuildResult.summary.timePoints,
          trips: normalizedTrips,
          updatedAt: new Date().toISOString(),
          tripDetails: rebuildResult.summary.tripDetails
        };

        try {
          localStorage.setItem('currentSummarySchedule', JSON.stringify(nextSchedule));
        } catch (storageError) {
          console.warn('Failed to persist rebuilt schedule:', storageError);
        }

        return nextSchedule;
      });

      setEditingRecovery(null);
      setTempRecoveryValue('');
      setTripEndDialog(null);
      setTripRestoreDialog(null);
      setAddTripDialog(null);
      setServiceBandDialog(null);

      quickAdjustStorage.save(draftId, {
        rows,
        fileName: draft?.originalData?.fileName || schedule.name,
        savedAt: new Date().toISOString()
      });

      setRebuildFeedback({
        open: true,
        severity: 'success',
        message: 'Schedule rebuilt from the original upload.'
      });
    } catch (error: any) {
      console.error('Failed to rebuild schedule:', error);
      setRebuildFeedback({
        open: true,
        severity: 'error',
        message: error?.message || 'Rebuild failed. Please try again.'
      });
    } finally {
      setIsRebuilding(false);
      setRebuildDialogOpen(false);
    }
  }, [
    draft?.draftId,
    draft?.originalData?.fileName,
    draft?.originalData?.uploadedData,
    isQuickAdjustMode,
    location.state?.draftName,
    location.state?.rawCsvRows,
    locationDraftId,
    schedule.id,
    schedule.name
  ]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleContinueToConnections = async () => {
    // Prevent navigation if save is in progress
    if (isSaving) {
      console.log('⏳ Save in progress, waiting for completion before navigation...');
      return;
    }

    // Validate that we have schedule data
    if (!schedule || !schedule.trips || schedule.trips.length === 0) {
      setSaveError('No schedule data available. Please ensure the schedule has been generated successfully.');
      return;
    }

    setIsNavigating(true);

    try {
      // Get current draft ID from the location state or draft service
      const draftId = location.state?.draftId || draftService.getCurrentSessionDraftId();

      // Ensure data is saved before navigation
      if (updateSummarySchedule && !saveError) {
        console.log('🔄 Ensuring schedule data is saved before navigation...');

        const summaryScheduleData = {
          schedule: {
            routeId: schedule.id || `route_${Date.now()}`,
            routeName: schedule.name || 'Bus Route',
            direction: 'Outbound',
            timePoints: schedule.timePoints.map(tp => ({
              id: tp.id,
              name: tp.name,
              sequence: tp.sequence
            })),
            weekday: schedule.trips.map(trip =>
              schedule.timePoints.map(tp => {
                return trip.departureTimes?.[tp.id] || trip.arrivalTimes?.[tp.id] || '';
              })
            ),
            saturday: [],
            sunday: [],
            effectiveDate: new Date(),
            expirationDate: undefined,
            metadata: {
              weekdayTrips: schedule.trips.length,
              saturdayTrips: 0,
              sundayTrips: 0
            }
          },
          metadata: {
            generationTimestamp: new Date().toISOString(),
            generationMethod: 'block-based' as const,
            parameters: {
              numberOfBuses: Math.max(...(schedule.trips?.map(t => t.blockNumber) || [0])),
              tripCount: schedule.trips?.length || 0
            },
            validationResults: [],
            performanceMetrics: {
              generationTimeMs: 0,
              tripCount: schedule.trips?.length || 0,
              memoryUsageMB: 0
            }
          }
        };

        const result = await updateSummarySchedule(summaryScheduleData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save schedule before navigation');
        }
      }

      navigate('/connection-optimization', {
        state: {
          draftId,
          fromBlockSummary: true,
          summarySchedule: {
            id: schedule.id,
            name: schedule.name,
            timePoints: schedule.timePoints,
            trips: schedule.trips,
            serviceBands: schedule.serviceBands,
            updatedAt: schedule.updatedAt,
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to connections';
      console.error('❌ Navigation failed:', errorMessage);
      setSaveError(errorMessage);
    } finally {
      setIsNavigating(false);
    }
  };


  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      // Create a summary schedule object from the trips
      const summarySchedule: SummarySchedule = {
        routeId: schedule.id || `route_${Date.now()}`,
        routeName: schedule.name || 'Bus Route',
        direction: 'Outbound', // Could be made configurable
        timePoints: schedule.timePoints || [],
        weekday: processedTrips.map(trip => 
          schedule.timePoints.map(tp => trip.departureTimes?.[tp.id] || trip.arrivalTimes?.[tp.id] || '')
        ),
        saturday: [], // Could be populated if available
        sunday: [],   // Could be populated if available
        effectiveDate: new Date(),
        expirationDate: undefined,
        metadata: {
          weekdayTrips: processedTrips.length,
          saturdayTrips: 0,
          sundayTrips: 0,
          frequency: schedule.cycleTimeMinutes,
          operatingHours: processedTrips.length > 0 ? {
            start: processedTrips[0].departureTime,
            end: processedTrips[processedTrips.length - 1].departureTime
          } : undefined
        }
      };

      // Publish the schedule
      const result = scheduleStorage.publishSchedule(
        schedule.id || `schedule_${Date.now()}`,
        summarySchedule,
        { 
          timePointData: schedule.timePointData,
          serviceBands: schedule.serviceBands,
          blockConfigurations: schedule.blockConfigurations
        }
      );

      if (result.success) {
        setPublishSuccess(true);
        setTimeout(() => {
          // Navigate to published schedules page after success
          navigate('/schedules');
        }, 2000);
      } else {
        setPublishError(result.error || 'Failed to publish schedule');
      }
    } catch (error) {
      console.error('Error publishing schedule:', error);
      setPublishError('An error occurred while publishing the schedule');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExport = async () => {
    try {
      // Create export data bundle from current schedule
      const exportDataBundle = {
        summarySchedule: {
          routeId: schedule.id || `route_${Date.now()}`,
          routeName: schedule.name || 'Bus Route',
          direction: 'Outbound',
          timePoints: schedule.timePoints || [],
          weekday: processedTrips.map(trip => 
            schedule.timePoints.map(tp => trip.departureTimes?.[tp.id] || trip.arrivalTimes?.[tp.id] || '')
          ),
          saturday: [],
          sunday: [],
          effectiveDate: new Date(),
          metadata: {
            weekdayTrips: processedTrips.length,
            saturdayTrips: 0,
            sundayTrips: 0,
            totalTimePoints: schedule.timePoints.length,
            serviceBands: schedule.serviceBands.map(sb => sb.name),
            exportedAt: new Date().toISOString()
          }
        },
        metadata: {
          projectName: 'Base Schedule Export',
          routeName: schedule.name || 'Bus Route',
          direction: 'Outbound',
          processedAt: new Date(),
          processingTime: 0,
          version: '1.0',
          generatedBy: 'Scheduler2'
        },
        context: {
          exportedAt: new Date(),
          exportVersion: '1.0',
          sourceApplication: 'Scheduler2'
        }
      };

      // Use Excel format for export
      const exportOptions = {
        format: 'excel' as const,
        template: {
          id: 'excel-operational-format',
          name: 'Operational Excel Format',
          description: 'Professional Excel format for transit operations',
          format: 'excel' as const,
          category: 'operational' as const,
          isSystemTemplate: true,
          defaultScope: {
            includeRawData: false,
            includeAnalysis: false,
            includeConfiguration: false,
            includeGeneratedSchedule: true,
            includeMetadata: true
          },
          requiredData: ['summary-schedule' as const],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        scope: {
          includeRawData: false,
          includeAnalysis: false,
          includeConfiguration: false,
          includeGeneratedSchedule: true,
          includeMetadata: true
        },
        filename: `${schedule.name || 'schedule'}_${new Date().toISOString().split('T')[0]}`,
        timeFormat: '24h' as const,
        includeHeaders: true,
        qualityLevel: 'standard' as const
      };

      const result = await exportService.executeExport(exportOptions, exportDataBundle);
      
      if (result.success && result.blob) {
        // Create download link
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Schedule exported successfully:', result.filename);
      } else {
        console.error('Export failed:', result);
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Error exporting schedule:', error);
      alert('An error occurred while exporting the schedule. Please try again.');
    }
  };

  if (schedule.trips.length === 0) {
    return (
      <Box sx={{ pr: 3, width: '100%' }}>
          <Box sx={{ py: 4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h5" gutterBottom>
                  No Schedule Data
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  No schedule data was provided. Please go back and generate a schedule first.
                </Typography>
                <Button 
                  variant="contained" 
                  onClick={handleBack}
                  startIcon={<BackIcon />}
                >
                  Go Back
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Box>
    );
  }

  return (
    <>
      <Box sx={{ pr: 3, width: '100%' }}>
        <Box sx={{ py: 4 }}>

          {/* Save Status and Error Display */}
          {(isSaving || saveError) && (
            <Box sx={{ mb: 3 }}>
              {isSaving && (
                <Alert severity="info" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={20} sx={{ mr: 2 }} />
                  Saving schedule data...
                </Alert>
              )}
              {saveError && (
                <Alert
                  severity="error"
                  sx={{ mb: 1 }}
                  onClose={() => setSaveError(null)}
                >
                  <strong>Save Error:</strong> {saveError}
                </Alert>
              )}
            </Box>
          )}

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
              startIcon={<BackIcon />}
              onClick={handleBack}
              size="large"
              sx={{ minWidth: 180 }}
            >
              Back to Blocks
            </Button>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SaveToDraft variant="outlined" size="medium" />
              <AutoSaveStatus />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Step 4 of 5
                </Typography>
                <Typography variant="body1" color="primary" fontWeight="bold">
                  Summary Schedule
                </Typography>
              </Box>
              {!isQuickAdjustMode && (
                <Button
                  variant="contained"
                  startIcon={isNavigating ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIcon />}
                  onClick={handleContinueToConnections}
                  size="large"
                  color="primary"
                  disabled={isSaving || isNavigating || !schedule || !schedule.trips || schedule.trips.length === 0}
                  sx={{
                    minWidth: 220,
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                  }}
                >
                  {isNavigating ? 'Saving & Navigating...' : isSaving ? 'Saving Data...' : 'Continue to Optimize Connections'}
                </Button>
              )}
            </Box>
          </Box>

          <Card elevation={2}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    Base Schedule
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    This is the base start and end times and best practice recovery times
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <Chip 
                    label={`${sortedTrips.length} trips • ${blockStats.length} bus blocks`}
                    color="primary"
                    size="medium"
                  />
                  {publishSuccess && (
                    <Chip 
                      label="✓ Published Successfully!"
                      color="success"
                      size="small"
                    />
                  )}
                  {publishError && (
                    <Chip 
                      label={publishError}
                      color="error"
                      size="small"
                    />
                  )}
                  <Button
                    variant="contained"
                    startIcon={isPublishing ? null : <PublishIcon />}
                    onClick={handlePublish}
                    disabled={isPublishing || publishSuccess}
                    size="small"
                    color="success"
                  >
                    {isPublishing ? 'Publishing...' : publishSuccess ? 'Published!' : 'Publish Schedule'}
                  </Button>
                  {!isQuickAdjustMode && (
                    <Button
                      variant="contained"
                      startIcon={isNavigating ? <CircularProgress size={16} color="inherit" /> : <ConnectionsIcon />}
                      onClick={handleContinueToConnections}
                      size="small"
                      color="primary"
                      disabled={isSaving || isNavigating || !schedule || !schedule.trips || schedule.trips.length === 0}
                    >
                      {isNavigating ? 'Saving...' : 'Optimize Connections'}
                    </Button>
                  )}
                  {isQuickAdjustMode && (
                    <Button
                      variant="outlined"
                      startIcon={isRebuilding ? <CircularProgress size={16} color="inherit" /> : <RebuildIcon />}
                      onClick={handleOpenRebuildDialog}
                      size="small"
                      disabled={isRebuilding}
                    >
                      {isRebuilding ? 'Rebuilding...' : 'Rebuild Schedule'}
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    startIcon={<ExportIcon />}
                    onClick={handleExport}
                    size="small"
                    color="secondary"
                  >
                    Export Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FullscreenIcon />}
                    onClick={() => setIsFullscreen(true)}
                    size="small"
                  >
                    Full Screen
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={handleBack}
                    size="small"
                  >
                    Back
                  </Button>
                </Box>
              </Box>

              {/* Schedule Summary Section */}
              <Card elevation={2} sx={{ mt: 3, mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ 
                    fontWeight: 'bold',
                    color: '#1976d2',
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    📊 Schedule Summary
                  </Typography>
                  
                  {(() => {
                    const summaryStats = calculateSummaryStats();
                    return (
                      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'space-around' }}>
                        <Box sx={{ 
                          textAlign: 'center',
                          minWidth: '120px',
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0'
                        }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#15803d', fontFamily: 'monospace' }}>
                            {summaryStats.totalTripTime}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#16a34a', fontWeight: 'medium' }}>
                            Total Trip Time
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            (including recovery)
                          </Typography>
                        </Box>

                        <Box sx={{ 
                          textAlign: 'center',
                          minWidth: '120px',
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd'
                        }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0369a1', fontFamily: 'monospace' }}>
                            {summaryStats.totalTravelTime}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#0284c7', fontWeight: 'medium' }}>
                            Total Travel Time
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            (excluding recovery)
                          </Typography>
                        </Box>

                        <Box sx={{ 
                          textAlign: 'center',
                          minWidth: '120px',
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: '#fdf2f8',
                          border: '1px solid #f9a8d4'
                        }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#be185d', fontFamily: 'monospace' }}>
                            {summaryStats.totalRecoveryTime}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#db2777', fontWeight: 'medium' }}>
                            Total Recovery Time
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            dwell time at stops
                          </Typography>
                        </Box>

                        <Box sx={{ 
                          textAlign: 'center',
                          minWidth: '120px',
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: '#fefbf4',
                          border: '1px solid #fed7aa'
                        }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ea580c', fontFamily: 'monospace' }}>
                            {summaryStats.averageRecoveryPercent}%
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#dc2626', fontWeight: 'medium' }}>
                            Average Recovery %
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            across all trips
                          </Typography>
                        </Box>

                        <Box sx={{ 
                          textAlign: 'center',
                          minWidth: '120px',
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: '#faf5ff',
                          border: '1px solid #d8b4fe'
                        }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9333ea', fontFamily: 'monospace' }}>
                            {summaryStats.tripCount}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#a855f7', fontWeight: 'medium' }}>
                            Total Trips
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            active in schedule
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })()}
                </CardContent>
              </Card>
              
              <TableContainer 
                component={Paper} 
                variant="outlined"
                sx={{ 
                  width: '100%', 
                  maxHeight: '70vh',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  position: 'relative',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
                  backgroundColor: '#ffffff'
                }}
              >
                <Table size="small" sx={{ 
                  width: '100%',
                  minWidth: '600px',
                  '& .MuiTableRow-root': {
                    borderBottom: '1px solid #f1f5f9'
                  }
                }}>
                  <TableHead sx={{ 
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backgroundColor: 'white',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)'
                    }
                  }}>
                    <TableRow sx={{ 
                      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                      '& .MuiTableCell-root': {
                        position: 'sticky',
                        top: 0,
                        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                        zIndex: 10,
                        borderBottom: '2px solid #cbd5e1',
                        color: '#1e293b',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '16px 12px',
                        fontSize: '0.85rem'
                      }
                    }}>
                      {/* Delete Trip Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '60px',
                        borderRight: '1px solid #cbd5e1'
                      }}>
                        Delete
                      </TableCell>
                      
                      {/* Block Number Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '80px',
                        borderRight: '1px solid #cbd5e1'
                      }}>
                        Block Number
                      </TableCell>
                      
                      {/* Trip Number Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '80px',
                        borderRight: '1px solid #cbd5e1'
                      }}>
                        Trip Number
                      </TableCell>
                      
                      {/* Service Band Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '140px',
                        borderRight: '1px solid #cbd5e1'
                      }}>
                        Service Band
                      </TableCell>
                      
                      {/* Time Points */}
                      {schedule.timePoints.map((tp, index) => (
                        <TableCell 
                          key={tp.id}
                          sx={{ 
                            textAlign: 'center',
                            borderRight: '1px solid #cbd5e1',
                            minWidth: '100px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={tp.name}
                        >
                          {tp.name}
                        </TableCell>
                      ))}
                      
                      {/* Trip Time Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '100px',
                        backgroundColor: '#f3f7ff',
                        fontWeight: '800'
                      }}>
                        Trip Time
                      </TableCell>
                      
                      {/* Recovery Time Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '100px',
                        backgroundColor: '#f0f9ff',
                        fontWeight: '800'
                      }}>
                        Recovery Time
                      </TableCell>
                      
                      {/* Travel Time Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '100px',
                        backgroundColor: '#ecfdf5',
                        fontWeight: '800'
                      }}>
                        Travel Time
                      </TableCell>
                      
                      {/* Recovery Percentage Column */}
                      <TableCell sx={{ 
                        textAlign: 'center',
                        minWidth: '120px',
                        backgroundColor: '#fffbeb',
                        fontWeight: '800'
                      }}>
                        Recovery %
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                  {/* Add Early Trip Row - Shows before first trip */}
                  {sortedTrips.length > 0 && (
                    <TableRow
                      sx={{
                        height: '48px',
                        backgroundColor: '#f0f9ff',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#e0f2fe',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                        }
                      }}
                      onClick={handleAddEarlyTripOpen}
                    >
                      <TableCell 
                        colSpan={totalTripTableColumns}
                        sx={{ 
                          textAlign: 'center',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#3b82f6',
                          padding: '12px'
                        }}
                      >
                        +
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {sortedTrips.map((trip, idx) => {
                    const nextTrip = sortedTrips[idx + 1];
                    
                    return (
                      <React.Fragment key={trip.tripNumber}>
                        <TripRow
                          trip={trip}
                          idx={idx}
                          timePoints={schedule.timePoints}
                          viewMode="base"
                          onRecoveryClick={handleRecoveryClick}
                          onServiceBandClick={handleServiceBandClick}
                          onTripEnd={handleTripEnd}
                          onTripRestore={handleTripRestore}
                          onDeleteTrip={handleDeleteTripPrompt}
                          editingRecovery={editingRecovery}
                          tempRecoveryValue={tempRecoveryValue}
                          onRecoveryChange={setTempRecoveryValue}
                          onRecoverySubmit={handleRecoverySubmit}
                          onRecoveryKeyDown={handleRecoveryKeyDown}
                        />
                        {/* Add trip button between trips */}
                        {nextTrip && (
                          <TableRow
                            sx={{
                              height: '24px',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              opacity: 0,
                              transition: 'opacity 0.2s ease-in-out',
                              '&:hover': {
                                opacity: 1,
                                backgroundColor: '#f0f9ff'
                              }
                            }}
                            onClick={() => handleAddMidRouteTripOpen(trip.tripNumber, nextTrip.tripNumber)}
                          >
                            <TableCell 
                              colSpan={totalTripTableColumns}
                              sx={{ 
                                textAlign: 'center',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#3b82f6',
                                padding: '4px'
                              }}
                            >
                              +
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Add Trip Row - Shows after last trip */}
                  {sortedTrips.length > 0 && (
                    <TableRow
                      sx={{
                        height: '48px',
                        backgroundColor: '#f0f9ff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: '#e0f2fe',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                        }
                      }}
                      onClick={handleAddTripOpen}
                    >
                      <TableCell 
                        colSpan={totalTripTableColumns}
                        sx={{ 
                          textAlign: 'center',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#3b82f6',
                          padding: '12px'
                        }}
                      >
                        +
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </CardContent>
          </Card>

          {/* Recovery Time Templates by Service Band */}
          {!isQuickAdjustMode && (
            <Card elevation={2} sx={{ mt: 3 }}>
              <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ 
                fontWeight: 'bold',
                color: '#1976d2',
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}>
                <ScheduleIcon sx={{ fontSize: 28 }} />
                Recovery Time Templates by Service Band
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
                Standard recovery times used by each service band across timepoints
              </Typography>

              {/* Target Recovery Percentage Input */}
              <Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: '#fafbfc' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#374151' }}>
                    Target Recovery Percentage:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      step="5"
                      value={targetRecoveryPercentage}
                      onChange={(e) => {
                        const value = Math.max(5, Math.min(50, parseInt(e.target.value) || 15));
                        setTargetRecoveryPercentage(value);
                      }}
                      style={{
                        width: '70px',
                        height: '36px',
                        textAlign: 'center',
                        border: '2px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#1e40af'
                      }}
                    />
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>%</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => applyTargetRecoveryPercentage(targetRecoveryPercentage)}
                    sx={{
                      backgroundColor: '#3b82f6',
                      '&:hover': { backgroundColor: '#2563eb' },
                      fontSize: '12px',
                      px: 2
                    }}
                  >
                    Apply to All Bands
                  </Button>
                  <Typography variant="caption" sx={{ color: '#6b7280', ml: 'auto' }}>
                    * Automatically distributes recovery time based on travel time percentage
                  </Typography>
                </Box>
              </Paper>

              <TableContainer component={Paper} elevation={1}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ 
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: '#374151',
                        py: 2
                      }}>
                        Service Band
                      </TableCell>
                      {schedule.timePoints.map((tp, index) => (
                        <TableCell key={tp.id || `${tp.name}-${index}`} align="center" sx={{ 
                          fontWeight: 'bold',
                          fontSize: '12px',
                          color: '#374151',
                          py: 2,
                          minWidth: '90px'
                        }}>
                          {tp.name}
                          <br />
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            {index === 0 ? 'depart' : index === schedule.timePoints.length - 1 ? 'final' : 'stop'}
                          </Typography>
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ 
                        fontWeight: 'bold',
                        fontSize: '12px',
                        color: '#374151',
                        py: 2,
                        minWidth: '90px',
                        backgroundColor: '#e5f3ff'
                      }}>
                        Total Recovery
                        <br />
                        <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                          (minutes)
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ 
                        fontWeight: 'bold',
                        fontSize: '12px',
                        color: '#374151',
                        py: 2,
                        minWidth: '90px',
                        backgroundColor: '#fff3e0'
                      }}>
                        Travel Time
                        <br />
                        <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                          (minutes)
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ 
                        fontWeight: 'bold',
                        fontSize: '12px',
                        color: '#374151',
                        py: 2,
                        minWidth: '90px',
                        backgroundColor: '#f3e8ff'
                      }}>
                        Percent Recovery
                        <br />
                        <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                          (recovery/travel)
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Master Recovery Time Input Row */}
                    <TableRow sx={{ 
                      backgroundColor: '#f0f9ff',
                      borderBottom: '2px solid #3b82f6'
                    }}>
                      <TableCell sx={{ 
                        fontWeight: 'bold',
                        fontSize: '14px',
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: '#1e40af'
                      }}>
                        <Box sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6'
                        }} />
                        Master Template
                      </TableCell>
                      {schedule.timePoints.map((tp, index) => (
                        <TableCell
                          key={tp.id ? `master-${tp.id}` : `master-${tp.name}-${index}`}
                          align="center"
                          sx={{ py: 2 }}
                        >
                          <TextField
                            size="small"
                            type="number"
                            value={masterRecoveryTimes[index] || 0}
                            onChange={(e) => updateMasterRecoveryTime(index, parseInt(e.target.value) || 0)}
                            inputProps={{ 
                              min: 0, 
                              max: 99,
                              style: { 
                                textAlign: 'center',
                                fontSize: '13px',
                                fontWeight: '600'
                              }
                            }}
                            sx={{
                              width: '60px',
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#3b82f6'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#3b82f6'
                                }
                              }
                            }}
                          />
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Typography sx={{ 
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#3b82f6'
                        }}>
                          {masterRecoveryTimes.reduce((sum, time) => sum + (time || 0), 0)} min
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ py: 2 }}>
                        -
                      </TableCell>
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={applyMasterRecoveryTimes}
                          sx={{
                            backgroundColor: '#3b82f6',
                            '&:hover': { backgroundColor: '#2563eb' },
                            fontSize: '11px',
                            fontWeight: 'bold',
                            px: 2
                          }}
                        >
                          Apply to All Templates
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {Object.entries(recoveryTemplates).map(([serviceBandName, template]) => {
                      const serviceBandColors = {
                        'Fastest Service': '#4CAF50',
                        'Fast Service': '#8BC34A',
                        'Standard Service': '#FFC107',
                        'Slow Service': '#FF9800',
                        'Slowest Service': '#F44336'
                      };
                      const color = serviceBandColors[serviceBandName as keyof typeof serviceBandColors] || '#666';
                      
                      return (
                        <TableRow key={serviceBandName} sx={{ 
                          '&:nth-of-type(odd)': { backgroundColor: '#fafbfc' },
                          '&:hover': { backgroundColor: '#f0f9ff' }
                        }}>
                          <TableCell sx={{ 
                            fontWeight: 'bold',
                            fontSize: '13px',
                            py: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}>
                            <Box sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: color
                            }} />
                            {serviceBandName}
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => applyRecoveryTemplate(serviceBandName)}
                              sx={{
                                ml: 'auto',
                                fontSize: '10px',
                                py: '2px',
                                px: '8px',
                                minWidth: 'auto'
                              }}
                            >
                              Apply
                            </Button>
                          </TableCell>
                          {schedule.timePoints.map((tp, index) => {
                            // Ensure template has enough values for all timepoints
                            const extendedTemplate = [...template];
                            while (extendedTemplate.length <= index) {
                              extendedTemplate.push(extendedTemplate[extendedTemplate.length - 1] || 0);
                            }
                            
                            const recoveryTime = extendedTemplate[index];
                            
                            return (
                              <TableCell key={`${serviceBandName}-${tp.name}`} align="center" sx={{ 
                                py: 2,
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                fontWeight: '600'
                              }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="30"
                                  value={recoveryTime}
                                  onChange={(e) => {
                                    const newValue = Math.max(0, Math.min(30, parseInt(e.target.value) || 0));
                                    updateRecoveryTemplate(serviceBandName, index, newValue);
                                  }}
                                  style={{
                                    width: '50px',
                                    height: '32px',
                                    textAlign: 'center',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    fontWeight: '600',
                                    color: recoveryTime === 0 ? '#6b7280' : '#059669',
                                    backgroundColor: recoveryTime === 0 ? '#f9fafb' : '#ecfdf5'
                                  }}
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell align="center" sx={{ 
                            py: 2,
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            backgroundColor: '#f0f9ff',
                            color: '#0369a1'
                          }}>
                            {(() => {
                              // Calculate total recovery for this service band
                              const extendedTemplate = [...template];
                              while (extendedTemplate.length < schedule.timePoints.length) {
                                extendedTemplate.push(extendedTemplate[extendedTemplate.length - 1] || 0);
                              }
                              const total = extendedTemplate.slice(0, schedule.timePoints.length).reduce((sum, val) => sum + val, 0);
                              return total;
                            })()}
                          </TableCell>
                          <TableCell align="center" sx={{ 
                            py: 2,
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            backgroundColor: '#fff8e1',
                            color: '#f57c00'
                          }}>
                            {(() => {
                              const travelMinutes = getServiceBandTravelMinutes(serviceBandName);
                              return travelMinutes;
                            })()}
                          </TableCell>
                          <TableCell align="center" sx={{ 
                            py: 2,
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            backgroundColor: '#faf5ff',
                            color: '#7c3aed'
                          }}>
                            {(() => {
                              // Calculate percent recovery: total recovery / travel time * 100
                              const travelTime = getServiceBandTravelMinutes(serviceBandName);
                              
                              if (travelTime === 0) return '0%';
                              
                              // Calculate total recovery for this service band
                              const extendedTemplate = [...template];
                              while (extendedTemplate.length < schedule.timePoints.length) {
                                extendedTemplate.push(extendedTemplate[extendedTemplate.length - 1] || 0);
                              }
                              const totalRecovery = extendedTemplate.slice(0, schedule.timePoints.length).reduce((sum, val) => sum + val, 0);
                              
                              const percentage = Math.round((totalRecovery / travelTime) * 100);
                              return `${percentage}%`;
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Template Action Buttons */}
              <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                  * Edit recovery times above and click "Apply" to update all trips for that service band
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={resetRecoveryTemplates}
                    sx={{ fontSize: '12px' }}
                  >
                    Reset to Defaults
                  </Button>
                  
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      Object.keys(recoveryTemplates).forEach(serviceBandName => {
                        applyRecoveryTemplate(serviceBandName);
                      });
                    }}
                    sx={{ 
                      fontSize: '12px',
                      bgcolor: '#059669',
                      '&:hover': { bgcolor: '#047857' }
                    }}
                  >
                    Apply to Schedule
                  </Button>
                </Box>
              </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Simplified full screen overlay instead of Material-UI Dialog */}
      {isFullscreen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'white',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Simple header */}
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="h5">
              Base Schedule - Full Screen ({sortedTrips.length} trips)
            </Typography>
            <Button onClick={() => setIsFullscreen(false)} variant="outlined">
              Close
            </Button>
          </Box>
          
          {/* Reuse the same optimized table container */}
          <Box sx={{ flex: 1, p: 2, overflow: 'hidden' }}>
            <TableContainer 
              component={Paper} 
              variant="outlined"
              sx={{ 
                width: '100%', 
                height: '100%',
                overflowX: 'auto',
                overflowY: 'auto'
              }}
            >
              <Table size="small" sx={{ 
                width: '100%',
                minWidth: '600px',
                '& .MuiTableRow-root': {
                  borderBottom: '1px solid #f1f5f9'
                }
              }}>
                <TableHead sx={{ 
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: 'white',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)'
                  }
                }}>
                  <TableRow sx={{ 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    '& .MuiTableCell-root': {
                      position: 'sticky',
                      top: 0,
                      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                      zIndex: 10,
                      borderBottom: '2px solid #cbd5e1',
                      color: '#1e293b',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '16px 12px',
                      fontSize: '0.85rem'
                    }
                  }}>
                    {/* Delete Trip Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '60px',
                      borderRight: '1px solid #cbd5e1'
                    }}>
                      Delete
                    </TableCell>
                    
                    {/* Block Number Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '80px',
                      borderRight: '1px solid #cbd5e1'
                    }}>
                      Block Number
                    </TableCell>
                    
                    {/* Trip Number Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '80px',
                      borderRight: '1px solid #cbd5e1'
                    }}>
                      Trip Number
                    </TableCell>
                    
                    {/* Service Band Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '140px',
                      borderRight: '1px solid #cbd5e1'
                    }}>
                      Service Band
                    </TableCell>
                    
                    {/* Time Points */}
                    {schedule.timePoints.map((tp, index) => (
                      <TableCell 
                        key={tp.id}
                        sx={{ 
                          textAlign: 'center',
                          borderRight: '1px solid #cbd5e1',
                          minWidth: '100px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={tp.name}
                      >
                        {tp.name}
                      </TableCell>
                    ))}
                    
                    {/* Trip Time Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '100px',
                      backgroundColor: '#f3f7ff',
                      fontWeight: '800'
                    }}>
                      Trip Time
                    </TableCell>
                    
                    {/* Recovery Time Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '100px',
                      backgroundColor: '#f0f9ff',
                      fontWeight: '800'
                    }}>
                      Recovery Time
                    </TableCell>
                    
                    {/* Travel Time Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '100px',
                      backgroundColor: '#ecfdf5',
                      fontWeight: '800'
                    }}>
                      Travel Time
                    </TableCell>
                    
                    {/* Recovery Percentage Column */}
                    <TableCell sx={{ 
                      textAlign: 'center',
                      minWidth: '120px',
                      backgroundColor: '#fffbeb',
                      fontWeight: '800'
                    }}>
                      Recovery %
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedTrips.map((trip, idx) => (
                    <TripRow
                      key={trip.tripNumber}
                      trip={trip}
                      idx={idx}
                      timePoints={schedule.timePoints}
                      viewMode="fullscreen"
                      onRecoveryClick={handleRecoveryClick}
                      onServiceBandClick={handleServiceBandClick}
                      onTripEnd={handleTripEnd}
                      onTripRestore={handleTripRestore}
                      onDeleteTrip={handleDeleteTripPrompt}
                      editingRecovery={editingRecovery}
                      tempRecoveryValue={tempRecoveryValue}
                      onRecoveryChange={setTempRecoveryValue}
                      onRecoverySubmit={handleRecoverySubmit}
                      onRecoveryKeyDown={handleRecoveryKeyDown}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}

      {/* Rebuild Confirmation Dialog */}
      <Dialog
        open={rebuildDialogOpen}
        onClose={handleCloseRebuildDialog}
        aria-labelledby="rebuild-confirmation-title"
        disableEscapeKeyDown={isRebuilding}
      >
        <DialogTitle id="rebuild-confirmation-title">
          Rebuild schedule from original upload?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            This will discard any manual edits and rebuild the base schedule using the original CSV upload.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The existing schedule will be overwritten once the rebuild finishes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseRebuildDialog} disabled={isRebuilding}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRebuild}
            variant="contained"
            color="warning"
            startIcon={isRebuilding ? <CircularProgress size={16} color="inherit" /> : <RebuildIcon />}
            disabled={isRebuilding}
          >
            {isRebuilding ? 'Rebuilding...' : 'Rebuild'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={rebuildFeedback.open}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          handleRebuildSnackbarClose();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleRebuildSnackbarClose}
          severity={rebuildFeedback.severity}
          sx={{ width: '100%' }}
        >
          {rebuildFeedback.message}
        </Alert>
      </Snackbar>

      {/* Trip End Confirmation Dialog */}
      <Dialog
        open={tripEndDialog?.open || false}
        onClose={handleTripEndCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ 
          fontWeight: 'bold',
          color: '#1976d2'
        }}>
          End Trip {tripEndDialog?.tripNumber}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            End trip at this timepoint?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Removes subsequent stops for this trip<br/>
            • Removes later trips in Block {schedule.trips?.find(t => t.tripNumber === tripEndDialog?.tripNumber)?.blockNumber}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleTripEndCancel}
            variant="outlined"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTripEndConfirm}
            variant="contained"
            color="primary"
            size="small"
          >
            End Trip
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trip Restoration Confirmation Dialog */}
      <Dialog
        open={tripRestoreDialog?.open || false}
        onClose={handleTripRestoreCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ 
          fontWeight: 'bold',
          color: '#059669'
        }}>
          Restore Trip {tripRestoreDialog?.tripNumber}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Restore trip from this timepoint?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Restores subsequent stops<br/>
            • Uses original schedule times
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleTripRestoreCancel}
            variant="outlined"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTripRestoreConfirm}
            variant="contained"
            color="success"
            size="small"
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Trip Confirmation Dialog */}
      <Dialog
        open={deleteTripDialog?.open || false}
        onClose={handleDeleteTripCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ 
          fontWeight: 'bold',
          color: '#d32f2f'
        }}>
          Delete Trip {deleteTripDialog?.tripNumber}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will permanently remove the trip from Block {deleteTripDialog?.blockNumber}.
          </Typography>
          {deleteTripDialog?.departureTime && (
            <Typography variant="body2" color="text.secondary">
              Scheduled departure: {deleteTripDialog?.departureTime}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleDeleteTripCancel}
            variant="outlined"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteTripConfirm}
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
          >
            Delete Trip
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Trip Dialog */}
      <Dialog
        open={addTripDialog?.open || false}
        onClose={handleAddTripCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ 
          fontWeight: 'bold',
          color: '#1976d2'
        }}>
          {addTripDialog?.isEarlyTrip ? 'Add Early Trip' : 
           addTripDialog?.isMidRouteTrip ? 'Add Mid-Route Trip' : 'Add New Trip'}
        </DialogTitle>
        <DialogContent>
          {addTripDialog?.isMidRouteTrip && (
            <Typography variant="body2" sx={{ mb: 2, mt: 2, color: '#666' }}>
              Note: This trip requires a new block as existing blocks are occupied.
              The trip will be inserted between Trip {addTripDialog?.afterTripNumber} and Trip {addTripDialog?.beforeTripNumber}.
            </Typography>
          )}
          
          <TextField
            label="Block Number"
            type="number"
            value={newTripBlockNumber}
            onChange={(e) => handleBlockNumberChange(e.target.value)}
            fullWidth
            sx={{ mb: 2, mt: addTripDialog?.isMidRouteTrip ? 0 : 2 }}
            InputProps={{
              inputProps: { min: 1, max: 99 }
            }}
            helperText={addTripDialog?.isMidRouteTrip ? "A new block is required for this mid-route trip" : ""}
          />
          
          <TextField
            label="Start Time"
            type="time"
            value={newTripStartTime}
            onChange={(e) => setNewTripStartTime(e.target.value)}
            fullWidth
            sx={{ mb: addTripDialog?.isMidRouteTrip ? 2 : 0 }}
            InputLabelProps={{
              shrink: true,
            }}
          />
          
          {addTripDialog?.isMidRouteTrip && (
            <TextField
              label="End Time (Departure from Last Stop)"
              type="time"
              value={newTripEndTime}
              onChange={(e) => setNewTripEndTime(e.target.value)}
              fullWidth
              InputLabelProps={{
                shrink: true
              }}
              helperText="When should this trip depart from the last stop?"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleAddTripCancel}
            variant="outlined"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddTripConfirm}
            variant="contained"
            color="primary"
            disabled={!newTripBlockNumber || !newTripStartTime}
            size="small"
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Service Band Selection Dialog */}
      <Dialog
        open={serviceBandDialog?.open || false}
        onClose={() => setServiceBandDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ 
          fontWeight: 'bold',
          color: '#1976d2'
        }}>
          Change Service Band
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
            Select a new service band for Trip {serviceBandDialog?.tripNumber}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'] as ServiceBand[]).map((band) => {
              const bandColor = getServiceBandColor(band);
              const isSelected = band === serviceBandDialog?.currentBand;
              
              return (
                <Button
                  key={band}
                  variant={isSelected ? 'contained' : 'outlined'}
                  onClick={() => handleServiceBandChange(band)}
                  sx={{
                    justifyContent: 'flex-start',
                    padding: '12px 16px',
                    backgroundColor: isSelected ? `${bandColor}20` : 'transparent',
                    borderColor: bandColor,
                    color: bandColor,
                    '&:hover': {
                      backgroundColor: `${bandColor}30`,
                      borderColor: bandColor
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: bandColor,
                      mr: 2
                    }}
                  />
                  {band}
                  {isSelected && (
                    <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.7 }}>
                      (Current)
                    </Typography>
                  )}
                </Button>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setServiceBandDialog(null)}
            variant="outlined"
            size="small"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BlockSummarySchedule;

import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
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
  Tooltip
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Fullscreen as FullscreenIcon,
  Publish as PublishIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { calculateTripTime } from '../utils/dateHelpers';
import { scheduleStorage } from '../services/scheduleStorage';
import { SummarySchedule } from '../types/schedule';
import { workflowStateService } from '../services/workflowStateService';
import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs';

// Service Band Types based on travel time data from TimePoints analysis
export type ServiceBand = 'Fastest Service' | 'Fast Service' | 'Standard Service' | 'Slow Service' | 'Slowest Service';

interface TimePoint {
  id: string;
  name: string;
  sequence: number;
}

interface ServiceBandInfo {
  name: ServiceBand;
  totalMinutes: number;
  color: string;
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
}

interface Schedule {
  id: string;
  name: string;
  timePoints: TimePoint[];
  serviceBands: ServiceBandInfo[];
  trips: Trip[];
  updatedAt: string;
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
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Recovery time editing state
  const [editingRecovery, setEditingRecovery] = useState<{tripId: string, timePointId: string} | null>(null);
  const [tempRecoveryValue, setTempRecoveryValue] = useState<string>('');
  
  // Store original travel times to maintain consistency when recovery changes
  const [originalTravelTimes, setOriginalTravelTimes] = useState<{[tripId: string]: number}>({});

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

  // Mark the summary step as completed when the component loads
  useEffect(() => {
    workflowStateService.completeStep('summary', {
      scheduleGenerated: true,
      timestamp: new Date().toISOString()
    });
  }, []);

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

  // Process trips to add service bands based on TimePoints data
  useEffect(() => {
    if (schedule.trips.length > 0) {
      // Update trips with service bands if not already present
      const updatedTrips = schedule.trips.map(trip => ({
        ...trip,
        serviceBand: trip.serviceBand || getServiceBand(trip.departureTime, schedule.timePointData, new Set())
      }));
      
      // Only update if we actually added service bands
      if (updatedTrips.some(trip => !schedule.trips.find(t => t.tripNumber === trip.tripNumber)?.serviceBand)) {
        // In a real app, we'd update the state/context here
        // For now, we'll handle it in the processing logic below
      }
    }
  }, [schedule.trips, schedule.timePointData]);

  // Calculate and store original travel times when schedule loads
  useEffect(() => {
    if (schedule.trips.length > 0) {
      const travelTimes: {[tripId: string]: number} = {};
      
      schedule.trips.forEach(trip => {
        // Calculate original travel time based on service band or trip duration
        let travelTime = 0;
        
        if (trip.serviceBandInfo) {
          travelTime = trip.serviceBandInfo.totalMinutes || 0;
        } else {
          // Calculate from first to last timepoint without recovery
          const firstTimepointId = schedule.timePoints[0]?.id;
          const lastTimepointId = schedule.timePoints[schedule.timePoints.length - 1]?.id;
          const firstTime = firstTimepointId ? (trip.departureTimes[firstTimepointId] || trip.arrivalTimes[firstTimepointId]) : '';
          const lastTime = lastTimepointId ? (trip.departureTimes[lastTimepointId] || trip.arrivalTimes[lastTimepointId]) : '';
          
          if (firstTime && lastTime) {
            const firstMinutes = timeStringToMinutes(firstTime);
            const lastMinutes = timeStringToMinutes(lastTime);
            const totalTripTime = lastMinutes - firstMinutes;
            
            // Get initial total recovery time
            const initialTotalRecovery = trip.recoveryTimes 
              ? Object.values(trip.recoveryTimes).reduce((sum, time) => sum + (time || 0), 0)
              : 0;
            
            // Travel time is trip time minus recovery time (using initial recovery values)
            travelTime = Math.max(0, totalTripTime - initialTotalRecovery);
          }
        }
        
        travelTimes[trip.tripNumber.toString()] = travelTime;
      });
      
      setOriginalTravelTimes(travelTimes);
    }
  }, [schedule.trips, schedule.timePoints]);

  // Helper function to convert time string to minutes
  const timeStringToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to add minutes to time string
  const addMinutesToTime = (timeString: string, minutes: number): string => {
    const [hours, mins] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

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
  const determineServiceBandForTime = (departureTime: string, timePeriodServiceBands?: { [timePeriod: string]: string }): string => {
    const timePeriod = getTimePeriodForTime(departureTime);
    
    // First try to use the timePeriodServiceBands mapping if available
    if (timePeriodServiceBands && timePeriodServiceBands[timePeriod]) {
      return timePeriodServiceBands[timePeriod];
    }
    
    // Fallback logic based on time of day
    const [hours] = departureTime.split(':').map(Number);
    
    if (hours >= 6 && hours < 9) return 'Fast Service';        // Morning
    if (hours >= 9 && hours < 15) return 'Fastest Service';    // Mid-day
    if (hours >= 15 && hours < 18) return 'Slow Service';      // Afternoon
    if (hours >= 18 && hours < 22) return 'Standard Service';  // Evening
    return 'Slowest Service';                                   // Night
  };

  // Recovery time editing functions
  const handleRecoveryClick = useCallback((tripId: string, timePointId: string, currentValue: number) => {
    const tripIdentifier = `${tripId}-${timePointId}`;
    setEditingRecovery({ tripId: tripIdentifier, timePointId });
    setTempRecoveryValue(currentValue.toString());
    
    // Auto-select the value after React renders the input
    setTimeout(() => {
      const input = document.querySelector('input[data-recovery-edit="true"]') as HTMLInputElement;
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
    const [tripIdStr, timePointId] = editingRecovery.tripId.split('-');
    const tripNumber = parseInt(tripIdStr);
    
    // Calculate recovery difference first
    const targetTrip = schedule.trips.find(t => t.tripNumber === tripNumber);
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
      
      const updatedTrips = prevSchedule.trips.map(trip => {
        if (trip.tripNumber === tripNumber) {
          // Update recovery time for this timepoint
          const updatedRecoveryTimes = {
            ...trip.recoveryTimes,
            [timePointId]: newRecoveryTime
          };
          
          // Update subsequent trip times within this trip
          const updatedTrip = updateSubsequentTripTimes(trip, timePointId, recoveryDifference, prevSchedule.timePoints);
          
          return {
            ...updatedTrip,
            recoveryTimes: updatedRecoveryTimes
          };
        }
        return trip;
      });
      
      // Update subsequent trips in the same block for ANY recovery time change
      // because any change affects when the trip ends and thus when the next trip can start
      const finalTimePointId = prevSchedule.timePoints[prevSchedule.timePoints.length - 1]?.id;
      if (recoveryDifference !== 0) {
        // Find the trip that was modified
        const modifiedTrip = updatedTrips.find(t => t.tripNumber === tripNumber);
        if (modifiedTrip) {
          const blockNumber = modifiedTrip.blockNumber;
          
          // Find all trips in the same block and sort them by departure time
          const blockTrips = updatedTrips
            .filter(t => t.blockNumber === blockNumber)
            .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
          
          // Find the position of the modified trip in the block
          const modifiedTripIndexInBlock = blockTrips.findIndex(t => t.tripNumber === tripNumber);
          
          // Update all subsequent trips in this block (based on block cycling order)
          for (let i = modifiedTripIndexInBlock + 1; i < blockTrips.length; i++) {
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
                newServiceBand = determineServiceBandForTime(newDepartureTime, prevSchedule.timePeriodServiceBands) as ServiceBand;
                
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
              updatedTrips[tripIndex] = {
                ...subsequentTrip,
                departureTime: newDepartureTime,
                serviceBand: newServiceBand,
                departureTimes: updatedDepartureTimes,
                arrivalTimes: updatedArrivalTimes
              };
              
              console.log(`🔄 Updated trip ${subsequentTrip.tripNumber} in block ${blockNumber}: ${subsequentTrip.departureTime} → ${newDepartureTime} (shift: ${tripShift}min)`);
              
              // Log service band change if it occurred
              if (newServiceBand !== originalServiceBand) {
                console.log(`🎯 Service band updated for trip ${subsequentTrip.tripNumber}: ${originalServiceBand} → ${newServiceBand}`);
              }
            }
          }
        }
      }
      
      // Force re-sort trips to ensure display order is maintained
      const sortedUpdatedTrips = [...updatedTrips].sort((a, b) => {
        // First sort by departure time
        const timeCompare = a.departureTime.localeCompare(b.departureTime);
        if (timeCompare !== 0) return timeCompare;
        // Then by block number if times are equal
        return a.blockNumber - b.blockNumber;
      });
      
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
      
      return updatedSchedule;
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
    
    return {
      ...trip,
      departureTimes: updatedDepartureTimes,
      arrivalTimes: updatedArrivalTimes
    };
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
      
      return {
        ...prevSchedule,
        trips: updatedTrips
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
      const updatedTrips = prevSchedule.trips.map(trip => {
        if (trip.serviceBand !== serviceBandName) return trip;

        const updatedRecoveryTimes = { ...trip.recoveryTimes };
        
        // Apply template to each timepoint
        schedule.timePoints.forEach((timePoint, index) => {
          if (index < template.length) {
            updatedRecoveryTimes[timePoint.id] = template[index];
          }
        });

        return {
          ...trip,
          recoveryTimes: updatedRecoveryTimes
        };
      });

      return {
        ...prevSchedule,
        trips: updatedTrips
      };
    });
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

  // New simplified trip row component
  const TripRow = memo(({ trip, idx }: { trip: Trip; idx: number }) => {
    const serviceBandColor = getServiceBandColor(trip.serviceBand);
    
    // Calculate trip time from first to last timepoint departure
    const firstTimepointId = schedule.timePoints[0]?.id;
    const lastTimepointId = schedule.timePoints[schedule.timePoints.length - 1]?.id;
    const firstDepartureTime = firstTimepointId ? (trip.departureTimes[firstTimepointId] || trip.arrivalTimes[firstTimepointId]) : '';
    const lastDepartureTime = lastTimepointId ? (trip.departureTimes[lastTimepointId] || trip.arrivalTimes[lastTimepointId]) : '';
    const tripTime = calculateTripTime(firstDepartureTime || '', lastDepartureTime || '');
    
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
            sx={{
              backgroundColor: `${serviceBandColor}20`,
              color: serviceBandColor,
              border: `1px solid ${serviceBandColor}40`,
              fontWeight: '600',
              fontSize: '0.75rem'
            }}
          />
        </TableCell>
        
        {/* Time Points */}
        {schedule.timePoints.map((tp, tpIndex) => (
          <TableCell 
            key={tp.id}
            sx={{ 
              p: '12px', 
              fontSize: '13px', 
              textAlign: 'center',
              fontFamily: 'monospace',
              fontWeight: '500',
              color: '#334155',
              borderRight: '1px solid #f1f5f9',
              minWidth: '80px'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              {/* Arrival time (or departure for first timepoint) */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
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
                  {tpIndex === 0 ? (trip.departureTimes[tp.id] || trip.arrivalTimes[tp.id] || '-') : (trip.arrivalTimes[tp.id] || '-')}
                </Typography>
              </Box>
              
              {/* Departure time (if different from arrival due to recovery, but not for first timepoint) */}
              {tpIndex > 0 && trip.recoveryTimes && trip.recoveryTimes[tp.id] > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
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
              
              {/* Recovery time display - editable (always show, including 0min) */}
              {trip.recoveryTimes && trip.recoveryTimes[tp.id] !== undefined && (
                <Box sx={{ mt: '1px' }}>
                  {editingRecovery?.tripId === `${trip.tripNumber}-${tp.id}` ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <input
                        type="text"
                        data-recovery-edit="true"
                        value={tempRecoveryValue}
                        onChange={(e) => handleRecoveryChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRecoverySubmit();
                          if (e.key === 'Escape') handleRecoveryCancel();
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            handleRecoverySubmit();
                          }
                        }}
                        onBlur={handleRecoverySubmit}
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
                      onClick={() => handleRecoveryClick(trip.tripNumber.toString(), tp.id, trip.recoveryTimes[tp.id] || 0)}
                      sx={{ 
                        fontSize: '10px',
                        color: '#10b981',
                        fontWeight: '500',
                        cursor: 'pointer',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #86efac',
                        transition: 'all 0.15s ease-in-out',
                        '&:hover': {
                          backgroundColor: '#dcfce7',
                          color: '#059669',
                          borderColor: '#10b981',
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      {`${trip.recoveryTimes[tp.id]}min recovery`}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </TableCell>
        ))}
        
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
          {tripTime}
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
          {(() => {
            // Calculate total recovery time for this trip
            const totalRecoveryTime = trip.recoveryTimes 
              ? Object.values(trip.recoveryTimes).reduce((sum, time) => sum + (time || 0), 0)
              : 0;
            return totalRecoveryTime > 0 ? `${totalRecoveryTime}min` : '0min';
          })()}
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
          {(() => {
            // Use stored original travel time to maintain consistency
            const originalTravelTime = originalTravelTimes[trip.tripNumber.toString()] || 0;
            
            if (originalTravelTime > 0) {
              return `${originalTravelTime}min`;
            }
            
            // Fallback: use service band info if original not available
            const serviceBandInfo = trip.serviceBandInfo;
            if (serviceBandInfo) {
              const totalTravelTime = serviceBandInfo.totalMinutes || 0;
              return totalTravelTime > 0 ? `${totalTravelTime}min` : '0min';
            }
            
            return '0min';
          })()}
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
            // Calculate recovery percentage
            const totalRecoveryTime = trip.recoveryTimes 
              ? Object.values(trip.recoveryTimes).reduce((sum, time) => sum + (time || 0), 0)
              : 0;
            
            // Get travel time from stored original travel times
            let travelTime = originalTravelTimes[trip.tripNumber.toString()] || 0;
            
            // Fallback to service band info if original not available
            if (travelTime === 0) {
              const serviceBandInfo = trip.serviceBandInfo;
              if (serviceBandInfo) {
                travelTime = serviceBandInfo.totalMinutes || 0;
              }
            }
            
            if (travelTime === 0) {
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
            
            const percentage = (totalRecoveryTime / travelTime) * 100;
            const percentageText = `${percentage.toFixed(1)}%`;
            
            // Color coding based on percentage ranges and tooltip messages
            // < 10%: Red (not enough recovery time)
            // 10-15%: Yellow-green (okay recovery time) 
            // 15%: Green (great recovery time)
            // > 15%: Red (too much recovery time)
            
            let color, backgroundColor, tooltipText;
            if (percentage < 10) {
              color = '#dc2626';      // Red text
              backgroundColor = '#fef2f2'; // Light red background
              tooltipText = 'Not enough recovery time';
            } else if (percentage >= 10 && percentage < 15) {
              color = '#ca8a04';      // Yellow-green text
              backgroundColor = '#fefce8'; // Light yellow background
              tooltipText = 'Okay recovery time';
            } else if (percentage === 15) {
              color = '#059669';      // Green text
              backgroundColor = '#ecfdf5'; // Light green background
              tooltipText = 'Great recovery time';
            } else {
              color = '#dc2626';      // Red text (too much)
              backgroundColor = '#fef2f2'; // Light red background
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
    return [...processedTrips].sort((a, b) => {
      return a.departureTime.localeCompare(b.departureTime);
    });
  }, [processedTrips]);

  // Get visible trips for virtualization
  const visibleTrips = useMemo(() => {
    if (sortedTrips.length <= 50) return sortedTrips;
    return sortedTrips.slice(visibleRange.start, visibleRange.end);
  }, [sortedTrips, visibleRange]);

  // Handle scroll for virtualization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (sortedTrips.length <= 50) return;
    
    const container = e.target as HTMLDivElement;
    const scrollTop = container.scrollTop;
    const rowHeight = 48; // Fixed row height - updated for larger design
    const containerHeight = container.clientHeight;
    
    const startIndex = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeight / rowHeight) + 10; // Buffer
    const endIndex = Math.min(startIndex + visibleCount, sortedTrips.length);
    
    setVisibleRange({ start: startIndex, end: endIndex });
  }, [sortedTrips.length]);


  const handleBack = () => {
    navigate(-1);
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

  if (schedule.trips.length === 0) {
    return (
      <Container maxWidth={false} sx={{ px: 3 }}>
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
        </Container>
    );
  }

  return (
    <>
      <Container maxWidth={false} sx={{ px: 3 }}>
        <Box sx={{ py: 4 }}>
          <Card elevation={2}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight="bold">
                  Summary Schedule
                </Typography>
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
              
              <TableContainer 
                component={Paper} 
                variant="outlined"
                ref={tableContainerRef}
                onScroll={handleScroll}
                sx={{ 
                  width: '100%', 
                  height: sortedTrips.length > 20 ? '650px' : '550px',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  position: 'relative',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)'
                  }
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
                    {/* Add spacer for virtualization offset */}
                    {sortedTrips.length > 50 && visibleRange.start > 0 && (
                      <TableRow sx={{ height: `${visibleRange.start * 48}px` }}>
                            <TableCell colSpan={7 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
                      </TableRow>
                    )}
                    
                    {visibleTrips.map((trip, idx) => {
                      const originalIdx = sortedTrips.length > 50 ? visibleRange.start + idx : idx;
                      return (
                        <TripRow
                          key={trip.tripNumber}
                          trip={trip}
                          idx={originalIdx}
                        />
                      );
                    })}
                    
                    {/* Add spacer for remaining items */}
                    {sortedTrips.length > 50 && visibleRange.end < sortedTrips.length && (
                      <TableRow sx={{ height: `${(sortedTrips.length - visibleRange.end) * 48}px` }}>
                            <TableCell colSpan={7 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Recovery Time Templates by Service Band */}
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
                        <TableCell key={tp.name} align="center" sx={{ 
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
                    </TableRow>
                  </TableHead>
                  <TableBody>
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
                    Apply All Templates
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>

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
              Summary Schedule - Full Screen ({sortedTrips.length} trips)
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
              onScroll={handleScroll}
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
                  {/* Reuse same virtualization logic */}
                  {sortedTrips.length > 50 && visibleRange.start > 0 && (
                    <TableRow sx={{ height: `${visibleRange.start * 48}px` }}>
                      <TableCell colSpan={7 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
                    </TableRow>
                  )}
                  
                  {visibleTrips.map((trip, idx) => {
                    const originalIdx = sortedTrips.length > 50 ? visibleRange.start + idx : idx;
                    return (
                      <TripRow
                        key={trip.tripNumber}
                        trip={trip}
                        idx={originalIdx}
                      />
                    );
                  })}
                  
                  {sortedTrips.length > 50 && visibleRange.end < sortedTrips.length && (
                    <TableRow sx={{ height: `${(sortedTrips.length - visibleRange.end) * 48}px` }}>
                      <TableCell colSpan={7 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}
    </>
  );
};

export default BlockSummarySchedule;
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
  Close as CloseIcon
} from '@mui/icons-material';
import { scheduleStorage } from '../services/scheduleStorage';
import { SummarySchedule } from '../types/schedule';
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
  IconButton
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
  name: 'Fastest' | 'Fast' | 'Standard' | 'Slow' | 'Slowest';
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
    'Fastest': '#22c55e',   // Green
    'Fast': '#3b82f6',      // Blue  
    'Standard': '#f59e0b',  // Amber
    'Slow': '#ef4444',      // Red
    'Slowest': '#dc2626'    // Dark Red
  };
  return colorMap[bandName] || '#6b7280';
};

// ==================== MAIN COMPONENT ====================
export default function BlockConfiguration() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Get TimePoints data from navigation state
  const {
    timePointData = [],
    serviceBands = [],
    deletedPeriods = [],
    scheduleId,
    fileName
  } = location.state || {};
  // Removed tab state - no longer using tabs
  
  // Click and drag scrolling state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenTableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

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
      serviceBands: [
        {
          name: 'Fastest',
          color: getServiceBandColor('Fastest'),
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
          name: 'Fast',
          color: getServiceBandColor('Fast'),
          segmentTimes: [
            { from: 'downtown_terminal', to: 'johnson_napier', travelMinutes: 10 },
            { from: 'johnson_napier', to: 'rvh_entrance', travelMinutes: 14 },
            { from: 'rvh_entrance', to: 'georgian_college', travelMinutes: 17 },
            { from: 'georgian_college', to: 'georgian_mall', travelMinutes: 12 },
            { from: 'georgian_mall', to: 'bayfield_mall', travelMinutes: 20 },
            { from: 'bayfield_mall', to: 'downtown_return', travelMinutes: 28 }
          ],
          totalMinutes: 101
        },
        {
          name: 'Standard',
          color: getServiceBandColor('Standard'),
          segmentTimes: [
            { from: 'downtown_terminal', to: 'johnson_napier', travelMinutes: 12 },
            { from: 'johnson_napier', to: 'rvh_entrance', travelMinutes: 16 },
            { from: 'rvh_entrance', to: 'georgian_college', travelMinutes: 20 },
            { from: 'georgian_college', to: 'georgian_mall', travelMinutes: 15 },
            { from: 'georgian_mall', to: 'bayfield_mall', travelMinutes: 23 },
            { from: 'bayfield_mall', to: 'downtown_return', travelMinutes: 32 }
          ],
          totalMinutes: 118
        },
        {
          name: 'Slow',
          color: getServiceBandColor('Slow'),
          segmentTimes: [
            { from: 'downtown_terminal', to: 'johnson_napier', travelMinutes: 15 },
            { from: 'johnson_napier', to: 'rvh_entrance', travelMinutes: 20 },
            { from: 'rvh_entrance', to: 'georgian_college', travelMinutes: 25 },
            { from: 'georgian_college', to: 'georgian_mall', travelMinutes: 18 },
            { from: 'georgian_mall', to: 'bayfield_mall', travelMinutes: 28 },
            { from: 'bayfield_mall', to: 'downtown_return', travelMinutes: 38 }
          ],
          totalMinutes: 144
        },
        {
          name: 'Slowest',
          color: getServiceBandColor('Slowest'),
          segmentTimes: [
            { from: 'downtown_terminal', to: 'johnson_napier', travelMinutes: 18 },
            { from: 'johnson_napier', to: 'rvh_entrance', travelMinutes: 25 },
            { from: 'rvh_entrance', to: 'georgian_college', travelMinutes: 30 },
            { from: 'georgian_college', to: 'georgian_mall', travelMinutes: 22 },
            { from: 'georgian_mall', to: 'bayfield_mall', travelMinutes: 35 },
            { from: 'bayfield_mall', to: 'downtown_return', travelMinutes: 45 }
          ],
          totalMinutes: 175
        }
      ],
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
        let endTime = '22:00';
        
        if (schedule.automateBlockStartTimes && i > 0) {
          const frequencyMinutes = Math.round(schedule.cycleTimeMinutes / newCount);
          startTime = calculateAutomatedStartTime(i, frequencyMinutes, currentConfigs[0].startTime);
          endTime = addMinutesToTime(startTime, schedule.cycleTimeMinutes);
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
          endTime: addMinutesToTime(startTime, schedule.cycleTimeMinutes)
        };
      });
      
      setSchedule(prev => ({
        ...prev,
        blockConfigurations: updatedConfigs,
        updatedAt: new Date().toISOString()
      }));
    }
  }, [schedule.cycleTimeMinutes, schedule.automateBlockStartTimes, schedule.blockConfigurations.length, calculateAutomatedStartTime]);

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
        
        // Determine service band based on traffic patterns
        let serviceBand: ServiceBand['name'] = 'Standard';
        
        if (hour >= 6 && hour < 8) serviceBand = 'Fastest';  // Extended 6:00-8:00 for Fastest
        else if (hour >= 8 && hour < 9) serviceBand = 'Slow';
        else if (hour >= 9 && hour < 10) serviceBand = 'Standard';
        else if (hour >= 10 && hour < 15) serviceBand = 'Fastest';
        else if (hour >= 15 && hour < 17) serviceBand = 'Slowest';
        else if (hour >= 17 && hour < 18) serviceBand = 'Slow';
        else if (hour >= 18 && hour < 20) serviceBand = 'Standard';
        else if (hour >= 20) serviceBand = 'Fast';
        
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
  const generateTrips = () => {
    console.log('Generate trips button clicked!');
    console.log('Schedule configuration:', {
      blockConfigurations: schedule.blockConfigurations,
      cycleTimeMinutes: schedule.cycleTimeMinutes,
      automateBlockStartTimes: schedule.automateBlockStartTimes
    });
    
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
    
    const trips: Trip[] = [];
    let tripNumber = 1;
    
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
      for (let hour = 6; hour <= 22; hour++) {
        for (let half = 0; half < 2; half++) {
          const startMinutes = hour * 60 + half * 30;
          const endMinutes = startMinutes + 30;
          
          // Dynamically determine service band based on traffic patterns and travel time data
          let serviceBand: ServiceBand['name'] = 'Standard';
          
          // Early morning (6:00-8:00): Light traffic - Fastest
          if (hour >= 6 && hour < 8) serviceBand = 'Fastest';  // Extended to include 7:00 AM
          // Morning rush (8:00-9:00): Heavy traffic - Slow
          else if (hour >= 8 && hour < 9) serviceBand = 'Slow';
          // Late morning (9:00-11:00): Moderate traffic - Standard/Fast
          else if (hour >= 9 && hour < 10) serviceBand = 'Standard';
          else if (hour >= 10 && hour < 11) serviceBand = 'Fast';
          // Midday (11:00-15:00): Light traffic - Fastest/Fast
          else if (hour >= 11 && hour < 15) serviceBand = 'Fastest';
          // Afternoon rush (15:00-18:00): Heavy traffic - Slowest/Slow
          else if (hour >= 15 && hour < 17) serviceBand = 'Slowest';
          else if (hour >= 17 && hour < 18) serviceBand = 'Slow';
          // Evening (18:00-20:00): Moderate traffic - Standard
          else if (hour >= 18 && hour < 20) serviceBand = 'Standard';
          // Late evening (20:00-22:00): Light traffic - Fast
          else if (hour >= 20 && hour <= 22) serviceBand = 'Fast';
          
          periods.push({
            startTime: minutesToTime(startMinutes),
            endTime: minutesToTime(endMinutes),
            serviceBand
          });
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
      
      // Generate trips for this block using cycle time
      while (
        timeToMinutes(currentDepartureTime) + schedule.cycleTimeMinutes <= timeToMinutes(blockEndTime) &&
        blockTripCount < MAX_TRIPS_PER_BLOCK &&
        trips.length < MAX_TOTAL_TRIPS &&
        loopIterations < MAX_LOOP_ITERATIONS
      ) {
        loopIterations++;
        
        // Find appropriate service band for departure time
        const departureMinutes = timeToMinutes(currentDepartureTime);
        const currentPeriod = currentTimePeriods.find(period => {
          const periodStart = timeToMinutes(period.startTime);
          const periodEnd = timeToMinutes(period.endTime);
          return departureMinutes >= periodStart && departureMinutes < periodEnd;
        });
        
        const serviceBandName = currentPeriod?.serviceBand || 'Standard';
        const serviceBand = schedule.serviceBands.find(sb => sb.name === serviceBandName);
        
        if (!serviceBand) {
          console.error('Service band not found:', serviceBandName);
          break;
        }
        
        // Calculate arrival and departure times for each timepoint
        const arrivalTimes: { [timePointId: string]: string } = {};
        const departureTimes: { [timePointId: string]: string } = {};
        const recoveryTimes: { [timePointId: string]: number } = {};
        
        let currentMinutes = timeToMinutes(currentDepartureTime);
        
        schedule.timePoints.forEach((timePoint, index) => {
          if (index === 0) {
            // First timepoint - departure time
            arrivalTimes[timePoint.id] = currentDepartureTime;
            departureTimes[timePoint.id] = currentDepartureTime;
            recoveryTimes[timePoint.id] = 0;
          } else {
            // Subsequent timepoints - add travel time
            const segmentTime = serviceBand.segmentTimes[index - 1];
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
        
        trips.push({
          tripNumber,
          blockNumber: blockConfig.blockNumber,
          departureTime: currentDepartureTime,
          arrivalTimes,
          departureTimes,
          recoveryTimes,
          serviceBand: serviceBandName,
          recoveryMinutes: 5 // Default recovery time at end of trip
        });
        
        tripNumber++;
        blockTripCount++;
        
        // Move to next trip departure time (cycle time interval)
        currentDepartureTime = minutesToTime(timeToMinutes(currentDepartureTime) + schedule.cycleTimeMinutes);
      }
      
      console.log(`Block ${blockConfig.blockNumber}: Generated ${blockTripCount} trips`);
    }
    
    console.log(`Total trips generated: ${trips.length}`);
    
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
      
      const result = scheduleStorage.saveSchedule(
        summaryScheduleData,
        'excel',
        updatedSchedule.name,
        null // no raw data since this is generated
      );
      
      if (result.success && result.scheduleId) {
        console.log('Schedule saved successfully with ID:', result.scheduleId);
        // Navigate to BlockSummarySchedule page with the generated schedule and TimePoints data
        navigate('/block-summary-schedule', { 
          state: { 
            schedule: { 
              ...updatedSchedule, 
              timePointData: timePointData,
              deletedPeriods: deletedPeriods 
            } 
          } 
        });
      } else {
        // If save fails, still navigate but without saved ID
        navigate('/block-summary-schedule', { 
          state: { 
            schedule: { 
              ...updatedSchedule, 
              timePointData: timePointData,
              deletedPeriods: deletedPeriods 
            } 
          } 
        });
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      // Still navigate to show the generated schedule even if save fails
      navigate('/block-summary-schedule', { 
        state: { 
          schedule: { 
            ...updatedSchedule, 
            timePointData: timePointData,
            deletedPeriods: deletedPeriods 
          } 
        } 
      });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
          <Link
            component="button"
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Dashboard
          </Link>
          <Link
            component="button"
            onClick={() => navigate('/drafts')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <DraftIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Draft Schedules
          </Link>
          <Link
            component="button"
            onClick={() => navigate('/timepoints')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <TimelineIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Timepoint Page
          </Link>
          <Typography color="text.primary" variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
            <BusIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Block Configuration
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => navigate('/timepoints')}
          sx={{ mr: 2 }}
        >
          Back to Timepoints
        </Button>
      </Box>

      {/* Header */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          mb: 4, 
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          color: 'white'
        }}
      >
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={8}>
            <Box display="flex" alignItems="center" gap={3}>
              <BusIcon sx={{ fontSize: 48 }} />
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {schedule.name}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  Advanced Schedule Generator
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' }, mt: { xs: 2, md: 0 } }}>
            <Box display="flex" gap={2} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => {
                  localStorage.setItem('busSchedule', JSON.stringify(schedule));
                  alert('Schedule saved!');
                }}
                sx={{ 
                  bgcolor: 'white', 
                  color: theme.palette.primary.main,
                  '&:hover': { bgcolor: 'grey.100' }
                }}
              >
                Save Schedule
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ 
                  borderColor: 'white', 
                  color: 'white',
                  '&:hover': { borderColor: 'grey.200', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Export CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Configuration Content - No Tabs */}
        <Grid container spacing={4}>
          {/* Service Bands Configuration */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  Service Bands & Travel Times
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Configure travel time profiles for different traffic conditions
                </Typography>
                
                <Grid container spacing={3}>
                  {schedule.serviceBands.map((band) => (
                    <Grid item xs={12} key={band.name}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          border: `2px solid ${band.color}40`,
                          backgroundColor: `${band.color}08`
                        }}
                      >
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Box 
                              sx={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: '50%', 
                                backgroundColor: band.color 
                              }} 
                            />
                            <Typography variant="h6" fontWeight="bold">
                              {band.name}
                            </Typography>
                            <Chip 
                              label={`${band.totalMinutes} min total`} 
                              size="small" 
                              color="primary" 
                            />
                          </Box>
                          <Grid container spacing={2}>
                            {band.segmentTimes.map((segment, idx) => (
                              <Grid item xs={6} sm={4} md={2} key={idx}>
                                <TextField
                                  label={`Segment ${idx + 1}`}
                                  type="number"
                                  size="small"
                                  value={segment.travelMinutes}
                                  onChange={(e) => {
                                    const newBands = [...schedule.serviceBands];
                                    const bandIndex = newBands.findIndex(b => b.name === band.name);
                                    newBands[bandIndex].segmentTimes[idx].travelMinutes = parseInt(e.target.value) || 0;
                                    newBands[bandIndex].totalMinutes = newBands[bandIndex].segmentTimes.reduce(
                                      (sum, seg) => sum + seg.travelMinutes, 0
                                    );
                                    setSchedule(prev => ({
                                      ...prev,
                                      serviceBands: newBands,
                                      updatedAt: new Date().toISOString()
                                    }));
                                  }}
                                  inputProps={{ min: 1, max: 60 }}
                                  helperText={`${segment.from?.replace('_', ' ') || 'Unknown'} → ${segment.to?.replace('_', ' ') || 'Unknown'}`}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Block Configuration */}
          <Grid item xs={12}>
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
                    <Grid item xs={12} sm={6} md={4} lg={3}>
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
                    <Grid item xs={12} sm={6} md={8} lg={9}>
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
                    <Grid item xs={12} sm={6} md={4} lg={3}>
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
                    <Grid item xs={12} sm={6} md={8} lg={9}>
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
                              <Grid item xs={6}>
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
                              
                              <Grid item xs={6}>
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
                          endTime: '22:00'
                        });
                        setSchedule(prev => ({
                          ...prev,
                          blockConfigurations: newConfigs,
                          updatedAt: new Date().toISOString()
                        }));
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
    </Container>
  );
}
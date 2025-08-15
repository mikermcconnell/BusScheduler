import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  useTheme,
  Breadcrumbs,
  Link,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Switch,
  FormControlLabel
} from '@mui/material';

// ==================== TYPE DEFINITIONS ====================
interface TimePoint {
  id: string;
  name: string;
  sequence: number;
}

interface SegmentTime {
  fromPointId: string;
  toPointId: string;
  travelMinutes: number;
}

interface ServiceBand {
  name: 'Fastest' | 'Fast' | 'Standard' | 'Slow' | 'Slowest';
  totalMinutes: number;
  segmentTimes: SegmentTime[];
  color: string;
}

interface TimePeriod {
  startTime: string; // "07:00"
  endTime: string;   // "07:30"
  serviceBand: ServiceBand['name'];
}

interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

interface Trip {
  tripNumber: number;
  blockNumber: number;
  departureTime: string;
  arrivalTimes: { [timePointId: string]: string };
  departureTimes: { [timePointId: string]: string }; // New field for departure times
  recoveryTimes: { [timePointId: string]: number }; // Recovery time at each time point
  serviceBand: ServiceBand['name'];
  recoveryMinutes: number; // Keep for backward compatibility
}

interface Schedule {
  id: string;
  name: string;
  timePoints: TimePoint[];
  serviceBands: ServiceBand[];
  timePeriods: TimePeriod[];
  blockConfigurations: BlockConfiguration[];
  firstTripTime: string;
  lastTripTime: string;
  defaultRecoveryMinutes: number;
  cycleTimeMinutes: number;
  automateBlockStartTimes: boolean;
  trips: Trip[];
  createdAt: string;
  updatedAt: string;
}

// ==================== UTILITY FUNCTIONS ====================
const timeToMinutes = (time: string): number => {
  // Handle undefined, null, or empty strings
  if (!time || typeof time !== 'string') {
    return 0;
  }
  
  // Handle cases where time doesn't contain a colon
  if (!time.includes(':')) {
    return 0;
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  
  // Handle cases where parsing results in NaN
  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }
  
  // Bounds checking
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.warn('Invalid time values:', { hours, minutes, time });
    return 0;
  }
  
  const totalMinutes = hours * 60 + minutes;
  
  // Safety check for reasonable values (0 to 24 hours)
  if (totalMinutes < 0 || totalMinutes > 1440) {
    console.warn('Time calculation out of bounds:', { totalMinutes, time });
    return Math.max(0, Math.min(1440, totalMinutes));
  }
  
  return totalMinutes;
};

const minutesToTime = (minutes: number): string => {
  // Handle invalid inputs
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    console.warn('Invalid minutes value:', minutes);
    return '00:00';
  }
  
  // Bounds checking - clamp to reasonable values
  const safeMinutes = Math.max(0, Math.min(1440, Math.floor(minutes)));
  
  const hours = Math.floor(safeMinutes / 60) % 24;
  const mins = safeMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const addMinutesToTime = (time: string, minutesToAdd: number): string => {
  // Validate inputs
  if (!time || typeof minutesToAdd !== 'number' || isNaN(minutesToAdd)) {
    console.warn('Invalid inputs to addMinutesToTime:', { time, minutesToAdd });
    return time || '00:00';
  }
  
  const baseMinutes = timeToMinutes(time);
  const newMinutes = baseMinutes + minutesToAdd;
  
  return minutesToTime(newMinutes);
};

// Helper function to safely get time values with defaults
const getTimeWithDefault = (time: string | undefined, defaultTime: string = '07:00'): string => {
  return time && typeof time === 'string' && time.includes(':') ? time : defaultTime;
};

const calculateAutomatedStartTime = (blockIndex: number, firstBlockStartTime: string, frequencyMinutes: number): string => {
  if (blockIndex === 0) {
    return firstBlockStartTime; // Block 1 is always user input
  }
  const firstBlockMinutes = timeToMinutes(firstBlockStartTime);
  const automatedMinutes = firstBlockMinutes + (blockIndex * frequencyMinutes);
  return minutesToTime(automatedMinutes);
};

// ==================== DEFAULT DATA ====================
const DEFAULT_TIME_POINTS: TimePoint[] = [
  { id: 'downtown', name: 'Downtown Terminal', sequence: 1 },
  { id: 'johnson', name: 'Johnson at Napier', sequence: 2 },
  { id: 'rvh', name: 'RVH Entrance', sequence: 3 },
  { id: 'georgian', name: 'Georgian College', sequence: 4 },
  { id: 'mall', name: 'Georgian Mall', sequence: 5 },
  { id: 'bayfield', name: 'Bayfield Mall', sequence: 6 },
  { id: 'downtown_return', name: 'Downtown Terminal', sequence: 7 }
];

const DEFAULT_SERVICE_BANDS: ServiceBand[] = [
  {
    name: 'Fastest',
    totalMinutes: 35,
    color: '#10b981',
    segmentTimes: [
      { fromPointId: 'downtown', toPointId: 'johnson', travelMinutes: 8 },
      { fromPointId: 'johnson', toPointId: 'rvh', travelMinutes: 7 },
      { fromPointId: 'rvh', toPointId: 'georgian', travelMinutes: 2 },
      { fromPointId: 'georgian', toPointId: 'mall', travelMinutes: 10 },
      { fromPointId: 'mall', toPointId: 'bayfield', travelMinutes: 3 },
      { fromPointId: 'bayfield', toPointId: 'downtown_return', travelMinutes: 5 }
    ]
  },
  {
    name: 'Fast',
    totalMinutes: 38,
    color: '#22c55e',
    segmentTimes: [
      { fromPointId: 'downtown', toPointId: 'johnson', travelMinutes: 8 },
      { fromPointId: 'johnson', toPointId: 'rvh', travelMinutes: 7 },
      { fromPointId: 'rvh', toPointId: 'georgian', travelMinutes: 2 },
      { fromPointId: 'georgian', toPointId: 'mall', travelMinutes: 11 },
      { fromPointId: 'mall', toPointId: 'bayfield', travelMinutes: 4 },
      { fromPointId: 'bayfield', toPointId: 'downtown_return', travelMinutes: 5 }
    ]
  },
  {
    name: 'Standard',
    totalMinutes: 39,
    color: '#eab308',
    segmentTimes: [
      { fromPointId: 'downtown', toPointId: 'johnson', travelMinutes: 8 },
      { fromPointId: 'johnson', toPointId: 'rvh', travelMinutes: 7 },
      { fromPointId: 'rvh', toPointId: 'georgian', travelMinutes: 2 },
      { fromPointId: 'georgian', toPointId: 'mall', travelMinutes: 11 },
      { fromPointId: 'mall', toPointId: 'bayfield', travelMinutes: 5 },
      { fromPointId: 'bayfield', toPointId: 'downtown_return', travelMinutes: 6 }
    ]
  },
  {
    name: 'Slow',
    totalMinutes: 40,
    color: '#f97316',
    segmentTimes: [
      { fromPointId: 'downtown', toPointId: 'johnson', travelMinutes: 8 },
      { fromPointId: 'johnson', toPointId: 'rvh', travelMinutes: 8 },
      { fromPointId: 'rvh', toPointId: 'georgian', travelMinutes: 2 },
      { fromPointId: 'georgian', toPointId: 'mall', travelMinutes: 12 },
      { fromPointId: 'mall', toPointId: 'bayfield', travelMinutes: 5 },
      { fromPointId: 'bayfield', toPointId: 'downtown_return', travelMinutes: 5 }
    ]
  },
  {
    name: 'Slowest',
    totalMinutes: 42,
    color: '#ef4444',
    segmentTimes: [
      { fromPointId: 'downtown', toPointId: 'johnson', travelMinutes: 9 },
      { fromPointId: 'johnson', toPointId: 'rvh', travelMinutes: 8 },
      { fromPointId: 'rvh', toPointId: 'georgian', travelMinutes: 2 },
      { fromPointId: 'georgian', toPointId: 'mall', travelMinutes: 12 },
      { fromPointId: 'mall', toPointId: 'bayfield', travelMinutes: 6 },
      { fromPointId: 'bayfield', toPointId: 'downtown_return', travelMinutes: 6 }
    ]
  }
];

// ==================== MAIN COMPONENT ====================
export default function BlockConfiguration() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<number>(0);
  
  // Click and drag scrolling state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenTableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  
  // Full screen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [schedule, setSchedule] = useState<Schedule>(() => {
    const saved = localStorage.getItem('busSchedule');
    if (saved) {
      const parsedSchedule = JSON.parse(saved);
      
      // Migrate existing trips to include new fields if they don't exist
      if (parsedSchedule.trips) {
        parsedSchedule.trips = parsedSchedule.trips.map((trip: any) => ({
          ...trip,
          departureTimes: trip.departureTimes || { ...trip.arrivalTimes },
          recoveryTimes: trip.recoveryTimes || (
            parsedSchedule.timePoints?.reduce((acc: any, tp: any) => {
              acc[tp.id] = 0;
              return acc;
            }, {}) || {}
          )
        }));
      }
      
      // Migrate from old frequencyPeriods to new blockConfigurations
      if (parsedSchedule.frequencyPeriods && !parsedSchedule.blockConfigurations) {
        parsedSchedule.blockConfigurations = [
          { blockNumber: 1, startTime: '07:00', endTime: '22:00' },
          { blockNumber: 2, startTime: '07:30', endTime: '22:30' },
          { blockNumber: 3, startTime: '08:00', endTime: '23:00' }
        ];
        delete parsedSchedule.frequencyPeriods;
      }
      
      // Ensure all block configurations have valid time values
      if (parsedSchedule.blockConfigurations) {
        parsedSchedule.blockConfigurations = parsedSchedule.blockConfigurations.map((block: any) => ({
          ...block,
          startTime: getTimeWithDefault(block.startTime, '07:00'),
          endTime: getTimeWithDefault(block.endTime, '22:00')
        }));
      }
      
      // Set default for automateBlockStartTimes if it doesn't exist
      if (parsedSchedule.automateBlockStartTimes === undefined) {
        parsedSchedule.automateBlockStartTimes = true;
      }
      
      // Set default for cycleTimeMinutes if it doesn't exist
      if (parsedSchedule.cycleTimeMinutes === undefined) {
        parsedSchedule.cycleTimeMinutes = 60;
      }
      
      return parsedSchedule;
    }
    
    return {
      id: 'schedule-1',
      name: 'Route 101 - Blue',
      timePoints: DEFAULT_TIME_POINTS,
      serviceBands: DEFAULT_SERVICE_BANDS,
      timePeriods: [],
      blockConfigurations: [
        { blockNumber: 1, startTime: '07:00', endTime: '22:00' },
        { blockNumber: 2, startTime: '07:30', endTime: '22:30' },
        { blockNumber: 3, startTime: '08:00', endTime: '23:00' }
      ],
      firstTripTime: '07:00',
      lastTripTime: '22:00',
      defaultRecoveryMinutes: 5,
      cycleTimeMinutes: 60,
      automateBlockStartTimes: true,
      trips: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  // Save to localStorage whenever schedule changes
  useEffect(() => {
    localStorage.setItem('busSchedule', JSON.stringify(schedule));
  }, [schedule]);

  // Click and drag scrolling handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, isFullscreenTable = false) => {
    const container = isFullscreenTable ? fullscreenTableContainerRef.current : tableContainerRef.current;
    if (!container) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({
      left: container.scrollLeft,
      top: container.scrollTop
    });
    
    // Prevent text selection during drag
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent, isFullscreenTable = false) => {
    const container = isFullscreenTable ? fullscreenTableContainerRef.current : tableContainerRef.current;
    if (!isDragging || !container) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    container.scrollLeft = scrollStart.left - deltaX;
    container.scrollTop = scrollStart.top - deltaY;
  }, [isDragging, dragStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Optimized recovery time handler with debouncing
  const handleRecoveryTimeChange = useCallback((tripIdx: number, timepointId: string, newValue: string) => {
    const newRecoveryMinutes = parseInt(newValue) || 0;
    
    setSchedule(prevSchedule => {
      const newTrips = [...prevSchedule.trips];
      
      // Initialize recoveryTimes if it doesn't exist
      if (!newTrips[tripIdx].recoveryTimes) {
        newTrips[tripIdx].recoveryTimes = {};
      }
      
      newTrips[tripIdx].recoveryTimes[timepointId] = newRecoveryMinutes;
      
      // Update departure times for this time point
      if (!newTrips[tripIdx].departureTimes) {
        newTrips[tripIdx].departureTimes = { ...newTrips[tripIdx].arrivalTimes };
      }
      
      const arrivalTime = newTrips[tripIdx].arrivalTimes[timepointId];
      if (arrivalTime) {
        newTrips[tripIdx].departureTimes[timepointId] = newRecoveryMinutes > 0
          ? addMinutesToTime(getTimeWithDefault(arrivalTime), newRecoveryMinutes)
          : getTimeWithDefault(arrivalTime);
      }
      
      return {
        ...prevSchedule,
        trips: newTrips,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  // Memoized sorted trips by departure time
  const sortedTrips = useMemo(() => {
    console.log('BlockConfiguration: Sorting trips by departure time');
    const sorted = [...schedule.trips].sort((a, b) => {
      // Get first timepoint departure time for each trip
      const firstTimePointId = schedule.timePoints[0]?.id;
      const timeA = firstTimePointId ? (a.departureTimes?.[firstTimePointId] || a.departureTime) : a.departureTime;
      const timeB = firstTimePointId ? (b.departureTimes?.[firstTimePointId] || b.departureTime) : b.departureTime;
      return timeA.localeCompare(timeB);
    });
    
    console.log('BlockConfiguration: First 5 sorted trips:', sorted.slice(0, 5).map(t => ({ 
      trip: t.tripNumber, 
      block: t.blockNumber, 
      time: t.departureTime 
    })));
    return sorted;
  }, [schedule.trips, schedule.timePoints]);

  // Memoized trip row component for better performance
  const TripRow = memo(({ trip, idx, isNewBlock, theme }: any) => {
    const serviceBand = schedule.serviceBands.find(sb => sb.name === trip.serviceBand);
    
    return (
      <TableRow 
        key={trip.tripNumber} 
        sx={{
          borderTop: isNewBlock ? `2px solid ${theme.palette.primary.main}` : 'none',
          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' }
        }}
      >
        <TableCell sx={{ 
          padding: '4px 2px',
          fontSize: '0.8rem',
          width: '60px',
          textAlign: 'center'
        }}>
          {isNewBlock && (
            <Chip
              label={`Block ${trip.blockNumber}`}
              color="primary"
              size="small"
            />
          )}
        </TableCell>
        <TableCell sx={{ 
          padding: '4px 2px',
          fontSize: '0.8rem',
          width: '60px',
          textAlign: 'center'
        }}>{trip.tripNumber}</TableCell>
        <TableCell sx={{ 
          padding: '4px 2px',
          width: '80px',
          textAlign: 'center'
        }}>
          <Chip
            label={trip.serviceBand}
            size="small"
            sx={{
              backgroundColor: serviceBand?.color || '#6b7280',
              color: 'white',
              fontSize: '0.6rem'
            }}
          />
        </TableCell>
        {schedule.timePoints.map(tp => {
          const arrivalTime = trip.arrivalTimes[tp.id] || '-';
          const recoveryMinutes = trip.recoveryTimes?.[tp.id] || 0;
          const departureTime = arrivalTime !== '-' && recoveryMinutes > 0 
            ? addMinutesToTime(getTimeWithDefault(arrivalTime), recoveryMinutes)
            : arrivalTime;
          
          const timepointTotalWidth = `calc((100% - 200px) / ${schedule.timePoints.length})`;
          const arriveWidth = `calc(${timepointTotalWidth} * 0.4)`;
          const recoveryWidth = `calc(${timepointTotalWidth} * 0.2)`;
          const departWidth = `calc(${timepointTotalWidth} * 0.4)`;
          
          return (
            <React.Fragment key={tp.id}>
              <TableCell sx={{ 
                fontFamily: 'monospace', 
                textAlign: 'center',
                padding: '4px 2px',
                fontSize: '0.75rem',
                width: arriveWidth
              }}>
                {arrivalTime}
              </TableCell>
              
              <TableCell sx={{ 
                width: recoveryWidth,
                padding: '1px'
              }}>
                <TextField
                  size="small"
                  type="number"
                  value={recoveryMinutes}
                  onChange={(e) => handleRecoveryTimeChange(idx, tp.id, e.target.value)}
                  inputProps={{ 
                    min: 0, 
                    max: 60,
                    style: { textAlign: 'center', fontSize: '0.65rem' }
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      height: '26px',
                      width: '100%',
                      fontSize: '0.65rem',
                      '& input': { padding: '2px 4px', fontSize: '0.65rem' }
                    }
                  }}
                />
              </TableCell>
              
              <TableCell sx={{ 
                fontFamily: 'monospace', 
                textAlign: 'center',
                padding: '4px 2px',
                fontSize: '0.75rem',
                width: departWidth,
                color: recoveryMinutes > 0 ? 'primary.main' : 'inherit',
                fontWeight: recoveryMinutes > 0 ? 'bold' : 'normal'
              }}>
                {departureTime}
              </TableCell>
            </React.Fragment>
          );
        })}
      </TableRow>
    );
  });

  // Generate time periods for service band mapping based on travel time data
  const generateTimePeriods = () => {
    const periods: TimePeriod[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let half = 0; half < 2; half++) {
        const startMinutes = hour * 60 + half * 30;
        const endMinutes = startMinutes + 30;
        
        // Dynamically determine service band based on traffic patterns and travel time data
        let serviceBand: ServiceBand['name'] = 'Standard';
        
        // Early morning (6:00-7:00): Light traffic - Fastest
        if (hour >= 6 && hour < 7) serviceBand = 'Fastest';
        // Morning rush (7:00-9:00): Heavy traffic - Slowest/Slow
        else if (hour >= 7 && hour < 8) serviceBand = 'Slowest';
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
          
          // Early morning (6:00-7:00): Light traffic - Fastest
          if (hour >= 6 && hour < 7) serviceBand = 'Fastest';
          // Morning rush (7:00-9:00): Heavy traffic - Slowest/Slow
          else if (hour >= 7 && hour < 8) serviceBand = 'Slowest';
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
          getTimeWithDefault(schedule.blockConfigurations[0]?.startTime, '07:00'),
          frequencyMinutes
        );
      } else {
        blockStartTime = getTimeWithDefault(blockConfig.startTime, '07:00');
      }
      
      const blockStartMinutes = Math.max(timeToMinutes(blockStartTime), firstMinutes);
      let currentDepartureTime = blockStartMinutes;
      
      // Safety counters for this block
      let blockTripCount = 0;
      let loopIterations = 0;
      
      // Generate trips for this block until we exceed service hours
      while (currentDepartureTime <= lastMinutes && 
             blockTripCount < MAX_TRIPS_PER_BLOCK && 
             trips.length < MAX_TOTAL_TRIPS &&
             loopIterations < MAX_LOOP_ITERATIONS) {
        
        loopIterations++;
        const departureTime = minutesToTime(currentDepartureTime);
        
        // Find which service band applies to this departure time
        const timePeriod = currentTimePeriods.find(tp => {
          const startMin = timeToMinutes(tp.startTime);
          const endMin = timeToMinutes(tp.endTime);
          return currentDepartureTime >= startMin && currentDepartureTime < endMin;
        });
        
        const serviceBandName = timePeriod?.serviceBand || 'Standard';
        const serviceBand = schedule.serviceBands.find(sb => sb.name === serviceBandName);
        
        if (!serviceBand) {
          currentDepartureTime += schedule.cycleTimeMinutes;
          continue;
        }
        
        // Calculate arrival times at each time point
        const arrivalTimes: { [timePointId: string]: string } = {};
        let currentTime = currentDepartureTime;
        
        arrivalTimes[schedule.timePoints[0].id] = departureTime;
        
        for (let i = 0; i < serviceBand.segmentTimes.length; i++) {
          const segment = serviceBand.segmentTimes[i];
          currentTime += segment.travelMinutes;
          arrivalTimes[segment.toPointId] = minutesToTime(currentTime);
        }
        
        // Calculate trip duration
        const tripDurationMinutes = serviceBand.totalMinutes;
        
        // Use the configured cycle time
        const cycleTimeMinutes = schedule.cycleTimeMinutes;
        const extraTimeMinutes = Math.max(0, cycleTimeMinutes - tripDurationMinutes);
        
        // Initialize departure times (same as arrival times initially)
        const departureTimes: { [timePointId: string]: string } = { ...arrivalTimes };
        
        // Initialize recovery times (0 for all time points initially)
        const recoveryTimes: { [timePointId: string]: number } = {};
        schedule.timePoints.forEach(tp => {
          recoveryTimes[tp.id] = 0;
        });
        
        // Add extra time to last timepoint recovery
        const lastTimePoint = schedule.timePoints[schedule.timePoints.length - 1];
        if (extraTimeMinutes > 0 && lastTimePoint) {
          recoveryTimes[lastTimePoint.id] = extraTimeMinutes;
          const lastArrivalTime = arrivalTimes[lastTimePoint.id];
          if (lastArrivalTime) {
            departureTimes[lastTimePoint.id] = addMinutesToTime(
              getTimeWithDefault(lastArrivalTime), 
              extraTimeMinutes
            );
          }
        }

        trips.push({
          tripNumber,
          blockNumber: blockConfig.blockNumber,
          departureTime,
          arrivalTimes,
          departureTimes,
          recoveryTimes,
          serviceBand: serviceBandName,
          recoveryMinutes: schedule.defaultRecoveryMinutes
        });
        
        // Next trip in this block starts based on cycle time
        currentDepartureTime += cycleTimeMinutes;
        tripNumber++;
        blockTripCount++;
        
        // Safety check: ensure we're making progress
        if (cycleTimeMinutes <= 0) {
          console.error('Cycle time is invalid during trip generation:', cycleTimeMinutes);
          break; // Exit the while loop to prevent infinite loop
        }
      }
      
      // Log if we hit any safety limits
      if (blockTripCount >= MAX_TRIPS_PER_BLOCK) {
        console.warn(`Block ${blockConfig.blockNumber} hit maximum trip limit (${MAX_TRIPS_PER_BLOCK})`);
      }
      if (loopIterations >= MAX_LOOP_ITERATIONS) {
        console.warn(`Block ${blockConfig.blockNumber} hit maximum loop iterations (${MAX_LOOP_ITERATIONS})`);
      }
    }
    
    // Log if we hit overall safety limits
    if (trips.length >= MAX_TOTAL_TRIPS) {
      console.warn(`Hit maximum total trips limit (${MAX_TOTAL_TRIPS})`);
    }
    
    console.log(`Generated ${trips.length} trips`);
    
    const updatedSchedule = {
      ...schedule,
      trips,
      timePeriods: currentTimePeriods,
      updatedAt: new Date().toISOString()
    };
    
    console.log('Updated schedule:', updatedSchedule);
    setSchedule(updatedSchedule);
    
    // Save to schedule storage and navigate to summary page
    try {
      // Convert trips to schedule matrix format
      const scheduleMatrix: string[][] = updatedSchedule.trips.map(trip => {
        return updatedSchedule.timePoints.map(tp => trip.arrivalTimes[tp.id] || '-');
      });
      
      const summaryScheduleData: SummarySchedule = {
        routeId: `route-${Date.now()}`,
        routeName: updatedSchedule.name,
        direction: 'Outbound',
        timePoints: updatedSchedule.timePoints.map(tp => ({
          id: tp.id,
          name: tp.name,
          sequence: tp.sequence
        })),
        weekday: scheduleMatrix,
        saturday: [], // empty for now
        sunday: [], // empty for now
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
        // Stay on the Block Configuration page to show the generated schedule
        console.log('Schedule saved successfully with ID:', result.scheduleId);
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      // Still show the generated schedule in current tab even if save fails
    }
  };

  // Export schedule to CSV (using sorted trips)
  const exportSchedule = () => {
    const headers = ['Block', 'Trip', 'Service Band', ...schedule.timePoints.map(tp => tp.name)].join(',');
    const rows = sortedTrips.map(trip => {
      const times = schedule.timePoints.map(tp => trip.arrivalTimes[tp.id] || '-').join(',');
      return `${trip.blockNumber},${trip.tripNumber},${trip.serviceBand},${times}`;
    });
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Calculate block statistics
  const blockStats = useMemo(() => {
    const blocks = new Map<number, Trip[]>();
    schedule.trips.forEach(trip => {
      if (!blocks.has(trip.blockNumber)) {
        blocks.set(trip.blockNumber, []);
      }
      blocks.get(trip.blockNumber)!.push(trip);
    });
    
    return Array.from(blocks.entries()).map(([blockNum, trips]) => {
      const firstTrip = trips[0];
      const lastTrip = trips[trips.length - 1];
      const lastArrival = Object.values(lastTrip.arrivalTimes).pop() || lastTrip.departureTime || '07:00';
      const endTime = addMinutesToTime(lastArrival, lastTrip.recoveryMinutes || 0);
      
      const startMinutes = timeToMinutes(getTimeWithDefault(firstTrip.departureTime));
      const endMinutes = timeToMinutes(getTimeWithDefault(endTime));
      const duration = Math.max(0, endMinutes - startMinutes);
      
      return {
        blockNumber: blockNum,
        tripCount: trips.length,
        startTime: getTimeWithDefault(firstTrip.departureTime),
        endTime,
        duration: `${Math.floor(duration / 60)}h ${duration % 60}m`
      };
    });
  }, [schedule.trips]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Dashboard
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/drafts')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <DraftIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Draft Schedules
          </Link>
          <Link
            component="button"
            variant="body2"
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
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportSchedule}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
              >
                Export CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Configuration Content */}
      <Paper elevation={2} sx={{ mb: 4 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600
            }
          }}
        >
          <Tab icon={<SettingsIcon />} label="Configuration" />
          <Tab icon={<CalendarIcon />} label="Schedule" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
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
                                  InputProps={{ endAdornment: 'min' }}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                
                <Box mt={3}>
                  <Button
                    variant="contained"
                    onClick={generateTimePeriods}
                    startIcon={<SettingsIcon />}
                  >
                    Generate Time Period Mapping
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Block Configurations */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  Bus Block Configurations
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Configure each bus block with start time and end time. Frequency is set globally below.
                </Typography>
                
                {/* Number of Buses Control */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Number of Buses"
                        type="number"
                        value={schedule.blockConfigurations.length}
                        onChange={(e) => {
                          const newCount = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                          const currentCount = schedule.blockConfigurations.length;
                          
                          if (newCount > currentCount) {
                            // Add new blocks
                            const newConfigs = [...schedule.blockConfigurations];
                            for (let i = currentCount; i < newCount; i++) {
                              newConfigs.push({
                                blockNumber: i + 1,
                                startTime: '07:00',
                                endTime: '22:00'
                              });
                            }
                            setSchedule(prev => ({
                              ...prev,
                              blockConfigurations: newConfigs,
                              updatedAt: new Date().toISOString()
                            }));
                          } else if (newCount < currentCount) {
                            // Remove blocks
                            const newConfigs = schedule.blockConfigurations.slice(0, newCount);
                            setSchedule(prev => ({
                              ...prev,
                              blockConfigurations: newConfigs,
                              updatedAt: new Date().toISOString()
                            }));
                          }
                        }}
                        inputProps={{ min: 1, max: 10 }}
                        helperText="Number of bus blocks (1-10)"
                        sx={{ backgroundColor: 'white', borderRadius: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={8}>
                      <Typography variant="body2" color="text.secondary">
                        This controls how many bus blocks are configured for the schedule. Each block represents a separate bus with its own timing pattern.
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
                
                {/* Cycle Time Control */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Cycle Time (minutes)"
                        type="number"
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
                        helperText="Complete cycle time in minutes"
                        sx={{ backgroundColor: 'white', borderRadius: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={8}>
                      <Typography variant="body2" color="text.secondary">
                        This sets the complete cycle time from departure to return. All buses will follow this cycle pattern.
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>

                {/* Frequency Display */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'success.light', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: 'success.dark' }}>
                    Service Frequency: {Math.round((schedule.cycleTimeMinutes / schedule.blockConfigurations.length) * 10) / 10} minutes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    A bus arrives every {Math.round((schedule.cycleTimeMinutes / schedule.blockConfigurations.length) * 10) / 10} minutes (Cycle Time ÷ Number of Buses)
                  </Typography>
                </Box>

                {/* Automate Block Start Times Toggle */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'info.light', borderRadius: 2 }}>
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
                        <Typography variant="h6" fontWeight="bold">
                          Automate Block Start Times
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          When enabled, blocks automatically start at frequency intervals (Block 1: user input, Block 2: Block 1 + frequency, Block 3: Block 2 + frequency, etc.)
                        </Typography>
                      </Box>
                    }
                    sx={{ margin: 0, width: '100%' }}
                  />
                </Box>

                {/* Duolingo-style Block Configuration Cards */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', mt: 2 }}>
                  {schedule.blockConfigurations.map((blockConfig, idx) => {
                    // Duolingo-style color palette
                    const colors = [
                      { primary: '#58cc02', secondary: '#89e219', shadow: '#46a302' }, // Green
                      { primary: '#ff9600', secondary: '#ffc200', shadow: '#cc7700' }, // Orange
                      { primary: '#ce82ff', secondary: '#e4b3ff', shadow: '#a766cc' }, // Purple
                      { primary: '#1cb0f6', secondary: '#58d5ff', shadow: '#0f8cc9' }, // Blue
                      { primary: '#ff4b4b', secondary: '#ff7a7a', shadow: '#cc3333' }  // Red
                    ];
                    const colorScheme = colors[idx % colors.length];
                    
                    return (
                      <Box
                        key={idx}
                        sx={{
                          position: 'relative',
                          width: { xs: '100%', sm: '280px', md: '300px' },
                          height: '180px',
                          borderRadius: '20px',
                          background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%)`,
                          boxShadow: `0 8px 0 ${colorScheme.shadow}, 0 12px 20px rgba(0,0,0,0.15)`,
                          transform: 'translateY(0)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 10px 0 ${colorScheme.shadow}, 0 16px 25px rgba(0,0,0,0.2)`,
                          },
                          '&:active': {
                            transform: 'translateY(2px)',
                            boxShadow: `0 4px 0 ${colorScheme.shadow}, 0 8px 15px rgba(0,0,0,0.1)`,
                          }
                        }}
                      >
                        {/* Decorative Elements */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -10,
                            right: -10,
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            transform: 'rotate(45deg)'
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -5,
                            left: -5,
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.15)'
                          }}
                        />
                        
                        {/* Content */}
                        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
                          {/* Header with Bus Icon */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: '50%',
                                  backgroundColor: 'rgba(255,255,255,0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}
                              >
                                <BusIcon sx={{ color: 'white', fontSize: 28 }} />
                              </Box>
                              <Typography 
                                variant="h5" 
                                fontWeight="900" 
                                sx={{ 
                                  color: 'white',
                                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                  fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                              >
                                Block {blockConfig.blockNumber}
                              </Typography>
                            </Box>
                            
                            {/* Remove Button */}
                            {schedule.blockConfigurations.length > 1 && (
                              <IconButton
                                onClick={() => {
                                  const newConfigs = schedule.blockConfigurations.filter((_, i) => i !== idx);
                                  setSchedule(prev => ({
                                    ...prev,
                                    blockConfigurations: newConfigs,
                                    updatedAt: new Date().toISOString()
                                  }));
                                }}
                                sx={{
                                  color: 'white',
                                  backgroundColor: 'rgba(255,255,255,0.2)',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.3)',
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s ease'
                                }}
                                size="small"
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                          
                          {/* Time Controls in Pill Style */}
                          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'rgba(255,255,255,0.9)', 
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  fontSize: '0.7rem',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                Start {schedule.automateBlockStartTimes && idx > 0 && '(Auto)'}
                              </Typography>
                              <TextField
                                fullWidth
                                type="time"
                                size="small"
                                value={
                                  schedule.automateBlockStartTimes && idx > 0
                                    ? calculateAutomatedStartTime(
                                        idx,
                                        schedule.blockConfigurations[0]?.startTime || '07:00',
                                        Math.round(schedule.cycleTimeMinutes / schedule.blockConfigurations.length)
                                      )
                                    : blockConfig.startTime
                                }
                                disabled={schedule.automateBlockStartTimes && idx > 0}
                                onChange={(e) => {
                                  const newConfigs = [...schedule.blockConfigurations];
                                  newConfigs[idx].startTime = e.target.value;
                                  setSchedule(prev => ({
                                    ...prev,
                                    blockConfigurations: newConfigs,
                                    updatedAt: new Date().toISOString()
                                  }));
                                }}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: schedule.automateBlockStartTimes && idx > 0 
                                      ? 'rgba(200,200,200,0.5)' 
                                      : 'rgba(255,255,255,0.95)',
                                    borderRadius: '15px',
                                    border: 'none',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    fontWeight: 'bold',
                                    '& fieldset': {
                                      border: 'none'
                                    },
                                    '&:hover': {
                                      backgroundColor: 'white',
                                      transform: 'scale(1.02)'
                                    },
                                    '&.Mui-focused': {
                                      backgroundColor: 'white',
                                      transform: 'scale(1.02)',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }
                                  },
                                  '& input': {
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    color: '#2d3748'
                                  }
                                }}
                              />
                            </Box>
                            
                            <Box sx={{ flex: 1 }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'rgba(255,255,255,0.9)', 
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  fontSize: '0.7rem',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                End
                              </Typography>
                              <TextField
                                fullWidth
                                type="time"
                                size="small"
                                value={blockConfig.endTime}
                                onChange={(e) => {
                                  const newConfigs = [...schedule.blockConfigurations];
                                  newConfigs[idx].endTime = e.target.value;
                                  setSchedule(prev => ({
                                    ...prev,
                                    blockConfigurations: newConfigs,
                                    updatedAt: new Date().toISOString()
                                  }));
                                }}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    borderRadius: '15px',
                                    border: 'none',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    fontWeight: 'bold',
                                    '& fieldset': {
                                      border: 'none'
                                    },
                                    '&:hover': {
                                      backgroundColor: 'white',
                                      transform: 'scale(1.02)'
                                    },
                                    '&.Mui-focused': {
                                      backgroundColor: 'white',
                                      transform: 'scale(1.02)',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }
                                  },
                                  '& input': {
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    color: '#2d3748'
                                  }
                                }}
                              />
                            </Box>
                          </Box>
                          
                          {/* Duration Display */}
                          <Box 
                            sx={{ 
                              mt: 'auto',
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              borderRadius: '12px',
                              px: 2,
                              py: 1,
                              textAlign: 'center'
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem'
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
                                return `${hours}h ${minutes}m duration`;
                              })()}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                  
                  {/* Add New Block Button - Duolingo Style */}
                  {schedule.blockConfigurations.length < 10 && (
                    <Box
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
                      sx={{
                        width: { xs: '100%', sm: '280px', md: '300px' },
                        height: '180px',
                        borderRadius: '20px',
                        border: '3px dashed #e2e8f0',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: '#f1f5f9',
                          borderColor: '#cbd5e1',
                          transform: 'scale(1.02)'
                        }
                      }}
                    >
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          backgroundColor: '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 2,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Typography variant="h3" sx={{ color: '#94a3b8', fontWeight: 'light' }}>
                          +
                        </Typography>
                      </Box>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: '#64748b',
                          fontWeight: 'bold',
                          textAlign: 'center'
                        }}
                      >
                        Add Block
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {/* Bus Count Summary */}
                <Box sx={{ mt: 3, mb: 2, p: 2, backgroundColor: 'primary.light', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: 'primary.main' }}>
                    Total Buses: {schedule.blockConfigurations.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {schedule.blockConfigurations.length} bus{schedule.blockConfigurations.length !== 1 ? 'es' : ''} configured with {schedule.cycleTimeMinutes} minute cycle time
                  </Typography>
                </Box>
                
                {/* Generate Schedule Button */}
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={generateTrips}
                    startIcon={<CalendarIcon />}
                    sx={{ 
                      px: 4, 
                      py: 1.5, 
                      fontSize: '1.1rem',
                      borderRadius: 2,
                      boxShadow: 2,
                      '&:hover': {
                        boxShadow: 4
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
      )}

      {/* Schedule Tab */}
      {activeTab === 1 && (
        <Card elevation={2}>
          <CardContent sx={{ p: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" fontWeight="bold">
                Generated Schedule
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Chip 
                  label={`${schedule.trips.length} trips • ${blockStats.length} bus blocks`}
                  color="primary"
                  size="medium"
                />
                <Button
                  variant="outlined"
                  startIcon={<FullscreenIcon />}
                  onClick={() => setIsFullscreen(true)}
                  size="small"
                >
                  Full Screen
                </Button>
              </Box>
            </Box>
            
            <TableContainer 
              component={Paper} 
              variant="outlined"
              ref={tableContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              sx={{ 
                width: '100%', 
                height: '500px',
                overflowX: 'auto',
                overflowY: 'auto',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                position: 'relative'
              }}
            >
              <Table size="small" sx={{ 
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <TableHead sx={{ 
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: 'white'
                }}>
                  <TableRow sx={{ 
                    backgroundColor: 'grey.50',
                    '& .MuiTableCell-root': {
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'grey.50',
                      zIndex: 10
                    }
                  }}>
                    <TableCell rowSpan={2} sx={{ 
                      verticalAlign: 'middle',
                      fontWeight: 'bold',
                      padding: '2px 1px',
                      fontSize: '0.6rem',
                      width: '35px',
                      textAlign: 'center',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'grey.50',
                      zIndex: 10
                    }}>Blk</TableCell>
                    <TableCell rowSpan={2} sx={{ 
                      verticalAlign: 'middle',
                      fontWeight: 'bold',
                      padding: '2px 1px',
                      fontSize: '0.6rem',
                      width: '35px',
                      textAlign: 'center',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'grey.50',
                      zIndex: 10
                    }}>Trip</TableCell>
                    <TableCell rowSpan={2} sx={{ 
                      verticalAlign: 'middle',
                      fontWeight: 'bold',
                      padding: '2px 1px',
                      fontSize: '0.6rem',
                      width: '45px',
                      textAlign: 'center',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'grey.50',
                      zIndex: 10
                    }}>Svc</TableCell>
                    {schedule.timePoints.map(tp => {
                      const availableWidth = `calc((100% - 115px) / ${schedule.timePoints.length})`;
                      return (
                        <TableCell 
                          key={tp.id} 
                          colSpan={3} 
                          align="center"
                          sx={{ 
                            borderBottom: '1px solid #e0e0e0',
                            fontWeight: 'bold',
                            padding: '2px 1px',
                            fontSize: '0.55rem',
                            width: availableWidth,
                            maxWidth: availableWidth,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'grey.50',
                            zIndex: 10
                          }}
                          title={tp.name}
                        >
                          {tp.name.length > 8 ? tp.name.substring(0, 6) + '..' : tp.name}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  <TableRow sx={{ 
                    backgroundColor: 'grey.50',
                    '& .MuiTableCell-root': {
                      position: 'sticky',
                      top: '32px', // Offset by height of first header row
                      backgroundColor: 'grey.50',
                      zIndex: 9
                    }
                  }}>
                    {schedule.timePoints.map(tp => (
                      <React.Fragment key={tp.id}>
                        <TableCell align="center" sx={{ 
                          fontSize: '0.5rem', 
                          color: 'text.secondary',
                          padding: '1px',
                          position: 'sticky',
                          top: '32px',
                          backgroundColor: 'grey.50',
                          zIndex: 9
                        }}>
                          Arr
                        </TableCell>
                        <TableCell align="center" sx={{ 
                          fontSize: '0.5rem', 
                          color: 'text.secondary',
                          padding: '1px',
                          position: 'sticky',
                          top: '32px',
                          backgroundColor: 'grey.50',
                          zIndex: 9
                        }}>
                          Rec
                        </TableCell>
                        <TableCell align="center" sx={{ 
                          fontSize: '0.5rem', 
                          color: 'text.secondary',
                          padding: '1px',
                          position: 'sticky',
                          top: '32px',
                          backgroundColor: 'grey.50',
                          zIndex: 9
                        }}>
                          Dep
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedTrips.map((trip, idx) => {
                    const serviceBand = schedule.serviceBands.find(sb => sb.name === trip.serviceBand);
                    const isNewBlock = idx === 0 || trip.blockNumber !== sortedTrips[idx - 1].blockNumber;
                    
                    return (
                      <TableRow 
                        key={trip.tripNumber} 
                        sx={{
                          borderTop: isNewBlock ? `2px solid ${theme.palette.primary.main}` : 'none',
                          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' }
                        }}
                      >
                        <TableCell sx={{ 
                          padding: '2px 1px',
                          fontSize: '0.6rem',
                          width: '35px',
                          textAlign: 'center'
                        }}>
                          {isNewBlock && (
                            <Typography variant="caption" sx={{ 
                              fontSize: '0.5rem',
                              color: 'primary.main',
                              fontWeight: 'bold'
                            }}>
                              B{trip.blockNumber}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ 
                          padding: '2px 1px',
                          fontSize: '0.6rem',
                          width: '35px',
                          textAlign: 'center'
                        }}>{trip.tripNumber}</TableCell>
                        <TableCell sx={{ 
                          padding: '2px 1px',
                          width: '45px',
                          textAlign: 'center'
                        }}>
                          <Typography variant="caption" sx={{ 
                            fontSize: '0.45rem',
                            color: 'white',
                            backgroundColor: serviceBand?.color || '#6b7280',
                            padding: '1px 2px',
                            borderRadius: '2px',
                            fontWeight: 'bold'
                          }}>
                            {trip.serviceBand.charAt(0)}
                          </Typography>
                        </TableCell>
                        {schedule.timePoints.map(tp => {
                          const arrivalTime = trip.arrivalTimes[tp.id] || '-';
                          const recoveryMinutes = trip.recoveryTimes?.[tp.id] || 0;
                          const departureTime = arrivalTime !== '-' && recoveryMinutes > 0 
                            ? addMinutesToTime(getTimeWithDefault(arrivalTime), recoveryMinutes)
                            : arrivalTime;
                          
                          const availableWidth = `calc((100% - 115px) / ${schedule.timePoints.length * 3})`;
                          
                          return (
                            <React.Fragment key={tp.id}>
                              {/* Arrival Time */}
                              <TableCell sx={{ 
                                fontFamily: 'monospace', 
                                textAlign: 'center',
                                padding: '2px 1px',
                                fontSize: '0.55rem',
                                width: availableWidth
                              }}>
                                {arrivalTime}
                              </TableCell>
                              
                              {/* Recovery Time Input */}
                              <TableCell sx={{ 
                                width: availableWidth,
                                padding: '1px'
                              }}>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={recoveryMinutes}
                                  onChange={(e) => handleRecoveryTimeChange(idx, tp.id, e.target.value)}
                                  inputProps={{ 
                                    min: 0, 
                                    max: 60,
                                    style: { textAlign: 'center', fontSize: '0.5rem' }
                                  }}
                                  sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                      height: '24px',
                                      width: '100%',
                                      fontSize: '0.5rem',
                                      '& input': { padding: '2px 4px', fontSize: '0.5rem' }
                                    }
                                  }}
                                />
                              </TableCell>
                              
                              {/* Departure Time */}
                              <TableCell sx={{ 
                                fontFamily: 'monospace', 
                                textAlign: 'center',
                                padding: '2px 1px',
                                fontSize: '0.55rem',
                                width: availableWidth,
                                color: recoveryMinutes > 0 ? 'primary.main' : 'inherit',
                                fontWeight: recoveryMinutes > 0 ? 'bold' : 'normal'
                              }}>
                                {departureTime}
                              </TableCell>
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Full Screen Schedule Dialog */}
      <Dialog
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '98vw',
            height: '95vh',
            maxWidth: 'none',
            maxHeight: 'none',
            m: 1
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h5" fontWeight="bold">
              Generated Schedule - Full Screen
            </Typography>
            <Chip 
              label={`${schedule.trips.length} trips • ${blockStats.length} bus blocks`}
              color="primary"
              size="medium"
            />
          </Box>
          <IconButton onClick={() => setIsFullscreen(false)} size="large">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 2 }}>
          <TableContainer 
            component={Paper} 
            variant="outlined"
            ref={fullscreenTableContainerRef}
            sx={{ 
              width: '100%', 
              height: 'calc(95vh - 120px)',
              overflowX: 'auto',
              overflowY: 'auto',
              position: 'relative'
            }}
          >
            <Table size="small" sx={{ 
              width: '100%',
              tableLayout: 'fixed'
            }}>
              <TableHead sx={{ 
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'white'
              }}>
                <TableRow sx={{ 
                  backgroundColor: 'grey.50',
                  '& .MuiTableCell-root': {
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'grey.50',
                    zIndex: 10
                  }
                }}>
                  <TableCell rowSpan={2} sx={{ 
                    verticalAlign: 'middle',
                    fontWeight: 'bold',
                    padding: '4px 2px',
                    fontSize: '0.8rem',
                    width: '60px',
                    textAlign: 'center',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'grey.50',
                    zIndex: 10
                  }}>Block</TableCell>
                  <TableCell rowSpan={2} sx={{ 
                    verticalAlign: 'middle',
                    fontWeight: 'bold',
                    padding: '4px 2px',
                    fontSize: '0.8rem',
                    width: '60px',
                    textAlign: 'center',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'grey.50',
                    zIndex: 10
                  }}>Trip</TableCell>
                  <TableCell rowSpan={2} sx={{ 
                    verticalAlign: 'middle',
                    fontWeight: 'bold',
                    padding: '4px 2px',
                    fontSize: '0.8rem',
                    width: '80px',
                    textAlign: 'center',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'grey.50',
                    zIndex: 10
                  }}>Service</TableCell>
                  {schedule.timePoints.map(tp => {
                    // Allocate more space to arrive/depart, less to recovery
                    const timepointTotalWidth = `calc((100% - 200px) / ${schedule.timePoints.length})`;
                    return (
                      <TableCell 
                        key={tp.id} 
                        colSpan={3} 
                        align="center"
                        sx={{ 
                          borderBottom: '1px solid #e0e0e0',
                          fontWeight: 'bold',
                          padding: '4px 2px',
                          fontSize: '0.75rem',
                          width: timepointTotalWidth,
                          maxWidth: timepointTotalWidth,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          top: 0,
                          backgroundColor: 'grey.50',
                          zIndex: 10
                        }}
                        title={tp.name}
                      >
                        {tp.name}
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow sx={{ 
                  backgroundColor: 'grey.50',
                  '& .MuiTableCell-root': {
                    position: 'sticky',
                    top: '40px', // Offset by height of first header row
                    backgroundColor: 'grey.50',
                    zIndex: 9
                  }
                }}>
                  {schedule.timePoints.map(tp => {
                    const timepointTotalWidth = `calc((100% - 200px) / ${schedule.timePoints.length})`;
                    // Within each timepoint group: 40% arrive, 20% recovery, 40% depart
                    const arriveWidth = `calc(${timepointTotalWidth} * 0.4)`;
                    const recoveryWidth = `calc(${timepointTotalWidth} * 0.2)`;
                    const departWidth = `calc(${timepointTotalWidth} * 0.4)`;
                    
                    return (
                      <React.Fragment key={tp.id}>
                        <TableCell align="center" sx={{ 
                          fontSize: '0.7rem', 
                          color: 'text.secondary',
                          padding: '2px',
                          width: arriveWidth,
                          position: 'sticky',
                          top: '40px',
                          backgroundColor: 'grey.50',
                          zIndex: 9
                        }}>
                          Arrive
                        </TableCell>
                        <TableCell align="center" sx={{ 
                          fontSize: '0.7rem', 
                          color: 'text.secondary',
                          padding: '2px',
                          width: recoveryWidth,
                          position: 'sticky',
                          top: '40px',
                          backgroundColor: 'grey.50',
                          zIndex: 9
                        }}>
                          Rec
                        </TableCell>
                        <TableCell align="center" sx={{ 
                          fontSize: '0.7rem', 
                          color: 'text.secondary',
                          padding: '2px',
                          width: departWidth,
                          position: 'sticky',
                          top: '40px',
                          backgroundColor: 'grey.50',
                          zIndex: 9
                        }}>
                          Depart
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTrips.map((trip, idx) => {
                  const isNewBlock = idx === 0 || trip.blockNumber !== sortedTrips[idx - 1].blockNumber;
                  return (
                    <TripRow
                      key={trip.tripNumber}
                      trip={trip}
                      idx={idx}
                      isNewBlock={isNewBlock}
                      theme={theme}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>

    </Container>
  );
}
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
  Breadcrumbs,
  Link,
  useTheme
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Fullscreen as FullscreenIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { calculateTripTime } from '../utils/dateHelpers';

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
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const schedule: Schedule = location.state?.schedule || {
    id: '',
    name: 'Generated Schedule',
    timePoints: [],
    serviceBands: [],
    trips: [],
    updatedAt: new Date().toISOString()
  };

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
            {trip.departureTimes[tp.id] || trip.arrivalTimes[tp.id] || '-'}
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

  if (schedule.trips.length === 0) {
    return (
      <Container maxWidth={false} sx={{ px: 3 }}>
          <Box sx={{ py: 4 }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
              <Link 
                color="inherit" 
                href="#" 
                onClick={() => navigate('/')}
                sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
              >
                <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Dashboard
              </Link>
              <Link 
                color="inherit" 
                href="#" 
                onClick={() => navigate('/drafts')}
                sx={{ textDecoration: 'none' }}
              >
                Draft Schedules
              </Link>
              <Link 
                color="inherit" 
                href="#" 
                onClick={() => navigate('/timepoints')}
                sx={{ textDecoration: 'none' }}
              >
                TimePoints
              </Link>
              <Link 
                color="inherit" 
                href="#" 
                onClick={handleBack}
                sx={{ textDecoration: 'none' }}
              >
                Block Configuration
              </Link>
              <Typography color="text.primary">Summary Schedule</Typography>
            </Breadcrumbs>

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
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
            <Link 
              color="inherit" 
              href="#" 
              onClick={() => navigate('/')}
              sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Dashboard
            </Link>
            <Link 
              color="inherit" 
              href="#" 
              onClick={() => navigate('/drafts')}
              sx={{ textDecoration: 'none' }}
            >
              Draft Schedules
            </Link>
            <Link 
              color="inherit" 
              href="#" 
              onClick={() => navigate('/timepoints')}
              sx={{ textDecoration: 'none' }}
            >
              TimePoints
            </Link>
            <Link 
              color="inherit" 
              href="#" 
              onClick={handleBack}
              sx={{ textDecoration: 'none' }}
            >
              Block Configuration
            </Link>
            <Typography color="text.primary">Summary Schedule</Typography>
          </Breadcrumbs>

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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Add spacer for virtualization offset */}
                    {sortedTrips.length > 50 && visibleRange.start > 0 && (
                      <TableRow sx={{ height: `${visibleRange.start * 48}px` }}>
                            <TableCell colSpan={4 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
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
                            <TableCell colSpan={4 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Reuse same virtualization logic */}
                  {sortedTrips.length > 50 && visibleRange.start > 0 && (
                    <TableRow sx={{ height: `${visibleRange.start * 48}px` }}>
                      <TableCell colSpan={4 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
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
                      <TableCell colSpan={4 + schedule.timePoints.length} sx={{ p: 0, border: 'none' }} />
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
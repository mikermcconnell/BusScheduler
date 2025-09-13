import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  DirectionsBus as BusIcon,
  Schedule as ScheduleIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import {
  BusBlock,
  BlockTrip,
  ServiceBand,
  TimePointData,
  TimePoint,
  ScheduleEntry,
} from '../types/schedule';

interface BusBlockCreatorProps {
  /** Available service bands */
  serviceBands: ServiceBand[];
  /** Travel time data for calculations */
  travelTimeData: TimePointData[];
  /** Route timepoints in sequence */
  timePoints: TimePoint[];
  /** Callback when a bus block is created */
  onBlockCreated: (block: BusBlock) => void;
  /** Existing bus blocks to calculate next trip timing */
  existingBlocks?: BusBlock[];
  /** Callback when a trip should be removed */
  onTripRemoved?: () => void;
}

const BusBlockCreator: React.FC<BusBlockCreatorProps> = ({
  serviceBands,
  travelTimeData,
  timePoints,
  onBlockCreated,
  existingBlocks = [],
  onTripRemoved,
}) => {
  const [blockStartTime, setBlockStartTime] = useState<string>('06:00');
  const [blockEndTime, setBlockEndTime] = useState<string>('22:00');
  const [numberOfBuses, setNumberOfBuses] = useState<number>(1);
  const [dayType, setDayType] = useState<'weekday' | 'saturday' | 'sunday'>('weekday');
  const [previewBlock, setPreviewBlock] = useState<BusBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Click and drag scrolling state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  // Click and drag scrolling handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({
      left: tableContainerRef.current.scrollLeft,
      top: tableContainerRef.current.scrollTop
    });
    
    // Prevent text selection during drag
    e.preventDefault();
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

  // No longer needed - automatic detection handles service band selection

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Direct mapping based on total travel times from your table
  const detectTimeBandForTrip = useCallback((tripStartTime: string): ServiceBand | null => {
    const tripMinutes = timeToMinutes(tripStartTime);
    
    // Find all time periods from travel time data
    const timePeriods = Array.from(new Set(travelTimeData.map(data => data.timePeriod)));
    
    // Find the time period that contains this trip start time
    let matchingPeriod: string | null = null;
    for (const period of timePeriods) {
      const [startTime, endTime] = period.split(' - ');
      const periodStartMinutes = timeToMinutes(startTime);
      const periodEndMinutes = timeToMinutes(endTime);
      
      if (tripMinutes >= periodStartMinutes && tripMinutes < periodEndMinutes) {
        matchingPeriod = period;
        break;
      }
    }
    
    if (!matchingPeriod) return null;
    
    // Calculate total travel time for this period
    const periodTotalTime = travelTimeData
      .filter(data => data.timePeriod === matchingPeriod)
      .reduce((sum, data) => sum + data.percentile50, 0);
    
    // Map directly to service bands based on total travel time (using exact table totals)
    let targetBandName: string;
    const roundedTotal = Math.round(periodTotalTime);
    
    if (roundedTotal <= 36) {
      targetBandName = 'Fastest Service'; // 36min
    } else if (roundedTotal <= 37) {
      targetBandName = 'Fast Service'; // 37min (corrected)
    } else if (roundedTotal <= 39) {
      targetBandName = 'Standard Service'; // 39min
    } else if (roundedTotal <= 40) {
      targetBandName = 'Slow Service'; // 40min (corrected)
    } else {
      targetBandName = 'Slowest Service'; // 43min (corrected)
    }
    
    console.log(`Time period ${matchingPeriod}: calculated total=${periodTotalTime.toFixed(1)}, rounded=${roundedTotal}, band=${targetBandName}`);
    
    // Find the matching service band
    return serviceBands.find(band => band.name === targetBandName) || null;
  }, [travelTimeData, serviceBands]);

  // Predefined travel times by service band (from the table)
  const getServiceBandTravelTimes = () => {
    return {
      'Fastest Service': {
        'Downtown Barrie Terminal→Johnson at Napier': 8,
        'Johnson at Napier→RVH Atrium Entrance': 7,
        'RVH Atrium Entrance→Georgian College': 2,
        'Georgian College→Georgian Mall': 10,
        'Georgian Mall→Bayfield Mall': 4,
        'Bayfield Mall→Downtown Barrie Terminal': 5
      },
      'Fast Service': {
        'Downtown Barrie Terminal→Johnson at Napier': 8,
        'Johnson at Napier→RVH Atrium Entrance': 7,
        'RVH Atrium Entrance→Georgian College': 2,
        'Georgian College→Georgian Mall': 11,
        'Georgian Mall→Bayfield Mall': 4,
        'Bayfield Mall→Downtown Barrie Terminal': 5
      },
      'Standard Service': {
        'Downtown Barrie Terminal→Johnson at Napier': 8,
        'Johnson at Napier→RVH Atrium Entrance': 7,
        'RVH Atrium Entrance→Georgian College': 2,
        'Georgian College→Georgian Mall': 11,
        'Georgian Mall→Bayfield Mall': 5,
        'Bayfield Mall→Downtown Barrie Terminal': 6
      },
      'Slow Service': {
        'Downtown Barrie Terminal→Johnson at Napier': 8,
        'Johnson at Napier→RVH Atrium Entrance': 7,
        'RVH Atrium Entrance→Georgian College': 2,
        'Georgian College→Georgian Mall': 12,
        'Georgian Mall→Bayfield Mall': 5,
        'Bayfield Mall→Downtown Barrie Terminal': 6
      },
      'Slowest Service': {
        'Downtown Barrie Terminal→Johnson at Napier': 9,
        'Johnson at Napier→RVH Atrium Entrance': 8,
        'RVH Atrium Entrance→Georgian College': 2,
        'Georgian College→Georgian Mall': 12,
        'Georgian Mall→Bayfield Mall': 6,
        'Bayfield Mall→Downtown Barrie Terminal': 6
      }
    };
  };

  // Get travel time between two timepoints using automatically detected service band
  const getTravelTimeBetweenTimepointsForTrip = (
    fromTimePoint: string,
    toTimePoint: string,
    tripStartTime: string
  ): number => {
    // Detect the service band for this trip
    const detectedBand = detectTimeBandForTrip(tripStartTime);
    if (!detectedBand) {
      return 10; // Default fallback
    }

    // Get predefined travel times
    const serviceBandTravelTimes = getServiceBandTravelTimes();
    const bandTimes = serviceBandTravelTimes[detectedBand.name as keyof typeof serviceBandTravelTimes];
    
    if (!bandTimes) {
      return 10; // Default fallback
    }

    // Normalize timepoint names (remove "(Return)" suffix if present)
    const normalizedFrom = fromTimePoint.replace(' (Return)', '');
    const normalizedTo = toTimePoint.replace(' (Return)', '');
    
    // Create segment key
    const segmentKey = `${normalizedFrom}→${normalizedTo}`;
    const travelTime = bandTimes[segmentKey as keyof typeof bandTimes];
    
    console.log(`Looking up travel time: ${segmentKey} = ${travelTime} minutes`);
    
    return travelTime || 10; // Return predefined time or fallback
  };


  // Generate schedule entries for a single trip using automatic time band detection
  const generateTripScheduleEntries = useCallback((
    tripStartTime: string
  ): ScheduleEntry[] => {
    const scheduleEntries: ScheduleEntry[] = [];
    let currentMinutes = timeToMinutes(tripStartTime);

    for (let i = 0; i < timePoints.length; i++) {
      const timePoint = timePoints[i];
      
      // First timepoint gets the trip start time
      if (i === 0) {
        scheduleEntries.push({
          timePointId: timePoint.id,
          arrivalTime: minutesToTime(currentMinutes),
          departureTime: minutesToTime(currentMinutes),
        });
      } else {
        // Calculate travel time from previous timepoint using automatic detection
        const prevTimePoint = timePoints[i - 1];
        const travelTime = getTravelTimeBetweenTimepointsForTrip(
          prevTimePoint.name,
          timePoint.name,
          tripStartTime
        );
        
        currentMinutes += travelTime;
        
        scheduleEntries.push({
          timePointId: timePoint.id,
          arrivalTime: minutesToTime(currentMinutes),
          departureTime: minutesToTime(currentMinutes),
        });
      }
    }

    return scheduleEntries;
  }, [timePoints, detectTimeBandForTrip]);

  // Helper function to get time period for a trip start time
  const getTimePeriodForTrip = useCallback((tripStartTime: string): string | null => {
    const tripMinutes = timeToMinutes(tripStartTime);
    const timePeriods = Array.from(new Set(travelTimeData.map(data => data.timePeriod)));
    
    for (const period of timePeriods) {
      const [startTime, endTime] = period.split(' - ');
      const periodStartMinutes = timeToMinutes(startTime);
      const periodEndMinutes = timeToMinutes(endTime);
      
      if (tripMinutes >= periodStartMinutes && tripMinutes < periodEndMinutes) {
        return period;
      }
    }
    
    return null;
  }, [travelTimeData]);

  // Generate complete bus block
  const generateBusBlock = useMemo((): BusBlock | null => {
    if (timePoints.length === 0 || travelTimeData.length === 0) return null;

    try {
      const trips: BlockTrip[] = [];
      let currentTripStartMinutes = timeToMinutes(blockStartTime);

      // Always create exactly one trip
      for (let i = 0; i < 1; i++) {
        const tripStartTime = minutesToTime(currentTripStartMinutes);
        const scheduleEntries = generateTripScheduleEntries(tripStartTime);
        
        // Get detected service band and time period for this trip
        const detectedServiceBand = detectTimeBandForTrip(tripStartTime);
        const timePeriod = getTimePeriodForTrip(tripStartTime);
        
        // Calculate trip duration (first to last timepoint)
        const firstEntry = scheduleEntries[0];
        const lastEntry = scheduleEntries[scheduleEntries.length - 1];
        const tripDuration = timeToMinutes(lastEntry.arrivalTime) - timeToMinutes(firstEntry.departureTime);

        trips.push({
          tripId: `trip_${i + 1}`,
          departureTime: tripStartTime,
          direction: i % 2 === 0 ? 'outbound' : 'inbound',
          scheduleEntries,
          tripDuration,
          detectedServiceBand,
          timePeriod,
        });

        // Only one trip, so no need to move to next time
      }

      // Calculate total block duration
      const firstTrip = trips[0];
      const lastTrip = trips[trips.length - 1];
      const lastTripEnd = Math.max(
        ...lastTrip.scheduleEntries.map(entry => timeToMinutes(entry.arrivalTime))
      );
      const totalDuration = lastTripEnd - timeToMinutes(firstTrip.departureTime);

      // Calculate bus block number for this trip
      const currentTripStartTime = timeToMinutes(trips[0].departureTime);
      
      // Group existing blocks by their bus block number and find the latest end time for each bus
      const busEndTimes = new Map<number, number>();
      
      existingBlocks.forEach(block => {
        const busNumber = block.busBlockNumber || 1;
        
        // Find the latest trip end time in this block
        let latestTripEndTime = 0;
        block.trips.forEach(trip => {
          const lastEntry = trip.scheduleEntries[trip.scheduleEntries.length - 1];
          const endTime = timeToMinutes(lastEntry.departureTime);
          if (endTime > latestTripEndTime) {
            latestTripEndTime = endTime;
          }
        });
        
        // Update the latest end time for this bus number
        const currentBusEndTime = busEndTimes.get(busNumber) || 0;
        if (latestTripEndTime > currentBusEndTime) {
          busEndTimes.set(busNumber, latestTripEndTime);
        }
      });
      
      // Check if any existing bus is available (trip starts at or after bus becomes free)
      let busBlockNumber = 1;
      const busEntries = Array.from(busEndTimes.entries());
      for (const [busNumber, endTime] of busEntries) {
        if (currentTripStartTime >= endTime) {
          busBlockNumber = busNumber;
          break;
        }
      }
      
      // If no existing bus is available, need a new bus
      if (busBlockNumber === 1 && busEndTimes.size > 0) {
        const busNumbers = Array.from(busEndTimes.keys());
        const maxBusNumber = busNumbers.length > 0 ? Math.max(...busNumbers) : 0;
        busBlockNumber = maxBusNumber + 1;
      }
      
      return {
        blockId: `block_${Date.now()}`,
        startTime: blockStartTime,
        serviceBand: 'AUTO_DETECTED', // Indicate automatic detection
        trips,
        dayType,
        totalDuration,
        busBlockNumber, // Add the calculated bus block number
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bus block');
      return null;
    }
  }, [blockStartTime, blockEndTime, numberOfBuses, dayType, timePoints, travelTimeData, serviceBands, existingBlocks, detectTimeBandForTrip, generateTripScheduleEntries, getTimePeriodForTrip]);

  // Update preview when parameters change
  React.useEffect(() => {
    setPreviewBlock(generateBusBlock);
    setError(null);
  }, [generateBusBlock]);


  // Get the departure time from the last timepoint of the most recent trip
  const getNextTripStartTime = (): string => {
    // Find the most recent trip across all blocks AND the current preview block
    let latestTrip: any = null;
    let latestTime = 0;

    // Check existing blocks
    existingBlocks.forEach(block => {
      block.trips.forEach(trip => {
        // Get the last schedule entry (last timepoint) of this trip
        const lastEntry = trip.scheduleEntries[trip.scheduleEntries.length - 1];
        const departureMinutes = timeToMinutes(lastEntry.departureTime);
        
        if (departureMinutes > latestTime) {
          latestTime = departureMinutes;
          latestTrip = { trip, lastEntry };
        }
      });
    });

    // Also check the current preview block if it exists
    if (previewBlock) {
      previewBlock.trips.forEach(trip => {
        const lastEntry = trip.scheduleEntries[trip.scheduleEntries.length - 1];
        const departureMinutes = timeToMinutes(lastEntry.departureTime);
        
        if (departureMinutes > latestTime) {
          latestTime = departureMinutes;
          latestTrip = { trip, lastEntry };
        }
      });
    }

    if (latestTrip) {
      return latestTrip.lastEntry.departureTime;
    }

    return blockStartTime;
  };

  const handleNextTrip = () => {
    // First create the current trip before updating start time
    if (previewBlock) {
      onBlockCreated(previewBlock);
    }
    
    // Then set the start time for the next trip
    const nextStartTime = getNextTripStartTime();
    setBlockStartTime(nextStartTime);
  };

  const handleRemoveTrip = () => {
    if (onTripRemoved) {
      onTripRemoved();
    }
  };


  // Get all trips from existing blocks plus preview block
  const getAllTrips = () => {
    const allTrips: Array<{trip: any, blockNumber: number}> = [];
    
    // Add trips from existing blocks
    existingBlocks.forEach((block) => {
      block.trips.forEach(trip => {
        allTrips.push({ trip, blockNumber: block.busBlockNumber || 1 });
      });
    });
    
    // Add trips from preview block
    if (previewBlock) {
      previewBlock.trips.forEach(trip => {
        allTrips.push({ trip, blockNumber: previewBlock.busBlockNumber || 1 });
      });
    }
    
    return allTrips;
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };


  return (
    <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
      <CardContent sx={{ p: 3 }}>
        {/* Header Section */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 4,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <BusIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Bus Trip Creator
          </Typography>
        </Box>

        {/* Main Configuration Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 3, color: 'text.primary', fontWeight: 500 }}>
            Trip Configuration
          </Typography>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 3, 
            alignItems: 'start'
          }}>
            <TextField
              label="Block Start Time"
              type="time"
              value={blockStartTime}
              onChange={(e) => setBlockStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              size="medium"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <TextField
              label="Block End Time"
              type="time"
              value={blockEndTime}
              onChange={(e) => setBlockEndTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              size="medium"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <TextField
              label="Number of Buses"
              type="number"
              value={numberOfBuses}
              onChange={(e) => setNumberOfBuses(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1, max: 20 }}
              variant="outlined"
              size="medium"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
              helperText="Number of bus blocks to generate"
            />

            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              p: 2.5, 
              backgroundColor: 'success.light', 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'success.main',
              minHeight: 56,
              gridColumn: { xs: '1 / -1', md: 'span 2' }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  backgroundColor: 'success.main' 
                }} />
                <Typography variant="body2" color="success.dark" sx={{ fontWeight: 600 }}>
                  Automatic Time Band Detection Enabled
                </Typography>
              </Box>
            </Box>

            <FormControl fullWidth variant="outlined" size="medium">
              <InputLabel>Day Type</InputLabel>
              <Select
                value={dayType}
                onChange={(e) => setDayType(e.target.value as any)}
                label="Day Type"
                sx={{
                  borderRadius: 2
                }}
              >
                <MenuItem value="weekday">Weekday Service</MenuItem>
                <MenuItem value="saturday">Saturday Service</MenuItem>
                <MenuItem value="sunday">Sunday Service</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>


        {/* Status Messages */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              '& .MuiAlert-message': {
                fontWeight: 500
              }
            }}
          >
            {error}
          </Alert>
        )}

        {timePoints.length === 0 && (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              backgroundColor: 'info.light',
              '& .MuiAlert-message': {
                fontWeight: 500
              }
            }}
          >
            <Typography variant="body2">
              <strong>Setup Required:</strong> No timepoints available. Please upload and process travel time data first.
            </Typography>
          </Alert>
        )}

        {travelTimeData.length === 0 && (
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              backgroundColor: 'warning.light',
              '& .MuiAlert-message': {
                fontWeight: 500
              }
            }}
          >
            <Typography variant="body2">
              <strong>Data Missing:</strong> No travel time data loaded. Please upload a CSV file with travel time data.
            </Typography>
          </Alert>
        )}

        {/* Schedule Summary Section */}
        {(existingBlocks.length > 0 || previewBlock) && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              mb: 3,
              pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ mr: 2, color: 'success.main', fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Schedule Preview</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Chip 
                  label={`${getAllTrips().length} trips`} 
                  color="primary" 
                  size="medium"
                  sx={{ fontWeight: 500 }}
                />
                <Chip 
                  label={`${existingBlocks.length + (previewBlock ? 1 : 0)} blocks`} 
                  color="secondary" 
                  size="medium"
                  sx={{ fontWeight: 500 }}
                />
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
                height: '450px',
                overflowX: 'auto',
                overflowY: 'auto',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                position: 'relative',
                borderRadius: 2,
                boxShadow: 1,
                '& .MuiTable-root': {
                  minWidth: 800
                }
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
                  backgroundColor: 'primary.main'
                }}>
                  <TableRow sx={{ 
                    '& .MuiTableCell-root': {
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      zIndex: 10,
                      borderBottom: '2px solid',
                      borderBottomColor: 'primary.dark',
                      fontWeight: 600
                    }
                  }}>
                    <TableCell sx={{ 
                      padding: '8px 4px',
                      fontSize: '0.75rem',
                      width: '40px',
                      textAlign: 'center'
                    }}>Block</TableCell>
                    <TableCell sx={{ 
                      padding: '8px 4px', 
                      fontSize: '0.75rem',
                      width: '40px',
                      textAlign: 'center'
                    }}>Trip</TableCell>
                    <TableCell sx={{ 
                      padding: '8px 4px',
                      fontSize: '0.75rem', 
                      width: '70px',
                      textAlign: 'center'
                    }}>Start</TableCell>
                    <TableCell sx={{ 
                      padding: '8px 4px',
                      fontSize: '0.75rem',
                      width: '50px',
                      textAlign: 'center'
                    }}>Dir</TableCell>
                    <TableCell sx={{ 
                      padding: '8px 4px',
                      fontSize: '0.75rem',
                      width: '50px',
                      textAlign: 'center'
                    }}>Band</TableCell>
                    <TableCell sx={{ 
                      padding: '8px 4px',
                      fontSize: '0.75rem',
                      width: '60px',
                      textAlign: 'center'
                    }}>Period</TableCell>
                    <TableCell sx={{ 
                      padding: '8px 4px',
                      fontSize: '0.75rem',
                      width: '50px',
                      textAlign: 'center'
                    }}>Dur</TableCell>
                    {timePoints.map((tp, index) => {
                      const availableWidth = `calc((100% - 320px) / ${timePoints.length})`;
                      return (
                        <TableCell key={tp.id} sx={{ 
                          padding: '8px 4px',
                          fontSize: '0.75rem',
                          width: availableWidth,
                          maxWidth: availableWidth,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'center'
                        }}>
                          <span title={tp.name}>
                            {tp.name.length > 12 ? tp.name.substring(0, 10) + '..' : tp.name}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getAllTrips().map(({trip, blockNumber}, globalIndex) => (
                    <TableRow key={`${blockNumber}-${trip.tripId}`} sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: 'grey.50' },
                      '&:hover': { backgroundColor: 'action.hover' },
                      transition: 'background-color 0.2s'
                    }}>
                      <TableCell sx={{ 
                        padding: '8px 4px', 
                        fontSize: '0.875rem',
                        width: '40px',
                        textAlign: 'center',
                        fontWeight: 500
                      }}>{blockNumber}</TableCell>
                      <TableCell sx={{ 
                        padding: '8px 4px', 
                        fontSize: '0.875rem',
                        width: '40px',
                        textAlign: 'center'
                      }}>{globalIndex + 1}</TableCell>
                      <TableCell sx={{ 
                        padding: '8px 4px', 
                        fontSize: '0.875rem',
                        width: '70px',
                        textAlign: 'center',
                        fontWeight: 500
                      }}>{trip.departureTime}</TableCell>
                      <TableCell sx={{ 
                        padding: '8px 4px',
                        width: '50px',
                        textAlign: 'center'
                      }}>
                        <Chip
                          label={trip.direction === 'outbound' ? 'OUT' : 'IN'}
                          size="small"
                          color={trip.direction === 'outbound' ? 'primary' : 'secondary'}
                          sx={{ 
                            fontSize: '0.6rem',
                            height: 20,
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        padding: '2px 1px',
                        width: '40px',
                        textAlign: 'center'
                      }}>
                        {trip.detectedServiceBand ? (
                          <Typography variant="caption" sx={{ 
                            fontSize: '0.45rem',
                            color: 'white',
                            backgroundColor: trip.detectedServiceBand.color,
                            padding: '1px 2px',
                            borderRadius: '2px',
                            fontWeight: 'bold'
                          }}>
                            {trip.detectedServiceBand.name.charAt(0)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.5rem' }}>
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ 
                        padding: '2px 1px',
                        width: '40px',
                        textAlign: 'center'
                      }}>
                        <Typography variant="caption" sx={{ 
                          fontSize: '0.5rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={trip.timePeriod || 'Unknown'}>
                          {trip.timePeriod ? trip.timePeriod.split(':')[0] + 'h' : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ 
                        padding: '2px 1px', 
                        fontSize: '0.55rem',
                        width: '35px',
                        textAlign: 'center'
                      }}>{trip.tripDuration < 60 ? `${trip.tripDuration}m` : `${Math.floor(trip.tripDuration/60)}h`}</TableCell>
                      {trip.scheduleEntries.map((entry: ScheduleEntry, entryIndex: number) => {
                        const availableWidth = `calc((100% - 215px) / ${timePoints.length})`;
                        return (
                          <TableCell key={entry.timePointId} sx={{ 
                            width: availableWidth,
                            maxWidth: availableWidth,
                            padding: '2px 1px',
                            fontSize: '0.5rem',
                            overflow: 'hidden',
                            textAlign: 'center'
                          }}>
                            <Typography variant="caption" sx={{ 
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap'
                            }}>
                              {entry.arrivalTime}
                            </Typography>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Action Buttons Section */}
        <Box sx={{ 
          mt: 4, 
          pt: 3, 
          borderTop: '1px solid', 
          borderColor: 'divider' 
        }}>
          <Typography variant="h6" sx={{ mb: 3, color: 'text.primary', fontWeight: 500 }}>
            Trip Actions
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 3,
            flexWrap: 'wrap'
          }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNextTrip}
              disabled={!previewBlock}
              size="large"
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                minWidth: 160,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              Add Next Trip
            </Button>
            <Button
              variant="outlined"
              startIcon={<RemoveIcon />}
              onClick={handleRemoveTrip}
              disabled={getAllTrips().length === 0}
              size="large"
              color="error"
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                minWidth: 160,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              Remove Last Trip
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BusBlockCreator;
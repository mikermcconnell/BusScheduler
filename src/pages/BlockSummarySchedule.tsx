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
  NavigateNext as NavigateNextIcon,
  Sort as SortIcon
} from '@mui/icons-material';

interface TimePoint {
  id: string;
  name: string;
  sequence: number;
}

interface ServiceBand {
  name: 'Fastest' | 'Fast' | 'Standard' | 'Slow' | 'Slowest';
  totalMinutes: number;
  color: string;
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

interface Schedule {
  id: string;
  name: string;
  timePoints: TimePoint[];
  serviceBands: ServiceBand[];
  trips: Trip[];
  updatedAt: string;
}

const BlockSummarySchedule: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [sortByBlock, setSortByBlock] = useState(false);
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

  // Force time-based sorting on mount and log sorting
  useEffect(() => {
    console.log('Component mounted, forcing time-based sort');
    setSortByBlock(false);
    console.log('First 3 trips before sort:', schedule.trips.slice(0, 3).map(t => ({ trip: t.tripNumber, block: t.blockNumber, time: t.departureTime })));
  }, [schedule.trips]);

  // Simplified trip row component for maximum performance
  const TripRow = memo(({ trip, idx, isNewBlock, theme }: any) => {
    const serviceBand = schedule.serviceBands.find(sb => sb.name === trip.serviceBand);
    
    return (
      <TableRow
        key={trip.tripNumber}
        sx={{
          height: '24px',
          borderTop: isNewBlock ? `2px solid ${theme.palette.primary.main}` : 'none',
          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' }
        }}
      >
        <TableCell sx={{ p: '2px', fontSize: '10px', textAlign: 'center', width: '35px' }}>
          {sortByBlock && isNewBlock ? `B${trip.blockNumber}` : (!sortByBlock ? `B${trip.blockNumber}` : '')}
        </TableCell>
        <TableCell sx={{ p: '2px', fontSize: '10px', textAlign: 'center', width: '35px', fontWeight: 'bold' }}>
          {trip.tripNumber}
        </TableCell>
        <TableCell sx={{ p: '1px', textAlign: 'center', width: '45px' }}>
          {serviceBand ? (
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: serviceBand.color,
                margin: '0 auto'
              }}
              title={serviceBand.name}
            />
          ) : '-'}
        </TableCell>
        {schedule.timePoints.map(tp => (
          <React.Fragment key={tp.id}>
            <TableCell sx={{ p: '1px', fontSize: '9px', textAlign: 'center' }}>
              {trip.arrivalTimes[tp.id] || '-'}
            </TableCell>
            <TableCell sx={{ p: '1px', fontSize: '8px', textAlign: 'center', color: 'primary.main' }}>
              {trip.recoveryTimes[tp.id] > 0 ? `+${trip.recoveryTimes[tp.id]}` : ''}
            </TableCell>
            <TableCell sx={{ 
              p: '1px', 
              fontSize: '9px', 
              textAlign: 'center',
              fontWeight: trip.recoveryTimes[tp.id] > 0 ? 'bold' : 'normal'
            }}>
              {trip.departureTimes[tp.id] || '-'}
            </TableCell>
          </React.Fragment>
        ))}
      </TableRow>
    );
  });

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
      const lastArrival = Object.values(lastTrip.arrivalTimes).pop() || lastTrip.departureTime;
      
      const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
        const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };
      
      const endTime = addMinutesToTime(lastArrival, lastTrip.recoveryMinutes);
      const startMinutes = timeToMinutes(firstTrip.departureTime);
      const endMinutes = timeToMinutes(endTime);
      const duration = endMinutes - startMinutes;
      
      return {
        blockNumber: blockNum,
        tripCount: trips.length,
        startTime: firstTrip.departureTime,
        endTime,
        duration: `${Math.floor(duration / 60)}h ${duration % 60}m`
      };
    });
  }, [schedule.trips]);

  // Memoize column widths to prevent recalculation
  const columnWidths = useMemo(() => {
    const availableWidth = `calc((100% - 115px) / ${schedule.timePoints.length})`;
    const cellWidth = `calc((100% - 115px) / ${schedule.timePoints.length} / 3)`;
    return { availableWidth, cellWidth };
  }, [schedule.timePoints.length]);

  // ALWAYS sort by departure time (ignore block sorting for now)
  const sortedTrips = useMemo(() => {
    console.log('Force sorting by departure time - sortByBlock is:', sortByBlock);
    
    const sorted = [...schedule.trips].sort((a, b) => {
      // Get first timepoint departure time for each trip
      const firstTimePointId = schedule.timePoints[0]?.id;
      const timeA = firstTimePointId ? (a.departureTimes[firstTimePointId] || a.departureTime) : a.departureTime;
      const timeB = firstTimePointId ? (b.departureTimes[firstTimePointId] || b.departureTime) : b.departureTime;
      return timeA.localeCompare(timeB);
    });
    
    console.log('SORTED - First 5 trips:', sorted.slice(0, 5).map(t => ({ trip: t.tripNumber, block: t.blockNumber, time: t.departureTime })));
    return sorted;
  }, [schedule.trips, schedule.timePoints]);

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
    const rowHeight = 24; // Fixed row height
    const containerHeight = container.clientHeight;
    
    const startIndex = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeight / rowHeight) + 10; // Buffer
    const endIndex = Math.min(startIndex + visibleCount, sortedTrips.length);
    
    setVisibleRange({ start: startIndex, end: endIndex });
  }, [sortedTrips.length]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({
      left: tableContainerRef.current.scrollLeft,
      top: tableContainerRef.current.scrollTop
    });
    
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Use requestAnimationFrame to throttle scroll updates
    requestAnimationFrame(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollLeft = scrollStart.left - deltaX;
        tableContainerRef.current.scrollTop = scrollStart.top - deltaY;
      }
    });
  }, [isDragging, dragStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  if (schedule.trips.length === 0) {
    return (
      <Container maxWidth="lg">
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
      <Container maxWidth="xl">
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
                <Typography variant="h5" fontWeight="bold">
                  Summary Schedule (SORTED BY TIME - First trip: {sortedTrips[0]?.tripNumber} at {sortedTrips[0]?.departureTime})
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Chip 
                    label={`${schedule.trips.length} trips • ${blockStats.length} bus blocks`}
                    color="primary"
                    size="medium"
                  />
                  {/* Temporarily hidden - sorting by time only
                  <Button
                    variant={sortByBlock ? "contained" : "outlined"}
                    startIcon={<SortIcon />}
                    onClick={() => setSortByBlock(!sortByBlock)}
                    size="small"
                    sx={{ backgroundColor: sortByBlock ? 'primary.main' : 'warning.main', color: 'white' }}
                  >
                    {sortByBlock ? "BY BLOCK" : "BY TIME"}
                  </Button>
                  */}
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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onScroll={handleScroll}
                sx={{ 
                  width: '100%', 
                  height: schedule.trips.length > 20 ? '600px' : '500px',
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
                      {schedule.timePoints.map(tp => (
                        <TableCell 
                          key={tp.id} 
                          colSpan={3} 
                          align="center"
                          sx={{ 
                            borderBottom: '1px solid #e0e0e0',
                            fontWeight: 'bold',
                            padding: '2px 1px',
                            fontSize: '0.55rem',
                            width: columnWidths.availableWidth,
                            maxWidth: columnWidths.availableWidth,
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
                      ))}
                    </TableRow>
                    <TableRow sx={{ 
                      backgroundColor: 'grey.50',
                      '& .MuiTableCell-root': {
                        position: 'sticky',
                        top: '32px',
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
                    {/* Add spacer for virtualization offset */}
                    {sortedTrips.length > 50 && visibleRange.start > 0 && (
                      <TableRow sx={{ height: `${visibleRange.start * 24}px` }}>
                        <TableCell colSpan={3 + schedule.timePoints.length * 3} sx={{ p: 0, border: 'none' }} />
                      </TableRow>
                    )}
                    
                    {visibleTrips.map((trip, idx) => {
                      const originalIdx = sortedTrips.length > 50 ? visibleRange.start + idx : idx;
                      const isNewBlock = sortByBlock && (originalIdx === 0 || trip.blockNumber !== sortedTrips[originalIdx - 1]?.blockNumber);
                      return (
                        <TripRow
                          key={trip.tripNumber}
                          trip={trip}
                          idx={originalIdx}
                          isNewBlock={isNewBlock}
                          theme={theme}
                        />
                      );
                    })}
                    
                    {/* Add spacer for remaining items */}
                    {sortedTrips.length > 50 && visibleRange.end < sortedTrips.length && (
                      <TableRow sx={{ height: `${(sortedTrips.length - visibleRange.end) * 24}px` }}>
                        <TableCell colSpan={3 + schedule.timePoints.length * 3} sx={{ p: 0, border: 'none' }} />
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
              Summary Schedule - Full Screen ({schedule.trips.length} trips)
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
                    {schedule.timePoints.map(tp => (
                      <TableCell 
                        key={tp.id} 
                        colSpan={3} 
                        align="center"
                        sx={{ 
                          borderBottom: '1px solid #e0e0e0',
                          fontWeight: 'bold',
                          padding: '2px 1px',
                          fontSize: '0.55rem',
                          width: columnWidths.availableWidth,
                          maxWidth: columnWidths.availableWidth,
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
                    ))}
                  </TableRow>
                  <TableRow sx={{ 
                    backgroundColor: 'grey.50',
                    '& .MuiTableCell-root': {
                      position: 'sticky',
                      top: '32px',
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
                  {/* Reuse same virtualization logic */}
                  {sortedTrips.length > 50 && visibleRange.start > 0 && (
                    <TableRow sx={{ height: `${visibleRange.start * 24}px` }}>
                      <TableCell colSpan={3 + schedule.timePoints.length * 3} sx={{ p: 0, border: 'none' }} />
                    </TableRow>
                  )}
                  
                  {visibleTrips.map((trip, idx) => {
                    const originalIdx = sortedTrips.length > 50 ? visibleRange.start + idx : idx;
                    const isNewBlock = sortByBlock && (originalIdx === 0 || trip.blockNumber !== sortedTrips[originalIdx - 1]?.blockNumber);
                    return (
                      <TripRow
                        key={trip.tripNumber}
                        trip={trip}
                        idx={originalIdx}
                        isNewBlock={isNewBlock}
                        theme={theme}
                      />
                    );
                  })}
                  
                  {sortedTrips.length > 50 && visibleRange.end < sortedTrips.length && (
                    <TableRow sx={{ height: `${(sortedTrips.length - visibleRange.end) * 24}px` }}>
                      <TableCell colSpan={3 + schedule.timePoints.length * 3} sx={{ p: 0, border: 'none' }} />
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
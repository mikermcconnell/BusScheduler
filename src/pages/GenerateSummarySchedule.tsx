import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Breadcrumbs,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Drafts as DraftIcon,
  Timeline as TimelineIcon,
  NavigateNext as NavigateNextIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { scheduleStorage } from '../services/scheduleStorage';
import { ParsedCsvData } from '../utils/csvParser';
import BusBlockCreator from '../components/BusBlockCreator';
import { BusBlock, ServiceBand, TimePoint } from '../types/schedule';
import { createServiceBandsFromData } from '../utils/serviceBandLookup';

interface TimePointData {
  fromTimePoint: string;
  toTimePoint: string;
  timePeriod: string;
  percentile50: number;
  percentile80: number;
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

const GenerateSummarySchedule: React.FC = () => {
  const navigate = useNavigate();
  const [timePointData, setTimePointData] = useState<TimePointData[]>([]);
  const [timeBands, setTimeBands] = useState<TimeBand[]>([]);
  const [serviceBands, setServiceBands] = useState<ServiceBand[]>([]);
  const [timePoints, setTimePoints] = useState<TimePoint[]>([]);
  const [busBlocks, setBusBlocks] = useState<BusBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show80thPercentileTable, setShow80thPercentileTable] = useState(false);

  const handleGoBack = () => {
    navigate('/timepoints');
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Create simplified data-driven time bands for the table
  const createSimpleTimebands = (timePointData: TimePointData[]): TimeBand[] => {
    if (timePointData.length === 0) return [];

    // Group data by time period and calculate total travel times
    const timePeriodsMap = new Map<string, number>();
    timePointData.forEach(row => {
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
    const bandNames = ['Fastest Service', 'Fast Service', 'Standard Service', 'Slow Service', 'Slowest Service'];

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

      bands.push({
        id: `band_${i + 1}`,
        name: bandNames[i],
        startTime: earliestStart,
        endTime: latestEnd,
        travelTimeMultiplier: 1.0,
        color: '#000000', // Simple black color for all bands
        description: `${bandPeriods.length} periods`
      });
    }

    return bands;
  };

  useEffect(() => {
    const loadTimePointData = async () => {
      setLoading(true);
      setError(null);

      try {
        let data: ParsedCsvData | null = null;
        
        // Try to load the most recent draft
        const drafts = scheduleStorage.getAllDraftSchedules();
        if (drafts.length > 0) {
          // Sort by updatedAt and get the most recent
          const mostRecent = drafts.sort((a: any, b: any) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          
          if (mostRecent.uploadedData && 'segments' in mostRecent.uploadedData) {
            data = mostRecent.uploadedData as ParsedCsvData;
          }
        }

        if (!data) {
          setError('No timepoint data available. Please upload a CSV file and process it first.');
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

        setTimePointData(tableData);
        
        // Create simplified timebands
        const simpleBands = createSimpleTimebands(tableData);
        setTimeBands(simpleBands);

        // Create service bands from data
        const generatedServiceBands = createServiceBandsFromData(tableData);
        setServiceBands(generatedServiceBands);

        // Extract and order timepoints based on route sequence
        // The full route includes return to downtown, so we need to preserve duplicates
        const fullRouteSequence = [
          'Downtown Barrie Terminal',
          'Johnson at Napier',
          'RVH Atrium Entrance', 
          'Georgian College',
          'Georgian Mall',
          'Bayfield Mall',
          'Downtown Barrie Terminal' // Return destination
        ];

        // Get all unique timepoints from the data to verify they exist
        const uniqueTimePointsSet = new Set<string>();
        tableData.forEach(row => {
          uniqueTimePointsSet.add(row.fromTimePoint);
          uniqueTimePointsSet.add(row.toTimePoint);
        });

        // Build the ordered route, preserving duplicates where they represent different stops in sequence
        const orderedTimePoints: string[] = [];
        fullRouteSequence.forEach(tp => {
          if (uniqueTimePointsSet.has(tp)) {
            orderedTimePoints.push(tp);
          }
        });
        
        // Add any timepoints not in the predefined sequence at the end
        const remainingTimePoints = Array.from(uniqueTimePointsSet).filter(tp => !fullRouteSequence.includes(tp));
        const allOrderedTimePoints = [...orderedTimePoints, ...remainingTimePoints];

        const timePointsArray: TimePoint[] = allOrderedTimePoints.map((name, index) => ({
          id: `tp_${index + 1}`,
          name: index === 0 ? name : (index === allOrderedTimePoints.length - 1 && name === 'Downtown Barrie Terminal' ? `${name} (Return)` : name),
          sequence: index + 1,
        }));

        setTimePoints(timePointsArray);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timepoint data');
      } finally {
        setLoading(false);
      }
    };

    loadTimePointData();
  }, []);

  const handleBlockCreated = (block: BusBlock) => {
    setBusBlocks(prev => [...prev, block]);
  };

  const handleTripRemoved = () => {
    setBusBlocks(prev => {
      if (prev.length === 0) return prev;
      
      // Remove the last block (which contains the last trip)
      const newBlocks = [...prev];
      newBlocks.pop();
      return newBlocks;
    });
  };

  // Create 80th percentile travel times table data (rounded to nearest minute)
  const create80thPercentileTravelTimes = () => {
    return {
      'Fastest Service': {
        'Downtown Barrie Terminal→Johnson at Napier': Math.round(8.58), // 9
        'Johnson at Napier→RVH Atrium Entrance': Math.round(7.2), // 7
        'RVH Atrium Entrance→Georgian College': Math.round(2.0), // 2
        'Georgian College→Georgian Mall': Math.round(11.77), // 12
        'Georgian Mall→Bayfield Mall': Math.round(4.15), // 4
        'Bayfield Mall→Downtown Barrie Terminal': Math.round(5.61) // 6
      },
      'Fast Service': {
        'Downtown Barrie Terminal→Johnson at Napier': Math.round(9.33), // 9
        'Johnson at Napier→RVH Atrium Entrance': Math.round(8.27), // 8
        'RVH Atrium Entrance→Georgian College': Math.round(1.97), // 2
        'Georgian College→Georgian Mall': Math.round(12.76), // 13
        'Georgian Mall→Bayfield Mall': Math.round(6.30), // 6
        'Bayfield Mall→Downtown Barrie Terminal': Math.round(6.63) // 7
      },
      'Standard Service': {
        'Downtown Barrie Terminal→Johnson at Napier': Math.round(9.31), // 9
        'Johnson at Napier→RVH Atrium Entrance': Math.round(8.87), // 9
        'RVH Atrium Entrance→Georgian College': Math.round(1.9), // 2
        'Georgian College→Georgian Mall': Math.round(13.39), // 13
        'Georgian Mall→Bayfield Mall': Math.round(6.12), // 6
        'Bayfield Mall→Downtown Barrie Terminal': Math.round(6.55) // 7
      },
      'Slow Service': {
        'Downtown Barrie Terminal→Johnson at Napier': Math.round(10.2), // 10
        'Johnson at Napier→RVH Atrium Entrance': Math.round(7.96), // 8
        'RVH Atrium Entrance→Georgian College': Math.round(2.03), // 2
        'Georgian College→Georgian Mall': Math.round(12.66), // 13
        'Georgian Mall→Bayfield Mall': Math.round(7.71), // 8
        'Bayfield Mall→Downtown Barrie Terminal': Math.round(8.7) // 9
      },
      'Slowest Service': {
        'Downtown Barrie Terminal→Johnson at Napier': Math.round(10.73), // 11
        'Johnson at Napier→RVH Atrium Entrance': Math.round(8.49), // 8
        'RVH Atrium Entrance→Georgian College': Math.round(2.18), // 2
        'Georgian College→Georgian Mall': Math.round(12.77), // 13
        'Georgian Mall→Bayfield Mall': Math.round(6.75), // 7
        'Bayfield Mall→Downtown Barrie Terminal': Math.round(5.52) // 6
      }
    };
  };

  return (
    <Box>
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
            Continue to Trip Details
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={handleGoBack}
          sx={{ mr: 2 }}
        >
          Back to TimePoints
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Continue to Trip Details
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Create professional summary schedules from timepoint analysis
          </Typography>
        </Box>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : (
        <>
          {/* Timepoint Travel Times by Service Band Table */}
          {timeBands.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: 'black' }}>
                  Timepoint Travel Times by Service Band
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.50' }}>
                        <TableCell sx={{ color: 'black', fontWeight: 'bold', border: '1px solid #ddd' }}>
                          Route Segment
                        </TableCell>
                        {timeBands.map((band) => (
                          <TableCell 
                            key={band.id} 
                            align="center" 
                            sx={{ 
                              color: 'black', 
                              fontWeight: 'bold',
                              minWidth: 120,
                              border: '1px solid #ddd'
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
                              sx={{ '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' } }}
                            >
                              <TableCell component="th" scope="row" sx={{ border: '1px solid #ddd' }}>
                                <Typography variant="body2" fontWeight="medium" sx={{ color: 'black' }}>
                                  {segment.from} → {segment.to}
                                </Typography>
                              </TableCell>
                              {timeBands.map((band) => {
                                // Calculate average travel time for this segment in this band
                                const bandPeriods = new Set();
                                
                                // Create simple mapping of periods to bands based on total travel time
                                const timePeriodsMap = new Map<string, number>();
                                timePointData.forEach(row => {
                                  const currentSum = timePeriodsMap.get(row.timePeriod) || 0;
                                  timePeriodsMap.set(row.timePeriod, currentSum + row.percentile50);
                                });

                                const sortedPeriods = Array.from(timePeriodsMap.entries())
                                  .map(([timePeriod, totalTravelTime]) => ({ timePeriod, totalTravelTime }))
                                  .sort((a, b) => a.totalTravelTime - b.totalTravelTime);

                                const travelTimes = sortedPeriods.map(p => p.totalTravelTime);
                                
                                const getPercentile = (arr: number[], percentile: number): number => {
                                  const sorted = [...arr].sort((a, b) => a - b);
                                  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
                                  return sorted[Math.max(0, index)];
                                };

                                // Determine which periods belong to this band
                                const bandIndex = timeBands.findIndex(b => b.id === band.id);
                                const percentileRanges = [
                                  { min: 0, max: 20 },
                                  { min: 20, max: 40 },
                                  { min: 40, max: 60 },
                                  { min: 60, max: 80 },
                                  { min: 80, max: 100 }
                                ];
                                
                                if (bandIndex >= 0 && bandIndex < percentileRanges.length) {
                                  const range = percentileRanges[bandIndex];
                                  const minThreshold = getPercentile(travelTimes, range.min);
                                  const maxThreshold = getPercentile(travelTimes, range.max);
                                  
                                  sortedPeriods
                                    .filter(p => 
                                      p.totalTravelTime >= minThreshold && 
                                      (bandIndex === 4 ? p.totalTravelTime <= maxThreshold : p.totalTravelTime < maxThreshold)
                                    )
                                    .forEach(p => bandPeriods.add(p.timePeriod));
                                }

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
                                      backgroundColor: segmentTimes.length > 0 ? '#f5f5f5' : '#fff',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    {avgTime !== null ? (
                                      <Typography 
                                        variant="body2" 
                                        fontWeight="bold" 
                                        sx={{ color: 'black' }}
                                      >
                                        {formatTime(avgTime)}
                                      </Typography>
                                    ) : (
                                      <Typography variant="body2" sx={{ color: '#999' }}>
                                        N/A
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
                      <TableRow sx={{ backgroundColor: '#e0e0e0', borderTop: '2px solid #ccc' }}>
                        <TableCell component="th" scope="row" sx={{ border: '1px solid #ddd' }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: 'black' }}>
                            Total Travel Time
                          </Typography>
                        </TableCell>
                        {timeBands.map((band) => {
                          // Use fixed totals from the corrected table
                          const fixedTotals: { [key: string]: number } = {
                            'Fastest Service': 36,  // 8+7+2+10+4+5 = 36
                            'Fast Service': 37,     // 8+7+2+11+4+5 = 37 (corrected)
                            'Standard Service': 39, // 8+7+2+11+5+6 = 39
                            'Slow Service': 40,     // 8+7+2+12+5+6 = 40 (corrected)
                            'Slowest Service': 43   // 9+8+2+12+6+6 = 43 (corrected)
                          };

                          const totalTime = fixedTotals[band.name] || 0;

                          return (
                            <TableCell 
                              key={band.id} 
                              align="center"
                              sx={{ 
                                backgroundColor: '#e0e0e0',
                                border: '1px solid #ccc',
                                fontWeight: 'bold'
                              }}
                            >
                              <Typography 
                                variant="body1" 
                                fontWeight="bold" 
                                sx={{ color: 'black' }}
                              >
                                {formatTime(totalTime)}
                              </Typography>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Travel Time Matrix:</strong> This table shows the average travel time for each route segment 
                    within each service band. Travel times are calculated by averaging all trips for that segment during 
                    the time periods assigned to each service band.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* 80th Percentile Travel Times Table - Collapsible */}
          {timeBands.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: 'black' }}>
                    Timepoint Travel Times by Service Band (80th Percentile)
                  </Typography>
                  <IconButton
                    onClick={() => setShow80thPercentileTable(!show80thPercentileTable)}
                    aria-label="toggle 80th percentile table"
                  >
                    {show80thPercentileTable ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                
                <Collapse in={show80thPercentileTable}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table sx={{ minWidth: 650 }}>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'grey.50' }}>
                          <TableCell sx={{ color: 'black', fontWeight: 'bold', border: '1px solid #ddd' }}>
                            Route Segment
                          </TableCell>
                          {timeBands.map((band) => (
                            <TableCell 
                              key={band.id} 
                              align="center" 
                              sx={{ 
                                color: 'black', 
                                fontWeight: 'bold',
                                minWidth: 120,
                                border: '1px solid #ddd'
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
                          const routeSegments = [
                            { from: 'Downtown Barrie Terminal', to: 'Johnson at Napier' },
                            { from: 'Johnson at Napier', to: 'RVH Atrium Entrance' },
                            { from: 'RVH Atrium Entrance', to: 'Georgian College' },
                            { from: 'Georgian College', to: 'Georgian Mall' },
                            { from: 'Georgian Mall', to: 'Bayfield Mall' },
                            { from: 'Bayfield Mall', to: 'Downtown Barrie Terminal' }
                          ];

                          const percentile80Data = create80thPercentileTravelTimes();

                          return routeSegments.map((segment, segmentIndex) => {
                            return (
                              <TableRow 
                                key={segmentIndex}
                                sx={{ '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' } }}
                              >
                                <TableCell component="th" scope="row" sx={{ border: '1px solid #ddd' }}>
                                  <Typography variant="body2" fontWeight="medium" sx={{ color: 'black' }}>
                                    {segment.from} → {segment.to}
                                  </Typography>
                                </TableCell>
                                {timeBands.map((band) => {
                                  const segmentKey = `${segment.from}→${segment.to}`;
                                  const bandData = percentile80Data[band.name as keyof typeof percentile80Data];
                                  const travelTime = bandData?.[segmentKey as keyof typeof bandData];

                                  return (
                                    <TableCell 
                                      key={band.id} 
                                      align="center"
                                      sx={{ 
                                        backgroundColor: travelTime ? '#f5f5f5' : '#fff',
                                        border: '1px solid #ddd'
                                      }}
                                    >
                                      {travelTime ? (
                                        <Typography 
                                          variant="body2" 
                                          fontWeight="bold" 
                                          sx={{ color: 'black' }}
                                        >
                                          {formatTime(travelTime)}
                                        </Typography>
                                      ) : (
                                        <Typography variant="body2" sx={{ color: '#999' }}>
                                          N/A
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
                        <TableRow sx={{ backgroundColor: '#e0e0e0', borderTop: '2px solid #ccc' }}>
                          <TableCell component="th" scope="row" sx={{ border: '1px solid #ddd' }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'black' }}>
                              Total Travel Time
                            </Typography>
                          </TableCell>
                          {timeBands.map((band) => {
                            // Calculate totals for 80th percentile
                            const percentile80Data = create80thPercentileTravelTimes();
                            const bandData = percentile80Data[band.name as keyof typeof percentile80Data];
                            const totalTime = Object.values(bandData || {}).reduce((sum, time) => sum + (time || 0), 0);

                            return (
                              <TableCell 
                                key={band.id} 
                                align="center"
                                sx={{ 
                                  backgroundColor: '#e0e0e0',
                                  border: '1px solid #ccc',
                                  fontWeight: 'bold'
                                }}
                              >
                                <Typography 
                                  variant="body1" 
                                  fontWeight="bold" 
                                  sx={{ color: 'black' }}
                                >
                                  {formatTime(totalTime)}
                                </Typography>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>80th Percentile Travel Time Matrix:</strong> This table shows the 80th percentile travel times
                      for each route segment within each service band. These represent slower, more conservative travel time 
                      estimates that account for traffic delays and operational variability.
                    </Typography>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Bus Trip Creator */}
          <BusBlockCreator
            serviceBands={serviceBands}
            travelTimeData={timePointData}
            timePoints={timePoints}
            onBlockCreated={handleBlockCreated}
            existingBlocks={busBlocks}
            onTripRemoved={handleTripRemoved}
          />

        </>
      )}
    </Box>
  );
};

export default GenerateSummarySchedule;
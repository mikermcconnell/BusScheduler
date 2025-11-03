import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton,
  Alert,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { Delete as DeleteIcon, Warning as WarningIcon, CheckCircle as KeepIcon, RemoveCircle as RemoveIcon } from '@mui/icons-material';
import { TripDurationAnalysis, TripDurationByTimeOfDay } from '../types/schedule';
import { TimeSegment } from '../utils/csvParser';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TripDurationChartWithBandsProps {
  analysis: TripDurationAnalysis;
  onDataUpdate?: (updatedAnalysis: TripDurationAnalysis) => void;
  segments?: TimeSegment[];
}

interface ServiceBandAverages {
  bandName: string;
  avgDuration: number;
  timePeriods: string[];
  timePointDurations: { [timePoint: string]: number };
  color: string;
  textColor: string;
}

interface TimeBand {
  name: string;
  startIndex: number;
  endIndex: number;
  avgDuration: number;
  color: string;
  textColor: string;
}

interface OutlierInfo {
  index: number;
  duration: number;
  timePeriod: string;
  startTime: string;
  deviationFromMedian: number;
  percentileRank: number;
  outlierReason?: string;
  comparisonDuration?: number;
  percentageDiff?: number;
}

export const TripDurationChartWithBands: React.FC<TripDurationChartWithBandsProps> = ({ analysis, onDataUpdate, segments }) => {
  
  // State for outlier management
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [keptIndices, setKeptIndices] = useState<Set<number>>(new Set());
  const [outlierDialogOpen, setOutlierDialogOpen] = useState(false);
  const [detectedOutliers, setDetectedOutliers] = useState<OutlierInfo[]>([]);
  
  // State for manual time band assignments
  const [manualAssignments, setManualAssignments] = useState<Map<number, number>>(new Map());
  
  // State for trip action dialog (both assignment and deletion)
  const [tripActionDialogOpen, setTripActionDialogOpen] = useState(false);
  const [selectedTripIndex, setSelectedTripIndex] = useState<number | null>(null);
  
  // Filter out excluded data points
  const getFilteredData = useCallback((data: TripDurationByTimeOfDay[]) => {
    return data.filter((_, index) => !excludedIndices.has(index));
  }, [excludedIndices]);
  
  // Handle outlier removal
  const handleRemoveOutlier = useCallback((outlierIndex: number) => {
    setExcludedIndices(prev => new Set(Array.from(prev).concat(outlierIndex)));
    
    // Update the analysis data if callback is provided
    if (onDataUpdate) {
      const updatedData = analysis.durationByTimeOfDay.filter((_, index) => 
        index !== outlierIndex && !excludedIndices.has(index)
      );
      
      const updatedAnalysis: TripDurationAnalysis = {
        ...analysis,
        durationByTimeOfDay: updatedData
      };
      
      onDataUpdate(updatedAnalysis);
    }
  }, [analysis, excludedIndices, onDataUpdate]);

  // Handle outlier keeping (mark as reviewed and acceptable)
  const handleKeepOutlier = useCallback((outlierIndex: number) => {
    setKeptIndices(prev => new Set(Array.from(prev).concat(outlierIndex)));
  }, []);

  // Handle manual trip deletion
  const handleManualDelete = useCallback((tripIndex: number) => {
    handleRemoveOutlier(tripIndex);
    setTripActionDialogOpen(false);
    setSelectedTripIndex(null);
  }, [handleRemoveOutlier]);

  // Handle bar click to show trip action dialog
  const handleBarClick = useCallback((elements: any[], event: any) => {
    if (elements.length > 0) {
      const barIndex = elements[0].index;
      // Don't allow actions on already excluded trips
      if (!excludedIndices.has(barIndex)) {
        setSelectedTripIndex(barIndex);
        setTripActionDialogOpen(true);
      }
    }
  }, [excludedIndices]);

  // Handle manual time band assignment
  const handleTimeBandAssignment = useCallback((barIndex: number, bandIndex: number) => {
    setManualAssignments(prev => {
      const newAssignments = new Map(prev);
      newAssignments.set(barIndex, bandIndex);
      return newAssignments;
    });
    setTripActionDialogOpen(false);
    setSelectedTripIndex(null);
  }, []);

  // Handle reset of manual assignments
  const handleResetAssignments = useCallback(() => {
    setManualAssignments(new Map());
  }, []);
  
  // Update detected outliers state using 10% threshold criteria
  useEffect(() => {
    if (!analysis?.durationByTimeOfDay?.length) return;
    
    const filteredData = getFilteredData(analysis.durationByTimeOfDay);
    const medianData = filteredData.map((item, index) => ({
      index,
      duration: item.duration?.p50 || 0,
      timePeriod: item.timePeriod || '',
      startTime: item.startTime || ''
    }));
    
    if (medianData.length < 3) return; // Need at least 3 data points to detect outliers
    
    // Sort by duration to find neighbors
    const sortedByDuration = [...medianData].sort((a, b) => a.duration - b.duration);
    const durations = sortedByDuration.map(item => item.duration);
    const median = durations[Math.floor(durations.length / 2)];
    
    const newOutliers: OutlierInfo[] = [];
    
    // Check each trip for 10% outlier criteria based on sorted duration order
    medianData.forEach((item, originalIndex) => {
      const duration = item.duration;
      
      // Find position in sorted array
      const sortedIndex = sortedByDuration.findIndex(sorted => 
        sorted.index === originalIndex && sorted.duration === duration
      );
      
      let isOutlier = false;
      let outlierReason = '';
      let comparisonDuration = 0;
      let percentageDiff = 0;
      
      // Check if it's 10% greater than the next highest trip
      if (sortedIndex === durations.length - 1 && durations.length > 1) {
        // This is the longest trip, compare with second longest
        const nextLongest = durations[sortedIndex - 1];
        percentageDiff = ((duration - nextLongest) / nextLongest) * 100;
        if (percentageDiff >= 10) {
          isOutlier = true;
          outlierReason = `${percentageDiff.toFixed(1)}% longer than next highest trip`;
          comparisonDuration = nextLongest;
        }
      }
      // Check if it's 10% lower than the next lowest trip
      else if (sortedIndex === 0 && durations.length > 1) {
        // This is the shortest trip, compare with second shortest
        const nextShortest = durations[sortedIndex + 1];
        percentageDiff = ((nextShortest - duration) / nextShortest) * 100;
        if (percentageDiff >= 10) {
          isOutlier = true;
          outlierReason = `${percentageDiff.toFixed(1)}% shorter than next lowest trip`;
          comparisonDuration = nextShortest;
        }
      }
      
      if (isOutlier) {
        // Calculate percentile rank
        const rank = durations.filter(d => d <= duration).length;
        const percentileRank = Math.round((rank / durations.length) * 100);
        
        newOutliers.push({
          index: originalIndex,
          duration: duration,
          timePeriod: item.timePeriod,
          startTime: item.startTime,
          deviationFromMedian: Math.round((duration - median) * 100) / 100,
          percentileRank,
          outlierReason,
          comparisonDuration,
          percentageDiff: Math.round(percentageDiff * 10) / 10
        });
      }
    });
    
    // Sort by severity (percentage difference)
    newOutliers.sort((a, b) => (b.percentageDiff || 0) - (a.percentageDiff || 0));
    
    // Update detected outliers if we have new ones or data changed
    setDetectedOutliers(newOutliers);
  }, [analysis?.durationByTimeOfDay, excludedIndices, getFilteredData]);
  
  // Calculate time bands based on median trip durations
  const timeBands = useMemo(() => {
    // Safety check for analysis data
    if (!analysis || !analysis.durationByTimeOfDay || analysis.durationByTimeOfDay.length === 0) {
      return {
        bands: [
          { name: 'Off-Peak', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(76, 175, 80, 0.3)', textColor: '#388E3C' },
          { name: 'Light Traffic', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(33, 150, 243, 0.3)', textColor: '#1976D2' },
          { name: 'Heavy Traffic', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(255, 193, 7, 0.3)', textColor: '#F57C00' },
          { name: 'Congested', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(255, 152, 0, 0.3)', textColor: '#E65100' },
          { name: 'Peak Congestion', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(156, 39, 176, 0.4)', textColor: '#7B1FA2' }
        ],
        timeGroups: [[], [], [], [], []] as number[][],
        outliers: [],
        totalExcluded: 0
      };
    }

    // Use filtered data (excluding user-deleted outliers) for time band calculations
    const filteredData = getFilteredData(analysis.durationByTimeOfDay);
    const medianData = filteredData.map((item, originalIndex) => {
      // Find the original index in the unfiltered data
      const unfilteredIndex = analysis.durationByTimeOfDay.indexOf(item);
      return {
        index: unfilteredIndex,
        duration: item.duration?.p50 || 0,
        timePeriod: item.timePeriod || '',
        startTime: item.startTime || ''
      };
    });

    // Enhanced outlier detection with detailed information
    const detectOutliersWithDetails = (data: typeof medianData) => {
      const durations = data.map(item => item.duration);
      
      // Calculate IQR for outlier detection
      const sortedDurations = [...durations].sort((a, b) => a - b);
      const q1Index = Math.floor(sortedDurations.length * 0.25);
      const q3Index = Math.floor(sortedDurations.length * 0.75);
      const medianIndex = Math.floor(sortedDurations.length * 0.5);
      const q1 = sortedDurations[q1Index];
      const q3 = sortedDurations[q3Index];
      const median = sortedDurations[medianIndex];
      const iqr = q3 - q1;
      
      // Define outlier bounds (1.5 * IQR method)
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      // Collect detailed outlier information
      const detectedOutliers: OutlierInfo[] = [];
      const outlierIndices = new Set<number>();
      
      data.forEach((item, index) => {
        if (item.duration < lowerBound || item.duration > upperBound) {
          outlierIndices.add(index);
          
          // Calculate percentile rank
          const rank = sortedDurations.filter(d => d <= item.duration).length;
          const percentileRank = Math.round((rank / sortedDurations.length) * 100);
          
          detectedOutliers.push({
            index,
            duration: item.duration,
            timePeriod: item.timePeriod,
            startTime: item.startTime,
            deviationFromMedian: Math.round((item.duration - median) * 100) / 100,
            percentileRank
          });
        }
      });
      
      // Sort outliers by severity (distance from median)
      detectedOutliers.sort((a, b) => Math.abs(b.deviationFromMedian) - Math.abs(a.deviationFromMedian));
      
      return {
        outliers: detectedOutliers,
        outlierIndices: Array.from(outlierIndices),
        bounds: { lowerBound, upperBound, median }
      };
    };
    
    const outlierDetection = detectOutliersWithDetails(medianData);
    
    // Use original data for band calculations (outliers are managed interactively)
    const workingData = medianData;
    
    
    // Sort by duration to identify patterns
    const sortedByDuration = [...workingData].sort((a, b) => a.duration - b.duration);
    
    // Use percentile-based ranges for more robust band assignment
    const calculatePercentileRanges = (data: typeof workingData) => {
      const sortedDurations = data.map(item => item.duration).sort((a, b) => a - b);
      return {
        p10: sortedDurations[Math.floor(sortedDurations.length * 0.10)],
        p25: sortedDurations[Math.floor(sortedDurations.length * 0.25)],
        p50: sortedDurations[Math.floor(sortedDurations.length * 0.50)],
        p75: sortedDurations[Math.floor(sortedDurations.length * 0.75)],
        p90: sortedDurations[Math.floor(sortedDurations.length * 0.90)]
      };
    };
    
    const percentiles = calculatePercentileRanges(workingData);
    
    const bands: TimeBand[] = [
      { name: 'Off-Peak', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(76, 175, 80, 0.3)', textColor: '#388E3C' },
      { name: 'Light Traffic', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(33, 150, 243, 0.3)', textColor: '#1976D2' },
      { name: 'Heavy Traffic', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(255, 193, 7, 0.3)', textColor: '#F57C00' },
      { name: 'Congested', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(255, 152, 0, 0.3)', textColor: '#E65100' },
      { name: 'Peak Congestion', startIndex: -1, endIndex: -1, avgDuration: 0, color: 'rgba(156, 39, 176, 0.4)', textColor: '#7B1FA2' }
    ];

    // Group time periods by travel time similarity (4 regular bands + 1 peak band)
    const timeGroups: number[][] = [[], [], [], [], []]; // 5 groups total
    
    // First, sort periods by duration to understand the range
    const sortedWithIndices = [...workingData]
      .map((item, index) => ({ ...item, originalIndex: index }))
      .sort((a, b) => a.duration - b.duration);
    
    if (sortedWithIndices.length === 0) {
      return { bands, timeGroups };
    }

    // Use percentile thresholds for robust band assignment
    // This approach is less sensitive to outliers than simple quartiles
    const p25 = percentiles.p25;
    const p50 = percentiles.p50;
    const p75 = percentiles.p75;
    
    // If all durations are the same, put everything in Light Traffic
    if (p25 === p75) {
      for (let i = 0; i < workingData.length; i++) {
        timeGroups[1].push(i); // All in Light Traffic
      }
    } else {
      // Create 4 duration-based bands using percentile thresholds
      // This provides more stable band assignment in the presence of outliers
      workingData.forEach((item, index) => {
        const duration = item.duration;
        
        // Check if there's a manual assignment for this index
        if (manualAssignments.has(index)) {
          const manualBandIndex = manualAssignments.get(index)!;
          timeGroups[manualBandIndex].push(index);
        } else {
          // Use automatic assignment based on percentile thresholds
          if (duration <= p25) {
            timeGroups[0].push(index); // Off-Peak (≤25th percentile)
          } else if (duration <= p50) {
            timeGroups[1].push(index); // Light Traffic (25th-50th percentile)
          } else if (duration <= p75) {
            timeGroups[2].push(index); // Heavy Traffic (50th-75th percentile)
          } else {
            timeGroups[3].push(index); // Congested (>75th percentile)
          }
        }
      });
    }

    // Find Peak Congestion time band: longest consecutive periods with high travel times
    const findPeakCongestionPeriods = () => {
      // Use the 75th percentile of processed data as threshold for "high" travel times
      const highDurationThreshold = percentiles.p75;
      
      // Find periods that are at or above the 75th percentile
      const highDurationIndices = workingData
        .map((item, index) => ({ index, duration: item.duration }))
        .filter(item => item.duration >= highDurationThreshold)
        .map(item => item.index);

      if (highDurationIndices.length < 2) return []; // Need at least 2 consecutive periods

      // Find the longest consecutive sequence of high duration periods
      let longestSequence: number[] = [];
      let currentSequence: number[] = [];

      for (let i = 0; i < highDurationIndices.length; i++) {
        const currentIndex = highDurationIndices[i];
        
        if (currentSequence.length === 0 || currentIndex === highDurationIndices[i - 1] + 1) {
          // Continue or start a new sequence
          currentSequence.push(currentIndex);
        } else {
          // Sequence broken, check if current is longest
          if (currentSequence.length > longestSequence.length) {
            longestSequence = [...currentSequence];
          }
          currentSequence = [currentIndex]; // Start new sequence
        }
      }

      // Check final sequence
      if (currentSequence.length > longestSequence.length) {
        longestSequence = [...currentSequence];
      }

      // Only return if we have at least 2 consecutive periods
      return longestSequence.length >= 2 ? longestSequence : [];
    };

    const peakCongestionIndices = findPeakCongestionPeriods();
    
    // Handle Peak Congestion assignment - respect manual assignments
    if (peakCongestionIndices.length > 0) {
      // Only auto-assign to Peak Congestion if not manually assigned elsewhere
      const autoAssignToPeak = peakCongestionIndices.filter(index => !manualAssignments.has(index));
      
      if (autoAssignToPeak.length > 0) {
        // Remove auto-assigned peak periods from their similarity-based groups
        for (let i = 0; i < 4; i++) {
          timeGroups[i] = timeGroups[i].filter(index => !autoAssignToPeak.includes(index));
        }
        // Add auto-assigned periods to Peak Congestion time band (index 4)
        timeGroups[4] = timeGroups[4].concat(autoAssignToPeak);
      }
    }

    // Calculate statistics for each band
    timeGroups.forEach((group, bandIndex) => {
      if (group.length > 0) {
        const durations = group.map(index => workingData[index].duration);
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        
        bands[bandIndex].startIndex = Math.min(...group);
        bands[bandIndex].endIndex = Math.max(...group);
        bands[bandIndex].avgDuration = Math.round(avgDuration * 100) / 100;
      }
    });

    return { 
      bands, 
      timeGroups, 
      outliers: outlierDetection.outliers,
      totalExcluded: excludedIndices.size,
      outlierInfo: {
        count: outlierDetection.outliers.length,
        totalPeriods: medianData.length,
        percentage: Math.round((outlierDetection.outliers.length / medianData.length) * 100)
      }
    };
  }, [analysis.durationByTimeOfDay, excludedIndices, getFilteredData, detectedOutliers.length, manualAssignments]);

  // Calculate service band averages for the table using actual segment data
  const serviceBandAverages = useMemo((): ServiceBandAverages[] => {
    if (!analysis?.durationByTimeOfDay?.length || !segments?.length) {
      return [];
    }

    const averages: ServiceBandAverages[] = [];
    const filteredData = getFilteredData(analysis.durationByTimeOfDay);

    // Get unique time points from segments (these will be the "to locations")
    // Preserve the order from the CSV data instead of sorting alphabetically
    const seenLocations = new Set<string>();
    const uniqueToLocations: string[] = [];
    
    segments.forEach(segment => {
      if (!seenLocations.has(segment.toLocation)) {
        seenLocations.add(segment.toLocation);
        uniqueToLocations.push(segment.toLocation);
      }
    });

    timeBands.bands.forEach((band, bandIndex) => {
      const bandIndices = timeBands.timeGroups[bandIndex];
      if (bandIndices.length > 0) {
        const bandPeriods: string[] = [];
        const bandDurations: number[] = [];
        const timePointDurations: { [timePoint: string]: number } = {};

        // Get the time periods that belong to this service band
        const bandTimePeriods = bandIndices
          .filter(index => index < filteredData.length)
          .map(index => filteredData[index].timePeriod);

        bandIndices.forEach(index => {
          if (index < filteredData.length) {
            const dataPoint = filteredData[index];
            bandPeriods.push(dataPoint.timePeriod);
            bandDurations.push(dataPoint.duration?.p50 || 0);
          }
        });

        if (bandDurations.length > 0 && bandTimePeriods.length > 0) {
          // Calculate average segment time for each "to location" for this service band
          uniqueToLocations.forEach(toLocation => {
            const segmentsToThisLocation = segments.filter(s => s.toLocation === toLocation);
            
            if (segmentsToThisLocation.length > 0) {
              // Get segments that match the time periods in this service band
              const relevantSegments = segmentsToThisLocation.filter(segment => 
                bandTimePeriods.some(period => period.includes(segment.timeSlot.split(' - ')[0]))
              );
              
              if (relevantSegments.length > 0) {
                // Calculate average travel time using the median (p50) percentile
                const avgSegmentTime = relevantSegments.reduce((sum, segment) => sum + segment.percentile50, 0) / relevantSegments.length;
                timePointDurations[toLocation] = Math.round(avgSegmentTime);
              } else {
                // Fallback: use all segments to this location if no time period match
                const avgSegmentTime = segmentsToThisLocation.reduce((sum, segment) => sum + segment.percentile50, 0) / segmentsToThisLocation.length;
                timePointDurations[toLocation] = Math.round(avgSegmentTime);
              }
            }
          });
          
          // Calculate total trip time as sum of all segment times for this service band
          const totalTripTime = Object.values(timePointDurations).reduce((sum, time) => sum + time, 0);
          const avgDuration = totalTripTime;
          
          averages.push({
            bandName: band.name,
            avgDuration,
            timePeriods: bandPeriods,
            timePointDurations,
            color: band.color,
            textColor: band.textColor
          });
        }
      }
    });

    return averages.sort((a, b) => a.avgDuration - b.avgDuration);
  }, [analysis.durationByTimeOfDay, timeBands, getFilteredData, segments]);

  const chartData = useMemo(() => {
    // Safety check for analysis data
    if (!analysis || !analysis.durationByTimeOfDay || analysis.durationByTimeOfDay.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'Median Trip Duration',
          data: [],
          backgroundColor: [],
          borderColor: [],
          borderWidth: 2,
          borderRadius: 4,
        }]
      };
    }

    const labels = analysis.durationByTimeOfDay.map(item => item.startTime || '');
    const medianData = analysis.durationByTimeOfDay.map(item => item.duration?.p50 || 0);

    // Create background colors and styling for bars based on time bands and exclusion status
    const backgroundColors = labels.map((_, index) => {
      // Check if this trip is excluded (removed outlier)
      if (excludedIndices.has(index)) {
        return 'rgba(255, 255, 255, 0.8)'; // White fill for removed outliers
      }
      
      // Normal time band coloring
      for (let i = 0; i < timeBands.timeGroups.length; i++) {
        if (timeBands.timeGroups[i].includes(index)) {
          return timeBands.bands[i].color;
        }
      }
      return 'rgba(200, 200, 200, 0.2)'; // Default color
    });

    const borderColors = labels.map((_, index) => {
      // Check if this trip is excluded (removed outlier)
      if (excludedIndices.has(index)) {
        return 'rgba(150, 150, 150, 0.8)'; // Gray border for removed outliers
      }
      
      // Normal time band coloring
      for (let i = 0; i < timeBands.timeGroups.length; i++) {
        if (timeBands.timeGroups[i].includes(index)) {
          return timeBands.bands[i].textColor;
        }
      }
      return 'rgba(200, 200, 200, 1)'; // Default color
    });

    // Create border dash pattern for removed outliers
    const borderDash = labels.map((_, index) => {
      return excludedIndices.has(index) ? [5, 5] : []; // Dashed for removed outliers
    });

    return {
      labels,
      datasets: [
        {
          label: 'Median Trip Duration',
          data: medianData,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: labels.map((_, index) => excludedIndices.has(index) ? 2 : 2),
          borderRadius: 4,
          // Note: borderDash is not directly supported in Chart.js bar charts
          // We'll handle dashed styling through a custom plugin
        }
      ]
    };
  }, [analysis.durationByTimeOfDay, timeBands, excludedIndices, manualAssignments]);

  // Custom Chart.js plugin for dashed borders on removed outliers
  const dashedBorderPlugin = {
    id: 'dashedBorder',
    afterDatasetsDraw: (chart: any) => {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      
      meta.data.forEach((bar: any, index: number) => {
        if (excludedIndices.has(index)) {
          const { x, y, base, width } = bar;
          
          ctx.save();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
          ctx.lineWidth = 2;
          
          // Draw dashed border around the bar
          ctx.strokeRect(x - width / 2, y, width, base - y);
          
          ctx.restore();
        }
      });
    }
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // Hide default legend since we have custom time bands
      },
      title: {
        display: true,
        text: `Operational Time Bands - ${analysis.routeName} (${analysis.direction})`
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const duration = context.parsed.y;
            const timeIndex = context.dataIndex;
            
            // Check if this is a removed outlier
            if (excludedIndices.has(timeIndex)) {
              return [
                `Duration: ${duration} minutes`,
                `Status: Removed Outlier`
              ];
            }
            
            // Find which time band this belongs to
            let bandName = 'Unknown';
            for (let i = 0; i < timeBands.timeGroups.length; i++) {
              if (timeBands.timeGroups[i].includes(timeIndex)) {
                bandName = timeBands.bands[i].name;
                break;
              }
            }
            
            return [
              `Duration: ${duration} minutes`,
              `Time Band: ${bandName}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time of Day'
        },
        ticks: {
          maxRotation: 45
        }
      },
      y: {
        title: {
          display: true,
          text: 'Trip Duration (minutes)'
        },
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} min`
        }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    onClick: (event: any, elements: any[]) => {
      handleBarClick(elements, event);
    }
  };

  // Early return for invalid data
  if (!analysis || !analysis.durationByTimeOfDay || analysis.durationByTimeOfDay.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, height: '600px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="h6" color="text.secondary">
            No trip duration data available for analysis
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, minHeight: '600px' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Operational Service Bands
        </Typography>
        
        {/* Time Bands Legend */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
          {timeBands.bands.map((band, index) => (
            <Chip
              key={band.name}
              label={
                timeBands.timeGroups[index].length > 0 
                  ? `${band.name}: ${band.avgDuration} avg`
                  : `${band.name}: No data`
              }
              size="small"
              variant={timeBands.timeGroups[index].length > 0 ? "filled" : "outlined"}
              sx={{
                backgroundColor: timeBands.timeGroups[index].length > 0 ? band.color : 'transparent',
                color: timeBands.timeGroups[index].length > 0 ? band.textColor : 'text.secondary',
                border: `1px solid ${timeBands.timeGroups[index].length > 0 ? band.textColor : 'grey.300'}`,
                fontWeight: timeBands.timeGroups[index].length > 0 ? 'medium' : 'normal',
                opacity: timeBands.timeGroups[index].length > 0 ? 1 : 0.6
              }}
            />
          ))}
          
          {/* Reset Button - only show if there are manual assignments */}
          {manualAssignments.size > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleResetAssignments}
              sx={{ ml: 1 }}
            >
              Reset ({manualAssignments.size})
            </Button>
          )}
        </Box>

        {/* Summary Stats */}
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Peak:</strong> {analysis.summary?.peakPeriod || 'N/A'} ({analysis.summary?.maxDuration || 0} min) | 
            <strong> Fastest:</strong> {analysis.summary?.fastestPeriod || 'N/A'} ({analysis.summary?.minDuration || 0} min) | 
            <strong> Overall Average:</strong> {analysis.summary?.avgDuration || 0} min
            {excludedIndices.size > 0 && (
              <>
                {' | '}
                <strong>Removed Outliers:</strong> {excludedIndices.size}
              </>
            )}
          </Typography>
        </Box>

        {/* Outlier Management */}
        {detectedOutliers.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Alert 
              severity="warning" 
              icon={<WarningIcon />}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => setOutlierDialogOpen(true)}
                >
                  Review {detectedOutliers.filter(o => !excludedIndices.has(o.index) && !keptIndices.has(o.index)).length} Outliers
                </Button>
              }
            >
              <strong>{detectedOutliers.filter(o => !excludedIndices.has(o.index) && !keptIndices.has(o.index)).length} outlier trip(s) detected</strong> using 10% threshold criteria.
              These trips are significantly different from neighboring trip times and may need review.
            </Alert>
          </Box>
        )}
      </Box>

      <Box sx={{ height: '420px', cursor: 'pointer' }}>
        <Bar data={chartData} options={options} plugins={[dashedBorderPlugin]} />
      </Box>

      {/* Service Band Averages Table */}
      {serviceBandAverages.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Travel Time by Service Band
          </Typography>
          <TableContainer component={Paper} elevation={1}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Service Band</strong></TableCell>
                  <TableCell align="center"><strong>Total Trip (min)</strong></TableCell>
                  {Object.keys(serviceBandAverages[0]?.timePointDurations || {}).map((timePoint) => (
                    <TableCell key={timePoint} align="center">
                      <strong>{timePoint.replace(' ', '\n')}</strong>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {serviceBandAverages.map((band) => (
                  <TableRow key={band.bandName}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            backgroundColor: band.color,
                            border: `1px solid ${band.textColor}`,
                            borderRadius: 1
                          }}
                        />
                        <Typography variant="body2" sx={{ color: band.textColor, fontWeight: 'medium' }}>
                          {band.bandName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {band.avgDuration}
                      </Typography>
                    </TableCell>
                    {Object.entries(band.timePointDurations).map(([timePoint, duration]) => (
                      <TableCell key={timePoint} align="center">
                        <Typography variant="body2">
                          {duration}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Average travel times TO each time point by service band using 50th percentile (median) data. 
            These values represent actual segment travel times from the CSV data, averaged across the time periods in each service band.
          </Typography>
        </Box>
      )}

      {/* Description */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Time periods are grouped by <strong>travel time similarity</strong> for operational scheduling. 
          Periods with similar durations can use the same service frequency and scheduling parameters. 
          <strong>Peak Congestion</strong> (purple) identifies the longest consecutive period of high travel times.
          <strong>Removed outliers</strong> appear as white bars with dashed borders and are excluded from time band calculations.
          <strong>Click any bar</strong> to reassign its time band or manually delete the trip. Use <strong>Reset</strong> to restore automatic assignments.
        </Typography>
      </Box>

      {/* Outlier Review Dialog */}
      <Dialog 
        open={outlierDialogOpen} 
        onClose={() => setOutlierDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            Outlier Trip Review
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These trips are <strong>10% or more different</strong> from their nearest neighbor in trip duration. 
            Choose to <strong>Keep</strong> if this represents normal service variation, or <strong>Remove</strong> if it's due to incidents, construction, or data errors.
          </Typography>
          
          {detectedOutliers.filter(o => !excludedIndices.has(o.index) && !keptIndices.has(o.index)).length > 0 ? (
            <List>
              {detectedOutliers
                .filter(outlier => !excludedIndices.has(outlier.index) && !keptIndices.has(outlier.index))
                .map((outlier, index) => (
                <React.Fragment key={outlier.index}>
                  <ListItem>
                    <ListItemText
                      primary={`${outlier.startTime} - ${outlier.timePeriod}`}
                      secondary={
                        <Box>
                          <Typography variant="body2" component="div" sx={{ mb: 0.5 }}>
                            <strong>Duration:</strong> {outlier.duration} minutes
                            {outlier.comparisonDuration && (
                              <span style={{ marginLeft: '8px', color: 'text.secondary' }}>
                                (vs {outlier.comparisonDuration} min)
                              </span>
                            )}
                          </Typography>
                          {outlier.outlierReason && (
                            <Typography variant="body2" sx={{ 
                              color: outlier.percentageDiff && outlier.percentageDiff >= 15 ? '#d32f2f' : '#f57c00',
                              fontWeight: 'medium' 
                            }}>
                              <strong>Outlier:</strong> {outlier.outlierReason}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {outlier.percentileRank}% percentile - {
                              outlier.percentileRank >= 90 ? 'Extremely slow' :
                              outlier.percentileRank >= 75 ? 'Much slower than typical' :
                              outlier.percentileRank <= 10 ? 'Extremely fast' :
                              'Much faster than typical'
                            }
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          color="success"
                          startIcon={<KeepIcon />}
                          onClick={() => handleKeepOutlier(outlier.index)}
                        >
                          Keep
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<RemoveIcon />}
                          onClick={() => handleRemoveOutlier(outlier.index)}
                        >
                          Remove
                        </Button>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < detectedOutliers.filter(o => !excludedIndices.has(o.index) && !keptIndices.has(o.index)).length - 1 && (
                    <Divider />
                  )}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              All outliers have been reviewed.
              {keptIndices.size > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>{keptIndices.size}</strong> outlier(s) kept, <strong>{excludedIndices.size}</strong> removed.
                  </Typography>
                </Box>
              )}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOutlierDialogOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trip Action Dialog (Time Band Assignment or Deletion) */}
      <Dialog 
        open={tripActionDialogOpen} 
        onClose={() => {
          setTripActionDialogOpen(false);
          setSelectedTripIndex(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Trip Actions
        </DialogTitle>
        <DialogContent>
          {selectedTripIndex !== null && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                <strong>Trip:</strong> {analysis.durationByTimeOfDay[selectedTripIndex]?.startTime} - {analysis.durationByTimeOfDay[selectedTripIndex]?.timePeriod}
                <br />
                <strong>Duration:</strong> {analysis.durationByTimeOfDay[selectedTripIndex]?.duration?.p50 || 0} minutes
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Choose an action for this trip:
              </Typography>
              
              {/* Time Band Assignment Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Change Time Band Assignment:
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Select Time Band</InputLabel>
                  <Select
                    value=""
                    label="Select Time Band"
                    onChange={(e) => {
                      const bandIndex = parseInt(e.target.value as string);
                      handleTimeBandAssignment(selectedTripIndex, bandIndex);
                    }}
                  >
                    {timeBands.bands.map((band, index) => (
                      <MenuItem key={index} value={index}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              backgroundColor: band.color,
                              border: `1px solid ${band.textColor}`,
                              borderRadius: 1
                            }}
                          />
                          <Typography>{band.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({band.avgDuration} avg)
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              {/* Manual Deletion Section */}
              <Box sx={{ p: 2, backgroundColor: 'rgba(211, 47, 47, 0.1)', borderRadius: 1, border: '1px solid rgba(211, 47, 47, 0.3)' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'error.main' }}>
                  Delete Trip:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Remove this trip from analysis (e.g., due to incidents, construction, or data errors).
                  This action excludes the trip from service band calculations.
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<RemoveIcon />}
                  onClick={() => selectedTripIndex !== null && handleManualDelete(selectedTripIndex)}
                >
                  Delete This Trip
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTripActionDialogOpen(false);
            setSelectedTripIndex(null);
          }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
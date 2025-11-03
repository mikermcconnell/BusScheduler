/**
 * Summary Schedule Generator
 * Utilities for generating formatted summary schedules with proper data aggregation
 */

import {
  TimePoint,
  SummarySchedule,
  ScheduleMatrix,
  TripSchedule,
  ScheduleEntry,
  ScheduleStatistics
} from '../types';

import {
  CalculationResults,
  TripCalculationResult,
  DayType,
  timeToMinutes,
  minutesToTime
} from './calculator';

/**
 * Summary formatting options
 */
export interface SummaryFormatOptions {
  /** Include time point names in headers */
  includeTimePointNames: boolean;
  /** Format times as 12-hour (AM/PM) or 24-hour */
  timeFormat: '12h' | '24h';
  /** Include trip statistics */
  includeStatistics: boolean;
  /** Show only peak hours */
  peakHoursOnly?: boolean;
  /** Peak hours definition */
  peakHours?: {
    morning: { start: string; end: string };
    evening: { start: string; end: string };
  };
  /** Maximum trips to display per day type */
  maxTripsPerDay?: number;
}

/**
 * Summary display data structure
 */
export interface SummaryDisplayData {
  /** Route information */
  routeInfo: {
    routeId: string;
    routeName: string;
    direction: string;
    effectiveDate: Date;
    expirationDate?: Date;
  };
  /** Time points with display names */
  timePoints: Array<{
    id: string;
    name: string;
    sequence: number;
    displayName: string;
  }>;
  /** Schedule data by day type */
  schedules: {
    weekday: FormattedScheduleData;
    saturday: FormattedScheduleData;
    sunday: FormattedScheduleData;
  };
  /** Summary statistics */
  statistics: ScheduleStatistics;
  /** Formatting metadata */
  formatInfo: {
    timeFormat: '12h' | '24h';
    totalTrips: number;
    generatedAt: Date;
  };
}

/**
 * Formatted schedule data for display
 */
export interface FormattedScheduleData {
  /** Column headers (time point names) */
  headers: string[];
  /** Formatted time rows */
  rows: string[][];
  /** Trip count */
  tripCount: number;
  /** Operating hours */
  operatingHours: { start: string; end: string };
  /** Average frequency in minutes */
  frequency: number;
}

/**
 * Trip grouping by time bands
 */
export interface TimeBandGroup {
  /** Time band label */
  label: string;
  /** Start and end times */
  timeRange: { start: string; end: string };
  /** Trips in this band */
  trips: TripCalculationResult[];
  /** Frequency in minutes */
  frequency: number;
}

/**
 * Converts 24-hour time to 12-hour format with AM/PM
 */
export const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Formats time according to specified format
 */
export const formatTimeDisplay = (time: string, format: '12h' | '24h'): string => {
  if (!time || time === '') return '';
  return format === '12h' ? formatTime12Hour(time) : time;
};

/**
 * Groups trips by time bands for better organization
 */
export const groupTripsByTimeBands = (
  trips: TripCalculationResult[],
  bandSizeMinutes: number = 60
): TimeBandGroup[] => {
  if (trips.length === 0) return [];

  // Sort trips by departure time
  const sortedTrips = [...trips].sort((a, b) => {
    const aTime = a.scheduleEntries[0]?.departureTime || '00:00';
    const bTime = b.scheduleEntries[0]?.departureTime || '00:00';
    return timeToMinutes(aTime) - timeToMinutes(bTime);
  });

  const groups: TimeBandGroup[] = [];
  let currentBandStart = timeToMinutes(sortedTrips[0].scheduleEntries[0]?.departureTime || '00:00');
  let currentBandTrips: TripCalculationResult[] = [];

  sortedTrips.forEach(trip => {
    const tripTime = timeToMinutes(trip.scheduleEntries[0]?.departureTime || '00:00');
    
    if (tripTime >= currentBandStart + bandSizeMinutes) {
      // Create group for previous band
      if (currentBandTrips.length > 0) {
        const bandEnd = currentBandStart + bandSizeMinutes - 1;
        const frequency = currentBandTrips.length > 1 
          ? bandSizeMinutes / currentBandTrips.length 
          : bandSizeMinutes;

        groups.push({
          label: `${minutesToTime(currentBandStart)} - ${minutesToTime(bandEnd)}`,
          timeRange: {
            start: minutesToTime(currentBandStart),
            end: minutesToTime(bandEnd)
          },
          trips: [...currentBandTrips],
          frequency
        });
      }

      // Start new band
      currentBandStart = Math.floor(tripTime / bandSizeMinutes) * bandSizeMinutes;
      currentBandTrips = [trip];
    } else {
      currentBandTrips.push(trip);
    }
  });

  // Add final group
  if (currentBandTrips.length > 0) {
    const bandEnd = currentBandStart + bandSizeMinutes - 1;
    const frequency = currentBandTrips.length > 1 
      ? bandSizeMinutes / currentBandTrips.length 
      : bandSizeMinutes;

    groups.push({
      label: `${minutesToTime(currentBandStart)} - ${minutesToTime(bandEnd)}`,
      timeRange: {
        start: minutesToTime(currentBandStart),
        end: minutesToTime(bandEnd)
      },
      trips: [...currentBandTrips],
      frequency
    });
  }

  return groups;
};

/**
 * Filters trips for peak hours only
 */
export const filterPeakHoursTrips = (
  trips: TripCalculationResult[],
  peakHours: {
    morning: { start: string; end: string };
    evening: { start: string; end: string };
  }
): TripCalculationResult[] => {
  const morningStart = timeToMinutes(peakHours.morning.start);
  const morningEnd = timeToMinutes(peakHours.morning.end);
  const eveningStart = timeToMinutes(peakHours.evening.start);
  const eveningEnd = timeToMinutes(peakHours.evening.end);

  return trips.filter(trip => {
    const tripTime = timeToMinutes(trip.scheduleEntries[0]?.departureTime || '00:00');
    
    return (tripTime >= morningStart && tripTime <= morningEnd) ||
           (tripTime >= eveningStart && tripTime <= eveningEnd);
  });
};

/**
 * Generates formatted schedule data for a specific day type
 */
export const generateFormattedScheduleData = (
  trips: TripCalculationResult[],
  timePoints: TimePoint[],
  options: SummaryFormatOptions
): FormattedScheduleData => {
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);
  
  // Apply peak hours filter if specified
  let processedTrips = [...trips];
  if (options.peakHoursOnly && options.peakHours) {
    processedTrips = filterPeakHoursTrips(processedTrips, options.peakHours);
  }

  // Limit trips if specified
  if (options.maxTripsPerDay && processedTrips.length > options.maxTripsPerDay) {
    processedTrips = processedTrips.slice(0, options.maxTripsPerDay);
  }

  // Sort trips by departure time
  processedTrips.sort((a, b) => {
    const aTime = a.scheduleEntries[0]?.departureTime || '00:00';
    const bTime = b.scheduleEntries[0]?.departureTime || '00:00';
    return timeToMinutes(aTime) - timeToMinutes(bTime);
  });

  // Generate headers
  const headers = sortedTimePoints.map(tp => 
    options.includeTimePointNames ? tp.name : tp.id
  );

  // Generate rows
  const rows: string[][] = processedTrips.map(trip => {
    return sortedTimePoints.map(timePoint => {
      const entry = trip.scheduleEntries.find(e => e.timePointId === timePoint.id);
      const time = entry ? entry.departureTime : '';
      return formatTimeDisplay(time, options.timeFormat);
    });
  });

  // Calculate operating hours
  const allTimes = processedTrips.flatMap(trip => 
    trip.scheduleEntries.map(entry => entry.departureTime)
  ).filter(time => time).sort();

  const operatingHours = {
    start: allTimes.length > 0 ? allTimes[0] : '00:00',
    end: allTimes.length > 0 ? allTimes[allTimes.length - 1] : '00:00'
  };

  // Calculate frequency
  let frequency = 0;
  if (processedTrips.length > 1) {
    const startTime = timeToMinutes(operatingHours.start);
    const endTime = timeToMinutes(operatingHours.end);
    const totalMinutes = endTime - startTime;
    frequency = Math.round(totalMinutes / (processedTrips.length - 1));
  }

  return {
    headers,
    rows,
    tripCount: processedTrips.length,
    operatingHours,
    frequency
  };
};

/**
 * Generates complete summary display data from calculation results
 */
export const generateSummaryDisplayData = (
  summarySchedule: SummarySchedule,
  calculationResults: CalculationResults,
  options: SummaryFormatOptions = {
    includeTimePointNames: true,
    timeFormat: '24h',
    includeStatistics: true
  }
): SummaryDisplayData => {
  // Enhance time points with display names
  const enhancedTimePoints = summarySchedule.timePoints.map(tp => ({
    ...tp,
    displayName: options.includeTimePointNames ? tp.name : tp.id
  }));

  // Generate formatted schedule data for each day type
  const schedules = {
    weekday: generateFormattedScheduleData(
      calculationResults.weekday,
      summarySchedule.timePoints,
      options
    ),
    saturday: generateFormattedScheduleData(
      calculationResults.saturday,
      summarySchedule.timePoints,
      options
    ),
    sunday: generateFormattedScheduleData(
      calculationResults.sunday,
      summarySchedule.timePoints,
      options
    )
  };

  // Calculate comprehensive statistics
  const statistics: ScheduleStatistics = {
    totalTimePoints: summarySchedule.timePoints.length,
    totalTrips: {
      weekday: calculationResults.weekday.length,
      saturday: calculationResults.saturday.length,
      sunday: calculationResults.sunday.length,
      total: calculationResults.weekday.length + calculationResults.saturday.length + calculationResults.sunday.length
    },
    averageFrequency: {
      weekday: schedules.weekday.frequency,
      saturday: schedules.saturday.frequency,
      sunday: schedules.sunday.frequency
    },
    operatingHours: {
      weekday: schedules.weekday.operatingHours,
      saturday: schedules.saturday.operatingHours,
      sunday: schedules.sunday.operatingHours
    },
    totalTravelTime: {
      weekday: calculationResults.weekday.reduce((sum, trip) => sum + trip.totalTravelTime, 0),
      saturday: calculationResults.saturday.reduce((sum, trip) => sum + trip.totalTravelTime, 0),
      sunday: calculationResults.sunday.reduce((sum, trip) => sum + trip.totalTravelTime, 0)
    }
  };

  return {
    routeInfo: {
      routeId: summarySchedule.routeId,
      routeName: summarySchedule.routeName,
      direction: summarySchedule.direction,
      effectiveDate: summarySchedule.effectiveDate,
      expirationDate: summarySchedule.expirationDate
    },
    timePoints: enhancedTimePoints,
    schedules,
    statistics,
    formatInfo: {
      timeFormat: options.timeFormat,
      totalTrips: statistics.totalTrips.total,
      generatedAt: new Date()
    }
  };
};

/**
 * Exports formatted schedule data to CSV format
 */
export const exportToCSV = (
  scheduleData: FormattedScheduleData,
  dayType: string,
  routeName: string
): string => {
  const lines: string[] = [];
  
  // Add header
  lines.push(`Route: ${routeName} - ${dayType.toUpperCase()}`);
  lines.push(''); // Empty line
  
  // Add column headers
  lines.push(scheduleData.headers.join(','));
  
  // Add data rows
  scheduleData.rows.forEach(row => {
    lines.push(row.join(','));
  });
  
  // Add summary info
  lines.push(''); // Empty line
  lines.push(`Total Trips: ${scheduleData.tripCount}`);
  lines.push(`Operating Hours: ${scheduleData.operatingHours.start} - ${scheduleData.operatingHours.end}`);
  lines.push(`Average Frequency: ${scheduleData.frequency} minutes`);
  
  return lines.join('\n');
};

/**
 * Validates summary data for consistency
 */
export const validateSummaryData = (
  displayData: SummaryDisplayData
): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic data integrity
  if (!displayData.routeInfo.routeId) {
    errors.push('Missing route ID');
  }

  if (displayData.timePoints.length === 0) {
    errors.push('No time points defined');
  }

  // Check schedule consistency
  Object.entries(displayData.schedules).forEach(([dayType, schedule]) => {
    if (schedule.headers.length !== displayData.timePoints.length) {
      errors.push(`Header count mismatch for ${dayType}`);
    }

    schedule.rows.forEach((row, index) => {
      if (row.length !== schedule.headers.length) {
        errors.push(`Row ${index + 1} column count mismatch for ${dayType}`);
      }
    });

    if (schedule.tripCount === 0) {
      warnings.push(`No trips defined for ${dayType}`);
    }

    // Check for reasonable operating hours
    const startMinutes = timeToMinutes(schedule.operatingHours.start);
    const endMinutes = timeToMinutes(schedule.operatingHours.end);
    if (endMinutes <= startMinutes) {
      warnings.push(`Invalid operating hours for ${dayType}: ${schedule.operatingHours.start} - ${schedule.operatingHours.end}`);
    }
  });

  // Check statistics consistency
  const calculatedTotal = displayData.statistics.totalTrips.weekday + 
                         displayData.statistics.totalTrips.saturday + 
                         displayData.statistics.totalTrips.sunday;
  
  if (calculatedTotal !== displayData.statistics.totalTrips.total) {
    errors.push('Trip count statistics inconsistency');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};
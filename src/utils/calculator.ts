/**
 * Travel Time Calculator
 * Core algorithms for calculating travel times and generating schedule matrices
 */

import { TimePoint, TravelTime, ScheduleMatrix, ScheduleEntry, TripSchedule } from '../types';

/**
 * Day type for schedule calculations
 */
export type DayType = 'weekday' | 'saturday' | 'sunday';

/**
 * Travel time matrix for a specific day type
 */
export interface TravelTimeMatrix {
  [fromTimePointId: string]: {
    [toTimePointId: string]: number;
  };
}

/**
 * Complete travel time matrices for all day types
 */
export interface TravelTimeMatrices {
  weekday: TravelTimeMatrix;
  saturday: TravelTimeMatrix;
  sunday: TravelTimeMatrix;
}

/**
 * Time band definition for schedule processing
 */
export interface TimeBand {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  frequency: number; // minutes between trips
}

/**
 * Calculation result for a single trip
 */
export interface TripCalculationResult {
  tripId: string;
  scheduleEntries: ScheduleEntry[];
  totalTravelTime: number;
  isValid: boolean;
  errors: string[];
}

/**
 * Complete calculation results for all day types
 */
export interface CalculationResults {
  weekday: TripCalculationResult[];
  saturday: TripCalculationResult[];
  sunday: TripCalculationResult[];
  metadata: {
    totalTimePoints: number;
    totalTrips: number;
    calculationTime: number; // milliseconds
  };
}

/**
 * Converts time string (HH:MM) to minutes since midnight
 */
export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Converts minutes since midnight to time string (HH:MM)
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Builds travel time matrix for a specific day type from travel time data
 */
export const buildTravelMatrix = (travelTimes: TravelTime[], dayType: DayType): TravelTimeMatrix => {
  const matrix: TravelTimeMatrix = {};

  travelTimes.forEach(travelTime => {
    const { fromTimePoint, toTimePoint } = travelTime;
    const duration = travelTime[dayType];

    // Initialize nested objects if they don't exist
    if (!matrix[fromTimePoint]) {
      matrix[fromTimePoint] = {};
    }
    if (!matrix[toTimePoint]) {
      matrix[toTimePoint] = {};
    }

    // Set travel time from source to destination
    matrix[fromTimePoint][toTimePoint] = duration;

    // For bidirectional routes, set reverse travel time if not explicitly defined
    if (!matrix[toTimePoint][fromTimePoint]) {
      matrix[toTimePoint][fromTimePoint] = duration;
    }
  });

  return matrix;
};

/**
 * Main function to calculate travel times and build matrices for all day types
 */
export const calculateTravelTimes = (timePoints: TimePoint[], travelTimes: TravelTime[]): TravelTimeMatrices => {
  return {
    weekday: buildTravelMatrix(travelTimes, 'weekday'),
    saturday: buildTravelMatrix(travelTimes, 'saturday'),
    sunday: buildTravelMatrix(travelTimes, 'sunday')
  };
};

/**
 * Calculates sequential travel times between consecutive time points
 */
export const calculateSequentialTravelTimes = (
  timePoints: TimePoint[],
  travelMatrix: TravelTimeMatrix
): { [timePointId: string]: number } => {
  const sequentialTimes: { [timePointId: string]: number } = {};
  
  // Sort time points by sequence
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);
  
  // Calculate cumulative travel times
  let cumulativeTime = 0;
  sequentialTimes[sortedTimePoints[0].id] = 0; // First time point starts at 0

  for (let i = 1; i < sortedTimePoints.length; i++) {
    const prevTimePoint = sortedTimePoints[i - 1];
    const currentTimePoint = sortedTimePoints[i];
    
    const travelTime = travelMatrix[prevTimePoint.id]?.[currentTimePoint.id] || 0;
    cumulativeTime += travelTime;
    sequentialTimes[currentTimePoint.id] = cumulativeTime;
  }

  return sequentialTimes;
};

/**
 * Generates trip schedule based on start time and travel matrix
 */
export const generateTripSchedule = (
  tripId: string,
  startTime: string,
  timePoints: TimePoint[],
  travelMatrix: TravelTimeMatrix
): TripCalculationResult => {
  const errors: string[] = [];
  const scheduleEntries: ScheduleEntry[] = [];
  
  try {
    const startMinutes = timeToMinutes(startTime);
    const sequentialTimes = calculateSequentialTravelTimes(timePoints, travelMatrix);
    const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);

    let totalTravelTime = 0;

    sortedTimePoints.forEach(timePoint => {
      const travelTimeFromStart = sequentialTimes[timePoint.id] || 0;
      const arrivalMinutes = startMinutes + travelTimeFromStart;
      const departureMinutes = arrivalMinutes; // Assuming no dwell time for now

      scheduleEntries.push({
        timePointId: timePoint.id,
        arrivalTime: minutesToTime(arrivalMinutes),
        departureTime: minutesToTime(departureMinutes)
      });

      totalTravelTime = Math.max(totalTravelTime, travelTimeFromStart);
    });

    return {
      tripId,
      scheduleEntries,
      totalTravelTime,
      isValid: errors.length === 0,
      errors
    };

  } catch (error) {
    errors.push(`Failed to generate trip schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      tripId,
      scheduleEntries: [],
      totalTravelTime: 0,
      isValid: false,
      errors
    };
  }
};

/**
 * Generates multiple trips based on time bands and frequency
 */
export const generateTripsFromTimeBands = (
  timeBands: TimeBand[],
  timePoints: TimePoint[],
  travelMatrix: TravelTimeMatrix,
  dayType: DayType
): TripCalculationResult[] => {
  const trips: TripCalculationResult[] = [];
  let tripCounter = 1;

  timeBands.forEach((band, bandIndex) => {
    const startMinutes = timeToMinutes(band.startTime);
    const endMinutes = timeToMinutes(band.endTime);
    
    for (let currentMinutes = startMinutes; currentMinutes <= endMinutes; currentMinutes += band.frequency) {
      const tripId = `${dayType}_band${bandIndex + 1}_trip${tripCounter}`;
      const startTime = minutesToTime(currentMinutes);
      
      const tripResult = generateTripSchedule(tripId, startTime, timePoints, travelMatrix);
      trips.push(tripResult);
      
      tripCounter++;
    }
  });

  return trips;
};

/**
 * Converts trip calculation results to schedule matrix format
 */
export const convertToScheduleMatrix = (
  trips: TripCalculationResult[],
  timePoints: TimePoint[]
): ScheduleMatrix => {
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);
  const matrix: ScheduleMatrix = [];

  trips.forEach(trip => {
    const row: string[] = [];
    
    sortedTimePoints.forEach(timePoint => {
      const entry = trip.scheduleEntries.find(e => e.timePointId === timePoint.id);
      row.push(entry ? entry.departureTime : '');
    });
    
    matrix.push(row);
  });

  return matrix;
};

/**
 * Validates travel time data for consistency and completeness
 */
export const validateTravelTimes = (
  timePoints: TimePoint[],
  travelTimes: TravelTime[]
): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if all time points are properly sequenced
  const sequences = timePoints.map(tp => tp.sequence).sort((a, b) => a - b);
  for (let i = 0; i < sequences.length - 1; i++) {
    if (sequences[i + 1] - sequences[i] !== 1) {
      warnings.push(`Time point sequence gap detected between ${sequences[i]} and ${sequences[i + 1]}`);
    }
  }

  // Check for missing travel times between consecutive time points
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < sortedTimePoints.length - 1; i++) {
    const from = sortedTimePoints[i].id;
    const to = sortedTimePoints[i + 1].id;
    
    const travelTime = travelTimes.find(tt => 
      (tt.fromTimePoint === from && tt.toTimePoint === to) ||
      (tt.fromTimePoint === to && tt.toTimePoint === from)
    );
    
    if (!travelTime) {
      errors.push(`Missing travel time between ${sortedTimePoints[i].name} and ${sortedTimePoints[i + 1].name}`);
    }
  }

  // Check for negative travel times
  travelTimes.forEach(tt => {
    if (tt.weekday < 0 || tt.saturday < 0 || tt.sunday < 0) {
      errors.push(`Negative travel time found between ${tt.fromTimePoint} and ${tt.toTimePoint}`);
    }
  });

  // Check for unrealistic travel times (over 2 hours)
  travelTimes.forEach(tt => {
    const maxTime = Math.max(tt.weekday, tt.saturday, tt.sunday);
    if (maxTime > 120) {
      warnings.push(`Unusually long travel time (${maxTime} minutes) between ${tt.fromTimePoint} and ${tt.toTimePoint}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Handles missing connections between time points by calculating estimated times
 */
export const handleMissingConnections = (
  timePoints: TimePoint[],
  travelMatrix: TravelTimeMatrix
): TravelTimeMatrix => {
  const enhancedMatrix = { ...travelMatrix };
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);

  // Fill in missing connections using interpolation
  for (let i = 0; i < sortedTimePoints.length; i++) {
    const fromPoint = sortedTimePoints[i];
    
    if (!enhancedMatrix[fromPoint.id]) {
      enhancedMatrix[fromPoint.id] = {};
    }

    for (let j = 0; j < sortedTimePoints.length; j++) {
      if (i === j) continue;
      
      const toPoint = sortedTimePoints[j];
      
      if (!enhancedMatrix[toPoint.id]) {
        enhancedMatrix[toPoint.id] = {};
      }

      // If direct connection doesn't exist, calculate it
      if (!enhancedMatrix[fromPoint.id][toPoint.id]) {
        const estimatedTime = estimateTravelTime(fromPoint, toPoint, sortedTimePoints, enhancedMatrix);
        enhancedMatrix[fromPoint.id][toPoint.id] = estimatedTime;
      }
    }
  }

  return enhancedMatrix;
};

/**
 * Estimates travel time between two points using existing connections
 */
const estimateTravelTime = (
  fromPoint: TimePoint,
  toPoint: TimePoint,
  allTimePoints: TimePoint[],
  matrix: TravelTimeMatrix
): number => {
  // If points are adjacent in sequence, use a default time
  const sequenceDiff = Math.abs(toPoint.sequence - fromPoint.sequence);
  if (sequenceDiff === 1) {
    return 5; // Default 5 minutes for adjacent stops
  }

  // Try to find path through intermediate points
  let bestEstimate = sequenceDiff * 5; // Fallback: 5 minutes per sequence step
  
  for (const intermediatePoint of allTimePoints) {
    if (intermediatePoint.id === fromPoint.id || intermediatePoint.id === toPoint.id) {
      continue;
    }

    const fromToIntermediate = matrix[fromPoint.id]?.[intermediatePoint.id];
    const intermediateToTo = matrix[intermediatePoint.id]?.[toPoint.id];

    if (fromToIntermediate && intermediateToTo) {
      const totalTime = fromToIntermediate + intermediateToTo;
      if (totalTime < bestEstimate) {
        bestEstimate = totalTime;
      }
    }
  }

  return bestEstimate;
};

/**
 * Validates that matrix covers all required connections
 */
export const validateMatrixCompleteness = (
  timePoints: TimePoint[],
  matrix: TravelTimeMatrix
): { isComplete: boolean; missingConnections: string[] } => {
  const missingConnections: string[] = [];
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);

  for (let i = 0; i < sortedTimePoints.length - 1; i++) {
    const fromPoint = sortedTimePoints[i];
    const toPoint = sortedTimePoints[i + 1];

    if (!matrix[fromPoint.id]?.[toPoint.id]) {
      missingConnections.push(`${fromPoint.name} -> ${toPoint.name}`);
    }
  }

  return {
    isComplete: missingConnections.length === 0,
    missingConnections
  };
};

/**
 * Performance-optimized calculation for large datasets (15x15 matrix or larger)
 */
export const calculateOptimizedSchedule = (
  timePoints: TimePoint[],
  travelTimes: TravelTime[],
  timeBands: { [dayType: string]: TimeBand[] }
): CalculationResults => {
  const startTime = Date.now();
  
  // Validate input data
  const validation = validateTravelTimes(timePoints, travelTimes);
  if (!validation.isValid) {
    throw new Error(`Invalid travel time data: ${validation.errors.join(', ')}`);
  }

  // Build travel matrices
  const matrices = calculateTravelTimes(timePoints, travelTimes);

  // Handle missing connections for each day type
  const enhancedMatrices = {
    weekday: handleMissingConnections(timePoints, matrices.weekday),
    saturday: handleMissingConnections(timePoints, matrices.saturday),
    sunday: handleMissingConnections(timePoints, matrices.sunday)
  };

  // Validate matrix completeness
  const completenessChecks = {
    weekday: validateMatrixCompleteness(timePoints, enhancedMatrices.weekday),
    saturday: validateMatrixCompleteness(timePoints, enhancedMatrices.saturday),
    sunday: validateMatrixCompleteness(timePoints, enhancedMatrices.sunday)
  };

  // Log warnings for missing connections
  Object.entries(completenessChecks).forEach(([dayType, check]) => {
    if (!check.isComplete) {
      console.warn(`Missing connections for ${dayType}:`, check.missingConnections);
    }
  });

  // Generate trips for each day type
  const results: CalculationResults = {
    weekday: [],
    saturday: [],
    sunday: [],
    metadata: {
      totalTimePoints: timePoints.length,
      totalTrips: 0,
      calculationTime: 0
    }
  };

  // Process in batches for performance with large datasets
  const BATCH_SIZE = 50;
  (['weekday', 'saturday', 'sunday'] as DayType[]).forEach(dayType => {
    const dayTimeBands = timeBands[dayType] || [];
    const dayMatrix = enhancedMatrices[dayType];
    
    const dayResults = generateTripsFromTimeBands(
      dayTimeBands,
      timePoints,
      dayMatrix,
      dayType
    );

    // Process in batches for memory efficiency
    for (let i = 0; i < dayResults.length; i += BATCH_SIZE) {
      const batch = dayResults.slice(i, i + BATCH_SIZE);
      results[dayType].push(...batch);
    }
  });

  // Calculate metadata
  results.metadata.totalTrips = 
    results.weekday.length + results.saturday.length + results.sunday.length;
  results.metadata.calculationTime = Date.now() - startTime;

  return results;
};
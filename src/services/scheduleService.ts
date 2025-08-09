/**
 * Schedule Service
 * Service layer for managing schedule operations, calculations, and data persistence
 */

import {
  TimePoint,
  TravelTime,
  SummarySchedule,
  ScheduleMatrix,
  ScheduleValidationResult,
  TripSchedule,
  ScheduleEntry
} from '../types';

import { sanitizeErrorMessage } from '../utils/inputSanitizer';
import {
  calculateTravelTimes,
  generateTripsFromTimeBands,
  convertToScheduleMatrix,
  validateTravelTimes,
  calculateOptimizedSchedule,
  TimeBand,
  DayType,
  TravelTimeMatrices,
  CalculationResults,
  TripCalculationResult,
  handleMissingConnections,
  validateMatrixCompleteness
} from '../utils/calculator';

/**
 * Secure error handler for schedule service operations
 */
class SecureErrorHandler {
  private static readonly ERROR_CODES = {
    VALIDATION_FAILED: 'SCHED_001',
    GENERATION_FAILED: 'SCHED_002',
    UPDATE_FAILED: 'SCHED_003',
    CALCULATION_ERROR: 'SCHED_004',
    DATA_PROCESSING_ERROR: 'SCHED_005',
    MEMORY_LIMIT_EXCEEDED: 'SCHED_006',
    TIMEOUT_ERROR: 'SCHED_007',
    UNKNOWN_ERROR: 'SCHED_999'
  } as const;

  /**
   * Creates a secure error with sanitized message and error code
   */
  static createSecureError(
    originalError: unknown,
    context: string,
    errorCode?: string
  ): Error {
    const baseMessage = originalError instanceof Error ? originalError.message : 'Unknown error occurred';
    const sanitizedMessage = sanitizeErrorMessage(baseMessage);
    const code = errorCode || this.ERROR_CODES.UNKNOWN_ERROR;
    
    // Create user-friendly error message
    const userMessage = this.getUserFriendlyMessage(code, sanitizedMessage, context);
    
    // Log detailed error for debugging (without exposing to user)
    this.logSecureError(originalError, context, code);
    
    const error = new Error(userMessage);
    (error as any).code = code;
    (error as any).context = context;
    return error;
  }

  /**
   * Gets user-friendly error message based on error code
   */
  private static getUserFriendlyMessage(
    errorCode: string,
    sanitizedMessage: string,
    context: string
  ): string {
    const contextInfo = context ? ` during ${context}` : '';
    
    switch (errorCode) {
      case this.ERROR_CODES.VALIDATION_FAILED:
        return `Schedule data validation failed${contextInfo}. Please check your input data format.`;
      case this.ERROR_CODES.GENERATION_FAILED:
        return `Schedule generation failed${contextInfo}. Please verify your time points and travel times.`;
      case this.ERROR_CODES.UPDATE_FAILED:
        return `Schedule update failed${contextInfo}. Please try again or check your data.`;
      case this.ERROR_CODES.CALCULATION_ERROR:
        return `Schedule calculation error occurred${contextInfo}. Please verify your configuration.`;
      case this.ERROR_CODES.DATA_PROCESSING_ERROR:
        return `Data processing error occurred${contextInfo}. Please check your file format.`;
      case this.ERROR_CODES.MEMORY_LIMIT_EXCEEDED:
        return `Processing limit exceeded${contextInfo}. Please try with a smaller dataset.`;
      case this.ERROR_CODES.TIMEOUT_ERROR:
        return `Operation timed out${contextInfo}. Please try again or reduce data complexity.`;
      default:
        return `An error occurred${contextInfo}. Please try again or contact support if the problem persists.`;
    }
  }

  /**
   * Logs error securely for debugging purposes
   */
  private static logSecureError(error: unknown, context: string, code: string): void {
    // In production, this would log to a secure logging system
    // For now, we'll use console.error with sanitized information
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      code,
      context,
      message: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error',
      stack: error instanceof Error ? this.sanitizeStackTrace(error.stack) : undefined
    };
    
    console.error('Schedule Service Error:', errorInfo);
  }

  /**
   * Sanitizes stack trace to remove sensitive information
   */
  private static sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    return stack
      .split('\n')
      .map(line => line.replace(/[C-Z]:\\[^\s]*/g, '[PATH]'))
      .map(line => line.replace(/\/[^\s]*/g, '[PATH]'))
      .map(line => line.replace(/Users\/[^\s\/]+/g, '[USER]'))
      .join('\n');
  }

  /**
   * Gets error code constants for external use
   */
  static getErrorCodes() {
    return this.ERROR_CODES;
  }
}

/**
 * Schedule generation options
 */
export interface ScheduleGenerationOptions {
  routeId: string;
  routeName: string;
  direction: string;
  effectiveDate: Date;
  expirationDate?: Date;
  timeBands: {
    weekday: TimeBand[];
    saturday: TimeBand[];
    sunday: TimeBand[];
  };
  dwellTime?: number; // minutes to add at each stop
}

/**
 * Schedule update options
 */
export interface ScheduleUpdateOptions {
  updateTravelTimes?: boolean;
  recalculateSchedules?: boolean;
  validateBeforeUpdate?: boolean;
}

/**
 * Schedule statistics
 */
export interface ScheduleStatistics {
  totalTimePoints: number;
  totalTrips: {
    weekday: number;
    saturday: number;
    sunday: number;
    total: number;
  };
  averageFrequency: {
    weekday: number;
    saturday: number;
    sunday: number;
  };
  operatingHours: {
    weekday: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { start: string; end: string };
  };
  totalTravelTime: {
    weekday: number;
    saturday: number;
    sunday: number;
  };
}

/**
 * Main Schedule Service class
 */
export class ScheduleService {
  private travelMatrices: TravelTimeMatrices | null = null;
  private lastCalculationResults: CalculationResults | null = null;

  /**
   * Generates a complete summary schedule from time points and travel times
   */
  async generateSummarySchedule(
    timePoints: TimePoint[],
    travelTimes: TravelTime[],
    options: ScheduleGenerationOptions
  ): Promise<SummarySchedule> {
    try {
      // Validate input data
      const validation = this.validateScheduleData(timePoints, travelTimes);
      if (!validation.isValid) {
        throw SecureErrorHandler.createSecureError(
          new Error(validation.errors.join(', ')),
          'schedule validation',
          SecureErrorHandler.getErrorCodes().VALIDATION_FAILED
        );
      }

      // Calculate optimized schedule
      const calculationResults = calculateOptimizedSchedule(
        timePoints,
        travelTimes,
        options.timeBands
      );

      this.lastCalculationResults = calculationResults;

      // Convert results to schedule matrices
      const weekdayMatrix = convertToScheduleMatrix(calculationResults.weekday, timePoints);
      const saturdayMatrix = convertToScheduleMatrix(calculationResults.saturday, timePoints);
      const sundayMatrix = convertToScheduleMatrix(calculationResults.sunday, timePoints);

      // Calculate statistics
      const stats = this.calculateScheduleStatistics(calculationResults, timePoints);

      // Build summary schedule
      const summarySchedule: SummarySchedule = {
        routeId: options.routeId,
        routeName: options.routeName,
        direction: options.direction,
        timePoints: timePoints.sort((a, b) => a.sequence - b.sequence),
        weekday: weekdayMatrix,
        saturday: saturdayMatrix,
        sunday: sundayMatrix,
        effectiveDate: options.effectiveDate,
        expirationDate: options.expirationDate,
        metadata: {
          weekdayTrips: calculationResults.weekday.length,
          saturdayTrips: calculationResults.saturday.length,
          sundayTrips: calculationResults.sunday.length,
          frequency: this.calculateAverageFrequency(options.timeBands),
          operatingHours: this.calculateOperatingHours(options.timeBands)
        }
      };

      return summarySchedule;

    } catch (error) {
      // If it's already a secure error, re-throw it
      if (error instanceof Error && (error as any).code) {
        throw error;
      }
      
      // Otherwise, create a new secure error
      throw SecureErrorHandler.createSecureError(
        error,
        'schedule generation',
        SecureErrorHandler.getErrorCodes().GENERATION_FAILED
      );
    }
  }

  /**
   * Updates an existing schedule with new data
   */
  async updateSchedule(
    existingSchedule: SummarySchedule,
    timePoints?: TimePoint[],
    travelTimes?: TravelTime[],
    options?: ScheduleUpdateOptions
  ): Promise<SummarySchedule> {
    const updateOptions = {
      updateTravelTimes: true,
      recalculateSchedules: true,
      validateBeforeUpdate: true,
      ...options
    };

    try {
      // Use existing data if not provided
      const updatedTimePoints = timePoints || existingSchedule.timePoints;
      const updatedTravelTimes = travelTimes || this.extractTravelTimesFromSchedule(existingSchedule);

      // Validate if requested
      if (updateOptions.validateBeforeUpdate) {
        const validation = this.validateScheduleData(updatedTimePoints, updatedTravelTimes);
        if (!validation.isValid) {
          throw SecureErrorHandler.createSecureError(
            new Error(validation.errors.join(', ')),
            'schedule update validation',
            SecureErrorHandler.getErrorCodes().VALIDATION_FAILED
          );
        }
      }

      // Recalculate if requested
      if (updateOptions.recalculateSchedules) {
        // Extract time bands from existing schedule (simplified approach)
        const timeBands = this.extractTimeBandsFromSchedule(existingSchedule);
        
        const generationOptions: ScheduleGenerationOptions = {
          routeId: existingSchedule.routeId,
          routeName: existingSchedule.routeName,
          direction: existingSchedule.direction,
          effectiveDate: existingSchedule.effectiveDate,
          expirationDate: existingSchedule.expirationDate,
          timeBands
        };

        return await this.generateSummarySchedule(updatedTimePoints, updatedTravelTimes, generationOptions);
      }

      // If not recalculating, just update metadata
      return {
        ...existingSchedule,
        timePoints: updatedTimePoints,
        metadata: {
          ...existingSchedule.metadata,
          weekdayTrips: existingSchedule.weekday.length,
          saturdayTrips: existingSchedule.saturday.length,
          sundayTrips: existingSchedule.sunday.length
        }
      };

    } catch (error) {
      // If it's already a secure error, re-throw it
      if (error instanceof Error && (error as any).code) {
        throw error;
      }
      
      // Otherwise, create a new secure error
      throw SecureErrorHandler.createSecureError(
        error,
        'schedule update',
        SecureErrorHandler.getErrorCodes().UPDATE_FAILED
      );
    }
  }

  /**
   * Validates schedule data for consistency and completeness
   */
  validateScheduleData(timePoints: TimePoint[], travelTimes: TravelTime[]): ScheduleValidationResult {
    const validation = validateTravelTimes(timePoints, travelTimes);
    
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  /**
   * Calculates schedule statistics
   */
  calculateScheduleStatistics(
    calculationResults: CalculationResults,
    timePoints: TimePoint[]
  ): ScheduleStatistics {
    const totalTrips = {
      weekday: calculationResults.weekday.length,
      saturday: calculationResults.saturday.length,
      sunday: calculationResults.sunday.length,
      total: calculationResults.weekday.length + calculationResults.saturday.length + calculationResults.sunday.length
    };

    return {
      totalTimePoints: timePoints.length,
      totalTrips,
      averageFrequency: {
        weekday: this.calculateDayTypeFrequency(calculationResults.weekday),
        saturday: this.calculateDayTypeFrequency(calculationResults.saturday),
        sunday: this.calculateDayTypeFrequency(calculationResults.sunday)
      },
      operatingHours: {
        weekday: this.calculateDayTypeOperatingHours(calculationResults.weekday),
        saturday: this.calculateDayTypeOperatingHours(calculationResults.saturday),
        sunday: this.calculateDayTypeOperatingHours(calculationResults.sunday)
      },
      totalTravelTime: {
        weekday: this.calculateTotalTravelTime(calculationResults.weekday),
        saturday: this.calculateTotalTravelTime(calculationResults.saturday),
        sunday: this.calculateTotalTravelTime(calculationResults.sunday)
      }
    };
  }

  /**
   * Gets the last calculation results
   */
  getLastCalculationResults(): CalculationResults | null {
    return this.lastCalculationResults;
  }

  /**
   * Gets cached travel matrices
   */
  getTravelMatrices(): TravelTimeMatrices | null {
    return this.travelMatrices;
  }

  /**
   * Builds and caches travel matrices with missing connection handling
   */
  buildEnhancedTravelMatrices(
    timePoints: TimePoint[],
    travelTimes: TravelTime[]
  ): TravelTimeMatrices {
    // Calculate basic matrices
    const basicMatrices = calculateTravelTimes(timePoints, travelTimes);

    // Enhance matrices by handling missing connections
    const enhancedMatrices = {
      weekday: handleMissingConnections(timePoints, basicMatrices.weekday),
      saturday: handleMissingConnections(timePoints, basicMatrices.saturday),
      sunday: handleMissingConnections(timePoints, basicMatrices.sunday)
    };

    // Validate completeness and log warnings
    const completenessResults = {
      weekday: validateMatrixCompleteness(timePoints, enhancedMatrices.weekday),
      saturday: validateMatrixCompleteness(timePoints, enhancedMatrices.saturday),
      sunday: validateMatrixCompleteness(timePoints, enhancedMatrices.sunday)
    };

    // Log any remaining issues
    Object.entries(completenessResults).forEach(([dayType, result]) => {
      if (!result.isComplete) {
        console.warn(`Incomplete matrix for ${dayType}:`, result.missingConnections);
      }
    });

    // Cache the matrices
    this.travelMatrices = enhancedMatrices;
    
    return enhancedMatrices;
  }

  /**
   * Validates matrix data quality and performance
   */
  validateMatrixPerformance(
    timePoints: TimePoint[],
    matrices: TravelTimeMatrices
  ): {
    isOptimal: boolean;
    performance: {
      matrixSize: number;
      connectionRate: number;
      averageTravelTime: { weekday: number; saturday: number; sunday: number };
    };
    recommendations: string[];
  } {
    const matrixSize = timePoints.length;
    const recommendations: string[] = [];
    
    // Calculate connection rates
    const calculateConnectionRate = (matrix: any): number => {
      let totalConnections = 0;
      let existingConnections = 0;
      
      timePoints.forEach(from => {
        timePoints.forEach(to => {
          if (from.id !== to.id) {
            totalConnections++;
            if (matrix[from.id]?.[to.id] !== undefined) {
              existingConnections++;
            }
          }
        });
      });
      
      return totalConnections > 0 ? existingConnections / totalConnections : 0;
    };

    const connectionRates = {
      weekday: calculateConnectionRate(matrices.weekday),
      saturday: calculateConnectionRate(matrices.saturday),
      sunday: calculateConnectionRate(matrices.sunday)
    };

    const avgConnectionRate = (connectionRates.weekday + connectionRates.saturday + connectionRates.sunday) / 3;

    // Calculate average travel times
    const calculateAverageTravelTime = (matrix: any): number => {
      let totalTime = 0;
      let connectionCount = 0;
      
      Object.values(matrix).forEach((fromConnections: any) => {
        Object.values(fromConnections).forEach((travelTime: any) => {
          if (typeof travelTime === 'number') {
            totalTime += travelTime;
            connectionCount++;
          }
        });
      });
      
      return connectionCount > 0 ? totalTime / connectionCount : 0;
    };

    const averageTravelTimes = {
      weekday: calculateAverageTravelTime(matrices.weekday),
      saturday: calculateAverageTravelTime(matrices.saturday),
      sunday: calculateAverageTravelTime(matrices.sunday)
    };

    // Generate recommendations
    if (matrixSize > 15) {
      recommendations.push('Consider using batch processing for large matrices (>15x15)');
    }
    
    if (avgConnectionRate < 0.8) {
      recommendations.push('Low connection rate detected - consider adding more travel time data');
    }

    const avgTravelTime = (averageTravelTimes.weekday + averageTravelTimes.saturday + averageTravelTimes.sunday) / 3;
    if (avgTravelTime > 60) {
      recommendations.push('High average travel times detected - verify route efficiency');
    }

    return {
      isOptimal: avgConnectionRate >= 0.8 && matrixSize <= 20 && avgTravelTime <= 60,
      performance: {
        matrixSize,
        connectionRate: avgConnectionRate,
        averageTravelTime: averageTravelTimes
      },
      recommendations
    };
  }

  /**
   * Converts trip schedules to standard format
   */
  convertToTripSchedules(calculationResults: CalculationResults): TripSchedule[] {
    const allTrips: TripSchedule[] = [];

    // Process all day types
    (['weekday', 'saturday', 'sunday'] as DayType[]).forEach(dayType => {
      const dayTrips = calculationResults[dayType];
      
      dayTrips.forEach(trip => {
        allTrips.push({
          tripId: trip.tripId,
          scheduleEntries: trip.scheduleEntries
        });
      });
    });

    return allTrips;
  }

  /**
   * Extracts schedule entries for a specific time point across all trips
   */
  getTimePointSchedule(
    calculationResults: CalculationResults,
    timePointId: string,
    dayType: DayType
  ): ScheduleEntry[] {
    const dayTrips = calculationResults[dayType];
    const scheduleEntries: ScheduleEntry[] = [];

    dayTrips.forEach(trip => {
      const entry = trip.scheduleEntries.find(e => e.timePointId === timePointId);
      if (entry) {
        scheduleEntries.push(entry);
      }
    });

    return scheduleEntries.sort((a, b) => {
      // Sort by arrival time
      const aTime = a.arrivalTime.split(':').map(Number);
      const bTime = b.arrivalTime.split(':').map(Number);
      const aMinutes = aTime[0] * 60 + aTime[1];
      const bMinutes = bTime[0] * 60 + bTime[1];
      return aMinutes - bMinutes;
    });
  }

  // Private helper methods

  private calculateAverageFrequency(timeBands: { [dayType: string]: TimeBand[] }): number {
    let totalFrequency = 0;
    let bandCount = 0;

    Object.values(timeBands).forEach(bands => {
      bands.forEach(band => {
        totalFrequency += band.frequency;
        bandCount++;
      });
    });

    return bandCount > 0 ? Math.round(totalFrequency / bandCount) : 0;
  }

  private calculateOperatingHours(timeBands: { [dayType: string]: TimeBand[] }): { start: string; end: string } {
    let earliestStart = '23:59';
    let latestEnd = '00:00';

    Object.values(timeBands).forEach(bands => {
      bands.forEach(band => {
        if (band.startTime < earliestStart) {
          earliestStart = band.startTime;
        }
        if (band.endTime > latestEnd) {
          latestEnd = band.endTime;
        }
      });
    });

    return {
      start: earliestStart,
      end: latestEnd
    };
  }

  private calculateDayTypeFrequency(trips: TripCalculationResult[]): number {
    if (trips.length < 2) return 0;

    // Calculate average time between trips
    const departureTimes = trips
      .map(trip => trip.scheduleEntries[0]?.departureTime)
      .filter(time => time)
      .sort();

    if (departureTimes.length < 2) return 0;

    let totalGap = 0;
    for (let i = 1; i < departureTimes.length; i++) {
      const prev = departureTimes[i - 1].split(':').map(Number);
      const curr = departureTimes[i].split(':').map(Number);
      const prevMinutes = prev[0] * 60 + prev[1];
      const currMinutes = curr[0] * 60 + curr[1];
      totalGap += currMinutes - prevMinutes;
    }

    return Math.round(totalGap / (departureTimes.length - 1));
  }

  private calculateDayTypeOperatingHours(trips: TripCalculationResult[]): { start: string; end: string } {
    if (trips.length === 0) {
      return { start: '00:00', end: '00:00' };
    }

    const allTimes = trips.flatMap(trip => 
      trip.scheduleEntries.map(entry => entry.departureTime)
    ).filter(time => time);

    allTimes.sort();

    return {
      start: allTimes[0] || '00:00',
      end: allTimes[allTimes.length - 1] || '00:00'
    };
  }

  private calculateTotalTravelTime(trips: TripCalculationResult[]): number {
    return trips.reduce((total, trip) => total + trip.totalTravelTime, 0);
  }

  private extractTravelTimesFromSchedule(schedule: SummarySchedule): TravelTime[] {
    // This is a simplified implementation
    // In a real scenario, you'd need to store travel times separately
    // or calculate them from existing schedule data
    return [];
  }

  private extractTimeBandsFromSchedule(schedule: SummarySchedule): { weekday: TimeBand[]; saturday: TimeBand[]; sunday: TimeBand[] } {
    // This is a simplified implementation
    // In a real scenario, you'd need to analyze the schedule matrices
    // to reverse-engineer the time bands
    return {
      weekday: [],
      saturday: [],
      sunday: []
    };
  }
}

// Export singleton instance
export const scheduleService = new ScheduleService();
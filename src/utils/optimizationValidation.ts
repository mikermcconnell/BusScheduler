/**
 * Optimization Validation Utilities
 * Comprehensive validation and error handling for connection optimization
 */

import {
  ConnectionOptimizationRequest,
  ConnectionOpportunity,
  OptimizationConstraints,
  RecoveryBankState,
  HeadwayCorrection
} from '../types/connectionOptimization';
import { Schedule, Trip, ConnectionType } from '../types/schedule';
import { sanitizeErrorMessage } from './inputSanitizer';
import { timeToMinutes, isValidTimeFormat } from './timeUtils';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  criticalIssues: string[];
  suggestions: string[];
}

/**
 * Security validation for optimization inputs
 */
export interface SecurityValidationResult {
  isSafe: boolean;
  securityIssues: string[];
  sanitizationApplied: string[];
}

/**
 * Performance validation for large datasets
 */
export interface PerformanceValidationResult {
  isOptimal: boolean;
  performanceIssues: string[];
  estimatedComplexity: 'low' | 'medium' | 'high' | 'extreme';
  recommendations: string[];
}

/**
 * Main optimization validator class
 */
export class OptimizationValidator {
  private static readonly MAX_TRIPS = 2000;
  private static readonly MAX_CONNECTIONS = 500;
  private static readonly MAX_TIME_DEVIATION = 60; // minutes
  private static readonly MAX_MEMORY_MB = 512;
  private static readonly MAX_PROCESSING_TIME_MS = 300000; // 5 minutes

  /**
   * Comprehensive validation of optimization request
   */
  static validateOptimizationRequest(request: ConnectionOptimizationRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];
    const suggestions: string[] = [];

    try {
      // Validate schedule
      const scheduleValidation = this.validateSchedule(request.schedule);
      errors.push(...scheduleValidation.errors);
      warnings.push(...scheduleValidation.warnings);
      criticalIssues.push(...scheduleValidation.criticalIssues);

      // Validate connection opportunities
      const connectionValidation = this.validateConnectionOpportunities(request.connectionOpportunities);
      errors.push(...connectionValidation.errors);
      warnings.push(...connectionValidation.warnings);
      criticalIssues.push(...connectionValidation.criticalIssues);

      // Validate constraints
      const constraintValidation = this.validateConstraints(request.constraints);
      errors.push(...constraintValidation.errors);
      warnings.push(...constraintValidation.warnings);

      // Validate recovery bank configuration
      const recoveryValidation = this.validateRecoveryBankConfig(request.recoveryBankConfig);
      errors.push(...recoveryValidation.errors);
      warnings.push(...recoveryValidation.warnings);

      // Validate headway correction settings
      const headwayValidation = this.validateHeadwayCorrection(request.headwayCorrection);
      errors.push(...headwayValidation.errors);
      warnings.push(...headwayValidation.warnings);

      // Cross-validation checks
      const crossValidation = this.performCrossValidation(request);
      errors.push(...crossValidation.errors);
      warnings.push(...crossValidation.warnings);
      criticalIssues.push(...crossValidation.criticalIssues);

      // Generate suggestions
      suggestions.push(...this.generateOptimizationSuggestions(request));

    } catch (error) {
      criticalIssues.push(`Validation failed: ${sanitizeErrorMessage(error instanceof Error ? error.message : 'Unknown error')}`);
    }

    return {
      isValid: errors.length === 0 && criticalIssues.length === 0,
      errors,
      warnings,
      criticalIssues,
      suggestions
    };
  }

  /**
   * Security validation to prevent malicious inputs
   */
  static validateSecurity(request: ConnectionOptimizationRequest): SecurityValidationResult {
    const securityIssues: string[] = [];
    const sanitizationApplied: string[] = [];

    try {
      // Check for suspicious patterns in strings
      const stringFields = [
        request.schedule.routeName,
        request.schedule.direction,
        ...request.connectionOpportunities.map(opp => opp.metadata.serviceName),
        ...request.connectionOpportunities.map(opp => opp.metadata.description)
      ];

      stringFields.forEach((field, index) => {
        if (typeof field === 'string') {
          // Check for script injection patterns
          const scriptPatterns = [/<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i];
          if (scriptPatterns.some(pattern => pattern.test(field))) {
            securityIssues.push(`Potential script injection detected in field ${index}`);
          }

          // Check for path traversal
          if (field.includes('../') || field.includes('..\\')) {
            securityIssues.push(`Path traversal attempt detected in field ${index}`);
          }

          // Check for SQL injection patterns
          const sqlPatterns = [/union\s+select/i, /drop\s+table/i, /insert\s+into/i, /delete\s+from/i];
          if (sqlPatterns.some(pattern => pattern.test(field))) {
            securityIssues.push(`Potential SQL injection detected in field ${index}`);
          }
        }
      });

      // Check for excessive data sizes
      if (JSON.stringify(request).length > 10 * 1024 * 1024) { // 10MB
        securityIssues.push('Request size exceeds security limits');
      }

      // Check for suspicious constraint values
      if (request.constraints.maxTripDeviation > this.MAX_TIME_DEVIATION) {
        securityIssues.push('Excessive time deviation constraint may indicate malicious intent');
      }

      if (request.constraints.performance.maxMemoryUsageMB > this.MAX_MEMORY_MB) {
        securityIssues.push('Excessive memory limit may indicate resource exhaustion attack');
      }

      // Check for excessive iteration limits
      if (request.options.maxIterations > 10000) {
        securityIssues.push('Excessive iteration limit may cause DoS');
      }

    } catch (error) {
      securityIssues.push(`Security validation failed: ${sanitizeErrorMessage(error instanceof Error ? error.message : 'Unknown error')}`);
    }

    return {
      isSafe: securityIssues.length === 0,
      securityIssues,
      sanitizationApplied
    };
  }

  /**
   * Performance validation for large datasets
   */
  static validatePerformance(request: ConnectionOptimizationRequest): PerformanceValidationResult {
    const performanceIssues: string[] = [];
    const recommendations: string[] = [];
    
    let complexityScore = 0;

    try {
      // Analyze dataset size
      const tripCount = request.schedule.trips.length;
      const connectionCount = request.connectionOpportunities.length;
      const timePointCount = request.schedule.timePoints.length;

      if (tripCount > this.MAX_TRIPS) {
        performanceIssues.push(`Trip count (${tripCount}) exceeds recommended maximum (${this.MAX_TRIPS})`);
        recommendations.push('Consider splitting large schedules into smaller optimization batches');
        complexityScore += 3;
      } else if (tripCount > 500) {
        recommendations.push('Large trip count detected. Consider enabling parallel processing');
        complexityScore += 2;
      } else if (tripCount > 200) {
        complexityScore += 1;
      }

      if (connectionCount > this.MAX_CONNECTIONS) {
        performanceIssues.push(`Connection count (${connectionCount}) exceeds recommended maximum (${this.MAX_CONNECTIONS})`);
        recommendations.push('Filter connections to only the most critical ones');
        complexityScore += 3;
      } else if (connectionCount > 100) {
        recommendations.push('High connection count. Consider prioritizing most important connections first');
        complexityScore += 2;
      } else if (connectionCount > 50) {
        complexityScore += 1;
      }

      // Analyze computational complexity
      const estimatedOperations = tripCount * connectionCount * timePointCount;
      if (estimatedOperations > 10000000) { // 10M operations
        performanceIssues.push('Estimated computational complexity is very high');
        recommendations.push('Enable progressive optimization with early termination');
        complexityScore += 3;
      } else if (estimatedOperations > 1000000) { // 1M operations
        recommendations.push('Moderate computational complexity. Consider enabling caching');
        complexityScore += 1;
      }

      // Check optimization time limits
      if (request.constraints.performance.maxOptimizationTimeMs > this.MAX_PROCESSING_TIME_MS) {
        performanceIssues.push('Very long optimization time limit may cause user experience issues');
        recommendations.push('Consider reducing time limit and using progressive optimization');
      } else if (request.constraints.performance.maxOptimizationTimeMs < 5000) {
        recommendations.push('Short time limit may prevent finding optimal solutions');
      }

      // Check memory constraints
      const estimatedMemoryMB = (tripCount * connectionCount * 32) / (1024 * 1024); // Rough estimate
      if (estimatedMemoryMB > request.constraints.performance.maxMemoryUsageMB) {
        performanceIssues.push(`Estimated memory usage (${Math.round(estimatedMemoryMB)}MB) exceeds limit (${request.constraints.performance.maxMemoryUsageMB}MB)`);
        recommendations.push('Reduce dataset size or increase memory limit');
        complexityScore += 2;
      }

      // Analysis iteration limits
      const maxIterations = request.options.maxIterations;
      if (maxIterations * connectionCount > 100000) {
        performanceIssues.push('High iteration × connection count may cause performance issues');
        recommendations.push('Reduce max iterations or connection count');
        complexityScore += 1;
      }

    } catch (error) {
      performanceIssues.push(`Performance validation failed: ${sanitizeErrorMessage(error instanceof Error ? error.message : 'Unknown error')}`);
      complexityScore += 3;
    }

    // Determine complexity level
    let estimatedComplexity: PerformanceValidationResult['estimatedComplexity'];
    if (complexityScore >= 8) {
      estimatedComplexity = 'extreme';
    } else if (complexityScore >= 5) {
      estimatedComplexity = 'high';
    } else if (complexityScore >= 2) {
      estimatedComplexity = 'medium';
    } else {
      estimatedComplexity = 'low';
    }

    return {
      isOptimal: performanceIssues.length === 0 && complexityScore < 5,
      performanceIssues,
      estimatedComplexity,
      recommendations
    };
  }

  /**
   * Validate schedule data
   */
  private static validateSchedule(schedule: Schedule): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    if (!schedule) {
      criticalIssues.push('Schedule is null or undefined');
      return { isValid: false, errors, warnings, criticalIssues, suggestions: [] };
    }

    // Basic structure validation
    if (!schedule.id || typeof schedule.id !== 'string') {
      errors.push('Schedule must have a valid ID');
    }

    if (!schedule.routeName || typeof schedule.routeName !== 'string') {
      errors.push('Schedule must have a valid route name');
    }

    if (!Array.isArray(schedule.timePoints) || schedule.timePoints.length === 0) {
      criticalIssues.push('Schedule must contain at least one time point');
    }

    if (!Array.isArray(schedule.trips) || schedule.trips.length === 0) {
      criticalIssues.push('Schedule must contain at least one trip');
    }

    // Validate time points
    schedule.timePoints?.forEach((timePoint, index) => {
      if (!timePoint.id || typeof timePoint.id !== 'string') {
        errors.push(`Time point ${index} must have a valid ID`);
      }

      if (!timePoint.name || typeof timePoint.name !== 'string') {
        errors.push(`Time point ${index} must have a valid name`);
      }

      if (typeof timePoint.sequence !== 'number' || timePoint.sequence < 1) {
        errors.push(`Time point ${index} must have a valid sequence number`);
      }
    });

    // Validate trips
    schedule.trips?.forEach((trip, index) => {
      if (typeof trip.tripNumber !== 'number') {
        errors.push(`Trip ${index} must have a valid trip number`);
      }

      if (!isValidTimeFormat(trip.departureTime)) {
        errors.push(`Trip ${index} must have a valid departure time`);
      }

      // Validate arrival and departure times
      Object.keys(trip.arrivalTimes || {}).forEach(stopId => {
        const arrivalTime = trip.arrivalTimes[stopId];
        if (!isValidTimeFormat(arrivalTime)) {
          errors.push(`Trip ${index} has invalid arrival time for stop ${stopId}`);
        }
      });

      Object.keys(trip.departureTimes || {}).forEach(stopId => {
        const departureTime = trip.departureTimes[stopId];
        if (!isValidTimeFormat(departureTime)) {
          errors.push(`Trip ${index} has invalid departure time for stop ${stopId}`);
        }
      });

      // Validate recovery times
      Object.keys(trip.recoveryTimes || {}).forEach(stopId => {
        const recoveryTime = trip.recoveryTimes[stopId];
        if (typeof recoveryTime !== 'number' || recoveryTime < 0) {
          errors.push(`Trip ${index} has invalid recovery time for stop ${stopId}`);
        }

        if (recoveryTime > 30) {
          warnings.push(`Trip ${index} has unusually high recovery time (${recoveryTime}min) at stop ${stopId}`);
        }
      });
    });

    // Check for temporal consistency
    if (schedule.trips && schedule.trips.length > 1) {
      const sortedTrips = [...schedule.trips].sort((a, b) => 
        timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime)
      );

      for (let i = 1; i < sortedTrips.length; i++) {
        const prevTime = timeToMinutes(sortedTrips[i - 1].departureTime);
        const currentTime = timeToMinutes(sortedTrips[i].departureTime);
        
        if (currentTime <= prevTime) {
          warnings.push(`Trips ${sortedTrips[i - 1].tripNumber} and ${sortedTrips[i].tripNumber} may have temporal ordering issues`);
        }
      }
    }

    return { isValid: errors.length === 0 && criticalIssues.length === 0, errors, warnings, criticalIssues, suggestions: [] };
  }

  /**
   * Validate connection opportunities
   */
  private static validateConnectionOpportunities(opportunities: ConnectionOpportunity[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    if (!Array.isArray(opportunities)) {
      criticalIssues.push('Connection opportunities must be an array');
      return { isValid: false, errors, warnings, criticalIssues, suggestions: [] };
    }

    if (opportunities.length === 0) {
      warnings.push('No connection opportunities provided');
    }

    opportunities.forEach((opp, index) => {
      if (!opp.id || typeof opp.id !== 'string') {
        errors.push(`Connection opportunity ${index} must have a valid ID`);
      }

      if (!Object.values(ConnectionType).includes(opp.type)) {
        errors.push(`Connection opportunity ${index} has invalid type: ${opp.type}`);
      }

      if (!isValidTimeFormat(opp.targetTime)) {
        errors.push(`Connection opportunity ${index} has invalid target time: ${opp.targetTime}`);
      }

      if (typeof opp.priority !== 'number' || opp.priority < 1 || opp.priority > 10) {
        errors.push(`Connection opportunity ${index} must have priority between 1-10`);
      }

      if (!['ideal', 'partial', 'missed'].includes(opp.windowType)) {
        errors.push(`Connection opportunity ${index} has invalid window type: ${opp.windowType}`);
      }

      if (!Array.isArray(opp.affectedTrips) || opp.affectedTrips.length === 0) {
        warnings.push(`Connection opportunity ${index} has no affected trips`);
      }

      if (!Array.isArray(opp.operatingDays) || opp.operatingDays.length === 0) {
        warnings.push(`Connection opportunity ${index} has no operating days`);
      }

      // Validate metadata
      if (!opp.metadata || typeof opp.metadata !== 'object') {
        errors.push(`Connection opportunity ${index} must have valid metadata`);
      } else {
        if (!opp.metadata.serviceName || typeof opp.metadata.serviceName !== 'string') {
          errors.push(`Connection opportunity ${index} must have valid service name`);
        }
      }
    });

    return { isValid: errors.length === 0 && criticalIssues.length === 0, errors, warnings, criticalIssues, suggestions: [] };
  }

  /**
   * Validate optimization constraints
   */
  private static validateConstraints(constraints: OptimizationConstraints): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    if (!constraints) {
      criticalIssues.push('Optimization constraints are required');
      return { isValid: false, errors, warnings, criticalIssues, suggestions: [] };
    }

    // Validate time constraints
    if (typeof constraints.maxTripDeviation !== 'number' || constraints.maxTripDeviation <= 0) {
      errors.push('Maximum trip deviation must be a positive number');
    } else if (constraints.maxTripDeviation > 60) {
      warnings.push('Very large trip deviation limit may affect schedule reliability');
    }

    if (typeof constraints.maxScheduleShift !== 'number' || constraints.maxScheduleShift <= 0) {
      errors.push('Maximum schedule shift must be a positive number');
    }

    if (typeof constraints.minRecoveryTime !== 'number' || constraints.minRecoveryTime < 0) {
      errors.push('Minimum recovery time must be non-negative');
    }

    if (typeof constraints.maxRecoveryTime !== 'number' || constraints.maxRecoveryTime <= 0) {
      errors.push('Maximum recovery time must be positive');
    }

    if (constraints.minRecoveryTime >= constraints.maxRecoveryTime) {
      errors.push('Minimum recovery time must be less than maximum recovery time');
    }

    // Validate performance constraints
    if (!constraints.performance) {
      errors.push('Performance constraints are required');
    } else {
      if (typeof constraints.performance.maxOptimizationTimeMs !== 'number' || constraints.performance.maxOptimizationTimeMs <= 0) {
        errors.push('Maximum optimization time must be positive');
      }

      if (typeof constraints.performance.maxMemoryUsageMB !== 'number' || constraints.performance.maxMemoryUsageMB <= 0) {
        errors.push('Maximum memory usage must be positive');
      }

      if (typeof constraints.performance.earlyTerminationThreshold !== 'number' || constraints.performance.earlyTerminationThreshold < 0) {
        errors.push('Early termination threshold must be non-negative');
      }
    }

    return { isValid: errors.length === 0 && criticalIssues.length === 0, errors, warnings, criticalIssues, suggestions: [] };
  }

  /**
   * Validate recovery bank configuration
   */
  private static validateRecoveryBankConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    if (!config) {
      errors.push('Recovery bank configuration is required');
      return { isValid: false, errors, warnings, criticalIssues, suggestions: [] };
    }

    if (typeof config.allowBorrowing !== 'boolean') {
      errors.push('Allow borrowing must be a boolean value');
    }

    if (typeof config.maxBorrowingRatio !== 'number' || config.maxBorrowingRatio < 0 || config.maxBorrowingRatio > 2) {
      errors.push('Maximum borrowing ratio must be between 0 and 2');
    } else if (config.maxBorrowingRatio > 1) {
      warnings.push('Borrowing ratio > 1 may cause recovery time shortages');
    }

    if (!Array.isArray(config.stopConfigurations)) {
      warnings.push('No stop configurations provided - will use defaults');
    }

    return { isValid: errors.length === 0 && criticalIssues.length === 0, errors, warnings, criticalIssues, suggestions: [] };
  }

  /**
   * Validate headway correction settings
   */
  private static validateHeadwayCorrection(correction: HeadwayCorrection): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    if (!correction) {
      errors.push('Headway correction configuration is required');
      return { isValid: false, errors, warnings, criticalIssues, suggestions: [] };
    }

    if (typeof correction.targetHeadway !== 'number' || correction.targetHeadway <= 0) {
      errors.push('Target headway must be a positive number');
    }

    if (typeof correction.maxDeviationThreshold !== 'number' || correction.maxDeviationThreshold < 0) {
      errors.push('Maximum deviation threshold must be non-negative');
    }

    if (typeof correction.correctionHorizon !== 'number' || correction.correctionHorizon < 1) {
      errors.push('Correction horizon must be at least 1');
    } else if (correction.correctionHorizon > 10) {
      warnings.push('Large correction horizon may cause instability');
    }

    if (typeof correction.correctionStrength !== 'number' || correction.correctionStrength < 0 || correction.correctionStrength > 1) {
      errors.push('Correction strength must be between 0 and 1');
    }

    if (!['forward', 'backward', 'bidirectional'].includes(correction.correctionDirection)) {
      errors.push('Invalid correction direction');
    }

    return { isValid: errors.length === 0 && criticalIssues.length === 0, errors, warnings, criticalIssues, suggestions: [] };
  }

  /**
   * Perform cross-validation checks between different components
   */
  private static performCrossValidation(request: ConnectionOptimizationRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    // Check if connection opportunities reference valid locations
    request.connectionOpportunities.forEach((opp, index) => {
      const locationExists = request.schedule.timePoints.some(tp => tp.id === opp.locationId);
      if (!locationExists) {
        errors.push(`Connection opportunity ${index} references non-existent location: ${opp.locationId}`);
      }

      // Check if affected trips exist
      opp.affectedTrips.forEach(tripId => {
        const tripExists = request.schedule.trips.some(trip => trip.tripNumber.toString() === tripId);
        if (!tripExists) {
          warnings.push(`Connection opportunity ${index} references non-existent trip: ${tripId}`);
        }
      });
    });

    // Check constraint consistency
    if (request.constraints.maxTripDeviation < request.headwayCorrection.maxDeviationThreshold) {
      warnings.push('Headway correction threshold exceeds maximum trip deviation - corrections may be limited');
    }

    // Check recovery bank vs constraints consistency
    if (request.recoveryBankConfig.allowBorrowing && request.constraints.minRecoveryTime > 0) {
      const potentialConflict = request.constraints.minRecoveryTime > 5; // Arbitrary threshold
      if (potentialConflict) {
        warnings.push('High minimum recovery requirement may conflict with recovery borrowing');
      }
    }

    return { isValid: errors.length === 0 && criticalIssues.length === 0, errors, warnings, criticalIssues, suggestions: [] };
  }

  /**
   * Generate optimization suggestions
   */
  private static generateOptimizationSuggestions(request: ConnectionOptimizationRequest): string[] {
    const suggestions: string[] = [];

    // Analyze trip count and suggest optimizations
    if (request.schedule.trips.length > 500) {
      suggestions.push('Consider enabling parallel processing for better performance with large trip counts');
    }

    // Analyze connection density
    const connectionDensity = request.connectionOpportunities.length / request.schedule.trips.length;
    if (connectionDensity > 0.5) {
      suggestions.push('High connection density detected. Consider prioritizing most critical connections');
    } else if (connectionDensity < 0.1) {
      suggestions.push('Low connection density. You may be able to optimize for additional connection opportunities');
    }

    // Analyze constraint settings
    if (request.constraints.maxTripDeviation < 5) {
      suggestions.push('Tight trip deviation constraint may limit optimization potential. Consider relaxing if operationally feasible');
    }

    if (request.headwayCorrection.correctionStrength < 0.3) {
      suggestions.push('Low correction strength may result in poor headway regularity. Consider increasing if schedule allows');
    }

    // Analyze time distribution of connections
    const timeDistribution = new Map<number, number>();
    request.connectionOpportunities.forEach(opp => {
      const hour = Math.floor(timeToMinutes(opp.targetTime) / 60);
      timeDistribution.set(hour, (timeDistribution.get(hour) || 0) + 1);
    });

    const peakHour = Array.from(timeDistribution.entries()).reduce((max, curr) => 
      curr[1] > max[1] ? curr : max, [0, 0]
    );

    if (peakHour[1] > request.connectionOpportunities.length * 0.4) {
      suggestions.push(`High concentration of connections at hour ${peakHour[0]}. Consider spreading connections across time periods`);
    }

    return suggestions;
  }
}

/**
 * Sanitize and validate optimization inputs
 */
export class OptimizationSanitizer {
  /**
   * Sanitize optimization request
   */
  static sanitizeRequest(request: ConnectionOptimizationRequest): ConnectionOptimizationRequest {
    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(request));

    // Sanitize string fields
    if (sanitized.schedule.routeName) {
      sanitized.schedule.routeName = this.sanitizeString(sanitized.schedule.routeName);
    }

    if (sanitized.schedule.direction) {
      sanitized.schedule.direction = this.sanitizeString(sanitized.schedule.direction);
    }

    // Sanitize connection opportunities
    sanitized.connectionOpportunities.forEach((opp: any) => {
      if (opp.metadata.serviceName) {
        opp.metadata.serviceName = this.sanitizeString(opp.metadata.serviceName);
      }
      if (opp.metadata.description) {
        opp.metadata.description = this.sanitizeString(opp.metadata.description);
      }
    });

    // Clamp numeric values to safe ranges
    sanitized.constraints.maxTripDeviation = Math.max(1, Math.min(60, sanitized.constraints.maxTripDeviation));
    sanitized.constraints.performance.maxOptimizationTimeMs = Math.max(5000, Math.min(600000, sanitized.constraints.performance.maxOptimizationTimeMs));
    sanitized.constraints.performance.maxMemoryUsageMB = Math.max(64, Math.min(2048, sanitized.constraints.performance.maxMemoryUsageMB));

    sanitized.options.maxIterations = Math.max(10, Math.min(10000, sanitized.options.maxIterations));

    return sanitized;
  }

  /**
   * Sanitize string input
   */
  private static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>]/g, '') // Remove angle brackets
      .substring(0, 200) // Limit length
      .trim();
  }
}

/**
 * Export validation utilities
 */
export const optimizationValidator = OptimizationValidator;
export const optimizationSanitizer = OptimizationSanitizer;
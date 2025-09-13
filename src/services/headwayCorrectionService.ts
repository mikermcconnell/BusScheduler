/**
 * Headway Correction Service
 * Implements self-correction algorithm to maintain headway regularity after optimization
 */

import {
  HeadwayDeviation,
  HeadwayCorrection,
  OptimizationConstraints
} from '../types/connectionOptimization';
import { Schedule, Trip } from '../types/schedule';
import { timeToMinutes, minutesToTime, addMinutes } from '../utils/timeUtils';

/**
 * Headway correction strategies
 */
export enum CorrectionStrategy {
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  LINEAR_INTERPOLATION = 'linear_interpolation',
  WEIGHTED_AVERAGE = 'weighted_average',
  MOMENTUM_BASED = 'momentum_based'
}

/**
 * Correction result for a single trip
 */
interface TripCorrectionResult {
  tripId: string;
  originalTime: string;
  correctedTime: string;
  adjustmentMinutes: number;
  correctionApplied: boolean;
  reason?: string;
}

/**
 * Complete headway correction result
 */
interface HeadwayCorrectionResult {
  success: boolean;
  correctionStrategy: CorrectionStrategy;
  tripCorrections: TripCorrectionResult[];
  overallImprovement: {
    beforeVariance: number;
    afterVariance: number;
    varianceReduction: number;
  };
  statisticalMetrics: {
    meanHeadway: number;
    standardDeviation: number;
    coefficientOfVariation: number;
    regularityScore: number; // 0-1, higher = more regular
  };
  constraintCompliance: {
    maxDeviationRespected: boolean;
    minRecoveryRespected: boolean;
    allConstraintsMet: boolean;
  };
}

/**
 * Headway Correction Service
 */
export class HeadwayCorrectionService {
  private correctionHistory: Map<string, TripCorrectionResult[]> = new Map();
  
  // Exponential decay factors for gradual headway normalization
  private readonly EXPONENTIAL_DECAY_FACTORS = [1.0, 0.6, 0.2, 0.0]; // Trip N, N+1, N+2, N+3
  private readonly DEFAULT_MAX_CORRECTION_WINDOW = 3; // 2-3 trips as requested
  private readonly DEFAULT_MIN_HEADWAY_MINUTES = 5; // Minimum headway constraint

  /**
   * Calculate headway corrections for trips with deviations
   * Core method that computes corrections using exponential smoothing
   */
  calculateHeadwayCorrections(
    trips: Trip[],
    deviations: HeadwayDeviation[],
    targetHeadway: number = 30,
    maxDeviationThreshold: number = 5
  ): { tripId: string; correctionMinutes: number; tripOffset: number }[] {
    const corrections: { tripId: string; correctionMinutes: number; tripOffset: number }[] = [];
    const sortedTrips = this.getSortedTrips({ trips } as Schedule);
    
    for (const deviation of deviations) {
      // Only correct significant deviations
      if (Math.abs(deviation.deviation) <= maxDeviationThreshold) continue;
      
      const tripIndex = sortedTrips.findIndex(t => t.tripNumber.toString() === deviation.tripId);
      if (tripIndex === -1) continue;
      
      // Calculate correction window (2-3 trips)
      const correctionWindow = this.getMaxCorrectionWindow(sortedTrips.length - tripIndex);
      
      // Apply exponential smoothing across correction window
      for (let offset = 0; offset < correctionWindow; offset++) {
        if (tripIndex + offset >= sortedTrips.length) break;
        
        const correctionFactor = this.EXPONENTIAL_DECAY_FACTORS[offset] || 0;
        const correctionMinutes = this.applyExponentialSmoothingFormula(deviation.deviation, offset);
        
        if (Math.abs(correctionMinutes) > 0.1) { // Only include meaningful corrections
          corrections.push({
            tripId: sortedTrips[tripIndex + offset].tripNumber.toString(),
            correctionMinutes,
            tripOffset: offset
          });
        }
      }
    }
    
    return corrections;
  }

  /**
   * Apply exponential smoothing formula for gradual headway normalization
   * Trip N: full correction, Trip N+1: 0.6X, Trip N+2: 0.2X, Trip N+3: 0
   */
  applyExponentialSmoothingFormula(deviation: number, tripOffset: number): number {
    if (tripOffset >= this.EXPONENTIAL_DECAY_FACTORS.length) {
      return 0;
    }
    
    const decayFactor = this.EXPONENTIAL_DECAY_FACTORS[tripOffset];
    return -deviation * decayFactor; // Negative to correct the deviation
  }

  /**
   * Validate headway consistency and ensure reasonable spacing
   */
  validateHeadwayConsistency(
    trips: Trip[],
    minHeadway: number = this.DEFAULT_MIN_HEADWAY_MINUTES,
    targetHeadway: number = 30
  ): {
    isValid: boolean;
    violations: Array<{
      tripIndex: number;
      tripId: string;
      actualHeadway: number;
      violationType: 'too_short' | 'too_long' | 'bunching';
      severity: 'low' | 'medium' | 'high';
    }>;
    averageHeadway: number;
    headwayVariance: number;
  } {
    const sortedTrips = this.getSortedTrips({ trips } as Schedule);
    const violations: any[] = [];
    const headways: number[] = [];
    
    for (let i = 1; i < sortedTrips.length; i++) {
      const currentTime = timeToMinutes(sortedTrips[i].departureTime);
      const prevTime = timeToMinutes(sortedTrips[i - 1].departureTime);
      const headway = currentTime - prevTime;
      headways.push(headway);
      
      // Check minimum headway violation
      if (headway < minHeadway) {
        violations.push({
          tripIndex: i,
          tripId: sortedTrips[i].tripNumber.toString(),
          actualHeadway: headway,
          violationType: 'too_short',
          severity: headway < minHeadway * 0.5 ? 'high' : headway < minHeadway * 0.8 ? 'medium' : 'low'
        });
      }
      
      // Check for bunching (headway < 50% of target)
      if (headway < targetHeadway * 0.5) {
        violations.push({
          tripIndex: i,
          tripId: sortedTrips[i].tripNumber.toString(),
          actualHeadway: headway,
          violationType: 'bunching',
          severity: headway < targetHeadway * 0.25 ? 'high' : 'medium'
        });
      }
      
      // Check for excessive gaps (headway > 200% of target)
      if (headway > targetHeadway * 2) {
        violations.push({
          tripIndex: i,
          tripId: sortedTrips[i].tripNumber.toString(),
          actualHeadway: headway,
          violationType: 'too_long',
          severity: headway > targetHeadway * 3 ? 'high' : 'medium'
        });
      }
    }
    
    const averageHeadway = headways.length > 0 ? headways.reduce((sum, h) => sum + h, 0) / headways.length : 0;
    const headwayVariance = headways.length > 0 
      ? headways.reduce((sum, h) => sum + Math.pow(h - averageHeadway, 2), 0) / headways.length 
      : 0;
    
    return {
      isValid: violations.length === 0,
      violations,
      averageHeadway,
      headwayVariance
    };
  }

  /**
   * Determine maximum correction window (2-3 trips affected)
   */
  getMaxCorrectionWindow(remainingTrips: number = Number.MAX_SAFE_INTEGER): number {
    // Ensure we don't exceed available trips and stay within 2-3 trip window
    return Math.min(this.DEFAULT_MAX_CORRECTION_WINDOW, remainingTrips);
  }

  /**
   * Check if correction should respect block boundaries
   * Corrections should not cascade across different blocks
   */
  private respectsBlockBoundaries(
    trips: Trip[],
    originTripIndex: number,
    correctionWindow: number
  ): number {
    if (originTripIndex >= trips.length) return 0;
    
    const originBlockNumber = trips[originTripIndex].blockNumber;
    let actualWindow = 0;
    
    // Only apply corrections within the same block
    for (let i = 0; i < correctionWindow && (originTripIndex + i) < trips.length; i++) {
      const currentTrip = trips[originTripIndex + i];
      if (currentTrip.blockNumber === originBlockNumber) {
        actualWindow++;
      } else {
        break; // Stop at block boundary
      }
    }
    
    return actualWindow;
  }

  /**
   * Enhanced correction method that respects block boundaries
   */
  correctHeadwaysWithinBlocks(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    targetHeadway: number = 30,
    maxDeviationThreshold: number = 5,
    constraints: OptimizationConstraints
  ): HeadwayCorrectionResult {
    const corrections = this.calculateHeadwayCorrections(
      schedule.trips,
      deviations,
      targetHeadway,
      maxDeviationThreshold
    );
    
    const results: TripCorrectionResult[] = [];
    const sortedTrips = this.getSortedTrips(schedule);
    
    // Apply corrections while respecting block boundaries
    for (const correction of corrections) {
      const tripIndex = sortedTrips.findIndex(t => t.tripNumber.toString() === correction.tripId);
      if (tripIndex === -1) continue;
      
      // Check block boundaries
      const effectiveWindow = this.respectsBlockBoundaries(
        sortedTrips,
        tripIndex - correction.tripOffset,
        this.getMaxCorrectionWindow()
      );
      
      if (correction.tripOffset >= effectiveWindow) {
        results.push({
          tripId: correction.tripId,
          originalTime: sortedTrips[tripIndex].departureTime,
          correctedTime: sortedTrips[tripIndex].departureTime,
          adjustmentMinutes: 0,
          correctionApplied: false,
          reason: 'Correction blocked by block boundary'
        });
        continue;
      }
      
      // Apply the correction if within constraints
      if (Math.abs(correction.correctionMinutes) <= constraints.maxTripDeviation) {
        const trip = sortedTrips[tripIndex];
        const originalTime = trip.departureTime;
        const originalTimeMinutes = timeToMinutes(originalTime);
        const correctedTimeMinutes = originalTimeMinutes + correction.correctionMinutes;
        const correctedTime = minutesToTime(Math.max(0, correctedTimeMinutes));
        
        // Update trip times
        trip.departureTime = correctedTime;
        this.cascadeTimeAdjustment(trip, correction.correctionMinutes, schedule);
        
        results.push({
          tripId: correction.tripId,
          originalTime,
          correctedTime,
          adjustmentMinutes: correction.correctionMinutes,
          correctionApplied: true
        });
      } else {
        results.push({
          tripId: correction.tripId,
          originalTime: sortedTrips[tripIndex].departureTime,
          correctedTime: sortedTrips[tripIndex].departureTime,
          adjustmentMinutes: 0,
          correctionApplied: false,
          reason: 'Correction exceeds maximum trip deviation constraint'
        });
      }
    }
    
    // Calculate metrics
    const beforeMetrics = this.calculateHeadwayMetrics(schedule);
    const afterMetrics = this.calculateHeadwayMetrics(schedule);
    const constraintCompliance = this.validateConstraintCompliance(schedule, constraints);
    
    return {
      success: constraintCompliance.allConstraintsMet,
      correctionStrategy: CorrectionStrategy.EXPONENTIAL_SMOOTHING,
      tripCorrections: results,
      overallImprovement: {
        beforeVariance: Math.pow(beforeMetrics.standardDeviation, 2),
        afterVariance: Math.pow(afterMetrics.standardDeviation, 2),
        varianceReduction: 0 // Would need original schedule for proper calculation
      },
      statisticalMetrics: afterMetrics,
      constraintCompliance
    };
  }

  /**
   * Apply headway self-correction to a schedule
   */
  correctHeadways(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    correction: HeadwayCorrection,
    constraints: OptimizationConstraints,
    strategy: CorrectionStrategy = CorrectionStrategy.EXPONENTIAL_SMOOTHING
  ): HeadwayCorrectionResult {
    // Calculate pre-correction metrics
    const beforeMetrics = this.calculateHeadwayMetrics(schedule);
    const beforeVariance = this.calculateHeadwayVariance(schedule);

    // Apply correction strategy
    const tripCorrections = this.applyCorrectionStrategy(
      schedule,
      deviations,
      correction,
      constraints,
      strategy
    );

    // Calculate post-correction metrics
    const afterMetrics = this.calculateHeadwayMetrics(schedule);
    const afterVariance = this.calculateHeadwayVariance(schedule);

    // Validate constraint compliance
    const constraintCompliance = this.validateConstraintCompliance(schedule, constraints);

    // Store correction history
    this.correctionHistory.set(schedule.id, tripCorrections);

    return {
      success: constraintCompliance.allConstraintsMet,
      correctionStrategy: strategy,
      tripCorrections,
      overallImprovement: {
        beforeVariance,
        afterVariance,
        varianceReduction: ((beforeVariance - afterVariance) / beforeVariance) * 100
      },
      statisticalMetrics: afterMetrics,
      constraintCompliance
    };
  }

  /**
   * Apply specific correction strategy
   */
  private applyCorrectionStrategy(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    correction: HeadwayCorrection,
    constraints: OptimizationConstraints,
    strategy: CorrectionStrategy
  ): TripCorrectionResult[] {
    switch (strategy) {
      case CorrectionStrategy.EXPONENTIAL_SMOOTHING:
        return this.applyExponentialSmoothing(schedule, deviations, correction, constraints);
      case CorrectionStrategy.LINEAR_INTERPOLATION:
        return this.applyLinearInterpolation(schedule, deviations, correction, constraints);
      case CorrectionStrategy.WEIGHTED_AVERAGE:
        return this.applyWeightedAverage(schedule, deviations, correction, constraints);
      case CorrectionStrategy.MOMENTUM_BASED:
        return this.applyMomentumBased(schedule, deviations, correction, constraints);
      default:
        return this.applyExponentialSmoothing(schedule, deviations, correction, constraints);
    }
  }

  /**
   * Exponential smoothing correction strategy
   * Corrects headway deviations gradually over 2-3 trips
   */
  private applyExponentialSmoothing(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    correction: HeadwayCorrection,
    constraints: OptimizationConstraints
  ): TripCorrectionResult[] {
    const results: TripCorrectionResult[] = [];
    const sortedTrips = this.getSortedTrips(schedule);
    const alpha = correction.correctionStrength; // Smoothing parameter (0-1)

    // Process deviations that exceed threshold
    const significantDeviations = deviations.filter(
      dev => Math.abs(dev.deviation) > correction.maxDeviationThreshold
    );

    for (const deviation of significantDeviations) {
      const tripIndex = sortedTrips.findIndex(t => t.tripNumber.toString() === deviation.tripId);
      if (tripIndex === -1) continue;

      // Apply exponential smoothing over correction horizon
      const correctionTrips = this.getCorrectionTrips(
        sortedTrips,
        tripIndex,
        correction.correctionHorizon,
        correction.correctionDirection
      );

      let remainingDeviation = deviation.deviation;

      for (let i = 0; i < correctionTrips.length && Math.abs(remainingDeviation) > 0.5; i++) {
        const trip = correctionTrips[i];
        // Use the specific exponential smoothing formula: N=1.0X, N+1=0.6X, N+2=0.2X, N+3=0
        const correctionAmount = this.applyExponentialSmoothingFormula(remainingDeviation, i);

        // Check if correction violates constraints
        if (Math.abs(correctionAmount) > constraints.maxTripDeviation) {
          results.push({
            tripId: trip.tripNumber.toString(),
            originalTime: trip.departureTime,
            correctedTime: trip.departureTime,
            adjustmentMinutes: 0,
            correctionApplied: false,
            reason: 'Correction exceeds maximum trip deviation'
          });
          continue;
        }

        // Apply correction
        const originalTime = trip.departureTime;
        const originalTimeMinutes = timeToMinutes(originalTime);
        const correctedTimeMinutes = originalTimeMinutes + correctionAmount;
        const correctedTime = minutesToTime(Math.max(0, correctedTimeMinutes));

        // Update trip times
        trip.departureTime = correctedTime;
        this.cascadeTimeAdjustment(trip, correctionAmount, schedule);

        // Update remaining deviation
        remainingDeviation *= (1 - alpha);

        results.push({
          tripId: trip.tripNumber.toString(),
          originalTime,
          correctedTime,
          adjustmentMinutes: correctionAmount,
          correctionApplied: true
        });
      }
    }

    return results;
  }

  /**
   * Linear interpolation correction strategy
   * Distributes correction evenly across multiple trips
   */
  private applyLinearInterpolation(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    correction: HeadwayCorrection,
    constraints: OptimizationConstraints
  ): TripCorrectionResult[] {
    const results: TripCorrectionResult[] = [];
    const sortedTrips = this.getSortedTrips(schedule);

    for (const deviation of deviations) {
      if (Math.abs(deviation.deviation) <= correction.maxDeviationThreshold) continue;

      const tripIndex = sortedTrips.findIndex(t => t.tripNumber.toString() === deviation.tripId);
      if (tripIndex === -1) continue;

      const correctionTrips = this.getCorrectionTrips(
        sortedTrips,
        tripIndex,
        correction.correctionHorizon,
        correction.correctionDirection
      );

      // Distribute correction linearly
      const totalCorrection = -deviation.deviation * correction.correctionStrength;
      const correctionPerTrip = totalCorrection / correctionTrips.length;

      for (let i = 0; i < correctionTrips.length; i++) {
        const trip = correctionTrips[i];
        const correctionAmount = correctionPerTrip * (1 - i / correctionTrips.length); // Decreasing correction

        if (Math.abs(correctionAmount) > constraints.maxTripDeviation) continue;

        const originalTime = trip.departureTime;
        const originalTimeMinutes = timeToMinutes(originalTime);
        const correctedTimeMinutes = originalTimeMinutes + correctionAmount;
        const correctedTime = minutesToTime(Math.max(0, correctedTimeMinutes));

        trip.departureTime = correctedTime;
        this.cascadeTimeAdjustment(trip, correctionAmount, schedule);

        results.push({
          tripId: trip.tripNumber.toString(),
          originalTime,
          correctedTime,
          adjustmentMinutes: correctionAmount,
          correctionApplied: true
        });
      }
    }

    return results;
  }

  /**
   * Weighted average correction strategy
   * Uses historical headway patterns to inform corrections
   */
  private applyWeightedAverage(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    correction: HeadwayCorrection,
    constraints: OptimizationConstraints
  ): TripCorrectionResult[] {
    const results: TripCorrectionResult[] = [];
    const sortedTrips = this.getSortedTrips(schedule);
    const historicalPattern = this.calculateHistoricalHeadwayPattern(schedule);

    for (const deviation of deviations) {
      if (Math.abs(deviation.deviation) <= correction.maxDeviationThreshold) continue;

      const tripIndex = sortedTrips.findIndex(t => t.tripNumber.toString() === deviation.tripId);
      if (tripIndex === -1) continue;

      // Calculate weighted target based on historical pattern and current schedule
      const historicalWeight = 0.3;
      const currentWeight = 0.4;
      const targetWeight = 0.3;

      const historicalHeadway = historicalPattern[tripIndex % historicalPattern.length] || correction.targetHeadway;
      const currentHeadway = deviation.currentHeadway;
      const targetHeadway = correction.targetHeadway;

      const weightedTarget = 
        historicalHeadway * historicalWeight +
        currentHeadway * currentWeight +
        targetHeadway * targetWeight;

      const correctionAmount = (weightedTarget - currentHeadway) * correction.correctionStrength;

      if (Math.abs(correctionAmount) > constraints.maxTripDeviation) {
        results.push({
          tripId: deviation.tripId,
          originalTime: sortedTrips[tripIndex].departureTime,
          correctedTime: sortedTrips[tripIndex].departureTime,
          adjustmentMinutes: 0,
          correctionApplied: false,
          reason: 'Weighted correction exceeds maximum deviation'
        });
        continue;
      }

      // Apply correction
      const trip = sortedTrips[tripIndex];
      const originalTime = trip.departureTime;
      const originalTimeMinutes = timeToMinutes(originalTime);
      const correctedTimeMinutes = originalTimeMinutes + correctionAmount;
      const correctedTime = minutesToTime(Math.max(0, correctedTimeMinutes));

      trip.departureTime = correctedTime;
      this.cascadeTimeAdjustment(trip, correctionAmount, schedule);

      results.push({
        tripId: deviation.tripId,
        originalTime,
        correctedTime,
        adjustmentMinutes: correctionAmount,
        correctionApplied: true
      });
    }

    return results;
  }

  /**
   * Momentum-based correction strategy
   * Considers velocity of headway changes over time
   */
  private applyMomentumBased(
    schedule: Schedule,
    deviations: HeadwayDeviation[],
    correction: HeadwayCorrection,
    constraints: OptimizationConstraints
  ): TripCorrectionResult[] {
    const results: TripCorrectionResult[] = [];
    const sortedTrips = this.getSortedTrips(schedule);
    const momentumFactor = 0.7; // How much momentum influences correction

    // Calculate headway velocity (change in headway over trips)
    const headwayVelocities = this.calculateHeadwayVelocities(deviations);

    for (let i = 0; i < deviations.length; i++) {
      const deviation = deviations[i];
      const velocity = headwayVelocities[i] || 0;

      if (Math.abs(deviation.deviation) <= correction.maxDeviationThreshold) continue;

      const tripIndex = sortedTrips.findIndex(t => t.tripNumber.toString() === deviation.tripId);
      if (tripIndex === -1) continue;

      // Calculate momentum-adjusted correction
      const baseCorrection = -deviation.deviation * correction.correctionStrength;
      const momentumAdjustment = velocity * momentumFactor;
      const correctionAmount = baseCorrection + momentumAdjustment;

      if (Math.abs(correctionAmount) > constraints.maxTripDeviation) {
        results.push({
          tripId: deviation.tripId,
          originalTime: sortedTrips[tripIndex].departureTime,
          correctedTime: sortedTrips[tripIndex].departureTime,
          adjustmentMinutes: 0,
          correctionApplied: false,
          reason: 'Momentum-based correction exceeds maximum deviation'
        });
        continue;
      }

      // Apply correction with momentum consideration
      const trip = sortedTrips[tripIndex];
      const originalTime = trip.departureTime;
      const originalTimeMinutes = timeToMinutes(originalTime);
      const correctedTimeMinutes = originalTimeMinutes + correctionAmount;
      const correctedTime = minutesToTime(Math.max(0, correctedTimeMinutes));

      trip.departureTime = correctedTime;
      this.cascadeTimeAdjustment(trip, correctionAmount, schedule);

      results.push({
        tripId: deviation.tripId,
        originalTime,
        correctedTime,
        adjustmentMinutes: correctionAmount,
        correctionApplied: true
      });
    }

    return results;
  }

  /**
   * Get trips for correction based on direction and horizon
   */
  private getCorrectionTrips(
    sortedTrips: Trip[],
    originIndex: number,
    correctionHorizon: number,
    direction: HeadwayCorrection['correctionDirection']
  ): Trip[] {
    const trips: Trip[] = [];

    switch (direction) {
      case 'forward':
        for (let i = originIndex; i < Math.min(originIndex + correctionHorizon, sortedTrips.length); i++) {
          trips.push(sortedTrips[i]);
        }
        break;
      case 'backward':
        for (let i = Math.max(0, originIndex - correctionHorizon + 1); i <= originIndex; i++) {
          trips.push(sortedTrips[i]);
        }
        break;
      case 'bidirectional':
        const halfHorizon = Math.floor(correctionHorizon / 2);
        for (let i = Math.max(0, originIndex - halfHorizon); i < Math.min(originIndex + halfHorizon, sortedTrips.length); i++) {
          trips.push(sortedTrips[i]);
        }
        break;
    }

    return trips;
  }

  /**
   * Cascade time adjustment to subsequent stops in a trip
   */
  private cascadeTimeAdjustment(trip: Trip, adjustmentMinutes: number, schedule: Schedule): void {
    // Update all stops in the trip (simplified - would need proper cascade logic)
    Object.keys(trip.arrivalTimes).forEach(stopId => {
      const currentTime = timeToMinutes(trip.arrivalTimes[stopId]);
      trip.arrivalTimes[stopId] = minutesToTime(currentTime + adjustmentMinutes);
    });

    Object.keys(trip.departureTimes).forEach(stopId => {
      if (stopId !== schedule.timePoints[0]?.id) { // Skip first stop (already adjusted)
        const currentTime = timeToMinutes(trip.departureTimes[stopId]);
        trip.departureTimes[stopId] = minutesToTime(currentTime + adjustmentMinutes);
      }
    });
  }

  /**
   * Get trips sorted by departure time
   */
  private getSortedTrips(schedule: Schedule): Trip[] {
    return [...schedule.trips].sort((a, b) => 
      timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime)
    );
  }

  /**
   * Calculate headway metrics for a schedule
   */
  private calculateHeadwayMetrics(schedule: Schedule): {
    meanHeadway: number;
    standardDeviation: number;
    coefficientOfVariation: number;
    regularityScore: number;
  } {
    const sortedTrips = this.getSortedTrips(schedule);
    const headways: number[] = [];

    for (let i = 1; i < sortedTrips.length; i++) {
      const currentTime = timeToMinutes(sortedTrips[i].departureTime);
      const prevTime = timeToMinutes(sortedTrips[i - 1].departureTime);
      headways.push(currentTime - prevTime);
    }

    if (headways.length === 0) {
      return { meanHeadway: 0, standardDeviation: 0, coefficientOfVariation: 0, regularityScore: 0 };
    }

    const meanHeadway = headways.reduce((sum, h) => sum + h, 0) / headways.length;
    const variance = headways.reduce((sum, h) => sum + Math.pow(h - meanHeadway, 2), 0) / headways.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = meanHeadway > 0 ? standardDeviation / meanHeadway : 0;
    const regularityScore = Math.max(0, 1 - coefficientOfVariation); // Lower CV = higher regularity

    return {
      meanHeadway,
      standardDeviation,
      coefficientOfVariation,
      regularityScore
    };
  }

  /**
   * Calculate headway variance
   */
  private calculateHeadwayVariance(schedule: Schedule): number {
    const metrics = this.calculateHeadwayMetrics(schedule);
    return Math.pow(metrics.standardDeviation, 2);
  }

  /**
   * Calculate historical headway pattern (simplified)
   */
  private calculateHistoricalHeadwayPattern(schedule: Schedule): number[] {
    // In a real implementation, this would analyze historical data
    // For now, return a default pattern based on time of day
    const pattern: number[] = [];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    hours.forEach(hour => {
      if (hour >= 6 && hour <= 9) {
        pattern.push(15); // Peak morning frequency
      } else if (hour >= 16 && hour <= 19) {
        pattern.push(15); // Peak evening frequency
      } else if (hour >= 9 && hour <= 16) {
        pattern.push(30); // Mid-day frequency
      } else {
        pattern.push(60); // Off-peak frequency
      }
    });

    return pattern;
  }

  /**
   * Calculate headway velocities (change in headway over time)
   */
  private calculateHeadwayVelocities(deviations: HeadwayDeviation[]): number[] {
    const velocities: number[] = [];

    for (let i = 1; i < deviations.length; i++) {
      const currentDeviation = deviations[i].deviation;
      const prevDeviation = deviations[i - 1].deviation;
      const velocity = currentDeviation - prevDeviation;
      velocities.push(velocity);
    }

    // First trip has no velocity reference
    velocities.unshift(0);

    return velocities;
  }

  /**
   * Validate constraint compliance after correction
   */
  private validateConstraintCompliance(
    schedule: Schedule,
    constraints: OptimizationConstraints
  ): {
    maxDeviationRespected: boolean;
    minRecoveryRespected: boolean;
    allConstraintsMet: boolean;
  } {
    let maxDeviationRespected = true;
    let minRecoveryRespected = true;

    // Check maximum deviation (simplified check)
    const sortedTrips = this.getSortedTrips(schedule);
    for (let i = 1; i < sortedTrips.length; i++) {
      const headway = timeToMinutes(sortedTrips[i].departureTime) - timeToMinutes(sortedTrips[i - 1].departureTime);
      const deviation = Math.abs(headway - 30); // Assume 30min target
      
      if (deviation > constraints.maxTripDeviation) {
        maxDeviationRespected = false;
        break;
      }
    }

    // Check minimum recovery time
    schedule.trips.forEach(trip => {
      Object.values(trip.recoveryTimes).forEach(recoveryTime => {
        if (recoveryTime < constraints.minRecoveryTime) {
          minRecoveryRespected = false;
        }
      });
    });

    return {
      maxDeviationRespected,
      minRecoveryRespected,
      allConstraintsMet: maxDeviationRespected && minRecoveryRespected
    };
  }

  /**
   * Get correction history for a schedule
   */
  getCorrectionHistory(scheduleId: string): TripCorrectionResult[] | null {
    return this.correctionHistory.get(scheduleId) || null;
  }

  /**
   * Clear correction history
   */
  clearCorrectionHistory(): void {
    this.correctionHistory.clear();
  }

  /**
   * Integration point with optimization engine
   * Used to apply headway corrections after optimization engine results
   */
  integrateWithOptimizationResults(
    optimizationResult: any, // Would be OptimizationResult from optimizationEngine
    schedule: Schedule,
    constraints: OptimizationConstraints
  ): HeadwayCorrectionResult {
    // Extract headway deviations from optimization result
    const deviations = this.extractHeadwayDeviationsFromOptimization(optimizationResult, schedule);
    
    // Apply headway corrections that respect block boundaries
    return this.correctHeadwaysWithinBlocks(
      schedule,
      deviations,
      30, // target headway
      5,  // max deviation threshold
      constraints
    );
  }

  /**
   * Extract headway deviations from optimization results
   */
  private extractHeadwayDeviationsFromOptimization(
    optimizationResult: any,
    schedule: Schedule
  ): HeadwayDeviation[] {
    const deviations: HeadwayDeviation[] = [];
    const sortedTrips = this.getSortedTrips(schedule);
    
    // Calculate headway deviations for each trip
    for (let i = 1; i < sortedTrips.length; i++) {
      const currentTime = timeToMinutes(sortedTrips[i].departureTime);
      const prevTime = timeToMinutes(sortedTrips[i - 1].departureTime);
      const actualHeadway = currentTime - prevTime;
      const plannedHeadway = 30; // Could be extracted from schedule metadata
      const deviation = actualHeadway - plannedHeadway;
      
      deviations.push({
        tripId: sortedTrips[i].tripNumber.toString(),
        plannedHeadway,
        currentHeadway: actualHeadway,
        deviation,
        correctionTrips: this.getMaxCorrectionWindow(sortedTrips.length - i),
        correctionRate: 0.6 // Default correction rate
      });
    }
    
    return deviations;
  }

  /**
   * Generate headway correction report
   */
  generateCorrectionReport(
    result: HeadwayCorrectionResult,
    schedule: Schedule
  ): {
    summary: {
      totalTripsAnalyzed: number;
      tripsModified: number;
      averageAdjustment: number;
      maxAdjustment: number;
      varianceImprovement: number;
    };
    beforeAfterComparison: {
      before: { mean: number; stdDev: number; cv: number };
      after: { mean: number; stdDev: number; cv: number };
    };
    recommendations: string[];
  } {
    const modifiedTrips = result.tripCorrections.filter(tc => tc.correctionApplied);
    const adjustments = modifiedTrips.map(tc => Math.abs(tc.adjustmentMinutes));

    const recommendations: string[] = [];

    if (result.overallImprovement.varianceReduction < 10) {
      recommendations.push('Consider increasing correction strength for better headway regularity');
    }

    if (modifiedTrips.length < result.tripCorrections.length * 0.5) {
      recommendations.push('Many corrections were skipped due to constraints - consider relaxing deviation limits');
    }

    if (result.statisticalMetrics.regularityScore < 0.7) {
      recommendations.push('Headway regularity is still below target - consider additional optimization passes');
    }

    const beforeMetrics = this.calculateHeadwayMetrics(schedule); // Would need original schedule
    
    return {
      summary: {
        totalTripsAnalyzed: result.tripCorrections.length,
        tripsModified: modifiedTrips.length,
        averageAdjustment: adjustments.length > 0 ? adjustments.reduce((sum, adj) => sum + adj, 0) / adjustments.length : 0,
        maxAdjustment: adjustments.length > 0 ? Math.max(...adjustments) : 0,
        varianceImprovement: result.overallImprovement.varianceReduction
      },
      beforeAfterComparison: {
        before: {
          mean: beforeMetrics.meanHeadway,
          stdDev: beforeMetrics.standardDeviation,
          cv: beforeMetrics.coefficientOfVariation
        },
        after: {
          mean: result.statisticalMetrics.meanHeadway,
          stdDev: result.statisticalMetrics.standardDeviation,
          cv: result.statisticalMetrics.coefficientOfVariation
        }
      },
      recommendations
    };
  }
}

// Export singleton instance
export const headwayCorrectionService = new HeadwayCorrectionService();
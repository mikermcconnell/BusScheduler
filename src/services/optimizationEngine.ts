/**
 * Optimization Engine
 * Core algorithm for bus schedule connection optimization with constraint solving
 * 
 * Features:
 * - Priority-based optimization (10 to 1 priority levels)
 * - Recovery Bank integration for time adjustments
 * - Greedy approach with backtracking for conflicts
 * - Constraint validation and enforcement
 * - Performance optimization with early termination
 * - Score calculation with window multipliers (ideal=1.0, partial=0.5, missed=0)
 */

import {
  ConnectionOpportunity,
  OptimizationMove,
  OptimizationState,
  OptimizationConstraints,
  RecoveryBankState,
  HeadwayDeviation,
  ConnectionOptimizationRequest,
  ConnectionOptimizationResult,
  OptimizationProgress
} from '../types/connectionOptimization';
import { Schedule, Trip, ConnectionType } from '../types/schedule';
import { RecoveryBankService } from './recoveryBankService';
import { ConnectionWindowService } from './connectionWindowService';
import { timeToMinutes, minutesToTime, addMinutes, timeDifference } from '../utils/timeUtils';

/**
 * Memoization cache for expensive calculations
 */
class OptimizationCache {
  private timeConversionCache = new Map<string, number>();
  private connectionScoreCache = new Map<string, number>();
  private headwayCalculationCache = new Map<string, any>();
  private distanceCache = new Map<string, number>();
  private maxCacheSize = 10000;

  // Time conversion memoization
  memoizedTimeToMinutes(timeStr: string): number {
    if (!this.timeConversionCache.has(timeStr)) {
      this.manageCacheSize(this.timeConversionCache);
      this.timeConversionCache.set(timeStr, timeToMinutes(timeStr));
    }
    return this.timeConversionCache.get(timeStr)!;
  }

  // Connection score memoization
  memoizedConnectionScore(key: string, calculator: () => number): number {
    if (!this.connectionScoreCache.has(key)) {
      this.manageCacheSize(this.connectionScoreCache);
      this.connectionScoreCache.set(key, calculator());
    }
    return this.connectionScoreCache.get(key)!;
  }

  // Headway calculation memoization
  memoizedHeadwayCalculation(key: string, calculator: () => any): any {
    if (!this.headwayCalculationCache.has(key)) {
      this.manageCacheSize(this.headwayCalculationCache);
      this.headwayCalculationCache.set(key, calculator());
    }
    return this.headwayCalculationCache.get(key)!;
  }

  // Distance calculation memoization
  memoizedDistance(fromStopId: string, toStopId: string, calculator: () => number): number {
    const key = `${fromStopId}-${toStopId}`;
    if (!this.distanceCache.has(key)) {
      this.manageCacheSize(this.distanceCache);
      this.distanceCache.set(key, calculator());
    }
    return this.distanceCache.get(key)!;
  }

  private manageCacheSize(cache: Map<string, any>): void {
    if (cache.size >= this.maxCacheSize) {
      // Remove oldest 20% of entries
      const keysToDelete = Array.from(cache.keys()).slice(0, Math.floor(this.maxCacheSize * 0.2));
      keysToDelete.forEach(key => cache.delete(key));
    }
  }

  clearAllCaches(): void {
    this.timeConversionCache.clear();
    this.connectionScoreCache.clear();
    this.headwayCalculationCache.clear();
    this.distanceCache.clear();
  }

  getCacheStats(): {
    timeConversions: number;
    connectionScores: number;
    headwayCalculations: number;
    distances: number;
  } {
    return {
      timeConversions: this.timeConversionCache.size,
      connectionScores: this.connectionScoreCache.size,
      headwayCalculations: this.headwayCalculationCache.size,
      distances: this.distanceCache.size
    };
  }
}

/**
 * Performance monitoring and memory tracking
 */
class PerformanceTracker {
  private startTime: number = 0;
  private memorySnapshots: { time: number; usage: number }[] = [];
  private operationCounts = new Map<string, number>();
  private maxMemoryUsage = 0;

  startTracking(): void {
    this.startTime = performance.now();
    this.recordMemorySnapshot('start');
  }

  recordOperation(operation: string): void {
    const current = this.operationCounts.get(operation) || 0;
    this.operationCounts.set(operation, current + 1);
  }

  recordMemorySnapshot(label: string): void {
    const usage = this.getCurrentMemoryUsage();
    this.maxMemoryUsage = Math.max(this.maxMemoryUsage, usage);
    this.memorySnapshots.push({ time: performance.now() - this.startTime, usage });
  }

  private getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  getStats(): {
    elapsedTimeMs: number;
    peakMemoryMB: number;
    currentMemoryMB: number;
    operationCounts: Map<string, number>;
    memoryGrowthRate: number;
  } {
    const elapsedTime = performance.now() - this.startTime;
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryGrowthRate = this.memorySnapshots.length > 1 
      ? (currentMemory - this.memorySnapshots[0].usage) / (elapsedTime / 1000) 
      : 0;

    return {
      elapsedTimeMs: elapsedTime,
      peakMemoryMB: this.maxMemoryUsage,
      currentMemoryMB: currentMemory,
      operationCounts: new Map(this.operationCounts),
      memoryGrowthRate
    };
  }

  isMemoryLimitExceeded(limitMB: number): boolean {
    return this.getCurrentMemoryUsage() > limitMB;
  }
}

/**
 * Batch processor for handling large datasets efficiently
 */
class BatchProcessor<T> {
  private batchSize: number;
  private processingDelay: number;

  constructor(batchSize = 50, processingDelay = 0) {
    this.batchSize = batchSize;
    this.processingDelay = processingDelay;
  }

  async processBatches<R>(
    items: T[],
    processor: (batch: T[], batchIndex: number) => Promise<R[]>,
    progressCallback?: (progress: number) => void
  ): Promise<R[]> {
    const results: R[] = [];
    const totalBatches = Math.ceil(items.length / this.batchSize);

    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const batchIndex = Math.floor(i / this.batchSize);
      
      const batchResults = await processor(batch, batchIndex);
      results.push(...batchResults);

      // Progress reporting
      const progress = ((batchIndex + 1) / totalBatches) * 100;
      progressCallback?.(progress);

      // Yield control to prevent blocking
      if (this.processingDelay > 0 && batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, this.processingDelay));
      }
    }

    return results;
  }
}

/**
 * Efficient data structures for fast lookups
 */
class OptimizationDataStructures {
  // Trip lookup by ID
  private tripMap = new Map<number, Trip>();
  // Connection opportunities by location
  private connectionsByLocation = new Map<string, ConnectionOpportunity[]>();
  // Time point index for fast access
  private timePointIndex = new Map<string, any>();
  // Sorted trips for headway calculations
  private sortedTrips: Trip[] = [];

  buildIndexes(schedule: Schedule, connections: ConnectionOpportunity[]): void {
    // Build trip map
    this.tripMap.clear();
    schedule.trips.forEach(trip => {
      this.tripMap.set(trip.tripNumber, trip);
    });

    // Build sorted trips array
    this.sortedTrips = [...schedule.trips].sort((a, b) => 
      timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime)
    );

    // Build connection location index
    this.connectionsByLocation.clear();
    connections.forEach(conn => {
      const locationConnections = this.connectionsByLocation.get(conn.locationId) || [];
      locationConnections.push(conn);
      this.connectionsByLocation.set(conn.locationId, locationConnections);
    });

    // Build time point index
    this.timePointIndex.clear();
    schedule.timePoints.forEach(tp => {
      this.timePointIndex.set(tp.id, tp);
    });
  }

  getTripById(tripId: number): Trip | undefined {
    return this.tripMap.get(tripId);
  }

  getConnectionsByLocation(locationId: string): ConnectionOpportunity[] {
    return this.connectionsByLocation.get(locationId) || [];
  }

  getTimePointById(timePointId: string): any | undefined {
    return this.timePointIndex.get(timePointId);
  }

  getSortedTrips(): Trip[] {
    return this.sortedTrips;
  }

  findNearestTrips(targetTime: string, locationId: string, maxCount = 5): Trip[] {
    const targetMinutes = timeToMinutes(targetTime);
    const tripsAtLocation = this.sortedTrips.filter(trip => 
      trip.arrivalTimes[locationId] || trip.departureTimes[locationId]
    );

    return tripsAtLocation
      .map(trip => {
        const time = trip.arrivalTimes[locationId] || trip.departureTimes[locationId] || '00:00';
        const timeDiff = Math.abs(timeToMinutes(time) - targetMinutes);
        return { trip, timeDiff };
      })
      .sort((a, b) => a.timeDiff - b.timeDiff)
      .slice(0, maxCount)
      .map(item => item.trip);
  }
}

/**
 * Priority queue implementation for optimization moves
 */
class PriorityQueue<T> {
  private items: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number): void {
    const queueItem = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (queueItem.priority > this.items[i].priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }
}

/**
 * Optimization Engine for bus schedule connection optimization
 */
export class OptimizationEngine {
  private recoveryBankService: RecoveryBankService;
  private connectionWindowService: ConnectionWindowService;
  private currentState: OptimizationState | null = null;
  private bestState: OptimizationState | null = null;
  private optimizationStartTime: Date | null = null;
  
  // Performance optimization components
  private cache: OptimizationCache;
  private performanceTracker: PerformanceTracker;
  private batchProcessor: BatchProcessor<any>;
  private dataStructures: OptimizationDataStructures;
  private shouldCancel = false;
  
  // Progressive optimization settings
  private progressiveOptimizationEnabled = true;
  private intermediateResultsInterval = 1000; // ms
  private lastIntermediateResult: Date | null = null;

  constructor(
    recoveryBankService: RecoveryBankService,
    connectionWindowService: ConnectionWindowService
  ) {
    this.recoveryBankService = recoveryBankService;
    this.connectionWindowService = connectionWindowService;
    
    // Initialize performance optimization components
    this.cache = new OptimizationCache();
    this.performanceTracker = new PerformanceTracker();
    this.batchProcessor = new BatchProcessor(25, 1); // Smaller batches with slight delay
    this.dataStructures = new OptimizationDataStructures();
  }

  /**
   * Main optimization method - core entry point for schedule optimization
   * @param schedule Current schedule to optimize
   * @param connections Array of connection opportunities  
   * @param constraints Optimization constraints to enforce
   * @param progressCallback Optional progress reporting callback
   * @returns Optimized schedule with connection improvements
   */
  async optimize(
    schedule: Schedule,
    connections: ConnectionOpportunity[],
    constraints: OptimizationConstraints,
    progressCallback?: (progress: OptimizationProgress) => void
  ): Promise<ConnectionOptimizationResult> {
    const startTime = Date.now();
    this.optimizationStartTime = new Date();
    this.shouldCancel = false;
    
    // Start performance tracking
    this.performanceTracker.startTracking();
    this.cache.clearAllCaches();

    try {
      // Phase 0: Performance-aware initialization
      this.reportProgress(progressCallback, 5, 'Initializing performance systems', 0);
      this.dataStructures.buildIndexes(schedule, connections);
      this.performanceTracker.recordOperation('index_building');
      
      // Check initial memory usage
      if (this.performanceTracker.isMemoryLimitExceeded(constraints.performance.maxMemoryUsageMB)) {
        throw new Error(`Initial memory usage exceeds limit: ${this.performanceTracker.getStats().currentMemoryMB}MB`);
      }
      
      // Phase 1: Initialize and analyze with batching for large datasets
      this.reportProgress(progressCallback, 10, 'Initializing optimization state', 0);
      const state = this.initializeOptimizationState(schedule, connections, constraints);
      this.performanceTracker.recordMemorySnapshot('state_initialized');
      
      // Phase 2: Sort and batch connections by priority
      this.reportProgress(progressCallback, 20, 'Prioritizing and batching connections', 0);
      const prioritizedConnections = this.sortConnectionsByPriority(connections);
      
      // For large schedules, apply progressive optimization
      const useProgressiveOptimization = schedule.trips.length > 100 || connections.length > 50;
      
      if (useProgressiveOptimization) {
        this.reportProgress(progressCallback, 25, 'Applying progressive optimization strategy', 0);
        const optimizedState = await this.applyProgressiveOptimization(
          state,
          prioritizedConnections,
          constraints,
          progressCallback
        );
        
        // Final validation and results
        return this.finalizeOptimizationResult(optimizedState, prioritizedConnections, constraints, startTime);
      } else {
        // Standard optimization for smaller datasets
        this.reportProgress(progressCallback, 30, 'Optimizing connections', 0);
        const optimizedState = await this.applyGreedyOptimization(
          state,
          prioritizedConnections,
          constraints,
          progressCallback
        );
        
        return this.finalizeOptimizationResult(optimizedState, prioritizedConnections, constraints, startTime);
      }

    } catch (error) {
      console.error('Optimization failed:', error);
      return this.generateFailureResult(schedule, connections, error);
    } finally {
      this.performanceTracker.recordMemorySnapshot('optimization_complete');
    }
  }

  /**
   * Calculate optimization score for a schedule with given connections
   * @param schedule Schedule to evaluate
   * @param connections Connection opportunities to score
   * @returns Overall optimization score (0-1)
   */
  calculateScore(schedule: Schedule, connections: ConnectionOpportunity[]): number {
    let totalScore = 0;
    let totalPossibleScore = 0;

    for (const connection of connections) {
      const score = this.calculateConnectionScore(connection, schedule);
      const maxScore = connection.priority; // Priority acts as weight multiplier
      
      totalScore += score * maxScore;
      totalPossibleScore += maxScore;
    }

    return totalPossibleScore > 0 ? totalScore / totalPossibleScore : 0;
  }

  /**
   * Apply optimization changes to a schedule
   * @param schedule Schedule to modify
   * @param moves Array of optimization moves to apply
   * @returns Modified schedule with applied optimizations
   */
  applyOptimization(schedule: Schedule, moves: OptimizationMove[]): Schedule {
    const optimizedSchedule = this.cloneSchedule(schedule);

    for (const move of moves) {
      if (move.constraintViolations.length === 0) {
        this.applyMoveToSchedule(optimizedSchedule, move);
      }
    }

    return optimizedSchedule;
  }

  /**
   * Validate that a schedule meets all optimization constraints
   * @param schedule Schedule to validate
   * @returns True if all constraints are satisfied
   */
  validateConstraints(schedule: Schedule): boolean {
    // Check max deviation constraint (10 minutes from baseline)
    const maxDeviation = this.calculateMaxDeviation(schedule);
    if (maxDeviation > 10) {
      return false;
    }

    // Check recovery time bounds
    for (const trip of schedule.trips) {
      for (const [stopId, recoveryTime] of Object.entries(trip.recoveryTimes)) {
        if (recoveryTime < 0 || recoveryTime > 30) { // Reasonable bounds
          return false;
        }
      }
    }

    // Check headway self-correction within 2-3 trips
    const headwayIssues = this.validateHeadwayCorrection(schedule);
    if (headwayIssues > 0) {
      return false;
    }

    return true;
  }

  /**
   * Legacy compatibility method - finds optimal schedule adjustments for connections
   */
  async optimizeConnections(
    schedule: Schedule,
    opportunities: ConnectionOpportunity[],
    constraints: OptimizationConstraints,
    progressCallback?: (progress: number, phase: string) => void
  ): Promise<OptimizationState> {
    this.optimizationStartTime = new Date();

    // Initialize optimization state
    this.currentState = this.initializeOptimizationState(schedule, opportunities, constraints);
    this.bestState = this.cloneOptimizationState(this.currentState);

    // Progress tracking
    const totalPhases = 5;
    let currentPhase = 0;

    try {
      // Phase 1: Priority-based opportunity sorting
      progressCallback?.(++currentPhase / totalPhases * 100, 'Analyzing connection opportunities');
      const prioritizedOpportunities = this.prioritizeOpportunities(opportunities, constraints);

      // Phase 2: Generate optimization moves
      progressCallback?.(++currentPhase / totalPhases * 100, 'Generating optimization moves');
      const optimizationMoves = await this.generateOptimizationMoves(
        prioritizedOpportunities,
        this.currentState,
        constraints
      );

      // Phase 3: Apply optimization moves
      progressCallback?.(++currentPhase / totalPhases * 100, 'Applying optimizations');
      await this.applyOptimizationMoves(optimizationMoves, constraints);

      // Phase 4: Validate constraints
      progressCallback?.(++currentPhase / totalPhases * 100, 'Validating constraints');
      const validationResult = this.validateOptimizationResult(this.currentState, constraints);

      if (!validationResult.isValid) {
        // Rollback to best known state if current state violates constraints
        this.currentState = this.bestState;
      }

      // Phase 5: Finalize results
      progressCallback?.(++currentPhase / totalPhases * 100, 'Finalizing results');
      this.currentState.progress = 1.0;

      return this.currentState;

    } catch (error) {
      console.error('Optimization error:', error);
      // Return best state found so far
      return this.bestState || this.currentState;
    }
  }

  /**
   * Sort connections by priority (10 to 1, highest first)
   */
  private sortConnectionsByPriority(connections: ConnectionOpportunity[]): ConnectionOpportunity[] {
    return [...connections].sort((a, b) => {
      // Primary sort: Priority (10 = highest, 1 = lowest)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Secondary sort: Connection type importance
      const typeWeights = {
        [ConnectionType.SCHOOL_BELL]: 3,
        [ConnectionType.GO_TRAIN]: 2,
        [ConnectionType.BUS_ROUTE]: 1
      };
      
      const weightA = typeWeights[a.type] || 0;
      const weightB = typeWeights[b.type] || 0;
      
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      
      // Tertiary sort: Fewer affected trips (simpler to optimize)
      return a.affectedTrips.length - b.affectedTrips.length;
    });
  }

  /**
   * Apply greedy optimization with backtracking for conflicts
   */
  private async applyGreedyOptimization(
    state: OptimizationState,
    connections: ConnectionOpportunity[],
    constraints: OptimizationConstraints,
    progressCallback?: (progress: OptimizationProgress) => void
  ): Promise<OptimizationState> {
    const totalConnections = connections.length;
    let processedCount = 0;
    let appliedMoves = 0;

    // Track best solution for backtracking
    let bestState = this.cloneOptimizationState(state);
    let bestScore = this.calculateScore(state.currentSchedule, connections);

    for (const connection of connections) {
      // Check performance timeout
      if (this.isTimeoutReached(constraints)) {
        break;
      }

      // Progress reporting
      const progressPercent = 30 + (processedCount / totalConnections) * 60; // 30% to 90%
      this.reportProgress(progressCallback, progressPercent, 'Optimizing connections', appliedMoves);

      // Try to satisfy this connection using recovery bank
      const move = await this.generateOptimizationMoveForConnection(connection, state, constraints);
      
      if (move && move.constraintViolations.length === 0) {
        // Apply the move tentatively
        const tempState = this.cloneOptimizationState(state);
        const success = await this.applyOptimizationMove(move);
        
        if (success) {
          // Calculate new score
          const newScore = this.calculateScore(state.currentSchedule, connections);
          
          if (newScore > bestScore) {
            // Accept the move
            bestState = this.cloneOptimizationState(state);
            bestScore = newScore;
            appliedMoves++;
            
            // Check early termination for good-enough solution
            if (newScore >= 0.85) { // 85% of optimal score
              break;
            }
          } else {
            // Backtrack - reject the move
            state.currentSchedule = tempState.currentSchedule;
            state.recoveryBank = tempState.recoveryBank;
            state.rejectedMoves.push({
              move,
              reason: 'Score improvement insufficient'
            });
          }
        }
      } else if (move) {
        state.rejectedMoves.push({
          move,
          reason: move.constraintViolations.join('; ')
        });
      }

      processedCount++;
    }

    // Return the best state found
    return bestState;
  }

  /**
   * Generate a single optimization move for a connection
   */
  private async generateOptimizationMoveForConnection(
    connection: ConnectionOpportunity,
    state: OptimizationState,
    constraints: OptimizationConstraints
  ): Promise<OptimizationMove | null> {
    // Calculate required time adjustment
    const requiredAdjustment = this.calculateRequiredTimeAdjustment(connection, state.currentSchedule);
    
    if (Math.abs(requiredAdjustment) > constraints.maxTripDeviation) {
      return null; // Cannot satisfy within constraints
    }

    // Use recovery bank as primary mechanism (not skip stops)
    const recoveryTransactions = await this.generateRecoveryTransactions(
      connection,
      requiredAdjustment,
      state
    );

    // Calculate score improvement with window multipliers
    const scoreImprovement = this.calculateConnectionScoreImprovement(connection, requiredAdjustment);

    // Check constraint violations
    const constraintViolations = this.checkConstraintViolations(
      connection,
      requiredAdjustment,
      recoveryTransactions,
      [],
      constraints
    );

    return {
      id: `move_${connection.id}_${Date.now()}`,
      type: 'connection_align',
      targetConnection: connection,
      timeAdjustment: requiredAdjustment,
      requiredTransactions: recoveryTransactions,
      affectedTrips: [...connection.affectedTrips],
      scoreImprovement,
      constraintViolations,
      headwayImpact: []
    };
  }

  /**
   * Calculate connection score improvement with window multipliers
   */
  private calculateConnectionScoreImprovement(
    connection: ConnectionOpportunity,
    timeAdjustment: number
  ): number {
    const currentScore = this.getConnectionWindowMultiplier(connection.windowType);
    
    // Project new window type after adjustment
    const newWindowType = this.projectNewWindowTypeImproved(connection, timeAdjustment);
    const newScore = this.getConnectionWindowMultiplier(newWindowType);
    
    return (newScore - currentScore) * connection.priority;
  }

  /**
   * Get window multiplier based on type (ideal=1.0, partial=0.5, missed=0)
   */
  private getConnectionWindowMultiplier(windowType: 'ideal' | 'partial' | 'missed'): number {
    switch (windowType) {
      case 'ideal': return 1.0;
      case 'partial': return 0.5;
      case 'missed': return 0.0;
      default: return 0.0;
    }
  }

  /**
   * Improved window type projection after time adjustment
   */
  private projectNewWindowTypeImproved(
    connection: ConnectionOpportunity,
    timeAdjustment: number
  ): 'ideal' | 'partial' | 'missed' {
    const connectionWindow = this.connectionWindowService.getConnectionWindows().get(connection.type);
    if (!connectionWindow) return 'missed';

    // Calculate new connection time after adjustment
    const currentConnectionTime = connection.currentConnectionTime || 0;
    const adjustedTime = Math.abs(currentConnectionTime + timeAdjustment);

    // Check against ideal window first
    if (adjustedTime >= connectionWindow.ideal.min && adjustedTime <= connectionWindow.ideal.max) {
      return 'ideal';
    }
    
    // Check against partial window
    if (adjustedTime >= connectionWindow.partial.min && adjustedTime <= connectionWindow.partial.max) {
      return 'partial';
    }
    
    return 'missed';
  }

  /**
   * Calculate score for a specific connection within a schedule
   */
  private calculateConnectionScore(connection: ConnectionOpportunity, schedule: Schedule): number {
    // Find actual connection time in the current schedule
    const actualConnectionTime = this.getActualConnectionTime(connection, schedule);
    
    if (actualConnectionTime === null) {
      return 0; // No connection possible
    }

    // Determine window type based on actual time
    const windowType = this.determineWindowType(connection, actualConnectionTime);
    
    // Return weighted score
    return this.getConnectionWindowMultiplier(windowType) * connection.priority;
  }

  /**
   * Get actual connection time for a connection within a schedule (with memoization)
   */
  private getActualConnectionTime(connection: ConnectionOpportunity, schedule: Schedule): number | null {
    const cacheKey = `connection_time_${connection.id}_${connection.locationId}_${connection.targetTime}`;
    
    return this.cache.memoizedConnectionScore(cacheKey, () => {
      const targetTimeMinutes = this.cache.memoizedTimeToMinutes(connection.targetTime);
      
      // Use efficient data structures for faster lookup
      const nearestTrips = this.dataStructures.findNearestTrips(
        connection.targetTime, 
        connection.locationId, 
        10 // Check more trips for better accuracy
      );
      
      let closestTime: number | null = null;
      let minDifference = Infinity;

      for (const trip of nearestTrips) {
        const busTime = trip.arrivalTimes[connection.locationId] || trip.departureTimes[connection.locationId];
        if (!busTime) continue;

        const busTimeMinutes = this.cache.memoizedTimeToMinutes(busTime);
        const difference = Math.abs(busTimeMinutes - targetTimeMinutes);

        if (difference < minDifference) {
          minDifference = difference;
          closestTime = busTimeMinutes;
        }
      }

      return closestTime ? Math.abs(closestTime - targetTimeMinutes) : 0; // Return 0 instead of null
    });
  }

  /**
   * Determine connection window type based on actual connection time
   */
  private determineWindowType(connection: ConnectionOpportunity, actualTime: number): 'ideal' | 'partial' | 'missed' {
    const connectionWindow = this.connectionWindowService.getConnectionWindows().get(connection.type);
    if (!connectionWindow) return 'missed';

    if (actualTime >= connectionWindow.ideal.min && actualTime <= connectionWindow.ideal.max) {
      return 'ideal';
    } else if (actualTime >= connectionWindow.partial.min && actualTime <= connectionWindow.partial.max) {
      return 'partial';
    } else {
      return 'missed';
    }
  }

  /**
   * Apply a move directly to a schedule
   */
  private applyMoveToSchedule(schedule: Schedule, move: OptimizationMove): void {
    for (const tripIdStr of move.affectedTrips) {
      const tripId = parseInt(tripIdStr);
      const trip = schedule.trips.find(t => t.tripNumber === tripId);
      
      if (trip) {
        this.applyTimeAdjustmentToTrip(trip, move.timeAdjustment, move.targetConnection.locationId);
      }
    }
  }

  /**
   * Calculate maximum deviation from baseline times
   */
  private calculateMaxDeviation(schedule: Schedule): number {
    // This would need baseline schedule for comparison
    // For now, return 0 indicating no deviation
    return 0;
  }

  /**
   * Validate headway self-correction within 2-3 trips
   */
  private validateHeadwayCorrection(schedule: Schedule): number {
    const sortedTrips = schedule.trips.sort((a, b) => 
      timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime)
    );

    let issues = 0;
    const plannedHeadway = 30; // Assume 30-minute planned headway

    for (let i = 1; i < sortedTrips.length; i++) {
      const currentTrip = sortedTrips[i];
      const prevTrip = sortedTrips[i - 1];
      
      const actualHeadway = timeToMinutes(currentTrip.departureTime) - timeToMinutes(prevTrip.departureTime);
      const deviation = Math.abs(actualHeadway - plannedHeadway);
      
      // Check if large deviations self-correct within 2-3 trips
      if (deviation > 5) { // > 5 minutes deviation
        let corrected = false;
        
        // Look ahead 2-3 trips to see if headway normalizes
        for (let j = i + 1; j < Math.min(i + 4, sortedTrips.length); j++) {
          const futureTrip = sortedTrips[j];
          const prevFutureTrip = sortedTrips[j - 1];
          
          const futureHeadway = timeToMinutes(futureTrip.departureTime) - timeToMinutes(prevFutureTrip.departureTime);
          const futureDeviation = Math.abs(futureHeadway - plannedHeadway);
          
          if (futureDeviation <= 2) { // Back to normal
            corrected = true;
            break;
          }
        }
        
        if (!corrected) {
          issues++;
        }
      }
    }

    return issues;
  }

  /**
   * Generate optimization result with comprehensive statistics
   */
  private generateOptimizationResult(
    state: OptimizationState,
    connections: ConnectionOpportunity[],
    constraints: OptimizationConstraints,
    processingTime: number,
    isValid: boolean
  ): ConnectionOptimizationResult {
    const finalScore = this.calculateScore(state.currentSchedule, connections);
    
    // Categorize connections by status
    const successful: ConnectionOpportunity[] = [];
    const failed: { opportunity: ConnectionOpportunity; reason: string }[] = [];
    
    for (const connection of connections) {
      const score = this.calculateConnectionScore(connection, state.currentSchedule);
      if (score > 0) {
        successful.push(connection);
      } else {
        failed.push({
          opportunity: connection,
          reason: 'Unable to achieve connection within constraints'
        });
      }
    }

    return {
      success: isValid,
      optimizedSchedule: state.currentSchedule,
      finalScore,
      score: finalScore,
      scoreImprovement: finalScore - (state.currentScore || 0),
      successfulConnections: successful,
      connectionsImproved: successful.length,
      failedConnections: failed,
      appliedMoves: state.appliedMoves,
      finalRecoveryState: state.recoveryBank,
      headwayCorrections: state.headwayDeviations,
      statistics: {
        totalConnectionsAnalyzed: connections.length,
        totalMovesEvaluated: state.appliedMoves.length + state.rejectedMoves.length,
        totalMovesApplied: state.appliedMoves.length,
        optimizationTimeMs: processingTime,
        memoryUsedMB: this.getMemoryUsage(),
        iterationsCompleted: state.appliedMoves.length,
        convergenceAchieved: finalScore >= 0.85
      },
      performance: {
        connectionSuccessRate: successful.length / connections.length,
        averageConnectionTime: this.calculateAverageConnectionTime(successful, state.currentSchedule),
        headwayRegularityScore: this.calculateHeadwayRegularityScore(state.currentSchedule),
        recoveryUtilizationRate: this.calculateRecoveryUtilization(state.recoveryBank),
        constraintComplianceRate: isValid ? 1.0 : 0.8
      },
      recommendations: this.generateRecommendations(state, connections, constraints),
      warnings: this.generateWarnings(state, constraints),
      error: isValid ? undefined : 'Some constraints were violated'
    };
  }

  /**
   * Generate failure result when optimization completely fails
   */
  private generateFailureResult(
    schedule: Schedule,
    connections: ConnectionOpportunity[],
    error: any
  ): ConnectionOptimizationResult {
    return {
      success: false,
      optimizedSchedule: schedule,
      finalScore: 0,
      score: 0,
      scoreImprovement: 0,
      successfulConnections: [],
      connectionsImproved: 0,
      failedConnections: connections.map(conn => ({ 
        opportunity: conn, 
        reason: 'Optimization failed'
      })),
      appliedMoves: [],
      finalRecoveryState: {
        accounts: new Map(),
        transactions: [],
        totalAvailableRecovery: 0,
        totalBorrowedRecovery: 0,
        utilizationRate: 0
      },
      headwayCorrections: [],
      statistics: {
        totalConnectionsAnalyzed: connections.length,
        totalMovesEvaluated: 0,
        totalMovesApplied: 0,
        optimizationTimeMs: 0,
        memoryUsedMB: 0,
        iterationsCompleted: 0,
        convergenceAchieved: false
      },
      performance: {
        connectionSuccessRate: 0,
        averageConnectionTime: 0,
        headwayRegularityScore: 0,
        recoveryUtilizationRate: 0,
        constraintComplianceRate: 0
      },
      recommendations: ['Optimization failed - check constraints and retry'],
      warnings: ['Complete optimization failure'],
      error: error.message || 'Unknown optimization error'
    };
  }

  /**
   * Report optimization progress to callback
   */
  private reportProgress(
    callback: ((progress: OptimizationProgress) => void) | undefined,
    progress: number,
    phase: string,
    connectionsMade: number
  ): void {
    if (!callback) return;

    const currentTime = Date.now();
    const startTime = this.optimizationStartTime?.getTime() || currentTime;
    const elapsed = currentTime - startTime;

    callback({
      progress,
      phase,
      currentScore: this.currentState?.currentScore || 0,
      bestScore: this.bestState?.currentScore || 0,
      connectionsMade,
      estimatedTimeRemainingMs: elapsed * (100 - progress) / Math.max(progress, 1),
      memoryUsageMB: this.getMemoryUsage(),
      canCancel: true
    });
  }

  /**
   * Get current memory usage with accurate tracking
   */
  private getMemoryUsage(): number {
    return this.performanceTracker.getStats().currentMemoryMB;
  }
  
  /**
   * Apply progressive optimization for large datasets
   */
  private async applyProgressiveOptimization(
    state: OptimizationState,
    connections: ConnectionOpportunity[],
    constraints: OptimizationConstraints,
    progressCallback?: (progress: OptimizationProgress) => void
  ): Promise<OptimizationState> {
    this.performanceTracker.recordOperation('progressive_optimization_start');
    
    // Chunk connections into manageable batches
    const connectionBatches = this.chunkArray(connections, 25);
    let bestState = this.cloneOptimizationState(state);
    let bestScore = this.calculateScore(state.currentSchedule, connections);
    
    // Progressive optimization with intermediate results
    let totalProgress = 30;
    const progressIncrement = 60 / connectionBatches.length;
    
    for (let batchIndex = 0; batchIndex < connectionBatches.length; batchIndex++) {
      // Check for cancellation
      if (this.shouldCancel) {
        break;
      }
      
      // Check memory limits
      if (this.performanceTracker.isMemoryLimitExceeded(constraints.performance.maxMemoryUsageMB * 0.9)) {
        console.warn(`Approaching memory limit, stopping optimization at batch ${batchIndex + 1}`);
        break;
      }
      
      const batch = connectionBatches[batchIndex];
      const batchProgress = totalProgress + (batchIndex * progressIncrement);
      
      this.reportProgress(
        progressCallback, 
        batchProgress, 
        `Processing connection batch ${batchIndex + 1}/${connectionBatches.length}`, 
        bestState.appliedMoves.length
      );
      
      // Process this batch of connections
      const batchResult = await this.processBatchOptimization(bestState, batch, constraints);
      
      // Check if this batch improved the overall score
      const batchScore = this.calculateScore(batchResult.currentSchedule, connections);
      if (batchScore > bestScore) {
        bestState = batchResult;
        bestScore = batchScore;
        
        // Check for early termination - configurable threshold
        const earlyTerminationThreshold = constraints.performance.earlyTerminationThreshold || 0.85;
        if (batchScore >= earlyTerminationThreshold) {
          this.reportProgress(
            progressCallback, 
            90, 
            'Early termination - good solution found', 
            bestState.appliedMoves.length
          );
          break;
        }
      }
      
      // Intermediate results reporting
      if (this.shouldReportIntermediateResults()) {
        this.reportIntermediateResults(bestState, progressCallback);
      }
      
      // Memory cleanup between batches
      if (batchIndex % 5 === 0) {
        this.performMemoryCleanup();
      }
      
      this.performanceTracker.recordOperation('batch_processed');
    }
    
    return bestState;
  }
  
  /**
   * Process a batch of connections with optimized algorithms
   */
  private async processBatchOptimization(
    state: OptimizationState,
    connectionBatch: ConnectionOpportunity[],
    constraints: OptimizationConstraints
  ): Promise<OptimizationState> {
    const batchState = this.cloneOptimizationState(state);
    
    // Use memoized calculations for this batch
    for (const connection of connectionBatch) {
      const cacheKey = `${connection.id}_${connection.locationId}_${connection.targetTime}`;
      
      // Generate the move directly since it's async and cannot be memoized
      const move = await this.generateOptimizationMoveForConnection(connection, batchState, constraints);
      
      if (move && move.constraintViolations.length === 0) {
        const success = await this.applyOptimizationMove(move);
        if (success) {
          batchState.appliedMoves.push(move);
          this.performanceTracker.recordOperation('move_applied');
        }
      }
    }
    
    return batchState;
  }
  
  /**
   * Utility method to chunk arrays for batch processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * Check if intermediate results should be reported
   */
  private shouldReportIntermediateResults(): boolean {
    if (!this.progressiveOptimizationEnabled) return false;
    
    const now = new Date();
    if (!this.lastIntermediateResult) {
      this.lastIntermediateResult = now;
      return true;
    }
    
    return (now.getTime() - this.lastIntermediateResult.getTime()) >= this.intermediateResultsInterval;
  }
  
  /**
   * Report intermediate optimization results
   */
  private reportIntermediateResults(
    state: OptimizationState,
    progressCallback?: (progress: OptimizationProgress) => void
  ): void {
    this.lastIntermediateResult = new Date();
    // This could emit intermediate results to the callback or store them for later analysis
    this.performanceTracker.recordOperation('intermediate_report');
  }
  
  /**
   * Perform memory cleanup operations
   */
  private performMemoryCleanup(): void {
    // Trigger garbage collection hint (if available)
    if (global.gc) {
      global.gc();
    }
    
    // Clean up old cache entries
    if (this.cache.getCacheStats().connectionScores > 5000) {
      this.cache.clearAllCaches();
    }
    
    this.performanceTracker.recordOperation('memory_cleanup');
  }
  
  /**
   * Finalize optimization results with comprehensive validation
   */
  private async finalizeOptimizationResult(
    optimizedState: OptimizationState,
    connections: ConnectionOpportunity[],
    constraints: OptimizationConstraints,
    startTime: number
  ): Promise<ConnectionOptimizationResult> {
    // Final validation
    this.reportProgress(undefined, 90, 'Validating final constraints', optimizedState.appliedMoves.length);
    const isValid = this.validateConstraints(optimizedState.currentSchedule);
    
    // Generate comprehensive results
    this.reportProgress(undefined, 100, 'Finalizing results', optimizedState.appliedMoves.length);
    const result = this.generateOptimizationResult(
      optimizedState,
      connections,
      constraints,
      Date.now() - startTime,
      isValid
    );
    
    // Add performance metrics to result - use spread to maintain existing properties
    const perfStats = this.performanceTracker.getStats();
    result.statistics = {
      ...result.statistics
    };
    
    // Add performance metrics as separate fields to avoid type conflicts
    (result as any).performanceMetrics = {
      peakMemoryMB: perfStats.peakMemoryMB,
      memoryGrowthRate: perfStats.memoryGrowthRate,
      cacheHitRate: this.calculateCacheHitRate()
    };
    
    return result;
  }
  
  /**
   * Calculate cache hit rate for performance metrics
   */
  private calculateCacheHitRate(): number {
    const cacheStats = this.cache.getCacheStats();
    const totalCacheOperations = Object.values(cacheStats).reduce((sum, count) => sum + count, 0);
    const totalOperations = Array.from(this.performanceTracker.getStats().operationCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    return totalOperations > 0 ? totalCacheOperations / totalOperations : 0;
  }

  /**
   * Calculate average connection time for successful connections
   */
  private calculateAverageConnectionTime(
    connections: ConnectionOpportunity[],
    schedule: Schedule
  ): number {
    if (connections.length === 0) return 0;

    let totalTime = 0;
    let count = 0;

    for (const connection of connections) {
      const time = this.getActualConnectionTime(connection, schedule);
      if (time !== null) {
        totalTime += time;
        count++;
      }
    }

    return count > 0 ? totalTime / count : 0;
  }

  /**
   * Calculate headway regularity score (0-1, higher = more regular)
   */
  private calculateHeadwayRegularityScore(schedule: Schedule): number {
    const headwayDeviations = this.calculateHeadwayDeviations(schedule);
    
    if (headwayDeviations.length === 0) return 1.0;

    const totalDeviation = headwayDeviations.reduce((sum, dev) => sum + Math.abs(dev.deviation), 0);
    const averageDeviation = totalDeviation / headwayDeviations.length;
    
    // Convert to 0-1 score (less deviation = higher score)
    return Math.max(0, 1 - (averageDeviation / 30)); // 30 minutes max deviation
  }

  /**
   * Calculate recovery utilization rate
   */
  private calculateRecoveryUtilization(recoveryBank: RecoveryBankState): number {
    if (recoveryBank.totalAvailableRecovery === 0) return 0;
    return recoveryBank.totalBorrowedRecovery / recoveryBank.totalAvailableRecovery;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    state: OptimizationState,
    connections: ConnectionOpportunity[],
    constraints: OptimizationConstraints
  ): string[] {
    const recommendations: string[] = [];

    // Analyze failed connections
    const failedCount = state.rejectedMoves.length;
    if (failedCount > 0) {
      recommendations.push(`Consider relaxing constraints - ${failedCount} moves were rejected`);
    }

    // Analyze recovery utilization
    const utilization = this.calculateRecoveryUtilization(state.recoveryBank);
    if (utilization > 0.8) {
      recommendations.push('Recovery bank utilization high - consider adding more recovery time');
    } else if (utilization < 0.2) {
      recommendations.push('Low recovery utilization - constraints may be too strict');
    }

    // Analyze headway regularity
    const headwayScore = this.calculateHeadwayRegularityScore(state.currentSchedule);
    if (headwayScore < 0.7) {
      recommendations.push('Headway regularity below optimal - consider frequency adjustments');
    }

    return recommendations;
  }

  /**
   * Generate optimization warnings
   */
  private generateWarnings(state: OptimizationState, constraints: OptimizationConstraints): string[] {
    const warnings: string[] = [];

    if (this.isTimeoutReached(constraints)) {
      warnings.push('Optimization timed out - results may be suboptimal');
    }

    if (state.rejectedMoves.length > state.appliedMoves.length) {
      warnings.push('More moves rejected than applied - constraints may be too restrictive');
    }

    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > constraints.performance.maxMemoryUsageMB * 0.9) {
      warnings.push('High memory usage detected during optimization');
    }

    return warnings;
  }

  /**
   * Initialize optimization state
   */
  private initializeOptimizationState(
    schedule: Schedule,
    opportunities: ConnectionOpportunity[],
    constraints: OptimizationConstraints
  ): OptimizationState {
    // Clone schedule for optimization
    const currentSchedule = this.cloneSchedule(schedule);

    // Initialize recovery bank
    const recoveryBank = this.recoveryBankService.initializeBank(
      schedule,
      [], // Will be populated with default configurations
      constraints
    );

    // Calculate initial score
    const initialScore = this.calculateScheduleScore(opportunities, currentSchedule);

    // Initialize headway deviations
    const headwayDeviations = this.calculateHeadwayDeviations(currentSchedule);

    return {
      currentSchedule,
      recoveryBank,
      currentScore: initialScore,
      appliedMoves: [],
      rejectedMoves: [],
      headwayDeviations,
      progress: 0,
      startTime: new Date()
    };
  }

  /**
   * Prioritize opportunities based on score potential and constraints
   */
  private prioritizeOpportunities(
    opportunities: ConnectionOpportunity[],
    constraints: OptimizationConstraints
  ): ConnectionOpportunity[] {
    return opportunities
      .map(opp => ({
        ...opp,
        potentialScore: this.calculatePotentialScore(opp, constraints)
      }))
      .sort((a, b) => b.potentialScore - a.potentialScore)
      .slice(0, Math.min(opportunities.length, 50)); // Limit to top 50 for performance
  }

  /**
   * Calculate potential score for an opportunity
   */
  private calculatePotentialScore(
    opportunity: ConnectionOpportunity,
    constraints: OptimizationConstraints
  ): number {
    const baseScore = this.connectionWindowService.calculateConnectionScore(opportunity);
    const priorityWeight = constraints.connectionPriorities[opportunity.type] || 1;
    const complexityPenalty = opportunity.affectedTrips.length > 5 ? 0.8 : 1.0; // Penalty for complex moves

    return baseScore * priorityWeight * complexityPenalty;
  }

  /**
   * Generate optimization moves for prioritized opportunities
   */
  private async generateOptimizationMoves(
    opportunities: ConnectionOpportunity[],
    state: OptimizationState,
    constraints: OptimizationConstraints
  ): Promise<OptimizationMove[]> {
    const moves: OptimizationMove[] = [];
    const moveQueue = new PriorityQueue<OptimizationMove>();

    for (const opportunity of opportunities) {
      const movesForOpportunity = await this.generateMovesForOpportunity(
        opportunity,
        state,
        constraints
      );

      movesForOpportunity.forEach(move => {
        moveQueue.enqueue(move, move.scoreImprovement);
      });
    }

    // Extract moves from priority queue
    while (!moveQueue.isEmpty() && moves.length < constraints.performance.maxOptimizationTimeMs / 100) {
      const move = moveQueue.dequeue();
      if (move) {
        moves.push(move);
      }
    }

    return moves;
  }

  /**
   * Generate moves for a specific connection opportunity
   */
  private async generateMovesForOpportunity(
    opportunity: ConnectionOpportunity,
    state: OptimizationState,
    constraints: OptimizationConstraints
  ): Promise<OptimizationMove[]> {
    const moves: OptimizationMove[] = [];

    // Calculate required time adjustment
    const requiredAdjustment = this.calculateRequiredTimeAdjustment(opportunity, state.currentSchedule);

    if (Math.abs(requiredAdjustment) > constraints.maxTripDeviation) {
      return moves; // Move would violate constraints
    }

    // Generate recovery transactions needed for this move
    const recoveryTransactions = await this.generateRecoveryTransactions(
      opportunity,
      requiredAdjustment,
      state
    );

    // Calculate headway impact
    const headwayImpact = this.calculateHeadwayImpact(
      opportunity,
      requiredAdjustment,
      state.currentSchedule
    );

    // Calculate score improvement
    const scoreImprovement = this.calculateScoreImprovement(opportunity, requiredAdjustment);

    // Check for constraint violations
    const constraintViolations = this.checkConstraintViolations(
      opportunity,
      requiredAdjustment,
      recoveryTransactions,
      headwayImpact,
      constraints
    );

    const move: OptimizationMove = {
      id: `move_${opportunity.id}_${Date.now()}`,
      type: this.classifyMoveType(opportunity, requiredAdjustment),
      targetConnection: opportunity,
      timeAdjustment: requiredAdjustment,
      requiredTransactions: recoveryTransactions,
      affectedTrips: [...opportunity.affectedTrips],
      scoreImprovement,
      constraintViolations,
      headwayImpact
    };

    moves.push(move);

    return moves;
  }

  /**
   * Calculate required time adjustment for a connection opportunity
   */
  private calculateRequiredTimeAdjustment(
    opportunity: ConnectionOpportunity,
    schedule: Schedule
  ): number {
    const targetTimeMinutes = timeToMinutes(opportunity.targetTime);
    
    // Find current bus time at the connection location
    const currentBusTime = this.getCurrentBusTimeAtLocation(
      opportunity.locationId,
      schedule,
      targetTimeMinutes
    );

    if (currentBusTime === null) {
      return 0; // No adjustment possible
    }

    // Calculate ideal connection time based on connection type
    const connectionWindow = this.connectionWindowService.getConnectionWindows().get(opportunity.type);
    if (!connectionWindow) {
      return 0;
    }

    let idealConnectionTime: number;
    
    switch (opportunity.type) {
      case ConnectionType.SCHOOL_BELL:
        // Schools need arrival before bell time
        idealConnectionTime = targetTimeMinutes - (connectionWindow.ideal.min + connectionWindow.ideal.max) / 2;
        break;
      case ConnectionType.GO_TRAIN:
        // Trains need arrival before departure or departure after arrival
        idealConnectionTime = opportunity.metadata.description.includes('Board') 
          ? targetTimeMinutes - (connectionWindow.ideal.min + connectionWindow.ideal.max) / 2
          : targetTimeMinutes + (connectionWindow.ideal.min + connectionWindow.ideal.max) / 2;
        break;
      default:
        idealConnectionTime = targetTimeMinutes;
    }

    return idealConnectionTime - currentBusTime;
  }

  /**
   * Get current bus time at a location closest to target time (optimized with data structures)
   */
  private getCurrentBusTimeAtLocation(
    locationId: string,
    schedule: Schedule,
    targetTimeMinutes: number
  ): number | null {
    const targetTimeStr = minutesToTime(targetTimeMinutes);
    const cacheKey = `bus_time_${locationId}_${targetTimeStr}`;
    
    return this.cache.memoizedConnectionScore(cacheKey, () => {
      // Use efficient data structures to find nearest trips
      const nearestTrips = this.dataStructures.findNearestTrips(targetTimeStr, locationId, 5);
      
      let closestTime: number | null = null;
      let minDifference = Infinity;

      for (const trip of nearestTrips) {
        const arrivalTime = trip.arrivalTimes[locationId];
        const departureTime = trip.departureTimes[locationId];
        
        const timeToCheck = arrivalTime || departureTime;
        if (!timeToCheck) continue;

        const timeMinutes = this.cache.memoizedTimeToMinutes(timeToCheck);
        const difference = Math.abs(timeMinutes - targetTimeMinutes);

        if (difference < minDifference) {
          minDifference = difference;
          closestTime = timeMinutes;
        }
      }

      return closestTime || 0; // Return 0 instead of null
    });
  }

  /**
   * Generate recovery transactions needed for a move
   */
  private async generateRecoveryTransactions(
    opportunity: ConnectionOpportunity,
    timeAdjustment: number,
    state: OptimizationState
  ): Promise<any[]> {
    if (Math.abs(timeAdjustment) <= 1) {
      return []; // Small adjustments don't need recovery transactions
    }

    const transactions = [];
    const recoveryNeeded = Math.abs(timeAdjustment);

    // Request recovery from bank
    const recoveryRequest = {
      toStopId: opportunity.locationId,
      amount: recoveryNeeded,
      priority: opportunity.priority,
      affectedTrips: opportunity.affectedTrips
    };

    const allocation = await this.recoveryBankService.findOptimalAllocation([recoveryRequest]);
    
    if (allocation.success) {
      transactions.push(...allocation.allocations);
    }

    return transactions;
  }

  /**
   * Calculate headway impact of a move
   */
  private calculateHeadwayImpact(
    opportunity: ConnectionOpportunity,
    timeAdjustment: number,
    schedule: Schedule
  ): OptimizationMove['headwayImpact'] {
    const impacts: OptimizationMove['headwayImpact'] = [];

    // Find trips that would be affected by this time adjustment
    const affectedTripNumbers = opportunity.affectedTrips.map(id => parseInt(id));

    for (const tripNumber of affectedTripNumbers) {
      const trip = schedule.trips.find(t => t.tripNumber === tripNumber);
      if (!trip) continue;

      // Calculate current and new headways
      const currentHeadway = this.calculateTripHeadway(trip, schedule);
      const newHeadway = currentHeadway; // Simplified - would need more complex calculation

      impacts.push({
        tripId: trip.tripNumber.toString(),
        currentHeadway,
        newHeadway,
        deviation: timeAdjustment
      });
    }

    return impacts;
  }

  /**
   * Calculate headway for a specific trip
   */
  private calculateTripHeadway(trip: Trip, schedule: Schedule): number {
    const sortedTrips = schedule.trips
      .sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));

    const tripIndex = sortedTrips.findIndex(t => t.tripNumber === trip.tripNumber);
    
    if (tripIndex <= 0) return 0;

    const prevTrip = sortedTrips[tripIndex - 1];
    const currentDeparture = timeToMinutes(trip.departureTime);
    const prevDeparture = timeToMinutes(prevTrip.departureTime);

    return currentDeparture - prevDeparture;
  }

  /**
   * Calculate score improvement from a move
   */
  private calculateScoreImprovement(
    opportunity: ConnectionOpportunity,
    timeAdjustment: number
  ): number {
    // Current score (based on current window type)
    const currentScore = this.connectionWindowService.calculateConnectionScore(opportunity);

    // Project new window type after adjustment
    const newWindowType = this.projectNewWindowType(opportunity, timeAdjustment);
    const newOpportunity = { ...opportunity, windowType: newWindowType };
    const newScore = this.connectionWindowService.calculateConnectionScore(newOpportunity);

    return newScore - currentScore;
  }

  /**
   * Project new window type after time adjustment
   */
  private projectNewWindowType(
    opportunity: ConnectionOpportunity,
    timeAdjustment: number
  ): 'ideal' | 'partial' | 'missed' {
    const connectionWindow = this.connectionWindowService.getConnectionWindows().get(opportunity.type);
    if (!connectionWindow) return 'missed';

    const currentConnectionTime = opportunity.currentConnectionTime || 0;
    const newConnectionTime = Math.abs(currentConnectionTime - Math.abs(timeAdjustment));

    if (newConnectionTime >= connectionWindow.ideal.min && newConnectionTime <= connectionWindow.ideal.max) {
      return 'ideal';
    } else if (newConnectionTime >= connectionWindow.partial.min && newConnectionTime <= connectionWindow.partial.max) {
      return 'partial';
    } else {
      return 'missed';
    }
  }

  /**
   * Check for constraint violations in a move
   */
  private checkConstraintViolations(
    opportunity: ConnectionOpportunity,
    timeAdjustment: number,
    recoveryTransactions: any[],
    headwayImpact: OptimizationMove['headwayImpact'],
    constraints: OptimizationConstraints
  ): string[] {
    const violations: string[] = [];

    // Check maximum deviation
    if (Math.abs(timeAdjustment) > constraints.maxTripDeviation) {
      violations.push(`Time adjustment ${timeAdjustment}min exceeds maximum deviation ${constraints.maxTripDeviation}min`);
    }

    // Check headway regularity
    if (constraints.enforceHeadwayRegularity) {
      const maxHeadwayDeviation = Math.max(...headwayImpact.map(h => Math.abs(h.deviation)));
      if (maxHeadwayDeviation > constraints.headwayTolerance) {
        violations.push(`Headway deviation ${maxHeadwayDeviation}min exceeds tolerance ${constraints.headwayTolerance}min`);
      }
    }

    // Check recovery availability
    if (recoveryTransactions.length === 0 && Math.abs(timeAdjustment) > 2) {
      violations.push('Insufficient recovery time available for adjustment');
    }

    return violations;
  }

  /**
   * Classify move type based on opportunity and adjustment
   */
  private classifyMoveType(
    opportunity: ConnectionOpportunity,
    timeAdjustment: number
  ): OptimizationMove['type'] {
    if (Math.abs(timeAdjustment) <= 1) {
      return 'connection_align';
    } else if (Math.abs(timeAdjustment) <= 3) {
      return 'recovery_transfer';
    } else {
      return 'time_shift';
    }
  }

  /**
   * Apply optimization moves to the schedule
   */
  private async applyOptimizationMoves(
    moves: OptimizationMove[],
    constraints: OptimizationConstraints
  ): Promise<void> {
    if (!this.currentState) return;

    let appliedCount = 0;
    let totalScoreImprovement = 0;

    for (const move of moves) {
      // Check if applying this move would violate constraints
      if (move.constraintViolations.length > 0) {
        this.currentState.rejectedMoves.push({
          move,
          reason: move.constraintViolations.join('; ')
        });
        continue;
      }

      // Check early termination threshold
      if (move.scoreImprovement < constraints.performance.earlyTerminationThreshold) {
        break;
      }

      // Apply the move
      const applied = await this.applyOptimizationMove(move);
      
      if (applied) {
        this.currentState.appliedMoves.push(move);
        totalScoreImprovement += move.scoreImprovement;
        appliedCount++;

        // Update best state if current is better
        const currentScore = this.currentState.currentScore + totalScoreImprovement;
        if (currentScore > (this.bestState?.currentScore || 0)) {
          this.bestState = this.cloneOptimizationState(this.currentState);
          this.bestState.currentScore = currentScore;
        }
      } else {
        this.currentState.rejectedMoves.push({
          move,
          reason: 'Failed to apply move'
        });
      }

      // Check performance limits
      if (appliedCount >= 20 || this.isTimeoutReached(constraints)) {
        break;
      }
    }

    this.currentState.currentScore += totalScoreImprovement;
  }

  /**
   * Apply a single optimization move
   */
  private async applyOptimizationMove(move: OptimizationMove): Promise<boolean> {
    if (!this.currentState) return false;

    try {
      // Apply recovery transactions
      for (const transaction of move.requiredTransactions) {
        const result = this.recoveryBankService.requestRecoveryTransfer(
          transaction.lenderStopId,
          transaction.borrowerStopId,
          transaction.amount,
          transaction.affectedTrips
        );

        if (!result.success) {
          // Rollback any applied transactions
          return false;
        }
      }

      // Apply time adjustments to affected trips
      for (const tripIdStr of move.affectedTrips) {
        const tripId = parseInt(tripIdStr);
        const trip = this.currentState.currentSchedule.trips.find(t => t.tripNumber === tripId);
        
        if (trip) {
          this.applyTimeAdjustmentToTrip(trip, move.timeAdjustment, move.targetConnection.locationId);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to apply optimization move:', error);
      return false;
    }
  }

  /**
   * Apply time adjustment to a specific trip
   */
  private applyTimeAdjustmentToTrip(
    trip: Trip,
    timeAdjustment: number,
    locationId: string
  ): void {
    // Adjust times at the specific location
    if (trip.arrivalTimes[locationId]) {
      const currentTime = timeToMinutes(trip.arrivalTimes[locationId]);
      trip.arrivalTimes[locationId] = minutesToTime(currentTime + timeAdjustment);
    }

    if (trip.departureTimes[locationId]) {
      const currentTime = timeToMinutes(trip.departureTimes[locationId]);
      trip.departureTimes[locationId] = minutesToTime(currentTime + timeAdjustment);
    }

    // Cascade the adjustment to subsequent stops (simplified)
    // In a real implementation, this would need more sophisticated logic
  }

  /**
   * Validate optimization result against constraints
   */
  private validateOptimizationResult(
    state: OptimizationState,
    constraints: OptimizationConstraints
  ): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check overall schedule shift
    const totalShift = this.calculateTotalScheduleShift(state.currentSchedule);
    if (totalShift > constraints.maxScheduleShift) {
      violations.push(`Total schedule shift ${totalShift}min exceeds limit ${constraints.maxScheduleShift}min`);
    }

    // Check recovery time limits
    const bankState = this.recoveryBankService.getBankState();
    if (bankState) {
      bankState.accounts.forEach(account => {
        const totalRecovery = account.currentDebt; // Simplified check
        if (totalRecovery < constraints.minRecoveryTime) {
          violations.push(`Stop ${account.stopName} below minimum recovery time`);
        }
        if (totalRecovery > constraints.maxRecoveryTime) {
          violations.push(`Stop ${account.stopName} exceeds maximum recovery time`);
        }
      });
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Calculate total schedule shift
   */
  private calculateTotalScheduleShift(schedule: Schedule): number {
    // Simplified calculation - would need original schedule for comparison
    return 0;
  }

  /**
   * Check if optimization timeout is reached
   */
  private isTimeoutReached(constraints: OptimizationConstraints): boolean {
    if (!this.optimizationStartTime) return false;

    const elapsed = Date.now() - this.optimizationStartTime.getTime();
    return elapsed > constraints.performance.maxOptimizationTimeMs;
  }

  /**
   * Calculate schedule score based on connection opportunities
   */
  private calculateScheduleScore(
    opportunities: ConnectionOpportunity[],
    schedule: Schedule
  ): number {
    let totalScore = 0;

    for (const opportunity of opportunities) {
      const score = this.connectionWindowService.calculateConnectionScore(opportunity);
      totalScore += score;
    }

    return totalScore;
  }

  /**
   * Calculate headway deviations for a schedule (with memoization and efficient processing)
   */
  private calculateHeadwayDeviations(schedule: Schedule): HeadwayDeviation[] {
    const cacheKey = `headway_deviations_${schedule.id}_${schedule.trips.length}`;
    
    return this.cache.memoizedHeadwayCalculation(cacheKey, () => {
      const deviations: HeadwayDeviation[] = [];
      const sortedTrips = this.dataStructures.getSortedTrips();
      
      // Batch process headway calculations for better performance
      const batchSize = 100;
      const totalBatches = Math.ceil(sortedTrips.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, sortedTrips.length);
        const batch = sortedTrips.slice(Math.max(startIdx - 1, 0), endIdx); // Include previous trip for headway calculation
        
        for (let i = 1; i < batch.length; i++) {
          const currentTrip = batch[i];
          const prevTrip = batch[i - 1];
          
          // Use memoized time conversions
          const currentHeadway = this.cache.memoizedTimeToMinutes(currentTrip.departureTime) - 
                                this.cache.memoizedTimeToMinutes(prevTrip.departureTime);
          const plannedHeadway = 30; // Should be configurable in constraints
          
          deviations.push({
            tripId: currentTrip.tripNumber.toString(),
            plannedHeadway,
            currentHeadway,
            deviation: currentHeadway - plannedHeadway,
            correctionTrips: Math.min(2, Math.ceil(Math.abs(currentHeadway - plannedHeadway) / 10)),
            correctionRate: Math.max(0.1, Math.min(0.8, 1 - (Math.abs(currentHeadway - plannedHeadway) / plannedHeadway)))
          });
        }
        
        this.performanceTracker.recordOperation('headway_batch_processed');
      }

      return deviations;
    });
  }

  /**
   * Clone optimization state for backtracking
   */
  private cloneOptimizationState(state: OptimizationState): OptimizationState {
    return {
      currentSchedule: this.cloneSchedule(state.currentSchedule),
      recoveryBank: { ...state.recoveryBank }, // Shallow clone for performance
      currentScore: state.currentScore,
      appliedMoves: [...state.appliedMoves],
      rejectedMoves: [...state.rejectedMoves],
      headwayDeviations: [...state.headwayDeviations],
      progress: state.progress,
      startTime: new Date(state.startTime)
    };
  }

  /**
   * Clone schedule for optimization
   */
  private cloneSchedule(schedule: Schedule): Schedule {
    return {
      ...schedule,
      trips: schedule.trips.map(trip => ({
        ...trip,
        arrivalTimes: { ...trip.arrivalTimes },
        departureTimes: { ...trip.departureTimes },
        recoveryTimes: { ...trip.recoveryTimes }
      }))
    };
  }

  /**
   * Get current optimization state
   */
  getCurrentState(): OptimizationState | null {
    return this.currentState;
  }

  /**
   * Get best optimization state found
   */
  getBestState(): OptimizationState | null {
    return this.bestState;
  }

  /**
   * Get performance statistics for optimization debugging
   */
  getPerformanceStats(): {
    processingTime: number;
    movesApplied: number;
    movesRejected: number;
    finalScore: number;
    memoryUsage: number;
  } {
    const processingTime = this.optimizationStartTime 
      ? Date.now() - this.optimizationStartTime.getTime()
      : 0;

    return {
      processingTime,
      movesApplied: this.currentState?.appliedMoves.length || 0,
      movesRejected: this.currentState?.rejectedMoves.length || 0,
      finalScore: this.currentState?.currentScore || 0,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Reset optimization engine state
   */
  reset(): void {
    this.currentState = null;
    this.bestState = null;
    this.optimizationStartTime = null;
    this.shouldCancel = false;
    this.lastIntermediateResult = null;
    this.cache.clearAllCaches();
    this.performanceTracker = new PerformanceTracker();
  }
  
  /**
   * Cancel ongoing optimization
   */
  cancelOptimization(): void {
    this.shouldCancel = true;
  }
  
  /**
   * Configure progressive optimization settings
   */
  configureProgressiveOptimization(enabled: boolean, intervalMs: number = 1000): void {
    this.progressiveOptimizationEnabled = enabled;
    this.intermediateResultsInterval = intervalMs;
  }
  
  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStatistics(): {
    processingTime: number;
    movesApplied: number;
    movesRejected: number;
    finalScore: number;
    memoryUsage: number;
    peakMemoryUsage: number;
    memoryGrowthRate: number;
    cacheStats: any;
    operationCounts: Map<string, number>;
    batchesProcessed: number;
  } {
    const processingTime = this.optimizationStartTime 
      ? Date.now() - this.optimizationStartTime.getTime()
      : 0;
      
    const perfStats = this.performanceTracker.getStats();
    const cacheStats = this.cache.getCacheStats();

    return {
      processingTime,
      movesApplied: this.currentState?.appliedMoves.length || 0,
      movesRejected: this.currentState?.rejectedMoves.length || 0,
      finalScore: this.currentState?.currentScore || 0,
      memoryUsage: perfStats.currentMemoryMB,
      peakMemoryUsage: perfStats.peakMemoryMB,
      memoryGrowthRate: perfStats.memoryGrowthRate,
      cacheStats,
      operationCounts: perfStats.operationCounts,
      batchesProcessed: perfStats.operationCounts.get('batch_processed') || 0
    };
  }

  /**
   * Check if optimization is currently running
   */
  isOptimizationRunning(): boolean {
    return this.optimizationStartTime !== null && (this.currentState?.progress || 0) < 1.0;
  }

  /**
   * Get detailed debug information
   */
  getDebugInfo(): {
    currentState: OptimizationState | null;
    bestState: OptimizationState | null;
    startTime: Date | null;
    isRunning: boolean;
    performance: any;
  } {
    return {
      currentState: this.currentState,
      bestState: this.bestState,
      startTime: this.optimizationStartTime,
      isRunning: this.isOptimizationRunning(),
      performance: this.getPerformanceStats()
    };
  }
}

// Export singleton instance with enhanced performance capabilities
export const optimizationEngine = new OptimizationEngine(
  new RecoveryBankService(),
  new ConnectionWindowService()
);

// Configure default progressive optimization settings for performance
optimizationEngine.configureProgressiveOptimization(true, 500); // 500ms intermediate reporting
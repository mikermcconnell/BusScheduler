/**
 * Connection Optimization Service
 * Main service orchestrating the complete bus schedule connection optimization system
 */

import {
  ConnectionOptimizationRequest,
  ConnectionOptimizationResult,
  OptimizationReport,
  OptimizationProgress,
  GeorgianCollegeConfig,
  GOTrainConfig,
  HighSchoolConfig,
  ConnectionWindow,
  OptimizationConstraints
} from '../types/connectionOptimization';
import { Schedule, ConnectionType } from '../types/schedule';
import { RecoveryBankService } from './recoveryBankService';
import { ConnectionWindowService } from './connectionWindowService';
import { OptimizationEngine } from './optimizationEngine';
import { HeadwayCorrectionService, CorrectionStrategy } from './headwayCorrectionService';
import { sanitizeErrorMessage } from '../utils/inputSanitizer';

/**
 * Enhanced performance monitoring for optimization operations
 */
class AdvancedPerformanceMonitor {
  private startTime: number = 0;
  private memoryUsage: { [key: string]: number } = {};
  private checkpoints: { [key: string]: number } = {};
  private memoryLimit: number = 256; // MB
  private performanceWarnings: string[] = [];
  private operationTimings = new Map<string, number[]>();
  private memoryGrowthRate = 0;
  private initialMemory = 0;

  startMonitoring(memoryLimitMB: number = 256): void {
    this.startTime = performance.now();
    this.memoryLimit = memoryLimitMB;
    this.performanceWarnings = [];
    this.recordMemoryUsage('start');
    this.initialMemory = this.getCurrentMemoryUsage();
  }

  checkpoint(name: string, operation?: string): void {
    const currentTime = performance.now() - this.startTime;
    this.checkpoints[name] = currentTime;
    this.recordMemoryUsage(name);
    
    // Track operation timing
    if (operation) {
      const timings = this.operationTimings.get(operation) || [];
      timings.push(currentTime);
      this.operationTimings.set(operation, timings);
    }
    
    this.checkMemoryLimits(name);
    this.updateMemoryGrowthRate();
  }

  private recordMemoryUsage(checkpoint: string): void {
    const usage = this.getCurrentMemoryUsage();
    this.memoryUsage[checkpoint] = usage;
  }
  
  private getCurrentMemoryUsage(): number {
    if (typeof window !== 'undefined' && (window as any).performance?.memory) {
      const memory = (window as any).performance.memory;
      return memory.usedJSHeapSize / 1024 / 1024; // MB
    } else if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      return memory.heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }
  
  private checkMemoryLimits(checkpoint: string): void {
    const currentMemory = this.getCurrentMemoryUsage();
    if (currentMemory > this.memoryLimit * 0.9) {
      this.performanceWarnings.push(`Memory usage approaching limit at ${checkpoint}: ${currentMemory.toFixed(1)}MB`);
    }
    if (currentMemory > this.memoryLimit) {
      this.performanceWarnings.push(`Memory limit exceeded at ${checkpoint}: ${currentMemory.toFixed(1)}MB`);
    }
  }
  
  private updateMemoryGrowthRate(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    const elapsedTime = (performance.now() - this.startTime) / 1000; // seconds
    this.memoryGrowthRate = elapsedTime > 0 ? (currentMemory - this.initialMemory) / elapsedTime : 0;
  }

  isMemoryLimitExceeded(): boolean {
    return this.getCurrentMemoryUsage() > this.memoryLimit;
  }
  
  getEstimatedTimeRemaining(progress: number): number {
    if (progress <= 0) return 0;
    const elapsedTime = performance.now() - this.startTime;
    return (elapsedTime / progress) * (100 - progress);
  }
  
  getAverageOperationTime(operation: string): number {
    const timings = this.operationTimings.get(operation);
    if (!timings || timings.length === 0) return 0;
    return timings.reduce((sum, time) => sum + time, 0) / timings.length;
  }

  getMetrics(): {
    totalTimeMs: number;
    checkpoints: { [key: string]: number };
    memoryUsage: { [key: string]: number };
    peakMemoryMB: number;
    currentMemoryMB: number;
    memoryGrowthRate: number;
    warnings: string[];
    operationAverages: { [key: string]: number };
  } {
    const totalTime = performance.now() - this.startTime;
    const peakMemory = Math.max(...Object.values(this.memoryUsage), 0);
    const currentMemory = this.getCurrentMemoryUsage();
    
    const operationAverages: { [key: string]: number } = {};
    this.operationTimings.forEach((timings, operation) => {
      operationAverages[operation] = timings.reduce((sum, time) => sum + time, 0) / timings.length;
    });

    return {
      totalTimeMs: totalTime,
      checkpoints: { ...this.checkpoints },
      memoryUsage: { ...this.memoryUsage },
      peakMemoryMB: peakMemory,
      currentMemoryMB: currentMemory,
      memoryGrowthRate: this.memoryGrowthRate,
      warnings: [...this.performanceWarnings],
      operationAverages
    };
  }
}

/**
 * Advanced optimization cache with LRU eviction and memory management
 */
class AdvancedOptimizationCache {
  private connectionWindowCache = new Map<string, { data: any; accessTime: number; hitCount: number }>();
  private recoveryBankCache = new Map<string, { data: any; accessTime: number; hitCount: number }>();
  private headwayCache = new Map<string, { data: any; accessTime: number; hitCount: number }>();
  private configurationCache = new Map<string, { data: any; accessTime: number; hitCount: number }>();
  private maxCacheSize = 1000;
  private cacheHits = 0;
  private cacheMisses = 0;

  cacheConnectionWindows(key: string, windows: any): void {
    this.manageCacheSize(this.connectionWindowCache);
    this.connectionWindowCache.set(key, {
      data: windows,
      accessTime: Date.now(),
      hitCount: 0
    });
  }

  getCachedConnectionWindows(key: string): any | null {
    const entry = this.connectionWindowCache.get(key);
    if (entry) {
      entry.accessTime = Date.now();
      entry.hitCount++;
      this.cacheHits++;
      return entry.data;
    }
    this.cacheMisses++;
    return null;
  }

  cacheRecoveryBank(key: string, bank: any): void {
    this.manageCacheSize(this.recoveryBankCache);
    this.recoveryBankCache.set(key, {
      data: bank,
      accessTime: Date.now(),
      hitCount: 0
    });
  }

  getCachedRecoveryBank(key: string): any | null {
    const entry = this.recoveryBankCache.get(key);
    if (entry) {
      entry.accessTime = Date.now();
      entry.hitCount++;
      this.cacheHits++;
      return entry.data;
    }
    this.cacheMisses++;
    return null;
  }

  cacheHeadwayCalculation(key: string, headways: any): void {
    this.manageCacheSize(this.headwayCache);
    this.headwayCache.set(key, {
      data: headways,
      accessTime: Date.now(),
      hitCount: 0
    });
  }

  getCachedHeadwayCalculation(key: string): any | null {
    const entry = this.headwayCache.get(key);
    if (entry) {
      entry.accessTime = Date.now();
      entry.hitCount++;
      this.cacheHits++;
      return entry.data;
    }
    this.cacheMisses++;
    return null;
  }
  
  cacheConfiguration(key: string, config: any): void {
    this.manageCacheSize(this.configurationCache);
    this.configurationCache.set(key, {
      data: config,
      accessTime: Date.now(),
      hitCount: 0
    });
  }

  getCachedConfiguration(key: string): any | null {
    const entry = this.configurationCache.get(key);
    if (entry) {
      entry.accessTime = Date.now();
      entry.hitCount++;
      this.cacheHits++;
      return entry.data;
    }
    this.cacheMisses++;
    return null;
  }

  private manageCacheSize(cache: Map<string, any>): void {
    if (cache.size >= this.maxCacheSize) {
      // LRU eviction - remove oldest accessed entries
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].accessTime - b[1].accessTime);
      
      // Remove oldest 20% of entries
      const entriesToRemove = Math.floor(this.maxCacheSize * 0.2);
      for (let i = 0; i < entriesToRemove; i++) {
        cache.delete(entries[i][0]);
      }
    }
  }
  
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }
  
  getCacheStats(): {
    connectionWindows: number;
    recoveryBank: number;
    headwayCalculations: number;
    configurations: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  } {
    return {
      connectionWindows: this.connectionWindowCache.size,
      recoveryBank: this.recoveryBankCache.size,
      headwayCalculations: this.headwayCache.size,
      configurations: this.configurationCache.size,
      hitRate: this.getCacheHitRate(),
      totalHits: this.cacheHits,
      totalMisses: this.cacheMisses
    };
  }

  clearAllCaches(): void {
    this.connectionWindowCache.clear();
    this.recoveryBankCache.clear();
    this.headwayCache.clear();
    this.configurationCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  // Preemptive cache warming for anticipated calculations
  warmCache(schedule: Schedule, connections: any[]): void {
    // Pre-calculate commonly accessed items
    const scheduleId = schedule.id;
    const tripCount = schedule.trips.length;
    const connectionCount = connections.length;
    
    // Cache configuration lookup
    this.cacheConfiguration(`schedule_${scheduleId}`, {
      tripCount,
      connectionCount,
      complexity: this.calculateComplexityScore(tripCount, connectionCount)
    });
  }
  
  private calculateComplexityScore(tripCount: number, connectionCount: number): number {
    // Simple complexity scoring for optimization strategy selection
    return (tripCount * 0.6) + (connectionCount * 0.4);
  }
}

/**
 * Main Connection Optimization Service
 */
/**
 * Web Worker management for heavy computational tasks (when available)
 */
class WebWorkerManager {
  private workers: Worker[] = [];
  private isWebWorkerSupported = false;
  private maxWorkers = 2;
  
  constructor() {
    this.isWebWorkerSupported = typeof Worker !== 'undefined';
  }
  
  isSupported(): boolean {
    return this.isWebWorkerSupported;
  }
  
  async executeInWorker<T, R>(task: string, data: T): Promise<R> {
    if (!this.isWebWorkerSupported) {
      throw new Error('Web Workers not supported in this environment');
    }
    
    return new Promise((resolve, reject) => {
      // In a real implementation, this would create and manage actual Web Workers
      // For now, we'll simulate the async nature without actual workers
      setTimeout(() => {
        try {
          // Simulate worker processing
          const result = this.processTaskInMainThread(task, data);
          resolve(result as R);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  }
  
  private processTaskInMainThread<T, R>(task: string, data: T): R {
    // Fallback processing when Web Workers are not available
    // This would be replaced with actual worker communication in production
    switch (task) {
      case 'calculateConnectionScores':
        return this.calculateConnectionScoresBatch(data) as R;
      case 'optimizeRecoveryAllocation':
        return this.optimizeRecoveryAllocationBatch(data) as R;
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }
  
  private calculateConnectionScoresBatch(data: any): any {
    // Simulated heavy calculation that would run in worker
    const connections = data.connections || [];
    return connections.map((conn: any) => ({
      ...conn,
      calculatedScore: Math.random() * 100 // Placeholder calculation
    }));
  }
  
  private optimizeRecoveryAllocationBatch(data: any): any {
    // Simulated optimization calculation
    return {
      allocations: data.requests || [],
      optimized: true,
      processingTime: Math.random() * 1000
    };
  }
  
  terminateWorkers(): void {
    this.workers.forEach(worker => {
      if (worker.terminate) {
        worker.terminate();
      }
    });
    this.workers = [];
  }
}

export class ConnectionOptimizationService {
  private recoveryBankService: RecoveryBankService;
  private connectionWindowService: ConnectionWindowService;
  private optimizationEngine: OptimizationEngine;
  private headwayCorrectionService: HeadwayCorrectionService;
  private performanceMonitor: AdvancedPerformanceMonitor;
  private cache: AdvancedOptimizationCache;
  private webWorkerManager: WebWorkerManager;

  // Configuration
  private georgianConfig?: GeorgianCollegeConfig;
  private goTrainConfig?: GOTrainConfig;
  private highSchoolConfig?: HighSchoolConfig;
  private customConnectionWindows = new Map<ConnectionType, ConnectionWindow>();

  // Optimization state with cancellation support
  private isOptimizationRunning = false;
  private currentOptimizationId: string | null = null;
  private optimizationHistory: Map<string, ConnectionOptimizationResult> = new Map();
  private cancellationToken: { cancelled: boolean } = { cancelled: false };
  private progressiveOptimizationEnabled = true;
  private performanceTargets = {
    small: { maxTrips: 100, targetTimeMs: 5000 },
    medium: { maxTrips: 500, targetTimeMs: 30000 },
    large: { maxTrips: Infinity, targetTimeMs: 120000 }
  };

  constructor() {
    this.recoveryBankService = new RecoveryBankService();
    this.connectionWindowService = new ConnectionWindowService();
    this.optimizationEngine = new OptimizationEngine(
      this.recoveryBankService,
      this.connectionWindowService
    );
    this.headwayCorrectionService = new HeadwayCorrectionService();
    this.performanceMonitor = new AdvancedPerformanceMonitor();
    this.cache = new AdvancedOptimizationCache();
    this.webWorkerManager = new WebWorkerManager();
  }

  /**
   * Configure service for Georgian College connections
   */
  configureGeorgianCollege(config: GeorgianCollegeConfig): void {
    this.georgianConfig = config;
    this.connectionWindowService.configureGeorgianCollege(config);
    this.cache.clearAllCaches(); // Clear cache when configuration changes
  }

  /**
   * Configure service for GO Train connections
   */
  configureGOTrain(config: GOTrainConfig): void {
    this.goTrainConfig = config;
    this.connectionWindowService.configureGOTrain(config);
    this.cache.clearAllCaches();
  }

  /**
   * Configure service for High School connections
   */
  configureHighSchool(config: HighSchoolConfig): void {
    this.highSchoolConfig = config;
    this.connectionWindowService.configureHighSchool(config);
    this.cache.clearAllCaches();
  }

  /**
   * Set custom connection windows
   */
  setConnectionWindows(windows: Map<ConnectionType, ConnectionWindow>): void {
    this.customConnectionWindows = new Map(windows);
    this.connectionWindowService.configureConnectionWindows(windows);
    this.cache.clearAllCaches();
  }

  /**
   * Main optimization method with comprehensive error handling and performance optimization
   */
  async optimizeScheduleConnections(
    request: ConnectionOptimizationRequest,
    progressCallback?: (progress: OptimizationProgress) => void
  ): Promise<ConnectionOptimizationResult> {
    const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentOptimizationId = optimizationId;

    // Check if optimization is already running
    if (this.isOptimizationRunning) {
      return {
        success: false,
        optimizedSchedule: request.schedule,
        finalScore: 0,
        score: 0,
        scoreImprovement: 0,
        successfulConnections: [],
        connectionsImproved: 0,
        failedConnections: [],
        appliedMoves: [],
        finalRecoveryState: this.recoveryBankService.initializeBank(request.schedule, [], request.constraints),
        headwayCorrections: [],
        statistics: {
          totalConnectionsAnalyzed: 0,
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
        recommendations: ['Another optimization is already in progress. Please wait for completion.'],
        warnings: [],
        error: 'Optimization already in progress'
      };
    }

    this.isOptimizationRunning = true;
    this.performanceMonitor.startMonitoring();

    try {
      // Phase 1: Validation and setup
      progressCallback?.({
        progress: 5,
        phase: 'Validating optimization request',
        currentScore: 0,
        bestScore: 0,
        connectionsMade: 0,
        estimatedTimeRemainingMs: request.options.maxIterations * 100,
        memoryUsageMB: 0,
        canCancel: true
      });

      const validationResult = this.validateOptimizationRequest(request);
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors.join('; '));
      }

      this.performanceMonitor.checkpoint('validation');

      // Phase 2: Connection opportunity analysis
      progressCallback?.({
        progress: 15,
        phase: 'Analyzing connection opportunities',
        currentScore: 0,
        bestScore: 0,
        connectionsMade: 0,
        estimatedTimeRemainingMs: request.options.maxIterations * 90,
        memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
        canCancel: true
      });

      const opportunities = await this.analyzeConnectionOpportunities(
        request.schedule,
        request.connectionOpportunities
      );

      this.performanceMonitor.checkpoint('opportunity_analysis');

      // Phase 3: Recovery bank initialization
      progressCallback?.({
        progress: 25,
        phase: 'Initializing recovery bank system',
        currentScore: 0,
        bestScore: 0,
        connectionsMade: 0,
        estimatedTimeRemainingMs: request.options.maxIterations * 80,
        memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
        canCancel: true
      });

      const recoveryBank = this.recoveryBankService.initializeBank(
        request.schedule,
        request.recoveryBankConfig.stopConfigurations,
        request.constraints
      );

      this.performanceMonitor.checkpoint('recovery_bank_init');

      // Phase 4: Core optimization
      progressCallback?.({
        progress: 35,
        phase: 'Running optimization engine',
        currentScore: 0,
        bestScore: 0,
        connectionsMade: 0,
        estimatedTimeRemainingMs: request.options.maxIterations * 70,
        memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
        canCancel: true
      });

      const optimizationState = await this.optimizationEngine.optimizeConnections(
        request.schedule,
        opportunities,
        request.constraints,
        (progress, phase) => {
          progressCallback?.({
            progress: 35 + (progress * 0.4), // Scale to 35-75% range
            phase: `Optimization: ${phase}`,
            currentScore: this.optimizationEngine.getCurrentState()?.currentScore || 0,
            bestScore: this.optimizationEngine.getBestState()?.currentScore || 0,
            connectionsMade: this.optimizationEngine.getCurrentState()?.appliedMoves.length || 0,
            estimatedTimeRemainingMs: Math.max(0, request.constraints.performance.maxOptimizationTimeMs - this.performanceMonitor.getMetrics().totalTimeMs),
            memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
            canCancel: false // Cannot cancel during core optimization
          });
        }
      );

      this.performanceMonitor.checkpoint('core_optimization');

      // Phase 5: Headway correction
      progressCallback?.({
        progress: 80,
        phase: 'Applying headway corrections',
        currentScore: optimizationState.currentScore,
        bestScore: optimizationState.currentScore,
        connectionsMade: optimizationState.appliedMoves.length,
        estimatedTimeRemainingMs: request.constraints.performance.maxOptimizationTimeMs * 0.15,
        memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
        canCancel: false
      });

      const headwayCorrectionResult = this.headwayCorrectionService.correctHeadways(
        optimizationState.currentSchedule,
        optimizationState.headwayDeviations,
        request.headwayCorrection,
        request.constraints,
        CorrectionStrategy.EXPONENTIAL_SMOOTHING
      );

      this.performanceMonitor.checkpoint('headway_correction');

      // Phase 6: Results compilation and analysis
      progressCallback?.({
        progress: 95,
        phase: 'Compiling optimization results',
        currentScore: optimizationState.currentScore,
        bestScore: optimizationState.currentScore,
        connectionsMade: optimizationState.appliedMoves.length,
        estimatedTimeRemainingMs: request.constraints.performance.maxOptimizationTimeMs * 0.05,
        memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
        canCancel: false
      });

      const result = await this.compileOptimizationResult(
        request,
        optimizationState,
        headwayCorrectionResult,
        opportunities
      );

      this.performanceMonitor.checkpoint('result_compilation');

      // Store in history
      this.optimizationHistory.set(optimizationId, result);

      // Final progress update
      progressCallback?.({
        progress: 100,
        phase: 'Optimization completed',
        currentScore: result.finalScore,
        bestScore: result.finalScore,
        connectionsMade: result.successfulConnections.length,
        estimatedTimeRemainingMs: 0,
        memoryUsageMB: this.performanceMonitor.getMetrics().peakMemoryMB,
        canCancel: false
      });

      return result;

    } catch (error) {
      const sanitizedError = sanitizeErrorMessage(error instanceof Error ? error.message : 'Unknown optimization error');
      
      return {
        success: false,
        optimizedSchedule: request.schedule,
        finalScore: 0,
        score: 0,
        scoreImprovement: 0,
        successfulConnections: [],
        connectionsImproved: 0,
        failedConnections: request.connectionOpportunities.map(opp => ({
          opportunity: opp,
          reason: 'Optimization failed'
        })),
        appliedMoves: [],
        finalRecoveryState: this.recoveryBankService.getBankState() || this.recoveryBankService.initializeBank(request.schedule, [], request.constraints),
        headwayCorrections: [],
        statistics: {
          totalConnectionsAnalyzed: request.connectionOpportunities.length,
          totalMovesEvaluated: 0,
          totalMovesApplied: 0,
          optimizationTimeMs: this.performanceMonitor.getMetrics().totalTimeMs,
          memoryUsedMB: this.performanceMonitor.getMetrics().peakMemoryMB,
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
        recommendations: ['Optimization failed. Check constraints and try again with reduced complexity.'],
        warnings: [],
        error: sanitizedError
      };
    } finally {
      this.isOptimizationRunning = false;
      this.currentOptimizationId = null;
    }
  }

  /**
   * Validate optimization request
   */
  private validateOptimizationRequest(request: ConnectionOptimizationRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate schedule
    if (!request.schedule || !request.schedule.trips || request.schedule.trips.length === 0) {
      errors.push('Schedule must contain at least one trip');
    }

    if (request.schedule.trips.length > 1000) {
      warnings.push('Large schedule detected (>1000 trips). Optimization may take longer.');
    }

    // Validate connection opportunities
    if (!request.connectionOpportunities || request.connectionOpportunities.length === 0) {
      errors.push('At least one connection opportunity must be provided');
    }

    if (request.connectionOpportunities.length > 100) {
      warnings.push('High number of connection opportunities (>100). Consider filtering to most important ones.');
    }

    // Validate constraints
    if (!request.constraints) {
      errors.push('Optimization constraints must be provided');
    } else {
      if (request.constraints.maxTripDeviation <= 0) {
        errors.push('Maximum trip deviation must be positive');
      }

      if (request.constraints.maxTripDeviation > 30) {
        warnings.push('Large maximum trip deviation (>30min) may affect schedule reliability');
      }

      if (request.constraints.performance.maxOptimizationTimeMs < 5000) {
        warnings.push('Short optimization time limit may prevent finding optimal solutions');
      }
    }

    // Validate recovery bank configuration
    if (request.recoveryBankConfig.allowBorrowing && request.recoveryBankConfig.maxBorrowingRatio > 1.0) {
      warnings.push('High borrowing ratio may cause recovery time shortages');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Analyze connection opportunities with performance optimization
   */
  private async analyzeConnectionOpportunities(
    schedule: Schedule,
    requestedOpportunities: any[]
  ): Promise<any[]> {
    const cacheKey = `opportunities_${schedule.id}_${JSON.stringify(requestedOpportunities).slice(0, 100)}`;
    const cached = this.cache.getCachedConnectionWindows(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Batch process opportunities for better performance
    const batchSize = 50;
    const opportunities = [];

    for (let i = 0; i < requestedOpportunities.length; i += batchSize) {
      const batch = requestedOpportunities.slice(i, i + batchSize);
      const batchOpportunities = this.connectionWindowService.analyzeConnectionOpportunities(schedule);
      
      // Filter to only requested opportunities
      const filteredBatch = batchOpportunities.filter(opp => 
        batch.some(req => req.id === opp.id || req.locationId === opp.locationId)
      );
      
      opportunities.push(...filteredBatch);

      // Yield control to prevent blocking
      if (i % (batchSize * 2) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    this.cache.cacheConnectionWindows(cacheKey, opportunities);
    return opportunities;
  }

  /**
   * Compile optimization result with comprehensive metrics
   */
  private async compileOptimizationResult(
    request: ConnectionOptimizationRequest,
    optimizationState: any,
    headwayCorrectionResult: any,
    opportunities: any[]
  ): Promise<ConnectionOptimizationResult> {
    const performanceMetrics = this.performanceMonitor.getMetrics();
    
    // Calculate successful vs failed connections
    const successfulConnections = opportunities.filter(opp => 
      optimizationState.appliedMoves.some((move: any) => move.targetConnection.id === opp.id)
    );
    
    const failedConnections = opportunities.filter(opp => 
      !successfulConnections.some(successful => successful.id === opp.id)
    ).map(opp => ({
      opportunity: opp,
      reason: 'Could not find feasible optimization move'
    }));

    // Calculate performance metrics
    const connectionSuccessRate = opportunities.length > 0 
      ? (successfulConnections.length / opportunities.length) * 100 
      : 0;

    const averageConnectionTime = successfulConnections.length > 0
      ? successfulConnections.reduce((sum, conn) => sum + (conn.currentConnectionTime || 0), 0) / successfulConnections.length
      : 0;

    const recoveryBank = this.recoveryBankService.getBankState();
    const recoveryUtilizationRate = recoveryBank 
      ? (recoveryBank.totalBorrowedRecovery / Math.max(recoveryBank.totalAvailableRecovery, 1)) * 100
      : 0;

    // Calculate constraint compliance rate
    const totalConstraintChecks = optimizationState.appliedMoves.length + optimizationState.rejectedMoves.length;
    const constraintViolations = optimizationState.rejectedMoves.length;
    const constraintComplianceRate = totalConstraintChecks > 0 
      ? ((totalConstraintChecks - constraintViolations) / totalConstraintChecks) * 100 
      : 100;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      request,
      optimizationState,
      headwayCorrectionResult,
      { connectionSuccessRate, recoveryUtilizationRate, constraintComplianceRate }
    );

    // Collect warnings
    const warnings: string[] = [];
    if (performanceMetrics.peakMemoryMB > request.constraints.performance.maxMemoryUsageMB) {
      warnings.push(`Memory usage (${Math.round(performanceMetrics.peakMemoryMB)}MB) exceeded limit (${request.constraints.performance.maxMemoryUsageMB}MB)`);
    }

    if (performanceMetrics.totalTimeMs > request.constraints.performance.maxOptimizationTimeMs) {
      warnings.push(`Optimization time (${Math.round(performanceMetrics.totalTimeMs)}ms) exceeded limit (${request.constraints.performance.maxOptimizationTimeMs}ms)`);
    }

    return {
      success: true,
      optimizedSchedule: optimizationState.currentSchedule,
      finalScore: optimizationState.currentScore,
      score: optimizationState.currentScore,
      scoreImprovement: optimizationState.currentScore, // Would need original score for comparison
      successfulConnections,
      connectionsImproved: successfulConnections.length,
      failedConnections,
      appliedMoves: optimizationState.appliedMoves,
      finalRecoveryState: recoveryBank || this.recoveryBankService.initializeBank(request.schedule, [], request.constraints),
      headwayCorrections: headwayCorrectionResult.tripCorrections.filter((tc: any) => tc.correctionApplied),
      statistics: {
        totalConnectionsAnalyzed: opportunities.length,
        totalMovesEvaluated: optimizationState.appliedMoves.length + optimizationState.rejectedMoves.length,
        totalMovesApplied: optimizationState.appliedMoves.length,
        optimizationTimeMs: performanceMetrics.totalTimeMs,
        memoryUsedMB: performanceMetrics.peakMemoryMB,
        iterationsCompleted: request.options.maxIterations, // Simplified
        convergenceAchieved: optimizationState.appliedMoves.length > 0
      },
      performance: {
        connectionSuccessRate,
        averageConnectionTime,
        headwayRegularityScore: headwayCorrectionResult.statisticalMetrics.regularityScore * 100,
        recoveryUtilizationRate,
        constraintComplianceRate
      },
      recommendations,
      warnings
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    request: ConnectionOptimizationRequest,
    optimizationState: any,
    headwayCorrectionResult: any,
    performanceMetrics: any
  ): string[] {
    const recommendations: string[] = [];

    // Connection success rate recommendations
    if (performanceMetrics.connectionSuccessRate < 50) {
      recommendations.push('Low connection success rate. Consider relaxing trip deviation constraints or increasing recovery time availability.');
    } else if (performanceMetrics.connectionSuccessRate > 90) {
      recommendations.push('Excellent connection success rate! Consider optimizing for additional objectives like fuel efficiency or passenger comfort.');
    }

    // Recovery utilization recommendations
    if (performanceMetrics.recoveryUtilizationRate < 30) {
      recommendations.push('Low recovery time utilization. You may be able to reduce scheduled recovery times for more efficient operations.');
    } else if (performanceMetrics.recoveryUtilizationRate > 80) {
      recommendations.push('High recovery time utilization. Consider adding more recovery time to improve schedule reliability.');
    }

    // Headway regularity recommendations
    if (headwayCorrectionResult.statisticalMetrics.regularityScore < 0.7) {
      recommendations.push('Headway regularity could be improved. Consider using stronger correction parameters or reviewing base schedule timing.');
    }

    // Constraint compliance recommendations
    if (performanceMetrics.constraintComplianceRate < 80) {
      recommendations.push('Many optimization moves were rejected due to constraints. Consider reviewing constraint settings or schedule feasibility.');
    }

    // Performance recommendations
    if (optimizationState.rejectedMoves.length > optimizationState.appliedMoves.length) {
      recommendations.push('More moves were rejected than applied. This suggests constraints may be too restrictive for the current schedule.');
    }

    // Schedule-specific recommendations
    if (request.schedule.trips.length > 200) {
      recommendations.push('Large schedule detected. Consider implementing phased optimization or parallel processing for better performance.');
    }

    return recommendations;
  }

  /**
   * Generate comprehensive optimization report
   */
  generateOptimizationReport(
    optimizationId: string,
    originalSchedule: Schedule
  ): OptimizationReport | null {
    const result = this.optimizationHistory.get(optimizationId);
    if (!result) {
      return null;
    }

    // Calculate before/after metrics (simplified - would need more detailed comparison)
    const beforeConnectionCount = 0; // Would need to analyze original schedule
    const afterConnectionCount = result.successfulConnections.length;

    const connectionAnalysisByType = new Map<ConnectionType, any>();
    const connectionAnalysisByPriority = new Map<number, any>();
    const timeDistribution = new Map<string, number>();

    // Analyze connections by type
    Object.values(ConnectionType).forEach(type => {
      const typeConnections = result.successfulConnections.filter(conn => conn.type === type);
      const typeOpportunities = result.successfulConnections.length + result.failedConnections.filter(fc => fc.opportunity.type === type).length;
      
      connectionAnalysisByType.set(type, {
        attempted: typeOpportunities,
        successful: typeConnections.length,
        averageScore: typeConnections.length > 0 ? 0.8 : 0 // Simplified calculation
      });
    });

    // Analyze connections by priority
    for (let priority = 1; priority <= 10; priority++) {
      const priorityConnections = result.successfulConnections.filter(conn => conn.priority === priority);
      const priorityOpportunities = priorityConnections.length + result.failedConnections.filter(fc => fc.opportunity.priority === priority).length;
      
      if (priorityOpportunities > 0) {
        connectionAnalysisByPriority.set(priority, {
          attempted: priorityOpportunities,
          successful: priorityConnections.length,
          averageScore: priorityConnections.length > 0 ? 0.8 : 0
        });
      }
    }

    // Analyze time distribution
    result.successfulConnections.forEach(conn => {
      const hour = conn.targetTime.split(':')[0];
      const hourKey = `${hour}:00`;
      timeDistribution.set(hourKey, (timeDistribution.get(hourKey) || 0) + 1);
    });

    // Recovery analysis
    const bankReport = this.recoveryBankService.generateUtilizationReport();

    return {
      requestSummary: {
        scheduleId: originalSchedule.id,
        routeName: originalSchedule.routeName,
        tripCount: originalSchedule.trips.length,
        connectionCount: result.successfulConnections.length + result.failedConnections.length,
        optimizationDate: new Date()
      },
      comparison: {
        before: {
          connectionsMade: beforeConnectionCount,
          averageConnectionTime: 0, // Would need original analysis
          headwayRegularity: 0.5, // Baseline assumption
          totalRecoveryTime: 0 // Would need original analysis
        },
        after: {
          connectionsMade: afterConnectionCount,
          averageConnectionTime: result.performance.averageConnectionTime,
          headwayRegularity: result.performance.headwayRegularityScore / 100,
          totalRecoveryTime: bankReport.totalOutstandingDebt
        },
        improvement: {
          additionalConnections: afterConnectionCount - beforeConnectionCount,
          connectionTimeImprovement: 0, // Would need detailed comparison
          headwayRegularityImprovement: (result.performance.headwayRegularityScore / 100) - 0.5,
          recoveryTimeEfficiency: result.performance.recoveryUtilizationRate / 100
        }
      },
      connectionAnalysis: {
        byType: connectionAnalysisByType,
        byPriority: connectionAnalysisByPriority,
        timeDistribution
      },
      recoveryAnalysis: {
        totalRecoveryAvailable: bankReport.totalAvailableCredit,
        totalRecoveryUsed: bankReport.totalOutstandingDebt,
        utilizationRate: bankReport.utilizationRate,
        topLenders: bankReport.topLenders,
        topBorrowers: bankReport.topBorrowers
      },
      recommendations: {
        scheduleAdjustments: result.recommendations.filter(r => r.includes('schedule')),
        recoveryTimeAdjustments: result.recommendations.filter(r => r.includes('recovery')),
        connectionOpportunities: result.recommendations.filter(r => r.includes('connection')),
        performanceImprovements: result.recommendations.filter(r => r.includes('performance') || r.includes('constraint'))
      }
    };
  }

  /**
   * Cancel running optimization with enhanced cleanup
   */
  cancelOptimization(): boolean {
    if (!this.isOptimizationRunning) {
      return false;
    }

    // Signal cancellation
    this.cancellationToken.cancelled = true;
    
    // Cancel optimization engine
    this.optimizationEngine.cancelOptimization();
    
    // Cleanup
    this.cleanup();
    
    // Reset services
    this.recoveryBankService.resetBank();
    
    return true;
  }
  
  /**
   * Cleanup optimization state
   */
  private cleanup(): void {
    this.isOptimizationRunning = false;
    this.currentOptimizationId = null;
    this.cancellationToken.cancelled = false;
    this.webWorkerManager.terminateWorkers();
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): Map<string, ConnectionOptimizationResult> {
    return new Map(this.optimizationHistory);
  }

  /**
   * Clear optimization history and caches
   */
  clearHistory(): void {
    this.optimizationHistory.clear();
    this.cache.clearAllCaches();
    this.headwayCorrectionService.clearCorrectionHistory();
  }
  
  /**
   * Select optimization strategy based on dataset characteristics
   */
  private selectOptimizationStrategy(schedule: Schedule, connections: any[]): {
    name: string;
    useWebWorkers: boolean;
    batchSize: number;
    memoryOptimized: boolean;
    useMemoryOptimizedMode?: boolean;
    disableCancellation?: boolean;
    earlyTerminationThreshold: number;
  } {
    const tripCount = schedule.trips.length;
    const connectionCount = connections.length;
    const complexity = (tripCount * 0.6) + (connectionCount * 0.4);
    
    if (complexity <= 100) {
      return {
        name: 'Fast Track',
        useWebWorkers: false,
        batchSize: 50,
        memoryOptimized: false,
        earlyTerminationThreshold: 0.95
      };
    } else if (complexity <= 500) {
      return {
        name: 'Standard',
        useWebWorkers: this.webWorkerManager.isSupported(),
        batchSize: 25,
        memoryOptimized: false,
        earlyTerminationThreshold: 0.85
      };
    } else {
      return {
        name: 'Heavy Duty',
        useWebWorkers: this.webWorkerManager.isSupported(),
        batchSize: 15,
        memoryOptimized: true,
        earlyTerminationThreshold: 0.75
      };
    }
  }
  
  /**
   * Report progress with enhanced information
   */
  private reportProgress(
    callback: ((progress: OptimizationProgress) => void) | undefined,
    progress: number,
    phase: string,
    strategy: any,
    connectionsMade: number = 0
  ): void {
    if (!callback) return;
    
    const perfMetrics = this.performanceMonitor.getMetrics();
    
    callback({
      progress,
      phase: `${strategy.name}: ${phase}`,
      currentScore: 0,
      bestScore: 0,
      connectionsMade,
      estimatedTimeRemainingMs: this.performanceMonitor.getEstimatedTimeRemaining(progress),
      memoryUsageMB: perfMetrics.currentMemoryMB,
      canCancel: !this.cancellationToken.cancelled
    });
  }
  
  /**
   * Advanced connection opportunity analysis with Web Workers and batching
   */
  private async analyzeConnectionOpportunitiesAdvanced(
    schedule: Schedule,
    requestedOpportunities: any[],
    strategy: any
  ): Promise<any[]> {
    const cacheKey = `opportunities_adv_${schedule.id}_${requestedOpportunities.length}_${strategy.name}`;
    const cached = this.cache.getCachedConnectionWindows(cacheKey);
    
    if (cached) {
      return cached;
    }

    let opportunities: any[];
    
    if (strategy.useWebWorkers && requestedOpportunities.length > 100) {
      // Use Web Workers for heavy analysis
      try {
        opportunities = await this.webWorkerManager.executeInWorker('calculateConnectionScores', {
          schedule,
          connections: requestedOpportunities
        });
      } catch (error) {
        // Fallback to main thread processing
        opportunities = await this.analyzeConnectionOpportunitiesBatched(schedule, requestedOpportunities, strategy.batchSize);
      }
    } else {
      // Standard batched processing
      opportunities = await this.analyzeConnectionOpportunitiesBatched(schedule, requestedOpportunities, strategy.batchSize);
    }

    this.cache.cacheConnectionWindows(cacheKey, opportunities);
    return opportunities;
  }
  
  /**
   * Batch process connection opportunities
   */
  private async analyzeConnectionOpportunitiesBatched(
    schedule: Schedule,
    requestedOpportunities: any[],
    batchSize: number = 50
  ): Promise<any[]> {
    const opportunities: any[] = [];

    for (let i = 0; i < requestedOpportunities.length; i += batchSize) {
      // Check for cancellation
      if (this.cancellationToken.cancelled) {
        break;
      }
      
      const batch = requestedOpportunities.slice(i, i + batchSize);
      const batchOpportunities = this.connectionWindowService.analyzeConnectionOpportunities(schedule);
      
      // Filter to only requested opportunities in this batch
      const filteredBatch = batchOpportunities.filter(opp => 
        batch.some(req => req.id === opp.id || req.locationId === opp.locationId)
      );
      
      opportunities.push(...filteredBatch);

      // Yield control to prevent blocking
      if (i % (batchSize * 2) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return opportunities;
  }
  
  /**
   * Initialize recovery bank with performance optimizations
   */
  private async initializeRecoveryBankAdvanced(
    schedule: Schedule,
    stopConfigurations: any[],
    constraints: OptimizationConstraints,
    strategy: any
  ): Promise<any> {
    const cacheKey = `recovery_bank_${schedule.id}_${stopConfigurations.length}`;
    const cached = this.cache.getCachedRecoveryBank(cacheKey);
    
    if (cached && !strategy.memoryOptimized) {
      return cached;
    }

    // Initialize with batch processing for large schedules
    const bank = this.recoveryBankService.initializeBank(
      schedule,
      stopConfigurations,
      constraints
    );

    if (!strategy.memoryOptimized) {
      this.cache.cacheRecoveryBank(cacheKey, bank);
    }
    
    return bank;
  }
  
  /**
   * Run advanced optimization with strategy adaptation
   */
  private async runAdvancedOptimization(
    request: ConnectionOptimizationRequest,
    opportunities: any[],
    recoveryBank: any,
    strategy: any,
    progressCallback: (progress: number, phase: string, connectionsMade: number) => void
  ): Promise<any> {
    // Configure optimization engine for this strategy
    this.optimizationEngine.configureProgressiveOptimization(
      strategy.memoryOptimized,
      strategy.memoryOptimized ? 200 : 1000 // Faster reporting for memory-optimized mode
    );
    
    // Set performance constraints based on strategy
    const enhancedConstraints = {
      ...request.constraints,
      performance: {
        ...request.constraints.performance,
        earlyTerminationThreshold: strategy.earlyTerminationThreshold
      }
    };
    
    return await this.optimizationEngine.optimizeConnections(
      request.schedule,
      opportunities,
      enhancedConstraints,
      (progress, phase) => {
        const currentState = this.optimizationEngine.getCurrentState();
        const connectionsMade = currentState?.appliedMoves.length || 0;
        progressCallback(progress, phase, connectionsMade);
      }
    );
  }
  
  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): {
    optimizationEngine: any;
    recoveryBank: any;
    cache: any;
    monitor: any;
    webWorkers: boolean;
  } {
    return {
      optimizationEngine: this.optimizationEngine.getPerformanceStatistics(),
      recoveryBank: this.recoveryBankService.getPerformanceStatistics(),
      cache: this.cache.getCacheStats(),
      monitor: this.performanceMonitor.getMetrics(),
      webWorkers: this.webWorkerManager.isSupported()
    };
  }
  
  /**
   * Configure performance optimization settings
   */
  configurePerformanceSettings(settings: {
    maxCacheSize?: number;
    enableWebWorkers?: boolean;
    progressiveOptimization?: boolean;
    memoryLimit?: number;
  }): void {
    if (settings.maxCacheSize) {
      // Cache size configuration would need to be added to cache classes
    }
    
    if (settings.progressiveOptimization !== undefined) {
      this.progressiveOptimizationEnabled = settings.progressiveOptimization;
    }
    
    // Additional performance configuration as needed
  }

  /**
   * Check if optimization is currently running
   */
  isOptimizationInProgress(): boolean {
    return this.isOptimizationRunning;
  }

  /**
   * Get current optimization ID
   */
  getCurrentOptimizationId(): string | null {
    return this.currentOptimizationId;
  }
}

// Export singleton instance
export const connectionOptimizationService = new ConnectionOptimizationService();
/**
 * Recovery Bank Service
 * Manages borrowing and lending of recovery time between bus stops for schedule optimization
 */

import {
  RecoveryAccount,
  RecoveryTransaction,
  RecoveryBankState,
  OptimizationConstraints
} from '../types/connectionOptimization';
import { Schedule, Trip, TimePoint } from '../types/schedule';
import { sanitizeErrorMessage } from '../utils/inputSanitizer';

/**
 * Performance cache for recovery bank calculations
 */
class RecoveryBankCache {
  private recoveryCalculationCache = new Map<string, number[]>();
  private transactionScoreCache = new Map<string, number>();
  private allocationCache = new Map<string, any>();
  private flexibilityScoreCache = new Map<string, number>();
  private maxCacheSize = 5000;

  // Cache recovery time calculations
  cacheRecoveryCalculation(stopId: string, recoveryTimes: number[]): void {
    this.manageCacheSize(this.recoveryCalculationCache);
    this.recoveryCalculationCache.set(stopId, [...recoveryTimes]);
  }

  getCachedRecoveryCalculation(stopId: string): number[] | null {
    return this.recoveryCalculationCache.get(stopId) || null;
  }

  // Cache transaction scores
  cacheTransactionScore(key: string, score: number): void {
    this.manageCacheSize(this.transactionScoreCache);
    this.transactionScoreCache.set(key, score);
  }

  getCachedTransactionScore(key: string): number | null {
    return this.transactionScoreCache.get(key) ?? null;
  }

  // Cache allocation results
  cacheAllocation(key: string, allocation: any): void {
    this.manageCacheSize(this.allocationCache);
    this.allocationCache.set(key, allocation);
  }

  getCachedAllocation(key: string): any | null {
    return this.allocationCache.get(key) || null;
  }

  // Cache flexibility scores
  cacheFlexibilityScore(stopId: string, score: number): void {
    this.manageCacheSize(this.flexibilityScoreCache);
    this.flexibilityScoreCache.set(stopId, score);
  }

  getCachedFlexibilityScore(stopId: string): number | null {
    return this.flexibilityScoreCache.get(stopId) ?? null;
  }

  private manageCacheSize(cache: Map<string, any>): void {
    if (cache.size >= this.maxCacheSize) {
      const keysToDelete = Array.from(cache.keys()).slice(0, Math.floor(this.maxCacheSize * 0.2));
      keysToDelete.forEach(key => cache.delete(key));
    }
  }

  clearAllCaches(): void {
    this.recoveryCalculationCache.clear();
    this.transactionScoreCache.clear();
    this.allocationCache.clear();
    this.flexibilityScoreCache.clear();
  }

  getCacheStats(): {
    recoveryCalculations: number;
    transactionScores: number;
    allocations: number;
    flexibilityScores: number;
  } {
    return {
      recoveryCalculations: this.recoveryCalculationCache.size,
      transactionScores: this.transactionScoreCache.size,
      allocations: this.allocationCache.size,
      flexibilityScores: this.flexibilityScoreCache.size
    };
  }
}

/**
 * Batch processor for recovery bank operations
 */
class RecoveryBatchProcessor {
  /**
   * Process multiple recovery requests in batches
   */
  async processBatchRequests(
    requests: any[],
    processor: (batch: any[]) => Promise<any[]>,
    batchSize = 20
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // Yield control periodically for large batches
      if (i % (batchSize * 5) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }

  /**
   * Process recovery accounts in parallel batches
   */
  async processAccountsBatch(
    accounts: RecoveryAccount[],
    processor: (account: RecoveryAccount) => any,
    batchSize = 10
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      const batchPromises = batch.map(account => Promise.resolve(processor(account)));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

/**
 * Recovery Bank error codes
 */
const RECOVERY_BANK_ERRORS = {
  INSUFFICIENT_CREDIT: 'RB_001',
  OVER_BORROWING_LIMIT: 'RB_002',
  INVALID_TRANSACTION: 'RB_003',
  ACCOUNT_NOT_FOUND: 'RB_004',
  CONSTRAINT_VIOLATION: 'RB_005',
  BANK_IMBALANCE: 'RB_006'
} as const;

/**
 * Recovery Bank Service for managing recovery time transactions
 */
export class RecoveryBankService {
  private bankState: RecoveryBankState | null = null;
  private transactionHistory: RecoveryTransaction[] = [];
  private constraints: OptimizationConstraints | null = null;
  
  // Performance optimization components
  private cache: RecoveryBankCache;
  private batchProcessor: RecoveryBatchProcessor;
  private operationCount = 0;
  private lastOptimizationTime = Date.now();

  /**
   * Initialize recovery bank with stop configurations
   */
  initializeBank(
    schedule: Schedule,
    stopConfigurations: Partial<RecoveryAccount>[],
    constraints: OptimizationConstraints
  ): RecoveryBankState {
    this.constraints = constraints;
    
    // Create recovery accounts for each stop
    const accounts = new Map<string, RecoveryAccount>();
    
    schedule.timePoints.forEach(timePoint => {
      const config = stopConfigurations.find(c => c.stopId === timePoint.id) || {};
      const account = this.createRecoveryAccount(timePoint, schedule, config);
      accounts.set(timePoint.id, account);
    });

    // Calculate bank totals
    let totalAvailable = 0;
    let totalBorrowed = 0;
    
    accounts.forEach(account => {
      totalAvailable += account.availableCredit;
      totalBorrowed += account.currentDebt;
    });

    this.bankState = {
      accounts,
      transactions: [],
      totalAvailableRecovery: totalAvailable,
      totalBorrowedRecovery: totalBorrowed,
      utilizationRate: totalAvailable > 0 ? totalBorrowed / totalAvailable : 0
    };

    return this.bankState;
  }

  /**
   * Calculate available recovery time at each stop based on current schedule
   */
  private createRecoveryAccount(
    timePoint: TimePoint,
    schedule: Schedule,
    config: Partial<RecoveryAccount>
  ): RecoveryAccount {
    // Analyze current recovery times at this stop across all trips
    const currentRecoveryTimes = this.analyzeCurrentRecoveryTimes(timePoint.id, schedule);
    
    // Determine stop type based on name patterns and config
    const stopType = config.stopType || this.inferStopType(timePoint.name);
    
    // Calculate flexibility based on stop type and current usage
    const flexibilityScore = this.calculateFlexibilityScore(stopType, currentRecoveryTimes);
    
    // Set recovery limits based on stop type
    const limits = this.getRecoveryLimits(stopType);
    
    const avgCurrentRecovery = currentRecoveryTimes.length > 0 
      ? currentRecoveryTimes.reduce((sum, time) => sum + time, 0) / currentRecoveryTimes.length 
      : 0;

    return {
      stopId: timePoint.id,
      stopName: timePoint.name,
      stopType,
      availableCredit: Math.max(0, avgCurrentRecovery - limits.minRecoveryTime),
      currentDebt: 0,
      maxCredit: limits.maxCredit,
      minRecoveryTime: limits.minRecoveryTime,
      maxRecoveryTime: limits.maxRecoveryTime,
      flexibilityScore,
      ...config // Override with any provided configuration
    };
  }

  constructor() {
    this.cache = new RecoveryBankCache();
    this.batchProcessor = new RecoveryBatchProcessor();
  }

  /**
   * Analyze current recovery times at a stop (with caching)
   */
  private analyzeCurrentRecoveryTimes(stopId: string, schedule: Schedule): number[] {
    // Check cache first
    const cached = this.cache.getCachedRecoveryCalculation(stopId);
    if (cached) {
      return cached;
    }

    const recoveryTimes: number[] = [];
    
    // Use batch processing for large schedules
    const batchSize = 100;
    for (let i = 0; i < schedule.trips.length; i += batchSize) {
      const batch = schedule.trips.slice(i, i + batchSize);
      
      batch.forEach(trip => {
        const recoveryTime = trip.recoveryTimes[stopId];
        if (recoveryTime !== undefined) {
          recoveryTimes.push(recoveryTime);
        }
      });
    }

    // Cache the result
    this.cache.cacheRecoveryCalculation(stopId, recoveryTimes);
    return recoveryTimes;
  }

  /**
   * Infer stop type from name patterns
   */
  private inferStopType(stopName: string): RecoveryAccount['stopType'] {
    const name = stopName.toLowerCase();
    
    if (name.includes('terminal') || name.includes('station')) return 'terminal';
    if (name.includes('school') || name.includes('collegiate') || name.includes('secondary')) return 'school';
    if (name.includes('hospital') || name.includes('medical')) return 'hospital';
    if (name.includes('mall') || name.includes('centre') || name.includes('plaza')) return 'mall';
    if (name.includes('georgian') || name.includes('college') || name.includes('university')) return 'major_stop';
    
    return 'regular';
  }

  /**
   * Calculate flexibility score for a stop (0-1, higher = more flexible) with caching
   */
  private calculateFlexibilityScore(
    stopType: RecoveryAccount['stopType'],
    currentRecoveryTimes: number[]
  ): number {
    const cacheKey = `flexibility_${stopType}_${currentRecoveryTimes.length}_${currentRecoveryTimes.join(',')}`;
    const cached = this.cache.getCachedFlexibilityScore(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Base flexibility by stop type
    const baseFlexibility: { [K in RecoveryAccount['stopType']]: number } = {
      terminal: 0.9,    // Very flexible - designed for recovery
      mall: 0.8,        // High flexibility - commercial areas
      major_stop: 0.7,  // Moderate flexibility - important but flexible
      regular: 0.6,     // Standard flexibility
      hospital: 0.4,    // Lower flexibility - time-sensitive
      school: 0.2       // Very low flexibility - strict schedules
    };

    let flexibility = baseFlexibility[stopType];

    // Adjust based on current recovery time variance (optimized calculation)
    if (currentRecoveryTimes.length > 1) {
      const variance = this.calculateVarianceOptimized(currentRecoveryTimes);
      const avgRecovery = currentRecoveryTimes.reduce((sum, time) => sum + time, 0) / currentRecoveryTimes.length;
      
      // Higher variance suggests more flexibility in recovery times
      const varianceScore = avgRecovery > 0 ? Math.min(variance / avgRecovery, 1) : 0;
      flexibility = (flexibility + varianceScore) / 2;
    }

    const finalScore = Math.max(0, Math.min(1, flexibility));
    this.cache.cacheFlexibilityScore(cacheKey, finalScore);
    return finalScore;
  }

  /**
   * Optimized variance calculation with early exit for large datasets
   */
  private calculateVarianceOptimized(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    if (numbers.length === 1) return 0;
    
    // For large datasets, sample for performance
    const sampleSize = Math.min(numbers.length, 1000);
    const sample = numbers.length > sampleSize 
      ? this.sampleArray(numbers, sampleSize)
      : numbers;
    
    const mean = sample.reduce((sum, num) => sum + num, 0) / sample.length;
    const variance = sample.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / sample.length;
    
    return variance;
  }

  /**
   * Sample an array for performance with large datasets
   */
  private sampleArray(array: number[], sampleSize: number): number[] {
    if (array.length <= sampleSize) return array;
    
    const step = Math.floor(array.length / sampleSize);
    const sample: number[] = [];
    
    for (let i = 0; i < array.length; i += step) {
      sample.push(array[i]);
      if (sample.length >= sampleSize) break;
    }
    
    return sample;
  }

  /**
   * Get recovery time limits based on stop type
   */
  private getRecoveryLimits(stopType: RecoveryAccount['stopType']): {
    minRecoveryTime: number;
    maxRecoveryTime: number;
    maxCredit: number;
  } {
    switch (stopType) {
      case 'terminal':
        return { minRecoveryTime: 2, maxRecoveryTime: 15, maxCredit: 8 };
      case 'mall':
        return { minRecoveryTime: 1, maxRecoveryTime: 10, maxCredit: 6 };
      case 'major_stop':
        return { minRecoveryTime: 1, maxRecoveryTime: 8, maxCredit: 4 };
      case 'hospital':
        return { minRecoveryTime: 2, maxRecoveryTime: 6, maxCredit: 2 };
      case 'school':
        return { minRecoveryTime: 1, maxRecoveryTime: 4, maxCredit: 1 };
      case 'regular':
      default:
        return { minRecoveryTime: 0, maxRecoveryTime: 6, maxCredit: 3 };
    }
  }

  /**
   * Calculate variance of an array of numbers (kept for backward compatibility)
   */
  private calculateVariance(numbers: number[]): number {
    return this.calculateVarianceOptimized(numbers);
  }

  /**
   * Request recovery time transfer between stops
   */
  requestRecoveryTransfer(
    fromStopId: string,
    toStopId: string,
    amount: number,
    affectedTrips: string[],
    reason: string = ''
  ): { success: boolean; transaction?: RecoveryTransaction; error?: string } {
    if (!this.bankState) {
      return { success: false, error: 'Recovery bank not initialized' };
    }

    const fromAccount = this.bankState.accounts.get(fromStopId);
    const toAccount = this.bankState.accounts.get(toStopId);

    if (!fromAccount) {
      return { success: false, error: `Account not found for stop ${fromStopId}` };
    }

    if (!toAccount) {
      return { success: false, error: `Account not found for stop ${toStopId}` };
    }

    // Validate transaction constraints
    const validation = this.validateTransaction(fromAccount, toAccount, amount);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Calculate transaction score
    const score = this.calculateTransactionScore(fromAccount, toAccount, amount);

    // Create transaction
    const transaction: RecoveryTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lenderStopId: fromStopId,
      borrowerStopId: toStopId,
      amount,
      affectedTrips,
      score,
      type: 'borrow'
    };

    // Apply transaction
    fromAccount.availableCredit -= amount;
    toAccount.currentDebt += amount;

    // Update bank state
    this.bankState.transactions.push(transaction);
    this.bankState.totalBorrowedRecovery += amount;
    this.bankState.utilizationRate = this.bankState.totalAvailableRecovery > 0 
      ? this.bankState.totalBorrowedRecovery / this.bankState.totalAvailableRecovery 
      : 0;

    // Add to transaction history
    this.transactionHistory.push(transaction);

    return { success: true, transaction };
  }

  /**
   * Validate a recovery time transaction
   */
  private validateTransaction(
    fromAccount: RecoveryAccount,
    toAccount: RecoveryAccount,
    amount: number
  ): { isValid: boolean; error?: string } {
    // Check if lender has enough credit
    if (fromAccount.availableCredit < amount) {
      return { 
        isValid: false, 
        error: `Insufficient credit: ${fromAccount.stopName} has ${fromAccount.availableCredit}min, requested ${amount}min` 
      };
    }

    // Check if borrower would exceed maximum recovery
    const newRecoveryTime = toAccount.currentDebt + amount;
    if (newRecoveryTime > toAccount.maxRecoveryTime) {
      return { 
        isValid: false, 
        error: `Borrower would exceed max recovery: ${toAccount.stopName} max=${toAccount.maxRecoveryTime}min` 
      };
    }

    // Check constraints if available
    if (this.constraints) {
      if (amount > this.constraints.maxTripDeviation) {
        return {
          isValid: false,
          error: `Transaction amount ${amount}min exceeds max deviation ${this.constraints.maxTripDeviation}min`
        };
      }
    }

    // Check borrowing ratio limits
    const borrowingRatio = fromAccount.currentDebt / Math.max(fromAccount.maxCredit, 1);
    if (borrowingRatio > 0.8) { // Don't allow high-debt accounts to lend
      return {
        isValid: false,
        error: `Lender has high debt ratio: ${Math.round(borrowingRatio * 100)}%`
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate score for a recovery transaction (with caching)
   */
  private calculateTransactionScore(
    fromAccount: RecoveryAccount,
    toAccount: RecoveryAccount,
    amount: number
  ): number {
    const cacheKey = `transaction_score_${fromAccount.stopId}_${toAccount.stopId}_${amount}_${fromAccount.currentDebt}_${toAccount.currentDebt}`;
    const cached = this.cache.getCachedTransactionScore(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Base score factors (optimized calculations)
    const lenderFlexibility = fromAccount.flexibilityScore;
    const borrowerNeed = 1 - toAccount.flexibilityScore;
    const amountFactor = Math.min(amount / 5, 1);
    
    // Efficiency factors (avoiding division by zero with bitwise operations where possible)
    const lenderUtilization = fromAccount.maxCredit > 0 ? fromAccount.currentDebt / fromAccount.maxCredit : 0;
    const borrowerUtilization = toAccount.maxRecoveryTime > 0 ? toAccount.currentDebt / toAccount.maxRecoveryTime : 0;
    
    // Distance penalty (could be enhanced with memoized distance calculations)
    const distancePenalty = this.calculateDistancePenalty(fromAccount.stopId, toAccount.stopId);
    
    // Calculate weighted score with optimized weights
    const score = (
      lenderFlexibility * 0.3 +
      borrowerNeed * 0.3 +
      amountFactor * 0.2 +
      (1 - lenderUtilization) * 0.1 +
      (1 - borrowerUtilization) * 0.1
    ) * distancePenalty;

    const finalScore = Math.max(0, Math.min(1, score));
    this.cache.cacheTransactionScore(cacheKey, finalScore);
    return finalScore;
  }

  /**
   * Calculate distance penalty between stops (with caching)
   */
  private calculateDistancePenalty(fromStopId: string, toStopId: string): number {
    if (fromStopId === toStopId) return 1.0;
    
    // Simple penalty based on stop ID similarity (in real implementation, use actual distances)
    const similarity = this.calculateStopIdSimilarity(fromStopId, toStopId);
    return Math.max(0.8, 1 - (similarity * 0.2)); // 0.8 to 1.0 range
  }

  /**
   * Calculate simple similarity between stop IDs as distance proxy
   */
  private calculateStopIdSimilarity(stopId1: string, stopId2: string): number {
    const len1 = stopId1.length;
    const len2 = stopId2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (stopId1[i] === stopId2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  /**
   * Find optimal recovery allocation for multiple requests (with batching and caching)
   */
  async findOptimalAllocation(
    requests: {
      fromStopId?: string;
      toStopId: string;
      amount: number;
      priority: number;
      affectedTrips: string[];
    }[]
  ): Promise<{
    success: boolean;
    allocations: RecoveryTransaction[];
    totalScore: number;
    unmetRequests: typeof requests;
  }> {
    // Cache key for allocation results
    const cacheKey = `allocation_${JSON.stringify(requests).slice(0, 200)}`;
    const cached = this.cache.getCachedAllocation(cacheKey);
    if (cached) {
      return cached;
    }
    if (!this.bankState) {
      const failureResult = { 
        success: false, 
        allocations: [], 
        totalScore: 0, 
        unmetRequests: requests 
      };
      this.cache.cacheAllocation(cacheKey, failureResult);
      return failureResult;
    }

    // Sort requests by priority (with performance optimization for large arrays)
    const sortedRequests = this.efficientSort([...requests], (a, b) => b.priority - a.priority);
    const allocations: RecoveryTransaction[] = [];
    const unmetRequests: typeof requests = [];
    let totalScore = 0;

    // Process requests in batches for better performance
    const batchResults = await this.batchProcessor.processBatchRequests(
      sortedRequests,
      async (batch) => {
        const batchAllocations: RecoveryTransaction[] = [];
        const batchUnmet: typeof requests = [];
        let batchScore = 0;
        
        for (const request of batch) {
          // Find best lender for this request with caching
          const bestAllocation = await this.findBestLenderForRequestCached(request);
          
          if (bestAllocation.success && bestAllocation.transaction) {
            // Apply the transaction
            const result = this.requestRecoveryTransfer(
              bestAllocation.transaction.lenderStopId,
              bestAllocation.transaction.borrowerStopId,
              bestAllocation.transaction.amount,
              bestAllocation.transaction.affectedTrips
            );

            if (result.success && result.transaction) {
              batchAllocations.push(result.transaction);
              batchScore += result.transaction.score;
            } else {
              batchUnmet.push(request);
            }
          } else {
            batchUnmet.push(request);
          }
        }
        
        return [{ allocations: batchAllocations, unmet: batchUnmet, score: batchScore }];
      },
      10 // Smaller batches for recovery allocations
    );

    // Combine batch results
    batchResults.forEach(batchResult => {
      allocations.push(...batchResult.allocations);
      unmetRequests.push(...batchResult.unmet);
      totalScore += batchResult.score;
    });

    const result = {
      success: unmetRequests.length < requests.length,
      allocations,
      totalScore,
      unmetRequests
    };
    
    this.cache.cacheAllocation(cacheKey, result);
    return result;
  }

  /**
   * Efficient sorting for large arrays
   */
  private efficientSort<T>(array: T[], compareFn: (a: T, b: T) => number): T[] {
    // Use native sort for small arrays, optimized algorithm for large ones
    if (array.length < 1000) {
      return array.sort(compareFn);
    }
    
    // For large arrays, use a more memory-efficient approach
    return this.quickSortOptimized(array, compareFn);
  }

  /**
   * Memory-efficient quicksort for large datasets
   */
  private quickSortOptimized<T>(array: T[], compareFn: (a: T, b: T) => number): T[] {
    if (array.length <= 1) return array;
    
    const pivot = array[Math.floor(array.length / 2)];
    const left: T[] = [];
    const right: T[] = [];
    
    for (let i = 0; i < array.length; i++) {
      if (i === Math.floor(array.length / 2)) continue;
      
      if (compareFn(array[i], pivot) < 0) {
        left.push(array[i]);
      } else {
        right.push(array[i]);
      }
    }
    
    return [
      ...this.quickSortOptimized(left, compareFn),
      pivot,
      ...this.quickSortOptimized(right, compareFn)
    ];
  }

  /**
   * Find best lender for a specific recovery request (cached version)
   */
  private async findBestLenderForRequestCached(request: {
    fromStopId?: string;
    toStopId: string;
    amount: number;
    priority: number;
    affectedTrips: string[];
  }): Promise<{ success: boolean; transaction?: RecoveryTransaction }> {
    const cacheKey = `best_lender_${request.toStopId}_${request.amount}_${request.priority}`;
    const cached = this.cache.getCachedAllocation(cacheKey);
    if (cached) {
      return cached;
    }
    
    const result = this.findBestLenderForRequest(request);
    this.cache.cacheAllocation(cacheKey, result);
    return result;
  }

  /**
   * Find best lender for a specific recovery request
   */
  private findBestLenderForRequest(request: {
    fromStopId?: string;
    toStopId: string;
    amount: number;
    priority: number;
    affectedTrips: string[];
  }): { success: boolean; transaction?: RecoveryTransaction } {
    if (!this.bankState) {
      return { success: false };
    }

    let bestScore: number = -1;
    let bestLender: RecoveryAccount | null = null;

    // If specific lender requested, try that first
    if (request.fromStopId) {
      // Prevent self-lending
      if (request.fromStopId === request.toStopId) {
        return { success: false };
      }
      
      const specifiedLender = this.bankState.accounts.get(request.fromStopId);
      if (specifiedLender) {
        const borrower = this.bankState.accounts.get(request.toStopId);
        if (borrower) {
          const validation = this.validateTransaction(specifiedLender, borrower, request.amount);
          if (validation.isValid) {
            const score = this.calculateTransactionScore(specifiedLender, borrower, request.amount);
            return {
              success: true,
              transaction: {
                id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                lenderStopId: specifiedLender.stopId,
                borrowerStopId: borrower.stopId,
                amount: request.amount,
                affectedTrips: request.affectedTrips,
                score,
                type: 'borrow'
              }
            };
          }
        }
      }
    }

    // Otherwise, find best available lender using optimized search
    const borrower: RecoveryAccount | undefined = this.bankState.accounts.get(request.toStopId);
    if (!borrower) {
      return { success: false };
    }

    // Convert to array for efficient processing
    const lenders = Array.from(this.bankState.accounts.values());
    
    // Filter valid lenders first to avoid unnecessary calculations
    const validLenders = lenders.filter(lender => {
      if (lender.stopId === request.toStopId) return false; // Can't lend to self
      return this.validateTransaction(lender, borrower, request.amount).isValid;
    });
    
    // Find best lender with optimized scoring
    for (const lender of validLenders) {
      const score = this.calculateTransactionScore(lender, borrower, request.amount) * request.priority / 10;
      if (score > bestScore) {
        bestScore = score;
        bestLender = lender;
      }
    }

    if (bestLender !== null && borrower) {
      const lenderStopId = (bestLender as any).stopId;
      const borrowerStopId = (borrower as any).stopId;
      
      const transaction: RecoveryTransaction = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        lenderStopId,
        borrowerStopId,
        amount: request.amount,
        affectedTrips: request.affectedTrips,
        score: bestScore,
        type: 'borrow'
      };
      
      return {
        success: true,
        transaction
      };
    }

    return { success: false };
  }

  /**
   * Rollback a recovery transaction
   */
  rollbackTransaction(transactionId: string): { success: boolean; error?: string } {
    if (!this.bankState) {
      return { success: false, error: 'Recovery bank not initialized' };
    }

    const transactionIndex = this.bankState.transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) {
      return { success: false, error: 'Transaction not found' };
    }

    const transaction = this.bankState.transactions[transactionIndex];
    
    // Get accounts
    const lender = this.bankState.accounts.get(transaction.lenderStopId);
    const borrower = this.bankState.accounts.get(transaction.borrowerStopId);

    if (!lender || !borrower) {
      return { success: false, error: 'Account(s) not found for rollback' };
    }

    // Reverse the transaction
    lender.availableCredit += transaction.amount;
    borrower.currentDebt -= transaction.amount;

    // Update bank state
    this.bankState.totalBorrowedRecovery -= transaction.amount;
    this.bankState.utilizationRate = this.bankState.totalAvailableRecovery > 0 
      ? this.bankState.totalBorrowedRecovery / this.bankState.totalAvailableRecovery 
      : 0;

    // Remove transaction
    this.bankState.transactions.splice(transactionIndex, 1);

    return { success: true };
  }

  /**
   * Get current bank state
   */
  getBankState(): RecoveryBankState | null {
    return this.bankState;
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(): RecoveryTransaction[] {
    return [...this.transactionHistory];
  }

  /**
   * Reset bank to initial state
   */
  resetBank(): void {
    if (this.bankState) {
      // Rollback all transactions
      const transactionIds = this.bankState.transactions.map(t => t.id);
      transactionIds.forEach(id => this.rollbackTransaction(id));
    }
  }

  /**
   * Generate bank utilization report
   */
  generateUtilizationReport(): {
    totalAccounts: number;
    totalAvailableCredit: number;
    totalOutstandingDebt: number;
    utilizationRate: number;
    accountDetails: {
      stopId: string;
      stopName: string;
      stopType: string;
      creditUsed: number;
      creditAvailable: number;
      currentDebt: number;
      flexibilityScore: number;
    }[];
    topLenders: { stopId: string; stopName: string; amountLent: number }[];
    topBorrowers: { stopId: string; stopName: string; amountBorrowed: number }[];
  } {
    if (!this.bankState) {
      return {
        totalAccounts: 0,
        totalAvailableCredit: 0,
        totalOutstandingDebt: 0,
        utilizationRate: 0,
        accountDetails: [],
        topLenders: [],
        topBorrowers: []
      };
    }

    const accountDetails: any[] = [];
    const lenders: { stopId: string; stopName: string; amountLent: number }[] = [];
    const borrowers: { stopId: string; stopName: string; amountBorrowed: number }[] = [];

    this.bankState.accounts.forEach(account => {
      // Calculate amount lent (original credit - current credit)
      const originalCredit = account.maxCredit; // Approximation
      const amountLent = Math.max(0, originalCredit - account.availableCredit);
      
      accountDetails.push({
        stopId: account.stopId,
        stopName: account.stopName,
        stopType: account.stopType,
        creditUsed: amountLent,
        creditAvailable: account.availableCredit,
        currentDebt: account.currentDebt,
        flexibilityScore: account.flexibilityScore
      });

      if (amountLent > 0) {
        lenders.push({
          stopId: account.stopId,
          stopName: account.stopName,
          amountLent
        });
      }

      if (account.currentDebt > 0) {
        borrowers.push({
          stopId: account.stopId,
          stopName: account.stopName,
          amountBorrowed: account.currentDebt
        });
      }
    });

    // Sort by amount
    lenders.sort((a, b) => b.amountLent - a.amountLent);
    borrowers.sort((a, b) => b.amountBorrowed - a.amountBorrowed);

    return {
      totalAccounts: this.bankState.accounts.size,
      totalAvailableCredit: this.bankState.totalAvailableRecovery,
      totalOutstandingDebt: this.bankState.totalBorrowedRecovery,
      utilizationRate: this.bankState.utilizationRate,
      accountDetails,
      topLenders: lenders.slice(0, 5),
      topBorrowers: borrowers.slice(0, 5)
    };
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStatistics(): {
    operationCount: number;
    cacheStats: any;
    lastOptimizationTime: number;
    averageOperationTime: number;
  } {
    const now = Date.now();
    const timeSinceLastOptimization = now - this.lastOptimizationTime;
    const averageOperationTime = this.operationCount > 0 ? timeSinceLastOptimization / this.operationCount : 0;
    
    return {
      operationCount: this.operationCount,
      cacheStats: this.cache.getCacheStats(),
      lastOptimizationTime: this.lastOptimizationTime,
      averageOperationTime
    };
  }
  
  /**
   * Clear all caches and reset performance counters
   */
  clearCachesAndReset(): void {
    this.cache.clearAllCaches();
    this.operationCount = 0;
    this.lastOptimizationTime = Date.now();
  }
  
  /**
   * Batch process multiple recovery operations
   */
  async batchProcessRecoveryOperations(
    operations: Array<{
      type: 'transfer' | 'allocation' | 'validation';
      data: any;
    }>
  ): Promise<any[]> {
    return this.batchProcessor.processBatchRequests(
      operations,
      async (batch) => {
        return batch.map(op => {
          this.operationCount++;
          switch (op.type) {
            case 'transfer':
              return this.requestRecoveryTransfer(
                op.data.fromStopId,
                op.data.toStopId,
                op.data.amount,
                op.data.affectedTrips,
                op.data.reason
              );
            case 'allocation':
              return this.findOptimalAllocation(op.data.requests);
            case 'validation':
              return this.validateTransaction(op.data.fromAccount, op.data.toAccount, op.data.amount);
            default:
              return { success: false, error: 'Unknown operation type' };
          }
        });
      },
      15
    );
  }
}

export const recoveryBankService = new RecoveryBankService();
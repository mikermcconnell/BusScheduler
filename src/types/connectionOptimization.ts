/**
 * Connection Optimization Types
 * Advanced bus schedule optimization system with Recovery Bank and constraint solving
 */

import { Schedule, Trip, TimePoint } from './schedule';

/**
 * Connection types for schedule coordination
 */
export enum ConnectionType {
  BUS_ROUTE = 'BUS_ROUTE',
  GO_TRAIN = 'GO_TRAIN', 
  SCHOOL_BELL = 'SCHOOL_BELL'
}

/**
 * Connection point types for different service categories
 */
export type ConnectionPointType = 
  | 'college-arrival'     // Students arriving at college
  | 'college-departure'   // Students departing from college
  | 'go-train'           // GO Train connections
  | 'high-school';       // High school bell times

/**
 * Day types supported by the system
 */
export type DayType = 'weekday' | 'saturday' | 'sunday';

/**
 * Connection status for optimization validation
 */
export type ConnectionStatus = 'ideal' | 'partial' | 'missed' | 'pending';

/**
 * Connection point interface for bus schedule optimization
 */
export interface ConnectionPoint {
  /** Unique connection point identifier */
  id: string;
  /** Display name for this connection */
  name: string;
  /** Type of connection service */
  type: ConnectionPointType;
  /** Reference to the timepoint where connection occurs */
  timepointId: string;
  /** Display name of the timepoint */
  timepointName: string;
  /** Priority level (1-10, 10 being highest priority) */
  priority: number;
  /** Target schedule times for this connection */
  scheduleTimes: {
    /** Target arrival time in HH:MM format */
    arrivalTime?: string;
    /** Target departure time in HH:MM format */
    departureTime?: string;
    /** Frequency in minutes (for recurring connections) */
    frequency?: number;
    /** Time window tolerance in minutes */
    tolerance?: number;
  };
  /** Days when this connection is active */
  dayTypes: DayType[];
  /** Connection time windows for optimization */
  connectionWindows: {
    /** Ideal connection window (10-15 min typical) */
    ideal: { min: number; max: number };
    /** Partial connection window (5-20 min typical) */
    partial: { min: number; max: number };
    /** Missed connection threshold (>20 min) */
    missed: { threshold: number };
  };
  /** Additional metadata */
  metadata?: {
    /** Service provider name */
    serviceName?: string;
    /** Building or location details */
    locationDetails?: string;
    /** Special requirements or notes */
    notes?: string;
    /** Seasonal variations */
    seasonalSchedule?: boolean;
  };
}

/**
 * Connection validation result for a specific connection point
 */
export interface ConnectionValidation {
  /** Connection point being validated */
  connectionPointId: string;
  /** Current validation status */
  status: ConnectionStatus;
  /** Actual connection time achieved (minutes) */
  actualConnectionTime?: number;
  /** Bus trips affected by this connection */
  affectedTripIds: string[];
  /** Validation message or explanation */
  message?: string;
  /** Score achieved for this connection (0-1) */
  score: number;
  /** Recommended adjustments */
  recommendations?: string[];
}

/**
 * Optimization parameters for connection solving
 */
export interface OptimizationParameters {
  /** Maximum time adjustment allowed per trip (minutes) */
  maxTripAdjustment: number;
  /** Maximum total schedule shift (minutes) */
  maxScheduleShift: number;
  /** Minimum recovery time at any stop (minutes) */
  minRecoveryTime: number;
  /** Maximum recovery time at any stop (minutes) */
  maxRecoveryTime: number;
  /** Weight given to connection priorities (0-1) */
  priorityWeight: number;
  /** Weight given to headway regularity (0-1) */
  headwayWeight: number;
  /** Weight given to recovery time efficiency (0-1) */
  recoveryWeight: number;
  /** Maximum optimization iterations */
  maxIterations: number;
  /** Convergence threshold for stopping optimization */
  convergenceThreshold: number;
  /** Enable aggressive optimization techniques */
  enableAggressiveOptimization: boolean;
}

/**
 * Optimization results for connection solving
 */
export interface OptimizationResults {
  /** Whether optimization completed successfully */
  success: boolean;
  /** Optimized schedule */
  optimizedSchedule: Schedule;
  /** Connection validations for all connection points */
  connectionValidations: ConnectionValidation[];
  /** Overall optimization score (0-1) */
  overallScore: number;
  /** Score improvement from original schedule */
  scoreImprovement: number;
  /** Number of connections successfully made */
  connectionsAchieved: number;
  /** Total number of connection attempts */
  totalConnectionAttempts: number;
  /** Optimization statistics */
  statistics: {
    /** Processing time in milliseconds */
    processingTimeMs: number;
    /** Memory usage in MB */
    memoryUsageMB: number;
    /** Number of iterations completed */
    iterationsCompleted: number;
    /** Convergence achieved flag */
    converged: boolean;
  };
  /** Warnings and recommendations */
  warnings: string[];
  /** Error message if optimization failed */
  error?: string;
}

/**
 * Connection window definitions for different service types
 */
export interface ConnectionWindow {
  /** Type of connection service */
  type: ConnectionType;
  /** Ideal connection time range in minutes */
  ideal: { min: number; max: number };
  /** Partial connection time range in minutes */
  partial: { min: number; max: number };
  /** Window multipliers for scoring */
  multipliers: {
    ideal: number;    // 1.0
    partial: number;  // 0.5
    missed: number;   // 0.0
  };
}

/**
 * Connection opportunity at a specific time and location
 */
export interface ConnectionOpportunity {
  /** Unique opportunity identifier */
  id: string;
  /** Connection type */
  type: ConnectionType;
  /** Location where connection occurs */
  locationId: string;
  /** Target service schedule (train time, class time, etc.) */
  targetTime: string;
  /** Priority level (1-10, 10 being highest) */
  priority: number;
  /** Time window classification */
  windowType: 'ideal' | 'partial' | 'missed';
  /** Current connection time if bus continues on schedule */
  currentConnectionTime?: number;
  /** Affected bus trips */
  affectedTrips: string[];
  /** Days of operation */
  operatingDays: string[];
  /** Additional metadata */
  metadata: {
    serviceName: string;
    description: string;
    frequency?: number; // for recurring connections
  };
}

/**
 * Recovery Bank System - manages borrowing/lending of recovery time
 */
export interface RecoveryAccount {
  /** Stop/timepoint identifier */
  stopId: string;
  /** Stop name */
  stopName: string;
  /** Stop type affecting lending capacity */
  stopType: 'terminal' | 'major_stop' | 'school' | 'hospital' | 'mall' | 'regular';
  /** Available recovery time to lend (minutes) */
  availableCredit: number;
  /** Current borrowed recovery time (minutes) */
  currentDebt: number;
  /** Maximum recovery time this stop can lend */
  maxCredit: number;
  /** Minimum recovery time this stop must maintain */
  minRecoveryTime: number;
  /** Maximum recovery time this stop can hold */
  maxRecoveryTime: number;
  /** Flexibility score (0-1, higher = more flexible for time adjustments) */
  flexibilityScore: number;
}

/**
 * Recovery time transaction between stops
 */
export interface RecoveryTransaction {
  /** Transaction identifier */
  id: string;
  /** Stop lending recovery time */
  lenderStopId: string;
  /** Stop borrowing recovery time */
  borrowerStopId: string;
  /** Amount of recovery time transferred (minutes) */
  amount: number;
  /** Trips affected by this transaction */
  affectedTrips: string[];
  /** Cost/benefit score of this transaction */
  score: number;
  /** Transaction type */
  type: 'borrow' | 'repay' | 'transfer';
}

/**
 * Recovery Bank state for optimization
 */
export interface RecoveryBankState {
  /** All recovery accounts indexed by stop ID */
  accounts: Map<string, RecoveryAccount>;
  /** Active transactions */
  transactions: RecoveryTransaction[];
  /** Total available recovery time in the system */
  totalAvailableRecovery: number;
  /** Total borrowed recovery time */
  totalBorrowedRecovery: number;
  /** Bank utilization rate (0-1) */
  utilizationRate: number;
}

/**
 * Headway deviation tracking and correction
 */
export interface HeadwayDeviation {
  /** Trip identifier */
  tripId: string;
  /** Planned headway (minutes) */
  plannedHeadway: number;
  /** Current headway after optimization */
  currentHeadway: number;
  /** Deviation from planned (positive = late, negative = early) */
  deviation: number;
  /** Number of subsequent trips for correction */
  correctionTrips: number;
  /** Correction rate per trip (0-1) */
  correctionRate: number;
}

/**
 * Headway self-correction strategy
 */
export interface HeadwayCorrection {
  /** Correction strategy identifier */
  strategyId: string;
  /** Target headway in minutes */
  targetHeadway: number;
  /** Maximum allowable deviation before correction */
  maxDeviationThreshold: number;
  /** Number of trips over which to apply correction */
  correctionHorizon: number;
  /** Correction strength (0-1, higher = more aggressive correction) */
  correctionStrength: number;
  /** Whether to apply correction forward, backward, or both */
  correctionDirection: 'forward' | 'backward' | 'bidirectional';
}

/**
 * Optimization constraint definitions
 */
export interface OptimizationConstraints {
  /** Maximum time deviation allowed per trip (minutes) */
  maxTripDeviation: number;
  /** Maximum recovery time deviation allowed (minutes) */
  maxRecoveryDeviation?: number;
  /** Maximum allowed headway deviation (minutes) */
  allowedHeadwayDeviation?: number;
  /** Maximum total schedule shift (minutes) */
  maxScheduleShift: number;
  /** Minimum recovery time at any stop (minutes) */
  minRecoveryTime: number;
  /** Maximum recovery time at any stop (minutes) */
  maxRecoveryTime: number;
  /** Whether headway regularity is enforced */
  enforceHeadwayRegularity: boolean;
  /** Headway tolerance (±minutes) */
  headwayTolerance: number;
  /** Priority weighting for different connection types */
  connectionPriorities: {
    [ConnectionType.BUS_ROUTE]: number;
    [ConnectionType.GO_TRAIN]: number;
    [ConnectionType.SCHOOL_BELL]: number;
  };
  /** Whether to allow recovery borrowing across routes */
  allowCrossRouteBorrowing: boolean;
  /** Performance limits */
  performance: {
    maxOptimizationTimeMs: number;
    maxMemoryUsageMB: number;
    earlyTerminationThreshold: number; // stop when improvement rate drops below this
  };
}

/**
 * Single optimization move/adjustment
 */
export interface OptimizationMove {
  /** Move identifier */
  id: string;
  /** Type of optimization move */
  type: 'time_shift' | 'recovery_transfer' | 'headway_adjust' | 'connection_align';
  /** Target connection opportunity */
  targetConnection: ConnectionOpportunity;
  /** Required time adjustment (minutes, positive = later) */
  timeAdjustment: number;
  /** Recovery transactions required for this move */
  requiredTransactions: RecoveryTransaction[];
  /** Trips affected by this move */
  affectedTrips: string[];
  /** Score improvement from this move */
  scoreImprovement: number;
  /** Constraint violations (empty if valid) */
  constraintViolations: string[];
  /** Estimated impact on headways */
  headwayImpact: {
    tripId: string;
    currentHeadway: number;
    newHeadway: number;
    deviation: number;
  }[];
}

/**
 * Optimization state during processing
 */
export interface OptimizationState {
  /** Current schedule being optimized */
  currentSchedule: Schedule;
  /** Current recovery bank state */
  recoveryBank: RecoveryBankState;
  /** Current optimization score */
  currentScore: number;
  /** Applied optimization moves */
  appliedMoves: OptimizationMove[];
  /** Rejected moves with reasons */
  rejectedMoves: { move: OptimizationMove; reason: string }[];
  /** Current headway deviations */
  headwayDeviations: HeadwayDeviation[];
  /** Optimization progress (0-1) */
  progress: number;
  /** Processing start time */
  startTime: Date;
}

/**
 * Connection optimization request parameters
 */
export interface ConnectionOptimizationRequest {
  /** Schedule to optimize */
  schedule: Schedule;
  /** Connection opportunities to optimize for */
  connectionOpportunities: ConnectionOpportunity[];
  /** Connection window definitions */
  connectionWindows: Map<ConnectionType, ConnectionWindow>;
  /** Optimization constraints */
  constraints: OptimizationConstraints;
  /** Recovery bank configuration */
  recoveryBankConfig: {
    stopConfigurations: RecoveryAccount[];
    allowBorrowing: boolean;
    maxBorrowingRatio: number; // max debt/credit ratio
  };
  /** Headway correction settings */
  headwayCorrection: HeadwayCorrection;
  /** Optimization options */
  options: {
    maxIterations: number;
    convergenceThreshold: number;
    enableProgressiveOptimization: boolean;
    enableParallelProcessing: boolean;
  };
}

/**
 * Connection optimization result
 */
export interface ConnectionOptimizationResult {
  /** Whether optimization succeeded */
  success: boolean;
  /** Optimized schedule */
  optimizedSchedule: Schedule;
  /** Original schedule for comparison */
  originalSchedule?: Schedule;
  /** Final optimization score */
  finalScore: number;
  /** Overall score (alias for finalScore) */
  score: number;
  /** Score improvement from original */
  scoreImprovement: number;
  /** Successfully connected opportunities */
  successfulConnections: ConnectionOpportunity[];
  /** Connections satisfied count */
  connectionsSatisfied?: number;
  /** Connections improved count */
  connectionsImproved: number;
  /** Failed connection attempts */
  failedConnections: { opportunity: ConnectionOpportunity; reason: string }[];
  /** Applied optimization moves */
  appliedMoves: OptimizationMove[];
  /** Schedule adjustments made */
  adjustments?: OptimizationMove[];
  /** Final recovery bank state */
  finalRecoveryState: RecoveryBankState;
  /** Headway corrections applied */
  headwayCorrections: HeadwayDeviation[];
  /** Optimization statistics */
  statistics: {
    totalConnectionsAnalyzed: number;
    totalMovesEvaluated: number;
    totalMovesApplied: number;
    optimizationTimeMs: number;
    memoryUsedMB: number;
    iterationsCompleted: number;
    convergenceAchieved: boolean;
  };
  /** Performance metrics */
  performance: {
    connectionSuccessRate: number; // percentage of connections made
    averageConnectionTime: number; // minutes
    headwayRegularityScore: number; // 0-1, higher = more regular
    recoveryUtilizationRate: number; // percentage of recovery time used
    constraintComplianceRate: number; // percentage of constraints satisfied
  };
  /** Additional metadata */
  metadata?: {
    processingTimeMs: number;
    memoryUsedMB: number;
    [key: string]: any;
  };
  /** Recommendations for further optimization */
  recommendations: string[];
  /** Warnings or issues encountered */
  warnings: string[];
  /** Error details if optimization failed */
  error?: string;
}

/**
 * Connection optimization report for analysis
 */
export interface OptimizationReport {
  /** Optimization request summary */
  requestSummary: {
    scheduleId: string;
    routeName: string;
    tripCount: number;
    connectionCount: number;
    optimizationDate: Date;
  };
  /** Before/after comparison */
  comparison: {
    before: {
      connectionsMade: number;
      averageConnectionTime: number;
      headwayRegularity: number;
      totalRecoveryTime: number;
    };
    after: {
      connectionsMade: number;
      averageConnectionTime: number;
      headwayRegularity: number;
      totalRecoveryTime: number;
    };
    improvement: {
      additionalConnections: number;
      connectionTimeImprovement: number;
      headwayRegularityImprovement: number;
      recoveryTimeEfficiency: number;
    };
  };
  /** Detailed connection analysis */
  connectionAnalysis: {
    byType: Map<ConnectionType, {
      attempted: number;
      successful: number;
      averageScore: number;
    }>;
    byPriority: Map<number, {
      attempted: number;
      successful: number;
      averageScore: number;
    }>;
    timeDistribution: Map<string, number>; // hour -> connection count
  };
  /** Recovery bank utilization */
  recoveryAnalysis: {
    totalRecoveryAvailable: number;
    totalRecoveryUsed: number;
    utilizationRate: number;
    topLenders: { stopId: string; amountLent: number }[];
    topBorrowers: { stopId: string; amountBorrowed: number }[];
  };
  /** Recommendations for schedule improvements */
  recommendations: {
    scheduleAdjustments: string[];
    recoveryTimeAdjustments: string[];
    connectionOpportunities: string[];
    performanceImprovements: string[];
  };
}

/**
 * Optimization progress callback for long-running optimizations
 */
export interface OptimizationProgress {
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current phase description */
  phase: string;
  /** Current optimization score */
  currentScore: number;
  /** Best score achieved so far */
  bestScore: number;
  /** Number of connections made so far */
  connectionsMade: number;
  /** Estimated time remaining (ms) */
  estimatedTimeRemainingMs: number;
  /** Current memory usage (MB) */
  memoryUsageMB: number;
  /** Whether optimization can be cancelled */
  canCancel: boolean;
}

/**
 * Georgian College specific connection configuration
 */
export interface GeorgianCollegeConfig {
  /** Class start times (on the hour) */
  classStartTimes: string[];
  /** Class end times (typically :50) */
  classEndTimes: string[];
  /** Campus locations */
  campusStops: string[];
  /** Semester-specific schedules */
  semesterSchedule: {
    startDate: Date;
    endDate: Date;
    operatingDays: string[];
    specialDates: { date: Date; description: string; alternate?: boolean }[];
  };
  /** Priority weighting for different class times */
  classPriorities: Map<string, number>;
}

/**
 * GO Train specific connection configuration
 */
export interface GOTrainConfig {
  /** GO Train schedule data */
  trainSchedules: {
    direction: 'northbound' | 'southbound';
    stationId: string;
    departureTimes: string[];
    arrivalTimes: string[];
    serviceType: 'express' | 'local' | 'limited';
    operatingDays: string[];
  }[];
  /** Station stop configurations */
  stationStops: {
    stationId: string;
    busStopId: string;
    walkingTime: number; // minutes from bus stop to train platform
    platformCapacity: number;
  }[];
  /** Seasonal schedule variations */
  seasonalSchedules: {
    season: 'winter' | 'spring' | 'summer' | 'fall';
    effectiveDate: Date;
    scheduleModifications: any[];
  }[];
}

/**
 * High School specific connection configuration
 */
export interface HighSchoolConfig {
  /** School identifiers and locations */
  schools: {
    schoolId: string;
    schoolName: string;
    busStopIds: string[];
    bellSchedule: {
      startTime: string;
      endTime: string;
      lunchStart?: string;
      lunchEnd?: string;
    };
    studentCapacity: number;
    priorityLevel: number; // 1-10
  }[];
  /** Special schedule days */
  specialSchedules: {
    date: Date;
    scheduleType: 'early_dismissal' | 'late_start' | 'no_school';
    alternateSchedule?: any;
  }[];
  /** Transportation requirements */
  transportationRequirements: {
    maxWaitTime: number;
    minConnectionTime: number;
    capacityConstraints: boolean;
  };
}
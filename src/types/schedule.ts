/**
 * Represents a time point (bus stop) in the route
 */
export interface TimePoint {
  /** Unique identifier for the time point */
  id: string;
  /** Display name of the time point/bus stop */
  name: string;
  /** Order sequence in the route (1-based) */
  sequence: number;
}

/**
 * Represents travel time between two time points
 */
export interface TravelTime {
  /** Starting time point ID */
  fromTimePoint: string;
  /** Destination time point ID */
  toTimePoint: string;
  /** Travel time in minutes for weekdays */
  weekday: number;
  /** Travel time in minutes for Saturdays */
  saturday: number;
  /** Travel time in minutes for Sundays */
  sunday: number;
}

/**
 * Represents a schedule entry with arrival/departure times
 */
export interface ScheduleEntry {
  /** Time point ID */
  timePointId: string;
  /** Arrival time in HH:MM format */
  arrivalTime: string;
  /** Departure time in HH:MM format */
  departureTime: string;
  /** Recovery time in minutes (bus waits at this timepoint) */
  recoveryTime?: number;
}

/**
 * Represents a complete trip schedule
 */
export interface TripSchedule {
  /** Unique trip identifier */
  tripId: string;
  /** Array of schedule entries for each time point */
  scheduleEntries: ScheduleEntry[];
}

/**
 * Time matrix representing schedule times for all trips and time points
 */
export type ScheduleMatrix = string[][];

/**
 * Summary schedule containing all schedule data
 */
export interface SummarySchedule {
  /** Route identifier */
  routeId: string;
  /** Route name/description */
  routeName: string;
  /** Direction of travel (e.g., "Inbound", "Outbound") */
  direction: string;
  /** Array of time points in sequence */
  timePoints: TimePoint[];
  /** Weekday schedule matrix [trips][timePoints] */
  weekday: ScheduleMatrix;
  /** Saturday schedule matrix [trips][timePoints] */
  saturday: ScheduleMatrix;
  /** Sunday schedule matrix [trips][timePoints] */
  sunday: ScheduleMatrix;
  /** Date when schedule is effective from */
  effectiveDate: Date;
  /** Date when schedule expires */
  expirationDate?: Date;
  /** Additional metadata */
  metadata: {
    /** Total number of trips for weekdays */
    weekdayTrips: number;
    /** Total number of trips for Saturdays */
    saturdayTrips: number;
    /** Total number of trips for Sundays */
    sundayTrips: number;
    /** Service frequency in minutes (average) */
    frequency?: number;
    /** Operating hours range */
    operatingHours?: {
      start: string;
      end: string;
    };
  };
}

/**
 * Validation result for schedule data
 */
export interface ScheduleValidationResult {
  /** Whether the schedule is valid */
  isValid: boolean;
  /** Array of validation errors */
  errors: string[];
  /** Array of validation warnings */
  warnings: string[];
}

/**
 * Schedule processing options
 */
export interface ScheduleProcessingOptions {
  /** Whether to validate time sequences */
  validateTimeSequence: boolean;
  /** Whether to allow gaps in schedule */
  allowGaps: boolean;
  /** Maximum allowed gap between trips in minutes */
  maxGapMinutes?: number;
  /** Whether to auto-generate missing time points */
  autoGenerateTimePoints: boolean;
}

/**
 * Time band definition for schedule generation
 */
export interface TimeBand {
  /** Start time in HH:MM format */
  startTime: string;
  /** End time in HH:MM format */
  endTime: string;
  /** Frequency in minutes between trips */
  frequency: number;
  /** Optional description for the time band */
  description?: string;
}

/**
 * Travel time matrix for efficient lookups
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
 * Trip calculation result with validation
 */
export interface TripCalculationResult {
  /** Unique trip identifier */
  tripId: string;
  /** Schedule entries for all time points */
  scheduleEntries: ScheduleEntry[];
  /** Total travel time for the trip in minutes */
  totalTravelTime: number;
  /** Whether the calculation was successful */
  isValid: boolean;
  /** Any errors encountered during calculation */
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
    calculationTime: number;
  };
}

/**
 * Schedule statistics for analysis and reporting
 */
export interface ScheduleStatistics {
  /** Total number of time points */
  totalTimePoints: number;
  /** Trip counts by day type */
  totalTrips: {
    weekday: number;
    saturday: number;
    sunday: number;
    total: number;
  };
  /** Average frequency by day type in minutes */
  averageFrequency: {
    weekday: number;
    saturday: number;
    sunday: number;
  };
  /** Operating hours by day type */
  operatingHours: {
    weekday: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { start: string; end: string };
  };
  /** Total travel time by day type in minutes */
  totalTravelTime: {
    weekday: number;
    saturday: number;
    sunday: number;
  };
}

/**
 * Trip duration analysis by time period
 */
export interface TripDurationByTimeOfDay {
  /** Time period (e.g., "07:00 - 07:29") */
  timePeriod: string;
  /** Start time of the period (e.g., "07:00") */
  startTime: string;
  /** Trip duration by percentile in minutes */
  duration: {
    /** 25th percentile duration */
    p25: number;
    /** 50th percentile (median) duration */
    p50: number;
    /** 80th percentile duration */
    p80: number;
    /** 90th percentile duration */
    p90: number;
  };
}

/**
 * Complete trip duration analysis result
 */
export interface TripDurationAnalysis {
  /** Route identifier */
  routeId: string;
  /** Route name */
  routeName: string;
  /** Direction (e.g., "Inbound", "Outbound") */
  direction: string;
  /** Duration analysis by time period */
  durationByTimeOfDay: TripDurationByTimeOfDay[];
  /** Summary statistics */
  summary: {
    /** Minimum trip duration across all periods */
    minDuration: number;
    /** Maximum trip duration across all periods */
    maxDuration: number;
    /** Average trip duration across all periods */
    avgDuration: number;
    /** Peak travel time period */
    peakPeriod: string;
    /** Fastest travel time period */
    fastestPeriod: string;
  };
}

/**
 * Bus block represents a sequence of trips operated by a single bus
 */
export interface BusBlock {
  /** Unique block identifier */
  blockId: string;
  /** Block start time in HH:MM format */
  startTime: string;
  /** Service band used for travel time calculations */
  serviceBand: string;
  /** Array of trips in this block */
  trips: BlockTrip[];
  /** Day type this block operates on */
  dayType: 'weekday' | 'saturday' | 'sunday';
  /** Total block duration in minutes */
  totalDuration: number;
  /** Physical bus block number for scheduling */
  busBlockNumber?: number;
}

/**
 * Individual trip within a bus block
 */
export interface BlockTrip {
  /** Unique trip identifier */
  tripId: string;
  /** Trip departure time in HH:MM format */
  departureTime: string;
  /** Direction of travel */
  direction: 'inbound' | 'outbound';
  /** Schedule entries for all timepoints */
  scheduleEntries: ScheduleEntry[];
  /** Trip duration in minutes */
  tripDuration: number;
  /** Auto-detected service band for this trip */
  detectedServiceBand: ServiceBand | null;
  /** Time period this trip falls into */
  timePeriod: string | null;
}

/**
 * Service band configuration for travel time calculations
 */
export interface ServiceBand {
  /** Unique service band identifier */
  id?: string;
  /** Service band name (e.g., "Fastest Service") */
  name: string;
  /** Start time of this service band in HH:MM format */
  startTime?: string;
  /** End time of this service band in HH:MM format */
  endTime?: string;
  /** Travel time multiplier for this band */
  travelTimeMultiplier?: number;
  /** Color for visual representation */
  color: string;
  /** Optional description */
  description?: string;
  /** Total minutes for this service band */
  totalMinutes?: number;
  /** Segment travel times */
  segmentTimes?: number[];
}

/**
 * Represents a single bus trip
 */
export interface Trip {
  /** Trip number */
  tripNumber: number;
  /** Block number this trip belongs to */
  blockNumber: number;
  /** Departure time from first stop */
  departureTime: string;
  /** Service band name */
  serviceBand: string;
  /** Arrival times at each timepoint */
  arrivalTimes: { [timePointId: string]: string };
  /** Departure times from each timepoint */
  departureTimes: { [timePointId: string]: string };
  /** Recovery times at each timepoint */
  recoveryTimes: { [timePointId: string]: number };
  /** Service band information */
  serviceBandInfo?: {
    name: string;
    color: string;
    totalMinutes?: number;
  };
  /** Total recovery minutes */
  recoveryMinutes: number;
  /** Index where trip ends early */
  tripEndIndex?: number;
  /** Original times for restoration */
  originalArrivalTimes?: { [timePointId: string]: string };
  originalDepartureTimes?: { [timePointId: string]: string };
  originalRecoveryTimes?: { [timePointId: string]: number };
}

/**
 * Complete schedule with all trips and metadata
 */
export interface Schedule {
  /** Schedule ID */
  id: string;
  /** Schedule name */
  name: string;
  /** Route ID */
  routeId: string;
  /** Route name */
  routeName: string;
  /** Direction (Inbound/Outbound) */
  direction: string;
  /** Day type */
  dayType: string;
  /** Time points in order */
  timePoints: TimePoint[];
  /** Service bands */
  serviceBands: ServiceBand[];
  /** All trips */
  trips: Trip[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Block configuration for bus scheduling
 */
export interface BlockConfiguration {
  /** Block number identifier */
  blockNumber: number;
  /** Start time for the block in HH:MM format */
  startTime: string;
  /** End time for the block in HH:MM format */
  endTime: string;
  /** Number of trips in this block */
  tripCount?: number;
  /** Service band to use */
  serviceBand?: string;
}

/**
 * Bus block creation parameters
 */
export interface BusBlockCreationParams {
  /** Start time for the first trip in HH:MM format */
  blockStartTime: string;
  /** Service band to use for travel time calculations */
  serviceBandId: string;
  /** Day type for this block */
  dayType: 'weekday' | 'saturday' | 'sunday';
  /** Number of trips to generate in this block */
  tripCount: number;
  /** Frequency between trips in minutes */
  frequency: number;
  /** Array of timepoints for the route */
  timePoints: TimePoint[];
  /** Travel time data for timepoint-to-timepoint calculations */
  travelTimeData: TimePointData[];
}

/**
 * Travel time data structure for bus block calculations
 */
export interface TimePointData {
  /** Starting timepoint name */
  fromTimePoint: string;
  /** Destination timepoint name */
  toTimePoint: string;
  /** Time period this data represents */
  timePeriod: string;
  /** 50th percentile travel time in minutes */
  percentile50: number;
  /** 80th percentile travel time in minutes */
  percentile80: number;
}

/**
 * Connection types for schedule coordination
 */
export enum ConnectionType {
  BUS_ROUTE = 'BUS_ROUTE',
  GO_TRAIN = 'GO_TRAIN',
  SCHOOL_BELL = 'SCHOOL_BELL'
}

/**
 * Connection status indicators
 */
export enum ConnectionStatus {
  MET = 'MET',           // Connection time requirements satisfied
  AT_RISK = 'AT_RISK',   // Close to minimum threshold  
  FAILED = 'FAILED',     // Cannot meet connection
  PENDING = 'PENDING'    // Not yet validated
}

/**
 * Connection point configuration
 */
export interface ConnectionPoint {
  /** Unique connection identifier */
  id: string;
  /** Type of connection */
  type: ConnectionType;
  /** Timepoint/stop ID where connection occurs */
  locationId: string;
  /** Display name of connection location */
  locationName: string;
  /** Target service (route/train/school ID) */
  targetServiceId: string;
  /** Display name of target service */
  targetServiceName: string;
  /** Required arrival time (for schools/trains) */
  requiredArrivalTime?: string;
  /** Required departure time */
  requiredDepartureTime?: string;
  /** Minimum transfer time in minutes */
  minimumTransferTime: number;
  /** Maximum acceptable wait time */
  maximumWaitTime?: number;
  /** Connection priority */
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Days when connection is active */
  dayTypes: string[];
  /** Additional notes */
  notes?: string;
}

/**
 * Connection validation result
 */
export interface ConnectionValidation {
  /** Connection point ID */
  connectionId: string;
  /** Current validation status */
  status: ConnectionStatus;
  /** Actual transfer time in minutes */
  actualTransferTime?: number;
  /** Trips affected by this connection */
  affectedTrips: string[];
  /** Warning or error message */
  message?: string;
}

/**
 * GO Train schedule entry
 */
export interface GOTrainSchedule {
  /** Train direction (northbound/southbound) */
  direction: 'northbound' | 'southbound';
  /** Station stop code */
  stopCode: string;
  /** Station name */
  stationName: string;
  /** Arrival time in HH:MM format (24-hour) */
  arrivalTime?: string;
  /** Departure time in HH:MM format (24-hour) */
  departureTime?: string;
  /** Day types this schedule operates */
  dayTypes: ('weekday' | 'saturday' | 'sunday')[];
  /** Train number/identifier */
  trainNumber?: string;
  /** Notes about this train */
  notes?: string;
}

/**
 * Connection optimization request
 */
export interface ConnectionOptimizationRequest {
  /** Current bus schedule to optimize */
  schedule: Schedule;
  /** GO Train schedules to connect with */
  goTrainSchedules: GOTrainSchedule[];
  /** Connection parameters */
  connectionParams: {
    /** Buffer time for bus-to-train connections (minutes) */
    busToTrainBuffer: number;
    /** Buffer time for train-to-bus connections (minutes) */
    trainToBusBuffer: number;
    /** Maximum acceptable wait time (minutes) */
    maxWaitTime: number;
    /** Prioritize specific connections */
    priorities?: ConnectionPriority[];
  };
}

/**
 * Connection priority configuration
 */
export interface ConnectionPriority {
  /** Priority level (1 = highest) */
  level: number;
  /** Description of priority (e.g., "Georgian College") */
  description: string;
  /** Specific time windows to prioritize */
  timeWindows?: {
    start: string;
    end: string;
  }[];
  /** Specific train numbers to prioritize */
  trainNumbers?: string[];
}

/**
 * Connection optimization result
 */
export interface ConnectionOptimizationResult {
  /** Optimized schedule */
  optimizedSchedule: Schedule;
  /** List of connections made */
  connections: ConnectionMatch[];
  /** List of connections that couldn't be made */
  missedConnections: MissedConnection[];
  /** Overall optimization score */
  optimizationScore: number;
  /** Summary statistics */
  summary: {
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    averageWaitTime: number;
    averageTransferTime: number;
  };
}

/**
 * Successful connection match
 */
export interface ConnectionMatch {
  /** Bus trip ID */
  busTrip: string;
  /** GO Train schedule */
  goTrain: GOTrainSchedule;
  /** Connection type */
  connectionType: 'bus-to-train' | 'train-to-bus';
  /** Actual connection time (minutes) */
  connectionTime: number;
  /** Wait time (minutes) */
  waitTime: number;
  /** Priority level if applicable */
  priorityLevel?: number;
  /** Time adjustment made to bus schedule (minutes) */
  adjustmentMade?: number;
}

/**
 * Missed connection details
 */
export interface MissedConnection {
  /** GO Train schedule that couldn't be connected */
  goTrain: GOTrainSchedule;
  /** Reason for missing connection */
  reason: string;
  /** Closest bus trip (if any) */
  closestBusTrip?: string;
  /** Time difference to closest trip (minutes) */
  timeDifference?: number;
}
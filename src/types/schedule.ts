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
  id: string;
  /** Service band name (e.g., "Fastest Service") */
  name: string;
  /** Start time of this service band in HH:MM format */
  startTime: string;
  /** End time of this service band in HH:MM format */
  endTime: string;
  /** Travel time multiplier for this band */
  travelTimeMultiplier: number;
  /** Color for visual representation */
  color: string;
  /** Optional description */
  description?: string;
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
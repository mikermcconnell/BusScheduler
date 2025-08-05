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
/**
 * Schedule Validation Rules
 * Comprehensive validation system for transit schedules
 */

interface Trip {
  tripNumber: number;
  blockNumber: number;
  departureTime: string;
  serviceBand?: string;
  arrivalTimes: { [timepointId: string]: string };
  recoveryTimes?: { [timepointId: string]: number };
}

interface Schedule {
  trips: Trip[];
  timePoints: Array<{ id: string; name: string }>;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
  affectedTrips?: string[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'timing' | 'coverage' | 'operational' | 'compliance';
  check: (schedule: Schedule) => ValidationResult;
  severity: 'error' | 'warning' | 'info';
  autoFix?: (schedule: Schedule) => Schedule;
}

/**
 * Minimum layover time validation
 */
const minimumLayoverRule: ValidationRule = {
  id: 'min_layover',
  name: 'Minimum Layover Time',
  description: 'Ensures adequate layover time between trips',
  category: 'operational',
  severity: 'warning',
  check: (schedule: Schedule) => {
    const MIN_LAYOVER = 5; // minutes
    const violations: string[] = [];
    
    // Group trips by block
    const tripsByBlock = new Map<number, Trip[]>();
    schedule.trips.forEach(trip => {
      if (!tripsByBlock.has(trip.blockNumber)) {
        tripsByBlock.set(trip.blockNumber, []);
      }
      tripsByBlock.get(trip.blockNumber)!.push(trip);
    });

    tripsByBlock.forEach((trips, blockNum) => {
      const sortedTrips = [...trips].sort((a, b) => 
        a.departureTime.localeCompare(b.departureTime)
      );
      
      for (let i = 0; i < sortedTrips.length - 1; i++) {
        const currentTrip = sortedTrips[i];
        const nextTrip = sortedTrips[i + 1];
        
        // Calculate layover time
        const lastTimepoint = schedule.timePoints[schedule.timePoints.length - 1];
        const currentEndTime = currentTrip.arrivalTimes[lastTimepoint.id];
        const nextStartTime = nextTrip.departureTime;
        
        if (currentEndTime && nextStartTime) {
          const layoverMinutes = calculateMinutesBetween(currentEndTime, nextStartTime);
          
          if (layoverMinutes < MIN_LAYOVER) {
            violations.push(`Block ${blockNum}: Trip ${currentTrip.tripNumber} → ${nextTrip.tripNumber}`);
          }
        }
      }
    });

    return {
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'All trips have adequate layover time'
        : `${violations.length} trips have insufficient layover time (<${MIN_LAYOVER} min)`,
      affectedTrips: violations
    };
  }
};

/**
 * Service span validation
 */
const serviceSpanRule: ValidationRule = {
  id: 'service_span',
  name: 'Service Span Coverage',
  description: 'Validates service hours coverage',
  category: 'coverage',
  severity: 'info',
  check: (schedule: Schedule) => {
    if (schedule.trips.length === 0) {
      return {
        passed: false,
        message: 'No trips scheduled'
      };
    }

    const sortedTrips = [...schedule.trips].sort((a, b) => 
      a.departureTime.localeCompare(b.departureTime)
    );
    
    const firstDeparture = sortedTrips[0].departureTime;
    const lastDeparture = sortedTrips[sortedTrips.length - 1].departureTime;
    
    const spanHours = calculateMinutesBetween(firstDeparture, lastDeparture) / 60;
    
    return {
      passed: true,
      message: `Service operates for ${spanHours.toFixed(1)} hours`,
      details: `First departure: ${firstDeparture}, Last departure: ${lastDeparture}`
    };
  }
};

/**
 * Frequency consistency validation
 */
const frequencyConsistencyRule: ValidationRule = {
  id: 'frequency_consistency',
  name: 'Frequency Consistency',
  description: 'Checks for consistent headways within service bands',
  category: 'operational',
  severity: 'warning',
  check: (schedule: Schedule) => {
    const TOLERANCE = 3; // minutes
    const inconsistencies: string[] = [];
    
    // Group trips by service band
    const tripsByServiceBand = new Map<string, Trip[]>();
    schedule.trips.forEach(trip => {
      const band = trip.serviceBand || 'default';
      if (!tripsByServiceBand.has(band)) {
        tripsByServiceBand.set(band, []);
      }
      tripsByServiceBand.get(band)!.push(trip);
    });

    tripsByServiceBand.forEach((trips, band) => {
      const sortedTrips = [...trips].sort((a, b) => 
        a.departureTime.localeCompare(b.departureTime)
      );
      
      if (sortedTrips.length < 3) return;
      
      const headways: number[] = [];
      for (let i = 1; i < sortedTrips.length; i++) {
        const headway = calculateMinutesBetween(
          sortedTrips[i - 1].departureTime,
          sortedTrips[i].departureTime
        );
        headways.push(headway);
      }
      
      const avgHeadway = headways.reduce((a, b) => a + b, 0) / headways.length;
      
      headways.forEach((headway, index) => {
        if (Math.abs(headway - avgHeadway) > TOLERANCE) {
          inconsistencies.push(
            `${band}: Trip ${sortedTrips[index].tripNumber} → ${sortedTrips[index + 1].tripNumber} (${headway}min vs avg ${avgHeadway.toFixed(0)}min)`
          );
        }
      });
    });

    return {
      passed: inconsistencies.length === 0,
      message: inconsistencies.length === 0
        ? 'Headways are consistent within service bands'
        : `${inconsistencies.length} inconsistent headways detected`,
      affectedTrips: inconsistencies
    };
  }
};

/**
 * Recovery time validation
 */
const recoveryTimeRule: ValidationRule = {
  id: 'recovery_time',
  name: 'Recovery Time Adequacy',
  description: 'Ensures adequate recovery time at terminals',
  category: 'operational',
  severity: 'warning',
  check: (schedule: Schedule) => {
    const MIN_TERMINAL_RECOVERY = 3; // minutes
    const violations: string[] = [];
    
    schedule.trips.forEach(trip => {
      const lastTimepoint = schedule.timePoints[schedule.timePoints.length - 1];
      const terminalRecovery = trip.recoveryTimes?.[lastTimepoint.id] || 0;
      
      if (terminalRecovery < MIN_TERMINAL_RECOVERY) {
        violations.push(
          `Trip ${trip.tripNumber}: ${terminalRecovery}min recovery at terminal (min: ${MIN_TERMINAL_RECOVERY}min)`
        );
      }
    });

    return {
      passed: violations.length === 0,
      message: violations.length === 0
        ? 'All trips have adequate terminal recovery time'
        : `${violations.length} trips have insufficient terminal recovery`,
      affectedTrips: violations
    };
  }
};

/**
 * Block continuity validation
 */
const blockContinuityRule: ValidationRule = {
  id: 'block_continuity',
  name: 'Block Continuity',
  description: 'Ensures blocks maintain logical continuity',
  category: 'operational',
  severity: 'error',
  check: (schedule: Schedule) => {
    const issues: string[] = [];
    
    // Group trips by block
    const tripsByBlock = new Map<number, Trip[]>();
    schedule.trips.forEach(trip => {
      if (!tripsByBlock.has(trip.blockNumber)) {
        tripsByBlock.set(trip.blockNumber, []);
      }
      tripsByBlock.get(trip.blockNumber)!.push(trip);
    });

    tripsByBlock.forEach((trips, blockNum) => {
      const sortedTrips = [...trips].sort((a, b) => 
        a.departureTime.localeCompare(b.departureTime)
      );
      
      for (let i = 0; i < sortedTrips.length - 1; i++) {
        const currentTrip = sortedTrips[i];
        const nextTrip = sortedTrips[i + 1];
        
        // Check if next trip starts before current trip ends
        const lastTimepoint = schedule.timePoints[schedule.timePoints.length - 1];
        const currentEndTime = currentTrip.arrivalTimes[lastTimepoint.id];
        const nextStartTime = nextTrip.departureTime;
        
        if (currentEndTime && nextStartTime) {
          if (nextStartTime < currentEndTime) {
            issues.push(
              `Block ${blockNum}: Trip ${nextTrip.tripNumber} starts before Trip ${currentTrip.tripNumber} ends`
            );
          }
        }
      }
    });

    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'All blocks maintain proper continuity'
        : `${issues.length} block continuity issues found`,
      affectedTrips: issues
    };
  }
};

/**
 * Peak vehicle requirement validation
 */
const peakVehicleRule: ValidationRule = {
  id: 'peak_vehicle',
  name: 'Peak Vehicle Requirement',
  description: 'Calculates maximum vehicles needed',
  category: 'operational',
  severity: 'info',
  check: (schedule: Schedule) => {
    // Calculate vehicles in service at each minute
    const vehiclesInService = new Map<number, number>();
    
    schedule.trips.forEach(trip => {
      const startMinutes = timeToMinutes(trip.departureTime);
      const lastTimepoint = schedule.timePoints[schedule.timePoints.length - 1];
      const endTime = trip.arrivalTimes[lastTimepoint.id];
      
      if (endTime) {
        const endMinutes = timeToMinutes(endTime);
        
        for (let minute = startMinutes; minute <= endMinutes; minute++) {
          vehiclesInService.set(minute, (vehiclesInService.get(minute) || 0) + 1);
        }
      }
    });

    const peakVehicles = Math.max(...Array.from(vehiclesInService.values()), 0);
    const peakTime = Array.from(vehiclesInService.entries())
      .find(([_, count]) => count === peakVehicles)?.[0];
    
    return {
      passed: true,
      message: `Peak vehicle requirement: ${peakVehicles} buses`,
      details: peakTime ? `Peak occurs at ${minutesToTime(peakTime)}` : undefined
    };
  }
};

/**
 * Helper function to calculate minutes between two time strings
 */
function calculateMinutesBetween(time1: string, time2: string): number {
  const minutes1 = timeToMinutes(time1);
  const minutes2 = timeToMinutes(time2);
  
  let diff = minutes2 - minutes1;
  if (diff < 0) {
    diff += 24 * 60; // Handle day boundary
  }
  
  return diff;
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * All validation rules
 */
export const validationRules: ValidationRule[] = [
  blockContinuityRule,
  minimumLayoverRule,
  recoveryTimeRule,
  frequencyConsistencyRule,
  serviceSpanRule,
  peakVehicleRule
];

/**
 * Run all validation rules on a schedule
 */
export function validateSchedule(
  schedule: Schedule,
  severityFilter?: 'error' | 'warning' | 'info'
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  
  validationRules
    .filter(rule => !severityFilter || rule.severity === severityFilter)
    .forEach(rule => {
      try {
        results.set(rule.id, rule.check(schedule));
      } catch (error) {
        results.set(rule.id, {
          passed: false,
          message: `Validation error: ${error}`
        });
      }
    });
  
  return results;
}
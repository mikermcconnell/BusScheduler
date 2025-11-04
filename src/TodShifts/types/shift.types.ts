export type DayType = 'weekday' | 'saturday' | 'sunday';

export type ShiftZone = 'North' | 'South' | 'Floater';

export interface Shift {
    id?: number | string;
    shiftCode: string;
    driverId?: string;
    vehicleId?: string;
    scheduleType: DayType;
    zone: ShiftZone;
    startTime: string; // HH:MM in 24h
    endTime: string; // HH:MM in 24h, end can be after midnight
    totalHours: number;
    breakStart?: string;
    breakEnd?: string;
    breakDuration?: number;
    mealBreakStart?: string;
    mealBreakEnd?: string;
    isSplitShift: boolean;
    unionCompliant: boolean;
    complianceWarnings?: string[];
    createdBy?: string;
    vehicleCount?: number;
  }

export interface MasterScheduleRequirement {
  id?: number;
  scheduleType: DayType;
  timeSlot: string; // HH:MM format
  zone: ShiftZone;
  requiredBuses: number;
  effectiveDate?: string;
}

export interface UnionRule {
  id?: number;
  ruleName: string;
  ruleType: 'required' | 'preferred';
  category: 'shift_length' | 'breaks' | 'rest_periods';
  minValue?: number;
  maxValue?: number;
  unit?: 'hours' | 'minutes';
  isActive: boolean;
  description?: string;
}

export interface UnionViolation {
  ruleId: number;
  ruleName: string;
  violationType: 'error' | 'warning';
  violationMessage: string;
}

export interface ShiftCoverage {
  timeSlot: string;
  north: number;
  south: number;
  floater: number;
  total: number;
  required: number;
  difference: number;
}

export interface CityRequirementInterval {
  dayType: DayType;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  northRequired: number;
  southRequired: number;
  floaterRequired: number;
}

export interface OperationalInterval {
  dayType: DayType;
  startTime: string;
  endTime: string;
  northOperational: number;
  southOperational: number;
  floaterOperational: number;
  breakCount?: number;
}

export interface TodShiftColorScale {
  min: number;
  max: number;
  thresholds: {
    deficit: number;
    surplus: number;
  };
}

export interface TodShiftRunPayload {
  cityFileName: string;
  contractorFileName: string;
  importedAt: string;
  cityTimeline: Record<DayType, CityRequirementInterval[]>;
  operationalTimeline: Record<DayType, OperationalInterval[]>;
  shifts: Shift[];
  lastExportedAt?: string;
}

export interface TodShiftRun extends TodShiftRunPayload {
  id: string;
  coverageTimeline?: Record<DayType, ShiftCoverageInterval[]>;
  colorScale?: TodShiftColorScale;
}

export interface ShiftCoverageInterval {
  dayType: DayType;
  startTime: string;
  endTime: string;
  northRequired: number;
  southRequired: number;
  floaterRequired: number;
  northOperational: number;
  southOperational: number;
  floaterOperational: number;
  floaterAllocatedNorth: number;
  floaterAllocatedSouth: number;
  northExcess: number;
  southExcess: number;
  floaterExcess: number;
  totalExcess: number;
  status: 'deficit' | 'balanced' | 'excess';
}

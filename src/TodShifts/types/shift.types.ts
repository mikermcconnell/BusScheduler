export interface Shift {
    id?: number;
    shiftCode: string;
    scheduleType: 'weekday' | 'saturday' | 'sunday';
    zone: 'North' | 'South' | 'Floater';
    startTime: string; // HH:MM format
    endTime: string;
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
  }
  
  export interface MasterScheduleRequirement {
    id?: number;
    scheduleType: 'weekday' | 'saturday' | 'sunday';
    timeSlot: string; // HH:MM format
    zone: 'North' | 'South' | 'Floater';
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
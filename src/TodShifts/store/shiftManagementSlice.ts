import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  Shift, 
  MasterScheduleRequirement, 
  UnionRule, 
  UnionViolation,
  ShiftCoverage 
} from '../types/shift.types';
import { validateShiftAgainstRules } from '../utils/unionRulesValidator';

interface ShiftManagementState {
  shifts: Shift[];
  masterSchedule: MasterScheduleRequirement[];
  unionRules: UnionRule[];
  coverage: ShiftCoverage[];
  activeScheduleType: 'weekday' | 'saturday' | 'sunday';
  loading: {
    shifts: boolean;
    masterSchedule: boolean;
    unionRules: boolean;
  };
  error: {
    shifts: string | null;
    masterSchedule: string | null;
    unionRules: string | null;
  };
}

const initialState: ShiftManagementState = {
  shifts: [],
  masterSchedule: [],
  unionRules: [],
  coverage: [],
  activeScheduleType: 'weekday',
  loading: {
    shifts: false,
    masterSchedule: false,
    unionRules: false,
  },
  error: {
    shifts: null,
    masterSchedule: null,
    unionRules: null,
  },
};

// Async thunks
export const loadMasterSchedule = createAsyncThunk(
  'shiftManagement/loadMasterSchedule',
  async (file: File) => {
    const { parseMasterSchedule } = await import('../utils/scheduleParser');
    return parseMasterSchedule(file);
  }
);

export const loadUnionRules = createAsyncThunk(
  'shiftManagement/loadUnionRules',
  async () => {
    // Temporary mock data for union rules
    const rules: UnionRule[] = [
      {
        id: 1,
        ruleName: 'Maximum Shift Length',
        ruleType: 'required',
        category: 'shift_length',
        maxValue: 10,
        unit: 'hours',
        isActive: true,
        description: 'Shifts cannot exceed 10 hours'
      },
      {
        id: 2,
        ruleName: 'Minimum Break Duration',
        ruleType: 'required',
        category: 'breaks',
        minValue: 30,
        unit: 'minutes',
        isActive: true,
        description: 'Minimum 30 minute break required'
      }
    ];
    return rules;
  }
);

export const saveShift = createAsyncThunk(
  'shiftManagement/saveShift',
  async (shift: Omit<Shift, 'id'>) => {
    const violations = await validateShiftAgainstRules(shift);
    const shiftWithCompliance = {
      ...shift,
      unionCompliant: !violations.some((v: UnionViolation) => v.violationType === 'error'),
      complianceWarnings: violations.map((v: UnionViolation) => v.violationMessage),
    };

    // In a real app, this would save to database
    return { ...shiftWithCompliance, id: Date.now() };
  }
);

// Helper function to calculate coverage
function calculateCoverage(shifts: Shift[], requirements: MasterScheduleRequirement[]): ShiftCoverage[] {
  // Implementation would calculate actual coverage vs requirements
  return [];
}

const shiftManagementSlice = createSlice({
  name: 'shiftManagement',
  initialState,
  reducers: {
    setActiveScheduleType: (state, action: PayloadAction<'weekday' | 'saturday' | 'sunday'>) => {
      state.activeScheduleType = action.payload;
      // Recalculate coverage when schedule type changes
      state.coverage = calculateCoverage(
        state.shifts.filter(s => s.scheduleType === action.payload),
        state.masterSchedule.filter((m: MasterScheduleRequirement) => m.scheduleType === action.payload)
      );
    },
    clearErrors: (state) => {
      state.error = {
        shifts: null,
        masterSchedule: null,
        unionRules: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Load Master Schedule
      .addCase(loadMasterSchedule.pending, (state) => {
        state.loading.masterSchedule = true;
        state.error.masterSchedule = null;
      })
      .addCase(loadMasterSchedule.fulfilled, (state, action) => {
        state.loading.masterSchedule = false;
        state.masterSchedule = action.payload;
        state.coverage = calculateCoverage(
          state.shifts.filter(s => s.scheduleType === state.activeScheduleType),
          action.payload.filter((m: MasterScheduleRequirement) => m.scheduleType === state.activeScheduleType)
        );
      })
      .addCase(loadMasterSchedule.rejected, (state, action) => {
        state.loading.masterSchedule = false;
        state.error.masterSchedule = action.error.message || 'Failed to load master schedule';
      })
      // Load Union Rules
      .addCase(loadUnionRules.pending, (state) => {
        state.loading.unionRules = true;
        state.error.unionRules = null;
      })
      .addCase(loadUnionRules.fulfilled, (state, action) => {
        state.loading.unionRules = false;
        state.unionRules = action.payload;
      })
      .addCase(loadUnionRules.rejected, (state, action) => {
        state.loading.unionRules = false;
        state.error.unionRules = action.error.message || 'Failed to load union rules';
      })
      // Save Shift
      .addCase(saveShift.pending, (state) => {
        state.loading.shifts = true;
        state.error.shifts = null;
      })
      .addCase(saveShift.fulfilled, (state, action) => {
        state.loading.shifts = false;
        state.shifts.push(action.payload);
        // Recalculate coverage
        state.coverage = calculateCoverage(
          state.shifts.filter(s => s.scheduleType === state.activeScheduleType),
          state.masterSchedule.filter((m: MasterScheduleRequirement) => m.scheduleType === state.activeScheduleType)
        );
      })
      .addCase(saveShift.rejected, (state, action) => {
        state.loading.shifts = false;
        state.error.shifts = action.error.message || 'Failed to save shift';
      });
  },
});

export const { setActiveScheduleType, clearErrors } = shiftManagementSlice.actions;
export default shiftManagementSlice.reducer;
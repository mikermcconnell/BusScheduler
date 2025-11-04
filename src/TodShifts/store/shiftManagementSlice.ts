import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  Shift,
  UnionRule,
  UnionViolation,
  CityRequirementInterval,
  OperationalInterval,
  TodShiftRun,
  TodShiftRunPayload,
  DayType,
  ShiftCoverageInterval,
  TodShiftColorScale
} from '../types/shift.types';
import { validateShiftAgainstRules } from '../utils/unionRulesValidator';
import { todShiftRepository } from '../services/todShiftRepository';
import { formatIsoTimestamp, DAY_TYPES } from '../utils/timeUtils';
import { computeCoverageTimeline } from '../utils/coverageCalculator';
import type { RootState } from '../../store/store';
import type { OptimizationReport } from '../types/optimization.types';

interface ImportMetadata {
  runId: string | null;
  cityFileName?: string;
  contractorFileName?: string;
  importedAt?: string;
  lastExportedAt?: string;
}

interface ShiftManagementState {
  shifts: Shift[];
  unionRules: UnionRule[];
  cityTimeline: Record<DayType, CityRequirementInterval[]>;
  operationalTimeline: Record<DayType, OperationalInterval[]>;
  coverageTimeline: Record<DayType, ShiftCoverageInterval[]>;
  colorScale: TodShiftColorScale | null;
  activeScheduleType: DayType;
  importMetadata: ImportMetadata;
  loading: {
    shifts: boolean;
    unionRules: boolean;
    imports: boolean;
    fetchRun: boolean;
    persistence: boolean;
    unionRulesPersistence: boolean;
    optimization: boolean;
  };
  error: {
    shifts: string | null;
    unionRules: string | null;
    imports: string | null;
    persistence: string | null;
    optimization: string | null;
  };
  lastOptimizationReport: OptimizationReport | null;
}

function createEmptyCityTimeline(): Record<DayType, CityRequirementInterval[]> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = [];
    return acc;
  }, {} as Record<DayType, CityRequirementInterval[]>);
}

function createEmptyOperationalTimeline(): Record<DayType, OperationalInterval[]> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = [];
    return acc;
  }, {} as Record<DayType, OperationalInterval[]>);
}

function createEmptyCoverageTimeline(): Record<DayType, ShiftCoverageInterval[]> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = [];
    return acc;
  }, {} as Record<DayType, ShiftCoverageInterval[]>);
}

const UNION_RULES_STORAGE_KEY = 'tod_shift_union_rules';

const DEFAULT_UNION_RULES: UnionRule[] = [
  {
    id: 1,
    ruleName: 'Minimum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    minValue: 7,
    unit: 'hours',
    isActive: true,
    description: 'Shifts must be scheduled for at least 7.0 hours.'
  },
  {
    id: 2,
    ruleName: 'Maximum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    maxValue: 9.75,
    unit: 'hours',
    isActive: true,
    description: 'Operators cannot be scheduled for more than 9.75 hours in a single shift.'
  },
  {
    id: 3,
    ruleName: 'Meal Break Requirement Threshold',
    ruleType: 'required',
    category: 'breaks',
    minValue: 7.5,
    unit: 'hours',
    isActive: true,
    description: 'Break is required only when the scheduled shift exceeds 7.5 hours.'
  },
  {
    id: 4,
    ruleName: 'Meal Break Latest Start',
    ruleType: 'required',
    category: 'breaks',
    maxValue: 4.75,
    unit: 'hours',
    isActive: true,
    description: 'When a break is required it must begin no later than 4.75 hours into the shift.'
  },
  {
    id: 5,
    ruleName: 'Meal Break Duration',
    ruleType: 'required',
    category: 'breaks',
    minValue: 40,
    unit: 'minutes',
    isActive: true,
    description: 'Required meal break length for extended shifts.'
  },
  {
    id: 6,
    ruleName: 'Ideal Shift Length',
    ruleType: 'preferred',
    category: 'shift_length',
    minValue: 7.2,
    unit: 'hours',
    isActive: true,
    description: 'Targeted shift length for schedule optimization.'
  }
];

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: Storage }).localStorage) {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  }
  return null;
}

function loadUnionRulesFromStorage(): UnionRule[] | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(UNION_RULES_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as UnionRule[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Unable to parse union rules from storage.', error);
    return null;
  }
}

function persistUnionRulesToStorage(rules: UnionRule[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(UNION_RULES_STORAGE_KEY, JSON.stringify(rules));
}

function mergeUnionRulesWithDefaults(rules: UnionRule[]): UnionRule[] {
  const merged = rules.map((existing) => {
    const defaultMatch = DEFAULT_UNION_RULES.find((rule) => rule.ruleName === existing.ruleName);
    if (!defaultMatch) {
      return existing;
    }

    return {
      ...defaultMatch,
      id: existing.id ?? defaultMatch.id,
      isActive: existing.isActive ?? defaultMatch.isActive
    };
  });

  const existingNames = new Set(merged.map((rule) => rule.ruleName));

  DEFAULT_UNION_RULES.forEach((defaultRule) => {
    if (!existingNames.has(defaultRule.ruleName)) {
      merged.push({
        ...defaultRule,
        id: defaultRule.id ?? Date.now() + merged.length
      });
    }
  });

  return merged;
}

const initialState: ShiftManagementState = {
  shifts: [],
  unionRules: [],
  cityTimeline: createEmptyCityTimeline(),
  operationalTimeline: createEmptyOperationalTimeline(),
  coverageTimeline: createEmptyCoverageTimeline(),
  colorScale: null,
  activeScheduleType: 'weekday',
  importMetadata: {
    runId: null
  },
  loading: {
    shifts: false,
    unionRules: false,
    imports: false,
    fetchRun: false,
    persistence: false,
    unionRulesPersistence: false,
    optimization: false
  },
  error: {
    shifts: null,
    unionRules: null,
    imports: null,
    persistence: null,
    optimization: null
  },
  lastOptimizationReport: null
};

export const processTodShiftImports = createAsyncThunk<
  TodShiftRun,
  { cityFile: File; contractorFile: File },
  { rejectValue: string }
>(
  'shiftManagement/processTodShiftImports',
  async ({ cityFile, contractorFile }, { rejectWithValue }) => {
    try {
      const { parseCityRequirementsCsv, parseContractorShiftsCsv } = await import('../utils/todShiftImport');

      const [cityTimeline, contractorResult] = await Promise.all([
        parseCityRequirementsCsv(cityFile),
        parseContractorShiftsCsv(contractorFile)
      ]);

      const payload: TodShiftRunPayload = {
        cityFileName: cityFile.name,
        contractorFileName: contractorFile.name,
        importedAt: formatIsoTimestamp(),
        cityTimeline,
        operationalTimeline: contractorResult.operationalTimeline,
        shifts: contractorResult.shifts
      };

      const coverage = computeCoverageTimeline({
        cityTimeline: payload.cityTimeline,
        operationalTimeline: payload.operationalTimeline
      });

      const run = await todShiftRepository.createRun(payload);

      const augmentedRun: TodShiftRun = {
        ...run,
        coverageTimeline: coverage.timeline,
        colorScale: coverage.colorScale
      };

      try {
        await todShiftRepository.updateRun(augmentedRun.id, {
          coverageTimeline: coverage.timeline,
          colorScale: coverage.colorScale
        });
      } catch (err) {
        console.warn('Unable to persist coverage timeline to Firebase:', err);
      }

      return augmentedRun;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process TOD shift imports.';
      return rejectWithValue(message);
    }
  }
);

export const fetchLatestTodShiftRun = createAsyncThunk<
  TodShiftRun | null,
  void,
  { rejectValue: string }
>(
  'shiftManagement/fetchLatestTodShiftRun',
  async (_, { rejectWithValue }) => {
    try {
      const run = await todShiftRepository.getMostRecentRun();
      if (!run) {
        return null;
      }

      if (!run.coverageTimeline || !run.colorScale) {
        const coverage = computeCoverageTimeline({
          cityTimeline: run.cityTimeline,
          operationalTimeline: run.operationalTimeline
        });

        const updatedRun: TodShiftRun = {
          ...run,
          coverageTimeline: coverage.timeline,
          colorScale: coverage.colorScale
        };

        try {
          await todShiftRepository.updateRun(updatedRun.id, {
            coverageTimeline: coverage.timeline,
            colorScale: coverage.colorScale
          });
        } catch (err) {
          console.warn('Unable to backfill coverage timeline for persisted run:', err);
        }

        return updatedRun;
      }

      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load latest TOD shift dataset.';
      return rejectWithValue(message);
    }
  }
);

export const recordShiftExport = createAsyncThunk<
  string,
  { runId: string; exportedAt: string },
  { rejectValue: string }
>(
  'shiftManagement/recordShiftExport',
  async ({ runId, exportedAt }, { rejectWithValue }) => {
    try {
      await todShiftRepository.updateRun(runId, {
        lastExportedAt: exportedAt
      });
      return exportedAt;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to record export event.';
      return rejectWithValue(message);
    }
  }
);

export const loadUnionRules = createAsyncThunk(
  'shiftManagement/loadUnionRules',
  async () => {
    const stored = loadUnionRulesFromStorage();
    if (stored && stored.length > 0) {
      const normalized = mergeUnionRulesWithDefaults(stored);
      persistUnionRulesToStorage(normalized);
      return normalized;
    }

    persistUnionRulesToStorage(DEFAULT_UNION_RULES);
    return DEFAULT_UNION_RULES;
  }
);

export const persistUnionRules = createAsyncThunk<UnionRule[], UnionRule[], { rejectValue: string }>(
  'shiftManagement/persistUnionRules',
  async (rules, { rejectWithValue }) => {
    try {
      persistUnionRulesToStorage(rules);
      return rules;
    } catch (error) {
      console.error('Failed to save union rules', error);
      return rejectWithValue('Failed to save union rules.');
    }
  }
);

export const optimizeShifts = createAsyncThunk<
  {
    run: TodShiftRun;
    report: OptimizationReport;
  },
  void,
  { rejectValue: string }
>(
  'shiftManagement/optimizeShifts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const cityTimeline = state.shiftManagement.cityTimeline;
      const hasCityData = DAY_TYPES.some((day) => (cityTimeline[day] ?? []).length > 0);

      if (!hasCityData) {
        return rejectWithValue('Master schedule data is missing. Import the city requirements before optimizing.');
      }

      const activeRules =
        state.shiftManagement.unionRules.length > 0
          ? state.shiftManagement.unionRules
          : DEFAULT_UNION_RULES;

      const { generateAutoShifts } = await import('../utils/autoShiftGenerator');

      const generation = await generateAutoShifts({
        cityTimeline,
        unionRules: activeRules
      });

      const coverage = computeCoverageTimeline({
        cityTimeline,
        operationalTimeline: generation.operationalTimeline
      });

      const existingRunId = state.shiftManagement.importMetadata.runId;
      if (existingRunId) {
        try {
          const existingRun = await todShiftRepository.getRun(existingRunId);
          if (existingRun) {
            const archiveTimestamp = formatIsoTimestamp();
            const archivedLabelSuffix = ` (archived ${archiveTimestamp})`;
            await todShiftRepository.createRun({
              cityFileName: `${existingRun.cityFileName ?? 'City Requirements'}${archivedLabelSuffix}`,
              contractorFileName: `${existingRun.contractorFileName ?? 'Previous Shifts'}${archivedLabelSuffix}`,
              importedAt: existingRun.importedAt ?? archiveTimestamp,
              cityTimeline: existingRun.cityTimeline,
              operationalTimeline: existingRun.operationalTimeline,
              shifts: existingRun.shifts,
              lastExportedAt: existingRun.lastExportedAt
            });
          }
        } catch (archiveError) {
          console.warn('Unable to archive previous TOD shift run.', archiveError);
        }
      }

      const optimizedAt = formatIsoTimestamp();
      const optimizedPayload: TodShiftRunPayload = {
        cityFileName: state.shiftManagement.importMetadata.cityFileName ?? 'City Requirements',
        contractorFileName: 'Auto-generated Shifts',
        importedAt: optimizedAt,
        cityTimeline,
        operationalTimeline: generation.operationalTimeline,
        shifts: generation.shifts
      };

      const createdRun = await todShiftRepository.createRun(optimizedPayload);

      const persistedRun: TodShiftRun = {
        ...createdRun,
        coverageTimeline: coverage.timeline,
        colorScale: coverage.colorScale
      };

      try {
        await todShiftRepository.updateRun(persistedRun.id, {
          coverageTimeline: coverage.timeline,
          colorScale: coverage.colorScale
        });
      } catch (updateError) {
        console.warn('Unable to persist coverage timeline for optimized run.', updateError);
      }

      const flattenedWarnings = generation.warnings.flatMap((warning) =>
        warning.messages.map((message) => `${warning.shiftCode}: ${message}`)
      );

      const deficitByDayType = DAY_TYPES.reduce((acc, dayType) => {
        const intervals = coverage.timeline[dayType] ?? [];
        acc[dayType] = intervals.filter((interval) => interval.totalExcess < 0).length;
        return acc;
      }, {} as Record<DayType, number>);

      const totalDeficitIntervals = Object.values(deficitByDayType).reduce((sum, value) => sum + value, 0);
      const compliantShifts = generation.shifts.filter((shift) => shift.unionCompliant).length;
      const warningShifts = generation.shifts.filter((shift) => (shift.complianceWarnings?.length ?? 0) > 0).length;

      const report: OptimizationReport = {
        generatedAt: optimizedAt,
        totalShifts: generation.shifts.length,
        compliantShifts,
        warningShifts,
        deficitIntervals: totalDeficitIntervals,
        deficitByDayType,
        warnings: flattenedWarnings
      };

      return {
        run: persistedRun,
        report
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate optimized shifts.';
      return rejectWithValue(message);
    }
  }
);

export const saveShift = createAsyncThunk(
  'shiftManagement/saveShift',
  async (shift: Omit<Shift, 'id'>, { getState }) => {
    const state = getState() as RootState;
    const activeRules =
      state.shiftManagement.unionRules.length > 0
        ? state.shiftManagement.unionRules
        : DEFAULT_UNION_RULES;

    const violations = await validateShiftAgainstRules(shift, activeRules);
    const shiftWithCompliance = {
      ...shift,
      unionCompliant: !violations.some((v: UnionViolation) => v.violationType === 'error'),
      complianceWarnings: violations.map((v: UnionViolation) => v.violationMessage)
    };

    return { ...shiftWithCompliance, id: Date.now() };
  }
);

const shiftManagementSlice = createSlice({
  name: 'shiftManagement',
  initialState,
  reducers: {
    setActiveScheduleType: (state, action: PayloadAction<DayType>) => {
      state.activeScheduleType = action.payload;
    },
    clearErrors: (state) => {
      state.error = {
        shifts: null,
        unionRules: null,
        imports: null,
        persistence: null,
        optimization: null
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(processTodShiftImports.pending, (state) => {
        state.loading.imports = true;
        state.error.imports = null;
      })
      .addCase(processTodShiftImports.fulfilled, (state, action) => {
        state.loading.imports = false;
        applyRunToState(state, action.payload);
      })
      .addCase(processTodShiftImports.rejected, (state, action) => {
        state.loading.imports = false;
        state.error.imports = (action.payload as string) || action.error.message || 'Failed to process imports.';
      })
      .addCase(fetchLatestTodShiftRun.pending, (state) => {
        state.loading.fetchRun = true;
        state.error.persistence = null;
      })
      .addCase(fetchLatestTodShiftRun.fulfilled, (state, action) => {
        state.loading.fetchRun = false;
        if (action.payload) {
          applyRunToState(state, action.payload);
        }
      })
      .addCase(fetchLatestTodShiftRun.rejected, (state, action) => {
        state.loading.fetchRun = false;
        state.error.persistence = (action.payload as string) || action.error.message || 'Failed to load persisted data.';
      })
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
        state.error.unionRules = action.error.message || 'Failed to load union rules.';
      })
      .addCase(persistUnionRules.pending, (state) => {
        state.loading.unionRulesPersistence = true;
        state.error.unionRules = null;
      })
      .addCase(persistUnionRules.fulfilled, (state, action) => {
        state.loading.unionRulesPersistence = false;
        state.unionRules = action.payload;
      })
      .addCase(persistUnionRules.rejected, (state, action) => {
        state.loading.unionRulesPersistence = false;
        state.error.unionRules = (action.payload as string) || action.error.message || 'Failed to save union rules.';
      })
      .addCase(optimizeShifts.pending, (state) => {
        state.loading.optimization = true;
        state.error.optimization = null;
        state.lastOptimizationReport = null;
      })
      .addCase(optimizeShifts.fulfilled, (state, action) => {
        state.loading.optimization = false;
        applyRunToState(state, action.payload.run);
        state.lastOptimizationReport = action.payload.report;
      })
      .addCase(optimizeShifts.rejected, (state, action) => {
        state.loading.optimization = false;
        state.error.optimization = (action.payload as string) || action.error.message || 'Failed to optimize shifts.';
      })
      .addCase(saveShift.pending, (state) => {
        state.loading.shifts = true;
        state.error.shifts = null;
      })
      .addCase(saveShift.fulfilled, (state, action) => {
        state.loading.shifts = false;
        state.shifts.push(action.payload);
      })
      .addCase(saveShift.rejected, (state, action) => {
        state.loading.shifts = false;
        state.error.shifts = action.error.message || 'Failed to save shift.';
      })
      .addCase(recordShiftExport.pending, (state) => {
        state.loading.persistence = true;
        state.error.persistence = null;
      })
      .addCase(recordShiftExport.fulfilled, (state, action) => {
        state.loading.persistence = false;
        state.importMetadata.lastExportedAt = action.payload;
      })
      .addCase(recordShiftExport.rejected, (state, action) => {
        state.loading.persistence = false;
        state.error.persistence = (action.payload as string) || action.error.message || 'Failed to record export.';
      });
  }
});

function applyRunToState(state: ShiftManagementState, run: TodShiftRun): void {
  state.shifts = run.shifts;
  state.cityTimeline = run.cityTimeline;
  state.operationalTimeline = run.operationalTimeline;
  state.coverageTimeline = run.coverageTimeline ?? createEmptyCoverageTimeline();
  state.colorScale = run.colorScale ?? null;
  state.importMetadata = {
    runId: run.id,
    cityFileName: run.cityFileName,
    contractorFileName: run.contractorFileName,
    importedAt: run.importedAt,
    lastExportedAt: run.lastExportedAt
  };
}

export const { setActiveScheduleType, clearErrors } = shiftManagementSlice.actions;
export default shiftManagementSlice.reducer;

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
import { trimExcessShifts, TrimSummary } from '../utils/shiftTrimmer';
import { normalizeShiftTimes } from '../utils/shiftNormalization';
import type { RootState } from '../../store/store';
import type { OptimizationReport } from '../types/optimization.types';
import { buildSolverCandidates } from '../utils/solverCandidateFactory';
import { buildOperationalTimelineFromShifts } from '../utils/autoShiftGenerator';

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
  history: {
    undoStack: UndoSnapshot[];
  };
  loading: {
    shifts: boolean;
    unionRules: boolean;
    imports: boolean;
    fetchRun: boolean;
    persistence: boolean;
    unionRulesPersistence: boolean;
    optimization: boolean;
    trimming: boolean;
  };
  error: {
    shifts: string | null;
    unionRules: string | null;
    imports: string | null;
    persistence: string | null;
    optimization: string | null;
    trimming: string | null;
  };
  lastOptimizationReport: OptimizationReport | null;
}

interface UndoSnapshot {
  shifts: Shift[];
  operationalTimeline: Record<DayType, OperationalInterval[]>;
  coverageTimeline: Record<DayType, ShiftCoverageInterval[]>;
  colorScale: TodShiftColorScale | null;
  label: string;
  timestamp: string;
}

const MAX_UNDO_HISTORY = 20;

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
    minValue: 5,
    unit: 'hours',
    isActive: true,
    description: 'Shifts must be scheduled for at least 5.0 hours.'
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
  history: {
    undoStack: []
  },
  loading: {
    shifts: false,
    unionRules: false,
    imports: false,
    fetchRun: false,
    persistence: false,
    unionRulesPersistence: false,
    optimization: false,
    trimming: false
  },
  error: {
    shifts: null,
    unionRules: null,
    imports: null,
    persistence: null,
    optimization: null,
    trimming: null
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

export const applyExcessTrimming = createAsyncThunk<
  {
    shifts: Shift[];
    operationalTimeline: Record<DayType, OperationalInterval[]>;
    coverageTimeline: Record<DayType, ShiftCoverageInterval[]>;
    colorScale: TodShiftColorScale | null;
    trimSummary: TrimSummary;
  },
  void,
  { rejectValue: string }
>(
  'shiftManagement/applyExcessTrimming',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const { shifts, coverageTimeline, unionRules, cityTimeline, importMetadata } = state.shiftManagement;
      const hasCoverage = DAY_TYPES.some((dayType) => (coverageTimeline[dayType] ?? []).length > 0);

      if (!hasCoverage) {
        return rejectWithValue('Coverage data unavailable. Run an optimization before trimming.');
      }

      const activeRules = unionRules.length > 0 ? unionRules : DEFAULT_UNION_RULES;
      const trimResult = trimExcessShifts({
        shifts,
        coverageTimeline,
        unionRules: activeRules
      });

      if (trimResult.summary.hoursRemoved <= 0) {
        return rejectWithValue('No surplus vehicle hours available to trim.');
      }

      const { buildOperationalTimelineFromShifts } = await import('../utils/autoShiftGenerator');
      const operationalTimeline = buildOperationalTimelineFromShifts(trimResult.shifts);
      const coverage = computeCoverageTimeline({
        cityTimeline,
        operationalTimeline
      });

      if (importMetadata.runId) {
        try {
          await todShiftRepository.updateRun(importMetadata.runId, {
            shifts: trimResult.shifts,
            operationalTimeline,
            coverageTimeline: coverage.timeline
          });
        } catch (err) {
          console.warn('Unable to persist trimming changes to TOD shift run.', err);
        }
      }

      return {
        shifts: trimResult.shifts,
        operationalTimeline,
        coverageTimeline: coverage.timeline,
        colorScale: coverage.colorScale,
        trimSummary: trimResult.summary
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trim excess vehicle hours.';
      return rejectWithValue(message);
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
        return rejectWithValue('Master schedule data is missing. Import the city requirements before building shifts.');
      }

      const activeRules =
        state.shiftManagement.unionRules.length > 0
          ? state.shiftManagement.unionRules
          : DEFAULT_UNION_RULES;

      const { generateAutoShifts, buildOperationalTimelineFromShifts } = await import('../utils/autoShiftGenerator');

      const generation = await generateAutoShifts({
        cityTimeline,
        unionRules: activeRules
      });

      const solverFeatureEnabled = process.env.REACT_APP_TOD_SOLVER === 'true';
      const solverStaggerEnabled = process.env.REACT_APP_TOD_SOLVER_STAGGER === 'true';
      const trimExcessEnabled = process.env.REACT_APP_TOD_TRIM_EXCESS === 'true';

      let finalShifts = generation.shifts;
      let finalOperationalTimeline = generation.operationalTimeline;
      let solverWarnings: string[] = [];
      let solverCandidateCount = 0;
      let solverSelectedCount = 0;
      let trimmingSummary: TrimSummary | null = null;

      if (solverFeatureEnabled) {
        const { runShiftSolver } = await import('../utils/solverOptimizationEngine');
        const existingCandidates = state.shiftManagement.shifts.flatMap((shift, index) =>
          buildSolverCandidates(shift, {
            prefix: `existing-${index}`,
            existing: true,
            unionRules: activeRules,
            enableVariants: solverStaggerEnabled
          })
        );
        const generatedCandidates = generation.shifts.flatMap((shift, index) =>
          buildSolverCandidates(shift, {
            prefix: `generated-${index}`,
            existing: false,
            unionRules: activeRules,
            enableVariants: solverStaggerEnabled
          })
        );
        const candidatePool = [...existingCandidates, ...generatedCandidates];
        solverCandidateCount = candidatePool.length;

        const solverSelected: Shift[] = [];
        const solverIssues: string[] = [];

        for (const dayType of DAY_TYPES) {
          const coverageIntervals = buildCoverageIntervalsFromCityTimeline(dayType, cityTimeline[dayType] ?? []);
          const dayCandidates = candidatePool.filter((candidate) => candidate.scheduleType === dayType);
          if (dayCandidates.length === 0 || coverageIntervals.length === 0) {
            continue;
          }

          const result = runShiftSolver({
            dayType,
            coverageTimeline: coverageIntervals,
            unionRules: activeRules,
            candidateShifts: dayCandidates
          });

          solverSelected.push(
            ...result.selectedShifts.map((shift) => ({
              ...shift,
              scheduleType: dayType
            }))
          );

          if (result.unmetConstraints.length > 0) {
            solverIssues.push(
              `Unable to satisfy coverage for ${dayType} intervals: ${result.unmetConstraints.join(', ')}`
            );
          }
        }

        solverSelectedCount = solverSelected.length;

        if (solverSelected.length > 0 && solverIssues.length === 0) {
          const evaluatedShifts = await annotateSolverCompliance(solverSelected, activeRules);
          finalShifts = evaluatedShifts;
          finalOperationalTimeline = buildOperationalTimelineFromShifts(finalShifts);
        } else if (solverIssues.length > 0) {
          solverWarnings = solverIssues;
        } else {
          solverWarnings = ['Solver returned no schedule; using heuristic plan.'];
        }
      }

      let coverage = computeCoverageTimeline({
        cityTimeline,
        operationalTimeline: finalOperationalTimeline
      });

      if (trimExcessEnabled) {
        const trimResult = trimExcessShifts({
          shifts: finalShifts,
          coverageTimeline: coverage.timeline,
          unionRules: activeRules
        });

        if (trimResult.summary.hoursRemoved > 0) {
          finalShifts = trimResult.shifts;
          finalOperationalTimeline = buildOperationalTimelineFromShifts(finalShifts);
          coverage = computeCoverageTimeline({
            cityTimeline,
            operationalTimeline: finalOperationalTimeline
          });
          trimmingSummary = trimResult.summary;
        }
      }

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
        operationalTimeline: finalOperationalTimeline,
        shifts: finalShifts
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

      const flattenedWarnings =
        finalShifts === generation.shifts
          ? generation.warnings.flatMap((warning) =>
              warning.messages.map((message) => `${warning.shiftCode}: ${message}`)
            )
          : finalShifts.flatMap((shiftItem) =>
              (shiftItem.complianceWarnings ?? []).map((message) => `${shiftItem.shiftCode}: ${message}`)
            );

      if (solverWarnings.length > 0) {
        flattenedWarnings.push(...solverWarnings);
      }

      if (trimmingSummary) {
        flattenedWarnings.push(
          `Trimmed ${trimmingSummary.hoursRemoved.toFixed(2)} surplus vehicle-hours across ${trimmingSummary.shiftsModified} shift${trimmingSummary.shiftsModified === 1 ? '' : 's'}.`
        );
      }

      const { deficitByDayType, totalDeficitIntervals } = summarizeDeficitIntervals(coverage.timeline);
      const compliantShifts = finalShifts.filter((shift) => shift.unionCompliant).length;
      const warningShifts = finalShifts.filter((shift) => (shift.complianceWarnings?.length ?? 0) > 0).length;

      const report: OptimizationReport = {
        generatedAt: optimizedAt,
        totalShifts: finalShifts.length,
        compliantShifts,
        warningShifts,
        deficitIntervals: totalDeficitIntervals,
        deficitByDayType,
        warnings: flattenedWarnings,
        strategy: finalShifts === generation.shifts ? 'heuristic' : 'solver',
        solverWarnings,
        solverCandidatesEvaluated: solverCandidateCount,
        solverShiftsSelected: solverSelectedCount,
        trimmedVehicleHours: trimmingSummary?.hoursRemoved ?? 0,
        trimmedShiftCount: trimmingSummary?.shiftsModified ?? 0
      };

      return {
        run: persistedRun,
        report
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build shifts.';
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
    const shiftWithCompliance: Shift = {
      ...shift,
      unionCompliant: !violations.some((v: UnionViolation) => v.violationType === 'error'),
      complianceWarnings: violations.map((v: UnionViolation) => v.violationMessage)
    };

    const normalized = normalizeShiftTimes(shiftWithCompliance);
    return { ...normalized, id: Date.now() };
  }
);

export const updateShift = createAsyncThunk(
  'shiftManagement/updateShift',
  async (shift: Shift, { getState }) => {
    const state = getState() as RootState;
    const activeRules =
      state.shiftManagement.unionRules.length > 0
        ? state.shiftManagement.unionRules
        : DEFAULT_UNION_RULES;

    const violations = await validateShiftAgainstRules(shift, activeRules);
    const shiftWithCompliance: Shift = {
      ...shift,
      unionCompliant: !violations.some((v) => v.violationType === 'error'),
      complianceWarnings: violations.map((v) => v.violationMessage)
    };

    return normalizeShiftTimes(shiftWithCompliance);
  }
);

export const deleteShift = createAsyncThunk(
  'shiftManagement/deleteShift',
  async (shiftId: Shift['id']) => shiftId
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
        optimization: null,
        trimming: null
      };
    },
    undoLastShiftChange: (state) => {
      const snapshot = state.history.undoStack.pop();
      if (!snapshot) {
        return;
      }
      state.shifts = snapshot.shifts;
      state.operationalTimeline = snapshot.operationalTimeline;
      state.coverageTimeline = snapshot.coverageTimeline;
      state.colorScale = snapshot.colorScale;
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
      .addCase(applyExcessTrimming.pending, (state) => {
        state.loading.trimming = true;
        state.error.trimming = null;
      })
      .addCase(applyExcessTrimming.fulfilled, (state, action) => {
        state.loading.trimming = false;
        state.error.trimming = null;
        recordUndoSnapshot(state, 'Trim excess vehicle hours');
        state.shifts = action.payload.shifts;
        state.operationalTimeline = action.payload.operationalTimeline;
        state.coverageTimeline = action.payload.coverageTimeline;
        state.colorScale = action.payload.colorScale;

        const { deficitByDayType, totalDeficitIntervals } = summarizeDeficitIntervals(action.payload.coverageTimeline);
        const compliantShifts = action.payload.shifts.filter((shift) => shift.unionCompliant).length;
        const warningShifts = action.payload.shifts.filter((shift) => (shift.complianceWarnings?.length ?? 0) > 0).length;
        const timestamp = formatIsoTimestamp();

        const baseReport = state.lastOptimizationReport ?? {
          generatedAt: timestamp,
          totalShifts: action.payload.shifts.length,
          compliantShifts,
          warningShifts,
          deficitIntervals: totalDeficitIntervals,
          deficitByDayType,
          warnings: ['Coverage trimmed to reduce surplus vehicle hours.']
        };

        state.lastOptimizationReport = {
          ...baseReport,
          totalShifts: action.payload.shifts.length,
          compliantShifts,
          warningShifts,
          deficitIntervals: totalDeficitIntervals,
          deficitByDayType,
          trimmedVehicleHours: (baseReport.trimmedVehicleHours ?? 0) + action.payload.trimSummary.hoursRemoved,
          trimmedShiftCount: (baseReport.trimmedShiftCount ?? 0) + action.payload.trimSummary.shiftsModified
        };
      })
      .addCase(applyExcessTrimming.rejected, (state, action) => {
        state.loading.trimming = false;
        state.error.trimming = (action.payload as string) || action.error.message || 'Failed to trim excess.';
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
        state.error.optimization = (action.payload as string) || action.error.message || 'Failed to build shifts.';
      })
      .addCase(saveShift.pending, (state) => {
        state.loading.shifts = true;
        state.error.shifts = null;
      })
      .addCase(saveShift.fulfilled, (state, action) => {
        state.loading.shifts = false;
        recordUndoSnapshot(state, `Add ${describeShift(action.payload)}`);
        state.shifts.push(action.payload);
        recomputeManualCoverage(state);
      })
      .addCase(saveShift.rejected, (state, action) => {
        state.loading.shifts = false;
        state.error.shifts = action.error.message || 'Failed to save shift.';
      })
      .addCase(updateShift.pending, (state) => {
        state.loading.shifts = true;
        state.error.shifts = null;
      })
      .addCase(updateShift.fulfilled, (state, action) => {
        state.loading.shifts = false;
        const index = state.shifts.findIndex((shift) => shift.id === action.payload.id);
        if (index !== -1) {
          recordUndoSnapshot(state, `Update ${describeShift(state.shifts[index])}`);
          state.shifts[index] = action.payload;
          recomputeManualCoverage(state);
        }
      })
      .addCase(updateShift.rejected, (state, action) => {
        state.loading.shifts = false;
        state.error.shifts = action.error.message || 'Failed to update shift.';
      })
      .addCase(deleteShift.pending, (state) => {
        state.loading.shifts = true;
        state.error.shifts = null;
      })
      .addCase(deleteShift.fulfilled, (state, action) => {
        state.loading.shifts = false;
        const targetIndex = state.shifts.findIndex((shift) => shift.id === action.payload);
        if (targetIndex === -1) {
          return;
        }
        recordUndoSnapshot(state, `Delete ${describeShift(state.shifts[targetIndex])}`);
        state.shifts.splice(targetIndex, 1);
        recomputeManualCoverage(state);
      })
      .addCase(deleteShift.rejected, (state, action) => {
        state.loading.shifts = false;
        state.error.shifts = action.error.message || 'Failed to delete shift.';
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

function buildCoverageIntervalsFromCityTimeline(
  dayType: DayType,
  intervals: CityRequirementInterval[]
): ShiftCoverageInterval[] {
  return intervals.map((interval) => ({
    dayType,
    startTime: interval.startTime,
    endTime: interval.endTime,
    northRequired: interval.northRequired,
    southRequired: interval.southRequired,
    floaterRequired: interval.floaterRequired ?? 0,
    northOperational: 0,
    southOperational: 0,
    floaterOperational: 0,
    floaterAllocatedNorth: 0,
    floaterAllocatedSouth: 0,
    northExcess: -interval.northRequired,
    southExcess: -interval.southRequired,
    floaterExcess: -(interval.floaterRequired ?? 0),
    totalExcess:
      -(interval.northRequired + interval.southRequired + (interval.floaterRequired ?? 0)),
    status: 'deficit'
  }));
}

async function annotateSolverCompliance(shifts: Shift[], unionRules: UnionRule[]): Promise<Shift[]> {
  return Promise.all(
    shifts.map(async (shift) => {
      const violations = await validateShiftAgainstRules(shift, unionRules);
      const normalized = normalizeShiftTimes(shift);
      return {
        ...normalized,
        unionCompliant: !violations.some((violation) => violation.violationType === 'error'),
        complianceWarnings: violations.map((violation) => violation.violationMessage)
      };
    })
  );
}

function cloneShifts(shifts: Shift[]): Shift[] {
  return shifts.map((shift) => ({
    ...shift,
    complianceWarnings: shift.complianceWarnings ? [...shift.complianceWarnings] : undefined
  }));
}

function cloneOperationalTimeline(
  source: Record<DayType, OperationalInterval[]>
): Record<DayType, OperationalInterval[]> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = (source[dayType] ?? []).map((interval) => ({ ...interval }));
    return acc;
  }, {} as Record<DayType, OperationalInterval[]>);
}

function cloneCoverageTimeline(
  source: Record<DayType, ShiftCoverageInterval[]>
): Record<DayType, ShiftCoverageInterval[]> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = (source[dayType] ?? []).map((interval) => ({ ...interval }));
    return acc;
  }, {} as Record<DayType, ShiftCoverageInterval[]>);
}

function cloneColorScale(scale: TodShiftColorScale | null): TodShiftColorScale | null {
  if (!scale) {
    return null;
  }
  return {
    ...scale,
    thresholds: { ...scale.thresholds }
  };
}

function describeShift(shift?: Shift, fallback = 'shift'): string {
  if (!shift) {
    return fallback;
  }
  if (shift.shiftCode && shift.shiftCode.trim().length > 0) {
    return shift.shiftCode;
  }
  if (shift.id !== undefined && shift.id !== null) {
    return String(shift.id);
  }
  return fallback;
}

function recordUndoSnapshot(state: ShiftManagementState, label: string): void {
  const snapshot: UndoSnapshot = {
    shifts: cloneShifts(state.shifts),
    operationalTimeline: cloneOperationalTimeline(state.operationalTimeline),
    coverageTimeline: cloneCoverageTimeline(state.coverageTimeline),
    colorScale: cloneColorScale(state.colorScale),
    label,
    timestamp: formatIsoTimestamp()
  };
  state.history.undoStack.push(snapshot);
  if (state.history.undoStack.length > MAX_UNDO_HISTORY) {
    state.history.undoStack.shift();
  }
}

function ensureUniqueShiftIds(shifts: Shift[]): Shift[] {
  const seen = new Set<string>();
  return shifts.map((shift, index) => {
    const clone = {
      ...shift,
      complianceWarnings: shift.complianceWarnings ? [...shift.complianceWarnings] : undefined
    };
    const baseId = deriveShiftIdentifier(clone, index);
    let candidate = baseId;
    let suffix = 1;
    while (seen.has(candidate)) {
      candidate = `${baseId}-${suffix++}`;
    }
    seen.add(candidate);
    clone.id = candidate;
    return clone;
  });
}

function deriveShiftIdentifier(shift: Shift, index: number): string {
  if (shift.id !== undefined && shift.id !== null) {
    const trimmed = String(shift.id).trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  if (shift.shiftCode && shift.shiftCode.trim().length > 0) {
    return `${shift.shiftCode}-${shift.scheduleType ?? 'day'}-${index}`;
  }
  return `shift-${shift.scheduleType ?? 'day'}-${index}`;
}

function applyRunToState(state: ShiftManagementState, run: TodShiftRun): void {
  state.shifts = ensureUniqueShiftIds(run.shifts);
  state.cityTimeline = run.cityTimeline;
  state.operationalTimeline = cloneOperationalTimeline(run.operationalTimeline);
  const coverageSource = run.coverageTimeline ?? createEmptyCoverageTimeline();
  state.coverageTimeline = cloneCoverageTimeline(coverageSource);
  state.colorScale = cloneColorScale(run.colorScale ?? null);
  state.importMetadata = {
    runId: run.id,
    cityFileName: run.cityFileName,
    contractorFileName: run.contractorFileName,
    importedAt: run.importedAt,
    lastExportedAt: run.lastExportedAt
  };
  state.history.undoStack = [];
}

function summarizeDeficitIntervals(
  timeline: Record<DayType, ShiftCoverageInterval[]>
): { deficitByDayType: Record<DayType, number>; totalDeficitIntervals: number } {
  const deficitByDayType = DAY_TYPES.reduce((acc, dayType) => {
    const intervals = timeline[dayType] ?? [];
    acc[dayType] = intervals.filter((interval) => interval.totalExcess < 0).length;
    return acc;
  }, {} as Record<DayType, number>);

  const totalDeficitIntervals = Object.values(deficitByDayType).reduce((sum, value) => sum + value, 0);
  return { deficitByDayType, totalDeficitIntervals };
}

function recomputeManualCoverage(state: ShiftManagementState): void {
  state.operationalTimeline = buildOperationalTimelineFromShifts(state.shifts);
  const coverage = computeCoverageTimeline({
    cityTimeline: state.cityTimeline,
    operationalTimeline: state.operationalTimeline
  });
  state.coverageTimeline = coverage.timeline;
  state.colorScale = coverage.colorScale;
}

export const { setActiveScheduleType, clearErrors, undoLastShiftChange } = shiftManagementSlice.actions;
export default shiftManagementSlice.reducer;

import { Shift, UnionRule } from '../types/shift.types';
import { SolverCandidateShift } from './solverOptimizationEngine';
import { isMealBreakThresholdRule } from './ruleMatchers';
import {
  INTERVAL_MINUTES,
  TIME_WINDOW_START,
  TIME_WINDOW_END,
  clampToWindow,
  minutesToTimeString,
  parseTimeToMinutes
} from './timeUtils';

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_MIN_SHIFT_MINUTES = 5 * 60;
const DEFAULT_MAX_SHIFT_MINUTES = 9.75 * 60;
const DEFAULT_BREAK_THRESHOLD_MINUTES = 7.5 * 60;
const DEFAULT_BREAK_LATEST_START_MINUTES = 4.75 * 60;
const DEFAULT_BREAK_DURATION_MINUTES = 40;
const DEFAULT_OFFSETS = [-45, -30, -15, 0, 15, 30, 45];

interface BreakWindow {
  offsetMinutes: number;
  durationMinutes: number;
}

interface BuildSolverCandidatesOptions {
  prefix: string;
  existing: boolean;
  unionRules: UnionRule[];
  enableVariants?: boolean;
  offsets?: number[];
}

export interface SolverCandidateSummary {
  variantsGenerated: number;
}

export function buildSolverCandidates(
  shift: Shift,
  options: BuildSolverCandidatesOptions
): SolverCandidateShift[] {
  const minShiftMinutes = extractShiftLimitMinutes(options.unionRules, 'min') ?? DEFAULT_MIN_SHIFT_MINUTES;
  const maxShiftMinutes = extractShiftLimitMinutes(options.unionRules, 'max') ?? DEFAULT_MAX_SHIFT_MINUTES;
  const breakThresholdMinutes = extractBreakRuleMinutes(options.unionRules, 'threshold') ?? DEFAULT_BREAK_THRESHOLD_MINUTES;
  const breakLatestStartMinutes = extractBreakRuleMinutes(options.unionRules, 'latest_start') ?? DEFAULT_BREAK_LATEST_START_MINUTES;
  const breakDurationMinutes = extractBreakRuleMinutes(options.unionRules, 'duration') ?? DEFAULT_BREAK_DURATION_MINUTES;

  const window = computeShiftWindow(shift);
  const baseBreakWindow = buildRelativeBreakWindow(shift, window.startMinutes, breakDurationMinutes);
  const offsets = options.enableVariants ? options.offsets ?? DEFAULT_OFFSETS : [0];
  const uniqueKeyMap = new Map<string, SolverCandidateShift>();
  const baseKey = buildCandidateKey(shift.startTime, shift.endTime, options.existing);
  uniqueKeyMap.set(baseKey, mapShiftToCandidate(shift, options.prefix, options.existing));

  offsets.forEach((startOffset) => {
    offsets.forEach((endOffset) => {
      if (startOffset === 0 && endOffset === 0) {
        return;
      }

      const adjusted = buildVariant(
        shift,
        window,
        startOffset,
        endOffset,
        {
          minShiftMinutes,
          maxShiftMinutes,
          breakThresholdMinutes,
          breakLatestStartMinutes,
          breakDurationMinutes,
          baseBreakWindow
        }
      );

      if (!adjusted) {
        return;
      }

      const key = buildCandidateKey(adjusted.startTime, adjusted.endTime, options.existing);
      if (uniqueKeyMap.has(key)) {
        return;
      }

      uniqueKeyMap.set(
        key,
        mapShiftStructureToCandidate(adjusted, options.prefix, options.existing, uniqueKeyMap.size)
      );
    });
  });

  return Array.from(uniqueKeyMap.values());
}

function buildVariant(
  shift: Shift,
  window: ShiftWindow,
  startOffset: number,
  endOffset: number,
  constraints: {
    minShiftMinutes: number;
    maxShiftMinutes: number;
    breakThresholdMinutes: number;
    breakLatestStartMinutes: number;
    breakDurationMinutes: number;
    baseBreakWindow: BreakWindow | null;
  }
): Shift | null {
  const startDelta = clampOffset(startOffset);
  const endDelta = clampOffset(endOffset);

  let newStart = clampShiftStart(window.startMinutes + startDelta);
  let newEnd = clampShiftEnd(window.endMinutes + endDelta);

  if (newEnd <= newStart) {
    newEnd = newStart + INTERVAL_MINUTES;
  }

  const totalMinutes = newEnd - newStart;
  if (totalMinutes < constraints.minShiftMinutes || totalMinutes > constraints.maxShiftMinutes) {
    return null;
  }

  const updatedBreakWindow = alignBreakWindow(
    constraints.baseBreakWindow,
    newStart,
    newEnd,
    totalMinutes,
    constraints.breakThresholdMinutes,
    constraints.breakLatestStartMinutes,
    constraints.breakDurationMinutes
  );

  if (!updatedBreakWindow && totalMinutes >= constraints.breakThresholdMinutes) {
    return null;
  }

  return {
    ...shift,
    startTime: minutesToTimeString(newStart),
    endTime: minutesToTimeString(newEnd % MINUTES_PER_DAY),
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    breakStart: updatedBreakWindow?.start,
    breakEnd: updatedBreakWindow?.end,
    breakDuration: updatedBreakWindow ? updatedBreakWindow.duration : undefined
  };
}

function alignBreakWindow(
  baseWindow: BreakWindow | null,
  newStart: number,
  newEnd: number,
  totalMinutes: number,
  breakThresholdMinutes: number,
  breakLatestStartMinutes: number,
  breakDurationMinutes: number
): { start: string; end: string; duration: number } | null {
  if (totalMinutes < breakThresholdMinutes) {
    return null;
  }

  let candidateStart = baseWindow ? newStart + baseWindow.offsetMinutes : undefined;
  let durationMinutes = baseWindow?.durationMinutes ?? breakDurationMinutes;

  if (candidateStart === undefined) {
    const midpoint = newStart + Math.floor(totalMinutes / 2);
    const latestStart = newStart + breakLatestStartMinutes;
    const rawStart = Math.min(midpoint - Math.floor(durationMinutes / 2), latestStart);
    candidateStart = Math.max(newStart + INTERVAL_MINUTES, rawStart);
  }

  let candidateEnd = candidateStart + durationMinutes;
  if (candidateEnd > newEnd - INTERVAL_MINUTES) {
    candidateEnd = newEnd - INTERVAL_MINUTES;
    candidateStart = candidateEnd - durationMinutes;
  }

  if (candidateStart < newStart + INTERVAL_MINUTES) {
    candidateStart = newStart + INTERVAL_MINUTES;
    candidateEnd = candidateStart + durationMinutes;
  }

  if (candidateEnd > newEnd - INTERVAL_MINUTES) {
    return null;
  }

  return {
    start: minutesToTimeString(candidateStart % MINUTES_PER_DAY),
    end: minutesToTimeString(candidateEnd % MINUTES_PER_DAY),
    duration: durationMinutes
  };
}

function clampShiftStart(minutes: number): number {
  return clampToWindow(Math.max(minutes, TIME_WINDOW_START));
}

function clampShiftEnd(minutes: number): number {
  return clampToWindow(Math.min(minutes, TIME_WINDOW_END));
}

function clampOffset(value: number): number {
  if (value === 0) {
    return 0;
  }

  const remainder = value % INTERVAL_MINUTES;
  return value - remainder;
}

function buildRelativeBreakWindow(shift: Shift, shiftStart: number, fallbackDuration: number): BreakWindow | null {
  if (!shift.breakStart || !shift.breakEnd) {
    return null;
  }

  let breakStartMinutes = parseTimeToMinutes(shift.breakStart);
  let breakEndMinutes = parseTimeToMinutes(shift.breakEnd);
  if (breakEndMinutes <= breakStartMinutes) {
    breakEndMinutes += MINUTES_PER_DAY;
  }

  const offsetMinutes = breakStartMinutes - shiftStart;
  const durationMinutes = Math.max(breakEndMinutes - breakStartMinutes, fallbackDuration);

  if (durationMinutes <= 0) {
    return null;
  }

  return {
    offsetMinutes,
    durationMinutes
  };
}

function mapShiftToCandidate(shift: Shift, prefix: string, existing: boolean): SolverCandidateShift {
  const identifier = `${shift.shiftCode ?? shift.id ?? 'shift'}`;
  return {
    ...shift,
    solverId: `${prefix}-${identifier}`,
    existing
  };
}

function mapShiftStructureToCandidate(
  shift: Shift,
  prefix: string,
  existing: boolean,
  index: number
): SolverCandidateShift {
  const identifier = `${shift.shiftCode ?? shift.id ?? 'shift'}`;
  return {
    ...shift,
    solverId: `${prefix}-${identifier}-${index}`,
    existing
  };
}

function buildCandidateKey(startTime: string, endTime: string, existing: boolean): string {
  return `${startTime}-${endTime}-${existing ? 'E' : 'N'}`;
}

function extractShiftLimitMinutes(rules: UnionRule[], mode: 'min' | 'max'): number | null {
  const candidate = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'shift_length' &&
      rule.ruleType === 'required' &&
      typeof (mode === 'max' ? rule.maxValue : rule.minValue) === 'number'
  );

  if (!candidate) {
    return null;
  }

  const value = mode === 'max' ? candidate.maxValue : candidate.minValue;
  if (typeof value !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? value : value * 60;
}

function extractBreakRuleMinutes(rules: UnionRule[], type: 'threshold' | 'latest_start' | 'duration'): number | null {
  const baseMatch = (predicate: (rule: UnionRule) => boolean) =>
    rules.find(
      (rule) =>
        rule.isActive &&
        rule.category === 'breaks' &&
        rule.ruleType === 'required' &&
        predicate(rule)
    );

  let match: UnionRule | undefined;

  if (type === 'threshold') {
    match =
      baseMatch((rule) => typeof rule.minValue === 'number' && isMealBreakThresholdRule(rule)) ??
      baseMatch((rule) => typeof rule.minValue === 'number' && rule.ruleName.toLowerCase().includes('threshold'));
  } else if (type === 'latest_start') {
    match = baseMatch((rule) => typeof rule.maxValue === 'number' && rule.ruleName.toLowerCase().includes('latest'));
  } else {
    match = baseMatch((rule) => typeof rule.minValue === 'number' && rule.ruleName.toLowerCase().includes('duration'));
  }

  if (!match) {
    return null;
  }

  const raw = type === 'latest_start' ? match.maxValue : match.minValue;
  if (typeof raw !== 'number') {
    return null;
  }

  if (match.unit === 'minutes') {
    return raw;
  }

  return raw * 60;
}

interface ShiftWindow {
  startMinutes: number;
  endMinutes: number;
}

function computeShiftWindow(shift: Shift): ShiftWindow {
  const startMinutes = parseTimeToMinutes(shift.startTime);
  let endMinutes = parseTimeToMinutes(shift.endTime);

  if (endMinutes <= startMinutes) {
    endMinutes += MINUTES_PER_DAY;
  }

  return {
    startMinutes,
    endMinutes
  };
}

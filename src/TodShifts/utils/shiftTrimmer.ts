import {
  DayType,
  Shift,
  ShiftCoverageInterval,
  ShiftZone,
  UnionRule
} from '../types/shift.types';
import { DAY_TYPES, INTERVAL_MINUTES, minutesToTimeString, parseTimeToMinutes } from './timeUtils';
import { normalizeShiftTimes } from './shiftNormalization';

interface TrimParams {
  shifts: Shift[];
  coverageTimeline: Record<DayType, ShiftCoverageInterval[]>;
  unionRules: UnionRule[];
}

interface CoverageSlot {
  startMinutes: number;
  endMinutes: number;
  excessByZone: Record<ShiftZone, number>;
}

export interface TrimSummary {
  hoursRemoved: number;
  shiftsModified: number;
}

export interface TrimResult {
  shifts: Shift[];
  summary: TrimSummary;
}

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_MIN_SHIFT_MINUTES = 5 * 60;

export function trimExcessShifts({
  shifts,
  coverageTimeline,
  unionRules
}: TrimParams): TrimResult {
  const minShiftMinutes = extractShiftLimitMinutes(unionRules) ?? DEFAULT_MIN_SHIFT_MINUTES;
  const slotsByDay: Record<DayType, CoverageSlot[]> = DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = buildCoverageSlots(coverageTimeline[dayType] ?? []);
    return acc;
  }, {} as Record<DayType, CoverageSlot[]>);

  let totalTrimmedHours = 0;
  let modifiedShifts = 0;

  const adjustedShifts = shifts.map((shift) => {
    const slotList = slotsByDay[shift.scheduleType];
    if (!slotList.length) {
      return shift;
    }

    const cloned: Shift = {
      ...shift,
      complianceWarnings: shift.complianceWarnings ? [...shift.complianceWarnings] : undefined
    };
    const originalStart = parseTimeToMinutes(shift.startTime);
    let adjustedStart = originalStart;
    let adjustedEnd = parseTimeToMinutes(shift.endTime);
    if (adjustedEnd <= adjustedStart) {
      adjustedEnd += MINUTES_PER_DAY;
    }

    const availableReduction = Math.max(0, adjustedEnd - adjustedStart - minShiftMinutes);
    if (availableReduction < INTERVAL_MINUTES) {
      return cloned;
    }

    const headResult = trimLeadingExcess(slotList, adjustedStart, adjustedEnd, shift.zone, minShiftMinutes);
    adjustedStart = headResult.newStart;
    let remainingReduction = Math.max(0, adjustedEnd - adjustedStart - minShiftMinutes);

    const tailResult = trimTrailingExcess(slotList, adjustedStart, adjustedEnd, shift.zone, minShiftMinutes, remainingReduction);
    adjustedEnd = tailResult.newEnd;

    const totalTrimMinutes = headResult.trimmedMinutes + tailResult.trimmedMinutes;
    if (totalTrimMinutes <= 0) {
      return cloned;
    }

    modifiedShifts += 1;
    totalTrimmedHours += ((totalTrimMinutes / 60) * (shift.vehicleCount ?? 1));

    cloned.startTime = minutesToTimeString(adjustedStart % MINUTES_PER_DAY);
    cloned.endTime = minutesToTimeString(adjustedEnd % MINUTES_PER_DAY);
    cloned.totalHours = Number(((adjustedEnd - adjustedStart) / 60).toFixed(2));

    alignBreakWindows(cloned, adjustedStart, adjustedEnd);

    return normalizeShiftTimes(cloned);
  });

  return {
    shifts: adjustedShifts,
    summary: {
      hoursRemoved: Number(totalTrimmedHours.toFixed(2)),
      shiftsModified: modifiedShifts
    }
  };
}

function buildCoverageSlots(intervals: ShiftCoverageInterval[]): CoverageSlot[] {
  return intervals.map((interval) => {
    const startMinutes = parseTimeToMinutes(interval.startTime);
    let endMinutes = parseTimeToMinutes(interval.endTime);
    if (endMinutes <= startMinutes) {
      endMinutes += MINUTES_PER_DAY;
    }

    return {
      startMinutes,
      endMinutes,
      excessByZone: {
        North: Math.max(0, interval.northExcess),
        South: Math.max(0, interval.southExcess),
        Floater: Math.max(0, interval.floaterExcess)
      }
    };
  });
}

function trimLeadingExcess(
  slots: CoverageSlot[],
  startMinutes: number,
  endMinutes: number,
  zone: ShiftZone,
  minShiftMinutes: number
): { newStart: number; trimmedMinutes: number } {
  let cursor = startMinutes;
  let trimmed = 0;
  let allowance = Math.max(0, endMinutes - startMinutes - minShiftMinutes);

  while (allowance >= INTERVAL_MINUTES) {
    const slot = findSlot(slots, cursor);
    if (!slot || slot.excessByZone[zone] <= 0) {
      break;
    }

    const window = Math.min(slot.endMinutes - cursor, allowance);
    if (window < INTERVAL_MINUTES) {
      break;
    }

    cursor += window;
    trimmed += window;
    allowance -= window;
  }

  return {
    newStart: cursor,
    trimmedMinutes: trimmed
  };
}

function trimTrailingExcess(
  slots: CoverageSlot[],
  startMinutes: number,
  endMinutes: number,
  zone: ShiftZone,
  minShiftMinutes: number,
  allowance: number
): { newEnd: number; trimmedMinutes: number } {
  let cursor = endMinutes;
  let trimmed = 0;
  let remaining = Math.max(0, allowance);

  while (remaining >= INTERVAL_MINUTES) {
    const slot = findSlot(slots, cursor - INTERVAL_MINUTES);
    if (!slot || slot.excessByZone[zone] <= 0) {
      break;
    }

    const maxAllowed = cursor - (startMinutes + minShiftMinutes);
    const window = Math.min(cursor - slot.startMinutes, remaining, maxAllowed);
    if (window < INTERVAL_MINUTES) {
      break;
    }

    cursor -= window;
    trimmed += window;
    remaining -= window;
  }

  return {
    newEnd: cursor,
    trimmedMinutes: trimmed
  };
}

function findSlot(slots: CoverageSlot[], minute: number): CoverageSlot | undefined {
  return slots.find((slot) => minute >= slot.startMinutes && minute < slot.endMinutes);
}

function alignBreakWindows(shift: Shift, newStart: number, newEnd: number): void {
  const primary = realignWindow(shift.breakStart, shift.breakEnd, newStart, newEnd);
  if (primary) {
    shift.breakStart = primary.start;
    shift.breakEnd = primary.end;
    shift.breakDuration = primary.duration;
  } else {
    shift.breakStart = undefined;
    shift.breakEnd = undefined;
    shift.breakDuration = undefined;
  }

  const meal = realignWindow(shift.mealBreakStart, shift.mealBreakEnd, newStart, newEnd);
  if (meal) {
    shift.mealBreakStart = meal.start;
    shift.mealBreakEnd = meal.end;
  } else {
    shift.mealBreakStart = undefined;
    shift.mealBreakEnd = undefined;
  }
}

function realignWindow(
  startTime: string | undefined,
  endTime: string | undefined,
  newStart: number,
  newEnd: number
): { start: string; end: string; duration: number } | null {
  if (!startTime || !endTime) {
    return null;
  }

  let windowStart = parseTimeToMinutes(startTime);
  let windowEnd = parseTimeToMinutes(endTime);
  if (windowEnd <= windowStart) {
    windowEnd += MINUTES_PER_DAY;
  }

  const duration = windowEnd - windowStart;
  const minStart = newStart + INTERVAL_MINUTES;
  const maxEnd = newEnd - INTERVAL_MINUTES;

  if (windowStart < minStart) {
    const delta = minStart - windowStart;
    windowStart += delta;
    windowEnd += delta;
  }

  if (windowEnd > maxEnd) {
    const delta = windowEnd - maxEnd;
    windowStart -= delta;
    windowEnd -= delta;
  }

  if (windowEnd <= windowStart || windowStart < minStart || windowEnd > maxEnd) {
    return null;
  }

  return {
    start: minutesToTimeString(windowStart % MINUTES_PER_DAY),
    end: minutesToTimeString(windowEnd % MINUTES_PER_DAY),
    duration
  };
}

function extractShiftLimitMinutes(rules: UnionRule[]): number | null {
  const candidate = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'shift_length' &&
      rule.ruleType === 'required' &&
      typeof rule.minValue === 'number'
  );

  if (!candidate || typeof candidate.minValue !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? candidate.minValue : candidate.minValue * 60;
}

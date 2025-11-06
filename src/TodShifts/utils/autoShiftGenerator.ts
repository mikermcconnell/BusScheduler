import {
  CityRequirementInterval,
  DayType,
  OperationalInterval,
  Shift,
  ShiftZone,
  UnionRule,
  UnionViolation
} from '../types/shift.types';
import {
  DAY_TYPES,
  INTERVAL_MINUTES,
  TIME_WINDOW_END,
  generateTimelineMinutes,
  minutesToTimeString,
  parseTimeToMinutes,
  ensureValidTimeRange,
  clampToWindow,
  floorToInterval,
  ceilToInterval
} from './timeUtils';
import { validateShiftAgainstRules } from './unionRulesValidator';

interface ActiveShift {
  rank: number;
  zone: ShiftZone;
  dayType: DayType;
  startMinutes: number;
  lastIntervalEnd: number;
  intervals: number;
}

export interface ShiftGenerationWarning {
  shiftCode: string;
  messages: string[];
}

export interface AutoShiftGenerationResult {
  shifts: Shift[];
  operationalTimeline: Record<DayType, OperationalInterval[]>;
  warnings: ShiftGenerationWarning[];
}

interface GenerateShiftsParams {
  cityTimeline: Record<DayType, CityRequirementInterval[]>;
  unionRules: UnionRule[];
}

const ZONES: ShiftZone[] = ['North', 'South', 'Floater'];

const DEFAULT_MEAL_DURATION_MINUTES = 40;
const DEFAULT_BREAK_THRESHOLD_MINUTES = 7.5 * 60;
const DEFAULT_BREAK_LATEST_START_MINUTES = 4.75 * 60;
const DEFAULT_MIN_SHIFT_MINUTES = 5 * 60;
const DEFAULT_MAX_SHIFT_MINUTES = 9.75 * 60;

function extractShiftLimitMinutes(
  rules: UnionRule[],
  mode: 'min' | 'max',
  fallback: number
): number {
  const match = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'shift_length' &&
      rule.ruleType === 'required' &&
      typeof (mode === 'max' ? rule.maxValue : rule.minValue) === 'number'
  );

  if (!match) {
    return fallback;
  }

  const rawValue = mode === 'max' ? match.maxValue : match.minValue;
  if (typeof rawValue !== 'number' || rawValue <= 0) {
    return fallback;
  }

  const minutes = match.unit === 'minutes' ? rawValue : rawValue * 60;
  return minutes > 0 ? minutes : fallback;
}

interface ShiftCounter {
  value: number;
}

interface FinalizationContext {
  unionRules: UnionRule[];
  breakThresholdMinutes: number;
  breakLatestStartMinutes: number;
  mealDurationMinutes: number;
  minShiftMinutes: number;
  maxShiftMinutes: number;
  shiftCounter: ShiftCounter;
  generatedShifts: Shift[];
  warnings: ShiftGenerationWarning[];
}

async function finalizeActiveShift(
  active: ActiveShift,
  context: FinalizationContext
): Promise<void> {
  const minEnd = active.startMinutes + context.minShiftMinutes;
  const maxEnd = active.startMinutes + context.maxShiftMinutes;
  let enforcedEnd = Math.max(active.lastIntervalEnd, minEnd);
  if (maxEnd < minEnd) {
    enforcedEnd = Math.min(active.lastIntervalEnd, maxEnd);
  } else {
    enforcedEnd = Math.min(enforcedEnd, maxEnd);
  }
  enforcedEnd = Math.min(enforcedEnd, TIME_WINDOW_END);
  active.lastIntervalEnd = Math.max(enforcedEnd, active.startMinutes + INTERVAL_MINUTES);

  const { shift, warnings: shiftWarning } = await finalizeShift(
    active,
    context.shiftCounter.value++,
    context.unionRules,
    context.breakThresholdMinutes,
    context.breakLatestStartMinutes,
    context.mealDurationMinutes
  );
  context.generatedShifts.push(shift);
  if (shiftWarning) {
    context.warnings.push(shiftWarning);
  }
}

function extractRuleMinutes(
  rules: UnionRule[],
  predicate: (rule: UnionRule) => boolean,
  fallback: number,
  asMinutes = true
): number {
  const match = rules.find(predicate);
  if (!match) {
    return fallback;
  }
  const source = typeof match.minValue === 'number' ? match.minValue : match.maxValue;
  if (typeof source !== 'number') {
    return fallback;
  }
  if (!asMinutes) {
    return source;
  }
  return match.unit === 'minutes' ? source : source * 60;
}

function buildShiftCode(dayType: DayType, zone: ShiftZone, index: number): string {
  const dayToken = dayType.slice(0, 3).toUpperCase();
  const zoneToken = zone === 'Floater' ? 'F' : zone.charAt(0);
  return `AUTO-${dayToken}-${zoneToken}${String(index + 1).padStart(2, '0')}`;
}

function normalizeRequirement(value: number | undefined): number {
  if (!value || value <= 0) {
    return 0;
  }
  return Math.round(value);
}

function getRequirementForZone(interval: CityRequirementInterval, zone: ShiftZone): number {
  switch (zone) {
    case 'North':
      return normalizeRequirement(interval.northRequired);
    case 'South':
      return normalizeRequirement(interval.southRequired);
    case 'Floater':
      return normalizeRequirement(interval.floaterRequired);
    default:
      return 0;
  }
}

async function finalizeShift(
  active: ActiveShift,
  index: number,
  unionRules: UnionRule[],
  breakThresholdMinutes: number,
  breakLatestStartMinutes: number,
  mealDurationMinutes: number
): Promise<{ shift: Shift; warnings: ShiftGenerationWarning | null }> {
  const endMinutes = active.lastIntervalEnd;
  const totalMinutes = Math.max(0, endMinutes - active.startMinutes);

  let breakStartMinutes: number | undefined;
  let breakEndMinutes: number | undefined;

  if (totalMinutes >= breakThresholdMinutes + mealDurationMinutes) {
    const midpoint = active.startMinutes + Math.floor(totalMinutes / 2);
    const latestStart = active.startMinutes + breakLatestStartMinutes;
    const rawStart = Math.min(midpoint - Math.floor(mealDurationMinutes / 2), latestStart);
    const safeStart = Math.max(active.startMinutes + INTERVAL_MINUTES, rawStart);
    const clampedStart = Math.min(safeStart, endMinutes - mealDurationMinutes);
    breakStartMinutes = clampedStart;
    breakEndMinutes = clampedStart + mealDurationMinutes;
  }

  const shiftCode = buildShiftCode(active.dayType, active.zone, index);

  const shiftBase: Shift = {
    id: `${shiftCode}-${active.dayType}`,
    shiftCode,
    scheduleType: active.dayType,
    zone: active.zone,
    startTime: minutesToTimeString(active.startMinutes),
    endTime: minutesToTimeString(endMinutes),
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    breakStart: breakStartMinutes !== undefined ? minutesToTimeString(breakStartMinutes) : undefined,
    breakEnd: breakEndMinutes !== undefined ? minutesToTimeString(breakEndMinutes) : undefined,
    breakDuration:
      breakStartMinutes !== undefined && breakEndMinutes !== undefined
        ? breakEndMinutes - breakStartMinutes
        : undefined,
    isSplitShift: false,
    unionCompliant: true,
    complianceWarnings: [],
    vehicleCount: 1
  };

  const violations = await validateShiftAgainstRules(shiftBase, unionRules);
  const shift: Shift = {
    ...shiftBase,
    unionCompliant: violations.every((violation) => violation.violationType !== 'error'),
    complianceWarnings: violations.map((violation) => violation.violationMessage)
  };

  if (violations.length === 0) {
    return { shift, warnings: null };
  }

  const warning: ShiftGenerationWarning = {
    shiftCode,
    messages: violations.map((violation: UnionViolation) => violation.violationMessage)
  };

  return { shift, warnings: warning };
}

function ensureIntervalRecord(
  map: Map<number, OperationalInterval>,
  cursor: number,
  dayType: DayType
): OperationalInterval {
  if (!map.has(cursor)) {
    map.set(cursor, {
      dayType,
      startTime: minutesToTimeString(cursor),
      endTime: minutesToTimeString(cursor + INTERVAL_MINUTES >= TIME_WINDOW_END ? TIME_WINDOW_END : cursor + INTERVAL_MINUTES),
      northOperational: 0,
      southOperational: 0,
      floaterOperational: 0,
      breakCount: 0
    });
  }
  return map.get(cursor)!;
}

export function buildOperationalTimelineFromShifts(shifts: Shift[]): Record<DayType, OperationalInterval[]> {
  const timeline = generateTimelineMinutes();
  const maps = new Map<DayType, Map<number, OperationalInterval>>();

  DAY_TYPES.forEach((dayType) => {
    maps.set(dayType, new Map());
  });

  shifts.forEach((shift) => {
    const dayMap = maps.get(shift.scheduleType)!;
    const [start, end] = ensureValidTimeRange(parseTimeToMinutes(shift.startTime), parseTimeToMinutes(shift.endTime));

    for (let cursor = floorToInterval(start); cursor < end; cursor += INTERVAL_MINUTES) {
      if (cursor >= TIME_WINDOW_END) {
        break;
      }
      const interval = ensureIntervalRecord(dayMap, cursor, shift.scheduleType);
      switch (shift.zone) {
        case 'North':
          interval.northOperational += shift.vehicleCount ?? 1;
          break;
        case 'South':
          interval.southOperational += shift.vehicleCount ?? 1;
          break;
        case 'Floater':
          interval.floaterOperational += shift.vehicleCount ?? 1;
          break;
      }
    }

    if (shift.breakStart && shift.breakEnd) {
      const breakStart = floorToInterval(parseTimeToMinutes(shift.breakStart));
      const breakEnd = ceilToInterval(parseTimeToMinutes(shift.breakEnd));
      for (let cursor = breakStart; cursor < breakEnd; cursor += INTERVAL_MINUTES) {
        if (cursor >= TIME_WINDOW_END) {
          break;
        }
        const interval = ensureIntervalRecord(dayMap, cursor, shift.scheduleType);
        interval.breakCount = (interval.breakCount ?? 0) + 1;
      }
    }
  });

  const result: Record<DayType, OperationalInterval[]> = DAY_TYPES.reduce((acc, dayType) => {
    const map = maps.get(dayType)!;
    acc[dayType] = timeline.map((cursor) => {
      const interval = map.get(cursor);
      return (
        interval ?? {
          dayType,
          startTime: minutesToTimeString(cursor),
          endTime: minutesToTimeString(cursor + INTERVAL_MINUTES >= TIME_WINDOW_END ? TIME_WINDOW_END : cursor + INTERVAL_MINUTES),
          northOperational: 0,
          southOperational: 0,
          floaterOperational: 0,
          breakCount: 0
        }
      );
    });
    return acc;
  }, {} as Record<DayType, OperationalInterval[]>);

  return result;
}

export async function generateAutoShifts({
  cityTimeline,
  unionRules
}: GenerateShiftsParams): Promise<AutoShiftGenerationResult> {
  const mealDurationMinutes = extractRuleMinutes(
    unionRules,
    (rule) => rule.ruleName.toLowerCase().includes('meal break duration'),
    DEFAULT_MEAL_DURATION_MINUTES
  );
  const breakThresholdMinutes = extractRuleMinutes(
    unionRules,
    (rule) => rule.ruleName.toLowerCase().includes('threshold'),
    DEFAULT_BREAK_THRESHOLD_MINUTES
  );
  const breakLatestStartMinutes = extractRuleMinutes(
    unionRules,
    (rule) => rule.ruleName.toLowerCase().includes('latest start'),
    DEFAULT_BREAK_LATEST_START_MINUTES
  );
  const minShiftMinutes = Math.max(
    INTERVAL_MINUTES,
    extractShiftLimitMinutes(unionRules, 'min', DEFAULT_MIN_SHIFT_MINUTES)
  );
  const maxShiftMinutes = Math.max(
    INTERVAL_MINUTES,
    extractShiftLimitMinutes(unionRules, 'max', DEFAULT_MAX_SHIFT_MINUTES)
  );

  const generatedShifts: Shift[] = [];
  const warnings: ShiftGenerationWarning[] = [];

  for (const dayType of DAY_TYPES) {
    const intervals = [...(cityTimeline[dayType] ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    if (intervals.length === 0) {
      continue;
    }

    for (const zone of ZONES) {
      const activeShifts = new Map<number, ActiveShift>();
      const finalizationContext: FinalizationContext = {
        unionRules,
        breakThresholdMinutes,
        breakLatestStartMinutes,
        mealDurationMinutes,
        minShiftMinutes,
        maxShiftMinutes,
        shiftCounter: { value: 0 },
        generatedShifts,
        warnings
      };
      for (let intervalIndex = 0; intervalIndex < intervals.length; intervalIndex++) {
        const interval = intervals[intervalIndex];
        const requirement = getRequirementForZone(interval, zone);
        const intervalStartMinutes = clampToWindow(parseTimeToMinutes(interval.startTime));
        let intervalEndMinutes = parseTimeToMinutes(interval.endTime);
        if (intervalEndMinutes <= intervalStartMinutes) {
          intervalEndMinutes += 24 * 60;
        }
        intervalEndMinutes = clampToWindow(intervalEndMinutes);

        const ranksToClose = Array.from(activeShifts.keys())
          .filter((rank) => rank >= requirement)
          .sort((a, b) => b - a);
        for (const rank of ranksToClose) {
          const active = activeShifts.get(rank);
          if (!active) {
            continue;
          }
          const durationSoFar = intervalStartMinutes - active.startMinutes;
          if (durationSoFar < minShiftMinutes) {
            continue;
          }
          activeShifts.delete(rank);
          active.lastIntervalEnd = intervalStartMinutes;
          await finalizeActiveShift(active, finalizationContext);
        }

        for (let rank = 0; rank < requirement; rank++) {
          if (!activeShifts.has(rank)) {
            activeShifts.set(rank, {
              rank,
              zone,
              dayType,
              startMinutes: intervalStartMinutes,
              lastIntervalEnd: intervalStartMinutes,
              intervals: 0
            });
          }
        }

        const entries = Array.from(activeShifts.entries());
        for (const [rank, active] of entries) {
          let currentActive = active;
          if (currentActive.lastIntervalEnd < intervalStartMinutes) {
            currentActive.lastIntervalEnd = intervalStartMinutes;
          }

          while (currentActive.lastIntervalEnd < intervalEndMinutes) {
            const maxAllowedEnd = currentActive.startMinutes + maxShiftMinutes;
            const nextEnd = Math.min(intervalEndMinutes, maxAllowedEnd);
            currentActive.lastIntervalEnd = nextEnd;
            currentActive.intervals += 1;

            const reachedLimit = nextEnd >= maxAllowedEnd;
            const intervalCovered = nextEnd >= intervalEndMinutes;

            if (reachedLimit) {
              await finalizeActiveShift(currentActive, finalizationContext);
              const replacement: ActiveShift = {
                rank: currentActive.rank,
                zone: currentActive.zone,
                dayType: currentActive.dayType,
                startMinutes: nextEnd,
                lastIntervalEnd: nextEnd,
                intervals: 0
              };
              activeShifts.set(rank, replacement);
              currentActive = replacement;

              if (intervalCovered) {
                break;
              }
            } else {
              activeShifts.set(rank, currentActive);
              break;
            }
          }
        }

        if (intervalIndex === intervals.length - 1) {
          const leftover = Array.from(activeShifts.values());
          activeShifts.clear();
          for (const active of leftover) {
            await finalizeActiveShift(active, finalizationContext);
          }
        }
      }
    }
  }

  const operationalTimeline = buildOperationalTimelineFromShifts(generatedShifts);
  return {
    shifts: generatedShifts.sort((a, b) => {
      if (a.scheduleType === b.scheduleType) {
        return a.startTime.localeCompare(b.startTime);
      }
      return DAY_TYPES.indexOf(a.scheduleType) - DAY_TYPES.indexOf(b.scheduleType);
    }),
    operationalTimeline,
    warnings
  };
}

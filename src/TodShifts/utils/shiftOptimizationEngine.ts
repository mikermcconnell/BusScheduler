import {
  DayType,
  Shift,
  ShiftCoverageInterval,
  ShiftZone,
  UnionRule
} from '../types/shift.types';
import { INTERVAL_MINUTES, minutesToTimeString, parseTimeToMinutes } from './timeUtils';
import { isMealBreakThresholdRule } from './ruleMatchers';

type RecommendationType = 'extend_shift' | 'new_shift' | 'break_adjustment';

interface ZoneDescriptor {
  zone: ShiftZone;
  excessField: 'northExcess' | 'southExcess';
}

const ZONES: ZoneDescriptor[] = [
  { zone: 'North', excessField: 'northExcess' },
  { zone: 'South', excessField: 'southExcess' }
];

const SHIFT_EXTENSION_BUFFER_MINUTES = 60;
const MAX_EXTENSION_BUFFER_MINUTES = 120;
const DEFAULT_IDEAL_SHIFT_HOURS = 7.2;
const DEFAULT_MIN_SHIFT_HOURS = 5;
const DEFAULT_BREAK_THRESHOLD_HOURS = 7.5;
const DEFAULT_BREAK_LATEST_START_HOURS = 4.75;

export interface OptimizationImpactAdjustment {
  intervalKey: string;
  zone: ShiftZone;
  coverageGain: number;
}

export interface OptimizationImpact {
  adjustments: OptimizationImpactAdjustment[];
}

export interface DeficitBlock {
  id: string;
  zone: ShiftZone;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  vehicleHours: number;
  peakShortfall: number;
  intervals: ShiftCoverageInterval[];
}

export interface OptimizationRecommendation {
  id: string;
  type: RecommendationType;
  zone: ShiftZone;
  title: string;
  summary: string;
  detailItems: string[];
  affectedShiftCodes: Array<string | number>;
  priority: 'high' | 'medium' | 'low';
  deficit: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    peakShortfall: number;
  };
  impact: OptimizationImpact;
}

export interface OptimizationInsights {
  blocks: DeficitBlock[];
  recommendations: OptimizationRecommendation[];
  totals: {
    blockCount: number;
    totalVehicleHours: number;
    maxShortfall: number;
  };
}

interface OptimizationInput {
  dayType: DayType;
  coverageTimeline: Record<DayType, ShiftCoverageInterval[]>;
  shifts: Shift[];
  unionRules: UnionRule[];
}

interface ShiftWindow {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  durationHours: number;
}

interface ShiftExtensionOption {
  shift: Shift;
  direction: 'extend_start' | 'extend_end';
  addedMinutes: number;
  resultingHours: number;
  gapMinutes: number;
}

interface BreakAdjustmentOption {
  shift: Shift;
  currentStartMinutes: number;
  currentEndMinutes: number;
  suggestedStartMinutes: number;
  suggestedEndMinutes: number;
}

export function computeOptimizationInsights({
  dayType,
  coverageTimeline,
  shifts,
  unionRules
}: OptimizationInput): OptimizationInsights {
  const intervals = coverageTimeline[dayType] ?? [];
  const blocks = buildDeficitBlocks(intervals);
  const relevantShifts = shifts.filter((shift) => shift.scheduleType === dayType);

  const recommendations = buildRecommendations(blocks, relevantShifts, unionRules);

  return {
    blocks,
    recommendations,
    totals: {
      blockCount: blocks.length,
      totalVehicleHours: Number(
        blocks.reduce((sum, block) => sum + block.vehicleHours, 0).toFixed(2)
      ),
      maxShortfall: blocks.reduce((max, block) => Math.max(max, block.peakShortfall), 0)
    }
  };
}

function buildDeficitBlocks(intervals: ShiftCoverageInterval[]): DeficitBlock[] {
  const blocks: DeficitBlock[] = [];

  ZONES.forEach((descriptor) => {
    let currentBlock: DeficitBlock | null = null;

    intervals.forEach((interval, index) => {
      const deficit = Math.max(0, -interval[descriptor.excessField]);
      const intervalMinutes = computeIntervalMinutes(interval);

      if (deficit > 0) {
        if (!currentBlock) {
          const startMinutes = parseTimeToMinutes(interval.startTime);
          let endMinutes = parseTimeToMinutes(interval.endTime);
          if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60;
          }

          currentBlock = {
            id: `${descriptor.zone}-${interval.startTime}-${index}`,
            zone: descriptor.zone,
            startTime: interval.startTime,
            endTime: interval.endTime,
            startMinutes,
            endMinutes,
            durationMinutes: intervalMinutes,
            vehicleHours: (deficit * intervalMinutes) / 60,
            peakShortfall: deficit,
            intervals: [interval]
          };
        } else {
          currentBlock.endTime = interval.endTime;
          currentBlock.endMinutes += intervalMinutes;
          currentBlock.durationMinutes += intervalMinutes;
          currentBlock.vehicleHours += (deficit * intervalMinutes) / 60;
          currentBlock.peakShortfall = Math.max(currentBlock.peakShortfall, deficit);
          currentBlock.intervals.push(interval);
        }
      } else if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }
  });

  return blocks.sort((a, b) => a.startMinutes - b.startMinutes);
}

function buildRecommendations(
  blocks: DeficitBlock[],
  shifts: Shift[],
  unionRules: UnionRule[]
): OptimizationRecommendation[] {
  if (!blocks.length) {
    return [];
  }

  const maxShiftHours = extractShiftLengthHours(unionRules, 'max') ?? 9.75;
  const minShiftHours = extractShiftLengthHours(unionRules, 'min') ?? DEFAULT_MIN_SHIFT_HOURS;
  const minBreakMinutes = extractBreakDurationMinutes(unionRules) ?? 40;
  const breakThresholdHours = extractBreakThresholdHours(unionRules) ?? DEFAULT_BREAK_THRESHOLD_HOURS;
  const breakLatestStartHours = extractBreakLatestStartHours(unionRules) ?? DEFAULT_BREAK_LATEST_START_HOURS;
  const idealShiftHours = extractIdealShiftHours(unionRules) ?? DEFAULT_IDEAL_SHIFT_HOURS;

  const results: OptimizationRecommendation[] = [];

  blocks.forEach((block, index) => {
    const zoneShifts = shifts.filter((shift) => shift.zone === block.zone);
    const extensionBuffer = determineExtensionBuffer(block);
    const extensionOptions = findShiftExtensionOptions(block, zoneShifts, maxShiftHours, extensionBuffer);
    const shortfallVehicles = Math.max(1, Math.ceil(block.peakShortfall));

    let coveredByExtension = 0;
    if (extensionOptions.length > 0) {
      coveredByExtension = Math.min(shortfallVehicles, extensionOptions.length);
      const targetedOptions = extensionOptions.slice(0, coveredByExtension);
      results.push(buildExtensionRecommendation(block, targetedOptions));
    }

    const remainingShortfall = Math.max(0, shortfallVehicles - coveredByExtension);
    if (remainingShortfall > 0) {
      const nextAdjacentBlock = blocks.slice(index + 1).find(
        (candidate) =>
          candidate.zone === block.zone &&
          candidate.startMinutes - block.endMinutes <= INTERVAL_MINUTES
      );

      results.push(
        buildNewShiftRecommendation(
          block,
          remainingShortfall,
          maxShiftHours,
          minShiftHours,
          idealShiftHours,
          nextAdjacentBlock
        )
      );
    }

    const breakThresholdMinutes = Math.round(breakThresholdHours * 60);
    const breakLatestStartMinutes = Math.round(breakLatestStartHours * 60);
    const breakOptions = findBreakAdjustments(
      block,
      zoneShifts,
      minBreakMinutes,
      breakThresholdMinutes,
      breakLatestStartMinutes
    );
    breakOptions.slice(0, 2).forEach((option, optionIndex) => {
      results.push(buildBreakRecommendation(block, option, optionIndex));
    });
  });

  return results;
}

function determineExtensionBuffer(block: DeficitBlock): number {
  const scaled = Math.max(
    SHIFT_EXTENSION_BUFFER_MINUTES,
    Math.min(block.durationMinutes + INTERVAL_MINUTES, MAX_EXTENSION_BUFFER_MINUTES)
  );
  return Math.max(scaled, SHIFT_EXTENSION_BUFFER_MINUTES);
}

function findShiftExtensionOptions(
  block: DeficitBlock,
  shifts: Shift[],
  maxShiftHours: number,
  bufferMinutes: number
): ShiftExtensionOption[] {
  return shifts
    .map((shift) => {
      const window = computeShiftWindow(shift);
      const extendEndGap = block.startMinutes - window.endMinutes;
      if (
        extendEndGap >= 0 &&
        extendEndGap <= bufferMinutes
      ) {
        const addedMinutes = block.endMinutes - window.endMinutes;
        const resultingHours = window.durationHours + addedMinutes / 60;
        if (resultingHours <= maxShiftHours) {
          return {
            shift,
            direction: 'extend_end' as const,
            addedMinutes,
            resultingHours,
            gapMinutes: extendEndGap
          };
        }
      }

      const extendStartGap = window.startMinutes - block.startMinutes;
      if (
        extendStartGap >= 0 &&
        extendStartGap <= bufferMinutes
      ) {
        const addedMinutes = window.startMinutes - block.startMinutes;
        const resultingHours = window.durationHours + addedMinutes / 60;
        if (resultingHours <= maxShiftHours) {
          return {
            shift,
            direction: 'extend_start' as const,
            addedMinutes,
            resultingHours,
            gapMinutes: extendStartGap
          };
        }
      }

      return null;
    })
    .filter((option): option is ShiftExtensionOption => Boolean(option))
    .sort((a, b) => a.gapMinutes - b.gapMinutes);
}

function findBreakAdjustments(
  block: DeficitBlock,
  shifts: Shift[],
  minBreakMinutes: number,
  breakThresholdMinutes: number,
  breakLatestStartMinutes: number
): BreakAdjustmentOption[] {
  if (minBreakMinutes <= 0) {
    return [];
  }

  return shifts
    .filter((shift) => shift.breakStart && shift.breakEnd)
    .map((shift) => {
      const breakStartMinutes = parseTimeToMinutes(shift.breakStart!);
      let breakEndMinutes = parseTimeToMinutes(shift.breakEnd!);
      if (breakEndMinutes <= breakStartMinutes) {
        breakEndMinutes += 24 * 60;
      }

      if (
        breakStartMinutes >= block.endMinutes ||
        breakEndMinutes <= block.startMinutes
      ) {
        return null;
      }

      const window = computeShiftWindow(shift);
      const breakDuration = breakEndMinutes - breakStartMinutes;
      const canMoveEarlier = block.startMinutes - window.startMinutes >= breakDuration;
      const canMoveLater = window.endMinutes - block.endMinutes >= breakDuration;

      if (!canMoveEarlier && !canMoveLater) {
        return null;
      }

      const shiftRequiresMealBreak = window.durationMinutes >= breakThresholdMinutes;
      const headroomBefore = block.startMinutes - window.startMinutes;
      const headroomAfter = window.endMinutes - block.endMinutes;
      const moveEarlier = canMoveEarlier && (!canMoveLater || headroomBefore <= headroomAfter);

      const proposed = moveEarlier
        ? {
            start: block.startMinutes - breakDuration,
            end: block.startMinutes
          }
        : {
            start: block.endMinutes,
            end: block.endMinutes + breakDuration
          };

      let suggestedStartMinutes = Math.max(proposed.start, window.startMinutes);
      let suggestedEndMinutes = suggestedStartMinutes + breakDuration;

      if (suggestedEndMinutes > window.endMinutes) {
        return null;
      }

      const alignToInterval = (value: number, earlier: boolean) =>
        earlier
          ? Math.floor(value / INTERVAL_MINUTES) * INTERVAL_MINUTES
          : Math.ceil(value / INTERVAL_MINUTES) * INTERVAL_MINUTES;

      const alignedStart = Math.min(
        window.endMinutes - breakDuration,
        Math.max(window.startMinutes, alignToInterval(suggestedStartMinutes, moveEarlier))
      );
      const alignedEnd = alignedStart + breakDuration;

      if (!(alignedEnd <= block.startMinutes || alignedStart >= block.endMinutes)) {
        return null;
      }

      if (shiftRequiresMealBreak) {
        const offsetMinutes = alignedStart - window.startMinutes;
        if (offsetMinutes > breakLatestStartMinutes) {
          return null;
        }
      }

      if (alignedStart === breakStartMinutes && alignedEnd === breakEndMinutes) {
        return null;
      }

      return {
        shift,
        currentStartMinutes: breakStartMinutes,
        currentEndMinutes: breakEndMinutes,
        suggestedStartMinutes: alignedStart,
        suggestedEndMinutes: alignedEnd
      };
    })
    .filter((option): option is BreakAdjustmentOption => Boolean(option));
}

function buildExtensionRecommendation(
  block: DeficitBlock,
  options: ShiftExtensionOption[]
): OptimizationRecommendation {
  const affectedCodes = options.map((option) => option.shift.shiftCode || option.shift.id || 'Shift');
  const directionSummary = options[0]?.direction === 'extend_end' ? 'extend the tail' : 'start earlier';

  const detailItems = options.map((option) => {
    const verb = option.direction === 'extend_end' ? 'Extend' : 'Advance start for';
    return `${verb} ${option.shift.shiftCode || option.shift.id} by ${Math.round(option.addedMinutes)} minutes (total ${option.resultingHours.toFixed(1)} hrs).`;
  });

  return {
    id: `${block.id}-extend`,
    type: 'extend_shift',
    zone: block.zone,
    title: `${block.zone} | Extend ${options.length} shift${options.length > 1 ? 's' : ''}`,
    summary: `Coverage gap ${block.startTime}–${block.endTime} can be reduced if we ${directionSummary} on existing work.`,
    detailItems,
    affectedShiftCodes: affectedCodes,
    priority: block.peakShortfall >= 2 ? 'high' : 'medium',
    deficit: {
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: block.durationMinutes,
      peakShortfall: block.peakShortfall
    },
    impact: {
      adjustments: block.intervals.map((interval) => ({
        intervalKey: createIntervalKey(interval, block.zone),
        zone: block.zone,
        coverageGain: options.length
      }))
    }
  };
}

function buildNewShiftRecommendation(
  block: DeficitBlock,
  requiredShifts: number,
  maxShiftHours: number,
  minShiftHours: number,
  idealShiftHours: number,
  nextAdjacentBlock?: DeficitBlock
): OptimizationRecommendation {
  const minShiftMinutes = Math.round(minShiftHours * 60);
  const maxShiftMinutes = Math.round(maxShiftHours * 60);
  const idealShiftMinutes = Math.round(idealShiftHours * 60);
  const coverageEndCandidate = (() => {
    if (
      nextAdjacentBlock &&
      nextAdjacentBlock.zone === block.zone &&
      nextAdjacentBlock.startMinutes - block.endMinutes <= INTERVAL_MINUTES
    ) {
      const span = nextAdjacentBlock.endMinutes - block.startMinutes;
      if (span <= maxShiftMinutes) {
        return nextAdjacentBlock.endMinutes;
      }
    }
    return block.endMinutes;
  })();

  const coverageMinutes = coverageEndCandidate - block.startMinutes;
  const minimumCoverageMinutes = Math.max(
    minShiftMinutes,
    Math.ceil(coverageMinutes / INTERVAL_MINUTES) * INTERVAL_MINUTES
  );

  let recommendedMinutes = idealShiftMinutes;
  recommendedMinutes = Math.max(recommendedMinutes, minimumCoverageMinutes);
  recommendedMinutes = Math.min(recommendedMinutes, maxShiftMinutes);

  // Align to planning interval to keep times clean for schedulers.
  recommendedMinutes = Math.max(
    minShiftMinutes,
    Math.min(
      maxShiftMinutes,
      Math.round(recommendedMinutes / INTERVAL_MINUTES) * INTERVAL_MINUTES
    )
  );

  if (recommendedMinutes < minimumCoverageMinutes) {
    recommendedMinutes = minimumCoverageMinutes;
  }

  const recommendedEndMinutes = Math.min(
    block.startMinutes + maxShiftMinutes,
    block.startMinutes + recommendedMinutes
  );

  const finalMinutes = recommendedEndMinutes - block.startMinutes;

  return {
    id: `${block.id}-new-shift`,
    type: 'new_shift',
    zone: block.zone,
    title: `${block.zone} | Add ${requiredShifts} new shift${requiredShifts > 1 ? 's' : ''}`,
    summary: `Shortfall of ${requiredShifts} operator${requiredShifts > 1 ? 's' : ''} over ${block.startTime}–${block.endTime}. Recommend scheduling ${minutesToTimeString(block.startMinutes)}–${minutesToTimeString(recommendedEndMinutes)} (${(finalMinutes / 60).toFixed(1)} hrs).`,
    detailItems: [
      'Align start with the first deficit interval to immediately close the gap.',
      `Respect union limits: min ${minShiftHours.toFixed(1)} hrs, max ${maxShiftHours.toFixed(1)} hrs.`,
      `Aim for the ideal shift target of ${idealShiftHours.toFixed(1)} hrs when feasible.`
    ],
    affectedShiftCodes: [],
    priority: 'high',
    deficit: {
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: block.durationMinutes,
      peakShortfall: block.peakShortfall
    },
    impact: {
      adjustments: block.intervals.map((interval) => ({
        intervalKey: createIntervalKey(interval, block.zone),
        zone: block.zone,
        coverageGain: requiredShifts
      }))
    }
  };
}

function buildBreakRecommendation(
  block: DeficitBlock,
  option: BreakAdjustmentOption,
  index: number
): OptimizationRecommendation {
  return {
    id: `${block.id}-break-${index}`,
    type: 'break_adjustment',
    zone: block.zone,
    title: `${block.zone} | Shift break for ${option.shift.shiftCode || option.shift.id}`,
    summary: `Break currently overlaps ${block.startTime}–${block.endTime}. Move it to ${minutesToTimeString(option.suggestedStartMinutes)}–${minutesToTimeString(option.suggestedEndMinutes)} to keep coverage.`,
    detailItems: [
      `Current break: ${minutesToTimeString(option.currentStartMinutes)}–${minutesToTimeString(option.currentEndMinutes % (24 * 60))}.`,
      'Break duration stays the same to maintain union compliance.'
    ],
    affectedShiftCodes: [option.shift.shiftCode || option.shift.id || 'Shift'],
    priority: 'medium',
    deficit: {
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: block.durationMinutes,
      peakShortfall: block.peakShortfall
    },
    impact: {
      adjustments: block.intervals.map((interval) => ({
        intervalKey: createIntervalKey(interval, block.zone),
        zone: block.zone,
        coverageGain: 1
      }))
    }
  };
}

function computeShiftWindow(shift: Shift): ShiftWindow {
  const startMinutes = parseTimeToMinutes(shift.startTime);
  let endMinutes = parseTimeToMinutes(shift.endTime);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = endMinutes - startMinutes;
  const durationHours = shift.totalHours ?? durationMinutes / 60;

  return {
    startMinutes,
    endMinutes,
    durationMinutes,
    durationHours
  };
}

function computeIntervalMinutes(interval: ShiftCoverageInterval): number {
  const startMinutes = parseTimeToMinutes(interval.startTime);
  let endMinutes = parseTimeToMinutes(interval.endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return Math.max(INTERVAL_MINUTES, endMinutes - startMinutes);
}

function extractShiftLengthHours(rules: UnionRule[], mode: 'max' | 'min'): number | null {
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

  const value =
    mode === 'max'
      ? candidate.maxValue
      : candidate.minValue;

  if (typeof value !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? value / 60 : value;
}

function extractBreakDurationMinutes(rules: UnionRule[]): number | null {
  const candidate = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'breaks' &&
      rule.ruleType === 'required' &&
      typeof rule.minValue === 'number' &&
      (rule.unit === 'minutes' || rule.ruleName.toLowerCase().includes('duration'))
  );

  if (!candidate || typeof candidate.minValue !== 'number') {
    return null;
  }

  return candidate.unit === 'hours' ? Math.round(candidate.minValue * 60) : candidate.minValue;
}

function extractBreakThresholdHours(rules: UnionRule[]): number | null {
  const candidate =
    rules.find(
      (rule) =>
        rule.isActive &&
        rule.category === 'breaks' &&
        rule.ruleType === 'required' &&
        typeof rule.minValue === 'number' &&
        isMealBreakThresholdRule(rule)
    ) ??
    rules.find(
      (rule) =>
        rule.isActive &&
        rule.category === 'breaks' &&
        rule.ruleType === 'required' &&
        typeof rule.minValue === 'number' &&
        rule.ruleName.toLowerCase().includes('threshold')
    );

  if (!candidate || typeof candidate.minValue !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? candidate.minValue / 60 : candidate.minValue;
}

function extractBreakLatestStartHours(rules: UnionRule[]): number | null {
  const candidate = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'breaks' &&
      rule.ruleType === 'required' &&
      typeof rule.maxValue === 'number' &&
      rule.ruleName.toLowerCase().includes('latest start')
  );

  if (!candidate || typeof candidate.maxValue !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? candidate.maxValue / 60 : candidate.maxValue;
}

export function extractIdealShiftHours(rules: UnionRule[]): number | null {
  const candidate = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'shift_length' &&
      rule.ruleType === 'preferred' &&
      typeof rule.minValue === 'number'
  );

  if (!candidate || typeof candidate.minValue !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? candidate.minValue / 60 : candidate.minValue;
}

export function createIntervalKey(interval: ShiftCoverageInterval, zone?: ShiftZone): string {
  const baseKey = `${interval.startTime}-${interval.endTime}`;
  return zone ? `${baseKey}::${zone}` : baseKey;
}

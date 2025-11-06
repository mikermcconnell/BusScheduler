import {
  DayType,
  Shift,
  ShiftCoverageInterval,
  ShiftZone,
  UnionRule
} from '../types/shift.types';
import { INTERVAL_MINUTES, minutesToTimeString, parseTimeToMinutes } from './timeUtils';

export interface SolverCandidateShift extends Shift {
  solverId: string;
  existing: boolean;
}

export interface ShiftSolverInput {
  dayType: DayType;
  coverageTimeline: ShiftCoverageInterval[];
  unionRules: UnionRule[];
  candidateShifts: SolverCandidateShift[];
}

export interface ShiftSolverResult {
  selectedShifts: Shift[];
  unmetConstraints: string[];
  objectiveValue: number;
}

interface IntervalDemand {
  key: string;
  demand: number;
  zone: ShiftZone;
}

interface CandidateSummary {
  shift: SolverCandidateShift;
  coverageKeys: string[];
  cost: number;
  durationMinutes: number;
}

const EXISTING_SHIFT_COST = 1;
const NEW_SHIFT_COST = 5;
const OVERTIME_COST_PER_INTERVAL = 0.1;

export function runShiftSolver(input: ShiftSolverInput): ShiftSolverResult {
  const demands = buildIntervalDemands(input.coverageTimeline);
  const demandMap = new Map<string, IntervalDemand>();
  demands.forEach((interval) => demandMap.set(interval.key, { ...interval }));

  const candidateSummaries = summarizeCandidates(input.candidateShifts, input.unionRules, demandMap);
  const selected: Shift[] = [];
  let objective = 0;

  while (hasRemainingDemand(demandMap)) {
    const best = findBestCandidate(candidateSummaries, demandMap);
    if (!best) {
      break;
    }

    applyCandidate(best, demandMap);
    selected.push(stripSolverFields(best.shift));
    objective += best.cost;
    candidateSummaries.delete(best.shift.solverId);
  }

  const unmetConstraints = Array.from(demandMap.values())
    .filter((interval) => interval.demand > 0)
    .map((interval) => interval.key);

  return {
    selectedShifts: selected,
    unmetConstraints,
    objectiveValue: objective
  };
}

function buildIntervalDemands(intervals: ShiftCoverageInterval[]): IntervalDemand[] {
  return intervals.flatMap((interval) => {
    const deficits: Array<[ShiftZone, number]> = [
      ['North', Math.max(0, interval.northRequired - interval.northOperational)],
      ['South', Math.max(0, interval.southRequired - interval.southOperational)]
    ];

    return deficits
      .filter(([, demand]) => demand > 0)
      .map(([zone, demand]) => ({
        key: createIntervalKey(interval, zone),
        demand,
        zone
      }));
  });
}

function summarizeCandidates(
  candidates: SolverCandidateShift[],
  unionRules: UnionRule[],
  demandMap: Map<string, IntervalDemand>
): Map<string, CandidateSummary> {
  const minHours = extractRuleHours(unionRules, 'minValue') ?? 5;
  const maxHours = extractRuleHours(unionRules, 'maxValue') ?? 9.75;

  const summaries = new Map<string, CandidateSummary>();
  candidates.forEach((shift) => {
    const window = computeShiftWindow(shift);
    const hours = window.durationMinutes / 60;

    if (hours < minHours - 1e-6 || hours > maxHours + 1e-6) {
      return;
    }

    const coverageKeys = collectRelevantIntervals(shift, demandMap);
    const coverageValue = coverageKeys.reduce((sum, key) => {
      const interval = demandMap.get(key);
      return sum + (interval ? Math.min(1, interval.demand) : 0);
    }, 0);

    if (coverageValue <= 0) {
      return;
    }

    const overtimeIntervals = Math.max(0, window.durationMinutes - 8 * 60) / INTERVAL_MINUTES;
    const baseCost = shift.existing ? EXISTING_SHIFT_COST : NEW_SHIFT_COST;
    const cost = baseCost + overtimeIntervals * OVERTIME_COST_PER_INTERVAL;

    summaries.set(shift.solverId, {
      shift,
      coverageKeys,
      cost,
      durationMinutes: window.durationMinutes
    });
  });

  return summaries;
}

function hasRemainingDemand(demandMap: Map<string, IntervalDemand>): boolean {
  let remaining = false;
  demandMap.forEach((interval) => {
    if (!remaining && interval.demand > 1e-6) {
      remaining = true;
    }
  });
  return remaining;
}

function findBestCandidate(
  candidates: Map<string, CandidateSummary>,
  demandMap: Map<string, IntervalDemand>
): CandidateSummary | null {
  let bestSummary: CandidateSummary | null = null;
  let bestScore = 0;

  candidates.forEach((summary) => {
    const coverageGain = summary.coverageKeys.reduce((sum, key) => {
      const interval = demandMap.get(key);
      return sum + (interval ? Math.min(1, interval.demand) : 0);
    }, 0);

    if (coverageGain <= 0 || summary.cost <= 0) {
      return;
    }

    const score = coverageGain / summary.cost;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestSummary = summary;
    } else if (Math.abs(score - bestScore) < 1e-9 && bestSummary) {
      // Tie-breaker: prefer existing shifts first, then shorter duration
      if (bestSummary.shift.existing && !summary.shift.existing) {
        return;
      }
      if (summary.shift.existing && !bestSummary.shift.existing) {
        bestSummary = summary;
        return;
      }

      if (summary.durationMinutes < bestSummary.durationMinutes) {
        bestSummary = summary;
      }
    }
  });

  return bestSummary;
}

function applyCandidate(summary: CandidateSummary, demandMap: Map<string, IntervalDemand>): void {
  summary.coverageKeys.forEach((key) => {
    const interval = demandMap.get(key);
    if (!interval) {
      return;
    }
    interval.demand = Math.max(0, interval.demand - 1);
  });
}

function collectRelevantIntervals(
  shift: Shift,
  demandMap: Map<string, IntervalDemand>
): string[] {
  const keys: string[] = [];
  const { startMinutes, endMinutes } = computeShiftWindow(shift);
  for (let cursor = startMinutes; cursor < endMinutes; cursor += INTERVAL_MINUTES) {
    const key = createIntervalKeyFromMinutes(cursor, cursor + INTERVAL_MINUTES, shift.zone);
    if (demandMap.has(key)) {
      keys.push(key);
    }
  }
  return keys;
}

function computeShiftWindow(shift: Shift) {
  const startMinutes = parseTimeToMinutes(shift.startTime);
  let endMinutes = parseTimeToMinutes(shift.endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return {
    startMinutes,
    endMinutes,
    durationMinutes: endMinutes - startMinutes
  };
}

function createIntervalKey(interval: ShiftCoverageInterval, zone: ShiftZone): string {
  return `${interval.startTime}-${interval.endTime}::${zone}`;
}

function createIntervalKeyFromMinutes(start: number, end: number, zone: ShiftZone): string {
  return `${minutesToTimeString(start)}-${minutesToTimeString(end)}::${zone}`;
}

function stripSolverFields(shift: SolverCandidateShift): Shift {
  const { solverId: _solverId, existing: _existing, ...rest } = shift;
  return rest;
}

function extractRuleHours(rules: UnionRule[], field: 'minValue' | 'maxValue'): number | null {
  const candidate = rules.find(
    (rule) =>
      rule.category === 'shift_length' &&
      rule.ruleType === 'required' &&
      rule.isActive &&
      typeof rule[field] === 'number'
  );

  if (!candidate) {
    return null;
  }

  const value = candidate[field];
  if (typeof value !== 'number') {
    return null;
  }

  return candidate.unit === 'minutes' ? value / 60 : value;
}

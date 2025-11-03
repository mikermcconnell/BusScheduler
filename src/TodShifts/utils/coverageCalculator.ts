import {
  CityRequirementInterval,
  DayType,
  OperationalInterval,
  ShiftCoverageInterval,
  TodShiftColorScale
} from '../types/shift.types';
import { DAY_TYPES } from './timeUtils';

interface CoverageInput {
  cityTimeline: Record<DayType, CityRequirementInterval[]>;
  operationalTimeline: Record<DayType, OperationalInterval[]>;
}

export interface CoverageComputationResult {
  timeline: Record<DayType, ShiftCoverageInterval[]>;
  colorScale: TodShiftColorScale;
}

function createEmptyCoverage(): Record<DayType, ShiftCoverageInterval[]> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = [];
    return acc;
  }, {} as Record<DayType, ShiftCoverageInterval[]>);
}

function ensureTimelineMap<T extends { startTime: string }>(timeline: T[]): Map<string, T> {
  return timeline.reduce((acc, interval) => {
    acc.set(interval.startTime, interval);
    return acc;
  }, new Map<string, T>());
}

export function computeCoverageTimeline({
  cityTimeline,
  operationalTimeline
}: CoverageInput): CoverageComputationResult {
  const coverageTimeline = createEmptyCoverage();
  let minTotalExcess = 0;
  let maxTotalExcess = 0;

  DAY_TYPES.forEach((dayType) => {
    const requirementMap = ensureTimelineMap(cityTimeline[dayType] ?? []);
    const operationalMap = ensureTimelineMap(operationalTimeline[dayType] ?? []);

    const allKeys = new Set<string>([
      ...Array.from(requirementMap.keys()),
      ...Array.from(operationalMap.keys())
    ]);

    const intervals: ShiftCoverageInterval[] = [];

    Array.from(allKeys).sort().forEach((startTime) => {
      const requirements = requirementMap.get(startTime) ?? {
        dayType,
        startTime,
        endTime: startTime,
        northRequired: 0,
        southRequired: 0,
        floaterRequired: 0
      };

      const operations = operationalMap.get(startTime) ?? {
        dayType,
        startTime,
        endTime: requirements.endTime,
        northOperational: 0,
        southOperational: 0,
        floaterOperational: 0
      };

      const northDeficit = Math.max(0, requirements.northRequired - operations.northOperational);
      const southDeficit = Math.max(0, requirements.southRequired - operations.southOperational);

      const floaterAllocatedToNorth = Math.min(northDeficit, operations.floaterOperational);
      const floaterRemaining = operations.floaterOperational - floaterAllocatedToNorth;
      const floaterAllocatedToSouth = Math.min(southDeficit, Math.max(0, floaterRemaining));

      const northExcess = operations.northOperational + floaterAllocatedToNorth - requirements.northRequired;
      const southExcess = operations.southOperational + floaterAllocatedToSouth - requirements.southRequired;
      const totalExcess = (operations.northOperational + operations.southOperational + operations.floaterOperational) -
        (requirements.northRequired + requirements.southRequired);

      minTotalExcess = Math.min(minTotalExcess, totalExcess, northExcess, southExcess);
      maxTotalExcess = Math.max(maxTotalExcess, totalExcess, northExcess, southExcess);

      intervals.push({
        dayType,
        startTime,
        endTime: requirements.endTime || operations.endTime,
        northRequired: requirements.northRequired,
        southRequired: requirements.southRequired,
        floaterRequired: requirements.floaterRequired ?? 0,
        northOperational: operations.northOperational,
        southOperational: operations.southOperational,
        floaterOperational: operations.floaterOperational,
        floaterAllocatedNorth: floaterAllocatedToNorth,
        floaterAllocatedSouth: floaterAllocatedToSouth,
        northExcess,
        southExcess,
        totalExcess,
        status: totalExcess < 0 ? 'deficit' : totalExcess > 0 ? 'excess' : 'balanced'
      });
    });

    coverageTimeline[dayType] = intervals.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  const colorScale: TodShiftColorScale = {
    min: minTotalExcess,
    max: maxTotalExcess,
    thresholds: {
      deficit: minTotalExcess,
      surplus: maxTotalExcess
    }
  };

  return {
    timeline: coverageTimeline,
    colorScale
  };
}

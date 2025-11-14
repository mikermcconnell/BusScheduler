import {
  CityRequirementInterval,
  DayType,
  OperationalInterval,
  ShiftCoverageInterval,
  TodShiftColorScale
} from '../types/shift.types';
import { DAY_TYPES, parseTimeToMinutes } from './timeUtils';

interface CoverageInput {
  cityTimeline: Record<DayType, CityRequirementInterval[]>;
  operationalTimeline: Record<DayType, OperationalInterval[]>;
}

export interface CoverageComputationResult {
  timeline: Record<DayType, ShiftCoverageInterval[]>;
  colorScale: TodShiftColorScale;
}

export interface ExcessVehicleHourStats {
  totalHours: number;
  byDayType: Record<DayType, number>;
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
      const floaterRequirement = Math.max(0, requirements.floaterRequired ?? 0);
      const floaterCapacity = Math.max(0, operations.floaterOperational ?? 0);

      let floaterPool = floaterCapacity;

      const floaterAllocatedToNorth = Math.min(northDeficit, floaterPool);
      floaterPool -= floaterAllocatedToNorth;

      const floaterAllocatedToSouth = Math.min(southDeficit, floaterPool);
      floaterPool -= floaterAllocatedToSouth;

      const northExcess = operations.northOperational + floaterAllocatedToNorth - requirements.northRequired;
      const southExcess = operations.southOperational + floaterAllocatedToSouth - requirements.southRequired;

      const floaterCoverage = Math.max(0, floaterPool);
      const floaterExcess = floaterCoverage - floaterRequirement;
      const totalExcess = northExcess + southExcess + floaterExcess;

      minTotalExcess = Math.min(minTotalExcess, totalExcess, northExcess, southExcess, floaterExcess);
      maxTotalExcess = Math.max(maxTotalExcess, totalExcess, northExcess, southExcess, floaterExcess);

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
        floaterExcess,
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

export function computeExcessVehicleHours(
  timeline: Record<DayType, ShiftCoverageInterval[]>
): ExcessVehicleHourStats {
  const stats: ExcessVehicleHourStats = {
    totalHours: 0,
    byDayType: DAY_TYPES.reduce((acc, dayType) => {
      acc[dayType] = 0;
      return acc;
    }, {} as Record<DayType, number>)
  };

  DAY_TYPES.forEach((dayType) => {
    const intervals = timeline[dayType] ?? [];
    const dayTotal = intervals.reduce((sum, interval) => {
      if (interval.totalExcess <= 0) {
        return sum;
      }

      const minutes = getIntervalDurationMinutes(interval);
      return sum + (interval.totalExcess * minutes) / 60;
    }, 0);

    stats.byDayType[dayType] = Number(dayTotal.toFixed(2));
    stats.totalHours += dayTotal;
  });

  stats.totalHours = Number(stats.totalHours.toFixed(2));
  return stats;
}

function getIntervalDurationMinutes(interval: ShiftCoverageInterval): number {
  const startMinutes = parseTimeToMinutes(interval.startTime);
  let endMinutes = parseTimeToMinutes(interval.endTime);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return Math.max(0, endMinutes - startMinutes);
}

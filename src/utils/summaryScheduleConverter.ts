import {
  SummarySchedule,
  Schedule,
  Trip,
  TimePoint,
  ServiceBand,
  BlockConfiguration,
} from '../types/schedule';
import { DayType } from '../types/connectionOptimization';

export interface SummaryScheduleConversionOptions {
  dayType?: DayType;
  blockConfigurations?: BlockConfiguration[];
  serviceBands?: ServiceBand[];
}

const DEFAULT_SERVICE_BAND_NAME = 'Standard';

const determineServiceBand = (
  serviceBands: ServiceBand[] | undefined,
  departureTime: string,
): { name: string; info?: { name: string; color: string; totalMinutes?: number } } => {
  if (!serviceBands || serviceBands.length === 0 || !departureTime) {
    return { name: DEFAULT_SERVICE_BAND_NAME };
  }

  const normalizedDeparture = departureTime.trim();
  const matchingBand = serviceBands.find((band) => {
    if (!band.startTime || !band.endTime) {
      return false;
    }

    return band.startTime <= normalizedDeparture && normalizedDeparture <= band.endTime;
  });

  const targetBand = matchingBand ?? serviceBands[0];
  return {
    name: targetBand.name,
    info: {
      name: targetBand.name,
      color: targetBand.color,
      totalMinutes: targetBand.totalMinutes,
    },
  };
};

const buildBlockSequence = (
  tripCount: number,
  blockConfigurations: BlockConfiguration[] | undefined,
): number[] => {
  if (!blockConfigurations || blockConfigurations.length === 0 || tripCount === 0) {
    return Array.from({ length: tripCount }, () => 1);
  }

  const sortedConfigs = [...blockConfigurations].sort((a, b) => a.blockNumber - b.blockNumber);
  const sequence: number[] = [];

  sortedConfigs.forEach((config) => {
    const count = config.tripCount && config.tripCount > 0 ? config.tripCount : 0;
    for (let i = 0; i < count; i += 1) {
      sequence.push(config.blockNumber);
    }
  });

  if (sequence.length < tripCount) {
    const fallbackBlock = sortedConfigs[sortedConfigs.length - 1]?.blockNumber ?? 1;
    while (sequence.length < tripCount) {
      sequence.push(fallbackBlock);
    }
  }

  return sequence.slice(0, tripCount);
};

const getMatrixForDay = (
  summary: SummarySchedule,
  dayType: DayType,
): string[][] => {
  switch (dayType) {
    case 'saturday':
      return summary.saturday;
    case 'sunday':
      return summary.sunday;
    case 'weekday':
    default:
      return summary.weekday;
  }
};

export const convertSummaryScheduleToSchedule = (
  summary: SummarySchedule,
  options: SummaryScheduleConversionOptions = {},
): Schedule => {
  if (!summary) {
    throw new Error('Summary schedule is required for conversion.');
  }

  const dayType = options.dayType ?? 'weekday';
  const matrix = getMatrixForDay(summary, dayType);
  const orderedTimePoints = [...summary.timePoints].sort((a, b) => a.sequence - b.sequence);

  if (!matrix || matrix.length === 0) {
    throw new Error(`Summary schedule has no trips for ${dayType}.`);
  }

  const blockSequence = buildBlockSequence(matrix.length, options.blockConfigurations);
  const trips: Trip[] = [];

  matrix.forEach((row, rowIndex) => {
    if (!row || row.length === 0 || row.every((value) => !value)) {
      return;
    }

    const arrivalTimes: Record<string, string> = {};
    const departureTimes: Record<string, string> = {};
    const recoveryTimes: Record<string, number> = {};

    orderedTimePoints.forEach((timePoint: TimePoint, columnIndex) => {
      const cellValue = row[columnIndex]?.trim?.() ?? '';
      if (!cellValue) {
        return;
      }

      arrivalTimes[timePoint.id] = cellValue;
      departureTimes[timePoint.id] = cellValue;
      recoveryTimes[timePoint.id] = 0;
    });

    const firstDeparture = orderedTimePoints.reduce<string>((acc, _timePoint, index) => {
      if (acc) {
        return acc;
      }
      const value = row[index];
      return value && value.trim() ? value.trim() : acc;
    }, '');

    const { name: serviceBandName, info: serviceBandInfo } = determineServiceBand(
      options.serviceBands,
      firstDeparture,
    );

    trips.push({
      tripNumber: rowIndex + 1,
      blockNumber: blockSequence[rowIndex] ?? 1,
      departureTime: firstDeparture,
      serviceBand: serviceBandName,
      arrivalTimes,
      departureTimes,
      recoveryTimes,
      serviceBandInfo,
      recoveryMinutes: 0,
      originalArrivalTimes: { ...arrivalTimes },
      originalDepartureTimes: { ...departureTimes },
      originalRecoveryTimes: { ...recoveryTimes },
    });
  });

  if (trips.length === 0) {
    throw new Error(`Summary schedule has no valid trips for ${dayType}.`);
  }

  const timestamp = new Date().toISOString();

  return {
    id: `${summary.routeId}-${dayType}`,
    name: summary.routeName,
    routeId: summary.routeId,
    routeName: summary.routeName,
    direction: summary.direction,
    dayType,
    timePoints: orderedTimePoints,
    serviceBands: options.serviceBands ?? [],
    trips,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};


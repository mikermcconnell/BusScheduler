import { Trip, TimePoint, SummarySchedule } from '../types/schedule';
import { timeToMinutes } from './dateHelpers';

interface TripWindow {
  start: number;
  end: number;
}

const MINUTES_IN_DAY = 24 * 60;
type DayType = 'weekday' | 'saturday' | 'sunday';
const DAY_TYPES: DayType[] = ['weekday', 'saturday', 'sunday'];

const safeMinutes = (timeString?: string): number => {
  if (!timeString) return Number.NaN;
  const minutes = timeToMinutes(timeString);
  return Number.isFinite(minutes) ? minutes : Number.NaN;
};

const deriveTripStartTime = (trip: Trip, timePoints: TimePoint[]): string | undefined => {
  if (!trip || !Array.isArray(timePoints) || timePoints.length === 0) {
    return trip?.departureTime;
  }

  const orderedTimePoints = [...timePoints].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  for (const tp of orderedTimePoints) {
    const departure = trip.departureTimes?.[tp.id];
    if (departure) return departure;
    const arrival = trip.arrivalTimes?.[tp.id];
    if (arrival) return arrival;
  }

  const departureCandidates = Object.values(trip.departureTimes || {}).filter(Boolean);
  if (departureCandidates.length > 0) {
    return departureCandidates.reduce((earliest, candidate) => {
      return safeMinutes(candidate) < safeMinutes(earliest) ? candidate : earliest;
    }, departureCandidates[0]);
  }

  return trip.departureTime;
};

const syncTripStartTime = (trip: Trip, timePoints: TimePoint[]): Trip => {
  const derived = deriveTripStartTime(trip, timePoints);
  if (!derived || derived === trip.departureTime) {
    return trip;
  }
  return {
    ...trip,
    departureTime: derived
  };
};

const syncTripCollection = (trips: Trip[] | undefined, timePoints: TimePoint[]): Trip[] | undefined => {
  if (!trips || trips.length === 0) {
    return trips;
  }
  return trips.map(trip => syncTripStartTime(trip, timePoints));
};

const sortTripsChronologically = (trips: Trip[] | undefined): Trip[] => {
  if (!trips || trips.length === 0) {
    return [];
  }
  return [...trips].sort((a, b) => {
    const aMinutes = safeMinutes(a.departureTime);
    const bMinutes = safeMinutes(b.departureTime);

    if (!Number.isNaN(aMinutes) && !Number.isNaN(bMinutes) && aMinutes !== bMinutes) {
      return aMinutes - bMinutes;
    }

    const timeCompare = (a.departureTime || '').localeCompare(b.departureTime || '');
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return (a.blockNumber || 0) - (b.blockNumber || 0);
  });
};

const computeTripWindow = (trip: Trip, timePoints: TimePoint[]): TripWindow | null => {
  if (!trip || !timePoints || timePoints.length === 0) {
    return null;
  }

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  let lastSeen: number | null = null;

  const recordTime = (value?: string) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === '--') return;

    let minutes = timeToMinutes(trimmed);
    if (!Number.isFinite(minutes)) return;

    if (lastSeen !== null && minutes < lastSeen) {
      const difference = lastSeen - minutes;
      if (difference >= MINUTES_IN_DAY / 2) {
        while (minutes < lastSeen) {
          minutes += MINUTES_IN_DAY;
        }
      }
    }

    if (minutes < earliest) earliest = minutes;
    if (minutes > latest) latest = minutes;
    lastSeen = minutes;
  };

  recordTime(trip.departureTime);

  timePoints.forEach((tp, index) => {
    if (index === 0) {
      recordTime(trip.departureTimes?.[tp.id]);
      recordTime(trip.arrivalTimes?.[tp.id]);
      return;
    }

    recordTime(trip.arrivalTimes?.[tp.id]);
    recordTime(trip.departureTimes?.[tp.id]);
  });

  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
    return null;
  }

  if (latest < earliest) {
    latest = earliest;
  }

  return { start: earliest, end: latest };
};

export const needsBlockRecompute = (trips: Trip[]): boolean => {
  if (!trips || trips.length === 0) return false;

  const blockNumbers = trips.map(trip => trip?.blockNumber).filter(n => typeof n === 'number');
  if (blockNumbers.length !== trips.length) {
    return true;
  }

  if (blockNumbers.some(n => n === undefined || n === null || Number.isNaN(n!) || n! <= 0)) {
    return true;
  }

  const uniqueBlocks = new Set(blockNumbers);
  const monotonic = trips.every((trip, index) => trip.blockNumber === index + 1);
  const suspiciousUnique = uniqueBlocks.size === trips.length && trips.length > 1;

  return monotonic || suspiciousUnique;
};

export const computeBlocksForTrips = (trips: Trip[], timePoints: TimePoint[]): Trip[] => {
  if (!trips || trips.length === 0) {
    return trips;
  }

  const windows = trips.map(trip => computeTripWindow(trip, timePoints));
  const allWindowsValid = windows.every(window => window !== null);

  if (!allWindowsValid) {
    console.warn('[BlockAssignment] Unable to compute blocks because some trips lack timing data.');
    return trips.map(trip => ({ ...trip, blockNumber: trip.blockNumber || 0 }));
  }

  const processingOrder = trips
    .map((_, index) => index)
    .sort((a, b) => {
      const windowA = windows[a]!;
      const windowB = windows[b]!;
      if (windowA.start === windowB.start) {
        return a - b;
      }
      return windowA.start - windowB.start;
    });

  const busAvailability: Array<{ block: number; availableAt: number }> = [];
  let nextBlock = 1;
  const assignedBlocks = new Array<number>(trips.length);

  processingOrder.forEach(index => {
    const window = windows[index]!;
    let selected: { block: number; availableAt: number } | undefined;

    for (const bus of busAvailability) {
      if (bus.availableAt <= window.start) {
        if (!selected || bus.availableAt < selected.availableAt) {
          selected = bus;
        }
      }
    }

    if (!selected) {
      selected = { block: nextBlock, availableAt: window.end };
      busAvailability.push(selected);
      nextBlock += 1;
    } else {
      selected.availableAt = Math.max(window.end, window.start);
    }

    assignedBlocks[index] = selected.block;
  });

  return trips.map((trip, index) => ({
    ...trip,
    blockNumber: assignedBlocks[index]
  }));
};

export const computeBlocksFromMatrix = (
  matrix: string[][],
  timePoints: TimePoint[]
): number[] | null => {
  if (!matrix || matrix.length === 0 || !timePoints || timePoints.length === 0) {
    return null;
  }

  const windows: TripWindow[] = matrix.map(row => {
    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;
    let lastSeen: number | null = null;

    row.forEach((timeString, index) => {
      if (!timeString) return;
      const minutesRaw = timeToMinutes(timeString);
      if (!Number.isFinite(minutesRaw)) return;

      let minutes = minutesRaw;
      if (lastSeen !== null && minutes < lastSeen) {
        const difference = lastSeen - minutes;
        if (difference >= MINUTES_IN_DAY / 2) {
          while (minutes < lastSeen) {
            minutes += MINUTES_IN_DAY;
          }
        }
      }

      if (minutes < earliest) earliest = minutes;
      if (minutes > latest) latest = minutes;
      lastSeen = minutes;
    });

    if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
      return { start: Number.NaN, end: Number.NaN };
    }

    if (latest < earliest) {
      latest = earliest;
    }

    return { start: earliest, end: latest };
  });

  if (windows.some(window => !Number.isFinite(window.start) || !Number.isFinite(window.end))) {
    return null;
  }

  const processingOrder = windows
    .map((window, index) => ({ window, index }))
    .sort((a, b) => {
      if (a.window.start === b.window.start) return a.index - b.index;
      return a.window.start - b.window.start;
    });

  const busAvailability: Array<{ block: number; availableAt: number }> = [];
  let nextBlock = 1;
  const assignedBlocks = new Array<number>(matrix.length);

  processingOrder.forEach(entry => {
    const { window, index } = entry;
    let selected: { block: number; availableAt: number } | undefined;

    for (const bus of busAvailability) {
      if (bus.availableAt <= window.start) {
        if (!selected || bus.availableAt < selected.availableAt) {
          selected = bus;
        }
      }
    }

    if (!selected) {
      selected = { block: nextBlock, availableAt: window.end };
      busAvailability.push(selected);
      nextBlock += 1;
    } else {
      selected.availableAt = Math.max(window.end, window.start);
    }

    assignedBlocks[index] = selected.block;
  });

  return assignedBlocks;
};

export const reassignBlocksIfNeeded = (trips: Trip[], timePoints: TimePoint[]): Trip[] => {
  if (!needsBlockRecompute(trips)) {
    return trips;
  }
  return computeBlocksForTrips(trips, timePoints);
};

const buildTripDetailsFromMatrix = (
  matrix: string[][],
  timePoints: TimePoint[],
  blockNumbers: number[]
): Trip[] => {
  return matrix.map((row, index) => {
    const arrivalTimes: Record<string, string> = {};
    const departureTimes: Record<string, string> = {};

    timePoints.forEach((timePoint, timePointIndex) => {
      const value = row?.[timePointIndex];
      if (typeof value !== 'string') {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      arrivalTimes[timePoint.id] = trimmed;
      departureTimes[timePoint.id] = trimmed;
    });

    const departureTime = typeof row?.[0] === 'string' ? row[0].trim() : '';

    return {
      tripNumber: index + 1,
      blockNumber: blockNumbers[index] ?? index + 1,
      departureTime,
      serviceBand: 'Legacy Import',
      arrivalTimes,
      departureTimes,
      recoveryTimes: {},
      recoveryMinutes: 0
    };
  });
};

const cloneTrips = (trips: Trip[] | undefined): Trip[] | undefined => {
  if (!trips || trips.length === 0) {
    return undefined;
  }

  return trips.map(trip => ({
    ...trip,
    arrivalTimes: { ...(trip.arrivalTimes || {}) },
    departureTimes: { ...(trip.departureTimes || {}) },
    recoveryTimes: { ...(trip.recoveryTimes || {}) },
    serviceBandInfo: trip.serviceBandInfo ? { ...trip.serviceBandInfo } : undefined,
    originalArrivalTimes: trip.originalArrivalTimes ? { ...trip.originalArrivalTimes } : undefined,
    originalDepartureTimes: trip.originalDepartureTimes ? { ...trip.originalDepartureTimes } : undefined,
    originalRecoveryTimes: trip.originalRecoveryTimes ? { ...trip.originalRecoveryTimes } : undefined
  }));
};

const ensureDayTripDetails = (
  summary: SummarySchedule,
  dayType: DayType,
  existingTrips: Trip[] | undefined
): Trip[] | undefined => {
  if (!summary || !Array.isArray(summary.timePoints) || summary.timePoints.length === 0) {
    return existingTrips;
  }

  const matrix = (summary as unknown as Record<DayType, string[][] | undefined>)[dayType];
  const clonedTrips = cloneTrips(existingTrips);

  if (clonedTrips && clonedTrips.length > 0) {
    if (needsBlockRecompute(clonedTrips)) {
      const recomputed = computeBlocksForTrips(clonedTrips, summary.timePoints);
      const synced = syncTripCollection(recomputed, summary.timePoints);
      return sortTripsChronologically(synced);
    }
    const synced = syncTripCollection(clonedTrips, summary.timePoints);
    return sortTripsChronologically(synced);
  }

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return undefined;
  }

  const blockNumbers = computeBlocksFromMatrix(matrix, summary.timePoints);
  if (!blockNumbers) {
    return undefined;
  }

  const rebuiltTrips = buildTripDetailsFromMatrix(matrix, summary.timePoints, blockNumbers);
  const synced = syncTripCollection(rebuiltTrips, summary.timePoints);
  return sortTripsChronologically(synced);
};

export const normalizeSummaryScheduleTrips = (
  summary: SummarySchedule
): {
  summary: SummarySchedule;
  tripsByDay: Record<DayType, Trip[]>;
} => {
  if (!summary) {
    throw new Error('Summary schedule is required to normalize trip details.');
  }

  const tripsByDay: Record<DayType, Trip[]> = {
    weekday: [],
    saturday: [],
    sunday: []
  };

  let mutated = false;
  const normalizedTripDetails: SummarySchedule['tripDetails'] = {
    ...(summary.tripDetails || {})
  };

  DAY_TYPES.forEach(dayType => {
    const existingTrips = summary.tripDetails?.[dayType];
    const normalizedTrips = ensureDayTripDetails(summary, dayType, existingTrips);

    if (normalizedTrips && normalizedTrips.length > 0) {
      tripsByDay[dayType] = normalizedTrips;

      if (
        !existingTrips ||
        existingTrips.length !== normalizedTrips.length ||
        normalizedTrips.some((trip, index) => trip.blockNumber !== existingTrips[index]?.blockNumber)
      ) {
        mutated = true;
      }

      normalizedTripDetails[dayType] = normalizedTrips;
    } else {
      delete normalizedTripDetails[dayType];
    }
  });

  const cleanedTripDetails =
    Object.keys(normalizedTripDetails || {}).length > 0 ? normalizedTripDetails : undefined;

  const updatedSummary =
    mutated || cleanedTripDetails !== summary.tripDetails
      ? {
          ...summary,
          tripDetails: cleanedTripDetails
        }
      : summary;

  return {
    summary: updatedSummary,
    tripsByDay
  };
};

export default {
  computeBlocksForTrips,
  computeBlocksFromMatrix,
  needsBlockRecompute,
  reassignBlocksIfNeeded,
  normalizeSummaryScheduleTrips
};

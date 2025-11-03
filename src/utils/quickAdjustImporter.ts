import { SummarySchedule, TimePoint, Trip } from '../types/schedule';
import { minutesToTime, timeToMinutes } from './dateHelpers';
import { computeBlocksForTrips } from './blockAssignment';

type DayType = 'weekday' | 'saturday' | 'sunday';

interface ColumnDescriptor {
  columnIndex: number;
  type: 'ARRIVE' | 'DEPART' | 'RECOVERY' | 'TIME' | 'OTHER';
  stopId?: string;
  stopName?: string;
  recoveryTargetStopId?: string;
}

interface DaySection {
  dayType: DayType;
  routeName: string;
  eventRow: string[];
  stopNameRow: string[];
  stopIdRow: string[];
  dataRows: string[][];
  columnDescriptors: ColumnDescriptor[];
}

export interface QuickAdjustTrip extends Trip {
  periodLabel?: string;
  timePeriod?: string | null;
  tripDuration?: number;
  initialDepartureTimes?: Record<string, string>;
  finalDepartureTimes?: Record<string, string>;
}

export interface QuickAdjustParseResult {
  routeId: string;
  routeName: string;
  timePoints: TimePoint[];
  trips: Record<DayType, QuickAdjustTrip[]>;
  summarySchedule: SummarySchedule;
  warnings: string[];
}

export const parseQuickAdjustCsv = (content: string): string[][] => {
  return content
    .split(/\r?\n/)
    .map(line => line.split(','));
};

const DAY_LABEL_MAP: Record<string, DayType> = {
  weekday: 'weekday',
  weekdays: 'weekday',
  saturday: 'saturday',
  saturdays: 'saturday',
  sunday: 'sunday',
  sundays: 'sunday'
};

const TIME_REGEX = /^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/;

const isNumericId = (value: string | undefined): boolean => {
  if (!value) return false;
  return /^\d+$/.test(value.trim());
};

const isPotentialRecovery = (value: string | undefined): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  return /^-?\d+(\.\d+)?$/.test(trimmed);
};

const normalizeStopName = (name: string | undefined, stopId: string | undefined): string => {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return stopId || '';
};

const to24HourTime = (value: string): string | null => {
  const trimmed = value.trim();
  const match = TIME_REGEX.exec(trimmed);
  if (!match) {
    return null;
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  const suffix = match[3]?.toUpperCase();
  if (suffix === 'AM') {
    if (hours === 12) {
      hours = 0;
    }
  } else if (suffix === 'PM') {
    if (hours !== 12) {
      hours += 12;
    }
  }
  hours = hours % 24;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const sanitizeCell = (value: string | undefined): string => value?.trim() ?? '';

const detectDayType = (row: string[]): DayType | null => {
  for (const cell of row) {
    const trimmed = cell.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (normalized in DAY_LABEL_MAP) {
      return DAY_LABEL_MAP[normalized];
    }
  }
  return null;
};

const buildColumnDescriptors = (
  eventRow: string[],
  stopNameRow: string[],
  stopIdRow: string[]
): ColumnDescriptor[] => {
  const descriptors: ColumnDescriptor[] = [];
  let lastStopId: string | undefined;

  for (let col = 0; col < Math.max(eventRow.length, stopNameRow.length, stopIdRow.length); col += 1) {
    const stopId = sanitizeCell(stopIdRow[col]).toUpperCase();
    const rawStopName = sanitizeCell(stopNameRow[col]);
    const eventLabel = sanitizeCell(eventRow[col]).toUpperCase();

    if (stopId === 'R') {
      descriptors.push({
        columnIndex: col,
        type: 'RECOVERY',
        recoveryTargetStopId: lastStopId
      });
      continue;
    }

    if (!stopId || stopId === 'TRAVEL TIME' || stopId === 'CYCLE TIME' || stopId === 'R RATIO' || stopId === 'FREQUENCY') {
      descriptors.push({
        columnIndex: col,
        type: 'OTHER'
      });
      continue;
    }

    if (isNumericId(stopId)) {
      const type: ColumnDescriptor['type'] =
        eventLabel === 'ARRIVE' ? 'ARRIVE' :
        eventLabel === 'DEPART' ? 'DEPART' :
        'TIME';

      const descriptor: ColumnDescriptor = {
        columnIndex: col,
        type,
        stopId,
        stopName: rawStopName
      };
      descriptors.push(descriptor);
      lastStopId = stopId;
      continue;
    }

    descriptors.push({
      columnIndex: col,
      type: 'OTHER'
    });
  }

  return descriptors;
};

const deriveTimePoints = (descriptors: ColumnDescriptor[]): TimePoint[] => {
  const seen = new Set<string>();
  const timePoints: TimePoint[] = [];

  descriptors.forEach(descriptor => {
    if (!descriptor.stopId) {
      return;
    }
    const stopId = descriptor.stopId;
    if (seen.has(stopId)) {
      return;
    }
    seen.add(stopId);
    const name = normalizeStopName(descriptor.stopName, stopId);
    timePoints.push({
      id: stopId,
      name,
      sequence: timePoints.length + 1
    });
  });

  return timePoints;
};

const LOOP_TERMINAL_SUFFIX = '__terminal';

const detectLoopTerminalBaseStop = (descriptors: ColumnDescriptor[]): string | null => {
  const numericStops = descriptors
    .filter(descriptor => descriptor.stopId && isNumericId(descriptor.stopId))
    .map(descriptor => descriptor.stopId as string);

  if (numericStops.length < 2) {
    return null;
  }

  const firstStop = numericStops[0];
  const lastStop = numericStops[numericStops.length - 1];

  if (firstStop === lastStop) {
    return firstStop;
  }

  return null;
};

const addLoopTerminalToSchedule = (
  baseStopId: string,
  timePoints: TimePoint[],
  tripsByDay: Record<DayType, QuickAdjustTrip[]>
): { timePoints: TimePoint[]; tripsByDay: Record<DayType, QuickAdjustTrip[]> } => {
  const baseTimePoint = timePoints.find(tp => tp.id === baseStopId);
  if (!baseTimePoint) {
    return { timePoints, tripsByDay };
  }

  const existingAlias = timePoints.find(tp => tp.aliasFor === baseStopId);
  if (existingAlias) {
    return { timePoints, tripsByDay };
  }

  const terminalId = `${baseStopId}${LOOP_TERMINAL_SUFFIX}`;

  const augmentTrip = (trip: QuickAdjustTrip): QuickAdjustTrip => {
    const arrival = trip.arrivalTimes[baseStopId] || '';
    const initialDepartureRaw = trip.initialDepartureTimes?.[baseStopId];
    const terminalDeparture = trip.finalDepartureTimes?.[baseStopId] || trip.departureTimes[baseStopId] || '';
    const initialDeparture = initialDepartureRaw || terminalDeparture;
    const hasBaseRecovery = trip.recoveryTimes
      ? Object.prototype.hasOwnProperty.call(trip.recoveryTimes, baseStopId)
      : false;
    const recovery = hasBaseRecovery ? trip.recoveryTimes![baseStopId] : 0;

    const arrivalTimes = {
      ...trip.arrivalTimes,
      [terminalId]: arrival
    };

    const departureTimes = {
      ...trip.departureTimes,
      [baseStopId]: initialDeparture,
      [terminalId]: terminalDeparture
    };

    const recoveryTimes = {
      ...(trip.recoveryTimes || {})
    };

    if (hasBaseRecovery) {
      delete recoveryTimes[baseStopId];
    }
    recoveryTimes[terminalId] = recovery;

    const originalArrivalTimes = trip.originalArrivalTimes
      ? {
          ...trip.originalArrivalTimes,
          [terminalId]: arrival
        }
      : undefined;

    const originalDepartureTimes = trip.originalDepartureTimes
      ? {
          ...trip.originalDepartureTimes,
          [baseStopId]: initialDeparture,
          [terminalId]: terminalDeparture
        }
      : undefined;

    const originalRecoveryTimes = trip.originalRecoveryTimes
      ? (() => {
          const clone = { ...trip.originalRecoveryTimes };
          if (Object.prototype.hasOwnProperty.call(clone, baseStopId)) {
            clone[terminalId] = clone[baseStopId];
            delete clone[baseStopId];
          } else if (!Object.prototype.hasOwnProperty.call(clone, terminalId)) {
            clone[terminalId] = recovery;
          }
          return clone;
        })()
      : undefined;

    return {
      ...trip,
      arrivalTimes,
      departureTimes,
      recoveryTimes,
      originalArrivalTimes,
      originalDepartureTimes,
      originalRecoveryTimes
    };
  };

  const updatedTripsByDay: Record<DayType, QuickAdjustTrip[]> = {
    weekday: tripsByDay.weekday.map(augmentTrip),
    saturday: tripsByDay.saturday.map(augmentTrip),
    sunday: tripsByDay.sunday.map(augmentTrip)
  };

  const reindexedTimePoints = timePoints.map((tp, index) => ({
    ...tp,
    sequence: index + 1
  }));

  const terminalTimePoint: TimePoint = {
    id: terminalId,
    name: baseTimePoint.name,
    sequence: reindexedTimePoints.length + 1,
    aliasFor: baseStopId
  };

  return {
    timePoints: [...reindexedTimePoints, terminalTimePoint],
    tripsByDay: updatedTripsByDay
  };
};

const computeTripTimeWindow = (
  trip: QuickAdjustTrip,
  timePoints: TimePoint[]
): { start: number; end: number } => {
  if (!trip) {
    return { start: 0, end: 0 };
  }

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  let lastSeen: number | null = null;

  const recordTime = (timeValue: string | undefined) => {
    if (!timeValue || timeValue.trim() === '') {
      return;
    }

    let minutes = timeToMinutes(timeValue);
    if (!Number.isFinite(minutes)) {
      return;
    }

    if (lastSeen !== null) {
      while (minutes < lastSeen) {
        minutes += 24 * 60;
      }
    }

    if (minutes < earliest) {
      earliest = minutes;
    }
    if (minutes > latest) {
      latest = minutes;
    }

    lastSeen = minutes;
  };

  // Ensure we capture the published departure time first
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

  if (earliest === Number.POSITIVE_INFINITY || latest === Number.NEGATIVE_INFINITY) {
    return { start: 0, end: 0 };
  }

  if (latest < earliest) {
    latest = earliest;
  }

  return { start: earliest, end: latest };
};

const parseTripRow = (
  row: string[],
  descriptors: ColumnDescriptor[],
  timePoints: TimePoint[],
  tripIndex: number,
  dayType: DayType
): QuickAdjustTrip | null => {
  const arrivalTimes: Record<string, string> = {};
  const departureTimes: Record<string, string> = {};
  const recoveryTimes: Record<string, number> = {};
  const initialDepartureTimes: Record<string, string> = {};
  const finalDepartureTimes: Record<string, string> = {};

  let hasTime = false;

  descriptors.forEach(descriptor => {
    const cellValue = sanitizeCell(row[descriptor.columnIndex]);
    if (!cellValue) {
      return;
    }

    switch (descriptor.type) {
      case 'ARRIVE':
      case 'DEPART':
      case 'TIME': {
        if (!descriptor.stopId) {
          break;
        }
        const normalizedTime = to24HourTime(cellValue);
        if (!normalizedTime) {
          break;
        }
        hasTime = true;
        if (!initialDepartureTimes[descriptor.stopId]) {
          initialDepartureTimes[descriptor.stopId] = normalizedTime;
        }
        finalDepartureTimes[descriptor.stopId] = normalizedTime;
        if (descriptor.type === 'ARRIVE' || (descriptor.type === 'TIME' && !arrivalTimes[descriptor.stopId])) {
          arrivalTimes[descriptor.stopId] = normalizedTime;
        }
        if (descriptor.type === 'DEPART' || descriptor.type === 'TIME') {
          departureTimes[descriptor.stopId] = normalizedTime;
        }
        break;
      }
      case 'RECOVERY': {
        if (!descriptor.recoveryTargetStopId) {
          break;
        }
        if (!isPotentialRecovery(cellValue)) {
          break;
        }
        const recoveryValue = Math.round(parseFloat(cellValue));
        if (!Number.isNaN(recoveryValue)) {
          recoveryTimes[descriptor.recoveryTargetStopId] = recoveryValue;
        }
        break;
      }
      default:
        break;
    }
  });

  if (!hasTime) {
    return null;
  }

  const firstStopId = timePoints[0]?.id;
  const lastStopId = timePoints[timePoints.length - 1]?.id;
  // Always anchor the published departure to the very first time we observed at the origin.
  // Later arrivals/departures at the same stop (e.g. loop terminals) shouldn't overwrite this.
  const primaryDepartureTime =
    (firstStopId && initialDepartureTimes[firstStopId]) ||
    (firstStopId && departureTimes[firstStopId]) ||
    (firstStopId && arrivalTimes[firstStopId]) ||
    '';

  const recoveryMinutes = Object.values(recoveryTimes).reduce((total, value) => total + (value || 0), 0);

  const blockNumberRaw = sanitizeCell(row[1]);
  const blockNumber = parseInt(blockNumberRaw, 10);

  const periodLabel = sanitizeCell(row[2]);

  const trip: QuickAdjustTrip = {
    tripNumber: tripIndex + 1,
    blockNumber: Number.isNaN(blockNumber) ? 1 : blockNumber,
    departureTime: primaryDepartureTime,
    serviceBand: periodLabel || `Quick Adjust ${dayType}`,
    arrivalTimes,
    departureTimes,
    recoveryTimes,
    recoveryMinutes,
    originalArrivalTimes: { ...arrivalTimes },
    originalDepartureTimes: { ...departureTimes },
    originalRecoveryTimes: { ...recoveryTimes },
    serviceBandInfo: {
      name: periodLabel || 'Quick Adjust',
      color: '#607D8B'
    },
    timePeriod: periodLabel || null,
    tripDuration: (() => {
      if (!firstStopId || !lastStopId) return 0;
      const start = departureTimes[firstStopId] || arrivalTimes[firstStopId];
      const end = arrivalTimes[lastStopId] || departureTimes[lastStopId];
      if (!start || !end) return 0;
      const startMinutes = timeToMinutes(start);
      const endMinutes = timeToMinutes(end);
      let duration = endMinutes - startMinutes;
      if (duration < 0) {
        duration += 24 * 60;
      }
      return duration;
    })(),
    periodLabel,
    initialDepartureTimes,
    finalDepartureTimes
  };

  return trip;
};

const buildScheduleMatrix = (trips: QuickAdjustTrip[], timePoints: TimePoint[]): string[][] => {
  const originId = timePoints[0]?.id;

  return trips.map(trip =>
    timePoints.map((tp, index) => {
      const arrival = trip.arrivalTimes[tp.id];
      const departure = trip.departureTimes[tp.id];

      if (tp.aliasFor === originId) {
        return departure || arrival || '';
      }

      if (arrival && departure) {
        return index === 0 ? departure : arrival;
      }

      return arrival || departure || '';
    })
  );
};

const computeOperatingWindow = (trips: QuickAdjustTrip[], timePoints: TimePoint[]) => {
  if (trips.length === 0 || timePoints.length === 0) {
    return undefined;
  }

  const firstStopId = timePoints[0].id;
  const lastStopId = timePoints[timePoints.length - 1].id;

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  trips.forEach(trip => {
    const start = trip.departureTimes[firstStopId] || trip.arrivalTimes[firstStopId];
    const end = trip.arrivalTimes[lastStopId] || trip.departureTimes[lastStopId];

    if (start) {
      const minutes = timeToMinutes(start);
      if (!Number.isNaN(minutes)) {
        earliest = Math.min(earliest, minutes);
      }
    }

    if (end) {
      const minutes = timeToMinutes(end);
      if (!Number.isNaN(minutes)) {
        latest = Math.max(latest, minutes);
      }
    }
  });

  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
    return undefined;
  }

  return {
    start: minutesToTime(earliest),
    end: minutesToTime(latest)
  };
};

const extractRouteName = (rows: string[], defaultName: string): string => {
  const routeIndex = rows.findIndex(cell => cell.trim().toLowerCase() === 'route');
  if (routeIndex !== -1) {
    for (let i = routeIndex + 1; i < rows.length; i += 1) {
      const candidate = sanitizeCell(rows[i]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return defaultName;
};

const buildDaySection = (rows: string[][], startIndex: number): { section: DaySection; endIndex: number } => {
  const dayType = detectDayType(rows[startIndex])!;
  let routeName = 'Quick Adjust Route';
  let stopNameRowIndex = -1;

  for (let i = startIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.some(cell => cell.trim().toLowerCase() === 'stop name')) {
      stopNameRowIndex = i;
      break;
    }
    if (row.some(cell => cell.trim().toLowerCase() === 'route')) {
      routeName = extractRouteName(row, routeName);
    }
  }

  if (stopNameRowIndex === -1) {
    throw new Error(`Unable to locate stop name row for ${dayType}`);
  }

  const eventRow = rows[stopNameRowIndex - 1] || [];
  const stopNameRow = rows[stopNameRowIndex] || [];
  const stopIdRow = rows[stopNameRowIndex + 1] || [];

  const dataRows: string[][] = [];
  let endIndex = stopNameRowIndex + 1;

  for (let i = stopNameRowIndex + 2; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.some(cell => cell.trim().toLowerCase() === 'service hours')) {
      endIndex = i;
      break;
    }
    if (detectDayType(row)) {
      endIndex = i - 1;
      break;
    }
    dataRows.push(row);
    endIndex = i;
  }

  const columnDescriptors = buildColumnDescriptors(eventRow, stopNameRow, stopIdRow);

  const section: DaySection = {
    dayType,
    routeName,
    eventRow,
    stopNameRow,
    stopIdRow,
    dataRows,
    columnDescriptors
  };

  return { section, endIndex };
};

const collectDaySections = (rows: string[][]): DaySection[] => {
  const sections: DaySection[] = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    const dayType = detectDayType(row);
    if (!dayType) {
      index += 1;
      continue;
    }

    const { section, endIndex } = buildDaySection(rows, index);
    sections.push(section);
    index = endIndex + 1;
  }

  return sections;
};

export const parseQuickAdjustSchedule = (
  rows: string[][],
  options: { routeId?: string } = {}
): QuickAdjustParseResult => {
  const sections = collectDaySections(rows);
  if (sections.length === 0) {
    throw new Error('No recognizable day sections found in schedule.');
  }

  const primarySection = sections[0];
  let timePoints = deriveTimePoints(primarySection.columnDescriptors);

  let tripsByDay: Record<DayType, QuickAdjustTrip[]> = {
    weekday: [],
    saturday: [],
    sunday: []
  };

  const warnings: string[] = [];
  const routeName = primarySection.routeName;

  sections.forEach(section => {
    const sectionTimePoints = deriveTimePoints(section.columnDescriptors);
    if (sectionTimePoints.length !== timePoints.length) {
      warnings.push(`Time point mismatch detected for ${section.dayType} section.`);
    }

    const trips: QuickAdjustTrip[] = [];
    section.dataRows.forEach((row, rowIndex) => {
      const trip = parseTripRow(row, section.columnDescriptors, timePoints, trips.length, section.dayType);
      if (trip) {
        trips.push(trip);
      } else if (row.some(cell => TIME_REGEX.test(cell.trim()))) {
        warnings.push(`Row ${rowIndex + 1} in ${section.dayType} section contained times but could not be parsed.`);
      }
    });

    tripsByDay[section.dayType] = computeBlocksForTrips(trips, timePoints);
  });

  const loopBaseStopId = detectLoopTerminalBaseStop(primarySection.columnDescriptors);
  if (loopBaseStopId) {
    const extension = addLoopTerminalToSchedule(loopBaseStopId, timePoints, tripsByDay);
    timePoints = extension.timePoints;
    tripsByDay = extension.tripsByDay;
  } else {
    // Ensure sequence numbers remain accurate if no extension was applied
    timePoints = timePoints.map((tp, index) => ({
      ...tp,
      sequence: index + 1
    }));
  }

  const scheduleMatrixWeekday = buildScheduleMatrix(tripsByDay.weekday, timePoints);
  const scheduleMatrixSaturday = buildScheduleMatrix(tripsByDay.saturday, timePoints);
  const scheduleMatrixSunday = buildScheduleMatrix(tripsByDay.sunday, timePoints);

  const operatingWindows = [
    computeOperatingWindow(tripsByDay.weekday, timePoints),
    computeOperatingWindow(tripsByDay.saturday, timePoints),
    computeOperatingWindow(tripsByDay.sunday, timePoints)
  ].filter(Boolean) as Array<{ start: string; end: string }>;

  let overallOperatingHours;
  if (operatingWindows.length > 0) {
    const starts = operatingWindows.map(window => timeToMinutes(window.start));
    const ends = operatingWindows.map(window => timeToMinutes(window.end));
    overallOperatingHours = {
      start: minutesToTime(Math.min(...starts)),
      end: minutesToTime(Math.max(...ends))
    };
  }

  const summarySchedule: SummarySchedule = {
    routeId: options.routeId || `quick-adjust-${Date.now()}`,
    routeName,
    direction: 'Outbound',
    timePoints,
    weekday: scheduleMatrixWeekday,
    saturday: scheduleMatrixSaturday,
    sunday: scheduleMatrixSunday,
    effectiveDate: new Date(),
    metadata: {
      weekdayTrips: scheduleMatrixWeekday.length,
      saturdayTrips: scheduleMatrixSaturday.length,
      sundayTrips: scheduleMatrixSunday.length,
      operatingHours: overallOperatingHours
    }
  };

  summarySchedule.tripDetails = {
    weekday: tripsByDay.weekday,
    saturday: tripsByDay.saturday,
    sunday: tripsByDay.sunday
  };

  return {
    routeId: summarySchedule.routeId,
    routeName,
    timePoints,
    trips: tripsByDay,
    summarySchedule,
    warnings
  };
};

export default parseQuickAdjustSchedule;

import {
  CityRequirementInterval,
  DayType,
  OperationalInterval,
  Shift,
  ShiftZone
} from '../types/shift.types';
import {
  DAY_TYPES,
  INTERVAL_MINUTES,
  TIME_WINDOW_END,
  generateTimelineMinutes,
  parseTimeToMinutes,
  parseFlexibleTime,
  floorToInterval,
  ceilToInterval,
  ensureValidTimeRange,
  normalizeDayType,
  minutesToTimeString,
  clampToWindow,
  calculateTotalHours
} from './timeUtils';

interface ContractorRow {
  driverId: string;
  vehicleId?: string;
  dayType: DayType;
  zone: ShiftZone;
  start: number;
  end: number;
  breakStart?: number;
  breakEnd?: number;
  rawStart: string;
  rawEnd: string;
  rawBreakStart?: string;
  rawBreakEnd?: string;
  vehicleCount?: number;
}

type RequirementMap = Map<number, {
  northRequired: number;
  southRequired: number;
  floaterRequired: number;
}>;

type OperationalMap = Map<number, {
  northOperational: number;
  southOperational: number;
  floaterOperational: number;
  breakCount: number;
}>;

interface ParsedRequirementRow {
  dayType: DayType;
  start: number;
  end: number;
  northRequired: number;
  southRequired: number;
  floaterRequired: number;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
    reader.readAsText(file);
  });
}

function splitCsvLines(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function parseCsvLine(line: string): string[] {
  // Basic CSV parsing that supports quoted values
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeHeaders(headerLine: string): string[] {
  return parseCsvLine(headerLine).map(h => h.trim().toLowerCase());
}

function normalizeZone(zone: string, fileName: string): ShiftZone {
  const cleaned = zone.trim().toLowerCase();
  switch (cleaned) {
    case 'north':
      return 'North';
    case 'south':
      return 'South';
    case 'floater':
      return 'Floater';
    default:
      throw new Error(`Invalid zone "${zone}" in file "${fileName}". Expected North, South, or Floater.`);
  }
}

function initialiseRequirementMap(): Record<DayType, RequirementMap> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = new Map();
    return acc;
  }, {} as Record<DayType, RequirementMap>);
}

function initialiseOperationalMap(): Record<DayType, OperationalMap> {
  return DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = new Map();
    return acc;
  }, {} as Record<DayType, OperationalMap>);
}

function ensureIntervalRecord(map: OperationalMap, start: number) {
  if (!map.has(start)) {
    map.set(start, {
      northOperational: 0,
      southOperational: 0,
      floaterOperational: 0,
      breakCount: 0
    });
  }
  return map.get(start)!;
}

export async function parseCityRequirementsCsv(
  file: File
): Promise<Record<DayType, CityRequirementInterval[]>> {
  const rawContents = await readFileAsText(file);
  const contents = rawContents.charCodeAt(0) === 0xfeff ? rawContents.slice(1) : rawContents;
  const rows = contents
    .split(/\r?\n/)
    .map(line => parseCsvLine(line))
    .filter(row => row.some(cell => (cell ?? '').trim().length > 0));

  if (rows.length === 0) {
    throw new Error(`City schedule file "${file.name}" does not contain any rows.`);
  }

  const hasStandardColumns = rows.some(row => row.some(cell => cell.trim().toLowerCase() === 'time_interval_start'));

  const requirementRows: ParsedRequirementRow[] = hasStandardColumns
    ? parseStandardRequirementRows(rows, file.name)
    : parsePivotedRequirementRows(rows, file.name);

  const dayTypeMap = initialiseRequirementMap();
  const timeline = generateTimelineMinutes();

  requirementRows.forEach(requirement => {
    const [rangeStart, rangeEnd] = ensureValidTimeRange(requirement.start, requirement.end);

    for (let cursor = rangeStart; cursor < rangeEnd; cursor += INTERVAL_MINUTES) {
      const clampedCursor = clampToWindow(cursor);
      const target = dayTypeMap[requirement.dayType].get(clampedCursor) ?? {
        northRequired: 0,
        southRequired: 0,
        floaterRequired: 0
      };

      target.northRequired = requirement.northRequired;
      target.southRequired = requirement.southRequired;
      target.floaterRequired = requirement.floaterRequired;
      dayTypeMap[requirement.dayType].set(clampedCursor, target);
    }
  });

  const timelineByDayType: Record<DayType, CityRequirementInterval[]> = DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = timeline.map(start => {
      const end = start + INTERVAL_MINUTES;
      const requirement = dayTypeMap[dayType].get(start) ?? {
        northRequired: 0,
        southRequired: 0,
        floaterRequired: 0
      };

      return {
        dayType,
        startTime: minutesToTimeString(start),
        endTime: minutesToTimeString(end >= TIME_WINDOW_END ? TIME_WINDOW_END : end),
        northRequired: requirement.northRequired,
        southRequired: requirement.southRequired,
        floaterRequired: requirement.floaterRequired
      };
    });
    return acc;
  }, {} as Record<DayType, CityRequirementInterval[]>);

  return timelineByDayType;
}

function parseStandardRequirementRows(rows: string[][], fileName: string): ParsedRequirementRow[] {
  if (rows.length === 0) {
    return [];
  }

  const headerRow = rows[0].map(cell => cell.trim().toLowerCase());

  const dayTypeIdx = headerRow.findIndex(item => item === 'day_type');
  const startIdx = headerRow.findIndex(item => item === 'time_interval_start');
  const endIdx = headerRow.findIndex(item => item === 'time_interval_end');

  if (dayTypeIdx === -1 || startIdx === -1 || endIdx === -1) {
    return [];
  }

  const northIdx = headerRow.findIndex(item => item === 'north_required');
  const southIdx = headerRow.findIndex(item => item === 'south_required');
  const floaterIdx = headerRow.findIndex(item => item === 'floater_required');

  const requirementRows: ParsedRequirementRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dayTypeValue = (row[dayTypeIdx] ?? '').trim();
    const startTime = parseFlexibleTime(row[startIdx]);
    const endTime = parseFlexibleTime(row[endIdx]);
    if (!dayTypeValue || !startTime || !endTime) continue;

    const dayType = normalizeDayType(dayTypeValue);
    const startMinutes = floorToInterval(parseTimeToMinutes(startTime));
    const endMinutes = ceilToInterval(parseTimeToMinutes(endTime));

    const northRequired = northIdx >= 0 ? Number(row[northIdx] || 0) : 0;
    const southRequired = southIdx >= 0 ? Number(row[southIdx] || 0) : 0;
    const floaterRequired = floaterIdx >= 0 ? Number(row[floaterIdx] || 0) : 0;

    requirementRows.push({
      dayType,
      start: startMinutes,
      end: endMinutes,
      northRequired: Number.isFinite(northRequired) ? northRequired : 0,
      southRequired: Number.isFinite(southRequired) ? southRequired : 0,
      floaterRequired: Number.isFinite(floaterRequired) ? floaterRequired : 0
    });
  }

  return requirementRows;
}

function parsePivotedRequirementRows(rows: string[][], fileName: string): ParsedRequirementRow[] {
  const dayMaps = DAY_TYPES.reduce((acc, dayType) => {
    acc[dayType] = new Map<number, {
      northRequired: number;
      southRequired: number;
      floaterRequired: number;
    }>();
    return acc;
  }, {} as Record<DayType, Map<number, { northRequired: number; southRequired: number; floaterRequired: number }>>);

  let currentDay: DayType | null = null;
  let timeColumns: Array<{ index: number; minutes: number }> = [];
  let headerRowIndex = -1;

  const ensureAggregate = (map: Map<number, { northRequired: number; southRequired: number; floaterRequired: number }>, minutes: number) => {
    if (!map.has(minutes)) {
      map.set(minutes, {
        northRequired: 0,
        southRequired: 0,
        floaterRequired: 0
      });
    }
    return map.get(minutes)!;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstCell = (row[0] ?? '').trim().toLowerCase();

    if (['weekday', 'weekdays', 'all weekdays', 'saturday', 'sunday'].includes(firstCell)) {
      currentDay = mapPivotDayType(firstCell);
      headerRowIndex = i + 1;
      const headerRow = rows[headerRowIndex] ?? [];
      timeColumns = [];
      for (let col = 0; col < headerRow.length; col++) {
        const timeValue = parseFlexibleTime(headerRow[col]);
        if (!timeValue) continue;
        const minutes = floorToInterval(parseTimeToMinutes(timeValue));
        timeColumns.push({ index: col, minutes });
      }
      i += 1;
      continue;
    }

    if (!currentDay || headerRowIndex === -1 || i <= headerRowIndex) {
      continue;
    }

    const labelCell = (row[1] ?? '').trim().toLowerCase();
    const altLabelCell = (row[3] ?? row[2] ?? row[0] ?? '').trim().toLowerCase();
    if (labelCell.startsWith('total in service') || altLabelCell.startsWith('total in service')) {
      currentDay = null;
      headerRowIndex = -1;
      timeColumns = [];
      continue;
    }

    const zoneLabel = (row[3] ?? row[2] ?? '').trim();
    if (!zoneLabel) {
      continue;
    }

    const zone = deriveZoneFromValue(zoneLabel);
    const dayMap = dayMaps[currentDay];

    timeColumns.forEach(({ index, minutes }) => {
      const value = parseOptionalNumber(row[index]);
      if (value === null || value <= 0) {
        return;
      }

      const aggregate = ensureAggregate(dayMap, minutes);
      if (zone === 'North') {
        aggregate.northRequired += value;
      } else if (zone === 'South') {
        aggregate.southRequired += value;
      } else {
        aggregate.floaterRequired += value;
      }
    });
  }

  const requirementRows: ParsedRequirementRow[] = [];
  DAY_TYPES.forEach(dayType => {
    const map = dayMaps[dayType];
    map.forEach((values, minutes) => {
      requirementRows.push({
        dayType,
        start: minutes,
        end: minutes + INTERVAL_MINUTES,
        northRequired: values.northRequired,
        southRequired: values.southRequired,
        floaterRequired: values.floaterRequired
      });
    });
  });

  return requirementRows;
}

function mapPivotDayType(value: string): DayType {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('weekday')) {
    return 'weekday';
  }
  if (normalized.startsWith('sat')) {
    return 'saturday';
  }
  if (normalized.startsWith('sun')) {
    return 'sunday';
  }
  throw new Error(`Unsupported day label "${value}" in city requirement template.`);
}

function buildShiftSegments(row: ContractorRow): Array<{ start: number; end: number }> {
  const [shiftStart, shiftEnd] = ensureValidTimeRange(row.start, row.end);
  const segments: Array<{ start: number; end: number }> = [];

  if (row.breakStart !== undefined && row.breakEnd !== undefined) {
    let breakStart = floorToInterval(row.breakStart);
    let breakEnd = ceilToInterval(row.breakEnd);
    const [normalizedBreakStart, normalizedBreakEnd] = ensureValidTimeRange(breakStart, breakEnd);

    breakStart = clampToWindow(normalizedBreakStart);
    breakEnd = clampToWindow(normalizedBreakEnd);

    if (breakStart > shiftStart) {
      segments.push({ start: shiftStart, end: Math.max(shiftStart, breakStart) });
    }

    if (breakEnd < shiftEnd) {
      segments.push({ start: Math.min(shiftEnd, breakEnd), end: shiftEnd });
    }
  } else {
    segments.push({ start: shiftStart, end: shiftEnd });
  }

  return segments
    .map(segment => ({
      start: clampToWindow(segment.start),
      end: clampToWindow(segment.end)
    }))
    .filter(segment => segment.end > segment.start);
}

export async function parseContractorShiftsCsv(
  file: File
): Promise<{
  shifts: Shift[];
  operationalTimeline: Record<DayType, OperationalInterval[]>;
}> {
  const rawContents = await readFileAsText(file);
  const contents = rawContents.replace(/^\uFEFF/, '');
  const rows = contents
    .split(/\r?\n/)
    .map(line => parseCsvLine(line))
    .filter(row => row.some(cell => cell && cell.trim().length > 0));

  if (rows.length === 0) {
    throw new Error(`Contractor shift file "${file.name}" does not contain any rows.`);
  }

  const standardHeaderIndex = rows.findIndex(row =>
    row.some(cell => cell.trim().toLowerCase() === 'driver_id')
  );

  let parsed: ParsedContractorData;
  if (standardHeaderIndex !== -1) {
    parsed = parseStandardContractorRows(rows.slice(standardHeaderIndex), file.name);
  } else {
    parsed = parseTemplateContractorRows(rows, file.name);
  }

  const operationalTimeline = buildOperationalTimeline(parsed.contractorRows);

  return {
    shifts: parsed.shifts,
    operationalTimeline
  };
}

interface ParsedContractorData {
  shifts: Shift[];
  contractorRows: ContractorRow[];
}

function parseStandardContractorRows(rows: string[][], fileName: string): ParsedContractorData {
  if (rows.length === 0) {
    return { shifts: [], contractorRows: [] };
  }

  const headerRow = rows[0].map(cell => cell.trim().toLowerCase());

  const indexOf = (key: string) => headerRow.findIndex(value => value === key);

  const dayTypeIdx = indexOf('day_type');
  const zoneIdx = indexOf('zone');
  const startIdx = indexOf('shift_start');
  const endIdx = indexOf('shift_end');

  if (dayTypeIdx === -1 || zoneIdx === -1 || startIdx === -1 || endIdx === -1) {
    return { shifts: [], contractorRows: [] };
  }

  const driverIdx = indexOf('driver_id');
  const vehicleIdx = indexOf('vehicle_id');
  const breakStartIdx = indexOf('break_start');
  const breakEndIdx = indexOf('break_end');
  const vehicleCountIdx = indexOf('vehicle_count');

  const contractorRows: ContractorRow[] = [];
  const shifts: Shift[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dayTypeRaw = (row[dayTypeIdx] ?? '').trim();
    if (!dayTypeRaw) continue;

    const startTime = parseFlexibleTime(row[startIdx]);
    const endTime = parseFlexibleTime(row[endIdx]);
    if (!startTime || !endTime) continue;

    const breakStartTime = breakStartIdx >= 0 ? parseFlexibleTime(row[breakStartIdx]) : null;
    const breakEndTime = breakEndIdx >= 0 ? parseFlexibleTime(row[breakEndIdx]) : null;

    const dayType = normalizeDayType(dayTypeRaw);
    const zone = normalizeZone(row[zoneIdx] ?? '', fileName);
    const driverId = driverIdx >= 0 ? (row[driverIdx] ?? '').trim() : '';
    const vehicleIdRaw = vehicleIdx >= 0 ? (row[vehicleIdx] ?? '').trim() : '';
    const vehicleId = vehicleIdRaw || undefined;

    const vehicleCountValue = vehicleCountIdx >= 0 ? Number(row[vehicleCountIdx] || 0) : 1;
    const vehicleCount = Number.isFinite(vehicleCountValue) && vehicleCountValue > 0 ? Math.round(vehicleCountValue) : 1;

    const startMinutes = floorToInterval(parseTimeToMinutes(startTime));
    const endMinutes = ceilToInterval(parseTimeToMinutes(endTime));

    const contractorRow: ContractorRow = {
      driverId: driverId || vehicleId || `Shift-${i}`,
      vehicleId,
      dayType,
      zone,
      start: startMinutes,
      end: endMinutes,
      breakStart: breakStartTime ? floorToInterval(parseTimeToMinutes(breakStartTime)) : undefined,
      breakEnd: breakEndTime ? ceilToInterval(parseTimeToMinutes(breakEndTime)) : undefined,
      rawStart: startTime,
      rawEnd: endTime,
      rawBreakStart: breakStartTime ?? undefined,
      rawBreakEnd: breakEndTime ?? undefined,
      vehicleCount
    };

    const totalHours = calculateTotalHours(
      contractorRow.rawStart,
      contractorRow.rawEnd,
      contractorRow.rawBreakStart,
      contractorRow.rawBreakEnd
    );

    shifts.push({
      id: `${contractorRow.driverId}-${i}`,
      shiftCode: contractorRow.driverId,
      driverId: driverIdx >= 0 ? driverId || undefined : undefined,
      vehicleId,
      origin: 'imported',
      scheduleType: dayType,
      zone,
      startTime: contractorRow.rawStart,
      endTime: contractorRow.rawEnd,
      breakStart: contractorRow.rawBreakStart,
      breakEnd: contractorRow.rawBreakEnd,
      totalHours,
      isSplitShift: false,
      unionCompliant: true,
      complianceWarnings: [],
      vehicleCount
    });

    contractorRows.push(contractorRow);
  }

  return { shifts, contractorRows };
}

function parseTemplateContractorRows(rows: string[][], fileName: string): ParsedContractorData {
  const rowMap = new Map<string, string[]>();
  rows.forEach(row => {
    if (!row.length) return;
    const key = (row[0] ?? '').trim();
    if (key) {
      rowMap.set(key, row);
    }
  });

  const dayRowIndex = rows.findIndex(row => (row[0] ?? '').trim().toLowerCase() === 'day');
  if (dayRowIndex === -1) {
    throw new Error(`Unable to locate "Day" row in template file "${fileName}".`);
  }

  const headerRow = rows[dayRowIndex - 1] ?? [];
  const dayRow = rows[dayRowIndex] ?? [];

  const shiftLabelRow = rowMap.get('Shift Label') ?? [];
  const driverRow = rowMap.get('Driver (optional)') ?? [];
  const vehicleRow = rowMap.get('Vehicle (optional)') ?? [];
  const serviceStartRow = rowMap.get('Service Start Time') ?? [];
  const serviceEndRow = rowMap.get('Service End Time') ?? [];
  const breakStartRow = rowMap.get('Break 1 Window Start Time') ?? [];
  const breakEndRow = rowMap.get('Break 1 Window End Time') ?? [];
  const breakDurationRow = rowMap.get('Break 1 Duration (min)') ?? [];
  const vehicleCountRow = rowMap.get('Vehicle Count') ?? [];

  const contractorRows: ContractorRow[] = [];
  const shifts: Shift[] = [];

  for (let col = 1; col < headerRow.length; col++) {
    const columnLabel = (headerRow[col] ?? '').trim();
    if (!columnLabel || columnLabel.toLowerCase() === 'example') {
      continue;
    }

    const dayLabel = (dayRow[col] ?? '').trim();
    if (!dayLabel) {
      continue;
    }

    const dayType = mapTemplateDayType(dayLabel);
    const startTime = parseFlexibleTime(serviceStartRow[col]);
    const endTime = parseFlexibleTime(serviceEndRow[col]);
    if (!startTime || !endTime) {
      continue;
    }

    const breakStart = parseFlexibleTime(breakStartRow[col]);
    const breakEnd = parseFlexibleTime(breakEndRow[col]);
    const breakDuration = parseOptionalNumber(breakDurationRow[col]);

    const vehicleCountRaw = parseOptionalNumber(vehicleCountRow[col]);
    const vehicleCount = vehicleCountRaw && vehicleCountRaw > 0 ? Math.round(vehicleCountRaw) : 1;

    const driverValue = (driverRow[col] ?? '').trim();
    const shiftLabel = (shiftLabelRow[col] ?? '').trim() || columnLabel;
    const vehicleId = (vehicleRow[col] ?? '').trim() || undefined;
    const zone = deriveZoneFromValue(driverValue);

    const startMinutes = floorToInterval(parseTimeToMinutes(startTime));
    const endMinutes = ceilToInterval(parseTimeToMinutes(endTime));

    const contractorRow: ContractorRow = {
      driverId: driverValue || shiftLabel,
      vehicleId,
      dayType,
      zone,
      start: startMinutes,
      end: endMinutes,
      breakStart: breakStart ? floorToInterval(parseTimeToMinutes(breakStart)) : undefined,
      breakEnd: breakEnd ? ceilToInterval(parseTimeToMinutes(breakEnd)) : undefined,
      rawStart: startTime,
      rawEnd: endTime,
      rawBreakStart: breakStart ?? undefined,
      rawBreakEnd: breakEnd ?? undefined,
      vehicleCount
    };

    const totalHours = calculateTotalHours(
      contractorRow.rawStart,
      contractorRow.rawEnd,
      contractorRow.rawBreakStart,
      contractorRow.rawBreakEnd
    );

    shifts.push({
      id: `${shiftLabel}-${dayType}-${col}`,
      shiftCode: shiftLabel,
      driverId: driverValue || undefined,
      vehicleId,
      scheduleType: dayType,
      zone,
      startTime: contractorRow.rawStart,
      endTime: contractorRow.rawEnd,
      breakStart: contractorRow.rawBreakStart,
      breakEnd: contractorRow.rawBreakEnd,
      breakDuration: breakDuration ?? undefined,
      totalHours,
      isSplitShift: false,
      unionCompliant: true,
      complianceWarnings: [],
      vehicleCount
    });

    contractorRows.push(contractorRow);
  }

  if (contractorRows.length === 0) {
    throw new Error(`No valid shift columns were found in template file "${fileName}".`);
  }

  return { shifts, contractorRows };
}

function buildOperationalTimeline(contractorRows: ContractorRow[]): Record<DayType, OperationalInterval[]> {
  const timeline = generateTimelineMinutes();
  const maps = initialiseOperationalMap();

  contractorRows.forEach(row => {
    const segments = buildShiftSegments(row);
    const weight = row.vehicleCount && row.vehicleCount > 0 ? row.vehicleCount : 1;
    const map = maps[row.dayType];

    segments.forEach(segment => {
      const segmentStart = floorToInterval(segment.start);
      const segmentEnd = ceilToInterval(segment.end);

      for (let cursor = segmentStart; cursor < segmentEnd; cursor += INTERVAL_MINUTES) {
        if (cursor < timeline[0] || cursor >= TIME_WINDOW_END) {
          continue;
        }

        const intervalEnd = cursor + INTERVAL_MINUTES;
        if (segment.start >= intervalEnd || segment.end <= cursor) {
          continue;
        }

        const interval = ensureIntervalRecord(map, cursor);

        if (row.zone === 'North') {
          interval.northOperational += weight;
        } else if (row.zone === 'South') {
          interval.southOperational += weight;
        } else {
          interval.floaterOperational += weight;
        }
      }
    });

    if (row.breakStart !== undefined && row.breakEnd !== undefined) {
      const [normalizedBreakStart, normalizedBreakEnd] = ensureValidTimeRange(row.breakStart, row.breakEnd);
      const breakStart = floorToInterval(clampToWindow(normalizedBreakStart));
      const breakEnd = ceilToInterval(clampToWindow(normalizedBreakEnd));

      for (let cursor = breakStart; cursor < breakEnd; cursor += INTERVAL_MINUTES) {
        if (cursor < timeline[0] || cursor >= TIME_WINDOW_END) {
          continue;
        }

        const intervalEnd = cursor + INTERVAL_MINUTES;
        if (normalizedBreakStart >= intervalEnd || normalizedBreakEnd <= cursor) {
          continue;
        }

        const interval = ensureIntervalRecord(map, cursor);
        interval.breakCount += weight;
      }
    }
  });

  return DAY_TYPES.reduce((acc, dayType) => {
    const map = maps[dayType];
    acc[dayType] = timeline.map(start => {
      const end = start + INTERVAL_MINUTES;
      const values = map.get(start) ?? {
        northOperational: 0,
        southOperational: 0,
        floaterOperational: 0,
        breakCount: 0
      };

      return {
        dayType,
        startTime: minutesToTimeString(start),
        endTime: minutesToTimeString(end >= TIME_WINDOW_END ? TIME_WINDOW_END : end),
        northOperational: values.northOperational,
        southOperational: values.southOperational,
        floaterOperational: values.floaterOperational,
        breakCount: values.breakCount
      };
    });
    return acc;
  }, {} as Record<DayType, OperationalInterval[]>);
}

function mapTemplateDayType(value: string): DayType {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('weekday')) {
    return 'weekday';
  }
  if (normalized.includes('sat')) {
    return 'saturday';
  }
  if (normalized.includes('sun')) {
    return 'sunday';
  }
  throw new Error(`Unsupported day label "${value}". Expected Weekday, Sat, or Sun.`);
}

function deriveZoneFromValue(value: string): ShiftZone {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('north')) return 'North';
  if (normalized.includes('south')) return 'South';
  if (normalized.includes('float')) return 'Floater';
  return 'Floater';
}

function parseOptionalNumber(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

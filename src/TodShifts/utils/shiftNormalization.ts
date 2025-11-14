import type { Dayjs } from 'dayjs';
import { Shift } from '../types/shift.types';
import {
  INTERVAL_MINUTES,
  TIME_WINDOW_START,
  TIME_WINDOW_END,
  ceilToInterval,
  floorToInterval,
  minutesToTimeString,
  parseTimeToMinutes
} from './timeUtils';

const MINUTES_PER_DAY = 24 * 60;

type SnapMode = 'floor' | 'ceil';

function snapMinutes(value: number, mode: SnapMode): number {
  return mode === 'floor' ? floorToInterval(value, INTERVAL_MINUTES) : ceilToInterval(value, INTERVAL_MINUTES);
}

export function normalizeShiftTimes(shift: Shift): Shift {
  const startMinutes = parseTimeToMinutes(shift.startTime);
  let endMinutes = parseTimeToMinutes(shift.endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += MINUTES_PER_DAY;
  }

  let snappedStart = snapMinutes(startMinutes, 'floor');
  let snappedEnd = snapMinutes(endMinutes, 'ceil');

  snappedStart = Math.max(TIME_WINDOW_START, snappedStart);
  snappedEnd = Math.max(snappedStart + INTERVAL_MINUTES, snappedEnd);
  snappedEnd = Math.min(TIME_WINDOW_END, snappedEnd);

  const normalizedStart = minutesToTimeString(snappedStart);
  const normalizedEnd = minutesToTimeString(snappedEnd % MINUTES_PER_DAY);
  const normalizedTotalHours = Number(((snappedEnd - snappedStart) / 60).toFixed(2));

  return {
    ...shift,
    startTime: normalizedStart,
    endTime: normalizedEnd,
    totalHours: normalizedTotalHours
  };
}

export function snapTimeString(value: string, mode: SnapMode): string {
  const minutes = parseTimeToMinutes(value);
  const snapped = snapMinutes(minutes, mode);
  return minutesToTimeString(snapped % MINUTES_PER_DAY);
}

export function snapDayjsToInterval(value: Dayjs, mode: SnapMode): string {
  const minutes = value.hour() * 60 + value.minute();
  const snapped = snapMinutes(minutes, mode);
  return minutesToTimeString(snapped % MINUTES_PER_DAY);
}

import dayjs from 'dayjs';
import { DayType } from '../types/shift.types';

export const TIME_WINDOW_START = 4 * 60; // 04:00
export const TIME_WINDOW_END = 24 * 60 + 60; // 01:00 next day (exclusive)
export const INTERVAL_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;

export const DAY_TYPES: DayType[] = ['weekday', 'saturday', 'sunday'];

/**
 * Convert a HH:mm string to minutes since start of day.
 * Values prior to the 04:00 window are treated as next-day minutes.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time format "${time}". Expected HH:MM in 24-hour format.`);
  }

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes < TIME_WINDOW_START) {
    return totalMinutes + MINUTES_PER_DAY;
  }
  return totalMinutes;
}

export function minutesToTimeString(minutes: number): string {
  const normalized = minutes >= MINUTES_PER_DAY ? minutes - MINUTES_PER_DAY : minutes;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function floorToInterval(minutes: number, interval = INTERVAL_MINUTES): number {
  return Math.floor(minutes / interval) * interval;
}

export function ceilToInterval(minutes: number, interval = INTERVAL_MINUTES): number {
  return Math.ceil(minutes / interval) * interval;
}

export function clampToWindow(minutes: number): number {
  if (minutes < TIME_WINDOW_START) return TIME_WINDOW_START;
  if (minutes > TIME_WINDOW_END) return TIME_WINDOW_END;
  return minutes;
}

export function generateTimelineMinutes(): number[] {
  const points: number[] = [];
  for (let m = TIME_WINDOW_START; m < TIME_WINDOW_END; m += INTERVAL_MINUTES) {
    points.push(m);
  }
  return points;
}

export function normalizeDayType(value: string): DayType {
  const normalized = value.trim().toLowerCase() as DayType;
  if (!DAY_TYPES.includes(normalized)) {
    throw new Error(`Unsupported day_type value "${value}". Expected Weekday, Saturday, or Sunday.`);
  }
  return normalized;
}

export function parseFlexibleTime(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.replace(/\u00A0/g, ' ').trim();
  if (!trimmed) {
    return null;
  }

  const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
    const period = amPmMatch[3].toLowerCase();

    if (hours === 12) {
      hours = 0;
    }
    if (period === 'pm') {
      hours += 12;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  const twentyFourMatch = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))$/);
  if (twentyFourMatch) {
    const hours = parseInt(twentyFourMatch[1], 10);
    const minutes = parseInt(twentyFourMatch[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  const hourOnlyMatch = trimmed.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    const hours = parseInt(hourOnlyMatch[1], 10);
    if (hours >= 0 && hours < 24) {
      return `${hours.toString().padStart(2, '0')}:00`;
    }
  }

  return null;
}

export function ensureValidTimeRange(start: number, end: number): [number, number] {
  let normalizedStart = start;
  let normalizedEnd = end;

  if (normalizedEnd <= normalizedStart) {
    normalizedEnd += MINUTES_PER_DAY;
  }

  normalizedStart = clampToWindow(normalizedStart);
  normalizedEnd = clampToWindow(normalizedEnd);

  if (normalizedEnd <= normalizedStart) {
    normalizedEnd = normalizedStart + INTERVAL_MINUTES;
  }

  return [normalizedStart, normalizedEnd];
}

export function calculateTotalHours(start: string, end: string, breakStart?: string, breakEnd?: string): number {
  const startMinutes = parseTimeToMinutes(start);
  let endMinutes = parseTimeToMinutes(end);

  if (endMinutes <= startMinutes) {
    endMinutes += MINUTES_PER_DAY;
  }

  let durationMinutes = endMinutes - startMinutes;

  if (breakStart && breakEnd) {
    let breakStartMinutes = parseTimeToMinutes(breakStart);
    let breakEndMinutes = parseTimeToMinutes(breakEnd);
    if (breakEndMinutes <= breakStartMinutes) {
      breakEndMinutes += MINUTES_PER_DAY;
    }
    const breakDuration = breakEndMinutes - breakStartMinutes;
    durationMinutes = Math.max(0, durationMinutes - breakDuration);
  }

  const hours = durationMinutes / 60;
  return Math.round(hours * 100) / 100;
}

export function formatIsoTimestamp(date = new Date()): string {
  return dayjs(date).toISOString();
}

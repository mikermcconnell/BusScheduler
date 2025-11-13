import { DayType, Shift } from '../types/shift.types';
import { buildBreakCoverageTimelineFromShifts } from './autoShiftGenerator';
import { DAY_TYPES, INTERVAL_MINUTES, TIME_WINDOW_END, parseTimeToMinutes } from './timeUtils';

export interface BreakReliefSummary {
  dayType: DayType;
  totalHours: number;
  northHours: number;
  southHours: number;
  floaterHours: number;
  intervalCount: number;
}

export function computeBreakReliefSummary(shifts: Shift[]): BreakReliefSummary[] {
  const reliefTimeline = buildBreakCoverageTimelineFromShifts(shifts);

  return DAY_TYPES.map((dayType) => {
    const intervals = reliefTimeline[dayType] ?? [];
    let northHours = 0;
    let southHours = 0;
    let floaterHours = 0;

    intervals.forEach((interval) => {
      const durationHours = computeIntervalHours(interval.startTime, interval.endTime);
      northHours += (interval.northRequired ?? 0) * durationHours;
      southHours += (interval.southRequired ?? 0) * durationHours;
      floaterHours += (interval.floaterRequired ?? 0) * durationHours;
    });

    const totalHours = northHours + southHours + floaterHours;

    return {
      dayType,
      totalHours,
      northHours,
      southHours,
      floaterHours,
      intervalCount: intervals.length
    };
  });
}

function computeIntervalHours(startTime: string, endTime: string): number {
  let startMinutes = parseTimeToMinutes(startTime);
  let endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  endMinutes = Math.min(endMinutes, TIME_WINDOW_END);
  const durationMinutes = Math.max(INTERVAL_MINUTES, endMinutes - startMinutes);
  return durationMinutes / 60;
}

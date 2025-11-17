import { z } from 'zod';
import { INTERVAL_MINUTES, TIME_WINDOW_END, TIME_WINDOW_START } from './timeUtils';
import type { DayType, ShiftZone, UnionRule } from '../types/shift.types';
import { parseTimeToMinutes } from './timeUtils';

const dayTypeValues: [DayType, ...DayType[]] = ['weekday', 'saturday', 'sunday'];
const shiftZoneValues: [ShiftZone, ...ShiftZone[]] = ['North', 'South', 'Floater'];

const timePattern = /^([0-1]?\d|2[0-3]):[0-5]\d$/;
const timeString = z.string().regex(timePattern, 'Time must be in HH:MM format');
const optionalTimeString = timeString.nullable().optional();

export const manualShiftFormSchema = z
  .object({
    shiftCode: z.string().min(1, 'Shift code is required'),
    scheduleType: z.enum(dayTypeValues),
    zone: z.enum(shiftZoneValues),
    startTime: timeString,
    endTime: timeString,
    breakDuration: z.number().min(0).max(180).nullable().optional(),
    breakStart: optionalTimeString,
    breakEnd: optionalTimeString,
    mealBreakStart: optionalTimeString,
    mealBreakEnd: optionalTimeString,
    isSplitShift: z.boolean()
  })
  .refine(
    (data) => parseTimeToMinutes(data.endTime) > parseTimeToMinutes(data.startTime),
    {
      message: 'End time must be after start time',
      path: ['endTime']
    }
  )
  .refine(
    (data) => !data.breakStart || !!data.breakEnd,
    {
      message: 'Break end time is required',
      path: ['breakEnd']
    }
  )
  .refine(
    (data) => !data.breakEnd || !!data.breakStart,
    {
      message: 'Break start time is required',
      path: ['breakStart']
    }
  )
  .refine(
    (data) => !data.mealBreakStart || !!data.mealBreakEnd,
    {
      message: 'Meal break end time is required',
      path: ['mealBreakEnd']
    }
  )
  .refine(
    (data) => !data.mealBreakEnd || !!data.mealBreakStart,
    {
      message: 'Meal break start time is required',
      path: ['mealBreakStart']
    }
  );

export type ManualShiftFormValues = z.infer<typeof manualShiftFormSchema>;

export const shiftEditorFormSchema = z
  .object({
    shiftCode: z.string().min(1, 'Shift code is required'),
    scheduleType: z.enum(dayTypeValues),
    zone: z.enum(shiftZoneValues),
    range: z
      .tuple([
        z.number().min(TIME_WINDOW_START),
        z.number().max(TIME_WINDOW_END)
      ])
      .refine(([start, end]) => end > start, {
        message: 'Shift end must be after start',
        path: ['range']
      }),
    includeBreak: z.boolean(),
    breakRange: z.tuple([z.number(), z.number()]).optional()
  })
  .refine(
    (data) =>
      !data.includeBreak ||
      (data.breakRange &&
        data.breakRange[0] >= data.range[0] + INTERVAL_MINUTES &&
        data.breakRange[1] <= data.range[1]),
    {
      message: 'Break must fall inside the shift window',
      path: ['breakRange']
    }
  )
  .refine(
    (data) =>
      !data.includeBreak ||
      (data.breakRange && data.breakRange[1] > data.breakRange[0]),
    {
      message: 'Break end must be after break start',
      path: ['breakRange']
    }
  );

export type ShiftEditorFormValues = z.infer<typeof shiftEditorFormSchema>;

const unionRuleSchema: z.ZodType<UnionRule> = z.object({
  id: z.number().optional(),
  ruleName: z.string().min(1, 'Rule name is required'),
  ruleType: z.enum(['required', 'preferred']),
  category: z.enum(['shift_length', 'breaks', 'rest_periods']),
  minValue: z.number().nonnegative().optional(),
  maxValue: z.number().nonnegative().optional(),
  unit: z.enum(['hours', 'minutes']).optional(),
  isActive: z.boolean(),
  description: z.string().optional()
});

export const unionRulesFormSchema = z.object({
  rules: z.array(unionRuleSchema)
});

export type UnionRulesFormValues = z.infer<typeof unionRulesFormSchema>;

import { Shift, UnionRule, UnionViolation } from '../types/shift.types';
import { isMealBreakThresholdRule } from './ruleMatchers';

const FALLBACK_RULES: UnionRule[] = [
  {
    id: 1,
    ruleName: 'Minimum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    minValue: 5,
    unit: 'hours',
    isActive: true
  },
  {
    id: 2,
    ruleName: 'Maximum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    maxValue: 9.75,
    unit: 'hours',
    isActive: true
  },
  {
    id: 3,
    ruleName: 'Meal Break Requirement Threshold',
    ruleType: 'required',
    category: 'breaks',
    minValue: 7.5,
    unit: 'hours',
    isActive: true
  },
  {
    id: 4,
    ruleName: 'Meal Break Latest Start',
    ruleType: 'required',
    category: 'breaks',
    maxValue: 4.75,
    unit: 'hours',
    isActive: true
  },
  {
    id: 5,
    ruleName: 'Meal Break Duration',
    ruleType: 'required',
    category: 'breaks',
    minValue: 40,
    unit: 'minutes',
    isActive: true
  }
];

export async function validateShiftAgainstRules(
  shift: Shift,
  rules?: UnionRule[]
): Promise<UnionViolation[]> {
  const violations: UnionViolation[] = [];
  const activeRules = (rules?.length ? rules : FALLBACK_RULES).filter((rule) => rule.isActive);

  const minShiftHours = extractMinShiftHours(activeRules) ?? 7;
  const maxShiftHours = extractMaxShiftHours(activeRules) ?? 9.75;
  const breakThresholdHours = extractBreakThresholdHours(activeRules) ?? 7.5;
  const mealBreakDurationMinutes = extractMealBreakDurationMinutes(activeRules) ?? 40;
  const mealBreakLatestStartHours = extractMealBreakLatestStartHours(activeRules) ?? 4.75;

  const onDutyHours = calculateOnDutyHours(shift);
  const mealBreak = resolveMealBreak(shift);
  const continuousHoursBeforeBreak = mealBreak?.startOffsetMinutes != null
    ? Number((mealBreak.startOffsetMinutes / 60).toFixed(2))
    : onDutyHours;

  if (onDutyHours < minShiftHours) {
    violations.push({
      ruleId: findRuleId(activeRules, 'Minimum Shift Length'),
      ruleName: 'Minimum Shift Length',
      violationType: 'error',
      violationMessage: `Shift is ${onDutyHours.toFixed(2)} hours; minimum shift length is ${minShiftHours.toFixed(2)} hours.`
    });
  }

  if (onDutyHours > maxShiftHours) {
    violations.push({
      ruleId: findRuleId(activeRules, 'Maximum Shift Length'),
      ruleName: 'Maximum Shift Length',
      violationType: 'error',
      violationMessage: `Shift is ${onDutyHours.toFixed(2)} hours; maximum shift length is ${maxShiftHours.toFixed(2)} hours.`
    });
  }

  if (onDutyHours > breakThresholdHours) {
    if (!mealBreak) {
      violations.push({
        ruleId: findRuleId(activeRules, 'Meal Break Duration'),
        ruleName: 'Meal Break Duration',
        violationType: 'error',
        violationMessage: `Shifts longer than ${breakThresholdHours.toFixed(2)} hours require a ${mealBreakDurationMinutes}-minute meal break beginning no later than ${mealBreakLatestStartHours.toFixed(2)} hours into the shift.`
      });
    } else {
      if (mealBreak.durationMinutes < mealBreakDurationMinutes) {
        violations.push({
          ruleId: findRuleId(activeRules, 'Meal Break Duration'),
          ruleName: 'Meal Break Duration',
          violationType: 'error',
          violationMessage: `Meal break is ${mealBreak.durationMinutes} minutes; at least ${mealBreakDurationMinutes} minutes are required.`
        });
      }

      if (mealBreak.startOffsetMinutes == null) {
        violations.push({
          ruleId: findRuleId(activeRules, 'Meal Break Latest Start'),
          ruleName: 'Meal Break Latest Start',
          violationType: 'error',
          violationMessage: 'Meal break start time is not specified; it must begin no later than 4.75 hours into the shift.'
        });
      } else {
        const latestStartMinutes = mealBreakLatestStartHours * 60;
        if (mealBreak.startOffsetMinutes > latestStartMinutes) {
          violations.push({
            ruleId: findRuleId(activeRules, 'Meal Break Latest Start'),
            ruleName: 'Meal Break Latest Start',
            violationType: 'error',
            violationMessage: `Meal break begins ${ (mealBreak.startOffsetMinutes / 60).toFixed(2) } hours into the shift; it must start no later than ${mealBreakLatestStartHours.toFixed(2)} hours.`
          });
        }
      }
    }
  } else if (continuousHoursBeforeBreak > breakThresholdHours) {
    // If the break exists but occurs after threshold, flag a warning even if total shift <= threshold.
    violations.push({
      ruleId: findRuleId(activeRules, 'Meal Break Latest Start'),
      ruleName: 'Meal Break Latest Start',
      violationType: 'warning',
      violationMessage: `Break begins ${continuousHoursBeforeBreak.toFixed(2)} hours into the shift. Consider scheduling it earlier to keep it before ${mealBreakLatestStartHours.toFixed(2)} hours.`
    });
  }

  return violations;
}

function calculateOnDutyHours(shift: Shift): number {
  const startMinutes = timeToMinutes(shift.startTime);
  let endMinutes = timeToMinutes(shift.endTime);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = endMinutes - startMinutes;
  return Number((durationMinutes / 60).toFixed(2));
}

interface MealBreakInfo {
  durationMinutes: number;
  startOffsetMinutes: number | null;
  source: 'meal' | 'break' | 'durationOnly';
}

function resolveMealBreak(shift: Shift): MealBreakInfo | null {
  const startMinutes = timeToMinutes(shift.startTime);

  const fromTimes = (start?: string, end?: string): MealBreakInfo | null => {
    if (!start || !end) {
      return null;
    }
    let breakStartMinutes = timeToMinutes(start);
    let breakEndMinutes = timeToMinutes(end);

    if (breakEndMinutes <= breakStartMinutes) {
      breakEndMinutes += 24 * 60;
    }

    if (breakStartMinutes <= startMinutes) {
      breakStartMinutes += 24 * 60;
      breakEndMinutes += 24 * 60;
    }

    return {
      durationMinutes: breakEndMinutes - breakStartMinutes,
      startOffsetMinutes: breakStartMinutes - startMinutes,
      source: 'meal'
    };
  };

  if (shift.mealBreakStart && shift.mealBreakEnd) {
    const mealBreak = fromTimes(shift.mealBreakStart, shift.mealBreakEnd);
    if (mealBreak) {
      return { ...mealBreak, source: 'meal' };
    }
  }

  if (shift.breakStart && (shift.breakEnd || shift.breakDuration)) {
    if (shift.breakEnd) {
      const breakInfo = fromTimes(shift.breakStart, shift.breakEnd);
      if (breakInfo) {
        return { ...breakInfo, source: 'break' };
      }
    }

    if (shift.breakDuration && shift.breakDuration >= 1) {
      const start = timeToMinutes(shift.breakStart);
      const offset = start < startMinutes ? start + 24 * 60 - startMinutes : start - startMinutes;

      return {
        durationMinutes: shift.breakDuration,
        startOffsetMinutes: offset,
        source: 'break'
      };
    }
  }

  if (shift.breakDuration && shift.breakDuration >= 40) {
    return {
      durationMinutes: shift.breakDuration,
      startOffsetMinutes: null,
      source: 'durationOnly'
    };
  }

  return null;
}

function extractMinShiftHours(rules: UnionRule[]): number | null {
  const rule = rules.find(
    (r) =>
      r.category === 'shift_length' &&
      r.ruleType === 'required' &&
      typeof r.minValue === 'number'
  );

  if (!rule || typeof rule.minValue !== 'number') {
    return null;
  }

  return rule.unit === 'minutes' ? rule.minValue / 60 : rule.minValue;
}

function extractMaxShiftHours(rules: UnionRule[]): number | null {
  const rule = rules.find(
    (r) =>
      r.category === 'shift_length' &&
      r.ruleType === 'required' &&
      typeof r.maxValue === 'number'
  );

  if (!rule || typeof rule.maxValue !== 'number') {
    return null;
  }

  return rule.unit === 'minutes' ? rule.maxValue / 60 : rule.maxValue;
}

function extractBreakThresholdHours(rules: UnionRule[]): number | null {
  const rule =
    rules.find(
      (r) =>
        r.category === 'breaks' &&
        r.ruleType === 'required' &&
        typeof r.minValue === 'number' &&
        isMealBreakThresholdRule(r)
    ) ??
    rules.find(
      (r) =>
        r.category === 'breaks' &&
        r.ruleType === 'required' &&
        typeof r.minValue === 'number' &&
        r.ruleName.toLowerCase().includes('threshold')
    );

  if (!rule || typeof rule.minValue !== 'number') {
    return null;
  }

  return rule.unit === 'minutes' ? rule.minValue / 60 : rule.minValue;
}

function extractMealBreakDurationMinutes(rules: UnionRule[]): number | null {
  const rule = rules.find(
    (r) =>
      r.category === 'breaks' &&
      r.ruleType === 'required' &&
      r.ruleName.toLowerCase().includes('duration') &&
      typeof r.minValue === 'number'
  );

  if (!rule || typeof rule.minValue !== 'number') {
    return null;
  }

  return rule.unit === 'hours' ? Math.round(rule.minValue * 60) : rule.minValue;
}

function extractMealBreakLatestStartHours(rules: UnionRule[]): number | null {
  const rule = rules.find(
    (r) =>
      r.category === 'breaks' &&
      r.ruleType === 'required' &&
      r.ruleName.toLowerCase().includes('latest start') &&
      typeof r.maxValue === 'number'
  );

  if (!rule || typeof rule.maxValue !== 'number') {
    return null;
  }

  return rule.unit === 'minutes' ? rule.maxValue / 60 : rule.maxValue;
}

function findRuleId(rules: UnionRule[], ruleName: string): number {
  const found = rules.find((rule) => rule.ruleName === ruleName);
  return found?.id ?? 0;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

import { Shift, UnionRule, UnionViolation } from './types/shift.types';

export async function validateShiftAgainstRules(
  shift: Shift,
  rules: UnionRule[]
): Promise<UnionViolation[]> {
  const violations: UnionViolation[] = [];

  rules.forEach(rule => {
    if (!rule.isActive) return;

    switch (rule.category) {
      case 'shift_length':
        validateShiftLength(shift, rule, violations);
        break;
      case 'breaks':
        validateBreaks(shift, rule, violations);
        break;
      case 'rest_periods':
        // This would need access to other shifts to validate
        // For now, we'll skip rest period validation
        break;
    }
  });

  return violations;
}

function validateShiftLength(
  shift: Shift,
  rule: UnionRule,
  violations: UnionViolation[]
): void {
  const totalHours = shift.totalHours || calculateTotalHours(shift);

  if (rule.ruleName.includes('Maximum Driving Time') && rule.maxValue) {
    if (totalHours > rule.maxValue) {
      violations.push({
        ruleId: rule.id!,
        ruleName: rule.ruleName,
        violationType: rule.ruleType === 'required' ? 'error' : 'warning',
        violationMessage: `Shift exceeds maximum driving time of ${rule.maxValue} hours (${totalHours} hours)`,
      });
    }
  }

  if (rule.ruleName.includes('Maximum On-Duty Time') && rule.maxValue) {
    const onDutyHours = calculateOnDutyHours(shift);
    if (onDutyHours > rule.maxValue) {
      violations.push({
        ruleId: rule.id!,
        ruleName: rule.ruleName,
        violationType: rule.ruleType === 'required' ? 'error' : 'warning',
        violationMessage: `Shift exceeds maximum on-duty time of ${rule.maxValue} hours (${onDutyHours} hours)`,
      });
    }
  }
}

function validateBreaks(
  shift: Shift,
  rule: UnionRule,
  violations: UnionViolation[]
): void {
  if (rule.ruleName.includes('Break After Continuous Driving')) {
    const continuousDrivingHours = calculateContinuousDriving(shift);
    
    if (rule.maxValue && continuousDrivingHours > rule.maxValue && !shift.breakStart) {
      violations.push({
        ruleId: rule.id!,
        ruleName: rule.ruleName,
        violationType: rule.ruleType === 'required' ? 'error' : 'warning',
        violationMessage: `No break scheduled after ${rule.maxValue} hours of continuous driving`,
      });
    }
  }

  if (rule.ruleName.includes('Meal Break Requirement')) {
    const totalHours = shift.totalHours || calculateTotalHours(shift);
    
    if (rule.minValue && totalHours > rule.minValue && !shift.mealBreakStart) {
      violations.push({
        ruleId: rule.id!,
        ruleName: rule.ruleName,
        violationType: rule.ruleType === 'required' ? 'error' : 'warning',
        violationMessage: `No meal break scheduled for shift over ${rule.minValue} hours`,
      });
    }
  }
}

function calculateTotalHours(shift: Shift): number {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);
  let totalMinutes = end - start;

  // Subtract break time
  if (shift.breakDuration) {
    totalMinutes -= shift.breakDuration;
  }

  // Subtract meal break time
  if (shift.mealBreakStart && shift.mealBreakEnd) {
    const mealStart = timeToMinutes(shift.mealBreakStart);
    const mealEnd = timeToMinutes(shift.mealBreakEnd);
    totalMinutes -= (mealEnd - mealStart);
  }

  return totalMinutes / 60;
}

function calculateOnDutyHours(shift: Shift): number {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);
  return (end - start) / 60;
}

function calculateContinuousDriving(shift: Shift): number {
  if (!shift.breakStart) {
    return calculateTotalHours(shift);
  }

  const start = timeToMinutes(shift.startTime);
  const breakStart = timeToMinutes(shift.breakStart);
  return (breakStart - start) / 60;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
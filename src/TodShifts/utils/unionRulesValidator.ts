import { Shift, UnionRule, UnionViolation } from '../types/shift.types';

export async function validateShiftAgainstRules(
  shift: Shift,
  rules?: UnionRule[]
): Promise<UnionViolation[]> {
  const violations: UnionViolation[] = [];
  
  // Mock validation logic - in a real app this would check against actual rules
  const mockRules: UnionRule[] = rules || [
    {
      id: 1,
      ruleName: 'Maximum Shift Length',
      ruleType: 'required',
      category: 'shift_length',
      maxValue: 10,
      unit: 'hours',
      isActive: true,
      description: 'Shifts cannot exceed 10 hours'
    },
    {
      id: 2,
      ruleName: 'Minimum Break Duration',
      ruleType: 'required',
      category: 'breaks',
      minValue: 30,
      unit: 'minutes',
      isActive: true,
      description: 'Minimum 30 minute break required'
    }
  ];

  // Calculate total hours
  const startTime = new Date(`2024-01-01 ${shift.startTime}`);
  const endTime = new Date(`2024-01-01 ${shift.endTime}`);
  let totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  
  // Handle overnight shifts
  if (totalHours < 0) {
    totalHours += 24;
  }

  // Check shift length
  const maxShiftRule = mockRules.find(r => r.ruleName === 'Maximum Shift Length' && r.isActive);
  if (maxShiftRule && maxShiftRule.maxValue && totalHours > maxShiftRule.maxValue) {
    violations.push({
      ruleId: maxShiftRule.id!,
      ruleName: maxShiftRule.ruleName,
      violationType: maxShiftRule.ruleType === 'required' ? 'error' : 'warning',
      violationMessage: `Shift duration (${totalHours.toFixed(1)} hours) exceeds maximum allowed (${maxShiftRule.maxValue} hours)`
    });
  }

  // Check break duration
  const minBreakRule = mockRules.find(r => r.ruleName === 'Minimum Break Duration' && r.isActive);
  if (minBreakRule && minBreakRule.minValue) {
    const breakDuration = shift.breakDuration || 0;
    if (breakDuration < minBreakRule.minValue) {
      violations.push({
        ruleId: minBreakRule.id!,
        ruleName: minBreakRule.ruleName,
        violationType: minBreakRule.ruleType === 'required' ? 'error' : 'warning',
        violationMessage: `Break duration (${breakDuration} minutes) is less than minimum required (${minBreakRule.minValue} minutes)`
      });
    }
  }

  return violations;
}
import { UnionRule } from '../types/shift.types';

/**
 * Determines whether a rule describes the meal-break threshold requirement.
 * We key off the name including "meal" plus either "requirement" or "threshold"
 * so we ignore other break rules (duration, continuous driving, etc.).
 */
export function isMealBreakThresholdRule(rule: Pick<UnionRule, 'ruleName'>): boolean {
  if (!rule.ruleName) {
    return false;
  }

  const normalized = rule.ruleName.toLowerCase();
  if (!normalized.includes('meal')) {
    return false;
  }

  return normalized.includes('threshold') || normalized.includes('requirement');
}

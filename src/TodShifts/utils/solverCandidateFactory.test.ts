import { buildSolverCandidates } from './solverCandidateFactory';
import { Shift, UnionRule } from '../types/shift.types';

const UNION_RULES: UnionRule[] = [
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

const BASE_SHIFT: Shift = {
  id: 'shift-001',
  shiftCode: 'WK-N-01',
  scheduleType: 'weekday',
  zone: 'North',
  startTime: '06:00',
  endTime: '14:00',
  totalHours: 8,
  breakStart: '10:00',
  breakEnd: '10:40',
  breakDuration: 40,
  isSplitShift: false,
  unionCompliant: true,
  complianceWarnings: [],
  vehicleCount: 1
};

describe('solverCandidateFactory', () => {
  it('returns a single candidate when variants are disabled', () => {
    const candidates = buildSolverCandidates(BASE_SHIFT, {
      prefix: 'existing-0',
      existing: true,
      unionRules: UNION_RULES,
      enableVariants: false
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].startTime).toBe('06:00');
    expect(candidates[0].endTime).toBe('14:00');
  });

  it('generates staggered variants that respect union limits when enabled', () => {
    const candidates = buildSolverCandidates(BASE_SHIFT, {
      prefix: 'generated-0',
      existing: false,
      unionRules: UNION_RULES,
      enableVariants: true,
      offsets: [-30, -15, 0, 15, 30]
    });

    expect(candidates.length).toBeGreaterThan(1);
    candidates.forEach((candidate) => {
      expect(candidate.totalHours).toBeGreaterThanOrEqual(5);
      expect(candidate.totalHours).toBeLessThanOrEqual(9.75);
    });
  });

  it('keeps break windows within the adjusted shift bounds', () => {
    const candidates = buildSolverCandidates(BASE_SHIFT, {
      prefix: 'generated-1',
      existing: false,
      unionRules: UNION_RULES,
      enableVariants: true,
      offsets: [-45, 0, 45]
    });

    candidates.forEach((candidate) => {
      if (candidate.breakStart && candidate.breakEnd) {
        expect(candidate.breakStart >= candidate.startTime).toBe(true);
        expect(candidate.breakEnd <= candidate.endTime).toBe(true);
      }
    });
  });
});

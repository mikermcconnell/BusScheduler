import { generateAutoShifts } from './autoShiftGenerator';
import { CityRequirementInterval, DayType, UnionRule } from '../types/shift.types';

const BASE_UNION_RULES: UnionRule[] = [
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

const emptyTimeline: Record<DayType, CityRequirementInterval[]> = {
  weekday: [],
  saturday: [],
  sunday: []
};

describe('generateAutoShifts union compliance', () => {
  it('splits long coverage windows so no shift exceeds the max length rule', async () => {
    const longWindow: CityRequirementInterval = {
      dayType: 'weekday',
      startTime: '05:00',
      endTime: '23:00',
      northRequired: 1,
      southRequired: 0,
      floaterRequired: 0
    };

    const cityTimeline = {
      ...emptyTimeline,
      weekday: [longWindow]
    };

    const result = await generateAutoShifts({ cityTimeline, unionRules: BASE_UNION_RULES });
    const primaryShifts = result.shifts.filter((shift) => !shift.shiftCode.startsWith('AUTO-REL'));

    expect(primaryShifts.length).toBeGreaterThan(1);
    const hours = primaryShifts.map((shift) => shift.totalHours);
    const longestShift = Math.max(...hours);
    const shortestShift = Math.min(...hours);
    expect(longestShift).toBeLessThanOrEqual(9.75);
    expect(shortestShift).toBeGreaterThanOrEqual(5);
  });

  it('extends short coverage to satisfy minimum shift length', async () => {
    const shortWindow: CityRequirementInterval = {
      dayType: 'saturday',
      startTime: '10:00',
      endTime: '12:00',
      northRequired: 1,
      southRequired: 0,
      floaterRequired: 0
    };

    const cityTimeline = {
      ...emptyTimeline,
      saturday: [shortWindow]
    };

    const result = await generateAutoShifts({ cityTimeline, unionRules: BASE_UNION_RULES });
    const primaryShifts = result.shifts.filter((shift) => !shift.shiftCode.startsWith('AUTO-REL'));

    expect(primaryShifts).toHaveLength(1);
    expect(primaryShifts[0].totalHours).toBeGreaterThanOrEqual(5);
    expect(primaryShifts[0].startTime).toBe('10:00');
    expect(primaryShifts[0].endTime).toBe('15:00');
  });

  it('creates relief coverage to offset scheduled breaks', async () => {
    const coverageWindow: CityRequirementInterval = {
      dayType: 'weekday',
      startTime: '05:00',
      endTime: '15:00',
      northRequired: 1,
      southRequired: 0,
      floaterRequired: 0
    };

    const cityTimeline = {
      ...emptyTimeline,
      weekday: [coverageWindow]
    };

    const reliefUnionRules = BASE_UNION_RULES.map((rule) => {
      if (rule.id === 1) {
        return {
          ...rule,
          minValue: 8
        };
      }
      if (rule.id === 3) {
        return {
          ...rule,
          minValue: 4
        };
      }
      return rule;
    });

    const result = await generateAutoShifts({ cityTimeline, unionRules: reliefUnionRules });
    const reliefShifts = result.shifts.filter((shift) => shift.shiftCode.startsWith('AUTO-REL'));

    expect(reliefShifts.length).toBeGreaterThan(0);
    expect(reliefShifts.every((shift) => shift.unionCompliant)).toBe(true);
  });

  it('generates floater shifts when floater requirements are present', async () => {
    const floaterWindow: CityRequirementInterval = {
      dayType: 'weekday',
      startTime: '06:00',
      endTime: '12:00',
      northRequired: 0,
      southRequired: 0,
      floaterRequired: 2
    };

    const cityTimeline = {
      ...emptyTimeline,
      weekday: [floaterWindow]
    };

    const result = await generateAutoShifts({ cityTimeline, unionRules: BASE_UNION_RULES });
    const floaterShifts = result.shifts.filter((shift) => shift.zone === 'Floater' && !shift.shiftCode.startsWith('AUTO-REL'));

    expect(floaterShifts.length).toBeGreaterThan(0);
    floaterShifts.forEach((shift) => {
      expect(shift.scheduleType).toBe('weekday');
      expect(shift.unionCompliant).toBe(true);
    });
  });
});

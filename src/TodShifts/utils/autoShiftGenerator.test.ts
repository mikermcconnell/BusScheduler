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

    expect(result.shifts.length).toBeGreaterThan(1);
    const hours = result.shifts.map((shift) => shift.totalHours);
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

    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0].totalHours).toBeGreaterThanOrEqual(5);
    expect(result.shifts[0].startTime).toBe('10:00');
    expect(result.shifts[0].endTime).toBe('15:00');
  });

});

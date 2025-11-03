import { computeOptimizationInsights } from './shiftOptimizationEngine';
import {
  DayType,
  Shift,
  ShiftCoverageInterval,
  UnionRule
} from '../types/shift.types';

const unionRules: UnionRule[] = [
  {
    id: 1,
    ruleName: 'Maximum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    maxValue: 10,
    unit: 'hours',
    isActive: true
  },
  {
    id: 2,
    ruleName: 'Minimum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    minValue: 6,
    unit: 'hours',
    isActive: true
  },
  {
    id: 3,
    ruleName: 'Minimum Break Duration',
    ruleType: 'required',
    category: 'breaks',
    minValue: 30,
    unit: 'minutes',
    isActive: true
  }
];

const emptyDay: ShiftCoverageInterval[] = [];

function buildCoverage(intervals: ShiftCoverageInterval[]) {
  const base: Record<DayType, ShiftCoverageInterval[]> = {
    weekday: emptyDay,
    saturday: emptyDay,
    sunday: emptyDay
  };
  return {
    ...base,
    weekday: intervals
  };
}

describe('shiftOptimizationEngine', () => {
  it('suggests extending shifts before proposing new work', () => {
    const coverage = buildCoverage([
      {
        dayType: 'weekday',
        startTime: '06:00',
        endTime: '06:15',
        northRequired: 3,
        southRequired: 1,
        floaterRequired: 0,
        northOperational: 1,
        southOperational: 1,
        floaterOperational: 0,
        floaterAllocatedNorth: 0,
        floaterAllocatedSouth: 0,
        northExcess: -2,
        southExcess: 0,
        totalExcess: -1,
        status: 'deficit'
      },
      {
        dayType: 'weekday',
        startTime: '06:15',
        endTime: '06:30',
        northRequired: 3,
        southRequired: 1,
        floaterRequired: 0,
        northOperational: 1,
        southOperational: 1,
        floaterOperational: 0,
        floaterAllocatedNorth: 0,
        floaterAllocatedSouth: 0,
        northExcess: -2,
        southExcess: 0,
        totalExcess: -1,
        status: 'deficit'
      }
    ]);

    const shifts: Shift[] = [
      {
        id: 'N1',
        shiftCode: 'N1',
        scheduleType: 'weekday',
        zone: 'North',
        startTime: '04:00',
        endTime: '06:00',
        totalHours: 2,
        isSplitShift: false,
        unionCompliant: true
      }
    ];

    const insights = computeOptimizationInsights({
      dayType: 'weekday',
      coverageTimeline: coverage,
      shifts,
      unionRules
    });

    const extendRecommendation = insights.recommendations.find((rec) => rec.type === 'extend_shift');
    expect(extendRecommendation).toBeTruthy();
    expect(extendRecommendation?.affectedShiftCodes).toContain('N1');

    const newShiftRecommendation = insights.recommendations.find((rec) => rec.type === 'new_shift');
    expect(newShiftRecommendation).toBeTruthy();
    expect(newShiftRecommendation?.summary).toContain('06:00');
  });

  it('flags break adjustments when breaks fall inside deficit windows', () => {
    const coverage = buildCoverage([
      {
        dayType: 'weekday',
        startTime: '12:00',
        endTime: '12:30',
        northRequired: 2,
        southRequired: 2,
        floaterRequired: 0,
        northOperational: 1,
        southOperational: 2,
        floaterOperational: 0,
        floaterAllocatedNorth: 0,
        floaterAllocatedSouth: 0,
        northExcess: -1,
        southExcess: 0,
        totalExcess: -1,
        status: 'deficit'
      }
    ]);

    const shifts: Shift[] = [
      {
        id: 'N2',
        shiftCode: 'N2',
        scheduleType: 'weekday',
        zone: 'North',
        startTime: '09:00',
        endTime: '17:00',
        totalHours: 8,
        breakStart: '12:00',
        breakEnd: '12:30',
        breakDuration: 30,
        isSplitShift: false,
        unionCompliant: true
      }
    ];

    const insights = computeOptimizationInsights({
      dayType: 'weekday',
      coverageTimeline: coverage,
      shifts,
      unionRules
    });

    const breakRecommendation = insights.recommendations.find((rec) => rec.type === 'break_adjustment');
    expect(breakRecommendation).toBeTruthy();
    expect(breakRecommendation?.summary).toContain('Move');
  });
});

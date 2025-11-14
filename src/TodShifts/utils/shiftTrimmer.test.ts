import { trimExcessShifts } from './shiftTrimmer';
import { Shift, ShiftCoverageInterval, UnionRule, DayType } from '../types/shift.types';

const UNION_RULES: UnionRule[] = [
  {
    id: 1,
    ruleName: 'Minimum Shift Length',
    ruleType: 'required',
    category: 'shift_length',
    minValue: 5,
    unit: 'hours',
    isActive: true
  }
];

const baseShift: Shift = {
  id: 'trim-01',
  shiftCode: 'TRIM-01',
  scheduleType: 'weekday',
  zone: 'North',
  startTime: '05:00',
  endTime: '12:00',
  totalHours: 7,
  isSplitShift: false,
  unionCompliant: true,
  vehicleCount: 1,
  complianceWarnings: []
};

const emptyCoverage: Record<DayType, ShiftCoverageInterval[]> = {
  weekday: [],
  saturday: [],
  sunday: []
};

function buildInterval(
  startTime: string,
  endTime: string,
  northExcess: number
): ShiftCoverageInterval {
  return {
    dayType: 'weekday',
    startTime,
    endTime,
    northRequired: 0,
    southRequired: 0,
    floaterRequired: 0,
    northOperational: northExcess,
    southOperational: 0,
    floaterOperational: 0,
    floaterAllocatedNorth: 0,
    floaterAllocatedSouth: 0,
    northExcess,
    southExcess: 0,
    floaterExcess: 0,
    totalExcess: northExcess,
    status: northExcess > 0 ? 'excess' : northExcess < 0 ? 'deficit' : 'balanced'
  };
}

describe('trimExcessShifts', () => {
  it('shaves leading and trailing surplus coverage', () => {
    const coverageTimeline: Record<DayType, ShiftCoverageInterval[]> = {
      weekday: [
        buildInterval('05:00', '06:00', 1),
        buildInterval('06:00', '11:00', 0),
        buildInterval('11:00', '12:00', 1)
      ],
      saturday: [],
      sunday: []
    };

    const result = trimExcessShifts({
      shifts: [baseShift],
      coverageTimeline,
      unionRules: UNION_RULES
    });

    expect(result.summary.hoursRemoved).toBeCloseTo(2, 1);
    expect(result.summary.shiftsModified).toBe(1);
    expect(result.shifts[0].startTime).toBe('06:00');
    expect(result.shifts[0].endTime).toBe('11:00');
    expect(result.shifts[0].totalHours).toBeCloseTo(5, 1);
  });

  it('returns original shifts when no surplus exists', () => {
    const result = trimExcessShifts({
      shifts: [baseShift],
      coverageTimeline: emptyCoverage,
      unionRules: UNION_RULES
    });

    expect(result.summary.hoursRemoved).toBe(0);
    expect(result.summary.shiftsModified).toBe(0);
    expect(result.shifts[0].startTime).toBe(baseShift.startTime);
    expect(result.shifts[0].endTime).toBe(baseShift.endTime);
  });
});

import { runShiftSolver, SolverCandidateShift } from './solverOptimizationEngine';
import { DayType, ShiftCoverageInterval, ShiftZone, UnionRule } from '../types/shift.types';

const unionRules: UnionRule[] = [
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
  }
];

const coverage: ShiftCoverageInterval[] = buildCoverageIntervals('weekday', [
  { start: '06:00', end: '06:15', north: 1, south: 0 },
  { start: '06:15', end: '06:30', north: 1, south: 0 }
]);

function buildCoverageIntervals(
  dayType: DayType,
  rows: Array<{ start: string; end: string; north: number; south: number }>
): ShiftCoverageInterval[] {
  return rows.map((row) => ({
    dayType,
    startTime: row.start,
    endTime: row.end,
    northRequired: row.north,
    southRequired: row.south,
    floaterRequired: 0,
    northOperational: 0,
    southOperational: 0,
    floaterOperational: 0,
    floaterAllocatedNorth: 0,
    floaterAllocatedSouth: 0,
    northExcess: -row.north,
    southExcess: -row.south,
    floaterExcess: 0,
    totalExcess: -(row.north + row.south),
    status: 'deficit'
  }));
}

function candidate(
  solverId: string,
  zone: ShiftZone,
  start: string,
  end: string,
  existing = false
): SolverCandidateShift {
  return {
    solverId,
    existing,
    scheduleType: 'weekday',
    zone,
    startTime: start,
    endTime: end,
    totalHours: 5,
    shiftCode: solverId,
    isSplitShift: false,
    unionCompliant: true,
    complianceWarnings: []
  } as SolverCandidateShift;
}

describe('solverOptimizationEngine', () => {
  it('prefers existing shift when coverage satisfied', () => {
    const candidates = [
      candidate('existing-1', 'North', '06:00', '11:00', true),
      candidate('new-1', 'North', '06:00', '13:00', false)
    ];

    const result = runShiftSolver({
      dayType: 'weekday',
      coverageTimeline: coverage,
      unionRules,
      candidateShifts: candidates
    });

    expect(result.selectedShifts.map((shift) => shift.shiftCode)).toContain('existing-1');
    expect(result.objectiveValue).toBeGreaterThan(0);
  });

  it('selects combination to close coverage gaps', () => {
    const candidates = [
      candidate('north-early', 'North', '05:30', '10:30', false),
      candidate('north-late', 'North', '06:00', '11:00', false)
    ];

    const result = runShiftSolver({
      dayType: 'weekday',
      coverageTimeline: coverage,
      unionRules,
      candidateShifts: candidates
    });

    expect(result.selectedShifts.length).toBeGreaterThan(0);
    expect(result.unmetConstraints).toHaveLength(0);
  });
});

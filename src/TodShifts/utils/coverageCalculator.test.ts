import { computeCoverageTimeline } from './coverageCalculator';
import { CityRequirementInterval, DayType, OperationalInterval } from '../types/shift.types';

type Timeline = Record<DayType, CityRequirementInterval[]>;
type Operations = Record<DayType, OperationalInterval[]>;

const emptyDay: CityRequirementInterval[] = [];
const emptyOps: OperationalInterval[] = [];

describe('computeCoverageTimeline - floater allocation', () => {
  it('allocates floater capacity to north/south deficits before floater demand', () => {
    const cityTimeline: Timeline = {
      weekday: [
        {
          dayType: 'weekday',
          startTime: '06:00',
          endTime: '06:15',
          northRequired: 5,
          southRequired: 5,
          floaterRequired: 1
        }
      ],
      saturday: emptyDay,
      sunday: emptyDay
    };

    const operationalTimeline: Operations = {
      weekday: [
        {
          dayType: 'weekday',
          startTime: '06:00',
          endTime: '06:15',
          northOperational: 4,
          southOperational: 5,
          floaterOperational: 1,
          breakCount: 0
        }
      ],
      saturday: emptyOps,
      sunday: emptyOps
    };

    const coverage = computeCoverageTimeline({ cityTimeline, operationalTimeline });
    const interval = coverage.timeline.weekday[0];

    expect(interval.floaterAllocatedNorth).toBe(1);
    expect(interval.northExcess).toBe(0);
    expect(interval.floaterOperational - interval.floaterAllocatedNorth - interval.floaterAllocatedSouth).toBe(0);
    expect(interval.floaterExcess).toBe(-1);
  });

  it('only contributes to floater requirement once zones are satisfied', () => {
    const cityTimeline: Timeline = {
      weekday: [
        {
          dayType: 'weekday',
          startTime: '07:00',
          endTime: '07:15',
          northRequired: 5,
          southRequired: 5,
          floaterRequired: 1
        }
      ],
      saturday: emptyDay,
      sunday: emptyDay
    };

    const operationalTimeline: Operations = {
      weekday: [
        {
          dayType: 'weekday',
          startTime: '07:00',
          endTime: '07:15',
          northOperational: 4,
          southOperational: 5,
          floaterOperational: 2,
          breakCount: 0
        }
      ],
      saturday: emptyOps,
      sunday: emptyOps
    };

    const coverage = computeCoverageTimeline({ cityTimeline, operationalTimeline });
    const interval = coverage.timeline.weekday[0];

    expect(interval.floaterAllocatedNorth).toBe(1);
    expect(interval.northExcess).toBe(0);
    expect(interval.floaterOperational - interval.floaterAllocatedNorth - interval.floaterAllocatedSouth).toBe(1);
    expect(interval.floaterExcess).toBe(0);
  });
});

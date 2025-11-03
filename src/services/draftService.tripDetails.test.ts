import { draftService } from './draftService';
import { SummarySchedule, Trip, TimePoint } from '../types/schedule';

describe('draftService trip detail normalization', () => {
  const serviceAny = draftService as unknown as {
    prepareSummaryScheduleForStorage(schedule: SummarySchedule): SummarySchedule;
    hydrateSummaryScheduleFromStorage(schedule: any): SummarySchedule | undefined;
    serializeForFirebase(data: unknown): unknown;
  };

  const timePoints: TimePoint[] = [
    { id: 'tp-1', name: 'Downtown Terminal', sequence: 1 },
    { id: 'tp-2', name: 'Johnson', sequence: 2 },
    { id: 'tp-3', name: 'Oak Street', sequence: 3 }
  ];

  const createMatrix = (): string[][] => [
    ['07:00', '07:12', '07:24'],
    ['07:20', '07:32', '07:44'],
    ['07:45', '07:57', '08:09']
  ];

  const buildTrips = (blocks: number[], matrix: string[][]): Trip[] =>
    blocks.map((blockNumber, index) => {
      const row = matrix[index];
      const arrivalTimes: Record<string, string> = {};
      const departureTimes: Record<string, string> = {};

      timePoints.forEach((timePoint, tpIndex) => {
        const value = row[tpIndex];
        arrivalTimes[timePoint.id] = value;
        departureTimes[timePoint.id] = value;
      });

      return {
        tripNumber: index + 1,
        blockNumber,
        departureTime: row[0],
        serviceBand: 'AM Peak',
        arrivalTimes,
        departureTimes,
        recoveryTimes: {},
        recoveryMinutes: 0
      };
    });

  const baseSchedule = (tripDetails?: Trip[]): SummarySchedule => {
    const weekdayMatrix = createMatrix();

    return {
      routeId: 'R1',
      routeName: 'Test Route',
      direction: 'Outbound',
      timePoints,
      weekday: weekdayMatrix,
      saturday: [],
      sunday: [],
      effectiveDate: new Date('2024-01-01T00:00:00Z'),
      metadata: {
        weekdayTrips: weekdayMatrix.length,
        saturdayTrips: 0,
        sundayTrips: 0
      },
      ...(tripDetails
        ? {
            tripDetails: {
              weekday: tripDetails
            }
          }
        : {})
    };
  };

  it('recomputes inconsistent block assignments before storage', () => {
    const weekdayMatrix = createMatrix();
    const inconsistentTrips = buildTrips([1, 2, 3], weekdayMatrix);
    const schedule = baseSchedule(inconsistentTrips);

    const normalized = serviceAny.prepareSummaryScheduleForStorage(schedule);

    expect(normalized.tripDetails?.weekday?.map(trip => trip.blockNumber)).toEqual([1, 2, 1]);
  });

  it('reconstructs trip details for legacy schedules during hydration', () => {
    const schedule = baseSchedule();
    const serialized = serviceAny.serializeForFirebase(schedule);

    const hydrated = serviceAny.hydrateSummaryScheduleFromStorage(serialized);

    const fallbackTrips = hydrated?.tripDetails?.weekday;
    expect(fallbackTrips).toBeTruthy();
    expect(fallbackTrips!.length).toBe(3);
    expect(fallbackTrips!.every(trip => typeof trip.blockNumber === 'number' && trip.blockNumber > 0)).toBe(true);
    expect(fallbackTrips!.every(trip => trip.serviceBand === 'Legacy Import')).toBe(true);
  });
});

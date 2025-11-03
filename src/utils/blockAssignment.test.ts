import { computeBlocksForTrips, computeBlocksFromMatrix, needsBlockRecompute, normalizeSummaryScheduleTrips } from './blockAssignment';
import { Trip, TimePoint, SummarySchedule } from '../types/schedule';

const timePoints: TimePoint[] = [
  { id: '1', name: 'Origin', sequence: 1 },
  { id: '2', name: 'Mid', sequence: 2 },
  { id: '3', name: 'Terminal', sequence: 3 }
];

const makeTrip = (tripNumber: number, departure: string, mid: string, end: string): Trip => ({
  tripNumber,
  blockNumber: 0,
  departureTime: departure,
  serviceBand: 'Standard Service',
  arrivalTimes: { '1': departure, '2': mid, '3': end },
  departureTimes: { '1': departure, '2': mid, '3': end },
  recoveryTimes: { '3': 0 },
  recoveryMinutes: 0
});

describe('blockAssignment', () => {
  it('assigns alternating blocks for evenly staggered trips', () => {
    const trips = [
      makeTrip(1, '07:00', '07:15', '07:30'),
      makeTrip(2, '07:15', '07:30', '07:45'),
      makeTrip(3, '07:30', '07:45', '08:00'),
      makeTrip(4, '07:45', '08:00', '08:15')
    ];

    const assigned = computeBlocksForTrips(trips, timePoints);
    const blocks = assigned.map(t => t.blockNumber);
    expect(blocks).toEqual([1, 2, 1, 2]);
  });

  it('adds a third block when overlap requires it', () => {
    const trips = [
      makeTrip(1, '07:00', '07:20', '07:40'),
      makeTrip(2, '07:05', '07:25', '07:45'),
      makeTrip(3, '07:10', '07:30', '07:50'),
      makeTrip(4, '07:40', '08:00', '08:20')
    ];

    const assigned = computeBlocksForTrips(trips, timePoints);
    const blocks = assigned.map(t => t.blockNumber);
    expect(blocks).toEqual([1, 2, 3, 1]);
  });

  it('detects when block recomputation is needed', () => {
    const trips = [
      { ...makeTrip(1, '07:00', '07:15', '07:30'), blockNumber: 1 },
      { ...makeTrip(2, '07:15', '07:30', '07:45'), blockNumber: 2 },
      { ...makeTrip(3, '07:30', '07:45', '08:00'), blockNumber: 3 }
    ];

    expect(needsBlockRecompute(trips)).toBe(true);
  });

  it('reconstructs blocks from schedule matrix', () => {
    const matrix = [
      ['07:00', '07:15', '07:30'],
      ['07:15', '07:30', '07:45'],
      ['07:30', '07:45', '08:00'],
      ['07:45', '08:00', '08:15']
    ];

    const blocks = computeBlocksFromMatrix(matrix, timePoints);
    expect(blocks).toEqual([1, 2, 1, 2]);
  });

  it('normalizes existing trip details with suspicious block numbers', () => {
    const summary: SummarySchedule = {
      routeId: 'route-1',
      routeName: 'Route 1',
      direction: 'Outbound',
      timePoints,
      weekday: [
        ['07:00', '07:15', '07:30'],
        ['07:15', '07:30', '07:45'],
        ['07:30', '07:45', '08:00']
      ],
      saturday: [],
      sunday: [],
      effectiveDate: new Date('2024-01-01T00:00:00Z'),
      metadata: {
        weekdayTrips: 3,
        saturdayTrips: 0,
        sundayTrips: 0
      },
      tripDetails: {
        weekday: [
          { ...makeTrip(1, '07:00', '07:15', '07:30'), blockNumber: 1 },
          { ...makeTrip(2, '07:15', '07:30', '07:45'), blockNumber: 2 },
          { ...makeTrip(3, '07:30', '07:45', '08:00'), blockNumber: 3 }
        ]
      }
    };

    const { summary: normalized, tripsByDay } = normalizeSummaryScheduleTrips(summary);
    expect(normalized.tripDetails?.weekday?.map(trip => trip.blockNumber)).toEqual([1, 2, 1]);
    expect(tripsByDay.weekday.map(trip => trip.blockNumber)).toEqual([1, 2, 1]);
  });

  it('builds trip details from summary when missing', () => {
    const summary: SummarySchedule = {
      routeId: 'route-legacy',
      routeName: 'Legacy Route',
      direction: 'Inbound',
      timePoints,
      weekday: [
        ['06:00', '06:10', '06:20'],
        ['06:30', '06:40', '06:50']
      ],
      saturday: [],
      sunday: [],
      effectiveDate: new Date('2024-01-01T00:00:00Z'),
      metadata: {
        weekdayTrips: 2,
        saturdayTrips: 0,
        sundayTrips: 0
      }
    };

    const { summary: normalized, tripsByDay } = normalizeSummaryScheduleTrips(summary);
    expect(normalized.tripDetails?.weekday?.length).toBe(2);
    expect(tripsByDay.weekday.length).toBe(2);
    expect(tripsByDay.weekday.every(trip => trip.serviceBand === 'Legacy Import')).toBe(true);
  });
});

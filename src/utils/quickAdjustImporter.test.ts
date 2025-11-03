import fs from 'fs';
import path from 'path';
import parseQuickAdjustSchedule, { parseQuickAdjustCsv } from './quickAdjustImporter';

const loadSampleCsv = (): string[][] => {
  const samplePath = path.resolve(__dirname, '../../Route 100 CSV.csv');
  const content = fs.readFileSync(samplePath, 'utf8');
  return parseQuickAdjustCsv(content).filter(row => row.some(cell => cell.trim().length > 0));
};

describe('quickAdjustImporter', () => {
  const rows = loadSampleCsv();

  it('parses the sample schedule into structured quick-adjust data', () => {
    const result = parseQuickAdjustSchedule(rows, { routeId: 'route-100' });

    expect(result.routeName).toBe('100 - Red');
    expect(result.timePoints.map(tp => tp.id)).toEqual(['1', '57', '441', '330', '559', '399', '1__terminal']);
    expect(result.timePoints.map(tp => tp.name)).toEqual([
      'Downtown',
      'Bayfield at Highway 400',
      'Georgian Mall',
      'Georgian College',
      'RVH',
      'Johnson at Blake',
      'Downtown'
    ]);
    expect(result.timePoints[result.timePoints.length - 1].aliasFor).toBe('1');

    expect(result.trips.weekday.length).toBeGreaterThan(0);
    expect(result.trips.saturday.length).toBeGreaterThan(0);
    expect(result.trips.sunday.length).toBeGreaterThan(0);

    const firstWeekdayTrip = result.trips.weekday[0];
    expect(firstWeekdayTrip.departureTimes['1']).toBe('07:06');
    expect(firstWeekdayTrip.departureTimes['1__terminal']).toBe('07:54');
    expect(firstWeekdayTrip.arrivalTimes['57']).toBe('07:12');
    expect(firstWeekdayTrip.arrivalTimes['441']).toBe('07:18');
    expect(firstWeekdayTrip.recoveryTimes['441']).toBe(1);
    expect(firstWeekdayTrip.arrivalTimes['1']).toBe('07:48');

    expect(firstWeekdayTrip.blockNumber).toBe(1);
    expect(result.trips.weekday[1].blockNumber).toBe(2);
    expect(result.trips.weekday[2].blockNumber).toBe(1);
    expect(result.trips.weekday[3].blockNumber).toBe(2);
    expect(result.trips.weekday.every(trip => Number.isInteger(trip.blockNumber) && trip.blockNumber >= 1)).toBe(true);
    expect(new Set(result.trips.weekday.map(trip => trip.blockNumber)).size).toBeGreaterThanOrEqual(2);

    const firstSaturdayTrip = result.trips.saturday[0];
    expect(firstSaturdayTrip.departureTimes['1']).toBe('07:40');
    expect(firstSaturdayTrip.arrivalTimes['57']).toBe('07:46');
    expect(firstSaturdayTrip.blockNumber).toBe(1);
    expect(result.trips.saturday[1].blockNumber).toBeGreaterThanOrEqual(1);

    expect(result.summarySchedule.weekday.length).toBe(result.trips.weekday.length);
    expect(result.summarySchedule.tripDetails?.weekday?.[0]?.blockNumber).toBe(1);
    expect(result.summarySchedule.tripDetails?.weekday?.[1]?.blockNumber).toBe(2);
    expect(result.summarySchedule.tripDetails?.weekday?.[2]?.blockNumber).toBe(1);
    expect(result.summarySchedule.tripDetails?.weekday?.[3]?.blockNumber).toBe(2);
    expect(result.summarySchedule.weekday[0][0]).toBe('07:06');
    expect(result.summarySchedule.weekday[0][2]).toBe('07:18'); // Georgian Mall arrival
    expect(result.summarySchedule.weekday[0][6]).toBe('07:54'); // Downtown terminal departure
    expect(result.summarySchedule.saturday[0][0]).toBe('07:40');

    expect(result.summarySchedule.metadata.weekdayTrips).toBe(result.trips.weekday.length);
    expect(result.summarySchedule.metadata.saturdayTrips).toBe(result.trips.saturday.length);
    expect(result.summarySchedule.metadata.sundayTrips).toBe(result.trips.sunday.length);
    expect(result.summarySchedule.metadata.operatingHours).toBeDefined();
  });

  it('anchors each trip departure time to the first stop departure', () => {
    const result = parseQuickAdjustSchedule(rows, { routeId: 'route-100' });
    const firstStopId = result.timePoints[0]?.id;
    expect(firstStopId).toBeDefined();

    const publishedDepartures = result.trips.weekday.map(trip => trip.departureTime);
    const originDepartures = result.trips.weekday.map(trip =>
      (firstStopId && (trip.departureTimes[firstStopId] || trip.arrivalTimes[firstStopId])) || ''
    );

    expect(publishedDepartures).toEqual(originDepartures);

    const sorted = [...publishedDepartures].sort((a, b) => a.localeCompare(b));
    expect(publishedDepartures).toEqual(sorted);
  });
});

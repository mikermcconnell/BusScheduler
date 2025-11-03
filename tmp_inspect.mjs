import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('ts-node/esm', pathToFileURL('./'));

const { default: parseQuickAdjustSchedule, parseQuickAdjustCsv } = await import('./src/utils/quickAdjustImporter.ts');

import fs from 'node:fs';
import path from 'node:path';

const content = fs.readFileSync(path.resolve('./Route 100 CSV.csv'), 'utf8');
const rows = parseQuickAdjustCsv(content).filter(row => row.some(cell => cell.trim().length > 0));
const result = parseQuickAdjustSchedule(rows, { routeId: 'route-100' });

const trips = result.trips.weekday;

const slice = trips.slice(30, 40).map(trip => ({
  trip: trip.tripNumber,
  block: trip.blockNumber,
  dep: trip.departureTime,
  firstStop: result.timePoints[0]?.id ? trip.departureTimes[result.timePoints[0].id] : undefined,
  lastStop: result.timePoints.at(-1)?.id ? trip.departureTimes[result.timePoints.at(-1).id] : undefined
}));

console.log(slice);

const sortedByString = [...trips].sort((a, b) => a.departureTime.localeCompare(b.departureTime));
const sortedByMinutes = [...trips].sort((a, b) => {
  const [aH, aM] = a.departureTime.split(':').map(Number);
  const [bH, bM] = b.departureTime.split(':').map(Number);
  return aH * 60 + aM - (bH * 60 + bM);
});

console.log('String order trip numbers 30-40', sortedByString.slice(30, 40).map(t => t.tripNumber));
console.log('Minute order trip numbers 30-40', sortedByMinutes.slice(30, 40).map(t => t.tripNumber));

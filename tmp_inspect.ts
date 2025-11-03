import fs from 'fs';
import path from 'path';
import parseQuickAdjustSchedule, { parseQuickAdjustCsv } from './src/utils/quickAdjustImporter';

const content = fs.readFileSync(path.resolve(__dirname, 'Route 100 CSV.csv'), 'utf8');
const rows = parseQuickAdjustCsv(content).filter(row => row.some(cell => cell.trim().length > 0));
const result = parseQuickAdjustSchedule(rows, { routeId: 'route-100' });

console.log('Time points order:');
console.log(result.timePoints.map(tp => ({ id: tp.id, name: tp.name, sequence: tp.sequence })))

const trips = result.trips.weekday;
const items = trips.map(trip => ({
  tripNumber: trip.tripNumber,
  block: trip.blockNumber,
  departureTime: trip.departureTime,
  firstStopId: result.timePoints[0]?.id,
  firstStopTime: result.timePoints[0]?.id ? trip.departureTimes[result.timePoints[0].id] : undefined,
  secondStopId: result.timePoints[1]?.id,
  secondStopTime: result.timePoints[1]?.id ? trip.departureTimes[result.timePoints[1].id] : undefined,
  finalStopId: result.timePoints.at(-1)?.id,
  finalStopTime: result.timePoints.at(-1)?.id ? trip.departureTimes[result.timePoints.at(-1).id] : undefined
}));

console.table(items.slice(32, 37));

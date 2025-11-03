import fs from 'fs';
import path from 'path';
import { parseQuickAdjustCsv } from '../utils/quickAdjustImporter';
import rebuildQuickAdjustSchedule from './quickAdjustRebuild';

const loadRows = (): string[][] => {
  const samplePath = path.resolve(__dirname, '../../Route 100 CSV.csv');
  const content = fs.readFileSync(samplePath, 'utf8');
  return parseQuickAdjustCsv(content).filter(row => row.some(cell => cell.trim().length > 0));
};

describe('rebuildQuickAdjustSchedule', () => {
  it('rebuilds quick adjust schedule from stored rows', () => {
    const rows = loadRows();
    const result = rebuildQuickAdjustSchedule(rows, { routeId: 'route-100' });

    expect(result.weekdayTrips.length).toBeGreaterThan(0);
    expect(result.summary.timePoints[0]?.name).toBe('Downtown');
    expect(result.summary.metadata.weekdayTrips).toBe(result.weekdayTrips.length);
  });

  it('throws when rows are missing', () => {
    expect(() => rebuildQuickAdjustSchedule([], { routeId: 'route-100' })).toThrow(
      'No quick adjust rows available for rebuild.'
    );
  });
});

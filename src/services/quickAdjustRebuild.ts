import parseQuickAdjustSchedule from '../utils/quickAdjustImporter';
import { normalizeSummaryScheduleTrips } from '../utils/blockAssignment';
import { SummarySchedule, Trip } from '../types/schedule';

export interface QuickAdjustRebuildResult {
  summary: SummarySchedule;
  weekdayTrips: Trip[];
  tripsByDay: {
    weekday: Trip[];
    saturday: Trip[];
    sunday: Trip[];
  };
}

/**
 * Re-runs the quick adjust importer against the original CSV rows and normalizes
 * the resulting summary schedule so downstream consumers receive consistent data.
 */
export const rebuildQuickAdjustSchedule = (
  rows: string[][],
  options: { routeId?: string } = {}
): QuickAdjustRebuildResult => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No quick adjust rows available for rebuild.');
  }

  const parseResult = parseQuickAdjustSchedule(rows, options);
  const normalized = normalizeSummaryScheduleTrips(parseResult.summarySchedule);

  return {
    summary: normalized.summary,
    weekdayTrips: normalized.tripsByDay.weekday,
    tripsByDay: normalized.tripsByDay
  };
};

export default rebuildQuickAdjustSchedule;

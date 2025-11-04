import React, { useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  Stack
} from '@mui/material';
import { Download, TableChart, Description } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import * as XLSX from 'xlsx';
import { AppDispatch, RootState } from '../store/store';
import { DayType, Shift, TodShiftColorScale } from './types/shift.types';
import { DAY_TYPES, INTERVAL_MINUTES } from './utils/timeUtils';
import { recordShiftExport } from './store/shiftManagementSlice';
import { excelColorForValue } from './utils/colorScale';

const HEADER_ROW = [
  'Time',
  'North Required',
  'North Operational',
  'South Required',
  'South Operational',
  'Floater Required',
  'Floater Operational',
  'Floater Available',
  'North Excess/Deficit',
  'South Excess/Deficit',
  'Floater Excess/Deficit',
  'Total Excess/Deficit'
];

const ShiftExport: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    shifts,
    activeScheduleType,
    coverageTimeline,
    colorScale,
    importMetadata
  } = useSelector((state: RootState) => state.shiftManagement);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackSeverity, setFeedbackSeverity] = useState<'success' | 'error' | 'info'>('info');

  const filteredShifts = useMemo(
    () => shifts.filter((shift: Shift) => shift.scheduleType === activeScheduleType),
    [shifts, activeScheduleType]
  );

  const hasCoverage = useMemo(
    () => DAY_TYPES.some(day => (coverageTimeline[day] ?? []).length > 0),
    [coverageTimeline]
  );

  const hasShifts = filteredShifts.length > 0;

  const handleExportCSV = () => {
    if (!hasShifts) {
      setFeedbackSeverity('info');
      setFeedback('No shifts available to export yet.');
      return;
    }

    const headers = ['Shift Code', 'Zone', 'Start Time', 'End Time', 'Total Hours', 'Compliant'];
    const csvContent = [
      headers.join(','),
      ...filteredShifts.map((shift: Shift) => [
        shift.shiftCode,
        shift.zone,
        shift.startTime,
        shift.endTime,
        shift.totalHours,
        shift.unionCompliant
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shifts_${activeScheduleType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setFeedbackSeverity('success');
    setFeedback('CSV export generated successfully.');
  };

  const handleExportExcel = async () => {
    if (!hasCoverage) {
      setFeedbackSeverity('info');
      setFeedback('Coverage data not available. Import datasets first.');
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      DAY_TYPES.forEach((dayType) => {
        const intervals = coverageTimeline[dayType] ?? [];
        if (intervals.length === 0) {
          return;
        }

        const sheetData: (string | number)[][] = [HEADER_ROW];
        let totalRequiredHours = 0;
        let totalSuppliedHours = 0;
        let deficitCount = 0;
        let excessCount = 0;

        const intervalHours = INTERVAL_MINUTES / 60;
        intervals.forEach((interval) => {
          const intervalRequired =
            (interval.northRequired + interval.southRequired + interval.floaterRequired) * intervalHours;
          const intervalSupplied =
            (interval.northOperational + interval.southOperational + interval.floaterOperational) * intervalHours;
          const floaterAvailable = Math.max(
            0,
            interval.floaterOperational - interval.floaterAllocatedNorth - interval.floaterAllocatedSouth
          );

          totalRequiredHours += intervalRequired;
          totalSuppliedHours += intervalSupplied;

          if (interval.totalExcess < 0) deficitCount += 1;
          else if (interval.totalExcess > 0) excessCount += 1;

          sheetData.push([
            `${interval.startTime} – ${interval.endTime}`,
            interval.northRequired,
            interval.northOperational + interval.floaterAllocatedNorth,
            interval.southRequired,
            interval.southOperational + interval.floaterAllocatedSouth,
            interval.floaterRequired,
            interval.floaterOperational,
            floaterAvailable,
            interval.northExcess,
            interval.southExcess,
            interval.floaterExcess,
            interval.totalExcess
          ]);
        });

        sheetData.push([]);
        sheetData.push(['Total Vehicle Hours Required', totalRequiredHours]);
        sheetData.push(['Total Vehicle Hours Supplied', totalSuppliedHours]);
        sheetData.push(['Intervals with Deficit', deficitCount]);
        sheetData.push(['Intervals with Excess', excessCount]);

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        applySheetStyling(worksheet, sheetData.length, intervals.length, colorScale);

        XLSX.utils.book_append_sheet(workbook, worksheet, formatSheetName(dayType));
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `tod_shift_summary_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, fileName, { compression: true, cellStyles: true });

      if (importMetadata.runId) {
        const exportedAt = new Date().toISOString();
        dispatch(recordShiftExport({ runId: importMetadata.runId, exportedAt }));
      }

      setFeedbackSeverity('success');
      setFeedback(`Excel export generated: ${fileName}`);
    } catch (error) {
      console.error('Excel export failed', error);
      setFeedbackSeverity('error');
      setFeedback('Excel export failed. Please retry.');
    }
  };

  const handleExportReport = () => {
    setFeedbackSeverity('info');
    setFeedback('Report export will be introduced in a future iteration.');
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Shifts
      </Typography>

      {!hasCoverage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Import City and contractor CSVs to enable coverage analytics and Excel exports.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleExportCSV}
          disabled={!hasShifts}
        >
          Export CSV
        </Button>

        <Button
          variant="outlined"
          startIcon={<TableChart />}
          onClick={handleExportExcel}
          disabled={!hasCoverage}
        >
          Export Excel Summary
        </Button>

        <Button
          variant="outlined"
          startIcon={<Description />}
          onClick={handleExportReport}
        >
          Export Report
        </Button>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {filteredShifts.length} shifts in current view ({activeScheduleType}).
        </Typography>
        {importMetadata.lastExportedAt && (
          <Typography variant="caption" color="text.secondary" display="block">
            Last Excel export: {new Date(importMetadata.lastExportedAt).toLocaleString()}
          </Typography>
        )}
      </Box>

      {feedback && (
        <Alert severity={feedbackSeverity} sx={{ mt: 2 }} onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}
    </Paper>
  );
};

function applySheetStyling(
  worksheet: XLSX.WorkSheet,
  totalRows: number,
  dataRowCount: number,
  colorScale: TodShiftColorScale | null
) {
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 }
  ];

  HEADER_ROW.forEach((_, index) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
    const cell = worksheet[cellAddress];
    if (cell) {
      cell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: 'FF263238' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
  });

  for (let row = 1; row <= dataRowCount; row++) {
    const northCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 8 })];
    const southCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 9 })];
    const floaterCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 10 })];
    const totalCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 11 })];

    if (northCell) northCell.s = buildCellStyle(northCell.v as number, colorScale);
    if (southCell) southCell.s = buildCellStyle(southCell.v as number, colorScale);
    if (floaterCell) floaterCell.s = buildCellStyle(floaterCell.v as number, colorScale);
    if (totalCell) totalCell.s = buildCellStyle(totalCell.v as number, colorScale);
  }

  for (let summaryRow = totalRows - 4; summaryRow < totalRows; summaryRow++) {
    const labelCell = worksheet[XLSX.utils.encode_cell({ r: summaryRow, c: 0 })];
    if (labelCell) {
      labelCell.s = {
        font: { bold: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFE0E0E0' } }
      };
    }
  }
}

function buildCellStyle(value: number, colorScale: TodShiftColorScale | null) {
  const background = excelColorForValue(value, colorScale);
  return {
    fill: { patternType: 'solid', fgColor: { rgb: background } },
    font: { color: { rgb: 'FF0D0D0D' } }
  };
}

function formatSheetName(dayType: DayType): string {
  switch (dayType) {
    case 'weekday':
      return 'Weekday';
    case 'saturday':
      return 'Saturday';
    case 'sunday':
      return 'Sunday';
    default:
      return dayType;
  }
}

export default ShiftExport;

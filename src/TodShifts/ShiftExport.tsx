import React, { useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  Stack
} from '@mui/material';
import { Download } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { DayType, Shift } from './types/shift.types';

const RIDE_CODE_TEMPLATE_HEADERS = [
  'driver_id',
  'vehicle_id',
  'day_type',
  'zone',
  'shift_start',
  'shift_end',
  'break_start',
  'break_end',
  'vehicle_count'
];

const ShiftExport: React.FC = () => {
  const { shifts } = useSelector((state: RootState) => state.shiftManagement);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackSeverity, setFeedbackSeverity] = useState<'success' | 'error' | 'info'>('info');

  const sortedShifts = useMemo(() => {
    const order: Record<DayType, number> = {
      weekday: 0,
      saturday: 1,
      sunday: 2
    };
    return [...shifts].sort((a, b) => {
      const dayDiff = order[a.scheduleType] - order[b.scheduleType];
      if (dayDiff !== 0) {
        return dayDiff;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [shifts]);

  const hasShifts = sortedShifts.length > 0;
  const formatCsvValue = (value: string | number | undefined | null) => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = typeof value === 'string' ? value : String(value);
    return /[",\n]/.test(stringValue)
      ? `"${stringValue.replace(/"/g, '""')}"`
      : stringValue;
  };

  const handleExportRidecodeTemplate = () => {
    if (!hasShifts) {
      setFeedbackSeverity('info');
      setFeedback('No shifts available to export yet.');
      return;
    }

    // Align to contractor import schema (mvt_document_tod_shift) so Ridecode engineers can re-import without reformatting.
    const rows = sortedShifts.map((shift, index) => {
      const values: Array<string | number | undefined> = [
        shift.driverId ?? shift.shiftCode ?? `Shift-${index + 1}`,
        shift.vehicleId ?? '',
        shift.scheduleType,
        shift.zone,
        shift.startTime,
        shift.endTime,
        shift.breakStart ?? '',
        shift.breakEnd ?? '',
        typeof shift.vehicleCount === 'number' && shift.vehicleCount > 0 ? shift.vehicleCount : 1
      ];
      return values.map(formatCsvValue).join(',');
    });

    const csvContent = [RIDE_CODE_TEMPLATE_HEADERS.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ridecode_template_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setFeedbackSeverity('success');
    setFeedback('Ridecode template CSV generated successfully.');
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Shifts
      </Typography>

      {!hasShifts && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Build or import shifts to enable RideCo exports.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleExportRidecodeTemplate}
          disabled={!hasShifts}
        >
          RideCo
        </Button>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {sortedShifts.length} shifts available across all days.
        </Typography>
      </Box>

      {feedback && (
        <Alert severity={feedbackSeverity} sx={{ mt: 2 }} onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}
    </Paper>
  );
};
export default ShiftExport;

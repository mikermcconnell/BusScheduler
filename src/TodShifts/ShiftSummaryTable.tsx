import React from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  Box
} from '@mui/material';
import { Edit, Delete, Warning } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Shift } from './types/shift.types';

interface ShiftSummaryTableProps {
  title?: string;
  showActions?: boolean;
}

const ShiftSummaryTable: React.FC<ShiftSummaryTableProps> = ({ title, showActions = true }) => {
  const { shifts } = useSelector((state: RootState) => state.shiftManagement);
  const order: Record<Shift['scheduleType'], number> = {
    weekday: 0,
    saturday: 1,
    sunday: 2
  };
  const sortedShifts = [...shifts].sort((a, b) => {
    const dayDelta = order[a.scheduleType] - order[b.scheduleType];
    if (dayDelta !== 0) {
      return dayDelta;
    }
    return a.startTime.localeCompare(b.startTime);
  });
  const tableTitle = title ?? 'Shift Summary';

  if (sortedShifts.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {tableTitle}
        </Typography>
        <Alert severity="info">
          No shifts created yet.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {tableTitle}
      </Typography>
      
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Shift Code</TableCell>
              <TableCell>Shift Type</TableCell>
              <TableCell>Zone</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Total Hours</TableCell>
              <TableCell>Break Start</TableCell>
              <TableCell>Break End</TableCell>
              <TableCell>Break Duration</TableCell>
              <TableCell>Compliance</TableCell>
              {showActions && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedShifts.map((shift: Shift) => (
              <TableRow key={shift.id ?? shift.shiftCode}>
                <TableCell>{shift.shiftCode}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{shift.scheduleType}</TableCell>
                <TableCell>{shift.zone}</TableCell>
                <TableCell>{shift.startTime}</TableCell>
                <TableCell>{shift.endTime}</TableCell>
                <TableCell>
                  {typeof shift.totalHours === 'number' ? `${shift.totalHours.toFixed(1)}h` : '—'}
                </TableCell>
                <TableCell>{shift.breakStart ?? '—'}</TableCell>
                <TableCell>{shift.breakEnd ?? '—'}</TableCell>
                <TableCell>
                  {typeof shift.breakDuration === 'number' && shift.breakDuration > 0
                    ? `${Math.round(shift.breakDuration)} min`
                    : '—'}
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label={shift.unionCompliant ? 'Compliant' : 'Issues'}
                      size="small"
                      color={shift.unionCompliant ? 'success' : 'error'}
                    />
                    {shift.complianceWarnings && shift.complianceWarnings.length > 0 && (
                      <Warning color="warning" fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                {showActions && (
                  <TableCell>
                    <IconButton size="small" color="primary">
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ShiftSummaryTable;

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

const ShiftSummaryTable: React.FC = () => {
  const { shifts, activeScheduleType } = useSelector((state: RootState) => state.shiftManagement);
  
  const filteredShifts = shifts.filter((shift: Shift) => shift.scheduleType === activeScheduleType);

  if (filteredShifts.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Shift Summary
        </Typography>
        <Alert severity="info">
          No shifts created for {activeScheduleType} schedule yet.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Shift Summary ({activeScheduleType})
      </Typography>
      
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Shift Code</TableCell>
              <TableCell>Zone</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Total Hours</TableCell>
              <TableCell>Compliance</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredShifts.map((shift: Shift) => (
              <TableRow key={shift.id}>
                <TableCell>{shift.shiftCode}</TableCell>
                <TableCell>{shift.zone}</TableCell>
                <TableCell>{shift.startTime}</TableCell>
                <TableCell>{shift.endTime}</TableCell>
                <TableCell>{shift.totalHours.toFixed(1)}h</TableCell>
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
                <TableCell>
                  <IconButton size="small" color="primary">
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error">
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ShiftSummaryTable;
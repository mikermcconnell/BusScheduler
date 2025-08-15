import React from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Alert
} from '@mui/material';
import { Download, TableChart, Description } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Shift } from './types/shift.types';

const ShiftExport: React.FC = () => {
  const { shifts, activeScheduleType } = useSelector((state: RootState) => state.shiftManagement);
  
  const filteredShifts = shifts.filter((shift: Shift) => shift.scheduleType === activeScheduleType);
  const hasShifts = filteredShifts.length > 0;

  const handleExportCSV = () => {
    if (!hasShifts) return;
    
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
  };

  const handleExportExcel = () => {
    // Excel export would be implemented here
    alert('Excel export feature coming soon!');
  };

  const handleExportReport = () => {
    // Report export would be implemented here  
    alert('Report export feature coming soon!');
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Shifts
      </Typography>
      
      {!hasShifts && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No shifts available to export for {activeScheduleType} schedule.
        </Alert>
      )}

      <Box display="flex" gap={2} flexWrap="wrap">
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
          disabled={!hasShifts}
        >
          Export Excel
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<Description />}
          onClick={handleExportReport}
          disabled={!hasShifts}
        >
          Export Report
        </Button>
      </Box>

      {hasShifts && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {filteredShifts.length} shifts available for export
        </Typography>
      )}
    </Paper>
  );
};

export default ShiftExport;
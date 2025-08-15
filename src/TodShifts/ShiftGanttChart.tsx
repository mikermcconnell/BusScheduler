import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Shift } from './types/shift.types';

const ShiftGanttChart: React.FC = () => {
  const { shifts, activeScheduleType } = useSelector((state: RootState) => state.shiftManagement);
  
  const filteredShifts = shifts.filter((shift: Shift) => shift.scheduleType === activeScheduleType);

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Shift Timeline Visualization
      </Typography>
      
      {filteredShifts.length === 0 ? (
        <Alert severity="info">
          No shifts available for {activeScheduleType} schedule. Create shifts to see the timeline visualization.
        </Alert>
      ) : (
        <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Gantt chart visualization will be implemented here.
            {filteredShifts.length} shifts available for display.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ShiftGanttChart;
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Checkbox,
  Chip,
  Stack
} from '@mui/material';
import { TimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { saveShift } from './store/shiftManagementSlice';
import { validateShiftAgainstRules } from './utils/unionRulesValidator';
import { Shift, UnionViolation } from './types/shift.types';

interface Props {
  onShiftCreated: () => void;
}

const ManualShiftCreator: React.FC<Props> = ({ onShiftCreated }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { unionRules } = useSelector((state: RootState) => state.shiftManagement);
  
  const [shift, setShift] = useState<Partial<Shift>>({
    shiftCode: '',
    scheduleType: 'weekday',
    zone: 'South',
    startTime: '06:00',
    endTime: '14:00',
    breakDuration: 15,
    isSplitShift: false,
  });
  
  const [violations, setViolations] = useState<UnionViolation[]>([]);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    // Validate on any change
    if (shift.startTime && shift.endTime) {
      validateShift();
    }
  }, [shift, unionRules]);

  const validateShift = async () => {
    setValidating(true);
    const validationResults = await validateShiftAgainstRules(shift as Shift, unionRules);
    setViolations(validationResults);
    setValidating(false);
  };

  const calculateTotalHours = (): number => {
    if (!shift.startTime || !shift.endTime) return 0;
    
    const start = dayjs(`2024-01-01 ${shift.startTime}`);
    const end = dayjs(`2024-01-01 ${shift.endTime}`);
    let hours = end.diff(start, 'hour', true);
    
    // Subtract break time
    if (shift.breakDuration) {
      hours -= shift.breakDuration / 60;
    }
    if (shift.mealBreakStart && shift.mealBreakEnd) {
      const mealStart = dayjs(`2024-01-01 ${shift.mealBreakStart}`);
      const mealEnd = dayjs(`2024-01-01 ${shift.mealBreakEnd}`);
      hours -= mealEnd.diff(mealStart, 'hour', true);
    }
    
    return Math.round(hours * 100) / 100;
  };

  const handleTimeChange = (field: string, value: Dayjs | null) => {
    if (value) {
      setShift((prev: Partial<Shift>) => ({
        ...prev,
        [field]: value.format('HH:mm'),
      }));
    }
  };

  const handleSubmit = async () => {
    if (!shift.shiftCode || !shift.startTime || !shift.endTime) {
      return;
    }

    const hasErrors = violations.some(v => v.violationType === 'error');
    if (hasErrors && !window.confirm('This shift has union compliance errors. Create anyway?')) {
      return;
    }

    const completeShift: Shift = {
      ...shift as Shift,
      totalHours: calculateTotalHours(),
      unionCompliant: !hasErrors,
      complianceWarnings: violations.map(v => v.violationMessage),
    };

    await dispatch(saveShift(completeShift));
    onShiftCreated();
    
    // Reset form
    setShift({
      shiftCode: '',
      scheduleType: 'weekday',
      zone: 'South',
      startTime: '06:00',
      endTime: '14:00',
      breakDuration: 15,
      isSplitShift: false,
    });
  };

  const hasErrors = violations.some(v => v.violationType === 'error');
  const hasWarnings = violations.some(v => v.violationType === 'warning');

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Create New Shift
        </Typography>
        
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <FormControl fullWidth>
              <InputLabel>Shift Type</InputLabel>
              <Select
                value={shift.scheduleType ?? 'weekday'}
                label="Shift Type"
                onChange={(e) =>
                  setShift((prev: Partial<Shift>) => ({ ...prev, scheduleType: e.target.value as Shift['scheduleType'] }))
                }
              >
                <MenuItem value="weekday">Weekday</MenuItem>
                <MenuItem value="saturday">Saturday</MenuItem>
                <MenuItem value="sunday">Sunday</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <TextField
              fullWidth
              label="Shift Code"
              value={shift.shiftCode}
              onChange={(e) => setShift((prev: Partial<Shift>) => ({ ...prev, shiftCode: e.target.value }))}
              placeholder="Bus 01"
              error={!shift.shiftCode}
              helperText={!shift.shiftCode ? 'Required' : ''}
            />
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <FormControl fullWidth>
              <InputLabel>Zone</InputLabel>
              <Select
                value={shift.zone}
                onChange={(e) => setShift((prev: Partial<Shift>) => ({ ...prev, zone: e.target.value as 'North' | 'South' | 'Floater' }))}
                label="Zone"
              >
                <MenuItem value="North">North</MenuItem>
                <MenuItem value="South">South</MenuItem>
                <MenuItem value="Floater">Floater</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <TimePicker
              label="Start Time"
              value={dayjs(`2024-01-01 ${shift.startTime}`)}
              onChange={(value: Dayjs | null) => handleTimeChange('startTime', value)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <TimePicker
              label="End Time"
              value={dayjs(`2024-01-01 ${shift.endTime}`)}
              onChange={(value: Dayjs | null) => handleTimeChange('endTime', value)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          {/* Break Configuration */}
          <Grid size={12}>
            <Typography variant="subtitle1" gutterBottom>
              Break Configuration
            </Typography>
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <TextField
              fullWidth
              type="number"
              label="Break Duration (minutes)"
              value={shift.breakDuration}
              onChange={(e) => setShift((prev: Partial<Shift>) => ({ ...prev, breakDuration: parseInt(e.target.value) }))}
              InputProps={{ inputProps: { min: 0, max: 60 } }}
            />
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <TimePicker
              label="Break Start"
              value={shift.breakStart ? dayjs(`2024-01-01 ${shift.breakStart}`) : null}
              onChange={(value: Dayjs | null) => handleTimeChange('breakStart', value)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <TimePicker
              label="Break End"
              value={shift.breakEnd ? dayjs(`2024-01-01 ${shift.breakEnd}`) : null}
              onChange={(value: Dayjs | null) => handleTimeChange('breakEnd', value)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={shift.isSplitShift}
                  onChange={(e) => setShift((prev: Partial<Shift>) => ({ ...prev, isSplitShift: e.target.checked }))}
                />
              }
              label="Split Shift"
            />
          </Grid>

          {/* Meal Break (for shifts over 6 hours) */}
          {calculateTotalHours() > 6 && (
            <>
              <Grid size={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Meal Break (Required for shifts over 6 hours)
                </Typography>
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  md: 4
                }}>
                <TimePicker
                  label="Meal Break Start"
                  value={shift.mealBreakStart ? dayjs(`2024-01-01 ${shift.mealBreakStart}`) : null}
                  onChange={(value: Dayjs | null) => handleTimeChange('mealBreakStart', value)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              
              <Grid
                size={{
                  xs: 12,
                  md: 4
                }}>
                <TimePicker
                  label="Meal Break End"
                  value={shift.mealBreakEnd ? dayjs(`2024-01-01 ${shift.mealBreakEnd}`) : null}
                  onChange={(value: Dayjs | null) => handleTimeChange('mealBreakEnd', value)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </>
          )}

          {/* Validation Results */}
          <Grid size={12}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Union Compliance Check
              </Typography>
              
              {violations.length === 0 && (
                <Alert severity="success">
                  All union rules satisfied
                </Alert>
              )}
              
              {hasErrors && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Required Rule Violations:
                  </Typography>
                  <Stack spacing={1}>
                    {violations
                      .filter(v => v.violationType === 'error')
                      .map((v, idx) => (
                        <Typography key={idx} variant="body2">
                          • {v.violationMessage}
                        </Typography>
                      ))}
                  </Stack>
                </Alert>
              )}
              
              {hasWarnings && (
                <Alert severity="warning">
                  <Typography variant="subtitle2" gutterBottom>
                    Preferred Rule Warnings:
                  </Typography>
                  <Stack spacing={1}>
                    {violations
                      .filter(v => v.violationType === 'warning')
                      .map((v, idx) => (
                        <Typography key={idx} variant="body2">
                          • {v.violationMessage}
                        </Typography>
                      ))}
                  </Stack>
                </Alert>
              )}
            </Box>
          </Grid>

          {/* Summary and Actions */}
          <Grid size={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Box>
                <Typography variant="h6">
                  Total Hours: {calculateTotalHours()}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip 
                    label={(shift.scheduleType ?? 'weekday').toUpperCase()} 
                    color="primary" 
                    size="small" 
                  />
                  <Chip 
                    label={shift.zone} 
                    color="secondary" 
                    size="small" 
                  />
                  {shift.isSplitShift && (
                    <Chip 
                      label="Split Shift" 
                      color="warning" 
                      size="small" 
                    />
                  )}
                </Stack>
              </Box>
              
              <Button
                variant="contained"
                color={hasErrors ? 'warning' : 'primary'}
                onClick={handleSubmit}
                disabled={!shift.shiftCode || validating}
                size="large"
              >
                {hasErrors ? 'Create with Warnings' : 'Create Shift'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </LocalizationProvider>
  );
};

export default ManualShiftCreator;

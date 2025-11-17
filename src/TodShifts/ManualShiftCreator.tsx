import React, { useEffect, useMemo, useState } from 'react';
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
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RootState, AppDispatch } from '../store/store';
import { saveShift } from './store/shiftManagementSlice';
import { validateShiftAgainstRules } from './utils/unionRulesValidator';
import { Shift, UnionViolation } from './types/shift.types';
import { snapDayjsToInterval } from './utils/shiftNormalization';
import { manualShiftFormSchema, ManualShiftFormValues } from './utils/shiftFormSchemas';
import { parseTimeToMinutes } from './utils/timeUtils';

interface Props {
  onShiftCreated: () => void;
}

const MINUTES_PER_DAY = 24 * 60;

const ManualShiftCreator: React.FC<Props> = ({ onShiftCreated }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { unionRules } = useSelector((state: RootState) => state.shiftManagement);

  const defaultValues: ManualShiftFormValues = useMemo(
    () => ({
      shiftCode: '',
      scheduleType: 'weekday',
      zone: 'South',
      startTime: '06:00',
      endTime: '14:00',
      breakDuration: 15,
      breakStart: null,
      breakEnd: null,
      mealBreakStart: null,
      mealBreakEnd: null,
      isSplitShift: false
    }),
    []
  );

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ManualShiftFormValues>({
    resolver: zodResolver(manualShiftFormSchema),
    defaultValues
  });

  const formValues = watch();
  const [violations, setViolations] = useState<UnionViolation[]>([]);
  const [validating, setValidating] = useState(false);

  const computeTotalHours = (values: ManualShiftFormValues): number => {
    if (!values.startTime || !values.endTime) {
      return 0;
    }

    const startMinutes = parseTimeToMinutes(values.startTime);
    let endMinutes = parseTimeToMinutes(values.endTime);
    if (endMinutes <= startMinutes) {
      endMinutes += MINUTES_PER_DAY;
    }

    let duration = endMinutes - startMinutes;

    if (typeof values.breakDuration === 'number') {
      duration -= values.breakDuration;
    }

    if (values.mealBreakStart && values.mealBreakEnd) {
      let mealStart = parseTimeToMinutes(values.mealBreakStart);
      let mealEnd = parseTimeToMinutes(values.mealBreakEnd);
      if (mealEnd <= mealStart) {
        mealEnd += MINUTES_PER_DAY;
      }
      duration -= mealEnd - mealStart;
    }

    return Number((duration / 60).toFixed(2));
  };

  const buildShiftPayload = (values: ManualShiftFormValues): Shift => ({
    shiftCode: values.shiftCode,
    scheduleType: values.scheduleType,
    zone: values.zone,
    startTime: values.startTime,
    endTime: values.endTime,
    breakDuration: values.breakDuration ?? undefined,
    breakStart: values.breakStart ?? undefined,
    breakEnd: values.breakEnd ?? undefined,
    mealBreakStart: values.mealBreakStart ?? undefined,
    mealBreakEnd: values.mealBreakEnd ?? undefined,
    totalHours: computeTotalHours(values),
    unionCompliant: true,
    complianceWarnings: [],
    isSplitShift: values.isSplitShift,
    origin: 'manual'
  });

  useEffect(() => {
    let isActive = true;
    const subscription = watch((values) => {
      if (!values.startTime || !values.endTime) {
        setViolations([]);
        return;
      }

      setValidating(true);
      (async () => {
        try {
          const payload = buildShiftPayload(values as ManualShiftFormValues);
          const result = await validateShiftAgainstRules(payload, unionRules);
          if (isActive) {
            setViolations(result);
          }
        } finally {
          if (isActive) {
            setValidating(false);
          }
        }
      })();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [watch, unionRules]);

  const onSubmit = async (values: ManualShiftFormValues) => {
    const payload = buildShiftPayload(values);
    const result = await validateShiftAgainstRules(payload, unionRules);
    setViolations(result);

    const hasErrors = result.some((violation) => violation.violationType === 'error');
    if (hasErrors && !window.confirm('This shift has union compliance errors. Create anyway?')) {
      return;
    }

    const shiftToPersist: Shift = {
      ...payload,
      unionCompliant: !hasErrors,
      complianceWarnings: result.map((violation) => violation.violationMessage)
    };

    await dispatch(saveShift(shiftToPersist));
    onShiftCreated();
    reset(defaultValues);
    setViolations([]);
  };

  const totalHours = useMemo(() => computeTotalHours(formValues), [formValues]);
  const hasErrors = violations.some((violation) => violation.violationType === 'error');
  const hasWarnings = violations.some((violation) => violation.violationType === 'warning');

  const renderTimePicker = (
    name: keyof ManualShiftFormValues,
    label: string,
    rounding: 'floor' | 'ceil'
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TimePicker
          label={label}
          value={field.value ? dayjs(`2024-01-01 ${field.value}`) : null}
          onChange={(value: Dayjs | null) => field.onChange(value ? snapDayjsToInterval(value, rounding) : null)}
          timeSteps={{ minutes: 15 }}
          slotProps={{
            textField: {
              fullWidth: true,
              error: Boolean(errors[name]),
              helperText: errors[name]?.message
            }
          }}
        />
      )}
    />
  );

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
            }}
          >
            <Controller
              name="scheduleType"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={Boolean(errors.scheduleType)}>
                  <InputLabel>Shift Type</InputLabel>
                  <Select {...field} label="Shift Type">
                    <MenuItem value="weekday">Weekday</MenuItem>
                    <MenuItem value="saturday">Saturday</MenuItem>
                    <MenuItem value="sunday">Sunday</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            <TextField
              fullWidth
              label="Shift Code"
              placeholder="Bus 01"
              error={Boolean(errors.shiftCode)}
              helperText={errors.shiftCode?.message}
              {...register('shiftCode')}
            />
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            <Controller
              name="zone"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={Boolean(errors.zone)}>
                  <InputLabel>Zone</InputLabel>
                  <Select {...field} label="Zone">
                    <MenuItem value="North">North</MenuItem>
                    <MenuItem value="South">South</MenuItem>
                    <MenuItem value="Floater">Floater</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            {renderTimePicker('startTime', 'Start Time', 'floor')}
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            {renderTimePicker('endTime', 'End Time', 'ceil')}
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
            }}
          >
            <Controller
              name="breakDuration"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  type="number"
                  label="Break Duration (minutes)"
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value === '' ? null : Number(event.target.value))}
                  InputProps={{ inputProps: { min: 0, max: 120 } }}
                  error={Boolean(errors.breakDuration)}
                  helperText={errors.breakDuration?.message}
                />
              )}
            />
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            {renderTimePicker('breakStart', 'Break Start', 'floor')}
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            {renderTimePicker('breakEnd', 'Break End', 'ceil')}
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}
          >
            <FormControlLabel
              control={
                <Controller
                  name="isSplitShift"
                  control={control}
                  render={({ field }) => <Checkbox {...field} checked={field.value} color="primary" />}
                />
              }
              label="Split Shift"
            />
          </Grid>

          {/* Meal Break (for shifts over 6 hours) */}
          {totalHours > 6 && (
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
                }}
              >
                {renderTimePicker('mealBreakStart', 'Meal Break Start', 'floor')}
              </Grid>

              <Grid
                size={{
                  xs: 12,
                  md: 4
                }}
              >
                {renderTimePicker('mealBreakEnd', 'Meal Break End', 'ceil')}
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
                <Alert severity="success">All union rules satisfied</Alert>
              )}

              {hasErrors && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Required Rule Violations:
                  </Typography>
                  <Stack spacing={1}>
                    {violations
                      .filter((violation) => violation.violationType === 'error')
                      .map((violation) => (
                        <Typography key={`${violation.ruleId}-error`} variant="body2">
                          • {violation.violationMessage}
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
                      .filter((violation) => violation.violationType === 'warning')
                      .map((violation) => (
                        <Typography key={`${violation.ruleId}-warning`} variant="body2">
                          • {violation.violationMessage}
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
                <Typography variant="h6">Total Hours: {totalHours.toFixed(2)}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip label={(formValues.scheduleType ?? 'weekday').toUpperCase()} color="primary" size="small" />
                  <Chip label={formValues.zone} color="secondary" size="small" />
                  {formValues.isSplitShift && <Chip label="Split Shift" color="warning" size="small" />}
                </Stack>
              </Box>

              <Button
                variant="contained"
                color={hasErrors ? 'warning' : 'primary'}
                onClick={handleSubmit(onSubmit)}
                disabled={!formValues.shiftCode || validating || isSubmitting}
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

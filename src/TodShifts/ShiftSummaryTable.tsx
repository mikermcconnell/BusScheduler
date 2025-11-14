import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip
} from '@mui/material';
import Slider from '@mui/material/Slider';
import { Edit, Delete, Warning } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { Shift, UnionViolation, UnionRule } from './types/shift.types';
import { saveShift, updateShift, deleteShift } from './store/shiftManagementSlice';
import { validateShiftAgainstRules } from './utils/unionRulesValidator';
import { isMealBreakThresholdRule } from './utils/ruleMatchers';
import {
  minutesToTimeString,
  parseTimeToMinutes,
  INTERVAL_MINUTES,
  TIME_WINDOW_START,
  TIME_WINDOW_END,
  DAY_TYPES
} from './utils/timeUtils';

interface ShiftSummaryTableProps {
  title?: string;
  showActions?: boolean;
  filterScheduleType?: Shift['scheduleType'];
  filterZone?: Shift['zone'];
}

const defaultShiftTemplate: Shift = {
  shiftCode: '',
  scheduleType: 'weekday',
  zone: 'North',
  startTime: minutesToTimeString(TIME_WINDOW_START),
  endTime: minutesToTimeString(TIME_WINDOW_START + 8 * 60),
  totalHours: 8,
  unionCompliant: true,
  complianceWarnings: [],
  isSplitShift: false,
  origin: 'manual',
  vehicleCount: 1
};

const DEFAULT_MIN_SHIFT_HOURS = 5;
const DEFAULT_MAX_SHIFT_HOURS = 9.75;
const DEFAULT_IDEAL_SHIFT_HOURS = 7.2;
const DEFAULT_BREAK_THRESHOLD_HOURS = 7.5;
type ChipStatusColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
interface ShiftLengthFeedback {
  message: string;
  chipColor: ChipStatusColor;
  textColor: string;
}

function extractShiftLengthLimit(
  rules: UnionRule[],
  mode: 'min' | 'max',
  fallback: number
): number {
  const match = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'shift_length' &&
      rule.ruleType === 'required' &&
      typeof (mode === 'max' ? rule.maxValue : rule.minValue) === 'number'
  );
  if (!match) {
    return fallback;
  }
  const raw = (mode === 'max' ? match.maxValue : match.minValue) as number;
  const hours = match.unit === 'minutes' ? raw / 60 : raw;
  return hours > 0 ? hours : fallback;
}

function extractIdealShiftHours(rules: UnionRule[], fallback: number): number {
  const match = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'shift_length' &&
      rule.ruleType === 'preferred' &&
      typeof rule.minValue === 'number'
  );
  if (!match || typeof match.minValue !== 'number') {
    return fallback;
  }
  return match.unit === 'minutes' ? match.minValue / 60 : match.minValue;
}

function extractBreakThresholdHours(rules: UnionRule[], fallback: number): number {
  const match = rules.find(
    (rule) =>
      rule.isActive &&
      rule.category === 'breaks' &&
      rule.ruleType === 'required' &&
      typeof rule.minValue === 'number' &&
      isMealBreakThresholdRule(rule)
  );

  if (!match || typeof match.minValue !== 'number') {
    return fallback;
  }

  return match.unit === 'minutes' ? match.minValue / 60 : match.minValue;
}

const ShiftSummaryTable: React.FC<ShiftSummaryTableProps> = ({
  title,
  showActions = true,
  filterScheduleType,
  filterZone
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { shifts, loading } = useSelector((state: RootState) => state.shiftManagement);
  const order: Record<Shift['scheduleType'], number> = {
    weekday: 0,
    saturday: 1,
    sunday: 2
  };
  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const dayDelta = order[a.scheduleType] - order[b.scheduleType];
      if (dayDelta !== 0) {
        return dayDelta;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [shifts]);
  const filteredShifts = sortedShifts.filter((shift) => {
    const dayMatch = filterScheduleType ? shift.scheduleType === filterScheduleType : true;
    const zoneMatch = filterZone ? shift.zone === filterZone : true;
    return dayMatch && zoneMatch;
  });
  const tableTitle = title ?? 'Shift Summary';
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    shift?: Shift;
  }>({
    open: false,
    mode: 'add'
  });

  const openEditor = (mode: 'add' | 'edit', shiftToEdit?: Shift) => {
    setDialogState({ open: true, mode, shift: shiftToEdit });
  };

  const handleDelete = async (shiftToDelete: Shift) => {
    if (!shiftToDelete.id) {
      return;
    }
    try {
      await dispatch(deleteShift(shiftToDelete.id)).unwrap();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {tableTitle}
      </Typography>
      {showActions && (
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button
            variant="contained"
            size="small"
            disabled={loading.shifts}
            onClick={() => openEditor('add')}
          >
            Add Shift
          </Button>
        </Box>
      )}

      {filteredShifts.length === 0 ? (
        <Alert severity="info">
          {filterScheduleType
            ? `No ${filterScheduleType} shifts yet. Use “Add Shift” to create one.`
            : 'No shifts created yet.'}
        </Alert>
      ) : (
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
              {filteredShifts.map((shift) => (
                <TableRow key={shift.id ?? shift.shiftCode} hover>
                  <TableCell>{shift.shiftCode}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{shift.scheduleType}</TableCell>
                  <TableCell>{shift.zone}</TableCell>
                  <TableCell>{shift.startTime}</TableCell>
                  <TableCell>{shift.endTime}</TableCell>
                  <TableCell>{typeof shift.totalHours === 'number' ? `${shift.totalHours.toFixed(1)}h` : '—'}</TableCell>
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
                        <Tooltip title={shift.complianceWarnings.join('\n')}>
                          <Warning color="warning" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <Tooltip title="Edit shift">
                        <span>
                          <IconButton color="primary" size="small" onClick={() => openEditor('edit', shift)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete shift">
                        <span>
                          <IconButton
                            color="error"
                            size="small"
                            disabled={!shift.id || loading.shifts}
                            onClick={() => handleDelete(shift)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {showActions && (
        <ShiftEditorDialog
          open={dialogState.open}
          mode={dialogState.mode}
          shift={dialogState.shift}
          defaultScheduleType={filterScheduleType}
          defaultZone={filterZone}
          onClose={() => setDialogState({ open: false, mode: 'add' })}
        />
      )}
    </Paper>
  );
};

export default ShiftSummaryTable;

interface ShiftEditorDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  shift?: Shift;
  defaultScheduleType?: Shift['scheduleType'];
  defaultZone?: Shift['zone'];
  onClose: () => void;
}

const ShiftEditorDialog: React.FC<ShiftEditorDialogProps> = ({
  open,
  mode,
  shift,
  defaultScheduleType,
  defaultZone,
  onClose
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const unionRules = useSelector((state: RootState) => state.shiftManagement.unionRules);
  const loading = useSelector((state: RootState) => state.shiftManagement.loading.shifts);
  const initialShift =
    shift ??
    {
      ...defaultShiftTemplate,
      scheduleType: defaultScheduleType ?? defaultShiftTemplate.scheduleType,
      zone: defaultZone ?? defaultShiftTemplate.zone
    };
  const parseMinutesOrFallback = (value: string | undefined, fallback: number): number => {
    if (!value) {
      return fallback;
    }
    try {
      return parseTimeToMinutes(value);
    } catch (error) {
      console.warn('Unable to parse time value, using fallback.', value, error);
      return fallback;
    }
  };
  const resolvedStart = parseMinutesOrFallback(initialShift.startTime, TIME_WINDOW_START);
  const resolvedEnd = parseMinutesOrFallback(initialShift.endTime, resolvedStart + 8 * 60);
  const [shiftCode, setShiftCode] = useState(initialShift.shiftCode);
  const [scheduleType, setScheduleType] = useState(initialShift.scheduleType);
  const [zone, setZone] = useState(initialShift.zone);
  const [range, setRange] = useState<[number, number]>([resolvedStart, resolvedEnd]);
  const [includeBreak, setIncludeBreak] = useState(Boolean(initialShift.breakStart && initialShift.breakEnd));
  const defaultBreakStart = resolvedStart + 2 * 60;
  const defaultBreakEnd = defaultBreakStart + 30;
  const [breakRange, setBreakRange] = useState<[number, number]>([
    includeBreak
      ? parseMinutesOrFallback(initialShift.breakStart as string, defaultBreakStart)
      : defaultBreakStart,
    includeBreak
      ? parseMinutesOrFallback(initialShift.breakEnd as string, defaultBreakEnd)
      : defaultBreakEnd
  ]);
  const [violations, setViolations] = useState<UnionViolation[]>([]);
  const minShiftHours = useMemo(
    () => extractShiftLengthLimit(unionRules, 'min', DEFAULT_MIN_SHIFT_HOURS),
    [unionRules]
  );
  const maxShiftHours = useMemo(
    () => extractShiftLengthLimit(unionRules, 'max', DEFAULT_MAX_SHIFT_HOURS),
    [unionRules]
  );
  const idealShiftHours = useMemo(
    () => extractIdealShiftHours(unionRules, DEFAULT_IDEAL_SHIFT_HOURS),
    [unionRules]
  );
  const breakThresholdHours = useMemo(
    () => extractBreakThresholdHours(unionRules, DEFAULT_BREAK_THRESHOLD_HOURS),
    [unionRules]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const refreshedShift =
      shift ??
      {
        ...defaultShiftTemplate,
        scheduleType: defaultScheduleType ?? defaultShiftTemplate.scheduleType,
        zone: defaultZone ?? defaultShiftTemplate.zone
      };
    const startMinutes = parseMinutesOrFallback(refreshedShift.startTime, TIME_WINDOW_START);
    const endMinutes = parseMinutesOrFallback(refreshedShift.endTime, startMinutes + 8 * 60);
    setShiftCode(refreshedShift.shiftCode);
    setScheduleType(refreshedShift.scheduleType);
    setZone(refreshedShift.zone);
    setRange([startMinutes, endMinutes]);
    const hasBreak = Boolean(refreshedShift.breakStart && refreshedShift.breakEnd);
    setIncludeBreak(hasBreak);
    const fallbackBreakStart = startMinutes + 2 * 60;
    const fallbackBreakEnd = fallbackBreakStart + 30;
    setBreakRange([
      hasBreak
        ? parseMinutesOrFallback(refreshedShift.breakStart as string, fallbackBreakStart)
        : fallbackBreakStart,
      hasBreak
        ? parseMinutesOrFallback(refreshedShift.breakEnd as string, fallbackBreakEnd)
        : fallbackBreakEnd
    ]);
    setViolations([]);
  }, [open, shift, defaultScheduleType, defaultZone]);

  const marks = useMemo(() => {
    const values: { value: number; label: string }[] = [];
    for (let minute = TIME_WINDOW_START; minute <= TIME_WINDOW_END; minute += 120) {
      values.push({ value: minute, label: minutesToTimeString(minute) });
    }
    return values;
  }, []);

  const snap = (value: number) => {
    return Math.round(value / INTERVAL_MINUTES) * INTERVAL_MINUTES;
  };

  const handleRangeChange = (_: Event, values: number | number[]) => {
    const [start, end] = values as number[];
    const snappedStart = Math.max(TIME_WINDOW_START, snap(start));
    const snappedEnd = Math.min(TIME_WINDOW_END, snap(end));
    if (snappedEnd <= snappedStart) {
      return;
    }
    setRange([snappedStart, snappedEnd]);
  };

  const handleBreakRangeChange = (_: Event, values: number | number[]) => {
    const [start, end] = values as number[];
    const minBreakStart = range[0] + INTERVAL_MINUTES;
    const maxBreakEnd = range[1] - INTERVAL_MINUTES;
    const snappedStart = Math.max(minBreakStart, snap(start));
    const snappedEnd = Math.min(maxBreakEnd, snap(end));
    if (snappedEnd <= snappedStart) {
      return;
    }
    setBreakRange([snappedStart, snappedEnd]);
  };

  const calculateTotalHours = () => {
    const grossMinutes = range[1] - range[0];
    const breakMinutes = includeBreak ? breakRange[1] - breakRange[0] : 0;
    return Number(((grossMinutes - breakMinutes) / 60).toFixed(2));
  };
  const currentShiftHours = useMemo(() => calculateTotalHours(), [range, breakRange, includeBreak]);
  const grossShiftHours = useMemo(() => Number(((range[1] - range[0]) / 60).toFixed(2)), [range]);
  const requiresMealBreak = useMemo(
    () => grossShiftHours >= breakThresholdHours - 0.01,
    [grossShiftHours, breakThresholdHours]
  );
  const autoBreakRef = useRef(false);
  useEffect(() => {
    if (requiresMealBreak) {
      if (!includeBreak) {
        setIncludeBreak(true);
      }
      autoBreakRef.current = true;
    } else if (autoBreakRef.current) {
      if (includeBreak) {
        setIncludeBreak(false);
      }
      autoBreakRef.current = false;
    }
  }, [requiresMealBreak, includeBreak]);
  const shiftLengthFeedback = useMemo<ShiftLengthFeedback>(() => {
    if (currentShiftHours < minShiftHours) {
      return {
        message: `Below minimum ${minShiftHours.toFixed(2)} hr requirement`,
        chipColor: 'error' as ChipStatusColor,
        textColor: 'error.main'
      };
    }
    if (currentShiftHours > maxShiftHours) {
      return {
        message: `Above maximum ${maxShiftHours.toFixed(2)} hr limit`,
        chipColor: 'error' as ChipStatusColor,
        textColor: 'error.main'
      };
    }
    const nearIdeal = Math.abs(currentShiftHours - idealShiftHours) <= 0.25;
    return {
      message: nearIdeal
        ? `Within ideal target of ${idealShiftHours.toFixed(2)} hrs`
        : `Within union range; ideal target is ${idealShiftHours.toFixed(2)} hrs`,
      chipColor: (nearIdeal ? 'success' : 'warning') as ChipStatusColor,
      textColor: nearIdeal ? 'success.main' : 'warning.main'
    };
  }, [currentShiftHours, idealShiftHours, maxShiftHours, minShiftHours]);

  const buildPayload = (): Shift => ({
    ...defaultShiftTemplate,
    ...shift,
    shiftCode,
    scheduleType,
    zone,
    startTime: minutesToTimeString(range[0]),
    endTime: minutesToTimeString(range[1]),
    breakStart: includeBreak ? minutesToTimeString(breakRange[0]) : undefined,
    breakEnd: includeBreak ? minutesToTimeString(breakRange[1]) : undefined,
    breakDuration: includeBreak ? breakRange[1] - breakRange[0] : undefined,
    totalHours: calculateTotalHours(),
    vehicleCount: shift?.vehicleCount ?? 1,
    origin: shift?.origin ?? 'manual'
  });

  const handleSave = async () => {
    const payload = buildPayload();
    const ruleSet = unionRules.length > 0 ? unionRules : [];
    const result = await validateShiftAgainstRules(payload, ruleSet);
    setViolations(result);
    const hasErrors = result.some((violation) => violation.violationType === 'error');
    if (hasErrors && !window.confirm('This shift violates union rules. Continue anyway?')) {
      return;
    }

    try {
      if (mode === 'add') {
        await dispatch(saveShift(payload)).unwrap();
      } else {
        await dispatch(updateShift({ ...payload, id: shift?.id })).unwrap();
      }
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{mode === 'add' ? 'Add Shift' : `Edit ${shift?.shiftCode ?? 'shift'}`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} mt={1}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Shift Code" value={shiftCode} onChange={(event) => setShiftCode(event.target.value)} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Shift Type</InputLabel>
              <Select
                label="Shift Type"
                value={scheduleType}
                onChange={(event) => setScheduleType(event.target.value as Shift['scheduleType'])}
              >
                {DAY_TYPES.map((day) => (
                  <MenuItem key={day} value={day} sx={{ textTransform: 'capitalize' }}>
                    {day}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Zone</InputLabel>
              <Select label="Zone" value={zone} onChange={(event) => setZone(event.target.value as Shift['zone'])}>
                <MenuItem value="North">North</MenuItem>
                <MenuItem value="South">South</MenuItem>
                <MenuItem value="Floater">Floater</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Shift Window ({minutesToTimeString(range[0])} – {minutesToTimeString(range[1])})
            </Typography>
            <Slider
              value={range}
              onChange={handleRangeChange}
              min={TIME_WINDOW_START}
              max={TIME_WINDOW_END}
              step={INTERVAL_MINUTES}
              marks={marks}
              valueLabelDisplay="off"
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}
              sx={{ '& > *': { mb: 0.5 } }}
            >
              <Chip
                label={`Current ${currentShiftHours.toFixed(2)}h`}
                color={shiftLengthFeedback.chipColor}
                size="small"
              />
              <Chip label={`Min ${minShiftHours.toFixed(2)}h`} size="small" />
              <Chip label={`Ideal ${idealShiftHours.toFixed(2)}h`} size="small" />
              <Chip label={`Max ${maxShiftHours.toFixed(2)}h`} size="small" />
            </Stack>
            <Typography variant="caption" color={shiftLengthFeedback.textColor} display="block" sx={{ mt: 0.5 }}>
              {shiftLengthFeedback.message}
            </Typography>
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={includeBreak}
                  onChange={(event) => setIncludeBreak(event.target.checked)}
                  disabled={requiresMealBreak}
                />
              }
              label={requiresMealBreak ? 'Meal break required (auto applied)' : 'Include meal break'}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              {requiresMealBreak
                ? `Shifts ≥ ${breakThresholdHours.toFixed(2)} hrs must include a meal break.`
                : 'Toggle to add an optional meal break for shorter shifts.'}
            </Typography>
            {includeBreak && (
              <Box mt={1}>
                <Typography variant="subtitle2" gutterBottom>
                  Break Window ({minutesToTimeString(breakRange[0])} – {minutesToTimeString(breakRange[1])})
                </Typography>
                <Slider
                  value={breakRange}
                  onChange={handleBreakRangeChange}
                  min={range[0] + INTERVAL_MINUTES}
                  max={range[1] - INTERVAL_MINUTES}
                  step={INTERVAL_MINUTES}
                  marks={marks}
                  valueLabelDisplay="off"
                />
              </Box>
            )}
          </Box>

          {violations.length > 0 && (
            <Alert severity="warning">
              <Stack spacing={0.5}>
                {violations.map((violation) => (
                  <Typography variant="body2" key={`${violation.ruleId}-${violation.violationMessage}`}>
                    {violation.violationMessage}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || !shiftCode}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

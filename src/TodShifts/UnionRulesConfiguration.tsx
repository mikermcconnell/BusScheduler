import React, { useEffect, useMemo, useState } from 'react';
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
  Button,
  Box,
  Alert,
  TextField,
  MenuItem,
  Stack,
  IconButton,
  Tooltip,
  Switch,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { useDispatch, useSelector } from 'react-redux';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RootState, AppDispatch } from '../store/store';
import { loadUnionRules, persistUnionRules } from './store/shiftManagementSlice';
import { UnionRule } from './types/shift.types';
import { unionRulesFormSchema, UnionRulesFormValues } from './utils/shiftFormSchemas';

const CATEGORY_OPTIONS: Array<{ value: UnionRule['category']; label: string }> = [
  { value: 'shift_length', label: 'Shift Length' },
  { value: 'breaks', label: 'Breaks' },
  { value: 'rest_periods', label: 'Rest Periods' }
];

const UNIT_OPTIONS = [
  { value: 'hours', label: 'Hours' },
  { value: 'minutes', label: 'Minutes' }
];

const RULE_TYPE_OPTIONS = [
  { value: 'required', label: 'Required' },
  { value: 'preferred', label: 'Preferred' }
];

const createEmptyRule = (): UnionRule => ({
  id: Date.now(),
  ruleName: 'New Rule',
  ruleType: 'preferred',
  category: 'shift_length',
  minValue: undefined,
  maxValue: undefined,
  unit: 'hours',
  isActive: true,
  description: 'Describe the intent of this rule.'
});

const UnionRulesConfiguration: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { unionRules, loading, error } = useSelector((state: RootState) => state.shiftManagement);
  const [showSavedBanner, setShowSavedBanner] = useState(false);

  useEffect(() => {
    if (!unionRules.length) {
      dispatch(loadUnionRules());
    }
  }, [dispatch, unionRules.length]);

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { isDirty, isSubmitting, errors }
  } = useForm<UnionRulesFormValues>({
    resolver: zodResolver(unionRulesFormSchema),
    defaultValues: { rules: unionRules }
  });

  useEffect(() => {
    reset({ rules: unionRules });
  }, [reset, unionRules]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rules'
  });

  const handleAddRule = () => append(createEmptyRule());
  const handleRemoveRule = (index: number) => remove(index);

  const onSubmit = async (values: UnionRulesFormValues) => {
    setShowSavedBanner(false);
    try {
      await dispatch(persistUnionRules(values.rules)).unwrap();
      setShowSavedBanner(true);
      reset(values, { keepDirty: false });
    } catch (err) {
      console.error(err);
    }
  };

  const initialLoading = loading.unionRules && unionRules.length === 0;
  const hasRules = useMemo(() => fields.length > 0, [fields.length]);

  if (initialLoading) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography>Loading union rules...</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6">Union Rules Configuration</Typography>
          <Typography variant="body2" color="text.secondary">
            Changes save locally so you can reuse your preferred union profile.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={handleAddRule}>
            Add Rule
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            disabled={!isDirty || loading.unionRulesPersistence || !hasRules}
            onClick={handleSubmit(onSubmit)}
          >
            {loading.unionRulesPersistence || isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Box>

      {error.unionRules && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.unionRules}
        </Alert>
      )}

      {showSavedBanner && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setShowSavedBanner(false)}>
          Union rules saved for future sessions.
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rule Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Min Value</TableCell>
              <TableCell>Max Value</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id ?? index}>
                <TableCell sx={{ minWidth: 180 }}>
                  <TextField
                    size="small"
                    fullWidth
                    defaultValue={field.ruleName}
                    {...register(`rules.${index}.ruleName` as const)}
                    error={Boolean(errors.rules?.[index]?.ruleName)}
                    helperText={errors.rules?.[index]?.ruleName?.message}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <Controller
                    name={`rules.${index}.category` as const}
                    control={control}
                    defaultValue={field.category}
                    render={({ field: controllerField }) => (
                      <FormControl fullWidth size="small" error={Boolean(errors.rules?.[index]?.category)}>
                        <InputLabel>Category</InputLabel>
                        <Select {...controllerField} label="Category">
                          {CATEGORY_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <Controller
                    name={`rules.${index}.ruleType` as const}
                    control={control}
                    defaultValue={field.ruleType}
                    render={({ field: controllerField }) => (
                      <FormControl fullWidth size="small" error={Boolean(errors.rules?.[index]?.ruleType)}>
                        <InputLabel>Type</InputLabel>
                        <Select {...controllerField} label="Type">
                          {RULE_TYPE_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <TextField
                    size="small"
                    type="number"
                    fullWidth
                    defaultValue={field.minValue ?? ''}
                    {...register(`rules.${index}.minValue` as const, {
                      setValueAs: (value) => (value === '' || value === null ? undefined : Number(value))
                    })}
                    error={Boolean(errors.rules?.[index]?.minValue)}
                    helperText={errors.rules?.[index]?.minValue?.message}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <TextField
                    size="small"
                    type="number"
                    fullWidth
                    defaultValue={field.maxValue ?? ''}
                    {...register(`rules.${index}.maxValue` as const, {
                      setValueAs: (value) => (value === '' || value === null ? undefined : Number(value))
                    })}
                    error={Boolean(errors.rules?.[index]?.maxValue)}
                    helperText={errors.rules?.[index]?.maxValue?.message}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <Controller
                    name={`rules.${index}.unit` as const}
                    control={control}
                    defaultValue={field.unit ?? 'hours'}
                    render={({ field: controllerField }) => (
                      <FormControl fullWidth size="small">
                        <InputLabel>Unit</InputLabel>
                        <Select {...controllerField} label="Unit">
                          {UNIT_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Controller
                    name={`rules.${index}.isActive` as const}
                    control={control}
                    defaultValue={field.isActive}
                    render={({ field: controllerField }) => (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch {...controllerField} checked={controllerField.value} />
                        <Chip
                          label={controllerField.value ? 'Active' : 'Disabled'}
                          size="small"
                          color={controllerField.value ? 'success' : 'default'}
                        />
                      </Stack>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Remove rule">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveRule(index)}
                        disabled={loading.unionRulesPersistence}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default UnionRulesConfiguration;

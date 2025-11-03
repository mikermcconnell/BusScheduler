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
  Switch,
  IconButton,
  Tooltip
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { loadUnionRules, persistUnionRules } from './store/shiftManagementSlice';
import { UnionRule } from './types/shift.types';

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

const UnionRulesConfiguration: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { unionRules, loading, error } = useSelector((state: RootState) => state.shiftManagement);
  const [draftRules, setDraftRules] = useState<UnionRule[]>([]);
  const [showSavedBanner, setShowSavedBanner] = useState(false);

  useEffect(() => {
    if (!unionRules.length) {
      dispatch(loadUnionRules());
    }
  }, [dispatch, unionRules.length]);

  useEffect(() => {
    setDraftRules(unionRules);
  }, [unionRules]);

  const hasChanges = useMemo(() => {
    if (draftRules.length !== unionRules.length) {
      return true;
    }
    return draftRules.some((rule, index) => JSON.stringify(rule) !== JSON.stringify(unionRules[index]));
  }, [draftRules, unionRules]);

  const initialLoading = loading.unionRules && unionRules.length === 0;

  if (initialLoading) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography>Loading union rules...</Typography>
      </Paper>
    );
  }

  const handleRuleChange = <K extends keyof UnionRule>(id: UnionRule['id'], field: K, value: UnionRule[K]) => {
    setDraftRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule))
    );
  };

  const handleAddRule = () => {
    const newRule: UnionRule = {
      id: Date.now(),
      ruleName: 'New Rule',
      ruleType: 'preferred',
      category: 'shift_length',
      minValue: undefined,
      maxValue: undefined,
      unit: 'hours',
      isActive: true,
      description: 'Describe the intent of this rule.'
    };
    setDraftRules((prev) => [...prev, newRule]);
  };

  const handleRemoveRule = (id?: UnionRule['id']) => {
    setDraftRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleSave = async () => {
    setShowSavedBanner(false);
    try {
      await dispatch(persistUnionRules(draftRules)).unwrap();
      setShowSavedBanner(true);
    } catch (err) {
      console.error(err);
    }
  };

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
            disabled={!hasChanges || loading.unionRulesPersistence}
            onClick={handleSave}
          >
            {loading.unionRulesPersistence ? 'Saving…' : 'Save'}
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
            {draftRules.map((rule: UnionRule) => (
              <TableRow key={rule.id}>
                <TableCell sx={{ minWidth: 180 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={rule.ruleName}
                    onChange={(event) => handleRuleChange(rule.id, 'ruleName', event.target.value)}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <TextField
                    size="small"
                    select
                    fullWidth
                    value={rule.category}
                    onChange={(event) => handleRuleChange(rule.id, 'category', event.target.value as UnionRule['category'])}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <TextField
                    size="small"
                    select
                    fullWidth
                    value={rule.ruleType}
                    onChange={(event) => handleRuleChange(rule.id, 'ruleType', event.target.value as UnionRule['ruleType'])}
                  >
                    {RULE_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: 0.25 }}
                    value={rule.minValue ?? ''}
                    onChange={(event) =>
                      handleRuleChange(
                        rule.id,
                        'minValue',
                        event.target.value === '' ? undefined : Number(event.target.value)
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: 0.25 }}
                    value={rule.maxValue ?? ''}
                    onChange={(event) =>
                      handleRuleChange(
                        rule.id,
                        'maxValue',
                        event.target.value === '' ? undefined : Number(event.target.value)
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    select
                    value={rule.unit ?? 'hours'}
                    onChange={(event) => handleRuleChange(rule.id, 'unit', event.target.value as UnionRule['unit'])}
                  >
                    {UNIT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={rule.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={rule.isActive ? 'success' : 'default'}
                    />
                    <Switch
                      checked={rule.isActive}
                      onChange={(event) => handleRuleChange(rule.id, 'isActive', event.target.checked)}
                      size="small"
                    />
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Remove rule">
                    <span>
                      <IconButton size="small" onClick={() => handleRemoveRule(rule.id)}>
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

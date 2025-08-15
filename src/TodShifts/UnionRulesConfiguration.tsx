import React, { useEffect } from 'react';
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
  Alert
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { loadUnionRules } from './store/shiftManagementSlice';
import { UnionRule } from './types/shift.types';

const UnionRulesConfiguration: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { unionRules, loading, error } = useSelector((state: RootState) => state.shiftManagement);

  useEffect(() => {
    dispatch(loadUnionRules());
  }, [dispatch]);

  if (loading.unionRules) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography>Loading union rules...</Typography>
      </Paper>
    );
  }

  if (error.unionRules) {
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Alert severity="error">{error.unionRules}</Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Union Rules Configuration</Typography>
        <Button variant="outlined" size="small">
          Add Rule
        </Button>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rule Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unionRules.map((rule: UnionRule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.ruleName}</TableCell>
                <TableCell>{rule.category}</TableCell>
                <TableCell>
                  <Chip 
                    label={rule.ruleType} 
                    size="small"
                    color={rule.ruleType === 'required' ? 'error' : 'warning'}
                  />
                </TableCell>
                <TableCell>
                  {rule.minValue && `Min: ${rule.minValue}${rule.unit ? ` ${rule.unit}` : ''}`}
                  {rule.maxValue && `Max: ${rule.maxValue}${rule.unit ? ` ${rule.unit}` : ''}`}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={rule.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={rule.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Button size="small" variant="text">
                    Edit
                  </Button>
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
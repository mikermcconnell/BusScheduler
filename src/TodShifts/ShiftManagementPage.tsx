import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  Tabs, 
  Tab, 
  Typography, 
  Grid,
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import MasterScheduleImport from './MasterScheduleImport';
import UnionRulesConfiguration from './UnionRulesConfiguration';
import ManualShiftCreator from './ManualShiftCreator';
import ShiftGanttChart from './ShiftGanttChart';
import ShiftSummaryTable from './ShiftSummaryTable';
import ShiftExport from './ShiftExport';
import { 
  loadUnionRules, 
  setActiveScheduleType 
} from './store/shiftManagementSlice';

const ShiftManagementPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const { 
    activeScheduleType, 
    shifts, 
    masterSchedule,
    coverage,
    loading,
    error 
  } = useSelector((state: RootState) => state.shiftManagement);

  useEffect(() => {
    // Load union rules on component mount
    dispatch(loadUnionRules());
  }, [dispatch]);

  const handleScheduleTypeChange = (
    event: React.SyntheticEvent, 
    newValue: number
  ) => {
    const types: Array<'weekday' | 'saturday' | 'sunday'> = ['weekday', 'saturday', 'sunday'];
    dispatch(setActiveScheduleType(types[newValue]));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const showSuccessNotification = (message: string) => {
    setSuccessMessage(message);
    setShowSuccess(true);
  };

  // Calculate compliance statistics
  const complianceStats = {
    total: shifts.filter((s: any) => s.scheduleType === activeScheduleType).length,
    compliant: shifts.filter((s: any) => s.scheduleType === activeScheduleType && s.unionCompliant).length,
    warnings: shifts.filter((s: any) => 
      s.scheduleType === activeScheduleType && 
      s.complianceWarnings && 
      s.complianceWarnings.length > 0
    ).length,
  };

  // Calculate coverage statistics
  const coverageStats = coverage.reduce((acc: { gaps: number; excess: number }, slot: any) => {
    if (slot.difference < 0) acc.gaps++;
    else if (slot.difference > 2) acc.excess++;
    return acc;
  }, { gaps: 0, excess: 0 });

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography variant="h5" gutterBottom>
              Shift Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create and manage driver shifts with union compliance
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Tabs value={['weekday', 'saturday', 'sunday'].indexOf(activeScheduleType)} 
                  onChange={handleScheduleTypeChange}
                  centered>
              <Tab label="Weekday" />
              <Tab label="Saturday" />
              <Tab label="Sunday" />
            </Tabs>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Box textAlign="center">
                <Typography variant="h6">{complianceStats.compliant}/{complianceStats.total}</Typography>
                <Typography variant="caption">Compliant Shifts</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6" color={coverageStats.gaps > 0 ? 'error' : 'success'}>
                  {coverageStats.gaps}
                </Typography>
                <Typography variant="caption">Coverage Gaps</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6" color="warning.main">
                  {complianceStats.warnings}
                </Typography>
                <Typography variant="caption">Warnings</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {(error.shifts || error.masterSchedule || error.unionRules) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error.shifts || error.masterSchedule || error.unionRules}
        </Alert>
      )}

      {/* Main Content Area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Import & Setup" />
          <Tab label="Create Shifts" />
          <Tab label="Schedule View" />
          <Tab label="Summary & Export" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <MasterScheduleImport />
              </Grid>
              <Grid item xs={12} md={6}>
                <UnionRulesConfiguration />
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <ManualShiftCreator onShiftCreated={() => showSuccessNotification('Shift created successfully')} />
          )}
          
          {activeTab === 2 && (
            <ShiftGanttChart />
          )}
          
          {activeTab === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <ShiftSummaryTable />
              </Grid>
              <Grid item xs={12}>
                <ShiftExport />
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Success Notification */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        message={successMessage}
      />
    </Box>
  );
};

export default ShiftManagementPage;
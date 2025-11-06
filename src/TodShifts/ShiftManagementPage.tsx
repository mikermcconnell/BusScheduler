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
  Snackbar,
  Dialog,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import MasterScheduleImport from './MasterScheduleImport';
import ManualShiftCreator from './ManualShiftCreator';
import ShiftGanttChart from './ShiftGanttChart';
import ShiftSummaryTable from './ShiftSummaryTable';
import ShiftExport from './ShiftExport';
import ShiftOptimizationView from './ShiftOptimizationView';
import OptimizeShiftsPanel from './OptimizeShiftsPanel';
import UnionRulesConfiguration from './UnionRulesConfiguration';
import CloseIcon from '@mui/icons-material/Close';
import { 
  loadUnionRules, 
  setActiveScheduleType,
  fetchLatestTodShiftRun,
  optimizeShifts
} from './store/shiftManagementSlice';

const ShiftManagementPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [unionRulesOpen, setUnionRulesOpen] = useState(false);
  
  const { 
    activeScheduleType,
    shifts,
    coverageTimeline,
    loading,
    error,
    importMetadata,
    lastOptimizationReport
  } = useSelector((state: RootState) => state.shiftManagement);

  useEffect(() => {
    dispatch(fetchLatestTodShiftRun());
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
  const activeShifts = shifts.filter(shift => shift.scheduleType === activeScheduleType);
  const complianceStats = {
    total: activeShifts.length,
    compliant: activeShifts.filter(shift => shift.unionCompliant).length,
    warnings: activeShifts.filter(shift => (shift.complianceWarnings?.length ?? 0) > 0).length
  };

  const activeCoverage = coverageTimeline[activeScheduleType] ?? [];
  const coverageStats = activeCoverage.reduce((acc, slot) => {
    if (slot.totalExcess < 0) acc.gaps++;
    else if (slot.totalExcess > 0) acc.excess++;
    return acc;
  }, { gaps: 0, excess: 0 });

  const canOptimize = Boolean(importMetadata.importedAt && importMetadata.cityFileName);
  const isOptimizing = loading.optimization;
  const optimizationError = error.optimization;
  const optimizationDisabledReason = canOptimize
    ? undefined
    : 'Import the master schedule before optimizing shifts.';

  const handleOptimizeShifts = () => {
    dispatch(optimizeShifts());
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" spacing={3}>
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <Typography variant="h5" gutterBottom>
              Shift Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure and manage driver shifts with union compliance
            </Typography>
            {importMetadata.importedAt && (
              <Typography variant="caption" color="text.secondary" display="block">
                Last import: {new Date(importMetadata.importedAt).toLocaleString()} ({importMetadata.cityFileName} + {importMetadata.contractorFileName})
              </Typography>
            )}
            {importMetadata.lastExportedAt && (
              <Typography variant="caption" color="text.secondary" display="block">
                Last export: {new Date(importMetadata.lastExportedAt).toLocaleString()}
              </Typography>
            )}
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <Tabs value={['weekday', 'saturday', 'sunday'].indexOf(activeScheduleType)} 
                  onChange={handleScheduleTypeChange}
                  centered>
              <Tab label="Weekday" />
              <Tab label="Saturday" />
              <Tab label="Sunday" />
            </Tabs>
          </Grid>
          
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
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
      {(error.shifts || error.imports || error.unionRules || error.persistence) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error.shifts || error.imports || error.unionRules || error.persistence}
        </Alert>
      )}
      {/* Main Content Area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Import & Setup" />
          <Tab label="Configure Shifts" />
          <Tab label="Schedule View" />
          <Tab label="Shift Optimization" />
          <Tab label="Summary & Export" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid
                size={{
                  xs: 12,
                  md: 12
                }}>
                <MasterScheduleImport
                  onSuccess={({ cityFileName, contractorFileName }) => {
                    setActiveTab(2);
                    showSuccessNotification(`Import completed (${cityFileName} / ${contractorFileName}).`);
                  }}
                />
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid
                size={{
                  xs: 12
                }}
              >
                <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h6">Union Rules Overview</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Review and adjust union constraints that drive shift creation and optimization.
                    </Typography>
                  </Box>
                  <Button variant="contained" onClick={() => setUnionRulesOpen(true)}>
                    Open Union Rules
                  </Button>
                </Paper>
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  md: 8
                }}>
                <ManualShiftCreator onShiftCreated={() => showSuccessNotification('Shift created successfully')} />
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  md: 4
                }}>
                <OptimizeShiftsPanel
                  canOptimize={canOptimize}
                  isOptimizing={isOptimizing}
                  optimizeError={optimizationError}
                  onOptimize={handleOptimizeShifts}
                  disabledReason={optimizationDisabledReason}
                  lastReport={lastOptimizationReport}
                />
              </Grid>
              <Grid
                size={{
                  xs: 12
                }}>
                <ShiftSummaryTable title="Existing Shifts" showActions={false} />
              </Grid>
            </Grid>
          )}
          
          {activeTab === 2 && (
            <ShiftGanttChart />
          )}
          
          {activeTab === 3 && (
            <ShiftOptimizationView />
          )}

          {activeTab === 4 && (
            <Grid container spacing={3}>
              <Grid size={12}>
                <ShiftSummaryTable />
              </Grid>
              <Grid size={12}>
                <ShiftExport />
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>
      <Dialog fullScreen open={unionRulesOpen} onClose={() => setUnionRulesOpen(false)}>
        <AppBar sx={{ position: 'relative' }} color="primary">
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={() => setUnionRulesOpen(false)} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              Union Rules Configuration
            </Typography>
            <Button color="inherit" onClick={() => setUnionRulesOpen(false)}>
              Close
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3, pb: 6, display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
          <Box sx={{ width: '100%', maxWidth: 1100 }}>
            <UnionRulesConfiguration />
          </Box>
        </Box>
      </Dialog>
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

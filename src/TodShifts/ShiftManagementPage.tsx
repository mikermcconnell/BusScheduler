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
  IconButton,
  Chip,
  Stack,
  TextField,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import MasterScheduleImport from './MasterScheduleImport';
import ShiftGanttChart from './ShiftGanttChart';
import ShiftSummaryTable from './ShiftSummaryTable';
import ShiftExport from './ShiftExport';
import ShiftOptimizationView from './ShiftOptimizationView';
import OptimizeShiftsPanel from './OptimizeShiftsPanel';
import ManualShiftAdjustmentsPage from './ManualShiftAdjustmentsPage';
import UnionRulesConfiguration from './UnionRulesConfiguration';
import CloseIcon from '@mui/icons-material/Close';
import {
  loadUnionRules,
  fetchLatestTodShiftRun,
  optimizeShifts,
  saveDraft,
  loadTodDraftLibrary,
  loadDraftById,
  revertToSourceFiles,
  setDraftName
} from './store/shiftManagementSlice';
import { DAY_TYPES } from './utils/timeUtils';

const TAB_LABELS = [
  'Import & Setup',
  'Configure Shifts',
  'Schedule View',
  'Shift Optimization',
  'Manual Adjustments',
  'Summary & Export'
];

const DISABLED_TAB_INDEXES = new Set([1, 2, 3]);
const EMPHASIZED_TAB_INDEXES = new Set([0, 4, 5]);

const ShiftManagementPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [unionRulesOpen, setUnionRulesOpen] = useState(false);
  const [errorSnack, setErrorSnack] = useState<string | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftNameInput, setDraftNameInput] = useState('');
  
  const {
    shifts,
    coverageTimeline,
    loading,
    error,
    importMetadata,
    lastOptimizationReport,
    draftDirty,
    autosave,
    drafts
  } = useSelector((state: RootState) => state.shiftManagement);

  useEffect(() => {
    dispatch(fetchLatestTodShiftRun());
    // Load union rules on component mount
    dispatch(loadUnionRules());
  }, [dispatch]);

  useEffect(() => {
    if (!autosave.enabled || !draftDirty || shifts.length === 0 || loading.persistence || autosave.inFlight) {
      return;
    }
    const timer = window.setInterval(() => {
      dispatch(saveDraft({ autosave: true }));
    }, autosave.intervalMs);
    return () => window.clearInterval(timer);
  }, [dispatch, autosave.enabled, autosave.intervalMs, draftDirty, shifts.length, loading.persistence, autosave.inFlight]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draftDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftDirty]);

  useEffect(() => {
    const latestError = error.persistence || error.imports || error.drafts;
    if (latestError) {
      setErrorSnack(latestError);
    }
  }, [error.persistence, error.imports, error.drafts]);

  useEffect(() => {
    setDraftNameInput(importMetadata.draftName ?? '');
  }, [importMetadata.draftName]);

  useEffect(() => {
    const current = importMetadata.draftName ?? '';
    if (draftNameInput === current) {
      return;
    }
    const timeout = window.setTimeout(() => {
      dispatch(setDraftName(draftNameInput));
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [dispatch, draftNameInput, importMetadata.draftName]);

  const safeSetActiveTab = (index: number) => {
    if (DISABLED_TAB_INDEXES.has(index)) {
      return;
    }
    setActiveTab(index);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    safeSetActiveTab(newValue);
  };

  const showSuccessNotification = (message: string) => {
    setSuccessMessage(message);
    setShowSuccess(true);
  };

  const handleManualSave = async () => {
    try {
      await dispatch(saveDraft()).unwrap();
      showSuccessNotification('Draft saved successfully.');
    } catch (err) {
      // errors surface via global alert state
    }
  };

  const handleOpenDraftDialog = () => {
    setDraftDialogOpen(true);
  };

  useEffect(() => {
    if (draftDialogOpen) {
      dispatch(loadTodDraftLibrary());
    }
  }, [draftDialogOpen, dispatch]);

  const handleCloseDraftDialog = () => setDraftDialogOpen(false);

  const handleLoadDraftSelection = async (runId: string) => {
    if (draftDirty && !window.confirm('You have unsaved changes. Loading another draft will discard them. Continue?')) {
      return;
    }
    try {
      await dispatch(loadDraftById({ runId })).unwrap();
      setDraftDialogOpen(false);
      showSuccessNotification('Draft loaded.');
    } catch (err) {
      // slice exposes error
    }
  };

  const handleRevertToSource = async () => {
    if (!window.confirm('Revert to the originally uploaded files? Unsaved changes will be lost.')) {
      return;
    }
    try {
      await dispatch(revertToSourceFiles()).unwrap();
      showSuccessNotification('Draft reset to source files. Save to keep the change.');
    } catch (err) {
      // handled globally
    }
  };

  const handleDraftNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraftNameInput(event.target.value);
  };

  // Calculate compliance statistics
  const complianceStats = {
    total: shifts.length,
    compliant: shifts.filter((shift) => shift.unionCompliant).length,
    warnings: shifts.filter((shift) => (shift.complianceWarnings?.length ?? 0) > 0).length
  };

  const coverageStats = DAY_TYPES.reduce(
    (acc, dayType) => {
      const intervals = coverageTimeline[dayType] ?? [];
      intervals.forEach((slot) => {
        if (slot.totalExcess < 0) acc.gaps += 1;
        else if (slot.totalExcess > 0) acc.excess += 1;
      });
      return acc;
    },
    { gaps: 0, excess: 0 }
  );

  const shiftCountsByDay = DAY_TYPES.map((dayType) => ({
    dayType,
    count: shifts.filter((shift) => shift.scheduleType === dayType).length
  }));

  const draftNameValue = draftNameInput;
  const draftNameDisplay = (draftNameValue || importMetadata.draftName || '').trim() || 'Untitled Draft';
  const saveDisabled = !draftDirty || shifts.length === 0 || loading.persistence || loading.shifts;
  const revertDisabled = !importMetadata.sourceFiles || loading.imports;
  const loadableDrafts = drafts.items.filter((draft) => Boolean(draft.hasUserSave));

  const loadDraftDisabled = loading.fetchRun || loading.drafts || drafts.loading;
  const lastSavedLabel = importMetadata.lastSavedAt
    ? `Last saved: ${new Date(importMetadata.lastSavedAt).toLocaleString()}`
    : 'Not saved yet';
  const lastAutosaveLabel = importMetadata.lastAutosavedAt
    ? `Last autosave: ${new Date(importMetadata.lastAutosavedAt).toLocaleTimeString()}`
    : null;

  const canOptimize = Boolean(importMetadata.importedAt && importMetadata.cityFileName);
  const isOptimizing = loading.optimization;
  const optimizationError = error.optimization;
  const optimizationDisabledReason = canOptimize
    ? undefined
    : 'Import the master schedule before building shifts.';

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
              md: 6
            }}>
            <Typography variant="h5" gutterBottom>
              Shift Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure and manage driver shifts with union compliance
            </Typography>
            <TextField
              label="Draft name"
              value={draftNameValue}
              onChange={handleDraftNameChange}
              size="small"
              sx={{ mt: 2, maxWidth: 320 }}
            />
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
              md: 6
            }}>
            <Box display="flex" justifyContent="flex-end" flexWrap="wrap" gap={3}>
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
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end" sx={{ mt: 1 }}>
              {shiftCountsByDay.map(({ dayType, count }) => (
                <Chip key={dayType} label={`${dayType.charAt(0).toUpperCase()}${dayType.slice(1)}: ${count}`} size="small" />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" sx={{ mt: 2 }}>
              <Button variant="outlined" size="small" onClick={handleOpenDraftDialog} disabled={loadDraftDisabled}>
                Load draft
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleRevertToSource}
                disabled={revertDisabled}
              >
                Revert to source
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleManualSave}
                disabled={saveDisabled}
              >
                {loading.persistence ? 'Saving…' : 'Save draft'}
              </Button>
            </Stack>
            <Box textAlign="right" mt={1}>
              <Chip
                size="small"
                color={draftDirty ? 'warning' : 'success'}
                label={draftDirty ? 'Unsaved changes' : 'All changes saved'}
                sx={{ mr: 1, mb: 0.5 }}
              />
              <Typography variant="caption" display="block">
                {lastSavedLabel}
              </Typography>
              {lastAutosaveLabel && (
                <Typography variant="caption" display="block">
                  {lastAutosaveLabel}
                </Typography>
              )}
              {autosave.inFlight && (
                <Typography variant="caption" color="warning.main" display="block">
                  Autosaving…
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
      {/* Error Alert */}
      {(error.shifts || error.imports || error.unionRules || error.persistence || error.optimization || error.trimming || error.drafts) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error.shifts || error.imports || error.unionRules || error.persistence || error.optimization || error.trimming || error.drafts}
        </Alert>
      )}
      {/* Main Content Area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {TAB_LABELS.map((label, index) => (
            <Tab
              key={label}
              label={label}
              disabled={DISABLED_TAB_INDEXES.has(index)}
              disableRipple
              sx={{
                fontWeight: EMPHASIZED_TAB_INDEXES.has(index) ? 600 : 400,
                color: DISABLED_TAB_INDEXES.has(index)
                  ? (theme) => theme.palette.text.disabled
                  : EMPHASIZED_TAB_INDEXES.has(index)
                    ? 'text.primary'
                    : 'text.secondary',
                opacity: DISABLED_TAB_INDEXES.has(index) ? 0.65 : 1
              }}
            />
          ))}
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
                    safeSetActiveTab(0);
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
                  xs: 12
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
            <ManualShiftAdjustmentsPage
              onSaveDraft={handleManualSave}
              saveDisabled={saveDisabled}
              saving={loading.persistence}
              lastSavedLabel={lastSavedLabel}
              autosaveLabel={lastAutosaveLabel}
              autosaving={autosave.inFlight}
            />
          )}

          {activeTab === 5 && (
            <Grid container spacing={3}>
              <Grid size={12}>
                <ShiftExport />
              </Grid>
              <Grid size={12}>
                <ShiftSummaryTable />
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
      <Dialog open={draftDialogOpen} onClose={handleCloseDraftDialog} fullWidth maxWidth="md">
        <DialogTitle>Load TOD Draft</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick a saved draft schedule to continue editing. Loading another draft will replace your current workspace.
          </Typography>
          {drafts.loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={32} />
            </Box>
          ) : loadableDrafts.length === 0 ? (
            <Alert severity="info">No drafts found yet. Save a draft to see it here.</Alert>
          ) : (
            <List>
              {loadableDrafts.map((draft) => {
                const isCurrent = draft.id === importMetadata.runId;
                const secondaryParts = [
                  `Updated ${new Date(draft.lastSavedAt ?? draft.importedAt).toLocaleString()}`,
                  draft.status ? draft.status.charAt(0).toUpperCase() + draft.status.slice(1) : 'Draft'
                ];
                return (
                  <ListItemButton
                    key={draft.id}
                    disabled={isCurrent}
                    onClick={() => handleLoadDraftSelection(draft.id)}
                  >
                    <ListItemText
                      primary={draft.draftName ?? `${draft.cityFileName} + ${draft.contractorFileName}`}
                      secondary={secondaryParts.join(' · ')}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
          {drafts.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {drafts.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDraftDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Success Notification */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        message={successMessage}
      />
      <Snackbar
        open={Boolean(errorSnack)}
        autoHideDuration={4000}
        onClose={() => setErrorSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorSnack(null)} sx={{ width: '100%' }}>
          {errorSnack}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShiftManagementPage;

import React, { useMemo, useState } from 'react';
import {
  Paper,
  Stack,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { OptimizationReport } from './types/optimization.types';

interface OptimizeShiftsPanelProps {
  canOptimize: boolean;
  isOptimizing: boolean;
  optimizeError?: string | null;
  onOptimize: () => void;
  disabledReason?: string;
  lastReport?: OptimizationReport | null;
}

/**
 * Presents guarded access to the automatic shift optimization flow.
 * Provides a confirmation warning because the operation replaces all current shifts.
 */
const OptimizeShiftsPanel: React.FC<OptimizeShiftsPanelProps> = ({
  canOptimize,
  isOptimizing,
  optimizeError,
  onOptimize,
  disabledReason,
  lastReport
}) => {
  const [showDialog, setShowDialog] = useState(false);

  const buttonDisabled = useMemo(() => !canOptimize || isOptimizing, [canOptimize, isOptimizing]);

  const handleLaunch = () => {
    if (buttonDisabled) {
      return;
    }
    setShowDialog(true);
  };

  const handleConfirm = () => {
    setShowDialog(false);
    onOptimize();
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Optimize Shifts</Typography>
        <Typography variant="body2" color="text.secondary">
          Automatically generate weekday, Saturday, and Sunday TOD shifts based on the latest master schedule.
          Existing shifts will be replaced during optimization.
        </Typography>

        {!canOptimize && disabledReason && (
          <Alert severity="info" icon={<WarningAmberIcon fontSize="small" />}>
            {disabledReason}
          </Alert>
        )}

        {optimizeError && (
          <Alert severity="error">
            {optimizeError}
          </Alert>
        )}

        {lastReport && !isOptimizing && (
          <Alert severity={lastReport.deficitIntervals > 0 ? 'warning' : 'success'}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">
                Optimization completed {new Date(lastReport.generatedAt).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                {lastReport.compliantShifts}/{lastReport.totalShifts} shifts union compliant;
                {` ${lastReport.warningShifts}`} shift{lastReport.warningShifts === 1 ? '' : 's'} with warnings.
              </Typography>
              <Typography variant="body2">
                Remaining deficit intervals: {lastReport.deficitIntervals}
                {lastReport.deficitIntervals > 0 &&
                  ` (Weekday ${lastReport.deficitByDayType.weekday}, Saturday ${lastReport.deficitByDayType.saturday}, Sunday ${lastReport.deficitByDayType.sunday})`}
                .
              </Typography>
              {lastReport.warnings.length > 0 && (
                <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                  <Typography variant="body2">Representative warnings:</Typography>
                  <Stack component="ul" spacing={0.25} sx={{ pl: 2, m: 0 }}>
                    {lastReport.warnings.slice(0, 3).map((warning) => (
                      <Typography key={warning} component="li" variant="body2">
                        {warning}
                      </Typography>
                    ))}
                    {lastReport.warnings.length > 3 && (
                      <Typography component="li" variant="body2">
                        …and {lastReport.warnings.length - 3} more warning{lastReport.warnings.length - 3 === 1 ? '' : 's'}.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Alert>
        )}

        <Button
          variant="contained"
          color="warning"
          onClick={handleLaunch}
          disabled={buttonDisabled}
        >
          {isOptimizing ? 'Optimizing…' : 'Optimize Shifts'}
        </Button>

        <Typography variant="caption" color="text.secondary">
          Contractor shift imports remain available after optimization if you need vendor comparisons.
        </Typography>
      </Stack>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          Confirm Optimization
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            Optimization replaces all current shifts with an auto-generated schedule. A historical copy is kept,
            but any unsaved manual edits will be removed. Proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirm} color="warning" variant="contained">
            Optimize &amp; Replace
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default OptimizeShiftsPanel;

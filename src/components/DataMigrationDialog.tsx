/**
 * Data Migration Dialog
 * User-friendly interface for migrating localStorage data to Firebase
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  FormControlLabel,
  Switch,
  Divider
} from '@mui/material';

// Icons
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BackupIcon from '@mui/icons-material/Backup';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VerifiedIcon from '@mui/icons-material/Verified';

import {
  checkForLocalStorageData,
  migrateToFirebase,
  createLocalStorageBackup,
  downloadBackup,
  clearLocalStorageData,
  estimateMigrationTime,
  verifyMigration,
  MigrationResult
} from '../utils/localStorageMigration';

interface DataMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  onMigrationComplete?: (result: MigrationResult) => void;
}

const DataMigrationDialog: React.FC<DataMigrationDialogProps> = ({
  open,
  onClose,
  onMigrationComplete
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localStorageData, setLocalStorageData] = useState({ hasData: false, scheduleCount: 0, draftCount: 0 });
  const [migrationTime, setMigrationTime] = useState({ estimatedMinutes: 0, itemCount: 0, details: '' });
  const [skipExisting, setSkipExisting] = useState(true);
  const [backupCreated, setBackupCreated] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);

  // Check for localStorage data when dialog opens
  useEffect(() => {
    if (open) {
      const data = checkForLocalStorageData();
      setLocalStorageData(data);
      
      const time = estimateMigrationTime();
      setMigrationTime(time);
      
      // Reset state
      setActiveStep(0);
      setMigrationResult(null);
      setBackupCreated(false);
      setConfirmClearData(false);
    }
  }, [open]);

  const handleCreateBackup = () => {
    setIsLoading(true);
    try {
      downloadBackup();
      setBackupCreated(true);
      setActiveStep(1);
    } catch (error) {
      console.error('Backup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMigration = async () => {
    setIsLoading(true);
    try {
      const result = await migrateToFirebase({ skipExisting });
      setMigrationResult(result);
      
      if (result.success) {
        setActiveStep(2);
        if (onMigrationComplete) {
          onMigrationComplete(result);
        }
      }
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationResult({
        success: false,
        error: `Migration failed: ${error}`,
        migrated: { schedules: 0, drafts: 0 },
        failed: { schedules: 0, drafts: 0 },
        details: [`Critical error: ${error}`]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLocalStorage = () => {
    setIsLoading(true);
    try {
      const result = clearLocalStorageData({ confirmedByUser: confirmClearData });
      if (result.success) {
        setActiveStep(3);
      }
    } catch (error) {
      console.error('Clear localStorage failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const steps = [
    {
      label: 'Create Backup',
      description: 'Download a backup of your current data'
    },
    {
      label: 'Migrate Data',
      description: 'Transfer data to Firebase cloud storage'
    },
    {
      label: 'Verify Migration',
      description: 'Confirm all data was migrated successfully'
    },
    {
      label: 'Cleanup (Optional)',
      description: 'Remove old localStorage data'
    }
  ];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={isLoading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudUploadIcon color="primary" />
          <Typography variant="h6">Migrate to Firebase Cloud Storage</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!localStorageData.hasData ? (
          <Alert severity="info">
            No local data found to migrate. Your schedules are either already in Firebase or you haven't created any yet.
          </Alert>
        ) : (
          <>
            {/* Data Summary */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>Current Local Data</Typography>
              <Box display="flex" gap={1} mb={2}>
                <Chip 
                  label={`${localStorageData.scheduleCount} Schedules`} 
                  color="primary" 
                  variant="outlined" 
                />
                <Chip 
                  label={`${localStorageData.draftCount} Drafts`} 
                  color="secondary" 
                  variant="outlined" 
                />
              </Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                {migrationTime.details}
              </Alert>
            </Box>

            {/* Migration Stepper */}
            <Stepper activeStep={activeStep} orientation="vertical">
              {/* Step 1: Create Backup */}
              <Step>
                <StepLabel>Create Backup</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Download a backup of your current data before migration. This ensures you can restore your data if anything goes wrong.
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<BackupIcon />}
                      onClick={handleCreateBackup}
                      disabled={isLoading || backupCreated}
                    >
                      {backupCreated ? 'Backup Created' : 'Download Backup'}
                    </Button>
                    
                    {backupCreated && (
                      <Box sx={{ mt: 1 }}>
                        <Alert severity="success" icon={<CheckCircleIcon />}>
                          Backup file downloaded successfully!
                        </Alert>
                      </Box>
                    )}
                  </Box>
                </StepContent>
              </Step>

              {/* Step 2: Migrate Data */}
              <Step>
                <StepLabel>Migrate Data</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Transfer your local data to Firebase cloud storage. This process may take a few minutes.
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={skipExisting}
                        onChange={(e) => setSkipExisting(e.target.checked)}
                        disabled={isLoading}
                      />
                    }
                    label="Skip items that already exist in Firebase"
                    sx={{ mb: 2 }}
                  />

                  {isLoading && activeStep === 1 && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Migrating data... Please wait.
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<CloudUploadIcon />}
                      onClick={handleStartMigration}
                      disabled={isLoading || !backupCreated}
                    >
                      Start Migration
                    </Button>
                  </Box>

                  {migrationResult && (
                    <Box sx={{ mt: 2 }}>
                      <Alert 
                        severity={migrationResult.success ? 'success' : 'error'}
                        icon={migrationResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                      >
                        {migrationResult.success 
                          ? `Migration completed! ${migrationResult.migrated.schedules + migrationResult.migrated.drafts} items migrated.`
                          : `Migration failed: ${migrationResult.error}`
                        }
                      </Alert>
                      
                      {migrationResult.details.length > 0 && (
                        <Box sx={{ mt: 1, maxHeight: 200, overflowY: 'auto' }}>
                          <Typography variant="caption" color="text.secondary">
                            Migration Details:
                          </Typography>
                          {migrationResult.details.map((detail, index) => (
                            <Typography key={index} variant="body2" sx={{ fontSize: '0.8rem', ml: 1 }}>
                              {detail}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </StepContent>
              </Step>

              {/* Step 3: Verify Migration */}
              <Step>
                <StepLabel>Verify Migration</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Your data has been successfully migrated to Firebase! You can now access your schedules from any device.
                  </Typography>
                  
                  <Alert severity="success" icon={<VerifiedIcon />} sx={{ mt: 2 }}>
                    Migration completed successfully. Your data is now safely stored in Firebase Cloud Storage.
                  </Alert>
                </StepContent>
              </Step>

              {/* Step 4: Cleanup */}
              <Step>
                <StepLabel>Cleanup (Optional)</StepLabel>
                <StepContent>
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Optional:</strong> You can remove the local data since it's now safely stored in Firebase. 
                      This will free up browser storage space.
                    </Typography>
                  </Alert>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={confirmClearData}
                        onChange={(e) => setConfirmClearData(e.target.checked)}
                        disabled={isLoading}
                      />
                    }
                    label="I confirm I want to delete local data"
                    sx={{ mb: 2 }}
                  />

                  <Box>
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<DeleteForeverIcon />}
                      onClick={handleClearLocalStorage}
                      disabled={isLoading || !confirmClearData}
                    >
                      Clear Local Data
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {activeStep >= 2 ? 'Done' : 'Cancel'}
        </Button>
        
        {activeStep < 2 && !localStorageData.hasData && (
          <Button variant="contained" onClick={handleClose}>
            Continue with Firebase
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DataMigrationDialog;
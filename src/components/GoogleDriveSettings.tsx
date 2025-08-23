/**
 * Google Drive Settings Component
 * Provides UI for managing Google Drive backup and sync functionality
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid
} from '@mui/material';
import {
  CloudSync,
  CloudUpload,
  CloudDownload,
  Info,
  Warning,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { scheduleStorage } from '../services/scheduleStorage';
import { useAuth } from '../contexts/AuthContext';

interface BackupInfo {
  schedules?: { lastModified: string; size: string };
  drafts?: { lastModified: string; size: string };
}

export const GoogleDriveSettings: React.FC = () => {
  const { user } = useAuth();
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  
  // Check if we're in bypass mode
  const bypassAuth = process.env.REACT_APP_BYPASS_AUTH === 'true';
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreOptions, setRestoreOptions] = useState({
    restoreSchedules: true,
    restoreDrafts: true,
    mergeWithExisting: false
  });

  useEffect(() => {
    checkSyncStatus();
  }, []);

  const checkSyncStatus = async () => {
    try {
      const enabled = scheduleStorage.isGoogleDriveSyncEnabled();
      setIsSyncEnabled(enabled);
      
      if (enabled) {
        await loadBackupInfo();
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  };

  const loadBackupInfo = async () => {
    try {
      const result = await scheduleStorage.getGoogleDriveBackupInfo();
      if (result.success && result.info) {
        setBackupInfo(result.info);
      }
    } catch (error) {
      console.error('Error loading backup info:', error);
    }
  };

  const handleToggleSync = async () => {
    if (isSyncEnabled) {
      // Disable sync
      setIsLoading(true);
      try {
        await scheduleStorage.disableGoogleDriveSync();
        setIsSyncEnabled(false);
        setBackupInfo(null);
        setMessage({ type: 'info', text: 'Google Drive sync disabled' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to disable Google Drive sync' });
      }
      setIsLoading(false);
    } else {
      // Enable sync
      setIsLoading(true);
      try {
        const result = await scheduleStorage.enableGoogleDriveSync();
        if (result.success) {
          setIsSyncEnabled(true);
          setMessage({ type: 'success', text: 'Google Drive sync enabled successfully!' });
          await loadBackupInfo();
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to enable Google Drive sync' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to enable Google Drive sync' });
      }
      setIsLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setIsLoading(true);
    try {
      const result = await scheduleStorage.backupToGoogleDrive();
      if (result.success) {
        setMessage({ type: 'success', text: 'Manual backup completed successfully!' });
        await loadBackupInfo();
      } else {
        setMessage({ type: 'error', text: result.error || 'Manual backup failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Manual backup failed' });
    }
    setIsLoading(false);
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const result = await scheduleStorage.restoreFromGoogleDrive(restoreOptions);
      if (result.success && result.restored) {
        const { schedules, drafts } = result.restored;
        setMessage({ 
          type: 'success', 
          text: `Restored ${schedules} schedules and ${drafts} drafts from Google Drive!` 
        });
        setShowRestoreDialog(false);
      } else {
        setMessage({ type: 'error', text: result.error || 'Restore failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Restore failed' });
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (sizeString: string) => {
    const size = parseInt(sizeString);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <CloudSync sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h2">
            Google Drive Backup & Sync
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Automatically backup your schedules and drafts to Google Drive. 
          Your data will be stored in a private folder and synced across devices.
        </Typography>

        {message && (
          <Alert 
            severity={message.type} 
            sx={{ mb: 2 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        {/* Development Bypass Notice */}
        {bypassAuth && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Development Mode:</strong> Authentication is bypassed. 
              Google Drive sync is temporarily disabled while Google Console 
              updates your authorized origins (can take a few hours).
            </Typography>
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Sync Toggle */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={isSyncEnabled}
                  onChange={handleToggleSync}
                  disabled={isLoading || bypassAuth}
                />
              }
              label={
                <Box display="flex" alignItems="center">
                  <Typography>Enable Google Drive Sync</Typography>
                  {isLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </Box>
              }
            />
          </Box>

          {/* Backup Status */}
          {isSyncEnabled && backupInfo && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Backup Status
                </Typography>
                <Grid container spacing={2}>
                  {backupInfo.schedules && (
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <CheckCircle color="success" sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2" fontWeight="medium">
                          Schedules
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Last backup: {formatDate(backupInfo.schedules.lastModified)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Size: {formatFileSize(backupInfo.schedules.size)}
                      </Typography>
                    </Grid>
                  )}
                  {backupInfo.drafts && (
                    <Grid
                      size={{
                        xs: 12,
                        sm: 6
                      }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <CheckCircle color="success" sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2" fontWeight="medium">
                          Drafts
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Last backup: {formatDate(backupInfo.drafts.lastModified)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Size: {formatFileSize(backupInfo.drafts.size)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {isSyncEnabled && !bypassAuth && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={handleManualBackup}
                disabled={isLoading}
              >
                Manual Backup
              </Button>
              <Button
                variant="outlined"
                startIcon={<CloudDownload />}
                onClick={() => setShowRestoreDialog(true)}
                disabled={isLoading}
              >
                Restore from Backup
              </Button>
            </Stack>
          )}

          {/* Setup Instructions */}
          {!isSyncEnabled && (
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                <strong>Setup Required:</strong> To use Google Drive sync, you need to:
              </Typography>
              <Box component="ol" sx={{ mt: 1, pl: 2 }}>
                <li>Go to Google Cloud Console</li>
                <li>Enable Google Drive API</li>
                <li>Create OAuth 2.0 credentials</li>
                <li>Add environment variables to your .env file</li>
              </Box>
            </Alert>
          )}
        </Stack>

        {/* Restore Dialog */}
        <Dialog 
          open={showRestoreDialog} 
          onClose={() => setShowRestoreDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Restore from Google Drive</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Choose what to restore and how to handle existing data:
            </Typography>
            
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={restoreOptions.restoreSchedules}
                    onChange={(e) => setRestoreOptions(prev => ({ 
                      ...prev, 
                      restoreSchedules: e.target.checked 
                    }))}
                  />
                }
                label="Restore Schedules"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={restoreOptions.restoreDrafts}
                    onChange={(e) => setRestoreOptions(prev => ({ 
                      ...prev, 
                      restoreDrafts: e.target.checked 
                    }))}
                  />
                }
                label="Restore Drafts"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={restoreOptions.mergeWithExisting}
                    onChange={(e) => setRestoreOptions(prev => ({ 
                      ...prev, 
                      mergeWithExisting: e.target.checked 
                    }))}
                  />
                }
                label="Merge with existing data (instead of replacing)"
              />
            </Stack>

            {!restoreOptions.mergeWithExisting && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This will replace all existing data with the backup. Make sure you have a backup of your current data.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRestoreDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRestore} 
              variant="contained"
              disabled={isLoading || (!restoreOptions.restoreSchedules && !restoreOptions.restoreDrafts)}
            >
              {isLoading ? <CircularProgress size={20} /> : 'Restore'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default GoogleDriveSettings;
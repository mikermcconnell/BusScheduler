/**
 * Settings Page
 * Provides app-wide settings including Google Drive backup configuration
 */

import React from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import Layout from '../components/Layout';
import GoogleDriveSettings from '../components/GoogleDriveSettings';

const Settings: React.FC = () => {
  return (
    <Box sx={{ pr: 3, width: '100%' }}>
      <Box mb={4}>
        <Box display="flex" alignItems="center" mb={2}>
          <SettingsIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Settings
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Configure application settings, backup preferences, and data storage options.
        </Typography>
      </Box>
      <Grid container spacing={3}>
        {/* Google Drive Settings */}
        <Grid size={12}>
          <GoogleDriveSettings />
        </Grid>

        {/* Future Settings Sections */}
        <Grid
          size={{
            xs: 12,
            md: 6
          }}>
          <Paper sx={{ p: 3, opacity: 0.6 }}>
            <Typography variant="h6" gutterBottom>
              Export Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure default export formats and preferences.
              (Coming Soon)
            </Typography>
          </Paper>
        </Grid>

        <Grid
          size={{
            xs: 12,
            md: 6
          }}>
          <Paper sx={{ p: 3, opacity: 0.6 }}>
            <Typography variant="h6" gutterBottom>
              Notification Preferences  
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage alerts and notification settings for schedule updates.
              (Coming Soon)
            </Typography>
          </Paper>
        </Grid>

        <Grid size={12}>
          <Paper sx={{ p: 3, opacity: 0.6 }}>
            <Typography variant="h6" gutterBottom>
              Data Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Import/export all data, clear storage, and manage data retention policies.
              (Coming Soon)
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
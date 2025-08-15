import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { loadMasterSchedule } from './store/shiftManagementSlice';
// Simple file upload component for TodShifts

const MasterScheduleImport: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await dispatch(loadMasterSchedule(file)).unwrap();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import master schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Import Master Schedule
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Upload a CSV file containing the master schedule requirements for bus coverage.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Master schedule imported successfully!
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file);
            }
          }}
          disabled={loading}
          style={{ marginBottom: 16 }}
        />
        <Typography variant="caption" display="block" color="text.secondary">
          Upload a CSV file (max 5MB)
        </Typography>
      </Box>

      {loading && (
        <Box display="flex" alignItems="center" gap={2}>
          <CircularProgress size={20} />
          <Typography variant="body2">Importing master schedule...</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default MasterScheduleImport;
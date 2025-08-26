import React from 'react';
import {
  Typography,
  Alert,
  Box,
  Chip
} from '@mui/material';
import { Construction, AccessTime } from '@mui/icons-material';

const TodShifts: React.FC = () => {
  return (
    <Box sx={{ py: 3, pr: 3, width: '100%' }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Construction color="warning" />
        <Typography variant="h4">
          Tod Shifts Management
        </Typography>
        <Chip 
          label="Pending Feature" 
          color="warning" 
          icon={<AccessTime />}
        />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Feature Under Development
        </Typography>
        <Typography variant="body1" paragraph>
          The Tod Shifts management system is currently being developed. This feature will provide:
        </Typography>
        <Box component="ul" sx={{ pl: 2, mb: 0 }}>
          <li>Master schedule import and management</li>
          <li>Union rules configuration and compliance checking</li>
          <li>Manual shift creation with validation</li>
          <li>Visual shift timeline (Gantt chart)</li>
          <li>Shift summary tables and analytics</li>
          <li>Export capabilities (CSV, Excel, Reports)</li>
        </Box>
      </Alert>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body1">
          <strong>Development Status:</strong> All backend components and data models have been created. 
          The user interface is in development and will be available in a future release.
        </Typography>
      </Alert>

      <Typography variant="body2" color="text.secondary">
        This page serves as a placeholder for the upcoming Tod Shifts functionality. 
        Check back for updates or contact the development team for more information about the release timeline.
      </Typography>
    </Box>
  );
};

export default TodShifts;
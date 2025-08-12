import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
} from '@mui/material';

const GenerateSummarySchedule: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Summary Schedule
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1">
            This page will contain functionality to generate summary schedules.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GenerateSummarySchedule;
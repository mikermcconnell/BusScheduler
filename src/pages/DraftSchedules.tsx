import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Typography, Box, Card, CardContent, Button } from '@mui/material';
import { Drafts as DraftIcon, Upload as UploadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import DraftScheduleList from '../components/DraftScheduleList';
import TimePoints from './TimePoints';
import NotFound from './NotFound';
import { DraftSchedule } from '../services/scheduleStorage';

const DraftSchedulesMain: React.FC = () => {
  const navigate = useNavigate();

  const handleRestoreDraft = (draft: DraftSchedule) => {
    // Navigate back to upload page with the draft
    navigate('/upload');
    // The upload page will handle restoring the draft through its session recovery
  };

  const handleDraftDeleted = () => {
    // This will automatically refresh the draft list component
  };

  return (
    <Box sx={{ pr: 3, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Draft Schedules
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage your saved draft schedules and continue working on them
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/upload')}
          size="large"
        >
          New Upload
        </Button>
      </Box>

      <Card sx={{ width: '100%' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <DraftIcon color="primary" />
            <Typography variant="h6">
              Your Draft Schedules
            </Typography>
          </Box>
          
          <DraftScheduleList
            onRestoreDraft={handleRestoreDraft}
            onDraftDeleted={handleDraftDeleted}
            maxHeight={800}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

const DraftSchedules: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DraftSchedulesMain />} />
      <Route path="timepoints" element={<TimePoints />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default DraftSchedules;
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container, Box } from '@mui/material';
import Navigation from './Navigation';
import Dashboard from '../pages/Dashboard';
import UploadSchedule from '../pages/UploadSchedule';
import GenerateSchedules from '../pages/GenerateSchedules';
import GenerateSummarySchedule from '../pages/GenerateSummarySchedule';
import SummarySchedule from '../pages/SummarySchedule';
import EditCSVSchedule from '../pages/EditCSVSchedule';
import ViewSchedules from '../pages/ViewSchedules';
import ManageRoutes from '../pages/ManageRoutes';
import DraftSchedules from '../pages/DraftSchedules';
import TimePoints from '../pages/TimePoints';
import NotFound from '../pages/NotFound';

const Layout: React.FC = () => {
  return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Navigation />
        
        <Container
          maxWidth="xl"
          sx={{
            flexGrow: 1,
            py: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadSchedule />} />
            <Route path="/generate" element={<GenerateSchedules />} />
            <Route path="/generate-summary" element={<GenerateSummarySchedule />} />
            <Route path="/generate/edit/:scheduleId" element={<EditCSVSchedule />} />
            <Route path="/summary-schedule/:scheduleId" element={<SummarySchedule />} />
            <Route path="/timepoints" element={<TimePoints />} />
            <Route path="/schedules" element={<ViewSchedules />} />
            <Route path="/routes" element={<ManageRoutes />} />
            <Route path="/drafts/*" element={<DraftSchedules />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Container>

        <Box
          component="footer"
          sx={{
            py: 2,
            px: 3,
            backgroundColor: 'primary.main',
            color: 'white',
            textAlign: 'center',
            mt: 'auto',
          }}
        >
          <Container maxWidth="xl">
            Bus Route Scheduler © 2024 - Schedule Management System
          </Container>
        </Box>
      </Box>
  );
};

export default Layout;
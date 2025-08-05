import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container, Box } from '@mui/material';
import Navigation from './Navigation';
import Dashboard from '../pages/Dashboard';
import UploadSchedule from '../pages/UploadSchedule';
import ViewSchedules from '../pages/ViewSchedules';
import ManageRoutes from '../pages/ManageRoutes';
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
            <Route path="/schedules" element={<ViewSchedules />} />
            <Route path="/routes" element={<ManageRoutes />} />
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
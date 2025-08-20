import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { 
  Box, 
  CssBaseline, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton,
  useTheme,
  useMediaQuery,
  Fab,
  Tooltip,
  Container
} from '@mui/material';
import {
  Menu as MenuIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material';
import SidebarNavigation from './SidebarNavigation';
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import UserProfile from './UserProfile';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

// Pages
import Dashboard from '../pages/Dashboard';
import UploadSchedule from '../pages/UploadSchedule';
import GenerateSummarySchedule from '../pages/GenerateSummarySchedule';
import SummarySchedule from '../pages/SummarySchedule';
import EditCSVSchedule from '../pages/EditCSVSchedule';
import ViewSchedules from '../pages/ViewSchedules';
import ManageRoutes from '../pages/ManageRoutes';
import DraftSchedules from '../pages/DraftSchedules';
import TimePoints from '../pages/TimePoints';
import BlockConfiguration from '../pages/BlockConfiguration';
import BlockSummarySchedule from '../pages/BlockSummarySchedule';
import TodShifts from '../pages/TodShifts';
import Settings from '../pages/Settings';
import NotFound from '../pages/NotFound';

const DRAWER_WIDTH = 280;
const COLLAPSED_WIDTH = 72;

const Layout: React.FC = () => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Keyboard shortcuts
  const { helpVisible, setHelpVisible } = useKeyboardShortcuts({
    enabled: true,
    showHelp: true
  });

  const handleSidebarToggle = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  // Determine if we should show workflow breadcrumbs
  const shouldShowWorkflow = [
    '/upload',
    '/drafts', 
    '/timepoints',
    '/block-configuration',
    '/block-summary-schedule',
    '/routes',
    '/tod-shifts'
  ].some(path => location.pathname.startsWith(path));

  // Hide breadcrumbs on dashboard and simple pages
  const shouldShowBreadcrumbs = location.pathname !== '/' && location.pathname !== '/settings';

  const currentSidebarWidth = isMobile ? 0 : (sidebarCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      
      {/* Top App Bar - only visible on mobile or when sidebar is collapsed */}
      {(isMobile || sidebarCollapsed) && (
        <AppBar 
          position="fixed" 
          sx={{ 
            zIndex: theme.zIndex.drawer + 1,
            ml: isMobile ? 0 : `${currentSidebarWidth}px`,
            width: isMobile ? '100%' : `calc(100% - ${currentSidebarWidth}px)`
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="toggle sidebar"
              onClick={handleSidebarToggle}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Bus Route Scheduler
            </Typography>
            
            <UserProfile />
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar Navigation */}
      <SidebarNavigation
        open={sidebarOpen}
        onToggle={handleSidebarToggle}
      />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          ml: isMobile ? 0 : `${currentSidebarWidth}px`,
          mt: (isMobile || sidebarCollapsed) ? '64px' : 0, // Account for AppBar height
          transition: theme.transitions.create(['margin-left'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Content Container */}
        <Container 
          maxWidth="xl" 
          sx={{ 
            flexGrow: 1,
            py: 3,
            pb: 6, // Extra padding for FAB
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Workflow Breadcrumbs */}
          {shouldShowBreadcrumbs && (
            <>
              {location.pathname.includes('timepoints') && console.log('🔍 Layout Debug - TimePoints page:', {
                pathname: location.pathname,
                shouldShowBreadcrumbs,
                shouldShowWorkflow
              })}
              <WorkflowBreadcrumbs 
                showWorkflow={shouldShowWorkflow}
              />
            </>
          )}

          {/* Page Routes */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadSchedule />} />
            <Route path="/generate-summary" element={<GenerateSummarySchedule />} />
            <Route path="/generate/edit/:scheduleId" element={<EditCSVSchedule />} />
            <Route path="/summary-schedule/:scheduleId" element={<SummarySchedule />} />
            <Route path="/timepoints" element={<TimePoints />} />
            <Route path="/schedules" element={<ViewSchedules />} />
            <Route path="/routes" element={<ManageRoutes />} />
            <Route path="/drafts/*" element={<DraftSchedules />} />
            <Route path="/block-configuration" element={<BlockConfiguration />} />
            <Route path="/block-summary-schedule" element={<BlockSummarySchedule />} />
            <Route path="/tod-shifts" element={<TodShifts />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Container>

        {/* Footer */}
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
          Bus Route Scheduler © 2024 - Schedule Management System
        </Box>
      </Box>

      {/* Floating Action Button for Keyboard Shortcuts */}
      <Tooltip title="Keyboard Shortcuts (?)">
        <Fab
          color="primary"
          aria-label="keyboard shortcuts"
          onClick={() => setHelpVisible(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: theme.zIndex.speedDial,
            width: 48,
            height: 48
          }}
        >
          <KeyboardIcon />
        </Fab>
      </Tooltip>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp
        open={helpVisible}
        onClose={() => setHelpVisible(false)}
      />
    </Box>
  );
};

export default Layout;
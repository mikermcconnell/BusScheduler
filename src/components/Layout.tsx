import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
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
  CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Keyboard as KeyboardIcon,
  ChevronRight as ExpandIcon
} from '@mui/icons-material';
import SidebarNavigation from './SidebarNavigation';
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import AppHeader from './AppHeader';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { draftService } from '../services/draftService';
import { useAuth } from '../contexts/AuthContext';

// Pages
import Dashboard from '../pages/Dashboard';
import NewSchedule from '../pages/NewSchedule';
import EditSchedule from '../pages/EditSchedule';
import GenerateSummarySchedule from '../pages/GenerateSummarySchedule';
import SummarySchedule from '../pages/SummarySchedule';
import EditCSVSchedule from '../pages/EditCSVSchedule';
import ViewSchedules from '../pages/ViewSchedules';
import ManageRoutes from '../pages/ManageRoutes';
import TimePoints from '../pages/TimePoints';
import BlockConfiguration from '../pages/BlockConfiguration';
import BlockSummarySchedule from '../pages/BlockSummarySchedule';
import ConnectionOptimization from '../pages/ConnectionOptimization';
import VisualDashboard from '../pages/VisualDashboard';
import TodShifts from '../pages/TodShifts';
import DraftLibrary from '../pages/DraftLibrary';
import Settings from '../pages/Settings';
import NotFound from '../pages/NotFound';

const DRAWER_WIDTH = 280;
const COLLAPSED_WIDTH = 200; // Increased to show icons + labels

const Layout: React.FC = () => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, loading: authLoading, signOut: signOutUser } = useAuth();
  
  // Initialize sidebar state with persistence and auto-open behavior
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (isMobile) return false; // Mobile: closed by default
    return true; // Desktop: always open on startup
  });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : true; // Default to collapsed to save space
  });

  // Track active draft schedule for storyboard
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftName, setActiveDraftName] = useState<string | null>(null);
  
  // Handle responsive sidebar behavior
  React.useEffect(() => {
    setSidebarOpen(!isMobile); // Auto-open on desktop, close on mobile
  }, [isMobile]);

  // Persist collapsed state
  React.useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Track active draft from location state or localStorage
  React.useEffect(() => {
    // Check if location state has draft info
    const locationState = location.state as any;
    if (locationState?.draftId) {
      setActiveDraftId(locationState.draftId);
      setActiveDraftName(locationState.draftName || null);
    } else {
      // Try to get from localStorage
      const savedDraftId = draftService.getActiveDraft();
      if (savedDraftId) {
        const workflow = draftService.getWorkflow(savedDraftId);
        if (workflow) {
          setActiveDraftId(savedDraftId);
          setActiveDraftName(workflow.draftName);
        }
      } else {
        // Check if there's a current draft in general localStorage
        const currentSchedule = localStorage.getItem('currentSchedule');
        if (currentSchedule) {
          try {
            const schedule = JSON.parse(currentSchedule);
            if (schedule.id) {
              setActiveDraftId(schedule.id);
              setActiveDraftName(schedule.fileName || 'Current Draft');
            }
          } catch (e) {
            console.warn('Could not parse current schedule:', e);
          }
        }
      }
    }
  }, [location]);

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
    '/new-schedule',
    '/edit-schedule',
    '/upload',
    '/timepoints',
    '/block-configuration',
    '/block-summary-schedule',
    '/connection-optimization',
    '/visual-dashboard',
    '/routes',
    '/tod-shifts'
  ].some(path => location.pathname.startsWith(path));

  // Hide breadcrumbs on dashboard, draft library and simple pages
  const shouldShowBreadcrumbs = location.pathname !== '/' && location.pathname !== '/settings' && location.pathname !== '/draft-library';

  // Check if sidebar is actually collapsed from SidebarNavigation internal state
  const currentSidebarWidth = isMobile ? 0 : (sidebarCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH);

  if (authLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      
      {/* App Header with Logo - always visible */}
      <AppHeader
        showLogo={true}
        onMenuClick={handleSidebarToggle}
        userName={user?.displayName || user?.email || 'Account'}
        onSignOut={async () => {
          try {
            await signOutUser();
          } catch (error) {
            console.error('Failed to sign out:', error);
          }
        }}
      />

      {/* Sidebar Navigation */}
      <SidebarNavigation
        open={sidebarOpen}
        onToggle={handleSidebarToggle}
        collapsed={sidebarCollapsed}
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
          mt: '64px', // Always account for AppHeader height
        }}
      >
        {/* Content Container */}
        <Box
          sx={{ 
            flexGrow: 1,
            pl: 5, // Moderate left padding (20px) to create comfortable gap from sidebar
            pr: 2, // Small right padding for edge spacing
            py: 3,
            pb: 6, // Extra padding for FAB
            display: 'flex',
            flexDirection: 'column',
            width: '100%' // Ensure full width usage
          }}
        >
          {/* Workflow Progress - Storyboard or Breadcrumbs */}
          {shouldShowBreadcrumbs && (
            <>
              {/* Unified Navigation - Enhanced WorkflowBreadcrumbs for ALL workflows */}
              <WorkflowBreadcrumbs 
                showWorkflow={shouldShowWorkflow}
              />
            </>
          )}

          {/* Page Routes */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-schedule" element={<NewSchedule />} />
            <Route path="/edit-schedule" element={<EditSchedule />} />
            <Route path="/upload" element={<Navigate to="/new-schedule" replace />} />
            <Route path="/generate-summary" element={<GenerateSummarySchedule />} />
            <Route path="/generate/edit/:scheduleId" element={<EditCSVSchedule />} />
            <Route path="/summary-schedule/:scheduleId" element={<SummarySchedule />} />
            <Route path="/timepoints" element={<TimePoints />} />
            <Route path="/schedules" element={<ViewSchedules />} />
            <Route path="/routes" element={<ManageRoutes />} />
            <Route path="/draft-library" element={<DraftLibrary />} />
            <Route path="/block-configuration" element={<BlockConfiguration />} />
            <Route path="/block-summary-schedule" element={<BlockSummarySchedule />} />
            <Route path="/connection-optimization" element={<ConnectionOptimization />} />
            <Route path="/visual-dashboard" element={<VisualDashboard />} />
            <Route path="/tod-shifts" element={<TodShifts />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>

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
          Bus Schedule Builder © 2024 - Crafting Routes, Connecting Communities 🚌
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

      {/* Floating Action Button for Expanding Sidebar */}
      {sidebarCollapsed && !isMobile && (
        <Tooltip title="Expand Navigation">
          <Fab
            color="secondary"
            aria-label="expand navigation"
            onClick={() => setSidebarCollapsed(false)}
            sx={{
              position: 'fixed',
              bottom: 24,
              left: 24,
              zIndex: theme.zIndex.speedDial,
              width: 48,
              height: 48
            }}
          >
            <ExpandIcon />
          </Fab>
        </Tooltip>
      )}

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp
        open={helpVisible}
        onClose={() => setHelpVisible(false)}
      />
    </Box>
  );
};

export default Layout;

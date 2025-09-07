/**
 * Schedule Command Center
 * Main container for the unified workspace experience
 * Manages layout, panels, and overall command center coordination
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Drawer,
  useTheme,
  alpha,
  Fab,
  Tooltip,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Add as AddIcon,
  DashboardCustomize as DashboardIcon,
  Timeline as TimelineIcon,
  ViewModule as BlockIcon,
  Schedule as ScheduleIcon,
  LibraryBooks as LibraryIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import { useWorkspace, useWorkspaceState } from '../../contexts/WorkspaceContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { WorkspaceLayout } from './WorkspaceLayout';
import { PanelContainer } from './PanelContainer';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { WorkspaceStatusBar } from './WorkspaceStatusBar';
import { emit } from '../../services/workspaceEventBus';

/**
 * Available panel types and their configurations
 */
const PANEL_CONFIGS = {
  upload: {
    title: 'File Upload',
    icon: DashboardIcon,
    color: '#1976d2',
    shortcut: 'U'
  },
  timepoints: {
    title: 'TimePoints Analysis',
    icon: TimelineIcon,
    color: '#388e3c',
    shortcut: 'T'
  },
  blocks: {
    title: 'Block Configuration',
    icon: BlockIcon,
    color: '#f57c00',
    shortcut: 'B'
  },
  summary: {
    title: 'Summary Schedule',
    icon: ScheduleIcon,
    color: '#7b1fa2',
    shortcut: 'S'
  },
  library: {
    title: 'Draft Library',
    icon: LibraryIcon,
    color: '#5d4037',
    shortcut: 'L'
  },
  analytics: {
    title: 'Analytics',
    icon: AnalyticsIcon,
    color: '#c2185b',
    shortcut: 'A'
  }
} as const;

/**
 * Schedule Command Center Props
 */
interface ScheduleCommandCenterProps {
  /** Whether to show in fullscreen mode */
  fullscreen?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Schedule Command Center Component
 */
export const ScheduleCommandCenter: React.FC<ScheduleCommandCenterProps> = ({
  fullscreen = false,
  className
}) => {
  const theme = useTheme();
  const { 
    state, 
    openPanel, 
    toggleSidebar, 
    saveDraft, 
    refreshData,
    resetWorkspace 
  } = useWorkspace();
  const { isWorkspacePanels, isDraftLibrary } = useFeatureFlags();

  /**
   * Get available panel types based on feature flags
   */
  const availablePanels = useMemo(() => {
    let panels: Array<keyof typeof PANEL_CONFIGS> = ['upload', 'timepoints', 'blocks', 'summary'];
    
    if (isDraftLibrary) {
      panels = [...panels, 'library'];
    }
    
    if (isWorkspacePanels) {
      panels = [...panels, 'analytics'];
    }
    
    return panels;
  }, [isDraftLibrary, isWorkspacePanels]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd + key combinations
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            saveDraft();
            break;
          case 'r':
            if (event.shiftKey) {
              event.preventDefault();
              refreshData();
            }
            break;
          case '\\':
            event.preventDefault();
            toggleSidebar();
            break;
        }
      }
      
      // Alt + key for panel shortcuts
      if (event.altKey) {
        const panelShortcuts: Record<string, keyof typeof PANEL_CONFIGS> = {
          'u': 'upload',
          't': 'timepoints',
          'b': 'blocks',
          's': 'summary',
          'l': 'library',
          'a': 'analytics'
        };
        
        const panelType = panelShortcuts[event.key.toLowerCase()];
        if (panelType && availablePanels.includes(panelType as any)) {
          event.preventDefault();
          handleOpenPanel(panelType);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveDraft, refreshData, toggleSidebar, availablePanels]);

  /**
   * Handle opening panels
   */
  const handleOpenPanel = useCallback((type: keyof typeof PANEL_CONFIGS) => {
    const panelId = `${type}-${Date.now()}`;
    openPanel(panelId, type as any);
    
    emit({
      type: 'user-interaction',
      source: 'command-center',
      priority: 1,
      payload: {
        action: 'click',
        element: `open-${type}-panel`,
        elementType: 'button',
        metadata: { panelId, panelType: type }
      }
    });
  }, [openPanel]);

  /**
   * Handle workspace actions
   */
  const handleSave = useCallback(async () => {
    await saveDraft();
    
    emit({
      type: 'user-interaction',
      source: 'command-center',
      priority: 1,
      payload: {
        action: 'click',
        element: 'save-button',
        elementType: 'button'
      }
    });
  }, [saveDraft]);

  const handleRefresh = useCallback(async () => {
    await refreshData();
    
    emit({
      type: 'user-interaction',
      source: 'command-center',
      priority: 1,
      payload: {
        action: 'click',
        element: 'refresh-button',
        elementType: 'button'
      }
    });
  }, [refreshData]);

  /**
   * Render panel quick access buttons
   */
  const renderPanelButtons = () => (
    <Box display="flex" gap={1} alignItems="center">
      {availablePanels.map((type) => {
        const config = PANEL_CONFIGS[type];
        const Icon = config.icon;
        const isActive = Object.values(state.panels).some(
          panel => panel.type === type && panel.isOpen
        );
        
        return (
          <Tooltip 
            key={type}
            title={`${config.title} (Alt+${config.shortcut})`}
            arrow
          >
            <IconButton
              size="small"
              onClick={() => handleOpenPanel(type)}
              sx={{
                color: isActive ? config.color : 'text.secondary',
                backgroundColor: isActive ? alpha(config.color, 0.1) : 'transparent',
                '&:hover': {
                  backgroundColor: alpha(config.color, 0.2)
                }
              }}
            >
              <Icon />
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );

  /**
   * Render status chips
   */
  const renderStatusChips = () => (
    <Box display="flex" gap={1} alignItems="center">
      {/* Workflow status */}
      <Chip
        label={`${state.currentStep.toUpperCase()} (${Math.round(state.progress)}%)`}
        size="small"
        color={state.canProceed ? 'success' : 'warning'}
        variant="outlined"
      />
      
      {/* Dirty state indicator */}
      {state.scheduleData.isDirty && (
        <Chip
          label="Unsaved"
          size="small"
          color="error"
          variant="filled"
        />
      )}
      
      {/* Panel count */}
      {Object.keys(state.panels).length > 0 && (
        <Chip
          label={`${Object.values(state.panels).filter(p => p.isOpen).length} panels`}
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );

  return (
    <Box
      className={className}
      sx={{
        height: fullscreen ? '100vh' : '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden'
      }}
    >
      {/* Command Center Header */}
      <AppBar 
        position="static" 
        elevation={1}
        sx={{ 
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Toolbar variant="dense">
          {/* Menu toggle */}
          <IconButton
            edge="start"
            onClick={toggleSidebar}
            aria-label="toggle sidebar"
            size="small"
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Schedule Command Center
          </Typography>

          {/* Status chips */}
          {renderStatusChips()}

          {/* Panel quick access */}
          {renderPanelButtons()}

          {/* Action buttons */}
          <Box display="flex" gap={1} ml={2}>
            <Tooltip title="Save Draft (Ctrl+S)" arrow>
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={!state.scheduleData.isDirty}
                color={state.scheduleData.isDirty ? 'primary' : 'default'}
              >
                <SaveIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh Data (Ctrl+Shift+R)" arrow>
              <IconButton
                size="small"
                onClick={handleRefresh}
                disabled={state.isLoading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Settings" arrow>
              <IconButton size="small">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content area */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Drawer
          variant="persistent"
          open={state.sidebarOpen}
          sx={{
            width: state.sidebarOpen ? 280 : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 280,
              boxSizing: 'border-box',
              position: 'relative',
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper'
            }
          }}
        >
          <WorkspaceSidebar />
        </Drawer>

        {/* Main workspace */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <WorkspaceLayout />
          
          {/* Panel containers */}
          {Object.values(state.panels).map((panel) => (
            <PanelContainer
              key={panel.id}
              panel={panel}
            />
          ))}

          {/* Floating action button for adding panels */}
          {isWorkspacePanels && (
            <Fab
              color="primary"
              aria-label="add panel"
              sx={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                zIndex: theme.zIndex.fab
              }}
              size="medium"
            >
              <AddIcon />
            </Fab>
          )}
        </Box>
      </Box>

      {/* Status bar */}
      <WorkspaceStatusBar />
    </Box>
  );
};
/**
 * Workspace Sidebar
 * Navigation and control panel for the Command Center
 * Provides quick access to drafts, panels, and workspace tools
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Badge,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  ViewModule as BlockIcon,
  Schedule as ScheduleIcon,
  LibraryBooks as LibraryIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon
} from '@mui/icons-material';

import { useWorkspace, useWorkspaceState } from '../../contexts/WorkspaceContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { usePanelActions, useScheduleActions } from '../../hooks/useWorkspaceState';
import { emit } from '../../services/workspaceEventBus';

/**
 * Panel type configurations
 */
const PANEL_TYPES = [
  { 
    type: 'upload' as const, 
    label: 'File Upload', 
    icon: DashboardIcon, 
    color: '#1976d2',
    description: 'Upload and validate CSV/Excel files'
  },
  { 
    type: 'timepoints' as const, 
    label: 'TimePoints', 
    icon: TimelineIcon, 
    color: '#388e3c',
    description: 'Analyze travel times and service bands'
  },
  { 
    type: 'blocks' as const, 
    label: 'Blocks', 
    icon: BlockIcon, 
    color: '#f57c00',
    description: 'Configure bus blocks and schedules'
  },
  { 
    type: 'summary' as const, 
    label: 'Summary', 
    icon: ScheduleIcon, 
    color: '#7b1fa2',
    description: 'View and edit summary schedule'
  },
  { 
    type: 'library' as const, 
    label: 'Library', 
    icon: LibraryIcon, 
    color: '#5d4037',
    description: 'Browse saved drafts'
  },
  { 
    type: 'analytics' as const, 
    label: 'Analytics', 
    icon: AnalyticsIcon, 
    color: '#c2185b',
    description: 'Performance insights'
  }
];

/**
 * Quick actions section
 */
const QuickActions: React.FC = () => {
  const { saveDraft, refreshData } = useScheduleActions();
  const { state } = useWorkspace();
  
  const handleSave = async () => {
    await saveDraft();
    emit({
      type: 'user-interaction',
      source: 'workspace-sidebar',
      priority: 1,
      payload: {
        action: 'click',
        element: 'save-button',
        elementType: 'button'
      }
    });
  };
  
  const handleRefresh = async () => {
    await refreshData();
    emit({
      type: 'user-interaction',
      source: 'workspace-sidebar',
      priority: 1,
      payload: {
        action: 'click',
        element: 'refresh-button',
        elementType: 'button'
      }
    });
  };
  
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom color="text.secondary">
        Quick Actions
      </Typography>
      
      <List dense>
        <ListItem disablePadding>
          <ListItemButton onClick={handleSave} disabled={!state.scheduleData.isDirty}>
            <ListItemIcon>
              <SaveIcon color={state.scheduleData.isDirty ? 'primary' : 'disabled'} />
            </ListItemIcon>
            <ListItemText 
              primary="Save Draft" 
              secondary={state.scheduleData.lastSaved ? 
                `Last saved: ${new Date(state.scheduleData.lastSaved).toLocaleTimeString()}` : 
                'No saves yet'
              }
            />
            {state.scheduleData.isDirty && (
              <Chip label="•" color="error" size="small" />
            )}
          </ListItemButton>
        </ListItem>
        
        <ListItem disablePadding>
          <ListItemButton onClick={handleRefresh} disabled={state.isLoading}>
            <ListItemIcon>
              <RefreshIcon />
            </ListItemIcon>
            <ListItemText primary="Refresh Data" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};

/**
 * Panel management section
 */
const PanelManagement: React.FC = () => {
  const { openPanel } = usePanelActions();
  const { state } = useWorkspace();
  const { isWorkspacePanels, isDraftLibrary, isAdvancedAnalytics } = useFeatureFlags();
  
  const availablePanelTypes = useMemo(() => {
    return PANEL_TYPES.filter(panel => {
      if (panel.type === 'library' && !isDraftLibrary) return false;
      if (panel.type === 'analytics' && !isAdvancedAnalytics) return false;
      return true;
    });
  }, [isDraftLibrary, isAdvancedAnalytics]);
  
  const handleOpenPanel = (type: typeof PANEL_TYPES[number]['type']) => {
    const panelId = `${type}-${Date.now()}`;
    openPanel(panelId, type);
    
    emit({
      type: 'user-interaction',
      source: 'workspace-sidebar',
      priority: 1,
      payload: {
        action: 'click',
        element: `open-${type}-panel`,
        elementType: 'button',
        metadata: { panelId, panelType: type }
      }
    });
  };
  
  const getOpenPanelCount = (type: string) => {
    return Object.values(state.panels).filter(
      panel => panel.type === type && panel.isOpen
    ).length;
  };
  
  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Panels</Typography>
        <Chip 
          label={Object.values(state.panels).filter(p => p.isOpen).length} 
          size="small" 
          sx={{ ml: 1 }}
        />
      </AccordionSummary>
      
      <AccordionDetails sx={{ pt: 0 }}>
        <List dense>
          {availablePanelTypes.map((panelType) => {
            const Icon = panelType.icon;
            const openCount = getOpenPanelCount(panelType.type);
            
            return (
              <ListItem key={panelType.type} disablePadding>
                <ListItemButton onClick={() => handleOpenPanel(panelType.type)}>
                  <ListItemIcon>
                    <Badge badgeContent={openCount > 0 ? openCount : null} color="primary">
                      <Icon sx={{ color: panelType.color }} />
                    </Badge>
                  </ListItemIcon>
                  <ListItemText 
                    primary={panelType.label}
                    secondary={panelType.description}
                  />
                  <IconButton size="small">
                    <AddIcon />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Workflow progress section
 */
const WorkflowProgress: React.FC = () => {
  const { state, proceedToNextStep } = useWorkspace();
  
  const steps = [
    { key: 'upload', label: 'Upload', icon: DashboardIcon },
    { key: 'timepoints', label: 'TimePoints', icon: TimelineIcon },
    { key: 'blocks', label: 'Blocks', icon: BlockIcon },
    { key: 'summary', label: 'Summary', icon: ScheduleIcon },
    { key: 'ready-to-publish', label: 'Ready', icon: PlayIcon }
  ];
  
  const currentStepIndex = steps.findIndex(step => step.key === state.currentStep);
  
  const handleProceed = () => {
    proceedToNextStep();
    
    emit({
      type: 'workflow-progress',
      source: 'workspace-sidebar',
      priority: 1,
      payload: {
        currentStep: state.currentStep,
        progress: state.progress,
        canProceed: state.canProceed
      }
    });
  };
  
  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Workflow</Typography>
        <Chip 
          label={`${Math.round(state.progress)}%`} 
          size="small" 
          color={state.progress === 100 ? 'success' : 'primary'}
          sx={{ ml: 1 }}
        />
      </AccordionSummary>
      
      <AccordionDetails sx={{ pt: 0 }}>
        <List dense>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isNext = index === currentStepIndex + 1;
            
            return (
              <ListItem key={step.key} disablePadding>
                <ListItemButton 
                  disabled={!isCompleted && !isCurrent}
                  onClick={isNext && state.canProceed ? handleProceed : undefined}
                >
                  <ListItemIcon>
                    <Icon 
                      color={isCompleted ? 'success' : isCurrent ? 'primary' : 'disabled'} 
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={step.label}
                    secondary={
                      isCompleted ? 'Completed' : 
                      isCurrent ? 'In Progress' : 
                      'Pending'
                    }
                  />
                  {isCurrent && (
                    <Chip 
                      label="Current" 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                    />
                  )}
                  {isNext && state.canProceed && (
                    <Tooltip title="Proceed to next step">
                      <IconButton size="small" color="primary">
                        <PlayIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Current draft section
 */
const CurrentDraft: React.FC = () => {
  const { state } = useWorkspace();
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <Accordion expanded={isExpanded} onChange={(_, expanded) => setIsExpanded(expanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" width="100%">
          {state.scheduleData.currentDraft ? <FolderOpenIcon /> : <FolderIcon />}
          <Box ml={1} flexGrow={1}>
            <Typography variant="subtitle2">Current Draft</Typography>
            {state.scheduleData.currentDraft && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {state.scheduleData.currentDraft.draftName}
              </Typography>
            )}
          </Box>
        </Box>
      </AccordionSummary>
      
      <AccordionDetails sx={{ pt: 0 }}>
        {state.scheduleData.currentDraft ? (
          <Box>
            <Typography variant="body2" gutterBottom>
              <strong>Name:</strong> {state.scheduleData.currentDraft.draftName}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Step:</strong> {state.scheduleData.currentDraft.currentStep}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Progress:</strong> {state.scheduleData.currentDraft.progress}%
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Modified:</strong> {
                new Date(state.scheduleData.currentDraft.metadata.lastModifiedAt).toLocaleString()
              }
            </Typography>
            
            {state.scheduleData.isDirty && (
              <Chip 
                label="Unsaved changes" 
                size="small" 
                color="warning" 
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No active draft. Upload a file to get started.
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Settings section
 */
const Settings: React.FC = () => {
  const { toggleCommandCenter } = useFeatureFlags();
  const { state, setLayout } = useWorkspace();
  
  const handleToggleCommandCenter = async () => {
    const newMode = await toggleCommandCenter();
    setLayout(newMode ? 'command-center' : 'wizard');
  };
  
  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <SettingsIcon />
        <Typography variant="subtitle2" sx={{ ml: 1 }}>
          Settings
        </Typography>
      </AccordionSummary>
      
      <AccordionDetails sx={{ pt: 0 }}>
        <FormControlLabel
          control={
            <Switch 
              checked={state.layout === 'command-center'}
              onChange={() => handleToggleCommandCenter()}
              size="small"
            />
          }
          label="Command Center Mode"
        />
        
        <FormControlLabel
          control={
            <Switch 
              checked={state.scheduleData.autoSaveEnabled}
              size="small"
            />
          }
          label="Auto-save"
        />
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Workspace Sidebar Component
 */
export const WorkspaceSidebar: React.FC = () => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Workspace
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Command Center
        </Typography>
      </Box>
      
      {/* Scrollable content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <QuickActions />
        
        <Divider />
        
        <Box sx={{ p: 1 }}>
          <CurrentDraft />
          <WorkflowProgress />
          <PanelManagement />
          <Settings />
        </Box>
      </Box>
    </Box>
  );
};
/**
 * Workspace Status Bar
 * Bottom status bar for the Command Center
 * Shows real-time status, performance metrics, and quick info
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Popover,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  CloudDone as CloudIcon,
  CloudOff as CloudOffIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

import { useWorkspaceState } from '../../contexts/WorkspaceContext';
import { useWorkspaceMetrics } from '../../hooks/useWorkspaceState';
import { workspaceEventBus } from '../../services/workspaceEventBus';

/**
 * Status indicator props
 */
interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'info';
  label: string;
  details?: string;
}

/**
 * Status Indicator Component
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label, details }) => {
  const getIcon = () => {
    switch (status) {
      case 'success': return <SuccessIcon />;
      case 'warning': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };
  
  const getColor = () => {
    switch (status) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  };
  
  return (
    <Tooltip title={details || label} arrow>
      <Chip
        icon={getIcon()}
        label={label}
        size="small"
        color={getColor()}
        variant="outlined"
      />
    </Tooltip>
  );
};

/**
 * Performance Metrics Component
 */
const PerformanceMetrics: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const metrics = useWorkspaceMetrics();
  const stats = workspaceEventBus.getStats();
  
  // Monitor memory usage
  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryUsage(Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100));
      }
    };
    
    updateMemory();
    const interval = setInterval(updateMemory, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const open = Boolean(anchorEl);
  
  return (
    <>
      <Tooltip title="Performance Metrics" arrow>
        <IconButton size="small" onClick={handleClick}>
          <SpeedIcon />
        </IconButton>
      </Tooltip>
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            Performance Metrics
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemText
                primary="Render Count"
                secondary={metrics.renderCount}
              />
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Open Panels"
                secondary={`${metrics.openPanelCount} / ${metrics.panelCount}`}
              />
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Memory Usage"
                secondary={`${memoryUsage}%`}
              />
              <Box sx={{ width: 60 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={memoryUsage} 
                  color={memoryUsage > 80 ? 'error' : memoryUsage > 60 ? 'warning' : 'primary'}
                />
              </Box>
            </ListItem>
            
            <Divider />
            
            <ListItem>
              <ListItemText
                primary="Event Bus"
                secondary={`${stats.totalEvents} events, ${stats.totalSubscriptions} subscribers`}
              />
            </ListItem>
            
            <ListItem>
              <ListItemText
                primary="Processing Time"
                secondary={`${stats.averageProcessingTime.toFixed(2)}ms avg`}
              />
            </ListItem>
          </List>
        </Box>
      </Popover>
    </>
  );
};

/**
 * Auto-save Status Component
 */
const AutoSaveStatus: React.FC = () => {
  const state = useWorkspaceState();
  const [lastSaveTime, setLastSaveTime] = useState<string>('');
  
  useEffect(() => {
    if (state.scheduleData.lastSaved) {
      const date = new Date(state.scheduleData.lastSaved);
      setLastSaveTime(date.toLocaleTimeString());
    }
  }, [state.scheduleData.lastSaved]);
  
  const getSaveStatus = () => {
    if (state.scheduleData.isDirty) {
      return {
        icon: <WarningIcon />,
        label: 'Unsaved',
        color: 'warning' as const
      };
    } else if (state.scheduleData.lastSaved) {
      return {
        icon: <CloudIcon />,
        label: `Saved ${lastSaveTime}`,
        color: 'success' as const
      };
    }
    
    return {
      icon: <CloudOffIcon />,
      label: 'No saves',
      color: 'default' as const
    };
  };
  
  const saveStatus = getSaveStatus();
  
  return (
    <Tooltip title="Auto-save status" arrow>
      <Chip
        icon={saveStatus.icon}
        label={saveStatus.label}
        size="small"
        color={saveStatus.color}
        variant="outlined"
      />
    </Tooltip>
  );
};

/**
 * Workflow Progress Mini Component
 */
const WorkflowProgressMini: React.FC = () => {
  const state = useWorkspaceState();
  const theme = useTheme();
  
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <ScheduleIcon fontSize="small" color="action" />
      <Typography variant="caption" color="text.secondary">
        {state.currentStep.toUpperCase()}
      </Typography>
      <Box sx={{ width: 60 }}>
        <LinearProgress 
          variant="determinate" 
          value={state.progress} 
          sx={{ 
            height: 4,
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.primary.main, 0.1)
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {Math.round(state.progress)}%
      </Typography>
    </Box>
  );
};

/**
 * Connection Status Component
 */
const ConnectionStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return (
    <StatusIndicator
      status={isOnline ? 'success' : 'error'}
      label={isOnline ? 'Online' : 'Offline'}
      details={isOnline ? 'Connected to internet' : 'No internet connection'}
    />
  );
};

/**
 * Workspace Status Bar Component
 */
export const WorkspaceStatusBar: React.FC = () => {
  const theme = useTheme();
  const state = useWorkspaceState();
  
  return (
    <Box
      sx={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        fontSize: '0.75rem',
        gap: 2
      }}
    >
      {/* Left side - Current status */}
      <Box display="flex" alignItems="center" gap={1} flexGrow={1}>
        <WorkflowProgressMini />
        
        <Divider orientation="vertical" flexItem />
        
        <AutoSaveStatus />
      </Box>
      
      {/* Center - Draft info */}
      {state.scheduleData.currentDraft && (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="caption" color="text.secondary">
            Draft: {state.scheduleData.currentDraft.draftName}
          </Typography>
        </Box>
      )}
      
      {/* Right side - System status */}
      <Box display="flex" alignItems="center" gap={1}>
        <ConnectionStatus />
        
        <Divider orientation="vertical" flexItem />
        
        <PerformanceMetrics />
        
        <Typography variant="caption" color="text.secondary">
          Panels: {Object.values(state.panels).filter(p => p.isOpen).length}
        </Typography>
      </Box>
    </Box>
  );
};
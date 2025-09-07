/**
 * Panel Container
 * Manages floating/dockable panels in the workspace
 * Provides drag & drop, resize, and window management functionality
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Paper, 
  Box, 
  Typography, 
  IconButton, 
  AppBar, 
  Toolbar,
  Fade,
  alpha,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  Maximize as MaximizeIcon,
  DragIndicator as DragIcon,
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon
} from '@mui/icons-material';

import { PanelState, useWorkspace } from '../../contexts/WorkspaceContext';
import { usePanelRenderer } from '../../hooks/useWorkspaceState';
import { emit } from '../../services/workspaceEventBus';
import { UploadPanel } from '../panels';

/**
 * Panel Container Props
 */
interface PanelContainerProps {
  panel: PanelState;
}

/**
 * Panel Content Component - renders actual panel implementations
 */
const PanelContent: React.FC<{ panel: PanelState }> = ({ panel }) => {
  const getPanelContent = () => {
    switch (panel.type) {
      case 'upload':
        return (
          <UploadPanel 
            panelId={panel.id}
            data={panel.data}
          />
        );
        
      case 'timepoints':
        return (
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              TimePoints Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Analyze travel times and configure service bands.
            </Typography>
          </Box>
        );
        
      case 'blocks':
        return (
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Block Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure bus blocks and operational parameters.
            </Typography>
          </Box>
        );
        
      case 'summary':
        return (
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Summary Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and edit the generated schedule with inline editing.
            </Typography>
          </Box>
        );
        
      case 'library':
        return (
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Draft Library
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Browse and manage saved schedule drafts.
            </Typography>
          </Box>
        );
        
      case 'analytics':
        return (
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Analytics Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View schedule performance metrics and insights.
            </Typography>
          </Box>
        );
        
      default:
        return (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary">
              Unknown panel type: {panel.type}
            </Typography>
          </Box>
        );
    }
  };
  
  return (
    <Box sx={{ height: '100%', overflow: 'hidden' }}>
      {getPanelContent()}
    </Box>
  );
};

/**
 * Panel Container Component
 */
export const PanelContainer: React.FC<PanelContainerProps> = ({ panel }) => {
  const theme = useTheme();
  const { 
    closePanel, 
    minimizePanel, 
    maximizePanel, 
    dockPanel, 
    updatePanelPosition 
  } = useWorkspace();
  const { shouldRender } = usePanelRenderer(panel.id);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Handle panel dragging
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (panel.isDocked) return;
    
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
    
    emit({
      type: 'user-interaction',
      source: 'panel-container',
      priority: 1,
      payload: {
        action: 'click',
        element: 'panel-header',
        elementType: 'panel',
        metadata: { panelId: panel.id, action: 'drag-start' }
      }
    });
  }, [panel.isDocked, panel.id]);

  /**
   * Handle mouse move for dragging
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
        width: panel.position.width,
        height: panel.position.height
      };
      
      updatePanelPosition(panel.id, newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      emit({
        type: 'user-interaction',
        source: 'panel-container',
        priority: 1,
        payload: {
          action: 'click',
          element: 'panel-header',
          elementType: 'panel',
          metadata: { panelId: panel.id, action: 'drag-end' }
        }
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, panel.id, panel.position.width, panel.position.height, updatePanelPosition]);

  /**
   * Handle panel actions
   */
  const handleClose = useCallback(() => {
    closePanel(panel.id);
    
    emit({
      type: 'panel-state',
      source: 'panel-container',
      priority: 1,
      payload: {
        panelId: panel.id,
        action: 'close'
      }
    });
  }, [panel.id, closePanel]);

  const handleMinimize = useCallback(() => {
    minimizePanel(panel.id);
    
    emit({
      type: 'panel-state',
      source: 'panel-container',
      priority: 1,
      payload: {
        panelId: panel.id,
        action: 'minimize'
      }
    });
  }, [panel.id, minimizePanel]);

  const handleMaximize = useCallback(() => {
    maximizePanel(panel.id);
    
    emit({
      type: 'panel-state',
      source: 'panel-container',
      priority: 1,
      payload: {
        panelId: panel.id,
        action: 'maximize'
      }
    });
  }, [panel.id, maximizePanel]);

  const handleDock = useCallback(() => {
    // For now, dock to center by default
    dockPanel(panel.id, 'center', panel.position);
    
    emit({
      type: 'panel-state',
      source: 'panel-container',
      priority: 1,
      payload: {
        panelId: panel.id,
        action: 'dock',
        dockZone: 'center',
        position: panel.position
      }
    });
  }, [panel.id, panel.position, dockPanel]);

  // Don't render if panel shouldn't be shown
  if (!shouldRender) return null;

  // For docked panels, render differently
  if (panel.isDocked) {
    return null; // Docked panels are rendered by WorkspaceLayout
  }

  return (
    <Fade in={panel.isOpen} timeout={200}>
      <Paper
        ref={panelRef}
        elevation={panel.isMinimized ? 2 : 8}
        sx={{
          position: 'absolute',
          left: panel.position.x,
          top: panel.position.y,
          width: panel.position.width,
          height: panel.isMinimized ? 40 : panel.position.height,
          zIndex: panel.zIndex,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'default',
          transform: isDragging ? 'rotate(2deg)' : 'none',
          transition: theme.transitions.create(['transform', 'box-shadow'], {
            duration: theme.transitions.duration.short
          }),
          boxShadow: isDragging 
            ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`
            : undefined,
          border: isDragging 
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid ${theme.palette.divider}`
        }}
      >
        {/* Panel Header */}
        <AppBar 
          position="static" 
          elevation={0}
          sx={{ 
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Toolbar 
            variant="dense" 
            sx={{ minHeight: 40, pr: 1 }}
            onMouseDown={handleMouseDown}
          >
            <DragIcon 
              sx={{ 
                mr: 1, 
                cursor: panel.isDocked ? 'default' : 'grab',
                color: 'text.secondary'
              }} 
            />
            
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {panel.type.charAt(0).toUpperCase() + panel.type.slice(1)}
            </Typography>

            <Box display="flex" gap={0.5}>
              <IconButton 
                size="small" 
                onClick={handleMinimize}
                aria-label="minimize panel"
              >
                <MinimizeIcon />
              </IconButton>

              <IconButton 
                size="small" 
                onClick={panel.isDocked ? undefined : handleDock}
                aria-label={panel.isDocked ? 'undock panel' : 'dock panel'}
              >
                {panel.isDocked ? <UnpinIcon /> : <PinIcon />}
              </IconButton>

              <IconButton 
                size="small" 
                onClick={handleMaximize}
                aria-label="maximize panel"
              >
                <MaximizeIcon />
              </IconButton>

              <IconButton 
                size="small" 
                onClick={handleClose}
                aria-label="close panel"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Panel Content */}
        {!panel.isMinimized && (
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <PanelContent panel={panel} />
          </Box>
        )}

        {/* Resize handle */}
        {!panel.isMinimized && !panel.isDocked && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 16,
              height: 16,
              cursor: 'se-resize',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderBottom: `6px solid ${theme.palette.text.secondary}`
              }
            }}
          />
        )}
      </Paper>
    </Fade>
  );
};
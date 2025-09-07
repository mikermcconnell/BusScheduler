/**
 * Workspace Layout
 * Manages the 3-zone layout system for the Command Center
 * Uses CSS Grid for responsive and flexible panel docking
 */

import React, { useMemo } from 'react';
import { 
  Box, 
  Paper,
  Typography,
  IconButton,
  Fade,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  DragIndicator as DragIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';

import { useWorkspaceState } from '../../contexts/WorkspaceContext';
import { useDockedPanels } from '../../hooks/useWorkspaceState';
import { PanelState } from '../../contexts/WorkspaceContext';

/**
 * Drop zone component for panel docking
 */
interface DropZoneProps {
  zone: 'left' | 'right' | 'bottom' | 'center';
  isActive?: boolean;
  onDrop?: (panelId: string) => void;
  children?: React.ReactNode;
}

const DropZone: React.FC<DropZoneProps> = ({ 
  zone, 
  isActive = false, 
  onDrop,
  children 
}) => {
  const theme = useTheme();
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const panelId = e.dataTransfer.getData('panel-id');
    if (panelId && onDrop) {
      onDrop(panelId);
    }
  };
  
  return (
    <Box
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: zone === 'bottom' ? 200 : 300,
        border: isActive ? 2 : 1,
        borderStyle: 'dashed',
        borderColor: isActive ? 'primary.main' : 'divider',
        borderRadius: 1,
        bgcolor: isActive ? 'primary.50' : 'background.paper',
        transition: theme.transitions.create(['border-color', 'background-color']),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        '&:hover': {
          borderColor: 'primary.light',
          bgcolor: 'primary.50'
        }
      }}
    >
      {children || (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary'
          }}
        >
          <AddIcon fontSize="large" />
          <Typography variant="body2" mt={1}>
            Drop panel here ({zone})
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * Docked panel header component
 */
interface DockedPanelHeaderProps {
  panel: PanelState;
  onUndock?: () => void;
  onMaximize?: () => void;
}

const DockedPanelHeader: React.FC<DockedPanelHeaderProps> = ({
  panel,
  onUndock,
  onMaximize
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        minHeight: 40
      }}
    >
      <DragIcon sx={{ mr: 1, color: 'text.secondary', cursor: 'grab' }} />
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        {panel.type.charAt(0).toUpperCase() + panel.type.slice(1)}
      </Typography>
      
      <IconButton size="small" onClick={onMaximize}>
        <FullscreenIcon />
      </IconButton>
      
      <IconButton size="small" onClick={onUndock}>
        <FullscreenExitIcon />
      </IconButton>
    </Box>
  );
};

/**
 * Workspace Layout Props
 */
interface WorkspaceLayoutProps {
  /** Whether to show zone indicators */
  showZones?: boolean;
  /** Custom grid template areas */
  gridTemplate?: string;
}

/**
 * Workspace Layout Component
 */
export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  showZones = true,
  gridTemplate
}) => {
  const state = useWorkspaceState();
  const leftPanels = useDockedPanels('left');
  const rightPanels = useDockedPanels('right');
  const bottomPanels = useDockedPanels('bottom');
  const centerPanels = useDockedPanels('center');

  /**
   * Generate CSS Grid template based on docked panels
   */
  const gridTemplateAreas = useMemo(() => {
    if (gridTemplate) return gridTemplate;
    
    const hasLeft = leftPanels.length > 0;
    const hasRight = rightPanels.length > 0;
    const hasBottom = bottomPanels.length > 0;
    
    if (hasLeft && hasRight && hasBottom) {
      return `
        "left center right"
        "left bottom right"
      `;
    } else if (hasLeft && hasRight) {
      return `"left center right"`;
    } else if (hasLeft && hasBottom) {
      return `
        "left center"
        "left bottom"
      `;
    } else if (hasRight && hasBottom) {
      return `
        "center right"
        "bottom right"
      `;
    } else if (hasLeft) {
      return `"left center"`;
    } else if (hasRight) {
      return `"center right"`;
    } else if (hasBottom) {
      return `
        "center"
        "bottom"
      `;
    }
    
    return `"center"`;
  }, [leftPanels.length, rightPanels.length, bottomPanels.length, gridTemplate]);

  /**
   * Generate CSS Grid columns
   */
  const gridTemplateColumns = useMemo(() => {
    const hasLeft = leftPanels.length > 0;
    const hasRight = rightPanels.length > 0;
    
    if (hasLeft && hasRight) {
      return '300px 1fr 300px';
    } else if (hasLeft || hasRight) {
      return '300px 1fr';
    }
    
    return '1fr';
  }, [leftPanels.length, rightPanels.length]);

  /**
   * Generate CSS Grid rows
   */
  const gridTemplateRows = useMemo(() => {
    const hasBottom = bottomPanels.length > 0;
    return hasBottom ? '1fr 250px' : '1fr';
  }, [bottomPanels.length]);

  /**
   * Render docked panels for a zone
   */
  const renderDockedPanels = (panels: PanelState[], zone: string) => {
    if (panels.length === 0) return null;
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
        {panels.map((panel) => (
          <Paper
            key={panel.id}
            elevation={1}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 200
            }}
          >
            <DockedPanelHeader
              panel={panel}
              onUndock={() => {
                // Handle undocking
                console.log(`Undocking panel ${panel.id}`);
              }}
              onMaximize={() => {
                // Handle maximizing
                console.log(`Maximizing panel ${panel.id}`);
              }}
            />
            
            <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary">
                {panel.type} panel content will be rendered here
              </Typography>
              
              {/* Panel-specific content would be rendered here */}
              {panel.data && (
                <Box mt={2}>
                  <Typography variant="caption" display="block">
                    Panel Data:
                  </Typography>
                  <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
                    {JSON.stringify(panel.data, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          </Paper>
        ))}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'grid',
        gridTemplateAreas,
        gridTemplateColumns,
        gridTemplateRows,
        gap: 1,
        p: 1,
        overflow: 'hidden'
      }}
    >
      {/* Left zone */}
      {(leftPanels.length > 0 || showZones) && (
        <Box sx={{ gridArea: 'left' }}>
          {leftPanels.length > 0 ? (
            renderDockedPanels(leftPanels, 'left')
          ) : showZones ? (
            <DropZone zone="left" />
          ) : null}
        </Box>
      )}

      {/* Center zone */}
      <Box sx={{ gridArea: 'center' }}>
        {centerPanels.length > 0 ? (
          renderDockedPanels(centerPanels, 'center')
        ) : showZones ? (
          <DropZone zone="center" />
        ) : (
          <Paper
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.paper'
            }}
          >
            <Box textAlign="center" color="text.secondary">
              <Typography variant="h6" gutterBottom>
                Welcome to Schedule Command Center
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Open panels from the toolbar or drag them here to get started
              </Typography>
              
              {/* Current draft status */}
              {state.scheduleData.currentDraft && (
                <Fade in>
                  <Box
                    sx={{
                      mt: 3,
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.default'
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      Active Draft
                    </Typography>
                    <Typography variant="body2" color="primary">
                      {state.scheduleData.currentDraft.draftName}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Step: {state.currentStep} • Progress: {Math.round(state.progress)}%
                    </Typography>
                  </Box>
                </Fade>
              )}
            </Box>
          </Paper>
        )}
      </Box>

      {/* Right zone */}
      {(rightPanels.length > 0 || showZones) && (
        <Box sx={{ gridArea: 'right' }}>
          {rightPanels.length > 0 ? (
            renderDockedPanels(rightPanels, 'right')
          ) : showZones ? (
            <DropZone zone="right" />
          ) : null}
        </Box>
      )}

      {/* Bottom zone */}
      {(bottomPanels.length > 0 || showZones) && (
        <Box sx={{ gridArea: 'bottom' }}>
          {bottomPanels.length > 0 ? (
            renderDockedPanels(bottomPanels, 'bottom')
          ) : showZones ? (
            <DropZone zone="bottom" />
          ) : null}
        </Box>
      )}
    </Box>
  );
};
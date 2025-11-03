import React from 'react';
import {
  Box,
  Button,
  Fab,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as UploadIcon,
  PlayArrow as PlayIcon,
  Drafts as DraftsIcon,
  Timeline as TimelineIcon,
  Build as ConfigIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface ContextualAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  disabled?: boolean;
  tooltip?: string;
}

interface ContextualActionsProps {
  variant?: 'fab' | 'speedDial' | 'toolbar' | 'inline';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const ContextualActions: React.FC<ContextualActionsProps> = ({
  variant = 'toolbar',
  position = 'bottom-right'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [speedDialOpen, setSpeedDialOpen] = React.useState(false);

  // Get contextual actions based on current page
  const getContextualActions = (): ContextualAction[] => {
    const path = location.pathname;

    // Dashboard context
    if (path === '/') {
      return [
        {
          label: 'New Schedule',
          icon: <UploadIcon />,
          onClick: () => navigate('/new-schedule'),
          primary: true,
          color: 'primary',
          tooltip: 'Start creating a new schedule'
        },
        {
          label: 'View Drafts',
          icon: <DraftsIcon />,
          onClick: () => navigate('/drafts'),
          color: 'secondary',
          tooltip: 'Continue working on draft schedules'
        },
        {
          label: 'Browse Schedules',
          icon: <ScheduleIcon />,
          onClick: () => navigate('/schedules'),
          tooltip: 'View published schedules'
        }
      ];
    }

    // Draft schedules context
    if (path.includes('/drafts')) {
      return [
        {
          label: 'New Upload',
          icon: <UploadIcon />,
          onClick: () => navigate('/new-schedule'),
          primary: true,
          color: 'primary',
          tooltip: 'Upload new schedule data'
        },
        {
          label: 'Refresh List',
          icon: <RefreshIcon />,
          onClick: () => window.location.reload(),
          tooltip: 'Refresh draft schedules list'
        }
      ];
    }

    // TimePoints analysis context
    if (path.includes('/timepoints')) {
      const hasData = localStorage.getItem('currentTimePointData');
      return [
        {
          label: 'Configure Blocks',
          icon: <ConfigIcon />,
          onClick: () => navigate('/block-configuration', { state: location.state }),
          primary: true,
          color: 'primary',
          disabled: !hasData,
          tooltip: hasData ? 'Proceed to block configuration' : 'Complete timepoint analysis first'
        },
        {
          label: 'Back to Drafts',
          icon: <DraftsIcon />,
          onClick: () => navigate('/drafts'),
          tooltip: 'Return to draft schedules'
        }
      ];
    }

    // Block configuration context
    if (path.includes('/block-configuration')) {
      return [
        {
          label: 'Generate Schedule',
          icon: <PlayIcon />,
          onClick: () => navigate('/block-summary-schedule', { state: location.state }),
          primary: true,
          color: 'success',
          tooltip: 'Generate final schedule'
        },
        {
          label: 'Back to TimePoints',
          icon: <TimelineIcon />,
          onClick: () => navigate('/timepoints', { state: location.state }),
          tooltip: 'Return to timepoint analysis'
        }
      ];
    }

    // Schedule generation/summary context
    if (path.includes('/block-summary-schedule') || path.includes('/generate-summary')) {
      return [
        {
          label: 'Export Schedule',
          icon: <DownloadIcon />,
          onClick: () => {
            // Trigger export functionality
            const exportEvent = new CustomEvent('exportSchedule');
            window.dispatchEvent(exportEvent);
          },
          primary: true,
          color: 'success',
          tooltip: 'Export generated schedule'
        },
        {
          label: 'Share Schedule',
          icon: <ShareIcon />,
          onClick: () => {
            // Implement sharing functionality
            console.log('Share schedule functionality');
          },
          tooltip: 'Share schedule with others'
        },
        {
          label: 'New Schedule',
          icon: <UploadIcon />,
          onClick: () => navigate('/new-schedule'),
          color: 'primary',
          tooltip: 'Start a new schedule'
        }
      ];
    }

    // Upload schedule context
    if (path.includes('/new-schedule') || path.includes('/edit-schedule')) {
      return [
        {
          label: 'View Drafts',
          icon: <DraftsIcon />,
          onClick: () => navigate('/drafts'),
          tooltip: 'View existing draft schedules'
        }
      ];
    }

    // Default actions for other pages
    return [
      {
        label: 'Dashboard',
        icon: <ScheduleIcon />,
        onClick: () => navigate('/'),
        tooltip: 'Return to dashboard'
      }
    ];
  };

  const actions = getContextualActions();
  const primaryAction = actions.find(action => action.primary);
  const secondaryActions = actions.filter(action => !action.primary);

  // Render based on variant
  switch (variant) {
    case 'fab':
      if (!primaryAction) return null;
      return (
        <Tooltip title={primaryAction.tooltip || primaryAction.label}>
          <Fab
            color={primaryAction.color || 'primary'}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            sx={{
              position: 'fixed',
              bottom: position.includes('bottom') ? 24 : 'auto',
              top: position.includes('top') ? 24 : 'auto',
              right: position.includes('right') ? 24 : 'auto',
              left: position.includes('left') ? 24 : 'auto',
            }}
          >
            {primaryAction.icon}
          </Fab>
        </Tooltip>
      );

    case 'speedDial':
      if (actions.length <= 1) return null;
      return (
        <SpeedDial
          ariaLabel="Quick actions"
          icon={<SpeedDialIcon />}
          open={speedDialOpen}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
          sx={{
            position: 'fixed',
            bottom: position.includes('bottom') ? 24 : 'auto',
            top: position.includes('top') ? 24 : 'auto',
            right: position.includes('right') ? 24 : 'auto',
            left: position.includes('left') ? 24 : 'auto',
          }}
        >
          {actions.map((action) => (
            <SpeedDialAction
              key={action.label}
              icon={action.icon}
              tooltipTitle={action.tooltip || action.label}
              onClick={() => {
                action.onClick();
                setSpeedDialOpen(false);
              }}
              FabProps={{
                disabled: action.disabled,
                color: action.color || 'default'
              }}
            />
          ))}
        </SpeedDial>
      );

    case 'inline':
      return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {actions.map((action) => (
            <Tooltip key={action.label} title={action.tooltip || ''}>
              <Button
                variant={action.primary ? 'contained' : 'outlined'}
                color={action.color || 'primary'}
                startIcon={action.icon}
                onClick={action.onClick}
                disabled={action.disabled}
                size="small"
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </Box>
      );

    case 'toolbar':
    default:
      if (actions.length === 0) return null;
      return (
        <Paper
          elevation={2}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
            backgroundColor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Quick Actions
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {actions.map((action, index) => (
                <React.Fragment key={action.label}>
                  {index > 0 && index === actions.findIndex(a => a.primary) && (
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                  )}
                  <Tooltip title={action.tooltip || ''}>
                    <Button
                      variant={action.primary ? 'contained' : 'outlined'}
                      color={action.color || 'primary'}
                      startIcon={action.icon}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      size="small"
                      sx={{
                        minWidth: action.primary ? 140 : 100,
                        fontWeight: action.primary ? 'bold' : 'normal'
                      }}
                    >
                      {action.label}
                    </Button>
                  </Tooltip>
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </Paper>
      );
  }
};

export default ContextualActions;

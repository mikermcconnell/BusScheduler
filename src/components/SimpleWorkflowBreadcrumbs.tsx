import React from 'react';
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  Chip,
  Paper,
  useTheme,
} from '@mui/material';
import {
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  CloudUpload as UploadIcon,
  Drafts as DraftsIcon,
  Timeline as TimelineIcon,
  Build as ConfigIcon,
  ViewList as SummaryIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface WorkflowStep {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  completed?: boolean;
}

interface SimpleWorkflowBreadcrumbsProps {
  showWorkflow?: boolean;
  workflowType?: 'schedule-creation' | 'route-management' | 'shift-planning';
}

const SimpleWorkflowBreadcrumbs: React.FC<SimpleWorkflowBreadcrumbsProps> = ({
  showWorkflow = true,
  workflowType
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  // Simplified workflow steps - only essential ones
  const workflows = {
    'schedule-creation': [
      {
        key: 'upload',
        label: 'Upload',
        path: '/upload',
        icon: <UploadIcon />,
      },
      {
        key: 'review',
        label: 'Review',
        path: '/drafts',
        icon: <DraftsIcon />,
      },
      {
        key: 'analyze',
        label: 'Analyze',
        path: '/timepoints',
        icon: <TimelineIcon />,
      },
      {
        key: 'configure',
        label: 'Configure',
        path: '/block-configuration',
        icon: <ConfigIcon />,
      },
      {
        key: 'generate',
        label: 'Generate',
        path: '/block-summary-schedule',
        icon: <SummaryIcon />,
      }
    ],
    'route-management': [
      {
        key: 'setup',
        label: 'Setup Routes',
        path: '/routes',
        icon: <ConfigIcon />,
      },
      {
        key: 'configure',
        label: 'Configure Points',
        path: '/timepoints',
        icon: <TimelineIcon />,
      }
    ],
    'shift-planning': [
      {
        key: 'review',
        label: 'Review Schedules',
        path: '/schedules',
        icon: <SummaryIcon />,
      },
      {
        key: 'plan',
        label: 'Plan Shifts',
        path: '/tod-shifts',
        icon: <ConfigIcon />,
      }
    ]
  };

  // Auto-detect workflow type
  const detectWorkflowType = (): string | null => {
    const path = location.pathname;
    
    if (['/upload', '/drafts', '/timepoints', '/block-configuration', '/block-summary-schedule'].includes(path)) {
      return 'schedule-creation';
    }
    if (['/routes'].includes(path)) {
      return 'route-management';
    }
    if (['/tod-shifts'].includes(path)) {
      return 'shift-planning';
    }
    
    return null;
  };

  const currentWorkflowType = workflowType || detectWorkflowType();
  const steps = currentWorkflowType && currentWorkflowType in workflows ? workflows[currentWorkflowType as keyof typeof workflows] : [];

  // Generate simple breadcrumbs
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Dashboard', path: '/', icon: <HomeIcon /> }];

    const pathMappings: { [key: string]: { label: string; icon: React.ReactElement } } = {
      'upload': { label: 'New Schedule', icon: <UploadIcon /> },
      'drafts': { label: 'Draft Schedules', icon: <DraftsIcon /> },
      'timepoints': { label: 'TimePoints', icon: <TimelineIcon /> },
      'block-configuration': { label: 'Block Config', icon: <ConfigIcon /> },
      'block-summary-schedule': { label: 'Summary', icon: <SummaryIcon /> },
      'schedules': { label: 'Schedules', icon: <SummaryIcon /> },
      'routes': { label: 'Routes', icon: <ConfigIcon /> },
      'tod-shifts': { label: 'Shifts', icon: <ConfigIcon /> },
      'settings': { label: 'Settings', icon: <ConfigIcon /> }
    };

    pathSegments.forEach((segment: string, index: number) => {
      const mapping = pathMappings[segment];
      if (mapping) {
        const fullPath = '/' + pathSegments.slice(0, index + 1).join('/');
        breadcrumbs.push({
          label: mapping.label,
          path: fullPath,
          icon: mapping.icon || <HomeIcon />
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  const currentStepIndex = steps.findIndex((step: WorkflowStep) => step.path === location.pathname);

  // Mark completed steps
  const stepsWithStatus = steps.map((step: WorkflowStep, index: number) => ({
    ...step,
    completed: index < currentStepIndex,
    active: index === currentStepIndex
  }));

  const handleNavigation = (path: string) => {
    // Preserve important state when navigating
    const scheduleState = location.state;
    
    const workflowPages = ['/timepoints', '/block-configuration', '/block-summary-schedule'];
    if (workflowPages.includes(path) && scheduleState) {
      navigate(path, { state: scheduleState });
    } else {
      navigate(path);
    }
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 3, 
        borderRadius: 2,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Standard Breadcrumbs */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Breadcrumbs 
            separator={<NavigateNextIcon fontSize="small" />}
          >
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              
              if (isLast || !crumb.path) {
                return (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {crumb.icon}
                    <Typography color="text.primary" fontWeight="medium">
                      {crumb.label}
                    </Typography>
                  </Box>
                );
              }
              
              return (
                <Link
                  key={index}
                  color="inherit"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigation(crumb.path!);
                  }}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  {crumb.icon}
                  {crumb.label}
                </Link>
              );
            })}
          </Breadcrumbs>

          {/* Simple workflow indicator */}
          {currentWorkflowType && (
            <Chip
              label={`${currentWorkflowType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Workflow`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>

        {/* Simplified workflow stepper - only show if in a workflow */}
        {showWorkflow && stepsWithStatus.length > 0 && currentStepIndex >= 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
              Progress:
            </Typography>
            
            {stepsWithStatus.map((step: WorkflowStep & { completed: boolean; active: boolean }, index: number) => (
              <React.Fragment key={step.key}>
                <Box
                  onClick={() => {
                    // Allow navigation to completed steps or current step
                    if (step.completed || step.active) {
                      handleNavigation(step.path);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    cursor: (step.completed || step.active) ? 'pointer' : 'default',
                    backgroundColor: step.active 
                      ? 'primary.main'
                      : step.completed 
                        ? 'success.light'
                        : 'grey.100',
                    color: step.active 
                      ? 'white'
                      : step.completed 
                        ? 'success.contrastText'
                        : 'text.secondary',
                    opacity: (step.completed || step.active) ? 1 : 0.6,
                    transition: 'all 0.2s ease',
                    '&:hover': (step.completed || step.active) ? {
                      transform: 'translateY(-1px)',
                      boxShadow: 1
                    } : {}
                  }}
                >
                  {step.completed && <CompleteIcon fontSize="small" />}
                  {step.active && step.icon}
                  {!step.completed && !step.active && step.icon}
                  <Typography variant="caption" fontWeight="medium">
                    {step.label}
                  </Typography>
                </Box>
                
                {index < stepsWithStatus.length - 1 && (
                  <NavigateNextIcon 
                    fontSize="small" 
                    sx={{ color: 'text.disabled' }} 
                  />
                )}
              </React.Fragment>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default SimpleWorkflowBreadcrumbs;
import React, { useEffect, useState } from 'react';
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepIcon,
  useTheme,
  useMediaQuery,
  Paper,
  IconButton,
  Tooltip
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
  RadioButtonUnchecked as PendingIcon,
  PlayArrow as ActiveIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { workflowStateService, WorkflowState } from '../services/workflowStateService';

interface WorkflowStep {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  description: string;
  status: 'completed' | 'active' | 'pending';
  optional?: boolean;
}

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface WorkflowBreadcrumbsProps {
  showWorkflow?: boolean;
  customBreadcrumbs?: BreadcrumbItem[];
  workflowContext?: string; // 'schedule-creation' | 'route-management' | 'shift-planning'
}

const WorkflowBreadcrumbs: React.FC<WorkflowBreadcrumbsProps> = ({
  showWorkflow = true,
  customBreadcrumbs,
  workflowContext
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [persistentWorkflow, setPersistentWorkflow] = useState<WorkflowState | null>(null);

  // Define workflow steps for different contexts
  const workflows = {
    'schedule-creation': [
      {
        key: 'upload',
        label: 'Upload Data',
        path: '/upload',
        icon: <UploadIcon />,
        description: 'Import Excel/CSV schedule data',
        status: 'completed' as const
      },
      {
        key: 'drafts',
        label: 'Draft Review',
        path: '/drafts',
        icon: <DraftsIcon />,
        description: 'Review and manage draft schedules',
        status: 'completed' as const
      },
      {
        key: 'timepoints',
        label: 'TimePoints Analysis',
        path: '/timepoints',
        icon: <TimelineIcon />,
        description: 'Analyze travel times and service bands',
        status: 'completed' as const
      },
      {
        key: 'block-config',
        label: 'Block Configuration',
        path: '/block-configuration',
        icon: <ConfigIcon />,
        description: 'Configure bus blocks and timing',
        status: 'active' as const
      },
      {
        key: 'summary',
        label: 'Summary Schedule',
        path: '/block-summary-schedule',
        icon: <SummaryIcon />,
        description: 'Generate final schedule',
        status: 'pending' as const
      }
    ],
    'route-management': [
      {
        key: 'routes',
        label: 'Route Setup',
        path: '/routes',
        icon: <ConfigIcon />,
        description: 'Configure route parameters',
        status: 'active' as const
      },
      {
        key: 'timepoints',
        label: 'TimePoint Configuration',
        path: '/timepoints',
        icon: <TimelineIcon />,
        description: 'Set up route timepoints',
        status: 'pending' as const
      }
    ],
    'shift-planning': [
      {
        key: 'schedules',
        label: 'Schedule Review',
        path: '/schedules',
        icon: <SummaryIcon />,
        description: 'Review existing schedules',
        status: 'completed' as const
      },
      {
        key: 'tod-shifts',
        label: 'Shift Planning',
        path: '/tod-shifts',
        icon: <ConfigIcon />,
        description: 'Plan operator shifts',
        status: 'active' as const
      }
    ]
  };

  // Auto-detect workflow context based on current path
  const detectWorkflowContext = (): string | null => {
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

  const currentWorkflowContext = workflowContext || detectWorkflowContext();
  const currentWorkflow = currentWorkflowContext ? workflows[currentWorkflowContext as keyof typeof workflows] : [];

  // Initialize or update persistent workflow state
  useEffect(() => {
    const currentPersistentWorkflow = workflowStateService.getCurrentWorkflow();
    
    if (currentWorkflowContext && !currentPersistentWorkflow) {
      // Start a new workflow if none exists
      const newWorkflow = workflowStateService.startWorkflow(
        currentWorkflowContext as 'schedule-creation' | 'route-management' | 'shift-planning'
      );
      setPersistentWorkflow(newWorkflow);
    } else if (currentPersistentWorkflow) {
      setPersistentWorkflow(currentPersistentWorkflow);
    }
  }, [currentWorkflowContext]);

  // Update workflow status based on persistent state and current path
  const updateWorkflowStatus = (steps: WorkflowStep[]): WorkflowStep[] => {
    const currentPath = location.pathname;
    
    if (persistentWorkflow) {
      // Use persistent workflow state
      return steps.map(step => {
        const persistentStep = persistentWorkflow.steps.find(s => s.key === step.key);
        if (persistentStep) {
          return {
            ...step,
            status: persistentStep.status
          };
        }
        
        // Fallback for current path
        if (step.path === currentPath) {
          return { ...step, status: 'active' };
        }
        
        return step;
      });
    }
    
    // Fallback to localStorage-based logic if no persistent workflow
    const hasScheduleData = localStorage.getItem('currentSummarySchedule');
    const hasDraftData = localStorage.getItem('currentSchedule');
    
    return steps.map((step, index) => {
      // Mark current step as active
      if (step.path === currentPath) {
        return { ...step, status: 'active' };
      }
      
      // Mark completed steps based on data availability and path progression
      let isCompleted = false;
      
      switch (step.key) {
        case 'upload':
          isCompleted = !!hasDraftData;
          break;
        case 'drafts':
          isCompleted = !!hasDraftData && currentPath !== '/upload';
          break;
        case 'timepoints':
          isCompleted = !!hasDraftData && ['/block-configuration', '/block-summary-schedule'].includes(currentPath);
          break;
        case 'block-config':
          isCompleted = !!hasScheduleData && currentPath === '/block-summary-schedule';
          break;
        case 'summary':
          isCompleted = !!hasScheduleData && currentPath === '/block-summary-schedule';
          break;
        default:
          // For other workflows, use simple path-based completion
          const currentStepIndex = steps.findIndex(s => s.path === currentPath);
          isCompleted = currentStepIndex > index;
      }
      
      return {
        ...step,
        status: isCompleted ? 'completed' : (step.path === currentPath ? 'active' : 'pending')
      };
    });
  };

  const workflowSteps = updateWorkflowStatus(currentWorkflow);

  // Generate breadcrumbs from current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', path: '/', icon: <HomeIcon /> }
    ];

    const pathMappings: { [key: string]: { label: string; icon?: React.ReactNode } } = {
      'upload': { label: 'Upload Schedule', icon: <UploadIcon /> },
      'drafts': { label: 'Draft Schedules', icon: <DraftsIcon /> },
      'timepoints': { label: 'TimePoints Analysis', icon: <TimelineIcon /> },
      'block-configuration': { label: 'Block Configuration', icon: <ConfigIcon /> },
      'block-summary-schedule': { label: 'Summary Schedule', icon: <SummaryIcon /> },
      'schedules': { label: 'View Schedules', icon: <SummaryIcon /> },
      'routes': { label: 'Manage Routes', icon: <ConfigIcon /> },
      'tod-shifts': { label: 'Tod Shifts', icon: <ConfigIcon /> },
      'settings': { label: 'Settings', icon: <ConfigIcon /> }
    };

    pathSegments.forEach((segment, index) => {
      const mapping = pathMappings[segment];
      if (mapping) {
        const fullPath = '/' + pathSegments.slice(0, index + 1).join('/');
        breadcrumbs.push({
          label: mapping.label,
          path: fullPath,
          icon: mapping.icon
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = customBreadcrumbs || generateBreadcrumbs();

  const getStepIcon = (step: WorkflowStep) => {
    switch (step.status) {
      case 'completed':
        return <CompleteIcon color="success" />;
      case 'active':
        return <ActiveIcon color="primary" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const handleNavigation = (path: string) => {
    // Update the persistent workflow state to track navigation
    const step = workflowSteps.find(s => s.path === path);
    if (step && persistentWorkflow) {
      workflowStateService.navigateToStep(step.key);
    }
    navigate(path);
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Breadcrumbs 
            separator={<NavigateNextIcon fontSize="small" />} 
            sx={{ flex: 1 }}
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

          {/* Workflow Context Indicator */}
          {currentWorkflowContext && (
            <Chip
              label={currentWorkflowContext.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ textTransform: 'capitalize' }}
            />
          )}
        </Box>

        {/* Workflow Stepper */}
        {showWorkflow && workflowSteps.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Workflow Progress
              </Typography>
              <Tooltip title="This shows your progress through the current workflow">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
            
            {isMobile ? (
              // Mobile: Show current step and navigation
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {workflowSteps.map((step, index) => {
                  if (step.status !== 'active') return null;
                  
                  return (
                    <Box key={step.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStepIcon(step)}
                      <Typography variant="body2" fontWeight="medium">
                        {step.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({index + 1} of {workflowSteps.length})
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              // Desktop: Full stepper
              <Stepper activeStep={workflowSteps.findIndex(s => s.status === 'active')} alternativeLabel>
                {workflowSteps.map((step) => (
                  <Step 
                    key={step.key} 
                    completed={step.status === 'completed'}
                    active={step.status === 'active'}
                  >
                    <StepLabel
                      StepIconComponent={() => getStepIcon(step)}
                      onClick={() => {
                        // Allow navigation to completed or active steps
                        const canNavigate = persistentWorkflow 
                          ? workflowStateService.canAccessStep(step.key)
                          : (step.status === 'completed' || step.status === 'active');
                        
                        if (canNavigate) {
                          handleNavigation(step.path);
                        }
                      }}
                      sx={{
                        cursor: (persistentWorkflow 
                          ? workflowStateService.canAccessStep(step.key) 
                          : step.status !== 'pending') ? 'pointer' : 'default',
                        '& .MuiStepLabel-label': {
                          fontSize: '0.875rem',
                          fontWeight: step.status === 'active' ? 'medium' : 'normal'
                        }
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={step.status === 'active' ? 'medium' : 'normal'}>
                          {step.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {step.description}
                        </Typography>
                      </Box>
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default WorkflowBreadcrumbs;
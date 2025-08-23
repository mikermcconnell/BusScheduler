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
  useTheme,
  useMediaQuery,
  Paper,
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
  isCurrentPage?: boolean;
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
  
  // Ensure we always have workflow steps when in a valid workflow context
  // This fixes the issue where the progress bar doesn't show on first visit to TimePoints
  const shouldForceWorkflowSteps = currentWorkflowContext === 'schedule-creation' && location.pathname === '/timepoints';
  const effectiveWorkflow = (currentWorkflow && currentWorkflow.length > 0) || shouldForceWorkflowSteps 
    ? currentWorkflow 
    : (shouldForceWorkflowSteps ? workflows['schedule-creation'] : []);
  

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
    
    // SPECIAL CASE: Always initialize workflow for TimePoints page
    // This ensures the progress bar shows consistently regardless of navigation path
    if (location.pathname === '/timepoints' && currentWorkflowContext === 'schedule-creation' && !currentPersistentWorkflow) {
      console.log('🔧 Initializing workflow context for TimePoints page');
      const newWorkflow = workflowStateService.startWorkflow('schedule-creation');
      setPersistentWorkflow(newWorkflow);
    }
  }, [currentWorkflowContext, location.pathname]);

  // Update workflow status based on persistent state and current path
  const updateWorkflowStatus = (steps: WorkflowStep[]): WorkflowStep[] => {
    if (!steps || !Array.isArray(steps)) {
      return [];
    }
    
    const currentPath = location.pathname;
    
    if (persistentWorkflow && persistentWorkflow.steps) {
      // Use persistent workflow state and update it based on the current path
      return steps.map((step, index) => {
        const persistentStep = persistentWorkflow.steps.find(s => s.key === step.key);
        
        // Check if this step matches the current path
        const isCurrentPage = step.path === currentPath || 
                            (currentPath.startsWith('/drafts') && step.key === 'drafts') ||
                            (currentPath.includes('timepoints') && step.key === 'timepoints') ||
                            (currentPath.includes('block-configuration') && step.key === 'block-config') ||
                            (currentPath.includes('block-summary-schedule') && step.key === 'summary') ||
                            (currentPath.includes('upload') && step.key === 'upload');
        
        // Mark current step as active while preserving completion status
        if (isCurrentPage) {
          // If the step was already completed, keep it completed but also mark as current
          if (persistentStep && persistentStep.status === 'completed') {
            return { ...step, status: 'completed', isCurrentPage: true };
          }
          // Update persistent workflow to mark current step as active
          workflowStateService.updateStepStatus(step.key, 'active');
          return { ...step, status: 'active', isCurrentPage: true };
        }
        
        if (persistentStep) {
          return {
            ...step,
            status: persistentStep.status,
            isCurrentPage: false
          };
        }
        
        return { ...step, isCurrentPage: false };
      });
    }
    
    // Fallback to localStorage-based logic if no persistent workflow
    const hasScheduleData = localStorage.getItem('currentSummarySchedule');
    const hasDraftData = localStorage.getItem('currentSchedule');
    const busScheduleData = localStorage.getItem('busSchedule');
    
    return steps.map((step, index) => {
      // Check if this step matches the current path
      const isCurrentPage = step.path === currentPath || 
                          (currentPath.startsWith('/drafts') && step.key === 'drafts') ||
                          (currentPath.includes('timepoints') && step.key === 'timepoints') ||
                          (currentPath.includes('block-configuration') && step.key === 'block-config') ||
                          (currentPath.includes('block-summary-schedule') && step.key === 'summary') ||
                          (currentPath.includes('upload') && step.key === 'upload');
      
      // Mark completed steps based on data availability and path progression
      let isCompleted = false;
      
      switch (step.key) {
        case 'upload':
          isCompleted = !!hasDraftData || !!busScheduleData;
          break;
        case 'drafts':
          isCompleted = (!!hasDraftData || !!busScheduleData) && !['/upload', '/drafts'].includes(currentPath);
          break;
        case 'timepoints':
          isCompleted = (!!hasDraftData || !!busScheduleData) && ['/block-configuration', '/block-summary-schedule'].includes(currentPath);
          break;
        case 'block-config':
          isCompleted = (!!hasScheduleData || !!busScheduleData) && currentPath === '/block-summary-schedule';
          break;
        case 'summary':
          isCompleted = false; // Only completed when we're done with the entire workflow
          break;
        default:
          // For other workflows, use simple path-based completion
          const currentStepIndex = steps.findIndex(s => s.path === currentPath);
          isCompleted = currentStepIndex > index;
      }
      
      return {
        ...step,
        status: isCompleted ? 'completed' : (isCurrentPage ? 'active' : 'pending'),
        isCurrentPage
      };
    });
  };

  const workflowSteps = updateWorkflowStatus(effectiveWorkflow || []);

  // Debug logging for TimePoints page
  if (location.pathname.includes('timepoints')) {
    console.log('🔍 WorkflowBreadcrumbs Debug - TimePoints page:');
    console.log('  - Current path:', location.pathname);
    console.log('  - Detected workflow context:', currentWorkflowContext);
    console.log('  - showWorkflow prop:', showWorkflow);
    console.log('  - Current workflow steps:', currentWorkflow?.length || 0);
    console.log('  - Should force workflow steps:', shouldForceWorkflowSteps);
    console.log('  - Effective workflow steps:', effectiveWorkflow?.length || 0);
    console.log('  - Final workflow steps:', workflowSteps?.length || 0);
  }

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
    // If this is the current page, show a special indicator
    if (step.isCurrentPage) {
      if (step.status === 'completed') {
        // Show completed icon with a ring around it for current page
        return (
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CompleteIcon color="success" />
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                border: '2px solid',
                borderColor: 'primary.main',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}
            />
          </Box>
        );
      }
      return <ActiveIcon color="primary" />;
    }
    
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
    
    // Preserve state data when navigating between workflow steps
    let timePointData = null;
    let serviceBands = null;
    
    try {
      timePointData = localStorage.getItem('currentTimePointData') ? JSON.parse(localStorage.getItem('currentTimePointData')!) : null;
      serviceBands = localStorage.getItem('currentServiceBands') ? JSON.parse(localStorage.getItem('currentServiceBands')!) : null;
    } catch (error) {
      console.warn('Error parsing localStorage data:', error);
    }
    
    const scheduleState = location.state;
    
    const navigationState = {
      timePointData: scheduleState?.timePointData || timePointData,
      serviceBands: scheduleState?.serviceBands || serviceBands,
      deletedPeriods: scheduleState?.deletedPeriods || [],
      timePeriodServiceBands: scheduleState?.timePeriodServiceBands || {},
      scheduleId: scheduleState?.scheduleId,
      fileName: scheduleState?.fileName
    };
    
    // Only pass state for workflow pages that need it
    const workflowPages = ['/timepoints', '/block-configuration', '/block-summary-schedule'];
    if (workflowPages.includes(path)) {
      navigate(path, { state: navigationState });
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
        {showWorkflow && workflowSteps && workflowSteps.length > 0 && (
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
              <Stepper activeStep={workflowSteps.findIndex(s => s && s.status === 'active')} alternativeLabel>
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
                        <Typography 
                          variant="body2" 
                          fontWeight={step.isCurrentPage ? 'bold' : (step.status === 'active' ? 'medium' : 'normal')}
                          color={step.isCurrentPage ? 'primary' : 'inherit'}
                        >
                          {step.label}
                          {step.isCurrentPage && (
                            <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                              (Current)
                            </Typography>
                          )}
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
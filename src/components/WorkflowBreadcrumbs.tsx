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
  Tooltip,
  LinearProgress,
  alpha,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  keyframes
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
  Info as InfoIcon,
  SwapVert as SwapVertIcon,
  Edit as EditIcon,
  Celebration as CelebrationIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { draftService } from '../services/draftService';
import { subscribe, unsubscribe } from '../services/workspaceEventBus';

// Animation keyframes (from StoryboardProgress)
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 5px rgba(0, 123, 255, 0.5); }
  50% { box-shadow: 0 0 20px rgba(0, 123, 255, 0.8); }
  100% { box-shadow: 0 0 5px rgba(0, 123, 255, 0.5); }
`;

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
  const [persistentWorkflow, setPersistentWorkflow] = useState<any>(null);
  const [draftWorkflow, setDraftWorkflow] = useState<any>(null);
  const [draftMenuAnchor, setDraftMenuAnchor] = useState<null | HTMLElement>(null);
  const [allWorkflows, setAllWorkflows] = useState<any[]>([]);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  // Define workflow steps for different contexts
  const workflows = {
    'schedule-creation': [
      {
        key: 'upload',
        label: 'Load Data',
        path: '/upload',
        icon: <UploadIcon />,
        description: 'Import Excel/CSV schedule data',
        status: 'completed' as const
      },
      {
        key: 'timepoints',
        label: 'Optimize Timing',
        path: '/timepoints',
        icon: <TimelineIcon />,
        description: 'Analyze travel times and service bands',
        status: 'completed' as const
      },
      {
        key: 'block-config',
        label: 'Plan Blocks',
        path: '/block-configuration',
        icon: <ConfigIcon />,
        description: 'Configure bus blocks and timing',
        status: 'active' as const
      },
      {
        key: 'summary',
        label: 'Build Schedule',
        path: '/block-summary-schedule',
        icon: <SummaryIcon />,
        description: 'Generate base schedule with best practice recovery times',
        status: 'completed' as const
      },
      {
        key: 'connections',
        label: 'Optimize Connections',
        path: '/connection-optimization',
        icon: <SwapVertIcon />,
        description: 'Advanced optimization for GO train and school connections',
        status: 'pending' as const,
        optional: true
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
    
    if (['/upload', '/timepoints', '/block-configuration', '/block-summary-schedule', '/connection-optimization'].includes(path)) {
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
    const currentPersistentWorkflow = draftService.getCurrentWorkflow();
    
    if (currentWorkflowContext && !currentPersistentWorkflow) {
      // Start a new workflow if none exists
      const newWorkflow = draftService.startWorkflow(
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
      const newWorkflow = draftService.startWorkflow('schedule-creation');
      setPersistentWorkflow(newWorkflow);
    }
  }, [currentWorkflowContext, location.pathname]);

  // Load draft workflow for progress tracking with Firebase sync
  useEffect(() => {
    const loadDraftWorkflow = async () => {
      // Try to get current session draft
      const sessionDraftId = draftService.getCurrentSessionDraftId();
      if (sessionDraftId) {
        try {
          // Use the new loadWorkflowFromCloud method
          let cloudWorkflow = await draftService.loadWorkflowFromCloud(sessionDraftId);
          
          if (!cloudWorkflow) {
            // If no workflow exists, try to get Firebase draft data and create workflow
            const firebaseDraft = await draftService.getDraftByIdUnified(sessionDraftId);
            if (firebaseDraft) {
              // Create workflow based on Firebase draft data
              cloudWorkflow = draftService.getOrCreateWorkflow(
                sessionDraftId, 
                firebaseDraft.draftName
              );
              
              // Sync workflow state with Firebase draft data
              cloudWorkflow.currentStep = firebaseDraft.currentStep;
              cloudWorkflow.overallProgress = firebaseDraft.progress;
              cloudWorkflow.draftName = firebaseDraft.draftName;
              cloudWorkflow.lastModified = firebaseDraft.metadata.lastModifiedAt;
              
              // Update step completion status based on Firebase currentStep
              const stepOrder = ['upload', 'timepoints', 'block-config', 'summary'];
              const currentStepIndex = stepOrder.indexOf(firebaseDraft.currentStep === 'blocks' ? 'block-config' : 
                                                        firebaseDraft.currentStep === 'ready-to-publish' ? 'summary' : 
                                                        firebaseDraft.currentStep);
              
              cloudWorkflow.steps.forEach((step, index) => {
                if (index < currentStepIndex) {
                  step.status = 'completed';
                } else if (index === currentStepIndex) {
                  step.status = 'in-progress';
                } else {
                  step.status = 'not-started';
                }
              });
              
              // Store step data if available
              if (firebaseDraft.stepData && !cloudWorkflow.stepData) {
                cloudWorkflow.stepData = firebaseDraft.stepData;
              }
              
              // Save the synced workflow to Firebase for next time
              await draftService.saveWorkflow(cloudWorkflow);
            } else {
              // Create a new workflow if no data exists
              cloudWorkflow = draftService.getOrCreateWorkflow(sessionDraftId);
            }
          }
          
          if (cloudWorkflow) {
            setDraftWorkflow(cloudWorkflow);
          }
          
          // Load all workflows for draft selector
          const allWorkflowsData = draftService.getAllWorkflows();
          setAllWorkflows(allWorkflowsData);
        } catch (error) {
          console.warn('Could not load workflow from cloud, using fallback:', error);
          
          // Fallback to existing method if everything fails
          try {
            const localWorkflow = draftService.getOrCreateWorkflow(sessionDraftId);
            if (localWorkflow) {
              setDraftWorkflow(localWorkflow);
            }
            const allWorkflowsData = draftService.getAllWorkflows();
            setAllWorkflows(allWorkflowsData);
          } catch (fallbackError) {
            console.warn('Fallback workflow loading also failed:', fallbackError);
          }
        }
      }
    };

    // Load on mount and when location changes
    loadDraftWorkflow();
  }, [location.pathname]);

  // Subscribe to workflow progress events for real-time check mark updates
  useEffect(() => {
    const handleWorkflowProgressUpdate = (event: any) => {
      console.log('📈 WorkflowBreadcrumbs received workflow-progress event:', event);
      
      // Update draft workflow state with new progress data
      const sessionDraftId = draftService.getCurrentSessionDraftId();
      if (sessionDraftId && event.payload.draftId === sessionDraftId) {
        // Get updated workflow data
        const updatedWorkflow = draftService.getWorkflow(sessionDraftId);
        if (updatedWorkflow) {
          console.log('✅ Refreshing workflow breadcrumbs with updated data');
          setDraftWorkflow({...updatedWorkflow}); // Force state update
        }
      }
    };

    // Subscribe to workflow-progress events
    const subscriptionId = subscribe('workflow-progress', handleWorkflowProgressUpdate);

    return () => {
      unsubscribe(subscriptionId);
    };
  }, []);

  // Update workflow status based on persistent state and current path
  const updateWorkflowStatus = (steps: WorkflowStep[]): WorkflowStep[] => {
    if (!steps || !Array.isArray(steps)) {
      return [];
    }
    
    const currentPath = location.pathname;
    
    if (persistentWorkflow && persistentWorkflow.steps) {
      // Use persistent workflow state and update it based on the current path
      return steps.map((step, index) => {
        const persistentStep = persistentWorkflow.steps.find((s: any) => s.key === step.key);
        
        // Check if this step matches the current path
        const isCurrentPage = step.path === currentPath || 
                            (currentPath.includes('timepoints') && step.key === 'timepoints') ||
                            (currentPath.includes('block-configuration') && step.key === 'block-config') ||
                            (currentPath.includes('block-summary-schedule') && step.key === 'summary') ||
                            (currentPath.includes('connection-optimization') && step.key === 'connections') ||
                            (currentPath.includes('upload') && step.key === 'upload');
        
        // Mark current step as active while preserving completion status
        if (isCurrentPage) {
          // If the step was already completed, keep it completed but also mark as current
          if (persistentStep && persistentStep.status === 'completed') {
            return { ...step, status: 'completed', isCurrentPage: true };
          }
          // Update persistent workflow to mark current step as active
          // NOTE: Skipping update without draftId
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
    
    // Use draftService-based logic instead of localStorage
    const hasWorkflowData = !!draftWorkflow;
    const workflowProgress = draftWorkflow?.overallProgress || 0;
    const workflowSteps = draftWorkflow?.steps || [];
    
    return steps.map((step, index) => {
      // Check if this step matches the current path
      const isCurrentPage = step.path === currentPath || 
                          (currentPath.includes('timepoints') && step.key === 'timepoints') ||
                          (currentPath.includes('block-configuration') && step.key === 'block-config') ||
                          (currentPath.includes('block-summary-schedule') && step.key === 'summary') ||
                          (currentPath.includes('connection-optimization') && step.key === 'connections') ||
                          (currentPath.includes('upload') && step.key === 'upload');
      
      // Mark completed steps based on data availability and path progression
      let isCompleted = false;
      
      // Use draftService workflow step status if available
      if (hasWorkflowData) {
        const draftStep = workflowSteps.find((s: any) => s.key === step.key);
        if (draftStep) {
          isCompleted = draftStep.status === 'completed';
        } else {
          // Fallback to progress-based completion
          switch (step.key) {
            case 'upload':
              isCompleted = workflowProgress > 0;
              break;
            case 'timepoints':
              isCompleted = workflowProgress >= 40;
              break;
            case 'block-config':
              isCompleted = workflowProgress >= 60;
              break;
            case 'summary':
              isCompleted = workflowProgress >= 80;
              break;
            default:
              isCompleted = false;
          }
        }
      } else {
        // Fallback for when no workflow data available
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
      'upload': { label: 'Load Data', icon: <UploadIcon /> },
      'timepoints': { label: 'Optimize Timing', icon: <TimelineIcon /> },
      'block-configuration': { label: 'Plan Blocks', icon: <ConfigIcon /> },
      'block-summary-schedule': { label: 'Build Schedule', icon: <SummaryIcon /> },
      'connection-optimization': { label: 'Optimize Connections', icon: <SwapVertIcon /> },
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

  const handleNavigation = async (path: string) => {
    // Update the persistent workflow state to track navigation
    const step = workflowSteps.find(s => s.path === path);
    if (step && persistentWorkflow) {
      // NOTE: navigateToStep requires draftId, skipping for now
    }
    
    // Load full state from draft if available
    const draftId = draftService.getCurrentSessionDraftId();
    let restorationData: any = {
      fromWorkflowNavigation: true
    };
    
    if (draftId) {
      try {
        // Load draft with full state
        const result = await draftService.loadDraftWithFullState(draftId);
        if (result) {
          // Use the restoration data from the draft
          restorationData = {
            ...result.restorationData,
            fromWorkflowNavigation: true
          };
        }
      } catch (error) {
        console.warn('Could not load draft state for navigation:', error);
      }
    }
    
    // Preserve state data from current location or draftWorkflow as fallback
    let timePointData = null;
    let serviceBands = null;
    let blockConfiguration = null;
    
    try {
      // Get data from draftWorkflow if not in restorationData
      if (draftWorkflow && draftWorkflow.stepData) {
        timePointData = restorationData.travelTimeData || draftWorkflow.stepData.timepoints?.travelTimeData || null;
        serviceBands = restorationData.serviceBands || draftWorkflow.stepData.timepoints?.serviceBands || null;
        blockConfiguration = restorationData.blockConfigurations || draftWorkflow.stepData.blockConfiguration || null;
      }
    } catch (error) {
      console.warn('Error accessing draftWorkflow data:', error);
    }
    
    const scheduleState = location.state;
    
    const navigationState: any = {
      ...restorationData,
      timePointData: restorationData.travelTimeData || scheduleState?.timePointData || timePointData,
      serviceBands: restorationData.serviceBands || scheduleState?.serviceBands || serviceBands,
      deletedPeriods: restorationData.deletedPeriods || scheduleState?.deletedPeriods || [],
      timePeriodServiceBands: restorationData.timePeriodServiceBands || scheduleState?.timePeriodServiceBands || {},
      scheduleId: scheduleState?.scheduleId,
      fileName: restorationData.fileName || scheduleState?.fileName,
      blockConfiguration: restorationData.blockConfigurations || scheduleState?.blockConfiguration || blockConfiguration,
      fromWorkflowNavigation: true
    };
    
    // Special handling for Build Schedule page
    if (path === '/block-summary-schedule' && (restorationData.blockConfigurations || blockConfiguration)) {
      // Pass the block configuration data specifically for the Build Schedule page
      navigationState.bus_block_configurations = restorationData.blockConfigurations || blockConfiguration?.blocks || [];
    }
    
    // Only pass state for workflow pages that need it
    const workflowPages = ['/timepoints', '/block-configuration', '/block-summary-schedule'];
    if (workflowPages.includes(path)) {
      navigate(path, { state: navigationState });
    } else {
      navigate(path);
    }
  };

  // Handle draft selection (from StoryboardProgress)
  const handleDraftSelect = (selectedWorkflow: any) => {
    setDraftMenuAnchor(null);
    setDraftWorkflow(selectedWorkflow);
    if (selectedWorkflow.draftId) {
      draftService.setCurrentSessionDraft(selectedWorkflow.draftId);
    }
  };

  // Celebration system (from StoryboardProgress)
  const triggerCelebration = (message: string) => {
    setCelebrationMessage(message);
    // Auto-hide after 5 seconds
    setTimeout(() => setCelebrationMessage(null), 5000);
  };

  // Monitor progress for celebrations
  React.useEffect(() => {
    if (draftWorkflow && draftWorkflow.overallProgress) {
      const progress = draftWorkflow.overallProgress;
      
      // Check for milestone celebrations
      if (progress === 100) {
        if (draftService.shouldShowStoryboardCelebration && draftService.shouldShowStoryboardCelebration(draftWorkflow, 'complete')) {
          triggerCelebration('🎉 Schedule Complete! You\'re a scheduling wizard!');
        }
      } else if (progress >= 50 && progress < 60) {
        if (draftService.shouldShowStoryboardCelebration && draftService.shouldShowStoryboardCelebration(draftWorkflow, 'halfway')) {
          triggerCelebration('🌟 Halfway there! You\'re doing amazing!');
        }
      }
    }
  }, [draftWorkflow?.overallProgress]);

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
          
          {/* Draft Selector (from StoryboardProgress) */}
          {draftWorkflow && (
            <Chip
              label={draftWorkflow.draftName || 'Draft'}
              onClick={(e) => setDraftMenuAnchor(e.currentTarget)}
              onDelete={(e) => setDraftMenuAnchor(e.currentTarget as HTMLElement)}
              deleteIcon={<EditIcon />}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ cursor: 'pointer' }}
            />
          )}
        </Box>

        {/* Enhanced Progress Tracking (from StoryboardProgress) */}
        {showWorkflow && workflowSteps && workflowSteps.length > 0 && (
          <Box>
            {/* Progress Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Workflow Progress
              </Typography>
              {draftWorkflow && (
                <Typography variant="body2" fontWeight="bold" color="primary" sx={{ ml: 'auto' }}>
                  {draftWorkflow.overallProgress || 0}%
                </Typography>
              )}
              <Tooltip title="This shows your progress through the current workflow">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>

            {/* Progress Message */}
            {draftWorkflow && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {draftService.getStoryboardProgressMessage(draftWorkflow.overallProgress || 0)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={draftWorkflow.overallProgress || 0}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                    }
                  }}
                />
              </Box>
            )}


            {/* Compact Step Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {workflowSteps.map((step, index) => (
                <Box 
                  key={step.key}
                  onClick={() => {
                    // Special case: Allow navigation to Build Schedule if block config exists
                    const hasBlockConfig = draftWorkflow?.stepData?.blockConfiguration?.blocks?.length > 0;
                    const canNavigateToBuildSchedule = step.key === 'summary' && hasBlockConfig;
                    
                    const canNavigate = (step.status === 'completed' || step.status === 'active' || canNavigateToBuildSchedule);
                    if (canNavigate) {
                      handleNavigation(step.path);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    p: 1,
                    borderRadius: 2,
                    cursor: (() => {
                      const hasBlockConfig = draftWorkflow?.stepData?.blockConfiguration?.blocks?.length > 0;
                      const canNavigateToBuildSchedule = step.key === 'summary' && hasBlockConfig;
                      return (step.status !== 'pending' || canNavigateToBuildSchedule) ? 'pointer' : 'default';
                    })(),
                    backgroundColor: step.isCurrentPage 
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                    border: step.isCurrentPage
                      ? `1px solid ${theme.palette.primary.main}`
                      : '1px solid transparent',
                    transition: 'all 0.2s ease',
                    opacity: (() => {
                      const hasBlockConfig = draftWorkflow?.stepData?.blockConfiguration?.blocks?.length > 0;
                      const canNavigateToBuildSchedule = step.key === 'summary' && hasBlockConfig;
                      return (step.status === 'pending' && !canNavigateToBuildSchedule) ? 0.6 : 1;
                    })(),
                    animation: step.status === 'active' ? `${pulse} 2s infinite` : 'none',
                    '&:hover': {
                      backgroundColor: (() => {
                        const hasBlockConfig = draftWorkflow?.stepData?.blockConfiguration?.blocks?.length > 0;
                        const canNavigateToBuildSchedule = step.key === 'summary' && hasBlockConfig;
                        return (step.status !== 'pending' || canNavigateToBuildSchedule)
                          ? alpha(theme.palette.primary.main, 0.05)
                          : 'transparent';
                      })(),
                      transform: (() => {
                        const hasBlockConfig = draftWorkflow?.stepData?.blockConfiguration?.blocks?.length > 0;
                        const canNavigateToBuildSchedule = step.key === 'summary' && hasBlockConfig;
                        return (step.status !== 'pending' || canNavigateToBuildSchedule) ? 'translateY(-2px)' : 'none';
                      })(),
                      boxShadow: (() => {
                        const hasBlockConfig = draftWorkflow?.stepData?.blockConfiguration?.blocks?.length > 0;
                        const canNavigateToBuildSchedule = step.key === 'summary' && hasBlockConfig;
                        return (step.status !== 'pending' || canNavigateToBuildSchedule)
                          ? `0 4px 8px ${alpha(theme.palette.primary.main, 0.2)}`
                          : 'none';
                      })(),
                    }
                  }}
                >
                  {getStepIcon(step)}
                  <Typography 
                    variant="caption" 
                    fontWeight={step.isCurrentPage ? 'bold' : 'medium'}
                    color={step.isCurrentPage ? 'primary' : 'text.primary'}
                  >
                    {step.label}
                  </Typography>
                  {index < workflowSteps.length - 1 && (
                    <NavigateNextIcon fontSize="small" color="disabled" sx={{ mx: 0.5 }} />
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Draft selector menu (from StoryboardProgress) */}
        <Menu
          anchorEl={draftMenuAnchor}
          open={Boolean(draftMenuAnchor)}
          onClose={() => setDraftMenuAnchor(null)}
        >
          <MenuItem disabled>
            <Typography variant="caption" color="text.secondary">
              Recent Schedules
            </Typography>
          </MenuItem>
          {allWorkflows.map((w) => (
            <MenuItem
              key={w.draftId}
              onClick={() => handleDraftSelect(w)}
              selected={w.draftId === draftWorkflow?.draftId}
            >
              <Box>
                <Typography variant="body2">{w.draftName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {w.overallProgress || 0}% complete
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>

        {/* Celebration Snackbar (from StoryboardProgress) */}
        <Snackbar
          open={celebrationMessage !== null}
          autoHideDuration={5000}
          onClose={() => setCelebrationMessage(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setCelebrationMessage(null)} 
            severity="success"
            icon={<CelebrationIcon />}
            sx={{ 
              fontSize: '1.1rem',
              alignItems: 'center',
              background: `linear-gradient(45deg, ${theme.palette.success.main} 30%, ${theme.palette.primary.main} 90%)`,
              color: 'white',
              '& .MuiAlert-icon': {
                color: 'white'
              }
            }}
          >
            {celebrationMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Paper>
  );
};

export default WorkflowBreadcrumbs;
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  LinearProgress,
  Chip,
  Collapse,
  Button,
  Menu,
  MenuItem,
  Fade,
  Zoom,
  alpha,
  useTheme,
  keyframes,
  Snackbar,
  Alert
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Drafts as DraftsIcon,
  Timeline as TimelineIcon,
  Build as BuildIcon,
  ViewList as ViewListIcon,
  SwapVert as SwapVertIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayArrow as ActiveIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  DirectionsBus as BusIcon,
  EmojiEvents as TrophyIcon,
  ArrowForward as ArrowIcon,
  Edit as EditIcon,
  Celebration as CelebrationIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { draftWorkflowService, DraftWorkflowState, WorkflowStepData } from '../services/draftWorkflowService';

// Animation keyframes
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

const slideIn = keyframes`
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

interface StoryboardProgressProps {
  draftId?: string;
  draftName?: string;
  compact?: boolean;
  onDraftChange?: (draftId: string) => void;
}

const StoryboardProgress: React.FC<StoryboardProgressProps> = ({
  draftId,
  draftName,
  compact = false,
  onDraftChange
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [workflow, setWorkflow] = useState<DraftWorkflowState | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [draftMenuAnchor, setDraftMenuAnchor] = useState<null | HTMLElement>(null);
  const [allWorkflows, setAllWorkflows] = useState<DraftWorkflowState[]>([]);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [animatingStep, setAnimatingStep] = useState<string | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  // Load workflow on mount and when draftId changes
  useEffect(() => {
    if (draftId) {
      const loadedWorkflow = draftWorkflowService.getOrCreateWorkflow(draftId, draftName);
      setWorkflow(loadedWorkflow);
      draftWorkflowService.setActiveDraft(draftId);
      
      // Update step status based on current location
      updateStepFromLocation(loadedWorkflow);
    } else {
      // Try to load active draft
      const activeDraftId = draftWorkflowService.getActiveDraft();
      if (activeDraftId) {
        const loadedWorkflow = draftWorkflowService.getWorkflow(activeDraftId);
        if (loadedWorkflow) {
          setWorkflow(loadedWorkflow);
          updateStepFromLocation(loadedWorkflow);
        }
      }
    }
    
    // Load all workflows for the selector
    setAllWorkflows(draftWorkflowService.getAllWorkflows());
  }, [draftId, draftName]);

  // Update step status based on current page
  const updateStepFromLocation = (workflow: DraftWorkflowState) => {
    const path = location.pathname;
    let currentStepKey: string | null = null;

    if (path.includes('upload')) currentStepKey = 'upload';
    else if (path.includes('drafts')) currentStepKey = 'drafts';
    else if (path.includes('timepoints')) currentStepKey = 'timepoints';
    else if (path.includes('block-configuration')) currentStepKey = 'block-config';
    else if (path.includes('block-summary-schedule')) currentStepKey = 'summary';
    else if (path.includes('connection-schedule')) currentStepKey = 'connections';

    if (currentStepKey && workflow) {
      const step = workflow.steps.find(s => s.key === currentStepKey);
      if (step && step.status === 'not-started') {
        draftWorkflowService.updateStepStatus(workflow.draftId, currentStepKey, 'in-progress');
        setWorkflow(draftWorkflowService.getWorkflow(workflow.draftId));
      }
    }
  };

  // Get icon component for step
  const getStepIcon = (step: WorkflowStepData) => {
    const iconProps = {
      style: { 
        color: step.status === 'completed' 
          ? theme.palette.success.main 
          : step.status === 'in-progress' 
          ? theme.palette.primary.main 
          : theme.palette.text.disabled 
      }
    };

    if (step.status === 'completed') {
      return <CheckIcon {...iconProps} />;
    }

    switch (step.icon) {
      case 'CloudUpload':
        return <UploadIcon {...iconProps} />;
      case 'Drafts':
        return <DraftsIcon {...iconProps} />;
      case 'Timeline':
        return <TimelineIcon {...iconProps} />;
      case 'Build':
        return <BuildIcon {...iconProps} />;
      case 'ViewList':
        return <ViewListIcon {...iconProps} />;
      case 'SwapVert':
        return <SwapVertIcon {...iconProps} />;
      default:
        return <PendingIcon {...iconProps} />;
    }
  };

  // Navigate to step
  const handleStepClick = (step: WorkflowStepData) => {
    if (!workflow) return;
    
    if (step.status === 'not-started') {
      return; // Can't navigate to not-started steps
    }

    // Map step keys to routes
    const routeMap: { [key: string]: string } = {
      'upload': '/upload',
      'drafts': '/drafts',
      'timepoints': '/timepoints',
      'block-config': '/block-configuration',
      'summary': '/block-summary-schedule',
      'connections': '/connection-schedule'
    };

    const route = routeMap[step.key];
    if (route) {
      // Animate the navigation
      setAnimatingStep(step.key);
      setTimeout(() => {
        navigate(route, { state: { draftId: workflow.draftId, draftName: workflow.draftName } });
        setAnimatingStep(null);
      }, 300);
    }
  };

  // Trigger celebration animation
  const triggerCelebration = (message: string) => {
    setCelebrationMessage(message);
    // Auto-hide after 5 seconds
    setTimeout(() => setCelebrationMessage(null), 5000);
  };

  // Complete current step
  const handleCompleteStep = () => {
    if (!workflow) return;
    
    const updatedWorkflow = draftWorkflowService.completeCurrentStep(workflow.draftId);
    if (updatedWorkflow) {
      setWorkflow(updatedWorkflow);
      
      // Check for milestones
      if (updatedWorkflow.overallProgress === 100) {
        if (draftWorkflowService.shouldShowCelebration(updatedWorkflow, 'complete')) {
          triggerCelebration('🎉 Schedule Complete! You\'re a scheduling wizard!');
        }
      } else if (updatedWorkflow.overallProgress >= 50) {
        if (draftWorkflowService.shouldShowCelebration(updatedWorkflow, 'halfway')) {
          triggerCelebration('🌟 Halfway there! You\'re doing amazing!');
        }
      }
    }
  };

  // Switch to different draft
  const handleDraftSelect = (selectedWorkflow: DraftWorkflowState) => {
    setDraftMenuAnchor(null);
    setWorkflow(selectedWorkflow);
    draftWorkflowService.setActiveDraft(selectedWorkflow.draftId);
    if (onDraftChange) {
      onDraftChange(selectedWorkflow.draftId);
    }
  };

  if (!workflow) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No active schedule workflow. Start by uploading schedule data.
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/upload')}
          sx={{ mt: 2 }}
        >
          Start New Schedule
        </Button>
      </Paper>
    );
  }

  const progressMessage = draftWorkflowService.getProgressMessage(workflow.overallProgress);
  const currentStep = workflow.steps.find(s => s.key === workflow.currentStep);
  const currentTip = currentStep ? draftWorkflowService.getStepTip(currentStep.key) : '';

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)`,
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Header with draft selector and progress */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Schedule Builder
          </Typography>
          <Chip
            label={workflow.draftName}
            onClick={(e) => setDraftMenuAnchor(e.currentTarget)}
            onDelete={() => setDraftMenuAnchor(draftMenuAnchor ? null : document.querySelector('[data-draft-chip]') as HTMLElement)}
            deleteIcon={<EditIcon />}
            data-draft-chip
            sx={{ ml: 1 }}
            color="primary"
            variant="outlined"
          />
        </Box>
        
        <IconButton onClick={() => setExpanded(!expanded)} size="small">
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>

      {/* Draft selector menu */}
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
            selected={w.draftId === workflow.draftId}
          >
            <Box>
              <Typography variant="body2">{w.draftName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {w.overallProgress}% complete
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Progress bar with message */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {progressMessage}
          </Typography>
          <Typography variant="body2" fontWeight="bold" color="primary">
            {workflow.overallProgress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={workflow.overallProgress}
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

      {/* Storyboard panels */}
      <Collapse in={expanded}>
        <Box sx={{ mt: 3 }}>
          {/* Current step tip */}
          {currentTip && (
            <Fade in>
              <Paper
                sx={{
                  p: 1.5,
                  mb: 2,
                  backgroundColor: alpha(theme.palette.info.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  borderRadius: 2
                }}
              >
                <Typography variant="caption" color="info.main" fontStyle="italic">
                  💡 {currentTip}
                </Typography>
              </Paper>
            </Fade>
          )}

          {/* Step panels */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {workflow.steps.map((step, index) => {
              const isActive = step.key === workflow.currentStep;
              const isCompleted = step.status === 'completed';
              const isAccessible = step.status !== 'not-started';
              const isHovered = hoveredStep === step.key;
              const isAnimating = animatingStep === step.key;

              return (
                <Zoom
                  key={step.key}
                  in
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Paper
                    elevation={isHovered ? 8 : isActive ? 4 : 2}
                    sx={{
                      p: 2,
                      cursor: isAccessible ? 'pointer' : 'not-allowed',
                      opacity: isAccessible ? 1 : 0.5,
                      transition: 'all 0.3s ease',
                      transform: isHovered ? 'translateY(-4px)' : 'none',
                      backgroundColor: isCompleted 
                        ? alpha(theme.palette.success.main, 0.05)
                        : isActive
                        ? alpha(theme.palette.primary.main, 0.05)
                        : 'background.paper',
                      border: `2px solid ${
                        isCompleted 
                          ? theme.palette.success.main
                          : isActive
                          ? theme.palette.primary.main
                          : theme.palette.divider
                      }`,
                      position: 'relative',
                      overflow: 'hidden',
                      animation: isActive ? `${pulse} 2s infinite` : isAnimating ? `${glow} 0.5s` : 'none',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: `linear-gradient(90deg, transparent, ${step.color}, transparent)`,
                        opacity: isActive ? 1 : 0,
                        animation: isActive ? `${slideIn} 1s infinite` : 'none'
                      }
                    }}
                    onClick={() => handleStepClick(step)}
                    onMouseEnter={() => setHoveredStep(step.key)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {getStepIcon(step)}
                      {isActive && (
                        <Chip
                          label="Current"
                          size="small"
                          color="primary"
                          sx={{ ml: 'auto', height: 20 }}
                        />
                      )}
                      {isCompleted && (
                        <TrophyIcon
                          sx={{
                            ml: 'auto',
                            color: 'warning.main',
                            fontSize: 20
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      {step.funTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {step.description}
                    </Typography>
                    {step.progress && step.progress > 0 && step.progress < 100 && (
                      <LinearProgress
                        variant="determinate"
                        value={step.progress}
                        sx={{ mt: 1, height: 2, borderRadius: 1 }}
                      />
                    )}
                  </Paper>
                </Zoom>
              );
            })}
          </Box>

          {/* Action buttons */}
          {currentStep && currentStep.status === 'in-progress' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                endIcon={<ArrowIcon />}
                onClick={handleCompleteStep}
                sx={{
                  borderRadius: 3,
                  px: 4,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 6px 10px 4px rgba(33, 203, 243, .3)'
                  }
                }}
              >
                Complete {currentStep.funTitle}
              </Button>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Celebration Snackbar */}
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
    </Paper>
  );
};

export default StoryboardProgress;
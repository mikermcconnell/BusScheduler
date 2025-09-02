import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Stack,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Badge,
  FormHelperText,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress
} from '@mui/material';

// Icons
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import TrainIcon from '@mui/icons-material/Train';
import SchoolIcon from '@mui/icons-material/School';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SettingsIcon from '@mui/icons-material/Settings';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RuleIcon from '@mui/icons-material/Rule';

import { 
  ConnectionType, 
  ConnectionStatus,
  ConnectionPoint,
  ConnectionValidation,
  Schedule,
  Trip,
  TimePoint
} from '../types/schedule';

// Connection theme for priority ranking
interface ConnectionTheme {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: ConnectionType;
  defaultMinTransfer: number;
  defaultMaxWait: number;
  color: string;
  description: string;
  customizable: boolean;
}

// School bell time template
interface SchoolBellTemplate {
  id: string;
  name: string;
  schoolName: string;
  morningBell: string;
  afternoonDismissal: string;
  earlyDismissal?: string;
  lateStart?: string;
  notes?: string;
}

const ConnectionSchedule: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const schedule = location.state?.schedule as Schedule;

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [connectionThemes, setConnectionThemes] = useState<ConnectionTheme[]>([
    {
      id: 'go-train',
      name: 'GO Train Connections',
      icon: <TrainIcon />,
      type: ConnectionType.GO_TRAIN,
      defaultMinTransfer: 10,
      defaultMaxWait: 15,
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      description: 'Coordinate with GO train arrivals and departures',
      customizable: false
    },
    {
      id: 'school-bell',
      name: 'High School Bell Times',
      icon: <SchoolIcon />,
      type: ConnectionType.SCHOOL_BELL,
      defaultMinTransfer: 10,
      defaultMaxWait: 15,
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      description: 'Ensure timely arrival for school start times',
      customizable: false
    },
    {
      id: 'inter-route',
      name: 'Inter-route Transfers',
      icon: <DirectionsBusIcon />,
      type: ConnectionType.BUS_ROUTE,
      defaultMinTransfer: 5,
      defaultMaxWait: 10,
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      description: 'Connect with other bus routes at transfer points',
      customizable: false
    }
  ]);

  const [connections, setConnections] = useState<ConnectionPoint[]>([]);
  const [validations, setValidations] = useState<ConnectionValidation[]>([]);
  const [schoolTemplates, setSchoolTemplates] = useState<SchoolBellTemplate[]>([]);
  const [goTrainTemplates, setGoTrainTemplates] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [addConnectionDialog, setAddConnectionDialog] = useState(false);
  const [addThemeDialog, setAddThemeDialog] = useState(false);
  const [schoolTemplateDialog, setSchoolTemplateDialog] = useState(false);
  const [goTrainImportDialog, setGoTrainImportDialog] = useState(false);
  const [draggedThemeId, setDraggedThemeId] = useState<string | null>(null);
  const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null);
  const [customThemeName, setCustomThemeName] = useState('');
  const [customThemeType, setCustomThemeType] = useState(ConnectionType.BUS_ROUTE);
  const [customMinTransfer, setCustomMinTransfer] = useState(5);
  const [customMaxWait, setCustomMaxWait] = useState(15);
  
  // Workflow progress state
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(0);
  
  // Workflow steps definition
  const workflowSteps = [
    {
      label: 'Set Priority Ranking',
      description: 'Arrange connection types by priority',
      icon: <PriorityHighIcon />,
      isComplete: connectionThemes.length > 0
    },
    {
      label: 'Add Connections',
      description: 'Define specific connection requirements',
      icon: <ConnectWithoutContactIcon />,
      isComplete: connections.length > 0
    },
    {
      label: 'Import Templates',
      description: 'Import GO Train or School schedules (optional)',
      icon: <UploadFileIcon />,
      isComplete: goTrainTemplates.length > 0 || schoolTemplates.length > 0
    },
    {
      label: 'Validate Schedule',
      description: 'Check for conflicts and timing issues',
      icon: <RuleIcon />,
      isComplete: validations.length > 0 && validations.every(v => v.status === ConnectionStatus.MET)
    },
    {
      label: 'Generate Schedule',
      description: 'Create final connection schedule',
      icon: <ScheduleIcon />,
      isComplete: false // This would be set when schedule is generated
    }
  ];
  
  // Auto-update workflow step based on completion
  useEffect(() => {
    const completedSteps = workflowSteps.filter(step => step.isComplete).length;
    setCurrentWorkflowStep(Math.min(completedSteps, workflowSteps.length - 1));
  }, [connectionThemes.length, connections.length, goTrainTemplates.length, schoolTemplates.length, validations.length]);

  // Load saved templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem('schoolBellTemplates');
    if (savedTemplates) {
      setSchoolTemplates(JSON.parse(savedTemplates));
    }

    const savedConnections = localStorage.getItem(`connections-${schedule?.id}`);
    if (savedConnections) {
      setConnections(JSON.parse(savedConnections));
    }
  }, [schedule?.id]);

  // Save connections when changed
  useEffect(() => {
    if (connections.length > 0 && schedule?.id) {
      localStorage.setItem(`connections-${schedule.id}`, JSON.stringify(connections));
    }
  }, [connections, schedule?.id]);

  // Drag and drop handlers for priority ranking with enhanced feedback
  const handleDragStart = (e: React.DragEvent, themeId: string) => {
    setDraggedThemeId(themeId);
    e.dataTransfer.effectAllowed = 'move';
    // Add visual feedback
    const draggedElement = e.currentTarget as HTMLElement;
    draggedElement.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const draggedElement = e.currentTarget as HTMLElement;
    draggedElement.style.opacity = '1';
    setDraggedThemeId(null);
    setDragOverThemeId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (themeId: string) => {
    setDragOverThemeId(themeId);
  };

  const handleDragLeave = () => {
    // Small timeout to prevent flicker
    setTimeout(() => {
      setDragOverThemeId(null);
    }, 50);
  };

  const handleDrop = (e: React.DragEvent, targetThemeId: string) => {
    e.preventDefault();
    if (!draggedThemeId || draggedThemeId === targetThemeId) return;

    const draggedIndex = connectionThemes.findIndex(t => t.id === draggedThemeId);
    const targetIndex = connectionThemes.findIndex(t => t.id === targetThemeId);

    const newThemes = [...connectionThemes];
    const [draggedTheme] = newThemes.splice(draggedIndex, 1);
    newThemes.splice(targetIndex, 0, draggedTheme);

    setConnectionThemes(newThemes);
    setDraggedThemeId(null);
    setDragOverThemeId(null);
  };

  // Add custom connection theme
  const handleAddTheme = () => {
    if (!customThemeName.trim()) {
      alert('Please enter a theme name');
      return;
    }
    
    const newTheme: ConnectionTheme = {
      id: `custom-${Date.now()}`,
      name: customThemeName,
      icon: <SwapVertIcon />,
      type: customThemeType,
      defaultMinTransfer: customMinTransfer,
      defaultMaxWait: customMaxWait,
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      description: `${customThemeName} - Custom priority`,
      customizable: true
    };
    setConnectionThemes([...connectionThemes, newTheme]);
    
    // Reset form
    setCustomThemeName('');
    setCustomThemeType(ConnectionType.BUS_ROUTE);
    setCustomMinTransfer(5);
    setCustomMaxWait(15);
    setAddThemeDialog(false);
  };

  // Validate connections
  const validateConnections = useCallback(() => {
    const newValidations: ConnectionValidation[] = connections.map(conn => {
      // TODO(human): Implement validation logic based on schedule times
      // Check if trips meet connection requirements
      const validation: ConnectionValidation = {
        connectionId: conn.id,
        status: ConnectionStatus.PENDING,
        affectedTrips: [],
        message: 'Validation pending'
      };
      
      return validation;
    });
    setValidations(newValidations);
  }, [connections]);

  // Connection status chip component
  const ConnectionStatusChip = ({ status }: { status: ConnectionStatus }) => {
    const configs = {
      [ConnectionStatus.MET]: { 
        color: 'success' as const, 
        icon: <CheckCircleIcon fontSize="small" />, 
        label: 'Connected' 
      },
      [ConnectionStatus.AT_RISK]: { 
        color: 'warning' as const, 
        icon: <WarningIcon fontSize="small" />, 
        label: 'Tight Connection' 
      },
      [ConnectionStatus.FAILED]: { 
        color: 'error' as const, 
        icon: <ErrorIcon fontSize="small" />, 
        label: 'Failed' 
      },
      [ConnectionStatus.PENDING]: { 
        color: 'default' as const, 
        icon: <InfoIcon fontSize="small" />, 
        label: 'Pending' 
      }
    };

    const config = configs[status];
    return (
      <Chip
        label={config.label}
        color={config.color}
        icon={config.icon}
        size="small"
        sx={{ fontWeight: 'medium' }}
      />
    );
  };

  // Priority theme card component
  const PriorityThemeCard = ({ theme, index }: { theme: ConnectionTheme; index: number }) => {
    const isDraggedOver = dragOverThemeId === theme.id;
    const isDragging = draggedThemeId === theme.id;
    
    return (
      <Paper
        draggable
        onDragStart={(e) => handleDragStart(e, theme.id)}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={() => handleDragEnter(theme.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, theme.id)}
        sx={{
          p: 2,
          mb: 2,
          background: theme.color,
          color: 'white',
          cursor: 'grab',
          borderRadius: 3,
          boxShadow: isDraggedOver ? '0 8px 16px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
          transform: isDraggedOver ? 'scale(1.02)' : isDragging ? 'scale(0.98)' : 'scale(1)',
          border: isDraggedOver ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
          opacity: isDragging ? 0.5 : 1,
          '&:hover': {
            transform: isDraggedOver ? 'scale(1.02)' : 'translateY(-2px) scale(1.01)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
            cursor: 'grab'
          },
          '&:active': {
            cursor: 'grabbing'
          }
        }}
      >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <DragIndicatorIcon />
          <Badge badgeContent={index + 1} color="secondary">
            {theme.icon}
          </Badge>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {theme.name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {theme.description}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Transfer: {theme.defaultMinTransfer}min | Max wait: {theme.defaultMaxWait}min
            </Typography>
          </Box>
        </Box>
        {theme.customizable && (
          <IconButton 
            size="small" 
            onClick={() => {
              setConnectionThemes(connectionThemes.filter(t => t.id !== theme.id));
            }}
            sx={{ color: 'white' }}
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>
    </Paper>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderRadius: 0 }} elevation={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/block-summary-schedule', { state: { schedule } })}>
              <NavigateBeforeIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Connection Schedule
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure connections to GO trains, schools, and other routes
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={2}>
            <Chip 
              label={`${connections.length} connections`} 
              color="primary" 
            />
            <Button 
              variant="contained"
              endIcon={<NavigateNextIcon />}
              onClick={() => navigate('/final-schedule', { state: { schedule, connections } })}
            >
              Continue to Final Schedule
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Workflow Progress Bar */}
      <Paper sx={{ p: 2, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'medium' }}>
            Connection Configuration Workflow
          </Typography>
          
          {/* Progress indicator */}
          <Box sx={{ mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={(currentWorkflowStep / (workflowSteps.length - 1)) * 100} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #4CAF50 0%, #2196F3 100%)'
                }
              }}
            />
          </Box>
          
          {/* Steps display */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            {workflowSteps.map((step, index) => (
              <Box 
                key={index} 
                sx={{ 
                  flex: '1 1 150px',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  opacity: index <= currentWorkflowStep ? 1 : 0.5,
                  transition: 'all 0.3s ease'
                }}
              >
                <Box sx={{ 
                  color: step.isComplete ? 'success.main' : index === currentWorkflowStep ? 'primary.main' : 'grey.400',
                  transition: 'color 0.3s ease'
                }}>
                  {step.isComplete ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />}
                </Box>
                <Box>
                  <Typography 
                    variant="body2" 
                    fontWeight={index === currentWorkflowStep ? 'bold' : 'medium'}
                    color={index === currentWorkflowStep ? 'primary' : 'text.primary'}
                  >
                    {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Connection Management */}
        <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
          <Box sx={{ p: 3 }}>
            {/* Priority Ranking Section */}
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PriorityHighIcon /> Connection Priority Ranking
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Drag and drop</strong> cards to reorder priorities. Higher ranked connections 
                (top of list) will be preserved when scheduling conflicts occur. Visual feedback shows 
                when you're hovering over a valid drop zone.
              </Typography>
            </Alert>
            
            <Box sx={{ mt: 2, mb: 3 }}>
              {connectionThemes.map((theme, index) => (
                <PriorityThemeCard key={theme.id} theme={theme} index={index} />
              ))}
            </Box>

            <Button
              variant="outlined"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => setAddThemeDialog(true)}
              sx={{ mb: 3 }}
            >
              Add Custom Connection Theme
            </Button>

            <Divider sx={{ my: 3 }} />

            {/* Quick Actions */}
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<UploadFileIcon />}
                onClick={() => setGoTrainImportDialog(true)}
              >
                Import GO Train Schedule
              </Button>
              <Button
                variant="contained"
                fullWidth
                startIcon={<SchoolIcon />}
                onClick={() => setSchoolTemplateDialog(true)}
              >
                Manage School Bell Times
              </Button>
              <Button
                variant="contained"
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => setAddConnectionDialog(true)}
              >
                Add Connection Point
              </Button>
            </Stack>

            <Divider sx={{ my: 3 }} />

            {/* Connection Tabs */}
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
              <Tab icon={<DirectionsBusIcon />} label="Routes" />
              <Tab icon={<TrainIcon />} label="GO Trains" />
              <Tab icon={<SchoolIcon />} label="Schools" />
            </Tabs>

            {/* Connection List */}
            <List sx={{ mt: 2 }}>
              {connections
                .filter(conn => {
                  if (activeTab === 0) return conn.type === ConnectionType.BUS_ROUTE;
                  if (activeTab === 1) return conn.type === ConnectionType.GO_TRAIN;
                  if (activeTab === 2) return conn.type === ConnectionType.SCHOOL_BELL;
                  return true;
                })
                .map(conn => {
                  const validation = validations.find(v => v.connectionId === conn.id);
                  return (
                    <ListItem 
                      key={conn.id}
                      sx={{ borderRadius: 2, mb: 1, p: 0 }}
                      secondaryAction={
                        <IconButton size="small" edge="end">
                          <EditIcon />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        selected={selectedConnection === conn.id}
                        onClick={() => setSelectedConnection(conn.id)}
                      >
                        <ListItemIcon>
                          {conn.type === ConnectionType.GO_TRAIN && <TrainIcon />}
                          {conn.type === ConnectionType.SCHOOL_BELL && <SchoolIcon />}
                          {conn.type === ConnectionType.BUS_ROUTE && <DirectionsBusIcon />}
                        </ListItemIcon>
                        <ListItemText
                          primary={conn.targetServiceName}
                          secondary={
                            <Box>
                              <Typography variant="caption">
                                {conn.locationName} • {conn.minimumTransferTime}min transfer
                              </Typography>
                              {validation && (
                                <Box sx={{ mt: 0.5 }}>
                                  <ConnectionStatusChip status={validation.status} />
                                </Box>
                              )}
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
            </List>
          </Box>
        </Box>

        {/* Right Panel - Schedule Visualization */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Schedule with Connections
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Visual timeline showing how your schedule aligns with connection points
              </Typography>
              
              {/* TODO(human): Implement schedule visualization with connection overlay */}
              <Box sx={{ 
                mt: 3, 
                p: 4, 
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                textAlign: 'center' 
              }}>
                <Typography color="text.secondary">
                  Schedule timeline with connection points will be displayed here
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Connection Details */}
          {selectedConnection && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Connection Details
                </Typography>
                {/* Display selected connection details */}
                <Box sx={{ mt: 2 }}>
                  <Alert severity="info">
                    Connection configuration and affected trips will be shown here
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Validation Status Bar */}
      <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }} elevation={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" gap={2}>
            <Chip 
              label={`${validations.filter(v => v.status === ConnectionStatus.MET).length} met`}
              color="success"
              size="small"
            />
            <Chip 
              label={`${validations.filter(v => v.status === ConnectionStatus.AT_RISK).length} at risk`}
              color="warning"
              size="small"
            />
            <Chip 
              label={`${validations.filter(v => v.status === ConnectionStatus.FAILED).length} failed`}
              color="error"
              size="small"
            />
          </Box>
          <Button 
            variant="outlined" 
            startIcon={<CheckCircleIcon />}
            onClick={validateConnections}
          >
            Validate All Connections
          </Button>
        </Box>
      </Paper>

      {/* Add Custom Theme Dialog */}
      <Dialog open={addThemeDialog} onClose={() => {
        setAddThemeDialog(false);
        setCustomThemeName('');
        setCustomThemeType(ConnectionType.BUS_ROUTE);
        setCustomMinTransfer(5);
        setCustomMaxWait(15);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Add Custom Connection Theme</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Theme Name"
              placeholder="e.g., Express Bus Connections"
              value={customThemeName}
              onChange={(e) => setCustomThemeName(e.target.value)}
              fullWidth
              autoFocus
              required
              helperText="This name will be displayed for your custom theme"
            />
            <FormControl fullWidth>
              <InputLabel>Connection Type</InputLabel>
              <Select 
                value={customThemeType}
                onChange={(e) => setCustomThemeType(e.target.value as ConnectionType)}
                label="Connection Type"
              >
                <MenuItem value={ConnectionType.BUS_ROUTE}>Bus Route</MenuItem>
                <MenuItem value={ConnectionType.GO_TRAIN}>GO Train</MenuItem>
                <MenuItem value={ConnectionType.SCHOOL_BELL}>School</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Minimum Transfer Time (minutes)"
              type="number"
              value={customMinTransfer}
              onChange={(e) => setCustomMinTransfer(parseInt(e.target.value) || 5)}
              fullWidth
              inputProps={{ min: 1, max: 60 }}
            />
            <TextField
              label="Maximum Wait Time (minutes)"
              type="number"
              value={customMaxWait}
              onChange={(e) => setCustomMaxWait(parseInt(e.target.value) || 15)}
              fullWidth
              inputProps={{ min: 1, max: 120 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddThemeDialog(false);
            setCustomThemeName('');
            setCustomThemeType(ConnectionType.BUS_ROUTE);
            setCustomMinTransfer(5);
            setCustomMaxWait(15);
          }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddTheme}
            disabled={!customThemeName.trim()}
          >
            Add Theme
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConnectionSchedule;
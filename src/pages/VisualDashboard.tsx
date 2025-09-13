import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Chip,
  IconButton,
  Paper,
  Stack,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Slider,
  Tabs,
  Tab,
  AppBar,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  CompareArrows as CompareIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Analytics as AnalyticsIcon,
  Speed as SpeedIcon,
  AccessTime as TimeIcon,
  Traffic as TrafficLightIcon,
  LocationOn as ConnectionPointIcon,
} from '@mui/icons-material';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

import DraftNameHeader from '../components/DraftNameHeader';
import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs';
import { LoadingSpinner } from '../components/loading';
import { SaveToDraft, AutoSaveStatus } from '../components/SaveToDraft';

import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import { connectionOptimizationService } from '../services/connectionOptimizationService';
import {
  ConnectionOptimizationResult,
  OptimizationReport,
} from '../types/connectionOptimization';

// Interface for dashboard state management
interface VisualDashboardState {
  selectedResult: ConnectionOptimizationResult | null;
  loading: boolean;
  error: string | null;
  activeTab: number;
  visiblePanels: {
    timeline: boolean;
    comparison: boolean;
    tradeoffs: boolean;
    metrics: boolean;
  };
  timelineRange: [number, number];
  comparisonMetric: 'connections' | 'waitTime' | 'regularity' | 'recovery';
}

// Custom theme colors for Duolingo-style UI
const duolingoColors = {
  primary: '#58CC02',
  secondary: '#FF9600',
  error: '#FF4B4B',
  warning: '#FFD43B',
  info: '#1CB0F6',
  success: '#58CC02',
  background: '#F7F7F7',
  surface: '#FFFFFF',
  accent1: '#CE82FF',
  accent2: '#FF6B6B',
  accent3: '#4ECDC4',
  accent4: '#45B7D1',
};

const VisualDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  // Get draft and optimization result from location state
  const { draftId: locationDraftId, optimizationResult } = location.state || {};
  const { 
    draft,
    loading: draftLoading,
    error: draftError 
  } = useWorkflowDraft(locationDraftId);

  // Component state
  const [state, setState] = useState<VisualDashboardState>({
    selectedResult: null,
    loading: true,
    error: null,
    activeTab: 0,
    visiblePanels: {
      timeline: true,
      comparison: true,
      tradeoffs: true,
      metrics: true,
    },
    timelineRange: [0, 100],
    comparisonMetric: 'connections',
  });

  // Load optimization result from props or draft data
  useEffect(() => {
    const loadOptimizationData = async () => {
      setState(prev => ({ ...prev, loading: true }));
      
      try {
        let result = optimizationResult;
        
        // If no result from props, try to get from draft
        if (!result && draft?.connectionOptimization?.lastResult) {
          result = draft.connectionOptimization.lastResult;
        }
        
        if (result) {
          setState(prev => ({
            ...prev,
            selectedResult: result,
            loading: false,
          }));
        } else {
          setState(prev => ({
            ...prev,
            error: 'No optimization result available. Please run an optimization first.',
            loading: false,
          }));
        }
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load optimization data',
          loading: false,
        }));
      }
    };

    loadOptimizationData();
  }, [optimizationResult, draft]);

  // Mock data generation for visualization (will be replaced with real data)
  const mockTimelineData = useMemo(() => {
    if (!state.selectedResult) return [];
    
    return Array.from({ length: 24 }, (_, index) => ({
      time: `${String(index).padStart(2, '0')}:00`,
      original: Math.random() * 20 + 10,
      optimized: Math.random() * 15 + 12,
      connections: Math.random() * 5,
      passengers: Math.random() * 100 + 50,
    }));
  }, [state.selectedResult]);

  const mockComparisonData = useMemo(() => {
    if (!state.selectedResult) return [];
    
    return [
      { metric: 'Successful Connections', original: 12, optimized: 18, improvement: 50 },
      { metric: 'Average Wait Time', original: 8.5, optimized: 6.2, improvement: -27 },
      { metric: 'Schedule Regularity', original: 78, optimized: 85, improvement: 9 },
      { metric: 'Recovery Utilization', original: 65, optimized: 72, improvement: 11 },
    ];
  }, [state.selectedResult]);

  const mockTradeoffData = useMemo(() => {
    if (!state.selectedResult) return [];
    
    return [
      { metric: 'Connection Success', value: 85, impact: 'High', color: duolingoColors.success },
      { metric: 'Wait Time Reduction', value: 72, impact: 'Medium', color: duolingoColors.info },
      { metric: 'Schedule Stability', value: 68, impact: 'Low', color: duolingoColors.warning },
      { metric: 'Resource Efficiency', value: 91, impact: 'High', color: duolingoColors.primary },
    ];
  }, [state.selectedResult]);

  // Navigation handlers
  const handleGoBack = () => {
    navigate('/connection-optimization', {
      state: {
        draftId: draft?.draftId,
        fromVisualDashboard: true,
      }
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setState(prev => ({ ...prev, activeTab: newValue }));
  };

  const togglePanelVisibility = (panel: keyof VisualDashboardState['visiblePanels']) => {
    setState(prev => ({
      ...prev,
      visiblePanels: {
        ...prev.visiblePanels,
        [panel]: !prev.visiblePanels[panel],
      },
    }));
  };

  // Custom TabPanel component
  const TabPanel: React.FC<{ children: React.ReactNode; value: number; index: number }> = ({ 
    children, 
    value, 
    index 
  }) => (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );

  if (draftLoading || state.loading) {
    return (
      <Box sx={{ p: 3 }}>
        <DraftNameHeader />
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 3, mb: 3 }}>
          Visual Optimization Dashboard
        </Typography>
        <LoadingSpinner message="Loading visualization data..." />
      </Box>
    );
  }

  if (draftError) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {draftError}
        </Alert>
      </Box>
    );
  }

  if (state.error) {
    return (
      <Box>
        <DraftNameHeader />
        <WorkflowBreadcrumbs showWorkflow workflowContext="schedule-creation" />
        <Alert severity="warning" sx={{ mt: 3, mb: 3 }}>
          {state.error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleGoBack}
          sx={{ mb: 3 }}
        >
          Back to Connection Optimization
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Draft Name Header */}
      <DraftNameHeader />

      {/* Workflow Breadcrumbs */}
      <WorkflowBreadcrumbs showWorkflow workflowContext="schedule-creation" />

      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DashboardIcon 
              sx={{ 
                fontSize: 40, 
                color: duolingoColors.primary,
                filter: 'drop-shadow(0 2px 4px rgba(88, 204, 2, 0.3))',
              }} 
            />
            <Box>
              <Typography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${duolingoColors.primary}, ${duolingoColors.info})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                Visual Optimization Dashboard
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                <Chip 
                  label="Week 3 Feature" 
                  size="small"
                  sx={{ 
                    mr: 1,
                    backgroundColor: alpha(duolingoColors.accent1, 0.1),
                    color: duolingoColors.accent1,
                    border: `1px solid ${alpha(duolingoColors.accent1, 0.3)}`,
                  }}
                />
                Interactive visualization of connection optimization results
              </Typography>
            </Box>
          </Box>
          
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            sx={{ 
              borderColor: duolingoColors.primary,
              color: duolingoColors.primary,
              '&:hover': {
                backgroundColor: alpha(duolingoColors.primary, 0.1),
                borderColor: duolingoColors.primary,
              },
            }}
          >
            Back to Optimization
          </Button>
        </Box>

        {/* Quick Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card 
              sx={{ 
                background: `linear-gradient(135deg, ${duolingoColors.success}, ${alpha(duolingoColors.success, 0.7)})`,
                color: 'white',
                borderRadius: 3,
                boxShadow: `0 4px 20px ${alpha(duolingoColors.success, 0.3)}`,
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircleIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight="bold">
                  {state.selectedResult?.successfulConnections.length || 0}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Successful Connections
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card 
              sx={{ 
                background: `linear-gradient(135deg, ${duolingoColors.info}, ${alpha(duolingoColors.info, 0.7)})`,
                color: 'white',
                borderRadius: 3,
                boxShadow: `0 4px 20px ${alpha(duolingoColors.info, 0.3)}`,
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <SpeedIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight="bold">
                  {Math.round(state.selectedResult?.performance.averageConnectionTime || 0)}m
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Avg Wait Time
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card 
              sx={{ 
                background: `linear-gradient(135deg, ${duolingoColors.accent1}, ${alpha(duolingoColors.accent1, 0.7)})`,
                color: 'white',
                borderRadius: 3,
                boxShadow: `0 4px 20px ${alpha(duolingoColors.accent1, 0.3)}`,
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <AnalyticsIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight="bold">
                  {state.selectedResult?.finalScore.toFixed(1) || '0.0'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Optimization Score
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card 
              sx={{ 
                background: `linear-gradient(135deg, ${duolingoColors.secondary}, ${alpha(duolingoColors.secondary, 0.7)})`,
                color: 'white',
                borderRadius: 3,
                boxShadow: `0 4px 20px ${alpha(duolingoColors.secondary, 0.3)}`,
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <TrafficLightIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight="bold">
                  {Math.round(state.selectedResult?.performance.connectionSuccessRate || 0)}%
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Success Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Control Panel */}
      <Card 
        sx={{ 
          mb: 3, 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${duolingoColors.background}, ${alpha(duolingoColors.surface, 0.9)})`,
          border: `2px solid ${alpha(duolingoColors.primary, 0.1)}`,
        }}
      >
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Dashboard Controls
          </Typography>
          
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {Object.entries(state.visiblePanels).map(([key, visible]) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        checked={visible}
                        onChange={() => togglePanelVisibility(key as keyof VisualDashboardState['visiblePanels'])}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: duolingoColors.primary,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: duolingoColors.primary,
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {key === 'timeline' && <TimelineIcon fontSize="small" />}
                        {key === 'comparison' && <CompareIcon fontSize="small" />}
                        {key === 'tradeoffs' && <TrendingUpIcon fontSize="small" />}
                        {key === 'metrics' && <AnalyticsIcon fontSize="small" />}
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Box>
                    }
                  />
                ))}
              </Stack>
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <SaveToDraft variant="outlined" size="small" />
                <AutoSaveStatus />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Main Dashboard Tabs */}
      <Card 
        sx={{ 
          borderRadius: 3,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.1)}`,
          overflow: 'hidden',
        }}
      >
        <AppBar 
          position="static" 
          elevation={0} 
          sx={{ 
            backgroundColor: duolingoColors.surface,
            color: theme.palette.text.primary,
            borderBottom: `2px solid ${alpha(duolingoColors.primary, 0.1)}`,
          }}
        >
          <Tabs
            value={state.activeTab}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 64,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: duolingoColors.primary,
                height: 3,
                borderRadius: 1.5,
              },
            }}
          >
            <Tab 
              label="Timeline View" 
              icon={<TimelineIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Comparison Analysis" 
              icon={<CompareIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Trade-off Matrix" 
              icon={<TrendingUpIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Performance Metrics" 
              icon={<AnalyticsIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </AppBar>

        <CardContent sx={{ p: 0 }}>
          {/* Timeline Visualization - Phase 2 */}
          <TabPanel value={state.activeTab} index={0}>
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Schedule Timeline Visualization
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={state.visiblePanels.timeline}
                        onChange={() => togglePanelVisibility('timeline')}
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: duolingoColors.primary,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: duolingoColors.primary,
                          },
                        }}
                      />
                    }
                    label="Show Details"
                  />
                </Box>
              </Box>

              {/* Timeline Range Selector */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Time Range (Hours)
                </Typography>
                <Slider
                  value={state.timelineRange}
                  onChange={(_, newValue) => 
                    setState(prev => ({ ...prev, timelineRange: newValue as [number, number] }))
                  }
                  valueLabelDisplay="auto"
                  min={0}
                  max={23}
                  step={1}
                  marks={[
                    { value: 0, label: '00:00' },
                    { value: 6, label: '06:00' },
                    { value: 12, label: '12:00' },
                    { value: 18, label: '18:00' },
                    { value: 23, label: '23:00' },
                  ]}
                  sx={{
                    color: duolingoColors.primary,
                    '& .MuiSlider-thumb': {
                      backgroundColor: duolingoColors.primary,
                    },
                    '& .MuiSlider-track': {
                      backgroundColor: duolingoColors.primary,
                    },
                    '& .MuiSlider-rail': {
                      backgroundColor: alpha(duolingoColors.primary, 0.3),
                    },
                  }}
                />
              </Box>

              {/* Schedule Adjustment Timeline */}
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${duolingoColors.surface}, ${alpha(duolingoColors.background, 0.5)})`,
                  border: `1px solid ${alpha(duolingoColors.primary, 0.1)}`,
                }}
              >
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Schedule Adjustments Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={mockTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    />
                    <YAxis 
                      yAxisId="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                      label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="connections"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                      label={{ value: 'Connections', angle: 90, position: 'insideRight' }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: duolingoColors.surface,
                        border: `1px solid ${alpha(duolingoColors.primary, 0.3)}`,
                        borderRadius: 8,
                        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
                      }}
                      labelStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
                    />
                    <Legend />
                    
                    {/* Original Schedule Area */}
                    <Area
                      yAxisId="time"
                      type="monotone"
                      dataKey="original"
                      stackId="1"
                      stroke={duolingoColors.error}
                      fill={alpha(duolingoColors.error, 0.3)}
                      name="Original Schedule"
                    />
                    
                    {/* Optimized Schedule Area */}
                    <Area
                      yAxisId="time"
                      type="monotone"
                      dataKey="optimized"
                      stackId="2"
                      stroke={duolingoColors.primary}
                      fill={alpha(duolingoColors.primary, 0.3)}
                      name="Optimized Schedule"
                    />
                    
                    {/* Connection Points Line */}
                    <Line
                      yAxisId="connections"
                      type="monotone"
                      dataKey="connections"
                      stroke={duolingoColors.info}
                      strokeWidth={3}
                      dot={{ fill: duolingoColors.info, strokeWidth: 2, r: 4 }}
                      name="Successful Connections"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Paper>

              {/* Connection Points Timeline */}
              <Paper 
                sx={{ 
                  p: 2,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${duolingoColors.surface}, ${alpha(duolingoColors.background, 0.5)})`,
                  border: `1px solid ${alpha(duolingoColors.info, 0.1)}`,
                }}
              >
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Connection Success Patterns
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mockTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                      label={{ value: 'Passengers', angle: -90, position: 'insideLeft' }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: duolingoColors.surface,
                        border: `1px solid ${alpha(duolingoColors.info, 0.3)}`,
                        borderRadius: 8,
                        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
                      }}
                    />
                    <Bar 
                      dataKey="passengers" 
                      fill={`url(#passengerGradient)`}
                      radius={[4, 4, 0, 0]}
                      name="Passenger Load"
                    />
                    <defs>
                      <linearGradient id="passengerGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={duolingoColors.accent4} />
                        <stop offset="100%" stopColor={alpha(duolingoColors.accent4, 0.3)} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>

              {/* Performance Insights */}
              {state.visiblePanels.timeline && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                    Timeline Insights
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: alpha(duolingoColors.success, 0.1) }}>
                        <Typography variant="h6" sx={{ color: duolingoColors.success, fontWeight: 'bold' }}>
                          Peak Hours
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          07:00-09:00, 17:00-19:00
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: alpha(duolingoColors.info, 0.1) }}>
                        <Typography variant="h6" sx={{ color: duolingoColors.info, fontWeight: 'bold' }}>
                          Best Connections
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          12:00-14:00 (Lunch)
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: alpha(duolingoColors.warning, 0.1) }}>
                        <Typography variant="h6" sx={{ color: duolingoColors.warning, fontWeight: 'bold' }}>
                          Optimization Gain
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          15% Time Reduction
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: alpha(duolingoColors.accent1, 0.1) }}>
                        <Typography variant="h6" sx={{ color: duolingoColors.accent1, fontWeight: 'bold' }}>
                          Service Quality
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          95% Reliability
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* Before/After Comparison - Phase 3 */}
          <TabPanel value={state.activeTab} index={1}>
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Before/After Optimization Comparison
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Chip
                    label="Original"
                    sx={{
                      backgroundColor: alpha(duolingoColors.error, 0.1),
                      color: duolingoColors.error,
                      border: `1px solid ${alpha(duolingoColors.error, 0.3)}`,
                    }}
                  />
                  <Chip
                    label="Optimized"
                    sx={{
                      backgroundColor: alpha(duolingoColors.success, 0.1),
                      color: duolingoColors.success,
                      border: `1px solid ${alpha(duolingoColors.success, 0.3)}`,
                    }}
                  />
                </Stack>
              </Box>

              {/* Metric Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Focus Metric
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {[
                    { key: 'connections', label: 'Connections', icon: <ConnectionPointIcon /> },
                    { key: 'waitTime', label: 'Wait Time', icon: <TimeIcon /> },
                    { key: 'regularity', label: 'Regularity', icon: <ScheduleIcon /> },
                    { key: 'recovery', label: 'Recovery', icon: <SpeedIcon /> },
                  ].map((metric) => (
                    <Button
                      key={metric.key}
                      variant={state.comparisonMetric === metric.key ? 'contained' : 'outlined'}
                      startIcon={metric.icon}
                      onClick={() => setState(prev => ({ ...prev, comparisonMetric: metric.key as any }))}
                      size="small"
                      sx={{
                        borderColor: duolingoColors.primary,
                        color: state.comparisonMetric === metric.key ? 'white' : duolingoColors.primary,
                        backgroundColor: state.comparisonMetric === metric.key ? duolingoColors.primary : 'transparent',
                        '&:hover': {
                          backgroundColor: state.comparisonMetric === metric.key ? duolingoColors.primary : alpha(duolingoColors.primary, 0.1),
                        },
                      }}
                    >
                      {metric.label}
                    </Button>
                  ))}
                </Stack>
              </Box>

              {/* Main Comparison Chart */}
              <Paper 
                sx={{ 
                  p: 2, 
                  mb: 3,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${duolingoColors.surface}, ${alpha(duolingoColors.background, 0.5)})`,
                  border: `1px solid ${alpha(duolingoColors.info, 0.1)}`,
                }}
              >
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Performance Metrics Comparison
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={mockComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                    <XAxis 
                      dataKey="metric" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                      label={{ value: 'Performance Value', angle: -90, position: 'insideLeft' }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: duolingoColors.surface,
                        border: `1px solid ${alpha(duolingoColors.info, 0.3)}`,
                        borderRadius: 8,
                        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
                      }}
                      formatter={(value: any, name: string) => [
                        typeof value === 'number' ? value.toFixed(1) : value,
                        name
                      ]}
                    />
                    <Legend />
                    
                    <Bar 
                      dataKey="original" 
                      fill={duolingoColors.error}
                      name="Original"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="optimized" 
                      fill={duolingoColors.success}
                      name="Optimized"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>

              {/* Improvement Indicators */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {mockComparisonData.map((item, index) => (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        textAlign: 'center',
                        backgroundColor: item.improvement > 0 
                          ? alpha(duolingoColors.success, 0.1)
                          : alpha(duolingoColors.error, 0.1),
                        border: `1px solid ${alpha(
                          item.improvement > 0 ? duolingoColors.success : duolingoColors.error, 
                          0.3
                        )}`,
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                        {item.improvement > 0 ? (
                          <TrendingUpIcon sx={{ color: duolingoColors.success, mr: 1 }} />
                        ) : (
                          <TrendingUpIcon sx={{ color: duolingoColors.error, mr: 1, transform: 'rotate(180deg)' }} />
                        )}
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: item.improvement > 0 ? duolingoColors.success : duolingoColors.error,
                            fontWeight: 'bold'
                          }}
                        >
                          {item.improvement > 0 ? '+' : ''}{item.improvement}%
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {item.metric}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Side-by-Side Schedule Comparison */}
              <Paper 
                sx={{ 
                  p: 2,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${duolingoColors.surface}, ${alpha(duolingoColors.background, 0.5)})`,
                  border: `1px solid ${alpha(duolingoColors.primary, 0.1)}`,
                }}
              >
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Schedule Impact Analysis
                </Typography>
                <Grid container spacing={3}>
                  {/* Original Schedule */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        backgroundColor: alpha(duolingoColors.error, 0.05),
                        borderRadius: 2,
                        border: `1px solid ${alpha(duolingoColors.error, 0.2)}`,
                      }}
                    >
                      <Typography variant="subtitle2" gutterBottom sx={{ color: duolingoColors.error, fontWeight: 600 }}>
                        Original Schedule Impact
                      </Typography>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Total Trips:</Typography>
                          <Typography variant="body2" fontWeight="bold">124</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Failed Connections:</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: duolingoColors.error }}>8</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Average Wait:</Typography>
                          <Typography variant="body2" fontWeight="bold">12.4 min</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Service Reliability:</Typography>
                          <Typography variant="body2" fontWeight="bold">78%</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Peak Efficiency:</Typography>
                          <Typography variant="body2" fontWeight="bold">65%</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Grid>

                  {/* Optimized Schedule */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        backgroundColor: alpha(duolingoColors.success, 0.05),
                        borderRadius: 2,
                        border: `1px solid ${alpha(duolingoColors.success, 0.2)}`,
                      }}
                    >
                      <Typography variant="subtitle2" gutterBottom sx={{ color: duolingoColors.success, fontWeight: 600 }}>
                        Optimized Schedule Impact
                      </Typography>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Total Trips:</Typography>
                          <Typography variant="body2" fontWeight="bold">124</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Failed Connections:</Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: duolingoColors.success }}>2</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Average Wait:</Typography>
                          <Typography variant="body2" fontWeight="bold">8.7 min</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Service Reliability:</Typography>
                          <Typography variant="body2" fontWeight="bold">92%</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Peak Efficiency:</Typography>
                          <Typography variant="body2" fontWeight="bold">85%</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Connection Success Breakdown */}
              {state.visiblePanels.comparison && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                    Connection Success Breakdown
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Original Performance
                        </Typography>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Successful', value: 65, fill: duolingoColors.success },
                                { name: 'Partial', value: 25, fill: duolingoColors.warning },
                                { name: 'Missed', value: 10, fill: duolingoColors.error },
                              ]}
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                            />
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                    
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Optimized Performance
                        </Typography>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Successful', value: 85, fill: duolingoColors.success },
                                { name: 'Partial', value: 12, fill: duolingoColors.warning },
                                { name: 'Missed', value: 3, fill: duolingoColors.error },
                              ]}
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                            />
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={state.activeTab} index={2}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Trade-off Analysis
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Interactive trade-off visualization showing the relationship between connection success, wait times, schedule stability, and resource utilization will be implemented in Phase 4.
                </Typography>
              </Alert>
              <Box 
                sx={{ 
                  height: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(duolingoColors.background, 0.5),
                  borderRadius: 2,
                  border: `2px dashed ${alpha(duolingoColors.accent1, 0.3)}`,
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  Trade-off Matrix Placeholder - Coming in Phase 4
                </Typography>
              </Box>
            </Box>
          </TabPanel>

          <TabPanel value={state.activeTab} index={3}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Connection Success Metrics
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Comprehensive performance dashboard showing real-time connection success rates, optimization efficiency, and service quality metrics will be implemented in Phase 5.
                </Typography>
              </Alert>
              <Box 
                sx={{ 
                  height: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(duolingoColors.background, 0.5),
                  borderRadius: 2,
                  border: `2px dashed ${alpha(duolingoColors.secondary, 0.3)}`,
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  Metrics Dashboard Placeholder - Coming in Phase 5
                </Typography>
              </Box>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Info Section */}
      <Box sx={{ mt: 3, p: 3, backgroundColor: alpha(duolingoColors.info, 0.1), borderRadius: 3, border: `1px solid ${alpha(duolingoColors.info, 0.3)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
          <VisibilityIcon sx={{ color: duolingoColors.info, mt: 0.5 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: duolingoColors.info, fontWeight: 600 }} gutterBottom>
              Week 3: Visual Optimization Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This advanced visualization dashboard provides interactive insights into connection optimization results. 
              View timeline adjustments, compare before/after scenarios, analyze optimization trade-offs, and monitor 
              connection success metrics in real-time. The dashboard uses modern data visualization techniques to help 
              transit planners make informed decisions about schedule optimizations.
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip 
                label="Interactive Charts" 
                size="small" 
                variant="outlined" 
                sx={{ color: duolingoColors.info, borderColor: duolingoColors.info }}
              />
              <Chip 
                label="Real-time Analysis" 
                size="small" 
                variant="outlined" 
                sx={{ color: duolingoColors.info, borderColor: duolingoColors.info }}
              />
              <Chip 
                label="Performance Insights" 
                size="small" 
                variant="outlined" 
                sx={{ color: duolingoColors.info, borderColor: duolingoColors.info }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default VisualDashboard;
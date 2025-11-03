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
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Badge,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  PlayArrow as RunOptimizationIcon,
  Stop as StopIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Timeline as TimelineIcon,
  SwapHoriz as ConnectionIcon,
  TrendingUp as OptimizeIcon,
  CheckCircle as ApplyIcon,
  Cancel as RejectIcon,
  Compare as CompareIcon,
  AccessTime as TimeIcon,
  TrendingDown as DecreaseIcon,
  TrendingUp as IncreaseIcon,
  Schedule as ScheduleIcon,
  CheckCircle,
  Visibility as VisualizeIcon,
} from '@mui/icons-material';

import DraftNameHeader from '../components/DraftNameHeader';
import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs';
import ConnectionLibrary from '../components/ConnectionLibrary';
import ConnectionPriorityList from '../components/ConnectionPriorityList';
import { LoadingSkeleton } from '../components/loading';
import { SaveToDraft, AutoSaveStatus } from '../components/SaveToDraft';

import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import { connectionOptimizationService } from '../services/connectionOptimizationService';
import {
  ConnectionOptimizationRequest,
  ConnectionOptimizationResult,
  OptimizationProgress,
  ConnectionOpportunity,
  ConnectionPointType,
  ConnectionType,
  DayType,
} from '../types/connectionOptimization';
import { Schedule, SummarySchedule } from '../types/schedule';
import { ConnectionPoint } from '../types/connectionOptimization';
import { convertSummaryScheduleToSchedule } from '../utils/summaryScheduleConverter';

interface ConnectionOptimizationState {
  selectedConnections: ConnectionPoint[];
  optimizationProgress: OptimizationProgress | null;
  isOptimizing: boolean;
  optimizationResult: ConnectionOptimizationResult | null;
  summarySchedule: SummarySchedule | null;
  baselineSchedule: Schedule | null;
  showResultsComparison: boolean;
  optimizationHistory: ConnectionOptimizationResult[];
  canApplyResult: boolean;
  error: string | null;
}

const ConnectionOptimization: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get draft from location state or session
  const { draftId: locationDraftId } = location.state || {};
  const { 
    draft,
    loading: draftLoading,
    error: draftError,
    updateConnectionOptimization,
  } = useWorkflowDraft(locationDraftId);

  // Component state
  const [state, setState] = useState<ConnectionOptimizationState>({
    selectedConnections: [],
    optimizationProgress: null,
    isOptimizing: false,
    optimizationResult: null,
    summarySchedule: null,
    baselineSchedule: null,
    showResultsComparison: false,
    optimizationHistory: [],
    canApplyResult: false,
    error: null,
  });

  const [loading, setLoading] = useState(true);

  // Load existing connection data from draft with fallback data sources
  useEffect(() => {
    const loadConnectionData = async () => {
      setLoading(true);

      try {
        // Load connection optimization data
        let selectedConnections: ConnectionPoint[] = [];
        let optimizationResult: ConnectionOptimizationResult | null = null;
        let optimizationHistory: ConnectionOptimizationResult[] = [];
        let summarySchedule: SummarySchedule | null = null;

        if (draft?.connectionOptimization) {
          // Ensure selectedConnections have the correct ConnectionPoint type structure
          selectedConnections = (draft.connectionOptimization?.selectedConnections || []).map((conn: any) => {
            // If it's already the correct format, use it as is; otherwise convert/skip
            if (conn.timepointId && conn.scheduleTimes) {
              return conn as ConnectionPoint;
            }
            // Skip invalid connection points or convert from old format
            return null;
          }).filter(Boolean) as ConnectionPoint[];

          optimizationResult = draft.connectionOptimization?.lastResult || null;
          optimizationHistory = draft.connectionOptimization?.optimizationHistory || [];
        }

        // Try to load schedule data from multiple sources (for summary schedule fallback)
        if (!summarySchedule) {
          // First: Try draft summary schedule
          if (draft?.summarySchedule?.schedule) {
            summarySchedule = draft.summarySchedule.schedule;
            console.log('📋 Loaded summary schedule from draft');
          }
          // Second: Try navigation state
          else if (location.state?.summarySchedule) {
            summarySchedule = location.state.summarySchedule;
            console.log('📋 Loaded summary schedule from navigation state');
          }
          // Third: Try localStorage
          else {
            try {
              const savedSchedule = localStorage.getItem('currentSummarySchedule');
              if (savedSchedule) {
                const parsedSchedule = JSON.parse(savedSchedule);
                if (parsedSchedule && parsedSchedule.timePoints && parsedSchedule.timePoints.length > 0) {
                  summarySchedule = parsedSchedule;
                  console.log('📋 Loaded summary schedule from localStorage');
                }
              }
            } catch (error) {
              console.warn('Failed to load schedule from localStorage during initialization:', error);
            }
          }
        }

        let baselineSchedule: Schedule | null = null;
        if (summarySchedule) {
          try {
            baselineSchedule = convertSummaryScheduleToSchedule(summarySchedule, {
              dayType: 'weekday',
              blockConfigurations: draft?.blockConfiguration?.blockConfigurations,
              serviceBands: draft?.timepointsAnalysis?.serviceBands,
            });
          } catch (conversionError) {
            console.warn('Failed to convert summary schedule for baseline:', conversionError);
          }
        }

        setState(prev => ({
          ...prev,
          selectedConnections,
          optimizationResult,
          optimizationHistory,
          summarySchedule,
          baselineSchedule,
          error: !summarySchedule ? 'Schedule data not found. Please ensure you completed the Block Summary Schedule step.' : null,
        }));

      } catch (err) {
        console.error('Error loading connection data:', err);
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load connection data'
        }));
      } finally {
        setLoading(false);
      }
    };

    loadConnectionData();
  }, [draft, location.state]);

  // Handle connection selection from library
  const handleConnectionSelect = (connectionPoint: ConnectionPoint) => {
    setState(prev => ({
      ...prev,
      selectedConnections: [...prev.selectedConnections, connectionPoint],
    }));
  };

  // Handle connection removal
  const handleConnectionRemove = (connectionId: string) => {
    setState(prev => ({
      ...prev,
      selectedConnections: prev.selectedConnections.filter(c => c.id !== connectionId),
    }));
  };

  // Handle priority changes
  const handlePriorityChange = (connectionId: string, newPriority: number) => {
    setState(prev => ({
      ...prev,
      selectedConnections: prev.selectedConnections.map(c =>
        c.id === connectionId ? { ...c, priority: newPriority } : c
      ),
    }));
  };

  // Ensure summary schedule is available before optimization
  const ensureSummarySchedule = () => {
    if (state.summarySchedule) {
      return;
    }

    if (draft?.summarySchedule?.schedule) {
      setState(prev => ({
        ...prev,
        summarySchedule: draft.summarySchedule!.schedule,
      }));
    } else if (location.state?.summarySchedule) {
      setState(prev => ({
        ...prev,
        summarySchedule: location.state.summarySchedule,
      }));
    }
  };

  const resolveActiveDayType = (): DayType => {
    if (state.selectedConnections.length === 0) {
      return 'weekday';
    }

    const priorityOrder: DayType[] = ['weekday', 'saturday', 'sunday'];
    for (const day of priorityOrder) {
      if (state.selectedConnections.some(connection => connection.dayTypes?.includes(day))) {
        return day;
      }
    }

    return 'weekday';
  };

  // Run optimization
  const handleRunOptimization = async () => {
    ensureSummarySchedule();

    let summarySchedule = state.summarySchedule;
    let dataSource = 'state';

    if (!summarySchedule && draft?.summarySchedule?.schedule) {
      summarySchedule = draft.summarySchedule.schedule;
      dataSource = 'draft';
    } else if (!summarySchedule && location.state?.summarySchedule) {
      summarySchedule = location.state.summarySchedule;
      dataSource = 'navigation';
    } else if (!summarySchedule) {
      try {
        const savedSchedule = localStorage.getItem('currentSummarySchedule');
        if (savedSchedule) {
          const parsedSchedule = JSON.parse(savedSchedule);
          if (parsedSchedule && parsedSchedule.timePoints && parsedSchedule.timePoints.length > 0) {
            summarySchedule = parsedSchedule;
            dataSource = 'localStorage';
          }
        }
      } catch (error) {
        console.warn('Failed to load summary schedule from localStorage:', error);
      }
    }

    if (!summarySchedule) {
      setState(prev => ({
        ...prev,
        error: `No schedule data found. Please ensure you've completed the Block Summary Schedule step and that the data was saved successfully.

        Troubleshooting:
        • Go back to Block Summary Schedule
        • Wait for any save operations to complete
        • Try navigating to Connection Optimization again
        • If the problem persists, try refreshing the page from the Block Summary Schedule step`,
      }));
      return;
    }

    const activeDayType = resolveActiveDayType();

    let preparedSchedule;
    try {
      preparedSchedule = convertSummaryScheduleToSchedule(summarySchedule, {
        dayType: activeDayType,
        blockConfigurations: draft?.blockConfiguration?.blockConfigurations,
        serviceBands: draft?.timepointsAnalysis?.serviceBands,
      });
    } catch (conversionError) {
      setState(prev => ({
        ...prev,
        error: conversionError instanceof Error
          ? conversionError.message
          : 'Unable to prepare schedule for optimization. Please regenerate the summary schedule.',
      }));
      return;
    }

    console.log(`✅ Prepared schedule from ${dataSource}:`, {
      timePoints: preparedSchedule.timePoints.length,
      trips: preparedSchedule.trips.length,
      dayType: preparedSchedule.dayType,
    });

    setState(prev => ({
      ...prev,
      isOptimizing: true,
      optimizationProgress: null,
      error: null,
      summarySchedule,
      baselineSchedule: prev.baselineSchedule ?? preparedSchedule,
    }));

    try {
      const mapConnectionType = (pointType: ConnectionPointType): ConnectionType => {
        switch (pointType) {
          case 'go-train':
            return ConnectionType.GO_TRAIN;
          case 'high-school':
            return ConnectionType.SCHOOL_BELL;
          case 'college-arrival':
          case 'college-departure':
          default:
            return ConnectionType.BUS_ROUTE;
        }
      };

      const connectionOpportunities: ConnectionOpportunity[] = state.selectedConnections.map(conn => ({
        id: conn.id,
        type: mapConnectionType(conn.type),
        locationId: conn.timepointId,
        targetTime: conn.scheduleTimes.arrivalTime || conn.scheduleTimes.departureTime || '08:00',
        priority: conn.priority,
        windowType: 'ideal' as const,
        currentConnectionTime: undefined,
        affectedTrips: [],
        operatingDays: conn.dayTypes,
        metadata: {
          serviceName: conn.metadata?.serviceName || conn.name,
          description: `Connection to ${conn.metadata?.serviceName || conn.name} at ${conn.timepointName}`,
          frequency: undefined,
        },
      }));

      const optimizationRequest: ConnectionOptimizationRequest = {
        schedule: preparedSchedule,
        connectionOpportunities,
        connectionWindows: new Map(),
        constraints: {
          maxTripDeviation: 10,
          maxScheduleShift: 30,
          minRecoveryTime: 2,
          maxRecoveryTime: 20,
          enforceHeadwayRegularity: true,
          headwayTolerance: 2,
          connectionPriorities: {
            [ConnectionType.BUS_ROUTE]: 1,
            [ConnectionType.GO_TRAIN]: 2,
            [ConnectionType.SCHOOL_BELL]: 3,
          },
          allowCrossRouteBorrowing: false,
          performance: {
            maxOptimizationTimeMs: 60000,
            maxMemoryUsageMB: 512,
            earlyTerminationThreshold: 0.001,
          },
        },
        recoveryBankConfig: {
          allowBorrowing: true,
          maxBorrowingRatio: 0.5,
          stopConfigurations: [],
        },
        headwayCorrection: {
          strategyId: 'default',
          targetHeadway: 15,
          maxDeviationThreshold: 3,
          correctionHorizon: 5,
          correctionStrength: 0.7,
          correctionDirection: 'bidirectional',
        },
        options: {
          maxIterations: 1000,
          convergenceThreshold: 0.001,
          enableProgressiveOptimization: true,
          enableParallelProcessing: false,
        },
      };

      // Run optimization with progress callback
      const result = await connectionOptimizationService.optimizeScheduleConnections(
        optimizationRequest,
        (progress) => {
          setState(prev => ({
            ...prev,
            optimizationProgress: progress,
          }));
        }
      );

      setState(prev => ({
        ...prev,
        isOptimizing: false,
        optimizationResult: result,
        optimizationProgress: null,
        showResultsComparison: true,
        canApplyResult: result.success && result.successfulConnections.length > 0,
        optimizationHistory: [result, ...prev.optimizationHistory.slice(0, 4)] // Keep last 5 results
      }));

    } catch (err) {
      setState(prev => ({
        ...prev,
        isOptimizing: false,
        error: err instanceof Error ? err.message : 'Optimization failed',
        optimizationProgress: null,
      }));
    }
  };

  // Stop optimization
  const handleStopOptimization = () => {
    connectionOptimizationService.cancelOptimization();
    setState(prev => ({
      ...prev,
      isOptimizing: false,
      optimizationProgress: null,
    }));
  };

  // Apply optimization result
  const handleApplyOptimization = async () => {
    if (!state.optimizationResult || !state.canApplyResult) return;
    
    try {
      setLoading(true);

      const history = [state.optimizationResult, ...state.optimizationHistory].slice(0, 5);
      const result = await updateConnectionOptimization({
        selectedConnections: state.selectedConnections,
        lastResult: state.optimizationResult,
        optimizationHistory: history,
      });

      if (!result.success) {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to apply optimization',
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        canApplyResult: false,
        showResultsComparison: false,
        optimizationHistory: history,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to apply optimization'
      }));
    } finally {
      setLoading(false);
    }
  };

  // Reject optimization result
  const handleRejectOptimization = () => {
    setState(prev => ({
      ...prev,
      showResultsComparison: false,
      canApplyResult: false,
    }));
  };

  // Load historical optimization result
  const handleLoadHistoricalResult = (result: ConnectionOptimizationResult) => {
    setState(prev => ({
      ...prev,
      optimizationResult: result,
      showResultsComparison: true,
      canApplyResult: false // Historical results cannot be applied
    }));
  };

  // Navigation handlers
  const handleGoBack = () => {
    navigate('/block-summary-schedule', {
      state: {
        draftId: draft?.draftId,
        fromWorkflowNavigation: true,
      }
    });
  };

  const handleGoForward = () => {
    if (!state.summarySchedule && !draft?.summarySchedule?.schedule && !location.state?.summarySchedule) {
      setState(prev => ({
        ...prev,
        error: 'Cannot proceed to export: No schedule data available.\n\nPlease:\n1. Return to Block Summary Schedule\n2. Ensure the schedule is generated and saved\n3. Navigate back to Connection Optimization when save is complete'
      }));
      return;
    }

    const summarySchedule = state.summarySchedule || draft?.summarySchedule?.schedule || location.state?.summarySchedule;

    if (!summarySchedule?.timePoints || summarySchedule.timePoints.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'Invalid schedule data: No time points found. Please regenerate the schedule from Block Configuration.'
      }));
      return;
    }

    const hasTrips = Boolean(
      (Array.isArray(summarySchedule?.weekday) && summarySchedule.weekday.length > 0) ||
      (Array.isArray(summarySchedule?.saturday) && summarySchedule.saturday.length > 0) ||
      (Array.isArray(summarySchedule?.sunday) && summarySchedule.sunday.length > 0)
    );

    if (!hasTrips) {
      setState(prev => ({
        ...prev,
        error: 'Invalid schedule data: No trips found. Please regenerate the schedule from Block Configuration.'
      }));
      return;
    }

    console.log('✅ Summary schedule validation passed, proceeding to export');

    navigate('/export', {
      state: {
        draftId: draft?.draftId,
        optimizationResult: state.optimizationResult,
        scheduleData: summarySchedule,
        fromWorkflowNavigation: true,
      }
    });
  };

  // Navigate to Visual Dashboard
  const handleViewVisualDashboard = () => {
    navigate('/visual-dashboard', {
      state: {
        draftId: draft?.draftId,
        optimizationResult: state.optimizationResult,
        fromConnectionOptimization: true,
      }
    });
  };

  // Format time helper
  const formatTime = (milliseconds: number): string => {
    if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
    const seconds = Math.round(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  // Get connection status color
  const getConnectionStatusColor = (priority: number): 'success' | 'warning' | 'error' | 'default' => {
    if (priority >= 8) return 'error';
    if (priority >= 5) return 'warning';
    return 'default';
  };

  // Generate summary statistics
  const summaryStats = useMemo(() => {
    const totalConnections = state.selectedConnections.length;
    const highPriority = state.selectedConnections.filter(c => c.priority >= 8).length;
    const connectionTypes = {
      [ConnectionType.BUS_ROUTE]: state.selectedConnections.filter(c => 
        c.type === 'college-arrival' || c.type === 'college-departure'
      ).length,
      [ConnectionType.GO_TRAIN]: state.selectedConnections.filter(c => c.type === 'go-train').length,
      [ConnectionType.SCHOOL_BELL]: state.selectedConnections.filter(c => c.type === 'high-school').length,
    };

    return {
      totalConnections,
      highPriority,
      connectionTypes,
    };
  }, [state.selectedConnections]);

  if (loading || draftLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <DraftNameHeader />
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 3, mb: 3 }}>
          Connection Optimization
        </Typography>
        <LoadingSkeleton variant="dashboard" />
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

  return (
    <Box>
      {/* Draft Name Header */}
      <DraftNameHeader />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Connection Optimization
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          <Chip 
            label="Advanced Feature" 
            color="primary" 
            size="small"
            sx={{ mr: 1 }}
          />
          Optimize bus schedules to improve connections with GO trains, schools, and other routes
        </Typography>
      </Box>

      {/* Navigation Controls */}
      <Box sx={{ 
        mb: 3, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleGoBack}
          size="large"
          sx={{ minWidth: 140 }}
        >
          Back to Schedule
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SaveToDraft variant="outlined" size="medium" />
          <AutoSaveStatus />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Step 5 of 5
            </Typography>
            <Typography variant="body1" color="primary" fontWeight="bold">
              Connection Optimization
            </Typography>
          </Box>
        </Box>
        
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleGoForward}
          size="large"
          sx={{ minWidth: 160 }}
          disabled={
            // Disable if no schedule data is available from any source
            (!state.summarySchedule && !draft?.summarySchedule?.schedule && !location.state?.summarySchedule) ||
            // Also disable if there's a current error
            !!state.error ||
            // Standard validation: need connections or optimization result
            (state.selectedConnections.length === 0 && !state.optimizationResult)
          }
        >
{state.optimizationResult ? 'Export Optimized Schedule' : 'Continue to Export'}
        </Button>
      </Box>

      {/* Error Display */}
      {state.error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setState(prev => ({ ...prev, error: null }))}
        >
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              🚨 Connection Optimization Error
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {state.error}
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/block-summary-schedule', {
                  state: {
                    draftId: draft?.draftId,
                    fromConnectionOptimization: true
                  }
                })}
              >
                🔙 Return to Schedule
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.location.reload()}
              >
                🔄 Refresh Page
              </Button>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Optimization Progress */}
      {state.isOptimizing && state.optimizationProgress && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="h6" color="primary">
                  Optimizing Connections...
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<StopIcon />}
                onClick={handleStopOptimization}
                disabled={!state.optimizationProgress.canCancel}
              >
                Cancel
              </Button>
            </Box>
            
            <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
              {state.optimizationProgress.phase}
            </Typography>
            
            <LinearProgress 
              variant="determinate" 
              value={state.optimizationProgress.progress} 
              sx={{ 
                mb: 2, 
                height: 8, 
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4
                }
              }}
            />
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    {Math.round(state.optimizationProgress.progress)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Progress
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="success.main">
                    {state.optimizationProgress.connectionsMade}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Connections
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="info.main">
                    {state.optimizationProgress.currentScore.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Score
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="text.primary">
                    {formatTime(state.optimizationProgress.estimatedTimeRemainingMs || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Est. Time
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {state.optimizationProgress.memoryUsageMB > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Memory Usage: {Math.round(state.optimizationProgress.memoryUsageMB)}MB
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Best Score: {state.optimizationProgress.bestScore.toFixed(2)}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Optimization Results */}
      {state.optimizationResult && (
        <Card sx={{ mb: 3, border: state.optimizationResult.success ? '2px solid' : '1px solid', borderColor: state.optimizationResult.success ? 'success.main' : 'error.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" color={state.optimizationResult.success ? 'success.main' : 'error.main'}>
                Optimization {state.optimizationResult.success ? 'Completed' : 'Failed'}
              </Typography>
              {state.canApplyResult && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ApplyIcon />}
                    onClick={handleApplyOptimization}
                    size="small"
                  >
                    Apply Changes
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<RejectIcon />}
                    onClick={handleRejectOptimization}
                    size="small"
                  >
                    Reject
                  </Button>
                </Box>
              )}
            </Box>
            
            {state.optimizationResult.success ? (
              <>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'success.50', borderRadius: 2 }}>
                      <Typography variant="h5" color="success.main">
                        {state.optimizationResult.successfulConnections.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Successful Connections
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'primary.50', borderRadius: 2 }}>
                      <Typography variant="h5" color="primary.main">
                        {Math.round(state.optimizationResult.performance.connectionSuccessRate)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'info.50', borderRadius: 2 }}>
                      <Typography variant="h5" color="info.main">
                        {Math.round(state.optimizationResult.performance.averageConnectionTime)}min
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Wait Time
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'secondary.50', borderRadius: 2 }}>
                      <Typography variant="h5" color="secondary.main">
                        {state.optimizationResult.finalScore.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Final Score
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                {/* Additional Metrics */}
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TimeIcon color="action" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        Recovery Utilization:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {Math.round(state.optimizationResult.performance.recoveryUtilizationRate)}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon color="action" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        Headway Regularity:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {Math.round(state.optimizationResult.performance.headwayRegularityScore)}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircle color="action" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        Constraint Compliance:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {Math.round(state.optimizationResult.performance.constraintComplianceRate)}%
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                {/* Show comparison button if we have original schedule */}
                {state.baselineSchedule && (
                  <Box sx={{ mt: 2, textAlign: 'center', display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      startIcon={<CompareIcon />}
                      onClick={() => setState(prev => ({ ...prev, showResultsComparison: !prev.showResultsComparison }))}
                      size="small"
                    >
                      {state.showResultsComparison ? 'Hide' : 'Show'} Before/After Comparison
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<VisualizeIcon />}
                      onClick={handleViewVisualDashboard}
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #58CC02, #45A049)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #45A049, #3A8A3D)',
                        },
                      }}
                    >
                      Visual Dashboard
                    </Button>
                  </Box>
                )}
              </>
            ) : (
              <Alert severity="error" sx={{ mb: 2 }}>
                {state.optimizationResult.error || 'Optimization failed to find viable connections'}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Before/After Schedule Comparison */}
      {state.showResultsComparison && state.optimizationResult && state.baselineSchedule && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Schedule Comparison
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <Typography variant="subtitle1" gutterBottom color="text.secondary">
                    Original Schedule
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      Trips: {state.baselineSchedule?.trips?.length || 0}
                    </Typography>
                    <Typography variant="body2">
                      Connections Made: 0 (baseline)
                    </Typography>
                    <Typography variant="body2">
                      Average Wait Time: N/A
                    </Typography>
                    <Typography variant="body2">
                      Service Reliability: Standard
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="subtitle1" gutterBottom color="success.dark">
                    Optimized Schedule
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      Trips: {state.optimizationResult.optimizedSchedule.trips?.length || 0}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IncreaseIcon fontSize="small" color="success" />
                      <Typography variant="body2">
                        Connections Made: {state.optimizationResult.successfulConnections.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DecreaseIcon fontSize="small" color="success" />
                      <Typography variant="body2">
                        Average Wait Time: {Math.round(state.optimizationResult.performance.averageConnectionTime)}min
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      Service Reliability: {state.optimizationResult.performance.headwayRegularityScore > 80 ? 'Enhanced' : 'Maintained'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
            
            {/* Connection Status Table */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Connection Status Details
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Connection</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Wait Time</TableCell>
                      <TableCell>Priority</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {state.optimizationResult.successfulConnections.map((connection, index) => (
                      <TableRow key={index}>
                        <TableCell>{connection.metadata?.serviceName || `Connection ${index + 1}`}</TableCell>
                        <TableCell>{connection.type}</TableCell>
                        <TableCell>
                          <Chip 
                            label="Connected" 
                            color="success" 
                            size="small" 
                            icon={<CheckCircle fontSize="small" />}
                          />
                        </TableCell>
                        <TableCell>{connection.currentConnectionTime || 0}min</TableCell>
                        <TableCell>
                          <Chip 
                            label={`P${connection.priority}`} 
                            color={getConnectionStatusColor(connection.priority)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {state.optimizationResult.failedConnections.map((failedConnection, index) => (
                      <TableRow key={`failed-${index}`}>
                        <TableCell>{failedConnection.opportunity.metadata?.serviceName || `Connection ${index + 1}`}</TableCell>
                        <TableCell>{failedConnection.opportunity.type}</TableCell>
                        <TableCell>
                          <Chip 
                            label="Missed" 
                            color="error" 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>N/A</TableCell>
                        <TableCell>
                          <Chip 
                            label={`P${failedConnection.opportunity.priority}`} 
                            color={getConnectionStatusColor(failedConnection.opportunity.priority)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Connection Library */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ConnectionIcon color="primary" />
                <Typography variant="h6">
                  Connection Library
                </Typography>
                <Tooltip title="Pre-configured connection templates for common scenarios">
                  <InfoIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>
<ConnectionLibrary 
                onConnectionSelect={handleConnectionSelect}
                selectedConnectionIds={state.selectedConnections.map(conn => conn.id)}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Active Connections */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon color="primary" />
                  <Typography variant="h6">
                    Active Connections ({summaryStats.totalConnections})
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {state.isOptimizing ? (
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={handleStopOptimization}
                      size="small"
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<RunOptimizationIcon />}
                      onClick={handleRunOptimization}
                      disabled={state.selectedConnections.length === 0}
                      size="small"
                    >
                      Run Optimization
                    </Button>
                  )}
                </Box>
              </Box>

              {state.selectedConnections.length === 0 ? (
                <Box sx={{ 
                  py: 4, 
                  textAlign: 'center', 
                  color: 'text.secondary',
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 2
                }}>
                  <OptimizeIcon sx={{ fontSize: 48, mb: 1, color: 'text.disabled' }} />
                  <Typography variant="body1" gutterBottom>
                    No connections selected
                  </Typography>
                  <Typography variant="body2">
                    Choose connection templates from the library to get started
                  </Typography>
                </Box>
              ) : (
                <ConnectionPriorityList
                  connections={state.selectedConnections}
                  onConnectionRemove={handleConnectionRemove}
                  onPriorityChange={handlePriorityChange}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Priority Configuration & Summary */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Summary Statistics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Total Connections:</Typography>
                    <Chip label={summaryStats.totalConnections} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">High Priority:</Typography>
                    <Chip 
                      label={summaryStats.highPriority} 
                      size="small" 
                      color={summaryStats.highPriority > 0 ? 'error' : 'default'}
                    />
                  </Box>
                  <Divider />
                  <Typography variant="subtitle2">By Type:</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">GO Trains:</Typography>
                      <Typography variant="body2">{summaryStats.connectionTypes[ConnectionType.GO_TRAIN]}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Schools:</Typography>
                      <Typography variant="body2">{summaryStats.connectionTypes[ConnectionType.SCHOOL_BELL]}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Bus Routes:</Typography>
                      <Typography variant="body2">{summaryStats.connectionTypes[ConnectionType.BUS_ROUTE]}</Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <HistoryIcon color="primary" />
                  <Typography variant="h6">
                    History
                  </Typography>
                  {state.optimizationHistory.length > 0 && (
                    <Badge badgeContent={state.optimizationHistory.length} color="primary" />
                  )}
                </Box>
                
                {state.optimizationHistory.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No optimization history yet. Run your first optimization to see results here.
                  </Typography>
                ) : (
                  <List dense>
                    {state.optimizationHistory.slice(0, 5).map((result, index) => (
                      <ListItemButton 
                        key={index}
                        onClick={() => handleLoadHistoricalResult(result)}
                        sx={{ 
                          borderRadius: 1, 
                          mb: 1,
                          backgroundColor: result.success ? 'success.50' : 'error.50',
                          '&:hover': {
                            backgroundColor: result.success ? 'success.100' : 'error.100'
                          }
                        }}
                      >
                        <ListItemIcon>
                          {result.success ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <RejectIcon color="error" fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={`${result.successfulConnections.length} connections made`}
                          secondary={`Score: ${result.finalScore.toFixed(1)} | ${Math.round(result.performance.connectionSuccessRate)}% success`}
                        />
                      </ListItemButton>
                    ))}
                    {state.optimizationHistory.length > 5 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                        + {state.optimizationHistory.length - 5} more results
                      </Typography>
                    )}
                  </List>
                )}
                
                {/* Show recommendations if available */}
                {state.optimizationResult && state.optimizationResult.recommendations.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Optimization Recommendations
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {state.optimizationResult.recommendations.slice(0, 3).map((recommendation, index) => (
                        <Alert key={index} severity="info" sx={{ fontSize: '0.875rem' }}>
                          {recommendation}
                        </Alert>
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* Info Section */}
      <Box sx={{ mt: 3, p: 3, backgroundColor: 'info.50', borderRadius: 2, border: '1px solid', borderColor: 'info.200' }}>
        <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
          <InfoIcon color="info" />
          <Box>
            <Typography variant="subtitle2" color="info.dark" gutterBottom>
              Connection Optimization
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This advanced feature analyzes your bus schedule and intelligently adjusts trip times to improve 
              connections with GO trains, school bell times, and other transit routes. The optimization algorithm 
              uses recovery time banking and headway correction to maintain schedule reliability while maximizing 
              connection success rates.
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip 
                label="Recovery Time Banking" 
                size="small" 
                variant="outlined" 
                color="info" 
              />
              <Chip 
                label="Headway Correction" 
                size="small" 
                variant="outlined" 
                color="info" 
              />
              <Chip 
                label="Multi-Modal Connections" 
                size="small" 
                variant="outlined" 
                color="info" 
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ConnectionOptimization;


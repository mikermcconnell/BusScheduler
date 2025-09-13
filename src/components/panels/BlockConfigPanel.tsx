/**
 * Block Configuration Panel Component
 * Converts the BlockConfiguration page into a responsive panel-based component
 * Preserves ALL existing Duolingo-style functionality while adapting for the Schedule Command Center workspace
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  Paper,
  useTheme,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  AccessTime as ClockIcon,
  DirectionsBus as BusIcon,
  Settings as SettingsIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { emit, subscribe, unsubscribe } from '../../services/workspaceEventBus';
import { ScheduleDataEvent, WorkflowProgressEvent } from '../../types/workspaceEvents';
import { ServiceBand, TimePoint, Trip, BlockConfiguration as BlockConfig } from '../../types/schedule';

// ==================== TYPES ====================
interface TimePointData {
  fromTimePoint: string;
  toTimePoint: string;
  timePeriod: string;
  percentile50: number;
  percentile80: number;
  isOutlier?: boolean;
  outlierType?: 'high' | 'low';
  outlierDeviation?: number;
}

interface TimePeriod {
  startTime: string;
  endTime: string;
  serviceBand: ServiceBand['name'];
}

interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

interface Schedule {
  id: string;
  name: string;
  timePoints: TimePoint[];
  serviceBands: ServiceBand[];
  timePeriods: TimePeriod[];
  trips: Trip[];
  blockConfigurations: BlockConfiguration[];
  cycleTimeMinutes: number;
  automateBlockStartTimes: boolean;
  firstTripTime: string;
  lastTripTime: string;
  updatedAt: string;
  timePointData?: TimePointData[];
  deletedPeriods?: string[];
}

// ==================== PANEL INTERFACE ====================
interface PanelProps {
  id: string;
  onClose?: () => void;
  initialData?: any;
}

interface BlockConfigPanelState {
  schedule: Schedule;
  timePointData: TimePointData[];
  serviceBandMapping: { [timePeriod: string]: string };
  deletedPeriods: string[];
  isLoading: boolean;
  error: string | null;
  saveNotification: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  };
}

// ==================== UTILITY FUNCTIONS ====================
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return Math.max(0, Math.min(1440, hours * 60 + minutes));
};

const minutesToTime = (minutes: number): string => {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '00:00';
  const boundedMinutes = Math.max(0, Math.min(1440, Math.round(minutes)));
  const hours = Math.floor(boundedMinutes / 60);
  const mins = boundedMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  return minutesToTime(totalMinutes);
};

const getTimeWithDefault = (time: string | undefined, defaultTime: string): string => {
  return time && time.trim() ? time : defaultTime;
};

// ==================== COLOR UTILITIES ====================
const getProfessionalColor = (index: number): string => {
  const colors = [
    'rgb(63, 81, 181)',     // Indigo
    'rgb(76, 175, 80)',     // Green
    'rgb(255, 87, 34)',     // Deep Orange
    'rgb(156, 39, 176)',    // Purple
    'rgb(255, 152, 0)',     // Orange
    'rgb(96, 125, 139)',    // Blue Grey
    'rgb(233, 30, 99)',     // Pink
    'rgb(0, 150, 136)',     // Teal
    'rgb(121, 85, 72)',     // Brown
    'rgb(158, 158, 158)',   // Grey
  ];
  return colors[index % colors.length];
};

const getServiceBandColor = (bandName: ServiceBand['name']): string => {
  const colorMap: Record<ServiceBand['name'], string> = {
    'Fastest Service': '#22c55e',   // Green
    'Fast Service': '#3b82f6',      // Blue  
    'Standard Service': '#f59e0b',  // Amber
    'Slow Service': '#ef4444',      // Red
    'Slowest Service': '#dc2626'    // Dark Red
  };
  return colorMap[bandName] || '#6b7280';
};

// ==================== MAIN COMPONENT ====================
export const BlockConfigPanel: React.FC<PanelProps> = ({ id, onClose, initialData }) => {
  const theme = useTheme();
  const { 
    scheduleData,
    updateScheduleData,
    validation,
    setWorkflowStep,
    emitEvent
  } = useWorkspace();

  // ==================== STATE ====================
  const [state, setState] = useState<BlockConfigPanelState>(() => ({
    schedule: {
      id: `schedule_${Date.now()}`,
      name: 'Route Configuration',
      firstTripTime: '07:00',
      lastTripTime: '22:00',
      timePoints: [
        { id: 'downtown_terminal', name: 'Downtown Terminal', sequence: 1 },
        { id: 'johnson_napier', name: 'Johnson at Napier', sequence: 2 },
        { id: 'rvh_entrance', name: 'RVH Entrance', sequence: 3 },
        { id: 'georgian_college', name: 'Georgian College', sequence: 4 },
        { id: 'georgian_mall', name: 'Georgian Mall', sequence: 5 },
        { id: 'bayfield_mall', name: 'Bayfield Mall', sequence: 6 },
        { id: 'downtown_return', name: 'Downtown Terminal', sequence: 7 }
      ],
      serviceBands: [
        {
          name: 'Fastest Service',
          color: getServiceBandColor('Fastest Service'),
          segmentTimes: [8, 12, 15, 10, 18, 25],
          totalMinutes: 88
        },
        {
          name: 'Standard Service',
          color: getServiceBandColor('Standard Service'),
          segmentTimes: [12, 16, 20, 15, 23, 32],
          totalMinutes: 118
        }
      ],
      timePeriods: [],
      trips: [],
      blockConfigurations: [
        { blockNumber: 1, startTime: '07:00', endTime: '22:00' },
        { blockNumber: 2, startTime: '07:20', endTime: '22:20' },
        { blockNumber: 3, startTime: '07:40', endTime: '22:40' }
      ],
      cycleTimeMinutes: 120,
      automateBlockStartTimes: true,
      updatedAt: new Date().toISOString()
    },
    timePointData: [],
    serviceBandMapping: {},
    deletedPeriods: [],
    isLoading: false,
    error: null,
    saveNotification: {
      open: false,
      message: '',
      severity: 'success'
    }
  }));

  // ==================== EVENT BUS INTEGRATION ====================
  useEffect(() => {
    console.log('🔌 BlockConfigPanel: Setting up event bus subscriptions');

    // Subscribe to timepoints analysis events
    const subscription = subscribe('schedule-data', (event: ScheduleDataEvent) => {
      if (event.payload.dataType === 'timepoints' || event.payload.dataType === 'service-bands') {
        console.log('📡 BlockConfigPanel: Received timepoints data:', event.payload.data);
        
        const { timePointData, serviceBands, deletedPeriods, timePeriodServiceBands } = event.payload.data;
        
        setState(prev => ({
          ...prev,
          timePointData: timePointData || [],
          serviceBandMapping: timePeriodServiceBands || {},
          deletedPeriods: deletedPeriods || [],
          schedule: {
            ...prev.schedule,
            serviceBands: serviceBands || prev.schedule.serviceBands,
            updatedAt: new Date().toISOString()
          }
        }));
      }
    });

    return () => {
      console.log('🔌 BlockConfigPanel: Cleaning up event bus subscriptions');
      unsubscribe(subscription);
    };
  }, []);

  // ==================== AUTO-SAVE FUNCTIONALITY ====================
  const autoSave = useCallback(() => {
    if (scheduleData.autoSaveEnabled) {
      updateScheduleData({
        isDirty: true
      });
      console.log('💾 BlockConfigPanel: Auto-saved block configuration');
    }
  }, [state.schedule, scheduleData.autoSaveEnabled, updateScheduleData]);

  // ==================== AUTOMATION LOGIC ====================
  const calculateAutomatedStartTime = useCallback((
    blockIndex: number, 
    frequencyMinutes: number, 
    firstBlockStartTime: string
  ): string => {
    const baseMinutes = timeToMinutes(firstBlockStartTime);
    const offsetMinutes = blockIndex * frequencyMinutes;
    return minutesToTime(baseMinutes + offsetMinutes);
  }, []);

  // ==================== BLOCK MANAGEMENT ====================
  const updateBlockCount = (newCount: number) => {
    const currentConfigs = [...state.schedule.blockConfigurations];
    
    if (newCount > currentConfigs.length) {
      // Add new blocks
      for (let i = currentConfigs.length; i < newCount; i++) {
        const blockNumber = i + 1;
        let startTime = '07:00';
        let endTime = currentConfigs[0]?.endTime || '22:00';
        
        if (state.schedule.automateBlockStartTimes && i > 0) {
          const frequencyMinutes = Math.round(state.schedule.cycleTimeMinutes / newCount);
          startTime = calculateAutomatedStartTime(i, frequencyMinutes, currentConfigs[0].startTime);
          endTime = currentConfigs[0]?.endTime || '22:00';
        }
        
        currentConfigs.push({
          blockNumber,
          startTime,
          endTime
        });
      }
    } else if (newCount < currentConfigs.length) {
      currentConfigs.splice(newCount);
    }
    
    setState(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        blockConfigurations: currentConfigs,
        updatedAt: new Date().toISOString()
      }
    }));
    
    autoSave();
  };

  // Update automated start times when settings change
  useEffect(() => {
    if (state.schedule.automateBlockStartTimes && state.schedule.blockConfigurations.length > 1) {
      const frequencyMinutes = Math.round(state.schedule.cycleTimeMinutes / state.schedule.blockConfigurations.length);
      const updatedConfigs = state.schedule.blockConfigurations.map((config, index) => {
        if (index === 0) return config; // Keep first block manual
        
        const startTime = calculateAutomatedStartTime(index, frequencyMinutes, state.schedule.blockConfigurations[0].startTime);
        return {
          ...config,
          startTime,
          endTime: state.schedule.blockConfigurations[0].endTime
        };
      });
      
      setState(prev => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          blockConfigurations: updatedConfigs,
          updatedAt: new Date().toISOString()
        }
      }));
      
      autoSave();
    }
  }, [state.schedule.cycleTimeMinutes, state.schedule.automateBlockStartTimes, state.schedule.blockConfigurations.length, calculateAutomatedStartTime, autoSave]);

  // ==================== TRIP GENERATION ====================
  const generateBlocks = async () => {
    console.log('🚌 BlockConfigPanel: Generating blocks configuration');
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Safety validation
      if (!state.schedule.cycleTimeMinutes || state.schedule.cycleTimeMinutes <= 0) {
        throw new Error('Cycle time must be greater than 0 minutes');
      }
      
      if (state.schedule.blockConfigurations.length === 0) {
        throw new Error('At least one bus block must be configured');
      }

      // Emit block configuration complete event
      const blockConfigData = {
        blocks: state.schedule.blockConfigurations,
        cycleTime: state.schedule.cycleTimeMinutes,
        serviceFrequency: Math.round(state.schedule.cycleTimeMinutes / state.schedule.blockConfigurations.length),
        automatedStartTimes: state.schedule.automateBlockStartTimes,
        numberOfBuses: state.schedule.blockConfigurations.length,
        timePointData: state.timePointData,
        serviceBands: state.schedule.serviceBands,
        serviceBandMapping: state.serviceBandMapping
      };
      
      emit({
        type: 'schedule-data',
        source: 'block-config-panel',
        priority: 1,
        payload: {
          dataType: 'blocks',
          action: 'create',
          data: blockConfigData
        }
      });

      // Update workflow progress
      emit({
        type: 'workflow-progress',
        source: 'block-config-panel',
        priority: 1,
        payload: {
          currentStep: 'blocks',
          progress: 75, // 75% complete after blocks
          canProceed: true,
          nextStep: 'summary'
        }
      } as WorkflowProgressEvent);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        saveNotification: {
          open: true,
          message: '✅ Block configuration completed successfully!',
          severity: 'success'
        }
      }));
      
      console.log('✅ BlockConfigPanel: Block configuration emitted successfully');
      
    } catch (error) {
      console.error('❌ BlockConfigPanel: Error generating blocks:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate blocks',
        saveNotification: {
          open: true,
          message: '❌ Failed to generate blocks configuration',
          severity: 'error'
        }
      }));
    }
  };

  // ==================== RENDER ====================
  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* Panel Header */}
      <Box sx={{ 
        p: 3, 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgb(63, 81, 181), rgb(76, 175, 80))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(63, 81, 181, 0.3)'
              }}
            >
              <BusIcon sx={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="700" sx={{ color: 'rgb(0, 75, 128)' }}>
                Bus Block Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure bus blocks with Duolingo-style interface
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<BusIcon />}
            label={`${state.schedule.blockConfigurations.length} buses`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<ClockIcon />}
            label={`${state.schedule.cycleTimeMinutes}min cycle`}
            color="secondary"
            variant="outlined"
          />
          <Chip
            icon={<ScheduleIcon />}
            label={`${Math.round(state.schedule.cycleTimeMinutes / state.schedule.blockConfigurations.length)}min frequency`}
            color="info"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        p: 3,
        '&::-webkit-scrollbar': {
          width: 8
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(0,0,0,0.2)',
          borderRadius: 4
        }
      }}>
        
        {/* Configuration Controls */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Bus Count Control */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={2} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ color: 'rgb(0, 75, 128)', mb: 2, fontWeight: 600 }}>
                  Fleet Configuration
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    type="number"
                    label="Number of Buses"
                    value={state.schedule.blockConfigurations.length}
                    onChange={(e) => {
                      const newCount = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                      updateBlockCount(newCount);
                    }}
                    inputProps={{ min: 1, max: 10 }}
                    size="small"
                    sx={{ width: 140 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Max: 10 buses
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Cycle Time Control */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={2} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ color: 'rgb(0, 75, 128)', mb: 2, fontWeight: 600 }}>
                  Service Timing
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    type="number"
                    label="Cycle Time (minutes)"
                    value={state.schedule.cycleTimeMinutes}
                    onChange={(e) => {
                      const newCycleTime = parseInt(e.target.value) || 0;
                      setState(prev => ({
                        ...prev,
                        schedule: {
                          ...prev.schedule,
                          cycleTimeMinutes: newCycleTime,
                          updatedAt: new Date().toISOString()
                        }
                      }));
                      autoSave();
                    }}
                    inputProps={{ min: 1 }}
                    size="small"
                    sx={{ width: 160 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Round-trip time
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Frequency Display */}
        <Card elevation={2} sx={{ mb: 4, borderRadius: 3, bgcolor: 'rgba(0, 75, 128, 0.05)' }}>
          <CardContent sx={{ textAlign: 'center', p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: 'rgb(0, 75, 128)', mb: 1 }}>
              Service Frequency: {Math.round((state.schedule.cycleTimeMinutes / state.schedule.blockConfigurations.length) * 10) / 10} minutes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A bus arrives every {Math.round((state.schedule.cycleTimeMinutes / state.schedule.blockConfigurations.length) * 10) / 10} minutes
            </Typography>
          </CardContent>
        </Card>

        {/* Automation Toggle */}
        <Card elevation={2} sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={state.schedule.automateBlockStartTimes}
                  onChange={(e) => {
                    setState(prev => ({
                      ...prev,
                      schedule: {
                        ...prev.schedule,
                        automateBlockStartTimes: e.target.checked,
                        updatedAt: new Date().toISOString()
                      }
                    }));
                    autoSave();
                  }}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    Automate Block Start Times
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Automatically calculate start times based on frequency (Block 1 remains manual)
                  </Typography>
                </Box>
              }
            />
          </CardContent>
        </Card>

        {/* Duolingo-Style Block Cards */}
        <Typography variant="h6" sx={{ color: 'rgb(0, 75, 128)', mb: 3, fontWeight: 600 }}>
          Bus Block Configuration
        </Typography>
        
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(auto-fit, minmax(280px, 1fr))' 
          },
          gap: 3,
          mb: 4
        }}>
          {state.schedule.blockConfigurations.map((blockConfig, index) => {
            const isAutomated = state.schedule.automateBlockStartTimes && index > 0;
            const cardColor = getProfessionalColor(index);
            
            return (
              <Card
                key={blockConfig.blockNumber}
                elevation={6}
                sx={{
                  borderRadius: '24px',
                  backgroundColor: cardColor,
                  position: 'relative',
                  overflow: 'visible',
                  transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  cursor: isAutomated ? 'default' : 'pointer',
                  transform: 'translateY(0)',
                  '&:hover': {
                    transform: isAutomated ? 'translateY(0)' : 'translateY(-4px)',
                    boxShadow: isAutomated 
                      ? '0 10px 40px rgba(0,0,0,0.15)' 
                      : '0 20px 60px rgba(0,0,0,0.25)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: '24px',
                    padding: '2px',
                    background: `linear-gradient(135deg, rgba(255,255,255,0.3), transparent)`,
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude'
                  }
                }}
              >
                <CardContent sx={{ p: 0, height: '100%', minHeight: '180px' }}>
                  {/* Header Section */}
                  <Box 
                    sx={{ 
                      position: 'relative',
                      background: `linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))`,
                      borderRadius: '24px 24px 0 0',
                      p: 3,
                      pb: 2,
                      textAlign: 'center'
                    }}
                  >
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        color: 'white',
                        fontWeight: 800,
                        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        letterSpacing: '0.5px',
                        fontSize: '1.4rem',
                        mb: 1
                      }}
                    >
                      Bus Block {blockConfig.blockNumber}
                    </Typography>
                    
                    {/* Status Indicator */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box 
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: isAutomated ? '#FFD700' : '#00E676',
                          boxShadow: `0 0 8px ${isAutomated ? '#FFD700' : '#00E676'}`
                        }}
                      />
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'rgba(255,255,255,0.9)',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '1px'
                        }}
                      >
                        {isAutomated ? 'Automated' : 'Manual'}
                      </Typography>
                    </Box>
                    
                    {isAutomated && (
                      <Chip 
                        label="AUTO" 
                        size="small" 
                        sx={{ 
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          bgcolor: '#FFD700', 
                          color: '#1a1a1a',
                          fontWeight: 800,
                          fontSize: '0.65rem',
                          letterSpacing: '0.5px',
                          boxShadow: '0 2px 8px rgba(255,215,0,0.4)'
                        }} 
                      />
                    )}
                  </Box>

                  {/* Time Configuration Section */}
                  <Box sx={{ p: 3, pt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'rgba(255,255,255,0.9)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              mb: 1.5,
                              letterSpacing: '0.8px',
                              textTransform: 'uppercase'
                            }}
                          >
                            Start Time
                          </Typography>
                          <Paper
                            elevation={3}
                            sx={{
                              borderRadius: '12px',
                              overflow: 'hidden',
                              background: 'linear-gradient(145deg, #ffffff, #f8f9fa)'
                            }}
                          >
                            <TextField
                              type="time"
                              size="small"
                              value={blockConfig.startTime}
                              onChange={(e) => {
                                if (!isAutomated) {
                                  const newConfigs = [...state.schedule.blockConfigurations];
                                  newConfigs[index].startTime = e.target.value;
                                  setState(prev => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      blockConfigurations: newConfigs,
                                      updatedAt: new Date().toISOString()
                                    }
                                  }));
                                  autoSave();
                                }
                              }}
                              disabled={isAutomated}
                              sx={{ 
                                width: '100%',
                                '& .MuiInputBase-input': { 
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                  color: isAutomated ? '#9e9e9e' : '#1976d2',
                                  textAlign: 'center',
                                  padding: '12px 8px',
                                  letterSpacing: '1px',
                                  fontFamily: 'monospace'
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: 'none'
                                },
                                '& .MuiInputBase-root': {
                                  borderRadius: '12px'
                                }
                              }}
                            />
                          </Paper>
                        </Box>
                      </Grid>
                      
                      <Grid size={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'rgba(255,255,255,0.9)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              mb: 1.5,
                              letterSpacing: '0.8px',
                              textTransform: 'uppercase'
                            }}
                          >
                            End Time
                          </Typography>
                          <Paper
                            elevation={3}
                            sx={{
                              borderRadius: '12px',
                              overflow: 'hidden',
                              background: 'linear-gradient(145deg, #ffffff, #f8f9fa)'
                            }}
                          >
                            <TextField
                              type="time"
                              size="small"
                              value={blockConfig.endTime}
                              onChange={(e) => {
                                const newConfigs = [...state.schedule.blockConfigurations];
                                newConfigs[index].endTime = e.target.value;
                                setState(prev => ({
                                  ...prev,
                                  schedule: {
                                    ...prev.schedule,
                                    blockConfigurations: newConfigs,
                                    updatedAt: new Date().toISOString()
                                  }
                                }));
                                autoSave();
                              }}
                              sx={{ 
                                width: '100%',
                                '& .MuiInputBase-input': { 
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                  color: '#1976d2',
                                  textAlign: 'center',
                                  padding: '12px 8px',
                                  letterSpacing: '1px',
                                  fontFamily: 'monospace'
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: 'none'
                                },
                                '& .MuiInputBase-root': {
                                  borderRadius: '12px'
                                }
                              }}
                            />
                          </Paper>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Duration Display */}
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Paper 
                        elevation={2}
                        sx={{ 
                          background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))', 
                          borderRadius: '16px', 
                          py: 1.5, 
                          px: 2,
                          border: '2px solid rgba(255,255,255,0.6)'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <ClockIcon sx={{ color: cardColor, fontSize: '1rem' }} />
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: cardColor,
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              letterSpacing: '0.5px'
                            }}
                          >
                            {(() => {
                              const startTime = getTimeWithDefault(blockConfig.startTime, '07:00');
                              const endTime = getTimeWithDefault(blockConfig.endTime, '22:00');
                              const startMin = timeToMinutes(startTime);
                              const endMin = timeToMinutes(endTime);
                              const duration = Math.max(0, endMin - startMin);
                              const hours = Math.floor(duration / 60);
                              const minutes = duration % 60;
                              return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
                            })()}
                          </Typography>
                        </Box>
                      </Paper>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Add New Block Button */}
          {state.schedule.blockConfigurations.length < 10 && (
            <Card
              onClick={() => {
                const newConfigs = [...state.schedule.blockConfigurations];
                newConfigs.push({
                  blockNumber: newConfigs.length + 1,
                  startTime: '07:00',
                  endTime: newConfigs[0]?.endTime || '22:00'
                });
                setState(prev => ({
                  ...prev,
                  schedule: {
                    ...prev.schedule,
                    blockConfigurations: newConfigs,
                    updatedAt: new Date().toISOString()
                  }
                }));
                autoSave();
              }}
              elevation={2}
              sx={{
                borderRadius: '24px',
                minHeight: '180px',
                border: '3px dashed rgba(0, 75, 128, 0.3)',
                backgroundColor: 'rgba(0, 75, 128, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 75, 128, 0.08)',
                  borderColor: 'rgba(0, 75, 128, 0.5)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 15px 40px rgba(0, 75, 128, 0.15)'
                }
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box 
                  sx={{ 
                    width: 60, 
                    height: 60, 
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 75, 128, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                    border: '2px dashed rgba(0, 75, 128, 0.3)'
                  }}
                >
                  <BusIcon sx={{ fontSize: 32, color: 'rgb(0, 75, 128)' }} />
                </Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: 'rgb(0, 75, 128)', 
                    fontWeight: 700, 
                    mb: 1
                  }}
                >
                  Add Bus Block
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(0, 75, 128, 0.7)', 
                    fontWeight: 500
                  }}
                >
                  Block #{state.schedule.blockConfigurations.length + 1}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Panel Footer with Action Button */}
      <Box sx={{ 
        p: 3, 
        borderTop: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)'
      }}>
        <Button
          variant="contained"
          size="large"
          onClick={generateBlocks}
          disabled={state.isLoading}
          startIcon={state.isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
          fullWidth
          sx={{
            py: 2,
            borderRadius: 3,
            backgroundColor: 'rgb(0, 75, 128)',
            boxShadow: '0 4px 12px rgba(0, 75, 128, 0.3)',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1.1rem',
            '&:hover': {
              backgroundColor: 'rgb(20, 85, 138)',
              boxShadow: '0 6px 16px rgba(0, 75, 128, 0.4)'
            },
            '&:disabled': {
              backgroundColor: 'rgba(0, 75, 128, 0.5)'
            }
          }}
        >
          {state.isLoading ? 'Generating Blocks...' : 'Generate Block Configuration'}
        </Button>
        
        {state.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {state.error}
          </Alert>
        )}
      </Box>

      {/* Save Notification */}
      <Snackbar
        open={state.saveNotification.open}
        autoHideDuration={3000}
        onClose={() => setState(prev => ({ 
          ...prev, 
          saveNotification: { ...prev.saveNotification, open: false } 
        }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setState(prev => ({ 
            ...prev, 
            saveNotification: { ...prev.saveNotification, open: false } 
          }))}
          severity={state.saveNotification.severity}
          sx={{ width: '100%' }}
        >
          {state.saveNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BlockConfigPanel;
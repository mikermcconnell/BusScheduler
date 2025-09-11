import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Timeline as TimelineIcon,
  DirectionsBus as BusIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  PlayCircleOutline as PublishIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    metrics, 
    isLoading, 
    isRefreshing, 
    error, 
    refresh, 
    lastUpdated 
  } = useDashboardMetrics();

  // Format helper functions
  const formatPercentage = (value: number) => `${value}%`;
  const formatMinutes = (value: number) => `${value} min`;
  const formatCount = (value: number) => value.toLocaleString();

  // Get recovery status color
  const getRecoveryStatusColor = (percentage: number) => {
    if (percentage >= 15) return 'success.main';
    if (percentage >= 10) return 'warning.main';
    return 'error.main';
  };

  // Get validation status icon
  const getValidationIcon = (passRate: number) => {
    if (passRate >= 90) return <CheckCircleIcon color="success" />;
    if (passRate >= 70) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  // Schedule health indicators
  const scheduleHealthCards = metrics ? [
    {
      title: 'Recovery Time Health',
      value: formatPercentage(metrics.scheduleQuality.averageRecoveryPercentage),
      subtitle: `${metrics.scheduleQuality.schedulesWithHealthyRecovery} healthy / ${metrics.scheduleQuality.schedulesNeedingAttention} need attention`,
      color: getRecoveryStatusColor(metrics.scheduleQuality.averageRecoveryPercentage),
      icon: <SpeedIcon />,
      trend: metrics.scheduleQuality.averageRecoveryPercentage >= 10 ? 'up' : 'down',
    },
    {
      title: 'Validation Pass Rate',
      value: formatPercentage(metrics.scheduleQuality.validationPassRate),
      subtitle: `${metrics.validationStatus.schedulesWithErrors} with errors, ${metrics.validationStatus.schedulesWithWarnings} with warnings`,
      color: metrics.scheduleQuality.validationPassRate >= 90 ? 'success.main' : 'warning.main',
      icon: getValidationIcon(metrics.scheduleQuality.validationPassRate),
      trend: null,
    },
    {
      title: 'Block Utilization',
      value: formatPercentage(metrics.scheduleQuality.averageBlockUtilization),
      subtitle: 'Average across all active schedules',
      color: 'info.main',
      icon: <BusIcon />,
      trend: metrics.scheduleQuality.averageBlockUtilization >= 85 ? 'up' : 'down',
    },
    {
      title: 'Service Frequency',
      value: formatMinutes(metrics.planningEfficiency.averageServiceFrequency),
      subtitle: `Cycle time: ${formatMinutes(metrics.planningEfficiency.averageCycleTime)}`,
      color: 'primary.main',
      icon: <TimelineIcon />,
      trend: null,
    },
  ] : [];

  // Quick actions for scheduling tasks
  const quickActions = [
    {
      title: 'Start New Schedule',
      description: 'Upload and process schedule data',
      icon: <UploadIcon fontSize="large" />,
      path: '/upload',
      color: 'primary',
      variant: 'contained' as const,
    },
    {
      title: 'Continue Draft',
      description: `${metrics?.draftPipeline.totalDrafts || 0} drafts in progress`,
      icon: <EditIcon fontSize="large" />,
      path: '/draft-library',
      color: 'secondary',
      variant: 'outlined' as const,
      disabled: !metrics || metrics.draftPipeline.totalDrafts === 0,
    },
    {
      title: 'View Schedules',
      description: 'Review published schedules',
      icon: <ViewIcon fontSize="large" />,
      path: '/schedules',
      color: 'info',
      variant: 'outlined' as const,
    },
  ];

  return (
    <Box sx={{ pr: 3, width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Schedule Planning Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Monitor schedule quality, validation status, and planning efficiency
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastUpdated && (
            <Chip
              label={`Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
              size="small"
              variant="outlined"
            />
          )}
          <Button
            onClick={refresh}
            disabled={isRefreshing}
            startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            size="small"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Schedule Health Metrics */}
      <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 2 }}>
        Schedule Quality Indicators
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {isLoading ? (
          <Grid size={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Loading metrics...</Typography>
            </Paper>
          </Grid>
        ) : (
          scheduleHealthCards.map((card) => (
            <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper 
                sx={{ 
                  p: 3,
                  height: '100%',
                  borderTop: `4px solid`,
                  borderTopColor: card.color,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ color: card.color, mr: 1 }}>
                    {card.icon}
                  </Box>
                  {card.trend && (
                    <Box sx={{ ml: 'auto' }}>
                      {card.trend === 'up' ? (
                        <TrendingUpIcon color="success" fontSize="small" />
                      ) : (
                        <TrendingDownIcon color="error" fontSize="small" />
                      )}
                    </Box>
                  )}
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: card.color }}>
                  {card.value}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, mt: 1 }}>
                  {card.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.subtitle}
                </Typography>
              </Paper>
            </Grid>
          ))
        )}
      </Grid>

      {/* Draft Pipeline Status */}
      {metrics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Draft Pipeline Status
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Stack spacing={2}>
                  {[
                    { label: 'Uploading', value: metrics.draftPipeline.uploading, color: 'grey' },
                    { label: 'Analyzing TimePoints', value: metrics.draftPipeline.analyzing, color: 'info' },
                    { label: 'Configuring Blocks', value: metrics.draftPipeline.configuring, color: 'warning' },
                    { label: 'Reviewing Summary', value: metrics.draftPipeline.reviewing, color: 'secondary' },
                    { label: 'Ready to Publish', value: metrics.draftPipeline.readyToPublish, color: 'success' },
                  ].map((stage) => (
                    <Box key={stage.label}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{stage.label}</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {stage.value} {stage.value === 1 ? 'draft' : 'drafts'}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={metrics.draftPipeline.totalDrafts > 0 ? 
                          (stage.value / metrics.draftPipeline.totalDrafts) * 100 : 0}
                        color={stage.color as any}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Total drafts in pipeline: {metrics.draftPipeline.totalDrafts}
                </Typography>
                {metrics.draftPipeline.readyToPublish > 0 && (
                  <Button
                    size="small"
                    startIcon={<PublishIcon />}
                    onClick={() => navigate('/draft-library')}
                  >
                    Publish Ready Drafts
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Schedules Needing Attention */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Schedules Needing Attention
              </Typography>
              {metrics.validationStatus.criticalAlerts > 0 || 
               metrics.scheduleQuality.schedulesNeedingAttention > 0 ? (
                <List dense>
                  {metrics.validationStatus.criticalAlerts > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${metrics.validationStatus.criticalAlerts} Critical Alerts`}
                        secondary="Validation errors requiring immediate attention"
                      />
                      <IconButton size="small" onClick={() => navigate('/schedules')}>
                        <NavigateNextIcon />
                      </IconButton>
                    </ListItem>
                  )}
                  {metrics.scheduleQuality.schedulesNeedingAttention > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${metrics.scheduleQuality.schedulesNeedingAttention} Low Recovery`}
                        secondary="Schedules with < 10% recovery time"
                      />
                      <IconButton size="small" onClick={() => navigate('/schedules')}>
                        <NavigateNextIcon />
                      </IconButton>
                    </ListItem>
                  )}
                  {metrics.recentActivity.upcomingExpirations > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <ScheduleIcon color="info" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${metrics.recentActivity.upcomingExpirations} Expiring Soon`}
                        secondary="Schedules expiring in next 30 days"
                      />
                      <IconButton size="small" onClick={() => navigate('/schedules')}>
                        <NavigateNextIcon />
                      </IconButton>
                    </ListItem>
                  )}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                  <CheckCircleIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2">
                    All schedules are healthy
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Service Band Distribution & Common Issues */}
      {metrics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Service Band Distribution
              </Typography>
              <Stack spacing={2}>
                {[
                  { 
                    label: 'Fastest', 
                    value: metrics.planningEfficiency.serviceBandDistribution.fastest,
                    color: 'success.main'
                  },
                  { 
                    label: 'Standard', 
                    value: metrics.planningEfficiency.serviceBandDistribution.standard,
                    color: 'warning.main'
                  },
                  { 
                    label: 'Slowest', 
                    value: metrics.planningEfficiency.serviceBandDistribution.slowest,
                    color: 'error.main'
                  },
                ].map((band) => (
                  <Box key={band.label}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{band.label}</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatPercentage(band.value)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={band.value}
                      sx={{ 
                        height: 8, 
                        borderRadius: 1,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: band.color,
                        }
                      }}
                    />
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Peak hour coverage: {formatPercentage(metrics.planningEfficiency.peakHourCoverage)}
              </Typography>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Common Validation Issues
              </Typography>
              <List dense>
                {metrics.validationStatus.commonIssues.map((issue, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <AssessmentIcon color="action" />
                    </ListItemIcon>
                    <ListItemText primary={issue} />
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Data Integrity Score: {formatPercentage(metrics.systemHealth.dataIntegrityScore)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Quick Actions */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Quick Actions
      </Typography>
      <Grid container spacing={3}>
        {quickActions.map((action) => (
          <Grid key={action.title} size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                cursor: action.disabled ? 'default' : 'pointer',
                opacity: action.disabled ? 0.6 : 1,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': action.disabled ? {} : {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                },
              }}
              onClick={() => !action.disabled && navigate(action.path)}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ color: `${action.color}.main`, mb: 2 }}>
                  {action.icon}
                </Box>
                <Typography variant="h6" gutterBottom>
                  {action.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {action.description}
                </Typography>
                <Button
                  variant={action.variant}
                  color={action.color as any}
                  size="small"
                  disabled={action.disabled}
                  sx={{ mt: 'auto' }}
                >
                  {action.disabled ? 'No Drafts' : 'Get Started'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity Summary */}
      {metrics && metrics.recentActivity.lastPublishedSchedule && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Schedules Created This Week
              </Typography>
              <Typography variant="h6">
                {metrics.recentActivity.thisWeekSchedulesCreated}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Schedules Modified This Week
              </Typography>
              <Typography variant="h6">
                {metrics.recentActivity.thisWeekSchedulesModified}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Last Published
              </Typography>
              <Typography variant="h6">
                {metrics.recentActivity.lastPublishedSchedule.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(metrics.recentActivity.lastPublishedSchedule.timestamp).toLocaleDateString()}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* System Health Footer */}
      {metrics && (
        <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" color="text.secondary">
                Storage Used: {formatPercentage(metrics.systemHealth.storageUsedPercentage)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" color="text.secondary">
                Avg Processing: {metrics.systemHealth.averageProcessingTime.toFixed(1)}ms
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" color="text.secondary">
                Data Integrity: {formatPercentage(metrics.systemHealth.dataIntegrityScore)}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DraftNameHeader from '../components/DraftNameHeader';
import { LoadingSkeleton } from '../components/loading';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Alert,
  Tabs,
  Tab,
  Paper,
  Chip,
  Grid,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  GetApp as ExportIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { scheduleStorage, SavedSchedule } from '../services/scheduleStorage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const SummarySchedule: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [schedule, setSchedule] = useState<SavedSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSchedule = () => {
      try {
        if (scheduleId) {
          const foundSchedule = scheduleStorage.getScheduleById(scheduleId);
          if (foundSchedule) {
            setSchedule(foundSchedule);
          } else {
            setError('Schedule not found');
          }
        } else {
          setError('No schedule ID provided');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
      } finally {
        setIsLoading(false);
      }
    };

    loadSchedule();
  }, [scheduleId]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExport = () => {
    if (!schedule) return;
    // Export functionality would be implemented here
    alert(`Exporting schedule: ${schedule.routeName}`);
  };

  const handleEdit = () => {
    if (scheduleId) {
      navigate(`/generate/edit/${scheduleId}`);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Summary Schedule
        </Typography>
        <LoadingSkeleton variant="dashboard" />
      </Box>
    );
  }

  if (error || !schedule) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Schedule not found'}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/schedules')}
        >
          Back to Schedules
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Draft Name Header */}
      <DraftNameHeader />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/schedules')}
            sx={{ mb: 2 }}
          >
            Back to Schedules
          </Button>
          <Typography variant="h4" component="h1" gutterBottom>
            {schedule.routeName}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {schedule.direction} • Effective {new Date(schedule.effectiveDate).toLocaleDateString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            Edit Schedule
          </Button>
          <Button
            variant="contained"
            startIcon={<ExportIcon />}
            onClick={handleExport}
          >
            Export Excel
          </Button>
        </Box>
      </Box>
      {/* Schedule Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid
          size={{
            xs: 12,
            md: 3
          }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6">
                {typeof schedule.tripCount === 'object' 
                  ? schedule.tripCount.weekday + schedule.tripCount.saturday + schedule.tripCount.sunday
                  : schedule.tripCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Trips
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid
          size={{
            xs: 12,
            md: 3
          }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="success.main">
                {schedule.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid
          size={{
            xs: 12,
            md: 3
          }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6">
                {schedule.fileType.toUpperCase()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                File Type
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid
          size={{
            xs: 12,
            md: 3
          }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6">
                {new Date(schedule.createdAt).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Schedule Overview" />
              <Tab label="Trip Details" />
              <Tab label="Time Analysis" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Schedule Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                <Chip label={`Route: ${schedule.routeName}`} color="primary" />
                <Chip label={`Direction: ${schedule.direction}`} />
                <Chip label={`Trips: ${schedule.tripCount}`} />
                <Chip label={`Status: ${schedule.status}`} color="success" />
              </Box>
              <Typography variant="body1" paragraph>
                This schedule contains {typeof schedule.tripCount === 'object' 
                  ? schedule.tripCount.weekday + schedule.tripCount.saturday + schedule.tripCount.sunday
                  : schedule.tripCount} trips for {schedule.routeName} 
                in the {schedule.direction} direction. The schedule is currently {schedule.status.toLowerCase()}.
              </Typography>
              <Alert severity="info">
                Schedule data and trip details would be displayed here in the full implementation.
              </Alert>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Trip Details
              </Typography>
              <Alert severity="info">
                Detailed trip information including departure times, time points, and duration would be displayed here.
              </Alert>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Time Analysis
              </Typography>
              <Alert severity="info">
                Travel time analysis charts and tables would be displayed here.
              </Alert>
            </Paper>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SummarySchedule;
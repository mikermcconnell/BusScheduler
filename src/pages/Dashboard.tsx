import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Button,
  Paper,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Schedule as ScheduleIcon,
  DirectionsBus as BusIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      title: 'Upload Schedule',
      description: 'Import schedule data from Excel files',
      icon: <UploadIcon fontSize="large" />,
      path: '/upload',
      color: 'primary.main',
    },
    {
      title: 'View Schedules',
      description: 'Browse and manage existing schedules',
      icon: <ScheduleIcon fontSize="large" />,
      path: '/schedules',
      color: 'secondary.main',
    },
    {
      title: 'Manage Routes',
      description: 'Configure bus routes and time points',
      icon: <BusIcon fontSize="large" />,
      path: '/routes',
      color: 'success.main',
    },
  ];

  const stats = [
    { label: 'Total Routes', value: '0', color: 'primary.main' },
    { label: 'Active Schedules', value: '0', color: 'secondary.main' },
    { label: 'Time Points', value: '0', color: 'success.main' },
    { label: 'Files Processed', value: '0', color: 'warning.main' },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome to the Bus Route Scheduler. Manage your bus schedules and routes efficiently.
      </Typography>
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat) => (
          <Grid
            key={stat.label}
            size={{
              xs: 12,
              sm: 6,
              md: 3
            }}>
            <Paper
              sx={{
                p: 3,
                textAlign: 'center',
                borderLeft: `4px solid`,
                borderLeftColor: stat.color,
              }}
            >
              <Typography variant="h4" component="div" sx={{ color: stat.color, fontWeight: 'bold' }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      {/* Quick Actions */}
      <Typography variant="h5" component="h2" gutterBottom>
        Quick Actions
      </Typography>
      <Grid container spacing={3}>
        {quickActions.map((action) => (
          <Grid
            key={action.title}
            size={{
              xs: 12,
              md: 4
            }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                },
              }}
              onClick={() => navigate(action.path)}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 3 }}>
                <Box
                  sx={{
                    color: action.color,
                    mb: 2,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  {action.icon}
                </Box>
                <Typography variant="h6" component="h3" gutterBottom>
                  {action.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {action.description}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 'auto' }}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {/* Recent Activity */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Recent Activity
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <AnalyticsIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">
              No recent activity to display
            </Typography>
            <Typography variant="body2">
              Start by uploading your first schedule file
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Dashboard;
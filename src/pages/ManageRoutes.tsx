import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Paper,
  Grid,
} from '@mui/material';
import {
  DirectionsBus as BusIcon,
  Add as AddIcon,
  LocationOn as LocationIcon,
  Route as RouteIcon,
} from '@mui/icons-material';

const ManageRoutes: React.FC = () => {
  const stats = [
    {
      title: 'Total Routes',
      value: '0',
      icon: <RouteIcon fontSize="large" />,
      color: 'primary.main',
    },
    {
      title: 'Time Points',
      value: '0',
      icon: <LocationIcon fontSize="large" />,
      color: 'secondary.main',
    },
    {
      title: 'Active Services',
      value: '0',
      icon: <BusIcon fontSize="large" />,
      color: 'success.main',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Manage Routes
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Configure bus routes and time points
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="large"
        >
          Add Route
        </Button>
      </Box>

      {/* Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat) => (
          <Grid item xs={12} md={4} key={stat.title}>
            <Card>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ color: stat.color, mb: 2 }}>
                  {stat.icon}
                </Box>
                <Typography variant="h4" component="div" sx={{ color: stat.color, fontWeight: 'bold' }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Route Management */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Route Configuration
          </Typography>
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <BusIcon
              sx={{
                fontSize: 64,
                color: 'text.secondary',
                mb: 2,
                opacity: 0.5,
              }}
            />
            <Typography variant="h6" gutterBottom>
              No Routes Configured
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first route to start managing schedules
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="large"
            >
              Create Route
            </Button>
          </Paper>
        </CardContent>
      </Card>

      {/* Time Points Management */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Time Points
          </Typography>
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <LocationIcon
              sx={{
                fontSize: 64,
                color: 'text.secondary',
                mb: 2,
                opacity: 0.5,
              }}
            />
            <Typography variant="h6" gutterBottom>
              No Time Points Defined
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add time points to define stops along your routes
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              size="large"
            >
              Add Time Point
            </Button>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ManageRoutes;
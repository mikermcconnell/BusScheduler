import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Drafts as DraftIcon,
  Timeline as TimelineIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';

const GenerateSummarySchedule: React.FC = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/timepoints');
  };

  return (
    <Box>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Dashboard
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/drafts')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <DraftIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Draft Schedules
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/timepoints')}
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'primary.main' }}
          >
            <TimelineIcon sx={{ mr: 0.5, fontSize: 16 }} />
            Timepoint Page
          </Link>
          <Typography color="text.primary" variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
            Generate Summary Schedule
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={handleGoBack}
          sx={{ mr: 2 }}
        >
          Back to TimePoints
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Generate Summary Schedule
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Create professional summary schedules from timepoint analysis
          </Typography>
        </Box>
      </Box>
      
      <Card>
        <CardContent>
          <Typography variant="body1">
            This page will contain functionality to generate summary schedules.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GenerateSummarySchedule;
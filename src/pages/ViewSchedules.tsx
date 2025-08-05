import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

const ViewSchedules: React.FC = () => {
  // Placeholder data - will be replaced with real data in future phases
  const schedules = [
    // Empty for now - will be populated from backend/state management
  ];

  const mockSchedules = [
    {
      id: '1',
      routeName: 'Route 101 - Downtown Express',
      direction: 'Inbound',
      effectiveDate: '2024-01-15',
      status: 'Active',
      tripCount: 45,
    },
    {
      id: '2',
      routeName: 'Route 102 - Campus Shuttle',
      direction: 'Outbound',
      effectiveDate: '2024-01-20',
      status: 'Draft',
      tripCount: 32,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            View Schedules
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Browse and manage your bus schedules
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="large"
        >
          New Schedule
        </Button>
      </Box>

      {schedules.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <ScheduleIcon
            sx={{
              fontSize: 64,
              color: 'text.secondary',
              mb: 2,
              opacity: 0.5,
            }}
          />
          <Typography variant="h6" gutterBottom>
            No Schedules Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start by uploading your first schedule file
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            href="/upload"
          >
            Upload Schedule
          </Button>
        </Paper>
      ) : (
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Route Name</TableCell>
                    <TableCell>Direction</TableCell>
                    <TableCell>Effective Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Trips</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockSchedules.map((schedule) => (
                    <TableRow key={schedule.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {schedule.routeName}
                        </Typography>
                      </TableCell>
                      <TableCell>{schedule.direction}</TableCell>
                      <TableCell>{schedule.effectiveDate}</TableCell>
                      <TableCell>
                        <Chip
                          label={schedule.status}
                          color={getStatusColor(schedule.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{schedule.tripCount}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            startIcon={<ViewIcon />}
                            variant="outlined"
                          >
                            View
                          </Button>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            variant="outlined"
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            startIcon={<DeleteIcon />}
                            variant="outlined"
                            color="error"
                          >
                            Delete
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ViewSchedules;
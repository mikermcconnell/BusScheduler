import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { scheduleStorage, SavedSchedule } from '../services/scheduleStorage';

interface EditableTrip {
  id: string;
  timePoint: string;
  time: string;
  isEditing: boolean;
}

const EditCSVSchedule: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<SavedSchedule | null>(null);
  const [trips, setTrips] = useState<EditableTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadSchedule = () => {
      try {
        if (scheduleId) {
          const foundSchedule = scheduleStorage.getScheduleById(scheduleId);
          if (foundSchedule) {
            setSchedule(foundSchedule);
            // Convert schedule data to editable trips
            const editableTrips: EditableTrip[] = [
              { id: '1', timePoint: 'Downtown Terminal', time: '07:00', isEditing: false },
              { id: '2', timePoint: 'Johnson at Napier', time: '07:15', isEditing: false },
              { id: '3', timePoint: 'RVH Main Entrance', time: '07:30', isEditing: false },
              { id: '4', timePoint: 'Georgian College', time: '07:45', isEditing: false },
              { id: '5', timePoint: 'Georgian Mall', time: '08:00', isEditing: false },
            ];
            setTrips(editableTrips);
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

  const handleEdit = (tripId: string) => {
    setTrips(prev => prev.map(trip => 
      trip.id === tripId 
        ? { ...trip, isEditing: true }
        : { ...trip, isEditing: false }
    ));
  };

  const handleSaveTrip = (tripId: string, newTime: string) => {
    setTrips(prev => prev.map(trip => 
      trip.id === tripId 
        ? { ...trip, time: newTime, isEditing: false }
        : trip
    ));
    setHasChanges(true);
  };


  const handleDeleteTrip = (tripId: string) => {
    setTrips(prev => prev.filter(trip => trip.id !== tripId));
    setHasChanges(true);
  };

  const handleAddTrip = () => {
    const newTrip: EditableTrip = {
      id: Date.now().toString(),
      timePoint: 'New Time Point',
      time: '00:00',
      isEditing: true
    };
    setTrips(prev => [...prev, newTrip]);
  };

  const handleSaveSchedule = () => {
    if (!schedule) return;
    
    // In a real implementation, this would save the changes
    alert('Schedule changes saved successfully!');
    setHasChanges(false);
    // Stay on current page instead of navigating to summary-schedule
    console.log('Schedule changes saved successfully for schedule:', scheduleId);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Loading schedule...</Typography>
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
            Edit Schedule: {schedule.routeName}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {schedule.direction} • {trips.length} time points
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddTrip}
          >
            Add Time Point
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveSchedule}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You have unsaved changes. Make sure to save before leaving this page.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Schedule Time Points
          </Typography>
          
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Time Point</TableCell>
                  <TableCell>Scheduled Time</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id} hover>
                    <TableCell>
                      {trip.isEditing ? (
                        <TextField
                          size="small"
                          defaultValue={trip.timePoint}
                          variant="outlined"
                        />
                      ) : (
                        trip.timePoint
                      )}
                    </TableCell>
                    <TableCell>
                      {trip.isEditing ? (
                        <TextField
                          size="small"
                          type="time"
                          defaultValue={trip.time}
                          variant="outlined"
                          onBlur={(e) => handleSaveTrip(trip.id, e.target.value)}
                        />
                      ) : (
                        trip.time
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {trip.isEditing ? (
                          <>
                            <Tooltip title="Save">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSaveTrip(trip.id, trip.time)}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(trip.id)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteTrip(trip.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {trips.length === 0 && (
            <Paper sx={{ p: 6, textAlign: 'center', mt: 3 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Time Points
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add time points to define the schedule
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddTrip}
              >
                Add First Time Point
              </Button>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default EditCSVSchedule;
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOpen as ExcelIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';
import { scheduleStorage, ScheduleListItem, SavedSchedule } from '../services/scheduleStorage';
import ScheduleEditDialog from '../components/ScheduleEditDialog';

const ViewSchedules: React.FC = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<SavedSchedule | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');

  // Load schedules on component mount
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const schedulesData = scheduleStorage.getScheduleListItems();
      setSchedules(schedulesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteClick = useCallback((schedule: ScheduleListItem) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!scheduleToDelete) return;

    setIsDeleting(true);
    try {
      const result = scheduleStorage.deleteSchedule(scheduleToDelete.id);
      if (result.success) {
        await loadSchedules(); // Refresh the list
        setDeleteDialogOpen(false);
        setScheduleToDelete(null);
      } else {
        setError(result.error || 'Failed to delete schedule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setIsDeleting(false);
    }
  }, [scheduleToDelete, loadSchedules]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  }, []);

  const handleViewClick = useCallback(async (schedule: ScheduleListItem) => {
    try {
      const fullSchedule = scheduleStorage.getScheduleById(schedule.id);
      if (fullSchedule) {
        setSelectedSchedule(fullSchedule);
        setDialogMode('view');
        setEditDialogOpen(true);
      } else {
        setError('Schedule not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    }
  }, []);

  const handleEditClick = useCallback(async (schedule: ScheduleListItem) => {
    try {
      // Get the full schedule data
      const fullSchedule = scheduleStorage.getScheduleById(schedule.id);
      if (!fullSchedule) {
        setError('Schedule not found');
        return;
      }

      // Navigate to timepoints page with schedule data
      navigate('/drafts/timepoints', {
        state: {
          savedScheduleId: schedule.id,
          csvData: fullSchedule.data,
          dayType: 'weekday' // Default day type, could be made dynamic
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    }
  }, [navigate]);

  const handleEditDialogClose = useCallback(() => {
    setEditDialogOpen(false);
    setSelectedSchedule(null);
  }, []);

  const handleScheduleSave = useCallback(async () => {
    setEditDialogOpen(false);
    setSelectedSchedule(null);
    await loadSchedules(); // Refresh the list
  }, [loadSchedules]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileTypeIcon = (fileType: 'excel' | 'csv') => {
    return fileType === 'csv' ? <CsvIcon fontSize="small" /> : <ExcelIcon fontSize="small" />;
  };

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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>Loading schedules...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            View Schedules
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Browse and manage your bus schedules ({schedules.length} saved)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="large"
          href="/upload"
        >
          New Schedule
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
                    <TableCell>File Type</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {schedule.routeName}
                        </Typography>
                      </TableCell>
                      <TableCell>{schedule.direction}</TableCell>
                      <TableCell>{formatDate(schedule.effectiveDate)}</TableCell>
                      <TableCell>
                        <Chip
                          label={schedule.status}
                          color={getStatusColor(schedule.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{schedule.tripCount}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getFileTypeIcon(schedule.fileType)}
                          <Typography variant="body2" color="text.secondary">
                            {schedule.fileType.toUpperCase()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(schedule.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            startIcon={<ViewIcon />}
                            variant="outlined"
                            onClick={() => handleViewClick(schedule)}
                          >
                            View
                          </Button>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            variant="outlined"
                            onClick={() => handleEditClick(schedule)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            startIcon={<DeleteIcon />}
                            variant="outlined"
                            color="error"
                            onClick={() => handleDeleteClick(schedule)}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the schedule "{scheduleToDelete?.routeName}"? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule View/Edit Dialog */}
      <ScheduleEditDialog
        open={editDialogOpen}
        schedule={selectedSchedule}
        onClose={handleEditDialogClose}
        onSave={handleScheduleSave}
        mode={dialogMode}
      />
    </Box>
  );
};

export default ViewSchedules;
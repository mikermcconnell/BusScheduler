import React, { useState, useEffect } from 'react';
import { workflowStateService } from '../services/workflowStateService';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Tooltip,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Drafts as DraftIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  MoreVert as MoreIcon,
  Schedule as ScheduleIcon,
  Upload as UploadIcon,
  AutoMode as AutoSaveIcon,
  Upgrade as PromoteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { scheduleStorage, DraftSchedule } from '../services/scheduleStorage';
import { formatDateTime, getTimeAgo } from '../utils/dateHelpers';

interface DraftScheduleListProps {
  onRestoreDraft: (draft: DraftSchedule) => void;
  onDraftDeleted?: () => void;
  compact?: boolean;
  maxHeight?: number;
}

const DraftScheduleList: React.FC<DraftScheduleListProps> = ({
  onRestoreDraft,
  onDraftDeleted,
  compact = false,
  maxHeight
}) => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftSchedule[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<DraftSchedule | null>(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuDraftId, setMenuDraftId] = useState<string | null>(null);

  const loadDrafts = () => {
    try {
      const allDrafts = scheduleStorage.getAllDraftSchedules();
      // Sort by most recently updated
      allDrafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setDrafts(allDrafts);
    } catch (err) {
      console.error('Error loading drafts:', err);
      setError('Failed to load draft schedules');
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, draftId: string) => {
    event.stopPropagation(); // Prevent the list item click from firing
    setAnchorEl(event.currentTarget);
    setMenuDraftId(draftId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuDraftId(null);
  };

  const handleDeleteClick = (draft: DraftSchedule) => {
    setSelectedDraft(draft);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handlePromoteClick = (draft: DraftSchedule) => {
    setSelectedDraft(draft);
    setPromoteDialogOpen(true);
    handleMenuClose();
  };

  const handleRestoreClick = (draft: DraftSchedule) => {
    onRestoreDraft(draft);
    handleMenuClose();
  };

  const handleDraftClick = (draft: DraftSchedule) => {
    // Mark the draft review step as complete
    workflowStateService.completeStep('drafts', {
      draftId: draft.id,
      draftName: draft.fileName,
      reviewedAt: new Date().toISOString()
    });
    
    // Navigate to timepoints page with the draft data
    navigate('/drafts/timepoints', {
      state: {
        csvData: draft.uploadedData,
        dayType: 'weekday', // Default to weekday, could be enhanced to remember the actual day type
        savedScheduleId: null // This is a draft, not a saved schedule
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDraft) return;

    setLoading(true);
    setError(null);

    try {
      const result = scheduleStorage.deleteDraftSchedule(selectedDraft.id);
      if (result.success) {
        loadDrafts();
        onDraftDeleted?.();
      } else {
        setError(result.error || 'Failed to delete draft');
      }
    } catch (err) {
      setError('Failed to delete draft schedule');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedDraft(null);
    }
  };

  const handlePromoteConfirm = async () => {
    if (!selectedDraft) return;

    setLoading(true);
    setError(null);

    try {
      const result = scheduleStorage.promoteDraftToSchedule(selectedDraft.id);
      if (result.success) {
        loadDrafts();
        onDraftDeleted?.();
      } else {
        setError(result.error || 'Failed to promote draft to schedule');
      }
    } catch (err) {
      setError('Failed to promote draft to schedule');
    } finally {
      setLoading(false);
      setPromoteDialogOpen(false);
      setSelectedDraft(null);
    }
  };

  const getStepLabel = (step: string) => {
    switch (step) {
      case 'uploaded': return 'Uploaded';
      case 'validated': return 'Validated';
      case 'processed': return 'Processed';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  const getStepColor = (step: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (step) {
      case 'uploaded': return 'default';
      case 'validated': return 'info';
      case 'processed': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  if (drafts.length === 0 && !error) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <DraftIcon />
            <Typography variant="h6">Draft Schedules</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            No draft schedules found. Upload a file to create your first draft.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <DraftIcon />
              <Typography variant="h6">
                Draft Schedules ({drafts.length})
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={loadDrafts}
              startIcon={<RestoreIcon />}
            >
              Refresh
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <List
            sx={{
              maxHeight: maxHeight || (compact ? 300 : 500),
              overflow: 'auto'
            }}
          >
            {drafts.map((draft, index) => (
              <React.Fragment key={draft.id}>
                <ListItem
                  component="button"
                  onClick={() => handleDraftClick(draft)}
                  sx={{
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <ListItemIcon>
                    <Tooltip title={draft.fileType.toUpperCase()}>
                      {draft.fileType === 'excel' ? <ScheduleIcon /> : <UploadIcon />}
                    </Tooltip>
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="subtitle2" noWrap>
                          {draft.fileName}
                        </Typography>
                        <Chip
                          size="small"
                          label={getStepLabel(draft.processingStep)}
                          color={getStepColor(draft.processingStep)}
                        />
                        {draft.autoSaved && (
                          <Tooltip title="Auto-saved">
                            <AutoSaveIcon fontSize="small" color="action" />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {compact 
                            ? getTimeAgo(draft.updatedAt)
                            : `Updated: ${formatDateTime(draft.updatedAt)}`
                          }
                        </Typography>
                        {!compact && (
                          <>
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              Created: {formatDateTime(draft.createdAt)}
                            </Typography>
                          </>
                        )}
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={(e) => handleMenuOpen(e, draft.id)}
                      size="small"
                    >
                      <MoreIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < drafts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            const draft = drafts.find(d => d.id === menuDraftId);
            if (draft) handleRestoreClick(draft);
          }}
        >
          <ListItemIcon>
            <RestoreIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Restore Draft</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            const draft = drafts.find(d => d.id === menuDraftId);
            if (draft && draft.summarySchedule) handlePromoteClick(draft);
          }}
          disabled={!drafts.find(d => d.id === menuDraftId)?.summarySchedule}
        >
          <ListItemIcon>
            <PromoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save as Schedule</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            const draft = drafts.find(d => d.id === menuDraftId);
            if (draft) handleDeleteClick(draft);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !loading && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Draft Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the draft "{selectedDraft?.fileName}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            disabled={loading}
            variant="contained"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Promote Confirmation Dialog */}
      <Dialog
        open={promoteDialogOpen}
        onClose={() => !loading && setPromoteDialogOpen(false)}
      >
        <DialogTitle>Save as Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Convert "{selectedDraft?.fileName}" from draft to a completed schedule?
            The draft will be removed after successful conversion.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoteDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handlePromoteConfirm} 
            color="primary" 
            disabled={loading}
            variant="contained"
          >
            {loading ? 'Converting...' : 'Save as Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DraftScheduleList;
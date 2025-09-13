import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  Skeleton,
  Paper,
  Stack,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  PlayArrow as OpenIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  FolderOpen as FolderIcon,
  Schedule as ScheduleIcon,
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { draftService, UnifiedDraftCompat } from '../services/draftService';

const DraftLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<UnifiedDraftCompat[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDraft, setSelectedDraft] = useState<UnifiedDraftCompat | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newDraftName, setNewDraftName] = useState('');

  // Load drafts on component mount
  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const allDrafts = await draftService.getAllDraftsUnified();
      setDrafts(allDrafts);
      setError(null);
    } catch (err) {
      setError('Failed to load drafts. Please try again.');
      console.error('Error loading drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDraft = async (draft: UnifiedDraftCompat) => {
    try {
      // Load draft with full state restoration data
      const result = await draftService.loadDraftWithFullState(draft.draftId);
      
      if (!result) {
        setError('Failed to load draft');
        return;
      }
      
      const { restorationData } = result;
      
      // Set as current session draft
      draftService.setCurrentSessionDraft(draft.draftId);
      
      // Navigate to appropriate step with full restoration data
      switch (draft.currentStep) {
        case 'timepoints':
          navigate('/timepoints', { state: restorationData });
          break;
        case 'blocks':
          navigate('/block-configuration', { state: restorationData });
          break;
        case 'summary':
        case 'ready-to-publish':
          navigate('/summary-schedule', { state: restorationData });
          break;
      default:
        navigate('/timepoints', { state: restorationData }); // Default to timepoints with restoration data
    }
    } catch (error) {
      console.error('Error opening draft:', error);
      setError('Failed to open draft. Please try again.');
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, draft: UnifiedDraftCompat) => {
    setAnchorEl(event.currentTarget);
    setSelectedDraft(draft);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDraft(null);
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleRenameClick = () => {
    if (selectedDraft) {
      setNewDraftName(selectedDraft.draftName);
      setRenameDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDraft) return;
    
    try {
      const result = await draftService.deleteDraft(selectedDraft.draftId);
      if (result.success) {
        // Remove from local state
        setDrafts(prev => prev.filter(d => d.draftId !== selectedDraft.draftId));
        setError(null);
      } else {
        setError(result.error || 'Failed to delete draft');
      }
    } catch (err) {
      setError('Failed to delete draft. Please try again.');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedDraft(null);
    }
  };

  const handleRenameConfirm = async () => {
    if (!selectedDraft || !newDraftName.trim()) return;
    
    try {
      const draft = { ...selectedDraft, draftName: newDraftName.trim() };
      const result = await draftService.saveDraft(draft, 'current-user');
      if (result.success) {
        // Update local state
        setDrafts(prev => prev.map(d => 
          d.draftId === selectedDraft.draftId ? draft : d
        ));
        setError(null);
      } else {
        setError(result.error || 'Failed to rename draft');
      }
    } catch (err) {
      setError('Failed to rename draft. Please try again.');
    } finally {
      setRenameDialogOpen(false);
      setSelectedDraft(null);
      setNewDraftName('');
    }
  };

  const getStepDisplayName = (step: string) => {
    const stepNames = {
      'upload': 'Uploaded',
      'timepoints': 'TimePoints Analysis',
      'blocks': 'Block Configuration',
      'summary': 'Summary Schedule',
      'ready-to-publish': 'Ready to Publish'
    };
    return stepNames[step as keyof typeof stepNames] || step;
  };

  const getStepColor = (step: string) => {
    const colors = {
      'upload': 'default',
      'timepoints': 'primary',
      'blocks': 'secondary',
      'summary': 'success',
      'ready-to-publish': 'warning'
    };
    return colors[step as keyof typeof colors] || 'default';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
              Draft Library
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View and manage your schedule drafts. Continue working on existing drafts or start fresh.
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadDrafts}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => navigate('/upload')}
            >
              New Schedule
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" height={32} sx={{ mb: 1 }} />
                  <Skeleton variant="text" height={20} sx={{ mb: 2 }} />
                  <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
                  <Skeleton variant="text" height={20} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : drafts.length === 0 ? (
        /* Empty State */
        <Paper 
          sx={{ 
            p: 6, 
            textAlign: 'center',
            backgroundColor: 'grey.50',
            border: '2px dashed',
            borderColor: 'grey.300'
          }}
        >
          <FolderIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No Drafts Found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You haven't created any schedule drafts yet. Start by uploading your first schedule file.
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => navigate('/upload')}
            size="large"
          >
            Upload First Schedule
          </Button>
        </Paper>
      ) : (
        /* Drafts Grid */
        <Grid container spacing={3}>
          {drafts.map((draft) => (
            <Grid key={draft.draftId} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Header with menu */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flexGrow={1}>
                      <Typography variant="h6" component="h3" noWrap title={draft.draftName}>
                        {draft.draftName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {draft.originalData.fileName}
                      </Typography>
                    </Box>
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleMenuClick(e, draft)}
                      sx={{ ml: 1 }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  {/* Progress and Status */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Chip 
                        label={getStepDisplayName(draft.currentStep)}
                        color={getStepColor(draft.currentStep) as any}
                        size="small"
                      />
                      <Typography variant="body2" color="text.secondary">
                        {draft.progress}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={draft.progress} 
                      sx={{ 
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'grey.200'
                      }} 
                    />
                  </Box>

                  {/* Draft Info */}
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Created:
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(draft.metadata.createdAt)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Modified:
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(draft.metadata.lastModifiedAt)}
                      </Typography>
                    </Box>
                    {draft.metadata.isPublished && (
                      <Chip 
                        label="Published" 
                        color="success" 
                        size="small" 
                        sx={{ alignSelf: 'flex-start' }}
                      />
                    )}
                  </Stack>
                </CardContent>

                <Divider />
                
                <CardActions sx={{ p: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<OpenIcon />}
                    onClick={() => handleOpenDraft(draft)}
                  >
                    Open Draft
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRenameClick}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Rename
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Draft</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedDraft?.draftName}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Draft</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Draft Name"
            value={newDraftName}
            onChange={(e) => setNewDraftName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRenameConfirm} disabled={!newDraftName.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DraftLibrary;
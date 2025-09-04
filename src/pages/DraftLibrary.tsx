import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Paper,
  CircularProgress,
  Alert,
  Fab,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { WorkflowDraftState } from '../types/workflow';
import { draftService } from '../services/draftService';
import DraftLibraryCard from '../components/DraftLibraryCard';
import DraftUploadZone from '../components/DraftUploadZone';

type SortBy = 'name' | 'created' | 'modified' | 'progress';
type FilterBy = 'all' | 'upload' | 'timepoints' | 'blocks' | 'summary' | 'ready-to-publish';
type ViewMode = 'grid' | 'list';

const DraftLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<WorkflowDraftState[]>([]);
  const [filteredDrafts, setFilteredDrafts] = useState<WorkflowDraftState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('modified');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);

  // Load drafts from Firebase
  const loadDrafts = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedDrafts = await draftService.getAllDrafts();
      setDrafts(loadedDrafts);
      setFilteredDrafts(loadedDrafts);
    } catch (err: any) {
      setError('Failed to load drafts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadDrafts();
  }, []);

  // Filter and sort drafts
  useEffect(() => {
    let filtered = [...drafts];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(draft =>
        draft.originalData.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(draft => draft.currentStep === filterBy);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.originalData.fileName.localeCompare(b.originalData.fileName);
        case 'created':
          return new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime();
        case 'modified':
          return new Date(b.metadata.lastModifiedAt).getTime() - new Date(a.metadata.lastModifiedAt).getTime();
        case 'progress':
          const stepOrder = ['upload', 'timepoints', 'blocks', 'summary', 'ready-to-publish'];
          return stepOrder.indexOf(b.currentStep) - stepOrder.indexOf(a.currentStep);
        default:
          return 0;
      }
    });

    setFilteredDrafts(filtered);
  }, [drafts, searchTerm, sortBy, filterBy]);

  // Handle draft actions
  const handleOpenDraft = async (draft: WorkflowDraftState) => {
    // Set as current session draft
    draftService.setCurrentSessionDraft(draft.draftId);
    
    // Navigate to appropriate workflow step
    switch (draft.currentStep) {
      case 'upload':
        navigate('/upload');
        break;
      case 'timepoints':
        navigate('/timepoints');
        break;
      case 'blocks':
        navigate('/block-configuration');
        break;
      case 'summary':
      case 'ready-to-publish':
        navigate('/summary-schedule');
        break;
      default:
        navigate('/upload');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      try {
        await draftService.deleteDraft(draftId);
        await loadDrafts(); // Reload the list
      } catch (err: any) {
        setError('Failed to delete draft: ' + err.message);
      }
    }
  };

  const handleDuplicateDraft = async (draft: WorkflowDraftState) => {
    try {
      // Create a new draft with the same data
      const result = await draftService.createDraftFromUpload(
        draft.originalData.fileName + ' (Copy)',
        draft.originalData.fileType,
        draft.originalData.uploadedData
      );
      
      if (result.success) {
        await loadDrafts(); // Reload the list
      } else {
        setError('Failed to duplicate draft: ' + result.error);
      }
    } catch (err: any) {
      setError('Failed to duplicate draft: ' + err.message);
    }
  };

  const handleUploadComplete = async () => {
    setShowUploadZone(false);
    await loadDrafts();
  };

  const getStepProgress = (step: WorkflowDraftState['currentStep']): number => {
    const progressMap = {
      'upload': 20,
      'timepoints': 40,
      'blocks': 60,
      'summary': 80,
      'ready-to-publish': 100
    };
    return progressMap[step] || 0;
  };

  const getStepLabel = (step: WorkflowDraftState['currentStep']): string => {
    const labelMap = {
      'upload': 'Uploaded',
      'timepoints': 'Timepoints Analyzed',
      'blocks': 'Blocks Configured',
      'summary': 'Summary Generated',
      'ready-to-publish': 'Ready to Publish'
    };
    return labelMap[step] || 'Unknown';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          📚 Draft Library
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh drafts">
            <IconButton onClick={loadDrafts} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={viewMode === 'grid' ? 'List view' : 'Grid view'}>
            <IconButton 
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              color="primary"
            >
              {viewMode === 'grid' ? <ViewListIcon /> : <GridViewIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Description */}
      <Typography variant="body1" color="text.secondary" mb={3}>
        Manage all your draft schedules in one place. Upload new files, continue working on existing drafts, or organize your schedule library.
      </Typography>

      {/* Upload Zone */}
      {showUploadZone && (
        <Box mb={3}>
          <DraftUploadZone 
            onUploadComplete={handleUploadComplete}
            onCancel={() => setShowUploadZone(false)}
          />
        </Box>
      )}

      {/* Search and Filter Bar */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
          <Box flex={{ xs: '1 1 100%', md: '1 1 33%' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search drafts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box flex={{ xs: '1 1 48%', md: '1 1 24%' }}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filterBy}
                label="Filter by Status"
                onChange={(e: SelectChangeEvent) => setFilterBy(e.target.value as FilterBy)}
              >
                <MenuItem value="all">All Drafts</MenuItem>
                <MenuItem value="upload">Uploaded</MenuItem>
                <MenuItem value="timepoints">Timepoints</MenuItem>
                <MenuItem value="blocks">Blocks</MenuItem>
                <MenuItem value="summary">Summary</MenuItem>
                <MenuItem value="ready-to-publish">Ready</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box flex={{ xs: '1 1 48%', md: '1 1 24%' }}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={(e: SelectChangeEvent) => setSortBy(e.target.value as SortBy)}
              >
                <MenuItem value="modified">Last Modified</MenuItem>
                <MenuItem value="created">Date Created</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="progress">Progress</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box flex={{ xs: '1 1 100%', md: '0 0 auto' }}>
            <Chip 
              label={`${filteredDrafts.length} drafts`}
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* Drafts Grid/List */}
      {!loading && filteredDrafts.length === 0 && (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm || filterBy !== 'all' 
              ? 'No drafts match your search criteria'
              : 'No drafts yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {searchTerm || filterBy !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload a CSV file to create your first draft'}
          </Typography>
          {!searchTerm && filterBy === 'all' && (
            <Box mt={2}>
              <Fab
                variant="extended"
                color="primary"
                onClick={() => setShowUploadZone(true)}
              >
                <AddIcon sx={{ mr: 1 }} />
                Upload CSV
              </Fab>
            </Box>
          )}
        </Paper>
      )}

      {!loading && filteredDrafts.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={3}>
          {filteredDrafts.map((draft) => (
            <Box key={draft.draftId} sx={{ flex: { xs: '1 1 100%', sm: '1 1 45%', md: '1 1 30%' } }}>
              <DraftLibraryCard
                draft={draft}
                onOpen={() => handleOpenDraft(draft)}
                onDelete={() => handleDeleteDraft(draft.draftId)}
                onDuplicate={() => handleDuplicateDraft(draft)}
                progress={getStepProgress(draft.currentStep)}
                statusLabel={getStepLabel(draft.currentStep)}
                viewMode={viewMode}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Floating Action Button */}
      {!showUploadZone && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => setShowUploadZone(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Container>
  );
};

export default DraftLibrary;
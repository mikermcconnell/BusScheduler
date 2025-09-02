import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  LinearProgress,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
  Stack,
  Divider
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  OpenInNew as OpenIcon,
  Delete as DeleteIcon,
  FileCopy as DuplicateIcon,
  Description as FileIcon,
  Schedule as TimeIcon,
  CheckCircle as CompleteIcon,
  RadioButtonUnchecked as IncompleteIcon
} from '@mui/icons-material';
import { WorkflowDraftState } from '../types/workflow';

interface DraftLibraryCardProps {
  draft: WorkflowDraftState;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  progress: number;
  statusLabel: string;
  viewMode: 'grid' | 'list';
}

const DraftLibraryCard: React.FC<DraftLibraryCardProps> = ({
  draft,
  onOpen,
  onDelete,
  onDuplicate,
  progress,
  statusLabel,
  viewMode
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onDelete();
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onDuplicate();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getFileTypeColor = () => {
    return draft.originalData.fileType === 'csv' ? 'success' : 'info';
  };

  const getProgressColor = () => {
    if (progress >= 80) return 'success';
    if (progress >= 60) return 'info';
    if (progress >= 40) return 'warning';
    return 'inherit';
  };

  const getStepIcon = () => {
    switch (draft.currentStep) {
      case 'ready-to-publish':
        return <CompleteIcon color="success" fontSize="small" />;
      case 'summary':
        return <CompleteIcon color="info" fontSize="small" />;
      default:
        return <IncompleteIcon color="action" fontSize="small" />;
    }
  };

  // Extract draft name from file name (without extension)
  const draftName = draft.originalData.fileName.replace(/\.(csv|xlsx?)$/i, '');

  if (viewMode === 'list') {
    return (
      <Card 
        sx={{ 
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3
          }
        }}
        onClick={onOpen}
      >
        <Box display="flex" alignItems="center" p={2}>
          <FileIcon sx={{ mr: 2, color: 'text.secondary' }} />
          <Box flexGrow={1}>
            <Typography variant="subtitle1" fontWeight="medium">
              {draftName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(draft.metadata.lastModifiedAt)}
            </Typography>
          </Box>
          <Chip 
            label={statusLabel}
            size="small"
            color={getProgressColor() as any}
            sx={{ mr: 2 }}
          />
          <IconButton onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
      </Card>
    );
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
      onClick={onOpen}
    >
      {/* Progress Bar */}
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        color={getProgressColor() as any}
        sx={{ height: 6 }}
      />
      
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <FileIcon color="action" />
            <Chip 
              label={draft.originalData.fileType.toUpperCase()} 
              size="small" 
              color={getFileTypeColor() as any}
              variant="outlined"
            />
          </Box>
          <IconButton 
            size="small" 
            onClick={handleMenuOpen}
            sx={{ ml: 'auto' }}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>

        {/* Title */}
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: '3.6em'
          }}
        >
          {draftName}
        </Typography>

        {/* Status */}
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          {getStepIcon()}
          <Typography variant="body2" color="text.secondary">
            {statusLabel}
          </Typography>
        </Stack>

        {/* Metadata */}
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            <TimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
            Created: {formatDate(draft.metadata.createdAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            <TimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
            Modified: {formatDate(draft.metadata.lastModifiedAt)}
          </Typography>
        </Box>

        {/* Additional Info */}
        {draft.timepointsAnalysis && (
          <Box mt={2}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {draft.timepointsAnalysis.serviceBands?.length || 0} service bands
            </Typography>
            {draft.timepointsAnalysis.outliers && draft.timepointsAnalysis.outliers.length > 0 && (
              <Chip 
                label={`${draft.timepointsAnalysis.outliers.length} outliers`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Box display="flex" gap={1}>
          <Tooltip title="Open draft">
            <IconButton 
              size="small" 
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              <OpenIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Duplicate draft">
            <IconButton 
              size="small" 
              onClick={handleDuplicate}
            >
              <DuplicateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete draft">
            <IconButton 
              size="small" 
              color="error"
              onClick={handleDelete}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary">
          v{draft.metadata.version}
        </Typography>
      </CardActions>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={() => { handleMenuClose(); onOpen(); }}>
          <OpenIcon sx={{ mr: 1 }} fontSize="small" />
          Open
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <DuplicateIcon sx={{ mr: 1 }} fontSize="small" />
          Duplicate
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default DraftLibraryCard;
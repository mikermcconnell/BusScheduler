/**
 * Save to Draft Button Component
 * Provides manual save functionality with status feedback
 */

import React from 'react';
import { Button, Box, Typography, CircularProgress, Chip } from '@mui/material';
import { Save as SaveIcon, CheckCircle as SavedIcon, Error as ErrorIcon } from '@mui/icons-material';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface SaveToDraftProps {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  showStatus?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SaveToDraft: React.FC<SaveToDraftProps> = ({
  variant = 'outlined',
  size = 'medium',
  showStatus = true,
  disabled = false,
  className
}) => {
  const { 
    state,
    saveDraft
  } = useWorkspace();
  
  const currentDraftId = state.scheduleData.currentDraft?.draftId;
  const lastSaved = state.scheduleData.lastSaved;
  const isSaving = false; // We'll add this state if needed
  const saveError = null; // We'll add this state if needed

  const handleSave = async () => {
    if (!currentDraftId || isSaving) return;
    await saveDraft();
  };

  const getStatusColor = () => {
    if (saveError) return 'error';
    if (isSaving) return 'primary';
    if (lastSaved) return 'success';
    return 'default';
  };

  const getStatusText = () => {
    if (saveError) return 'Save failed';
    if (isSaving) return 'Saving...';
    if (lastSaved) {
      const now = new Date();
      const savedTime = new Date(lastSaved);
      const diffMinutes = Math.floor((now.getTime() - savedTime.getTime()) / (1000 * 60));
      
      if (diffMinutes < 1) return 'Saved just now';
      if (diffMinutes < 60) return `Saved ${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      return `Saved ${diffHours}h ago`;
    }
    return 'Not saved';
  };

  const getButtonIcon = () => {
    if (isSaving) return <CircularProgress size={16} />;
    if (saveError) return <ErrorIcon />;
    if (lastSaved) return <SavedIcon />;
    return <SaveIcon />;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} className={className}>
      <Button
        variant={variant}
        size={size}
        onClick={handleSave}
        disabled={disabled || isSaving || !currentDraftId}
        startIcon={getButtonIcon()}
        sx={{
          minWidth: size === 'small' ? 'auto' : '120px',
          ...(saveError ? {
            borderColor: 'error.main',
            color: 'error.main',
            '&:hover': {
              borderColor: 'error.dark',
              backgroundColor: 'error.light',
              color: 'error.dark'
            }
          } : {})
        }}
      >
        {isSaving ? 'Saving...' : 'Save Draft'}
      </Button>
      
      {showStatus && (
        <Chip
          label={getStatusText()}
          size="small"
          color={getStatusColor()}
          variant={lastSaved && !saveError ? 'filled' : 'outlined'}
          sx={{
            fontSize: '0.75rem',
            height: '24px',
            '& .MuiChip-label': {
              px: 1
            }
          }}
        />
      )}
    </Box>
  );
};

/**
 * Auto-Save Status Indicator (without manual save button)
 */
export const AutoSaveStatus: React.FC = () => {
  const { state } = useWorkspace();
  const lastSaved = state.scheduleData.lastSaved;
  const isSaving = false; // We'll add this if needed
  const saveError = null; // We'll add this if needed

  const getStatusIcon = () => {
    if (isSaving) return <CircularProgress size={14} />;
    if (saveError) return <ErrorIcon sx={{ fontSize: 14 }} />;
    if (lastSaved) return <SavedIcon sx={{ fontSize: 14 }} />;
    return null;
  };

  const getStatusText = () => {
    if (saveError) return 'Auto-save failed';
    if (isSaving) return 'Auto-saving...';
    if (lastSaved) {
      const now = new Date();
      const savedTime = new Date(lastSaved);
      const diffMinutes = Math.floor((now.getTime() - savedTime.getTime()) / (1000 * 60));
      
      if (diffMinutes < 1) return 'Auto-saved just now';
      if (diffMinutes < 60) return `Auto-saved ${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      return `Auto-saved ${diffHours}h ago`;
    }
    return '';
  };

  const statusText = getStatusText();
  if (!statusText) return null;

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 0.5,
      opacity: 0.7,
      fontSize: '0.75rem'
    }}>
      {getStatusIcon()}
      <Typography variant="caption" color="text.secondary">
        {statusText}
      </Typography>
    </Box>
  );
};
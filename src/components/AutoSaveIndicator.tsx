/**
 * Auto-save Indicator Component
 * Shows real-time saving status to prevent data loss anxiety
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Fade } from '@mui/material';
import { 
  CloudDone as SavedIcon,
  CloudUpload as SavingIcon,
  CloudOff as ErrorIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | null;
  errorMessage?: string;
  compact?: boolean;
}

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSaved,
  errorMessage,
  compact = false
}) => {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <PendingIcon fontSize="small" />,
          text: 'Changes pending...',
          color: '#FFC107'
        };
      
      case 'saving':
        return {
          icon: <CircularProgress size={16} thickness={4} />,
          text: 'Saving...',
          color: '#2196F3'
        };
      
      case 'saved':
        return {
          icon: <SavedIcon fontSize="small" />,
          text: lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : 'All changes saved',
          color: '#4CAF50'
        };
      
      case 'error':
        return {
          icon: <ErrorIcon fontSize="small" />,
          text: errorMessage || 'Save failed',
          color: '#F44336'
        };
      
      default:
        return null;
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  const statusDisplay = getStatusDisplay();
  
  if (!statusDisplay && !showSaved) {
    return null;
  }

  if (compact) {
    return (
      <Fade in={!!statusDisplay || showSaved}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: statusDisplay?.color || '#4CAF50',
            fontSize: '12px'
          }}
        >
          {statusDisplay?.icon || <SavedIcon fontSize="small" />}
        </Box>
      </Fade>
    );
  }

  return (
    <Fade in={!!statusDisplay || showSaved}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          padding: '4px 12px',
          borderRadius: '16px',
          backgroundColor: statusDisplay ? `${statusDisplay.color}15` : '#4CAF5015',
          border: `1px solid ${statusDisplay?.color || '#4CAF50'}30`
        }}
      >
        {statusDisplay?.icon || <SavedIcon fontSize="small" />}
        <Typography
          variant="caption"
          sx={{
            color: statusDisplay?.color || '#4CAF50',
            fontWeight: 500,
            fontSize: '12px'
          }}
        >
          {statusDisplay?.text || 'All changes saved'}
        </Typography>
      </Box>
    </Fade>
  );
};

export default AutoSaveIndicator;
import React from 'react';
import {
  Chip,
  Box,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Cloud as CloudIcon,
  CloudOff as CloudOffIcon,
  Drafts as DraftIcon,
  CheckCircle as PublishedIcon,
  Schedule as ScheduleIcon,
  Sync as SyncIcon
} from '@mui/icons-material';

interface ScheduleStatusIndicatorProps {
  isDraft: boolean;
  isPublished?: boolean;
  isSyncing?: boolean;
  isFirebaseConnected?: boolean;
  lastSaved?: string | null;
  scheduleName?: string;
}

const ScheduleStatusIndicator: React.FC<ScheduleStatusIndicatorProps> = ({
  isDraft,
  isPublished,
  isSyncing,
  isFirebaseConnected = false,
  lastSaved,
  scheduleName
}) => {
  const getStatusColor = () => {
    if (isPublished) return 'success';
    if (isDraft) return 'warning';
    return 'default';
  };

  const getStatusIcon = () => {
    if (isSyncing) return <SyncIcon />;
    if (isPublished) return <PublishedIcon />;
    if (isDraft) return <DraftIcon />;
    return <ScheduleIcon />;
  };

  const getStatusLabel = () => {
    if (isSyncing) return 'Syncing...';
    if (isPublished) return 'Published';
    if (isDraft) return 'Draft';
    return 'Unsaved';
  };

  const getConnectionStatus = () => {
    if (isFirebaseConnected) {
      return {
        icon: <CloudIcon fontSize="small" />,
        color: 'success' as const,
        tooltip: 'Connected to Firebase - changes are saved to cloud'
      };
    }
    return {
      icon: <CloudOffIcon fontSize="small" />,
      color: 'error' as const,
      tooltip: 'Not connected to Firebase - changes saved locally only'
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Schedule Status */}
      <Chip
        icon={getStatusIcon()}
        label={getStatusLabel()}
        color={getStatusColor()}
        size="small"
        variant={isDraft && !isPublished ? "outlined" : "filled"}
      />

      {/* Cloud Connection Status */}
      <Tooltip title={connectionStatus.tooltip}>
        <Chip
          icon={connectionStatus.icon}
          label={isFirebaseConnected ? "Cloud" : "Local"}
          color={connectionStatus.color}
          size="small"
          variant="outlined"
        />
      </Tooltip>

      {/* Syncing Indicator */}
      {isSyncing && (
        <CircularProgress size={16} thickness={4} />
      )}

      {/* Last Saved */}
      {lastSaved && !isSyncing && (
        <Tooltip title={`Last saved: ${new Date(lastSaved).toLocaleString()}`}>
          <Chip
            label={`Saved ${getRelativeTime(lastSaved)}`}
            size="small"
            variant="outlined"
            sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

// Helper function to get relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

export default ScheduleStatusIndicator;
/**
 * Sync Status Indicator Component
 * Shows real-time sync status for workflow persistence
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Snackbar,
  Box,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  CloudDone,
  CloudOff,
  CloudSync,
  Error as ErrorIcon,
  Close,
  Refresh,
  WifiOff
} from '@mui/icons-material';
import { offlineQueue, QueueStatus } from '../services/offlineQueue';

export type SyncState = 
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error'
  | 'syncing'
  | 'idle';

interface SyncStatusIndicatorProps {
  /** Override sync state (for testing) */
  overrideState?: SyncState;
  /** Show detailed status */
  showDetails?: boolean;
  /** Position for floating indicator */
  position?: 'top-right' | 'bottom-right' | 'inline';
  /** Custom error message */
  customError?: string;
}

interface SyncStatus {
  state: SyncState;
  message: string;
  queueSize: number;
  lastSyncTime?: number;
  isOnline: boolean;
  processing: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  overrideState,
  showDetails = false,
  position = 'inline',
  customError
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    message: 'Ready',
    queueSize: 0,
    isOnline: navigator.onLine,
    processing: false
  });
  
  const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  
  const previousStateRef = useRef<SyncState>('idle');
  const previousQueueSizeRef = useRef<number>(0);
  
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queueStatus: QueueStatus) => {
      const newStatus = mapQueueStatusToSyncStatus(queueStatus);
      setSyncStatus(newStatus);

      const previousState = previousStateRef.current;
      const previousQueueSize = previousQueueSizeRef.current;

      previousStateRef.current = newStatus.state;
      previousQueueSizeRef.current = newStatus.queueSize;

      if (newStatus.state === 'error' && previousState !== 'error') {
        setErrorMessage(customError || queueStatus.lastError || 'Sync failed');
        setShowErrorSnackbar(true);
      }

      const transitionedToSaved =
        newStatus.state === 'saved' &&
        newStatus.queueSize === 0 &&
        (previousState !== 'saved' || previousQueueSize > 0);

      if (transitionedToSaved) {
        setShowSuccessSnackbar(true);
      }
    });

    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false, state: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [customError]);
  
  const mapQueueStatusToSyncStatus = (queueStatus: QueueStatus): SyncStatus => {
    const { isOnline, queueSize, processing, lastSyncTime, lastError } = queueStatus;
    
    if (overrideState) {
      return {
        state: overrideState,
        message: getSyncMessage(overrideState, queueSize),
        queueSize,
        lastSyncTime,
        isOnline,
        processing
      };
    }
    
    let state: SyncState;
    if (!isOnline) {
      state = 'offline';
    } else if (lastError && queueSize > 0) {
      state = 'error';
    } else if (processing) {
      state = 'syncing';
    } else if (queueSize > 0) {
      state = 'saving';
    } else {
      state = 'saved';
    }
    
    return {
      state,
      message: getSyncMessage(state, queueSize),
      queueSize,
      lastSyncTime,
      isOnline,
      processing
    };
  };
  
  const getSyncMessage = (state: SyncState, queueSize: number): string => {
    switch (state) {
      case 'saving':
        return queueSize === 1 ? 'Saving...' : `Saving ${queueSize} items...`;
      case 'saved':
        return 'All changes saved';
      case 'offline':
        return queueSize > 0 
          ? `Offline - ${queueSize} changes queued`
          : 'Offline - changes will sync when online';
      case 'error':
        return queueSize > 0
          ? `Sync failed - ${queueSize} items queued`
          : 'Sync error';
      case 'syncing':
        return 'Syncing to cloud...';
      case 'idle':
        return 'Ready';
      default:
        return 'Unknown status';
    }
  };
  
  const getStatusIcon = () => {
    switch (syncStatus.state) {
      case 'saving':
      case 'syncing':
        return <CircularProgress size={16} />;
      case 'saved':
        return <CloudDone color="success" />;
      case 'offline':
        return syncStatus.isOnline ? <CloudSync color="warning" /> : <WifiOff color="disabled" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'idle':
        return <CloudDone color="action" />;
      default:
        return <CloudDone color="action" />;
    }
  };
  
  const getStatusColor = (): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (syncStatus.state) {
      case 'saved':
        return 'success';
      case 'saving':
      case 'syncing':
        return 'info';
      case 'offline':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };
  
  const handleRetry = () => {
    if (syncStatus.queueSize > 0) {
      offlineQueue.forceRetry();
    }
  };
  
  const renderInlineStatus = () => (
    <Box display="flex" alignItems="center" gap={1}>
      <Chip
        icon={getStatusIcon()}
        label={syncStatus.message}
        color={getStatusColor()}
        variant="outlined"
        size="small"
        onClick={syncStatus.state === 'error' ? handleRetry : undefined}
        clickable={syncStatus.state === 'error'}
      />
      
      {showDetails && syncStatus.lastSyncTime && (
        <Tooltip title={`Last synced: ${new Date(syncStatus.lastSyncTime).toLocaleTimeString()}`}>
          <Typography variant="caption" color="text.secondary">
            {getTimeSince(syncStatus.lastSyncTime)}
          </Typography>
        </Tooltip>
      )}
      
      {syncStatus.state === 'error' && (
        <Tooltip title="Retry sync">
          <IconButton size="small" onClick={handleRetry}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
  
  const renderFloatingStatus = () => (
    <Box
      position="fixed"
      top={position === 'top-right' ? 16 : 'auto'}
      bottom={position === 'bottom-right' ? 16 : 'auto'}
      right={16}
      zIndex={1300}
      sx={{
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' }
      }}
    >
      {renderInlineStatus()}
    </Box>
  );
  
  const getTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };
  
  return (
    <>
      {position === 'inline' ? renderInlineStatus() : renderFloatingStatus()}
      
      {/* Error Snackbar */}
      <Snackbar
        open={showErrorSnackbar && syncStatus.state === 'error'}
        onClose={() => setShowErrorSnackbar(false)}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          action={
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton
                size="small"
                onClick={handleRetry}
                color="inherit"
              >
                <Refresh fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setShowErrorSnackbar(false)}
                color="inherit"
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Sync Error
            </Typography>
            <Typography variant="body2">
              {errorMessage}
              {syncStatus.queueSize > 0 && (
                <> ({syncStatus.queueSize} changes queued)</>
              )}
            </Typography>
          </Box>
        </Alert>
      </Snackbar>
      
      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSuccessSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setShowSuccessSnackbar(false)}
        >
          All changes saved to cloud
        </Alert>
      </Snackbar>
    </>
  );
};

export default SyncStatusIndicator;
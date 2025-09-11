import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Stack,
  Paper,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { draftService, UnifiedDraftCompat } from '../services/draftService';
import { emit } from '../services/workspaceEventBus';

interface DraftNameHeaderProps {
  onDraftUpdate?: (updatedDraft: UnifiedDraftCompat) => void;
}

const DraftNameHeader: React.FC<DraftNameHeaderProps> = ({ 
  onDraftUpdate 
}) => {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [currentDraft, setCurrentDraft] = useState<UnifiedDraftCompat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textFieldRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const loadCurrentDraft = async () => {
      try {
        const draft = await draftService.getCurrentSessionDraft();
        if (draft) {
          setCurrentDraft(draft);
          setEditName(draft.draftName);
        }
      } catch (error) {
        console.error('Error loading current draft:', error);
      }
    };

    loadCurrentDraft();
  }, []);

  const handleEditStart = () => {
    if (currentDraft) {
      setEditName(currentDraft.draftName);
      setIsEditing(true);
      setError(null);
      // Focus the input after state update
      setTimeout(() => {
        const input = textFieldRef.current?.querySelector('input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }
  };

  const handleNameClick = () => {
    if (!loading) {
      handleEditStart();
    }
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setError(null);
    if (currentDraft) {
      setEditName(currentDraft.draftName);
    }
  };

  const handleEditSave = async () => {
    if (!currentDraft || !editName.trim()) {
      setError('Draft name cannot be empty');
      return;
    }

    if (editName.trim() === currentDraft.draftName) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updatedDraft = {
        ...currentDraft,
        draftName: editName.trim()
      };

      const result = await draftService.saveDraft(updatedDraft, 'current-user');
      
      if (result.success) {
        const previousName = currentDraft.draftName;
        setCurrentDraft(updatedDraft);
        setIsEditing(false);
        onDraftUpdate?.(updatedDraft);

        // Emit draft update event for global synchronization
        emit({
          type: 'draft-update',
          source: 'DraftNameHeader',
          priority: 1,
          payload: {
            draftId: updatedDraft.draftId,
            draftName: editName.trim(),
            previousName,
            updateType: 'name',
            metadata: {
              lastModified: new Date().toISOString()
            }
          }
        });
      } else {
        setError(result.error || 'Failed to save draft name');
      }
    } catch (error) {
      setError('Error saving draft name. Please try again.');
      console.error('Error saving draft name:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  };


  if (!currentDraft) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {isEditing ? (
          <>
            <TextField
              ref={textFieldRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              variant="outlined"
              size="small"
              disabled={loading}
              placeholder="Enter draft name..."
              error={!!error}
              helperText={error}
              sx={{ 
                flexGrow: 1,
                '& .MuiOutlinedInput-root': {
                  fontSize: '1.25rem',
                  fontWeight: 500
                }
              }}
              InputProps={{
                'aria-label': 'Draft name'
              }}
            />
            
            <Tooltip title="Save changes (Enter)">
              <IconButton 
                size="small" 
                onClick={handleEditSave} 
                disabled={loading || !editName.trim()}
                color="primary"
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.2)
                  }
                }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancel (Escape)">
              <IconButton 
                size="small" 
                onClick={handleEditCancel} 
                disabled={loading}
                sx={{
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.error.main, 0.2)
                  }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <Typography 
              variant="h5" 
              component="h1" 
              sx={{ 
                fontWeight: 600,
                color: 'text.primary',
                flexGrow: 1
              }}
            >
              {currentDraft.draftName}
            </Typography>
            <Tooltip title="Edit draft name">
              <IconButton
                size="small"
                onClick={handleEditStart}
                disabled={loading}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.1)
                  }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default DraftNameHeader;
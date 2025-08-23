import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
  Paper,
  IconButton,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose
}) => {
  const { shortcutsByCategory, formatShortcut } = useKeyboardShortcuts({ enabled: false });

  const categoryIcons: Record<string, React.ReactNode> = {
    'Navigation': '🧭',
    'Actions': '⚡',
    'Workflow': '🔄',
    'Help': '❓'
  };

  const categoryColors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
    'Navigation': 'primary',
    'Actions': 'success',
    'Workflow': 'warning',
    'Help': 'info'
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyboardIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Keyboard Shortcuts
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use these keyboard shortcuts to navigate and work more efficiently with the Bus Route Scheduler.
        </Typography>

        <Grid container spacing={3}>
          {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
            <Grid
              key={category}
              size={{
                xs: 12,
                sm: 6
              }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: 'grey.50'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                    {categoryIcons[category]} {category}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {shortcuts.map((shortcut, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        backgroundColor: 'white',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {shortcut.description}
                      </Typography>
                      <Chip
                        label={formatShortcut(shortcut)}
                        size="small"
                        variant="outlined"
                        color={categoryColors[category]}
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          ml: 2
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ 
          p: 2, 
          backgroundColor: 'info.light', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'info.main'
        }}>
          <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
            💡 Pro Tips:
          </Typography>
          <Typography variant="body2" component="div" sx={{ color: 'info.dark' }}>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>Shortcuts are disabled when typing in input fields (except Esc and ?)</li>
              <li>Press <strong>?</strong> anytime to toggle this help dialog</li>
              <li>Press <strong>Esc</strong> to close dialogs or cancel actions</li>
              <li>Use <strong>Ctrl+S</strong> to quickly save your work</li>
              <li>Navigate with <strong>Alt+H</strong> for Dashboard, <strong>Alt+U</strong> for Upload, etc.</li>
            </ul>
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{ borderRadius: 2 }}
        >
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyboardShortcutsHelp;
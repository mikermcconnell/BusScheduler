import React from 'react';
import { Backdrop, Box, Typography, Fade, LinearProgress } from '@mui/material';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  progress?: number;
  showProgress?: boolean;
  zIndex?: number;
  transparent?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message = 'Loading...',
  progress,
  showProgress = false,
  zIndex = 1300,
  transparent = false,
}) => {
  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex,
        backgroundColor: transparent ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.7)',
      }}
      open={open}
    >
      <Fade in={open}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            p: 4,
            backgroundColor: transparent ? 'transparent' : 'background.paper',
            borderRadius: 2,
            boxShadow: transparent ? 'none' : 24,
            minWidth: 300,
            position: 'relative',
          }}
        >
          <LoadingSpinner size={60} color="primary" />
          
          {message && (
            <Typography 
              variant="h6" 
              color={transparent ? 'inherit' : 'text.primary'}
              textAlign="center"
            >
              {message}
            </Typography>
          )}
          
          {showProgress && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress 
                variant={progress !== undefined ? 'determinate' : 'indeterminate'}
                value={progress}
                sx={{ height: 6, borderRadius: 3 }}
              />
              {progress !== undefined && (
                <Typography 
                  variant="caption" 
                  color={transparent ? 'inherit' : 'text.secondary'}
                  sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                >
                  {Math.round(progress)}%
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Fade>
    </Backdrop>
  );
};
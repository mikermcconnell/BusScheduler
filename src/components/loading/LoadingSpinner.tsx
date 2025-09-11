import React from 'react';
import { CircularProgress, Box, Typography, BoxProps } from '@mui/material';

interface LoadingSpinnerProps extends BoxProps {
  size?: number | string;
  message?: string;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'inherit';
  thickness?: number;
  fullHeight?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  message,
  color = 'primary',
  thickness = 3.6,
  fullHeight = false,
  ...boxProps
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
      height={fullHeight ? '100%' : 'auto'}
      minHeight={fullHeight ? '400px' : 'auto'}
      {...boxProps}
    >
      <CircularProgress
        size={size}
        color={color}
        thickness={thickness}
      />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};
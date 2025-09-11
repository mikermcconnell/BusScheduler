import React from 'react';
import { Skeleton, Box, Grid, Card, CardContent, Stack } from '@mui/material';

interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'list' | 'dashboard' | 'form' | 'custom';
  rows?: number;
  columns?: number;
  height?: number | string;
  animation?: 'pulse' | 'wave' | false;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  rows = 3,
  columns = 1,
  height = 60,
  animation = 'wave',
}) => {
  const renderCardSkeleton = () => (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="40%" height={30} animation={animation} />
        <Skeleton variant="text" width="100%" height={20} animation={animation} sx={{ mt: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={height} animation={animation} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );

  const renderTableSkeleton = () => (
    <Box>
      <Skeleton variant="rectangular" width="100%" height={56} animation={animation} />
      {Array.from({ length: rows }).map((_, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, mt: 1 }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="rectangular"
              width={`${100 / columns}%`}
              height={48}
              animation={animation}
            />
          ))}
        </Box>
      ))}
    </Box>
  );

  const renderListSkeleton = () => (
    <Stack spacing={2}>
      {Array.from({ length: rows }).map((_, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={40} height={40} animation={animation} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} animation={animation} />
            <Skeleton variant="text" width="40%" height={16} animation={animation} />
          </Box>
        </Box>
      ))}
    </Stack>
  );

  const renderDashboardSkeleton = () => (
    <Box>
      <Skeleton variant="text" width="30%" height={40} animation={animation} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="50%" height={24} animation={animation} />
                <Skeleton variant="text" width="80%" height={40} animation={animation} sx={{ mt: 1 }} />
                <Skeleton variant="text" width="60%" height={16} animation={animation} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 4 }}>
        <Skeleton variant="text" width="20%" height={32} animation={animation} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={300} animation={animation} />
      </Box>
    </Box>
  );

  const renderFormSkeleton = () => (
    <Stack spacing={3}>
      {Array.from({ length: rows }).map((_, index) => (
        <Box key={index}>
          <Skeleton variant="text" width="30%" height={20} animation={animation} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={56} animation={animation} />
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Skeleton variant="rectangular" width={120} height={42} animation={animation} />
        <Skeleton variant="rectangular" width={120} height={42} animation={animation} />
      </Box>
    </Stack>
  );

  switch (variant) {
    case 'card':
      return renderCardSkeleton();
    case 'table':
      return renderTableSkeleton();
    case 'list':
      return renderListSkeleton();
    case 'dashboard':
      return renderDashboardSkeleton();
    case 'form':
      return renderFormSkeleton();
    case 'custom':
    default:
      return (
        <Skeleton 
          variant="rectangular" 
          width="100%" 
          height={height} 
          animation={animation}
        />
      );
  }
};
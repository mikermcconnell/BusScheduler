/**
 * Schedule Comparison View Component
 * Side-by-side comparison of schedule changes
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  SwapHoriz as SwapIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  CheckCircle as NoChangeIcon
} from '@mui/icons-material';
interface Trip {
  tripNumber: number;
  blockNumber: number;
  departureTime: string;
  serviceBand?: string;
  arrivalTimes: { [timepointId: string]: string };
  recoveryTimes?: { [timepointId: string]: number };
}

interface Schedule {
  trips: Trip[];
  timePoints: Array<{ id: string; name: string }>;
}

interface ScheduleComparisonViewProps {
  originalSchedule: Schedule;
  modifiedSchedule: Schedule;
  showOnlyChanges?: boolean;
  highlightColor?: string;
}

interface TripComparison {
  tripNumber: number;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
  original?: Trip;
  modified?: Trip;
  changes: string[];
}

const ScheduleComparisonView: React.FC<ScheduleComparisonViewProps> = ({
  originalSchedule,
  modifiedSchedule,
  showOnlyChanges = false,
  highlightColor = '#FFC107'
}) => {
  const comparison = useMemo(() => {
    const comparisons: TripComparison[] = [];
    const originalTripMap = new Map(originalSchedule.trips.map(t => [t.tripNumber, t]));
    const modifiedTripMap = new Map(modifiedSchedule.trips.map(t => [t.tripNumber, t]));
    
    // Check for modified and removed trips
    originalTripMap.forEach((originalTrip, tripNumber) => {
      const modifiedTrip = modifiedTripMap.get(tripNumber);
      
      if (!modifiedTrip) {
        comparisons.push({
          tripNumber,
          status: 'removed',
          original: originalTrip,
          changes: ['Trip removed']
        });
      } else {
        const changes = compareTripChanges(originalTrip, modifiedTrip);
        comparisons.push({
          tripNumber,
          status: changes.length > 0 ? 'modified' : 'unchanged',
          original: originalTrip,
          modified: modifiedTrip,
          changes
        });
      }
    });
    
    // Check for added trips
    modifiedTripMap.forEach((modifiedTrip, tripNumber) => {
      if (!originalTripMap.has(tripNumber)) {
        comparisons.push({
          tripNumber,
          status: 'added',
          modified: modifiedTrip,
          changes: ['New trip added']
        });
      }
    });
    
    return comparisons.sort((a, b) => a.tripNumber - b.tripNumber);
  }, [originalSchedule, modifiedSchedule]);

  const compareTripChanges = (original: Trip, modified: Trip): string[] => {
    const changes: string[] = [];
    
    // Check departure time
    if (original.departureTime !== modified.departureTime) {
      changes.push(`Departure: ${original.departureTime} → ${modified.departureTime}`);
    }
    
    // Check service band
    if (original.serviceBand !== modified.serviceBand) {
      changes.push(`Service band: ${original.serviceBand} → ${modified.serviceBand}`);
    }
    
    // Check recovery times
    const recoveryChanges = compareRecoveryTimes(original.recoveryTimes, modified.recoveryTimes);
    if (recoveryChanges.length > 0) {
      changes.push(...recoveryChanges);
    }
    
    // Check block number
    if (original.blockNumber !== modified.blockNumber) {
      changes.push(`Block: ${original.blockNumber} → ${modified.blockNumber}`);
    }
    
    return changes;
  };

  const compareRecoveryTimes = (
    original: { [key: string]: number } | undefined,
    modified: { [key: string]: number } | undefined
  ): string[] => {
    const changes: string[] = [];
    const originalRecovery = original || {};
    const modifiedRecovery = modified || {};
    
    const allKeys = new Set([...Object.keys(originalRecovery), ...Object.keys(modifiedRecovery)]);
    
    allKeys.forEach(key => {
      const originalValue = originalRecovery[key] || 0;
      const modifiedValue = modifiedRecovery[key] || 0;
      
      if (originalValue !== modifiedValue) {
        const timepoint = originalSchedule.timePoints.find(tp => tp.id === key);
        if (timepoint) {
          changes.push(`Recovery at ${timepoint.name}: ${originalValue}min → ${modifiedValue}min`);
        }
      }
    });
    
    return changes;
  };

  const getStatusIcon = (status: TripComparison['status']) => {
    switch (status) {
      case 'unchanged':
        return <NoChangeIcon sx={{ color: '#4CAF50', fontSize: 20 }} />;
      case 'modified':
        return <EditIcon sx={{ color: highlightColor, fontSize: 20 }} />;
      case 'added':
        return <AddIcon sx={{ color: '#2196F3', fontSize: 20 }} />;
      case 'removed':
        return <RemoveIcon sx={{ color: '#F44336', fontSize: 20 }} />;
    }
  };

  const getStatusChip = (status: TripComparison['status']) => {
    const configs = {
      unchanged: { label: 'No Change', color: 'success' as const },
      modified: { label: 'Modified', color: 'warning' as const },
      added: { label: 'Added', color: 'info' as const },
      removed: { label: 'Removed', color: 'error' as const }
    };
    
    const config = configs[status];
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const stats = useMemo(() => {
    return {
      total: comparison.length,
      unchanged: comparison.filter(c => c.status === 'unchanged').length,
      modified: comparison.filter(c => c.status === 'modified').length,
      added: comparison.filter(c => c.status === 'added').length,
      removed: comparison.filter(c => c.status === 'removed').length
    };
  }, [comparison]);

  const filteredComparison = showOnlyChanges 
    ? comparison.filter(c => c.status !== 'unchanged')
    : comparison;

  return (
    <Box sx={{ p: 2 }}>
      {/* Summary Statistics */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Comparison Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#4CAF50' }}>
                  {stats.unchanged}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Unchanged
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: highlightColor }}>
                  {stats.modified}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Modified
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#2196F3' }}>
                  {stats.added}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Added
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#F44336' }}>
                  {stats.removed}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Removed
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Detailed Comparison Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Status</TableCell>
              <TableCell>Trip #</TableCell>
              <TableCell>Original</TableCell>
              <TableCell align="center">
                <SwapIcon />
              </TableCell>
              <TableCell>Modified</TableCell>
              <TableCell>Changes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredComparison.map((comp) => (
              <TableRow 
                key={comp.tripNumber}
                sx={{
                  backgroundColor: comp.status === 'modified' ? `${highlightColor}10` :
                                 comp.status === 'added' ? '#2196F310' :
                                 comp.status === 'removed' ? '#F4433610' :
                                 'transparent',
                  '&:hover': { backgroundColor: '#f5f5f5' }
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(comp.status)}
                    {getStatusChip(comp.status)}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {comp.tripNumber}
                  </Typography>
                </TableCell>
                <TableCell>
                  {comp.original && (
                    <Box>
                      <Typography variant="body2">
                        {comp.original.departureTime}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Block {comp.original.blockNumber} | {comp.original.serviceBand}
                      </Typography>
                    </Box>
                  )}
                  {comp.status === 'added' && (
                    <Typography variant="body2" color="textSecondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  {comp.status === 'modified' && '→'}
                  {comp.status === 'added' && '+'}
                  {comp.status === 'removed' && '×'}
                  {comp.status === 'unchanged' && '='}
                </TableCell>
                <TableCell>
                  {comp.modified && (
                    <Box>
                      <Typography variant="body2">
                        {comp.modified.departureTime}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Block {comp.modified.blockNumber} | {comp.modified.serviceBand}
                      </Typography>
                    </Box>
                  )}
                  {comp.status === 'removed' && (
                    <Typography variant="body2" color="textSecondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {comp.changes.length > 0 ? (
                    <Box>
                      {comp.changes.map((change, idx) => (
                        <Typography key={idx} variant="caption" display="block">
                          • {change}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      No changes
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredComparison.length === 0 && showOnlyChanges && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No changes detected between the original and modified schedules.
        </Alert>
      )}
    </Box>
  );
};

export default ScheduleComparisonView;
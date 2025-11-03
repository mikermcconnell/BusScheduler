import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Box,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { useSelector } from 'react-redux';
import UnionRulesConfiguration from './UnionRulesConfiguration';
import { RootState } from '../store/store';
import {
  computeOptimizationInsights,
  OptimizationRecommendation
} from './utils/shiftOptimizationEngine';

const recommendationTypeLabels: Record<OptimizationRecommendation['type'], string> = {
  extend_shift: 'Extend Shift',
  new_shift: 'Add Shift',
  break_adjustment: 'Move Break'
};

const priorityColor: Record<OptimizationRecommendation['priority'], 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default'
};

const ShiftOptimizationView: React.FC = () => {
  const { coverageTimeline, shifts, unionRules, activeScheduleType, loading } = useSelector(
    (state: RootState) => state.shiftManagement
  );

  const insights = useMemo(
    () =>
      computeOptimizationInsights({
        dayType: activeScheduleType,
        coverageTimeline,
        shifts,
        unionRules
      }),
    [activeScheduleType, coverageTimeline, shifts, unionRules]
  );

  const isLoading = loading.fetchRun || loading.imports;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid
        size={{
          xs: 12,
          md: 8
        }}
      >
        <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="h6">Optimization Opportunities</Typography>
            <Typography variant="body2" color="text.secondary">
              Recommendations for the {activeScheduleType} schedule based on current coverage gaps.
            </Typography>
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
              <Chip
                label={`${insights.totals.blockCount} deficit window${insights.totals.blockCount === 1 ? '' : 's'}`}
                color={insights.totals.blockCount > 0 ? 'error' : 'success'}
                size="small"
              />
              <Chip
                label={`${insights.totals.totalVehicleHours.toFixed(1)} vehicle hrs missing`}
                size="small"
              />
              <Chip
                label={`Peak gap ${insights.totals.maxShortfall.toFixed(1)} buses`}
                size="small"
              />
            </Stack>
          </Box>

          <Divider />

          {insights.recommendations.length === 0 ? (
            <Alert severity={insights.blocks.length === 0 ? 'success' : 'info'}>
              {insights.blocks.length === 0
                ? 'Coverage is balanced—no optimization changes are required.'
                : 'All remaining gaps are minor; adjust union rules or import data to explore more options.'}
            </Alert>
          ) : (
            <Stack spacing={2} sx={{ overflowY: 'auto', pr: 1 }}>
              {insights.recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.id} recommendation={recommendation} />
              ))}
            </Stack>
          )}
        </Paper>
      </Grid>

      <Grid
        size={{
          xs: 12,
          md: 4
        }}
      >
        <UnionRulesConfiguration />
      </Grid>
    </Grid>
  );
};

interface RecommendationCardProps {
  recommendation: OptimizationRecommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Box>
          <Typography variant="subtitle1">{recommendation.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {recommendation.summary}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={recommendationTypeLabels[recommendation.type]}
            size="small"
            color={priorityColor[recommendation.priority]}
          />
          <Chip label={`${(recommendation.deficit.durationMinutes / 60).toFixed(1)} hrs`} size="small" />
        </Stack>
      </Stack>

      <Box component="ul" sx={{ pl: 3, mb: 1, mt: 1 }}>
        {recommendation.detailItems.map((detail) => (
          <Typography key={detail} component="li" variant="body2">
            {detail}
          </Typography>
        ))}
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip label={`Zone: ${recommendation.zone}`} size="small" />
        <Chip label={`Gap: ${recommendation.deficit.peakShortfall.toFixed(1)} buses`} size="small" color="error" />
        <Chip
          label={`Window ${recommendation.deficit.startTime}–${recommendation.deficit.endTime}`}
          size="small"
        />
      </Stack>

      {recommendation.affectedShiftCodes.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
          {recommendation.affectedShiftCodes.map((code) => (
            <Chip key={code} label={String(code)} variant="outlined" size="small" />
          ))}
        </Stack>
      )}
    </Paper>
  );
};

export default ShiftOptimizationView;

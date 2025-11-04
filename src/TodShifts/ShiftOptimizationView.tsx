import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Box,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import { useSelector } from 'react-redux';
import UnionRulesConfiguration from './UnionRulesConfiguration';
import { RootState } from '../store/store';
import {
  computeOptimizationInsights,
  OptimizationRecommendation,
  createIntervalKey,
  extractIdealShiftHours
} from './utils/shiftOptimizationEngine';
import type { ShiftCoverageInterval } from './types/shift.types';
import { COLOR_BALANCED, COLOR_DEFICIT_HEAVY, COLOR_EXCESS_HEAVY } from './utils/colorScale';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Bar,
  Cell,
  ReferenceLine
} from 'recharts';
import { useTheme } from '@mui/material/styles';

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
  const [appliedRecommendationIds, setAppliedRecommendationIds] = useState<string[]>([]);

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
  const idealShiftHours = useMemo(
    () => extractIdealShiftHours(unionRules) ?? 7.2,
    [unionRules]
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
    <Stack spacing={3}>
      <OptimizationPreview
        activeScheduleType={activeScheduleType}
        coverageTimeline={coverageTimeline}
        insights={insights}
        shifts={shifts}
        unionRules={unionRules}
        appliedIds={appliedRecommendationIds}
        onApplyAll={() =>
          setAppliedRecommendationIds(insights.recommendations.map((recommendation) => recommendation.id))
        }
        onReset={() => setAppliedRecommendationIds([])}
        setAppliedIds={setAppliedRecommendationIds}
        idealShiftHours={idealShiftHours}
      />

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
              <Chip
                label={`Ideal shift ${idealShiftHours.toFixed(1)} hrs`}
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
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    isApplied={appliedRecommendationIds.includes(recommendation.id)}
                    onToggle={(id) =>
                      setAppliedRecommendationIds((prev) =>
                        prev.includes(id) ? prev.filter((existingId) => existingId !== id) : [...prev, id]
                      )
                    }
                  />
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
    </Stack>
  );
};

interface RecommendationCardProps {
  recommendation: OptimizationRecommendation;
  isApplied: boolean;
  onToggle: (id: string) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation, isApplied, onToggle }) => {
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
      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button
          size="small"
          variant={isApplied ? 'contained' : 'outlined'}
          color={isApplied ? 'success' : 'primary'}
          onClick={() => onToggle(recommendation.id)}
        >
          {isApplied ? 'Applied' : 'Apply'}
        </Button>
      </Box>
    </Paper>
  );
};

export default ShiftOptimizationView;

type SlideKey = 'total' | 'north' | 'south';

interface OptimizationChartPoint {
  key: string;
  startTime: string;
  endTime: string;
  label: string;
  requirement: number;
  baselineCoverage: number;
  adjustedCoverage: number;
  baselineDifference: number;
  adjustedDifference: number;
}

const OPTIMIZATION_SLIDER_OPTIONS: Array<{ key: SlideKey; label: string }> = [
  { key: 'total', label: 'Total coverage' },
  { key: 'north', label: 'North coverage' },
  { key: 'south', label: 'South coverage' }
];

function OptimizationPreview({
  activeScheduleType,
  coverageTimeline,
  insights,
  shifts,
  unionRules,
  appliedIds,
  onApplyAll,
  onReset,
  setAppliedIds,
  idealShiftHours
}: {
  activeScheduleType: RootState['shiftManagement']['activeScheduleType'];
  coverageTimeline: RootState['shiftManagement']['coverageTimeline'];
  insights: ReturnType<typeof computeOptimizationInsights>;
  shifts: RootState['shiftManagement']['shifts'];
  unionRules: RootState['shiftManagement']['unionRules'];
  appliedIds: string[];
  onApplyAll: () => void;
  onReset: () => void;
  setAppliedIds: React.Dispatch<React.SetStateAction<string[]>>;
  idealShiftHours: number;
}) {
  const theme = useTheme();
  const [activeSlide, setActiveSlide] = useState<SlideKey>('total');
  const activeCoverage = useMemo<ShiftCoverageInterval[]>(
    () => coverageTimeline[activeScheduleType] ?? [],
    [coverageTimeline, activeScheduleType]
  );

  useEffect(() => {
    setAppliedIds((prev) => {
      const filtered = prev.filter((id) => insights.recommendations.some((rec) => rec.id === id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [insights.recommendations, setAppliedIds]);

  useEffect(() => {
    setAppliedIds([]);
  }, [activeScheduleType, setAppliedIds]);

  useEffect(() => {
    setActiveSlide('total');
  }, [activeScheduleType]);

  const adjustedIntervals = useMemo(() => {
    const cloned = activeCoverage.map((interval) => ({ ...interval }));
    if (appliedIds.length === 0) {
      return cloned;
    }

    const intervalIndexMap = new Map<string, number>();
    cloned.forEach((interval, index) => {
      intervalIndexMap.set(createIntervalKey(interval, 'North'), index);
      intervalIndexMap.set(createIntervalKey(interval, 'South'), index);
    });

    appliedIds.forEach((id) => {
      const recommendation = insights.recommendations.find((rec) => rec.id === id);
      if (!recommendation) {
        return;
      }

      recommendation.impact.adjustments.forEach(({ intervalKey, zone, coverageGain }) => {
        const intervalIndex = intervalIndexMap.get(intervalKey);
        if (intervalIndex === undefined) {
          return;
        }

        const interval = cloned[intervalIndex];
        const field = zone === 'North' ? 'northExcess' : 'southExcess';
        const currentValue = interval[field] ?? 0;
        const nextValue =
          currentValue < 0 ? Math.min(0, currentValue + coverageGain) : currentValue;
        interval[field] = nextValue;
        interval.totalExcess =
          (interval.northExcess ?? 0) +
          (interval.southExcess ?? 0) +
          (interval.floaterExcess ?? 0);
        interval.status = interval.totalExcess < 0 ? 'deficit' : interval.totalExcess > 0 ? 'excess' : 'balanced';
      });
    });

    return cloned;
  }, [appliedIds, activeCoverage, insights.recommendations]);

  const adjustedCoverageTimeline = useMemo(() => {
    return {
      ...coverageTimeline,
      [activeScheduleType]: adjustedIntervals
    };
  }, [adjustedIntervals, coverageTimeline, activeScheduleType]);

  const adjustedInsights = useMemo(
    () =>
      computeOptimizationInsights({
        dayType: activeScheduleType,
        coverageTimeline: adjustedCoverageTimeline,
        shifts,
        unionRules
      }),
    [activeScheduleType, adjustedCoverageTimeline, shifts, unionRules]
  );

  const { seriesMap, tickMap } = useMemo(() => {
    const base: Record<SlideKey, OptimizationChartPoint[]> = {
      total: [],
      north: [],
      south: []
    };
    const ticks: Record<SlideKey, string[]> = {
      total: [],
      north: [],
      south: []
    };

    activeCoverage.forEach((interval, index) => {
      const adjustedInterval = adjustedIntervals[index] ?? interval;
      const label = `${interval.startTime} – ${interval.endTime}`;
      const keySuffix = `${interval.startTime}-${index}`;

      const pushPoint = (
        slide: SlideKey,
        requirement: number,
        baselineDifference: number,
        adjustedDifference: number
      ) => {
        const baselineCoverage = requirement + baselineDifference;
        const adjustedCoverage = requirement + adjustedDifference;

        base[slide].push({
          key: `${slide}-${keySuffix}`,
          startTime: interval.startTime,
          endTime: interval.endTime,
          label,
          requirement,
          baselineCoverage,
          adjustedCoverage,
          baselineDifference,
          adjustedDifference
        });

        if (index % 4 === 0) {
          ticks[slide].push(interval.startTime);
        }
      };

      const totalRequirement =
        (interval.northRequired ?? 0) +
        (interval.southRequired ?? 0) +
        (interval.floaterRequired ?? 0);

      pushPoint(
        'total',
        totalRequirement,
        interval.totalExcess ?? 0,
        adjustedInterval.totalExcess ?? interval.totalExcess ?? 0
      );

      pushPoint(
        'north',
        interval.northRequired ?? 0,
        interval.northExcess ?? 0,
        adjustedInterval.northExcess ?? interval.northExcess ?? 0
      );

      pushPoint(
        'south',
        interval.southRequired ?? 0,
        interval.southExcess ?? 0,
        adjustedInterval.southExcess ?? interval.southExcess ?? 0
      );
    });

    return { seriesMap: base, tickMap: ticks };
  }, [activeCoverage, adjustedIntervals]);

  const requirementColor = theme.palette.primary.main;
  const baselineCoverageColor = theme.palette.warning.main;
  const adjustedCoverageColor = theme.palette.success.main;
  const positiveDifferenceColor = theme.palette.success.light;
  const negativeDifferenceColor = theme.palette.error.light;

  const activeSeries = seriesMap[activeSlide];
  const activeTicks = tickMap[activeSlide];
  const hasChartData = activeSeries.length > 0;

  const vehicleHourImprovement =
    insights.totals.totalVehicleHours - adjustedInsights.totals.totalVehicleHours;

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6">Optimized Coverage Preview</Typography>
          <Typography variant="body2" color="text.secondary">
            Toggle recommendations to preview how coverage improves for the {activeScheduleType} schedule.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={onReset}
            disabled={appliedIds.length === 0}
          >
            Reset
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onApplyAll}
            disabled={insights.recommendations.length === 0 || appliedIds.length === insights.recommendations.length}
          >
            Apply All
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={2} flexWrap="wrap" mb={3}>
        <Chip
          label={`Current deficits: ${insights.totals.blockCount} windows`}
          color={insights.totals.blockCount > 0 ? 'error' : 'success'}
          size="small"
        />
        <Chip
          label={`With selections: ${adjustedInsights.totals.blockCount} windows`}
          color={adjustedInsights.totals.blockCount > 0 ? 'warning' : 'success'}
          size="small"
        />
        <Chip
          label={`Vehicle hours gap ↓ ${vehicleHourImprovement.toFixed(1)} hrs`}
          size="small"
          color={vehicleHourImprovement > 0 ? 'success' : 'default'}
        />
        <Chip
          label={`${appliedIds.length} recommendation${appliedIds.length === 1 ? '' : 's'} applied`}
          size="small"
        />
        <Chip
          label={`Ideal shift target ${idealShiftHours.toFixed(1)} hrs`}
          size="small"
          variant="outlined"
        />
      </Stack>

      {!hasChartData ? (
        <Alert severity="info">
          No deficit windows detected—apply optimizations as you discover new coverage gaps.
        </Alert>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip
              label="Excess"
              size="small"
              sx={{ backgroundColor: COLOR_EXCESS_HEAVY, color: 'common.white' }}
            />
            <Chip label="Balanced" size="small" sx={{ backgroundColor: COLOR_BALANCED }} />
            <Chip
              label="Deficit"
              size="small"
              sx={{ backgroundColor: COLOR_DEFICIT_HEAVY, color: 'common.white' }}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {OPTIMIZATION_SLIDER_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                clickable
                color={activeSlide === option.key ? 'primary' : 'default'}
                onClick={() => setActiveSlide(option.key)}
              />
            ))}
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ mb: 1 }}
          >
            <LegendSwatch label="Requirement (City)" color={requirementColor} variant="line" />
            <LegendSwatch label="Current coverage" color={baselineCoverageColor} variant="line" />
            <LegendSwatch
              label="With selections"
              color={adjustedCoverageColor}
              variant="dashed"
            />
            <LegendSwatch
              label="Current net difference"
              color={positiveDifferenceColor}
              secondaryColor={negativeDifferenceColor}
              variant="bar"
            />
          </Stack>

          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeSeries} margin={{ top: 8, bottom: 16, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="startTime"
                  ticks={activeTicks}
                  tick={{ fontSize: 10 }}
                  interval={0}
                  height={30}
                />
                <YAxis allowDecimals={false} />
                <ReferenceLine y={0} stroke={negativeDifferenceColor} strokeDasharray="3 3" />
                <RechartTooltip content={<OptimizationTooltip />} />
                <Bar dataKey="baselineDifference" barSize={16} radius={[4, 4, 0, 0]}>
                  {activeSeries.map((point) => (
                    <Cell
                      key={`${point.key}-difference`}
                      fill={
                        point.baselineDifference >= 0 ? positiveDifferenceColor : negativeDifferenceColor
                      }
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="requirement"
                  stroke={requirementColor}
                  strokeWidth={2}
                  dot={{ r: 3, stroke: requirementColor, fill: '#ffffff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="baselineCoverage"
                  stroke={baselineCoverageColor}
                  strokeWidth={2}
                  dot={{ r: 2, stroke: baselineCoverageColor, fill: baselineCoverageColor }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="adjustedCoverage"
                  stroke={adjustedCoverageColor}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 2, stroke: adjustedCoverageColor, fill: adjustedCoverageColor }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
    </Paper>
  );
}

interface LegendSwatchProps {
  label: string;
  color: string;
  variant: 'line' | 'dashed' | 'bar';
  secondaryColor?: string;
}

const LegendSwatch: React.FC<LegendSwatchProps> = ({ label, color, variant, secondaryColor }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <Box
      sx={{
        width: 32,
        height: 8,
        borderRadius: 4,
        border: variant === 'line' ? `2px solid ${color}` : 'none',
        background:
          variant === 'bar'
            ? `linear-gradient(90deg, ${color} 0%, ${color} 50%, ${secondaryColor ?? color} 50%, ${secondaryColor ?? color} 100%)`
            : variant === 'dashed'
              ? `repeating-linear-gradient(90deg, ${color}, ${color} 6px, transparent 6px, transparent 11px)`
              : 'transparent'
      }}
    />
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Stack>
);

interface OptimizationTooltipProps {
  active?: boolean;
  payload?: any[];
}

const OptimizationTooltip: React.FC<OptimizationTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point: OptimizationChartPoint = payload[0].payload;
  const formatValue = (value: number) => Number(value.toFixed(2));
  const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${formatValue(value)}`;

  return (
    <Paper elevation={3} sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>
        {point.label}
      </Typography>
      <Typography variant="body2">Requirement: {formatValue(point.requirement)}</Typography>
      <Typography variant="body2">Current coverage: {formatValue(point.baselineCoverage)}</Typography>
      <Typography variant="body2">With selections: {formatValue(point.adjustedCoverage)}</Typography>
      <Typography variant="body2">
        Current difference: {formatSigned(point.baselineDifference)}
      </Typography>
      <Typography variant="body2">
        With selections difference: {formatSigned(point.adjustedDifference)}
      </Typography>
    </Paper>
  );
};

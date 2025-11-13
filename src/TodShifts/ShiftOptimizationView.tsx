import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import {
  computeOptimizationInsights,
  OptimizationRecommendation,
  OptimizationInsights,
  createIntervalKey,
  extractIdealShiftHours
} from './utils/shiftOptimizationEngine';
import type { DayType, ShiftCoverageInterval } from './types/shift.types';
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
import { DAY_TYPES } from './utils/timeUtils';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { BreakReliefSummary, computeBreakReliefSummary } from './utils/breakReliefAudit';

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

const dayTypeLabels: Record<DayType, string> = {
  weekday: 'Weekday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

interface OptimizationOverviewDay {
  dayType: DayType;
  label: string;
  recommendationCount: number;
  totalVehicleHours: number;
  peakShortfall: number;
}

interface OptimizationOverviewSummary {
  totalRecommendations: number;
  totalVehicleHours: number;
  high: number;
  medium: number;
  low: number;
  perDay: OptimizationOverviewDay[];
}

interface OptimizationDaySectionProps {
  dayType: DayType;
  coverageTimeline: RootState['shiftManagement']['coverageTimeline'];
  shifts: RootState['shiftManagement']['shifts'];
  unionRules: RootState['shiftManagement']['unionRules'];
  insights: OptimizationInsights;
  appliedIds: string[];
  onUpdateAppliedIds: (updater: (prev: string[]) => string[]) => void;
}

const OptimizationDaySection: React.FC<OptimizationDaySectionProps> = ({
  dayType,
  coverageTimeline,
  shifts,
  unionRules,
  insights,
  appliedIds,
  onUpdateAppliedIds
}) => {
  const dayLabel = dayTypeLabels[dayType];
  const idealShiftHours = useMemo(() => extractIdealShiftHours(unionRules) ?? 7.2, [unionRules]);

  const handleApplyAll = useCallback(() => {
    const ids = insights.recommendations.map((recommendation) => recommendation.id);
    onUpdateAppliedIds(() => ids);
  }, [insights.recommendations, onUpdateAppliedIds]);

  const handleReset = useCallback(() => {
    onUpdateAppliedIds(() => []);
  }, [onUpdateAppliedIds]);

  const handleToggle = useCallback(
    (id: string) => {
      onUpdateAppliedIds((previous) =>
        previous.includes(id) ? previous.filter((existingId) => existingId !== id) : [...previous, id]
      );
    },
    [onUpdateAppliedIds]
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6">{dayLabel} Optimization</Typography>
      <OptimizationPreview
        dayType={dayType}
        coverageTimeline={coverageTimeline}
        insights={insights}
        shifts={shifts}
        unionRules={unionRules}
        appliedIds={appliedIds}
        updateAppliedIds={onUpdateAppliedIds}
        onApplyAll={handleApplyAll}
        onReset={handleReset}
        idealShiftHours={idealShiftHours}
      />

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="subtitle1">Optimization Opportunities</Typography>
          <Typography variant="body2" color="text.secondary">
            Recommendations for the {dayLabel.toLowerCase()} schedule based on current coverage gaps.
          </Typography>
          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
            <Chip
              label={`${insights.totals.blockCount} deficit window${insights.totals.blockCount === 1 ? '' : 's'}`}
              color={insights.totals.blockCount > 0 ? 'error' : 'success'}
              size="small"
            />
            <Chip label={`${insights.totals.totalVehicleHours.toFixed(1)} vehicle hrs missing`} size="small" />
            <Chip label={`Peak gap ${insights.totals.maxShortfall.toFixed(1)} buses`} size="small" />
            <Chip label={`Ideal shift ${idealShiftHours.toFixed(1)} hrs`} size="small" />
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
                isApplied={appliedIds.includes(recommendation.id)}
                onToggle={handleToggle}
              />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
};

const ShiftOptimizationView: React.FC = () => {
  const { coverageTimeline, shifts, unionRules, loading } = useSelector(
    (state: RootState) => state.shiftManagement
  );
  const [appliedRecommendationIds, setAppliedRecommendationIds] = useState<Record<DayType, string[]>>({
    weekday: [],
    saturday: [],
    sunday: []
  });

  const setAppliedIdsForDay = useCallback(
    (dayType: DayType, updater: (previous: string[]) => string[]) => {
      setAppliedRecommendationIds((prev) => {
        const next = { ...prev };
        next[dayType] = updater(prev[dayType]);
        return next;
      });
    },
    []
  );

  const isLoading = loading.fetchRun || loading.imports;
  const insightsByDay = useMemo(() => {
    return DAY_TYPES.reduce((acc, dayType) => {
      acc[dayType] = computeOptimizationInsights({
        dayType,
        coverageTimeline,
        shifts,
        unionRules
      });
      return acc;
  }, {} as Record<DayType, OptimizationInsights>);
  }, [coverageTimeline, shifts, unionRules]);
  const breakReliefSummary = useMemo(() => computeBreakReliefSummary(shifts), [shifts]);
  const optimizationOverview = useMemo<OptimizationOverviewSummary>(() => {
    const perDay = DAY_TYPES.map<OptimizationOverviewDay>((dayType) => ({
      dayType,
      label: dayTypeLabels[dayType],
      recommendationCount: 0,
      totalVehicleHours: 0,
      peakShortfall: 0
    }));

    const summary: OptimizationOverviewSummary = {
      totalRecommendations: 0,
      totalVehicleHours: 0,
      high: 0,
      medium: 0,
      low: 0,
      perDay
    };

    DAY_TYPES.forEach((dayType) => {
      const insights = insightsByDay[dayType];
      if (!insights) {
        return;
      }

      const dayEntry = perDay.find((entry) => entry.dayType === dayType);
      if (!dayEntry) {
        return;
      }

      dayEntry.recommendationCount = insights.recommendations.length;
      dayEntry.totalVehicleHours = insights.totals.totalVehicleHours;
      dayEntry.peakShortfall = insights.totals.maxShortfall;

      summary.totalRecommendations += insights.recommendations.length;
      summary.totalVehicleHours += insights.totals.totalVehicleHours;

      insights.recommendations.forEach((recommendation) => {
        summary[recommendation.priority] += 1;
      });
    });

    return summary;
  }, [insightsByDay]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }
  const hasReliefDemand = breakReliefSummary.some((summary) => summary.totalHours > 0.01);

  return (
    <Stack spacing={3}>
      {hasReliefDemand && <BreakReliefAuditPanel summaries={breakReliefSummary} />}
      {optimizationOverview.totalRecommendations > 0 && (
        <OptimizationOverviewPanel overview={optimizationOverview} />
      )}
      {DAY_TYPES.map((dayType) => (
        <OptimizationDaySection
          key={dayType}
          dayType={dayType}
          coverageTimeline={coverageTimeline}
          shifts={shifts}
          unionRules={unionRules}
          insights={insightsByDay[dayType]}
          appliedIds={appliedRecommendationIds[dayType]}
          onUpdateAppliedIds={(updater) => setAppliedIdsForDay(dayType, updater)}
        />
      ))}
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

const OptimizationOverviewPanel: React.FC<{ overview: OptimizationOverviewSummary }> = ({ overview }) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;

  useEffect(() => {
    if (copyState !== 'copied' || typeof window === 'undefined') {
      return;
    }
    const timeout = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  if (overview.totalRecommendations === 0) {
    return null;
  }

  const busiestDay = overview.perDay.reduce((prev, current) =>
    current.totalVehicleHours > prev.totalVehicleHours ? current : prev
  );

  const handleCopy = async () => {
    if (!canCopy) {
      setCopyState('error');
      return;
    }

    const lines = [
      `Total optimization recommendations: ${overview.totalRecommendations}`,
      `Vehicle-hours affected: ${overview.totalVehicleHours.toFixed(1)}`,
      `High priority: ${overview.high}, Medium: ${overview.medium}, Low: ${overview.low}`,
      ...overview.perDay
        .filter((day) => day.recommendationCount > 0)
        .map(
          (day) =>
            `${day.label}: ${day.recommendationCount} recs covering ${day.totalVehicleHours.toFixed(1)} vehicle-hours (peak gap ${day.peakShortfall.toFixed(1)})`
        )
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h6">Optimization Summary</Typography>
          <Typography variant="body2" color="text.secondary">
            {overview.totalRecommendations} recommendation{overview.totalRecommendations === 1 ? '' : 's'} targeting{' '}
            {overview.totalVehicleHours.toFixed(1)} vehicle-hours of gaps. Largest deficit on{' '}
            {busiestDay.label} (peak {busiestDay.peakShortfall.toFixed(1)} buses).
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`High: ${overview.high}`} color="error" size="small" />
          <Chip label={`Medium: ${overview.medium}`} color="warning" size="small" />
          <Chip label={`Low: ${overview.low}`} size="small" />
          <Tooltip
            title={
              canCopy
                ? copyState === 'copied'
                  ? 'Copied'
                  : 'Copy summary'
                : 'Clipboard unavailable'
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleCopy}
                disabled={!canCopy}
                color={copyState === 'copied' ? 'success' : 'default'}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }
        }}
      >
        {overview.perDay.map((day) => (
          <Paper key={day.dayType} variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">{day.label}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`${day.recommendationCount} recs`} size="small" />
                <Chip label={`${day.totalVehicleHours.toFixed(1)} vehicle-hrs`} size="small" />
                <Chip label={`Peak gap ${day.peakShortfall.toFixed(1)}`} size="small" />
              </Stack>
              {day.recommendationCount === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Balanced – no adjustments needed.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Apply the top recommendations below to trim the largest deficits.
                </Typography>
              )}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Paper>
  );
};

const BreakReliefAuditPanel: React.FC<{ summaries: BreakReliefSummary[] }> = ({ summaries }) => {
  const totalHours = summaries.reduce((sum, summary) => sum + summary.totalHours, 0);
  if (totalHours < 0.01) {
    return null;
  }

  const totalIntervals = summaries.reduce((sum, summary) => sum + summary.intervalCount, 0);
  const busiestDay = summaries.reduce((prev, current) =>
    current.totalHours > prev.totalHours ? current : prev
  );

  return (
    <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h6">Break Relief Audit</Typography>
        <Typography variant="body2" color="text.secondary">
          Relief shifts are covering {totalHours.toFixed(1)} vehicle-hours across {totalIntervals} break windows.
          {busiestDay.totalHours > 0
            ? ` Most demand occurs on ${dayTypeLabels[busiestDay.dayType]}.`
            : ''}
        </Typography>
      </Box>

      <Alert severity={busiestDay.totalHours > 5 ? 'warning' : 'info'}>
        Stagger {dayTypeLabels[busiestDay.dayType].toLowerCase()} breaks or shorten meal windows to shave
        {` ${busiestDay.totalHours.toFixed(1)} relief vehicle-hours.`}
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }
        }}
      >
        {summaries.map((summary) => (
          <Paper key={summary.dayType} variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">{dayTypeLabels[summary.dayType]}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`${summary.totalHours.toFixed(1)} hrs`} size="small" color="primary" />
                <Chip label={`${summary.intervalCount} windows`} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                North: {summary.northHours.toFixed(1)} hrs · South: {summary.southHours.toFixed(1)} hrs · Floater:{' '}
                {summary.floaterHours.toFixed(1)} hrs
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Paper>
  );
};

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
  dayType,
  coverageTimeline,
  insights,
  shifts,
  unionRules,
  appliedIds,
  updateAppliedIds,
  onApplyAll,
  onReset,
  idealShiftHours
}: {
  dayType: DayType;
  coverageTimeline: RootState['shiftManagement']['coverageTimeline'];
  insights: OptimizationInsights;
  shifts: RootState['shiftManagement']['shifts'];
  unionRules: RootState['shiftManagement']['unionRules'];
  appliedIds: string[];
  updateAppliedIds: (updater: (prev: string[]) => string[]) => void;
  onApplyAll: () => void;
  onReset: () => void;
  idealShiftHours: number;
}) {
  const theme = useTheme();
  const [activeSlide, setActiveSlide] = useState<SlideKey>('total');
  const activeCoverage = useMemo<ShiftCoverageInterval[]>(
    () => coverageTimeline[dayType] ?? [],
    [coverageTimeline, dayType]
  );

  useEffect(() => {
    updateAppliedIds((prev) => {
      const filtered = prev.filter((id) => insights.recommendations.some((rec) => rec.id === id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [insights.recommendations, updateAppliedIds]);

  useEffect(() => {
    updateAppliedIds(() => []);
  }, [dayType, updateAppliedIds]);

  useEffect(() => {
    setActiveSlide('total');
  }, [dayType]);

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
      [dayType]: adjustedIntervals
    };
  }, [adjustedIntervals, coverageTimeline, dayType]);

  const adjustedInsights = useMemo(
    () =>
      computeOptimizationInsights({
        dayType,
        coverageTimeline: adjustedCoverageTimeline,
        shifts,
        unionRules
      }),
    [dayType, adjustedCoverageTimeline, shifts, unionRules]
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
            Toggle recommendations to preview how coverage improves for the {dayTypeLabels[dayType].toLowerCase()} schedule.
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

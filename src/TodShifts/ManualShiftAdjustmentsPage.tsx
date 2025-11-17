import React, { useCallback, useMemo, useState } from 'react';
import { Paper, Typography, Stack, Alert, Box, Divider, Chip, Button, Tooltip, Dialog } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
  ReferenceLine,
  LabelList
} from 'recharts';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import ShiftSummaryTable from './ShiftSummaryTable';
import { DAY_TYPES, minutesToTimeString, INTERVAL_MINUTES, parseTimeToMinutes } from './utils/timeUtils';
import type { ShiftCoverageInterval, DayType, ShiftZone } from './types/shift.types';
import UndoIcon from '@mui/icons-material/Undo';
import { undoLastShiftChange, saveDraft } from './store/shiftManagementSlice';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

const dayTypeLabels: Record<DayType, string> = {
  weekday: 'Weekday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

type ManualSlideKey = 'total' | 'north' | 'south' | 'floater';

interface BaseCoveragePoint {
  startTime: string;
  breakCount: number;
  totalRequirement: number;
  totalCoverage: number;
  northRequirement: number;
  northCoverage: number;
  southRequirement: number;
  southCoverage: number;
  floaterRequirement: number;
  floaterCoverage: number;
}

interface ManualCoveragePoint {
  startTime: string;
  requirement: number;
  coverage: number;
  difference: number;
  breakCount: number;
}

interface ManualShiftAdjustmentsPageProps {
  onSaveDraft?: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  lastSavedLabel?: string;
  autosaveLabel?: string | null;
  autosaving?: boolean;
}

const ManualShiftAdjustmentsPage: React.FC<ManualShiftAdjustmentsPageProps> = ({
  onSaveDraft,
  saveDisabled,
  saving,
  lastSavedLabel,
  autosaveLabel,
  autosaving
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { shifts, coverageTimeline, operationalTimeline, history } = useSelector(
    (state: RootState) => state.shiftManagement
  );
  const canUndo = history.undoStack.length > 0;
  const pendingUndoLabel = canUndo
    ? history.undoStack[history.undoStack.length - 1]?.label ?? 'last change'
    : null;
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      return;
    }
    dispatch(undoLastShiftChange());
  }, [canUndo, dispatch]);

  const handleEnterFullScreen = useCallback(() => {
    setIsFullScreen(true);
  }, []);

  const handleExitFullScreen = useCallback(() => {
    setIsFullScreen(false);
  }, []);

  const breakMaps = useMemo(() => {
    return DAY_TYPES.reduce((acc, dayType) => {
      const map = new Map<string, number>();
      (operationalTimeline[dayType] ?? []).forEach((interval) => {
        map.set(interval.startTime, interval.breakCount ?? 0);
      });
      acc[dayType] = map;
      return acc;
    }, {} as Record<DayType, Map<string, number>>);
  }, [operationalTimeline]);

  const handleLocalSave = useCallback(() => {
    if (onSaveDraft) {
      onSaveDraft();
      return;
    }
    dispatch(saveDraft());
  }, [dispatch, onSaveDraft]);

  const renderAdjustmentsContent = (fullscreenContext = false) => (
    <Stack spacing={3} sx={{ py: fullscreenContext ? 2 : 1, px: fullscreenContext ? 2 : 0 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box>
            <Typography variant="h6" gutterBottom>
              Manual Shift Adjustments
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fine-tune the automatically generated schedule by editing start/end times, zones, and breaks in 15-minute increments. Changes are validated
              against union rules and applied directly to the coverage timeline.
            </Typography>
            {shifts.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Build shifts first to unlock manual adjustments.
              </Alert>
            )}
            {lastSavedLabel && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {lastSavedLabel}
                {autosaveLabel ? ` · ${autosaveLabel}` : ''}
                {autosaving ? ' · Autosaving…' : ''}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={fullscreenContext ? <FullscreenExitIcon /> : <FullscreenIcon />}
              onClick={fullscreenContext ? handleExitFullScreen : handleEnterFullScreen}
            >
              {fullscreenContext ? 'Exit full screen' : 'Full screen view'}
            </Button>
            <Tooltip title={saveDisabled ? 'No pending edits or save in progress' : 'Save this draft'}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={Boolean(saveDisabled)}
                  onClick={handleLocalSave}
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {DAY_TYPES.map((dayType) => (
        <ManualAdjustmentsDaySection
          key={dayType}
          dayType={dayType}
          coverage={coverageTimeline[dayType] ?? []}
          breakMap={breakMaps[dayType]}
          canUndo={canUndo}
          pendingUndoLabel={pendingUndoLabel}
          onUndo={handleUndo}
        />
      ))}
    </Stack>
  );

  return (
    <>
      {!isFullScreen && renderAdjustmentsContent(false)}
      <Dialog fullScreen open={isFullScreen} onClose={handleExitFullScreen}>
        <Box sx={{ width: '100%', height: '100%', bgcolor: 'background.default', overflow: 'auto' }}>
          {renderAdjustmentsContent(true)}
        </Box>
      </Dialog>
    </>
  );
};

interface ManualAdjustmentsDaySectionProps {
  dayType: DayType;
  coverage: ShiftCoverageInterval[];
  breakMap: Map<string, number>;
  canUndo: boolean;
  pendingUndoLabel: string | null;
  onUndo: () => void;
}

const ManualAdjustmentsDaySection: React.FC<ManualAdjustmentsDaySectionProps> = ({
  dayType,
  coverage,
  breakMap,
  canUndo,
  pendingUndoLabel,
  onUndo
}) => {
  const theme = useTheme();
  const [activeSlide, setActiveSlide] = useState<ManualSlideKey>('total');
  const activeZone = useMemo<ShiftZone | undefined>(() => {
    switch (activeSlide) {
      case 'north':
        return 'North';
      case 'south':
        return 'South';
      case 'floater':
        return 'Floater';
      default:
        return undefined;
    }
  }, [activeSlide]);

  const basePoints = useMemo<BaseCoveragePoint[]>(() => {
    return coverage.map((interval) => {
      const northRequirement = interval.northRequired ?? 0;
      const southRequirement = interval.southRequired ?? 0;
      const floaterRequirement = interval.floaterRequired ?? 0;
      const northCoverage = (interval.northOperational ?? 0) + (interval.floaterAllocatedNorth ?? 0);
      const southCoverage = (interval.southOperational ?? 0) + (interval.floaterAllocatedSouth ?? 0);
      const floaterCoverage = Math.max(
        0,
        (interval.floaterOperational ?? 0) -
          (interval.floaterAllocatedNorth ?? 0) -
          (interval.floaterAllocatedSouth ?? 0)
      );
      return {
        startTime: interval.startTime,
        breakCount: breakMap.get(interval.startTime) ?? 0,
        totalRequirement: northRequirement + southRequirement + floaterRequirement,
        totalCoverage: northCoverage + southCoverage + floaterCoverage,
        northRequirement,
        northCoverage,
        southRequirement,
        southCoverage,
        floaterRequirement,
        floaterCoverage
      };
    });
  }, [coverage, breakMap]);

  const chartData = useMemo<ManualCoveragePoint[]>(() => {
    const mapPoint = (point: BaseCoveragePoint, slide: ManualSlideKey): ManualCoveragePoint => {
      switch (slide) {
        case 'north':
          return {
            startTime: point.startTime,
            requirement: point.northRequirement,
            coverage: point.northCoverage,
            difference: point.northCoverage - point.northRequirement,
            breakCount: point.breakCount
          };
        case 'south':
          return {
            startTime: point.startTime,
            requirement: point.southRequirement,
            coverage: point.southCoverage,
            difference: point.southCoverage - point.southRequirement,
            breakCount: point.breakCount
          };
        case 'floater':
          return {
            startTime: point.startTime,
            requirement: point.floaterRequirement,
            coverage: point.floaterCoverage,
            difference: point.floaterCoverage - point.floaterRequirement,
            breakCount: point.breakCount
          };
        case 'total':
        default:
          return {
            startTime: point.startTime,
            requirement: point.totalRequirement,
            coverage: point.totalCoverage,
            difference: point.totalCoverage - point.totalRequirement,
            breakCount: point.breakCount
          };
      }
    };
    return basePoints.map((point) => mapPoint(point, activeSlide));
  }, [basePoints, activeSlide]);

  const positiveDifferenceColor = theme.palette.success.light;
  const negativeDifferenceColor = theme.palette.error.light;
  const requirementColor = theme.palette.primary.main;
  const coverageColor =
    activeSlide === 'north'
      ? theme.palette.info.main
      : activeSlide === 'south'
        ? theme.palette.secondary.main
        : activeSlide === 'floater'
          ? theme.palette.error.main
          : theme.palette.success.main;
  const breakColor = theme.palette.warning.main;
  const differenceDomain: [number, number] = [-3, 3];
  const requirementLookup = useMemo(() => {
    return new Map(chartData.map((point) => [point.startTime, Math.round(point.requirement)]));
  }, [chartData]);
  const hoursFactor = INTERVAL_MINUTES / 60;
  const coverageSummary = useMemo(() => {
    return chartData.reduce(
      (acc, point) => {
        acc.master += point.requirement * hoursFactor;
        acc.mvt += point.coverage * hoursFactor;
        acc.net += (point.coverage - point.requirement) * hoursFactor;
        return acc;
      },
      { master: 0, mvt: 0, net: 0 }
    );
  }, [chartData, hoursFactor]);

  return (
    <Stack spacing={2}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{dayTypeLabels[dayType]} Coverage</Typography>
        </Box>
        {chartData.length === 0 ? (
          <Alert severity="info">No coverage data available.</Alert>
        ) : (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
              {SLIDER_OPTIONS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  clickable
                  color={activeSlide === option.key ? 'primary' : 'default'}
                  onClick={() => setActiveSlide(option.key)}
                />
              ))}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" mb={2}>
              <LegendSwatch label="Requirement" color={requirementColor} variant="line" />
              <LegendSwatch label="Coverage" color={coverageColor} variant="line" />
              <LegendSwatch
                label="Net difference"
                color={positiveDifferenceColor}
                secondaryColor={negativeDifferenceColor}
                variant="bar"
              />
              <LegendSwatch label="Break count" color={breakColor} variant="dashed" />
            </Stack>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  xAxisId="time"
                  dataKey="startTime"
                  interval={3}
                  height={30}
                  label={{
                    value: 'Time of day',
                    position: 'insideBottom',
                    offset: -4,
                    fill: theme.palette.text.secondary,
                    fontSize: 12
                  }}
                />
                <XAxis
                  xAxisId="master"
                  dataKey="startTime"
                  interval={3}
                  orientation="top"
                  tickLine={false}
                  axisLine={false}
                  height={24}
                  tick={{ fill: requirementColor, fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(value: string) => {
                    const label = requirementLookup.get(value);
                    return label != null ? `${label}` : '';
                  }}
                  label={{
                    value: 'Master schedule (buses)',
                    position: 'top',
                    offset: -4,
                    fill: requirementColor,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                />
                <YAxis yAxisId="coverage" allowDecimals={false} hide orientation="right" />
                <YAxis
                  yAxisId="difference"
                  domain={differenceDomain}
                  allowDecimals={false}
                  tickFormatter={(value) => (value > 0 ? `+${value}` : `${value}`)}
                  width={40}
                />
                <ReferenceLine yAxisId="difference" y={0} stroke={negativeDifferenceColor} strokeDasharray="3 3" />
                <RechartTooltip content={<ManualCoverageTooltip slide={activeSlide} />} />
                <Bar xAxisId="time" dataKey="difference" barSize={16} radius={[4, 4, 0, 0]} yAxisId="difference">
                  {chartData.map((point) => (
                    <Cell
                      key={`${dayType}-${point.startTime}`}
                      fill={point.difference >= 0 ? positiveDifferenceColor : negativeDifferenceColor}
                    />
                  ))}
                </Bar>
                <Line
                  xAxisId="time"
                  yAxisId="coverage"
                  type="monotone"
                  dataKey="requirement"
                  stroke={requirementColor}
                  strokeWidth={2}
                  dot={{ r: 3, stroke: requirementColor, fill: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  xAxisId="time"
                  yAxisId="coverage"
                  type="monotone"
                  dataKey="coverage"
                  stroke={coverageColor}
                  strokeWidth={2}
                  dot={{ r: 2, stroke: coverageColor, fill: coverageColor }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="coverage"
                    position="top"
                    formatter={(label) =>
                      typeof label === 'number' ? Math.round(label).toString() : label ?? ''
                    }
                    fill={coverageColor}
                  />
                </Line>
                <Line
                  xAxisId="time"
                  yAxisId="coverage"
                  type="monotone"
                  dataKey="breakCount"
                  stroke={breakColor}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <SummaryMetricsRow summary={coverageSummary} />
          </>
        )}
        <Box display="flex" justifyContent="flex-end" mt={2}>
          <Tooltip title={canUndo ? `Undo ${pendingUndoLabel}` : 'No manual changes to undo yet'} placement="left">
            <span>
              <Button
                variant="outlined"
                startIcon={<UndoIcon />}
                disabled={!canUndo}
                onClick={onUndo}
              >
                Undo last change
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Paper>
      <ShiftSummaryTable
        title={`${dayTypeLabels[dayType]} Shifts`}
        showActions
        filterScheduleType={dayType}
        filterZone={activeZone}
      />
      <Divider />
    </Stack>
  );
};

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
        width: 36,
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

interface SummaryMetricsRowProps {
  summary: { master: number; mvt: number; net: number };
}

const SummaryMetricsRow: React.FC<SummaryMetricsRowProps> = ({ summary }) => {
  const formatHours = (value: number, withSign = false) => {
    const rounded = Math.round(value * 10) / 10;
    const signPrefix = withSign && rounded > 0 ? '+' : '';
    return `${signPrefix}${rounded.toFixed(1)} hrs`;
  };
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2}>
      <SummaryMetric label="Master schedule hours" value={formatHours(summary.master)} />
      <SummaryMetric label="MVT shift hours" value={formatHours(summary.mvt)} />
      <SummaryMetric label="Net difference" value={formatHours(summary.net, true)} emphasize />
    </Stack>
  );
};

interface SummaryMetricProps {
  label: string;
  value: string;
  emphasize?: boolean;
}

const SummaryMetric: React.FC<SummaryMetricProps> = ({ label, value, emphasize }) => (
  <Box
    sx={{
      flex: 1,
      p: 1.5,
      borderRadius: 1,
      border: '1px solid',
      borderColor: emphasize ? 'primary.light' : 'divider',
      backgroundColor: 'background.paper',
      boxShadow: emphasize ? 2 : 0
    }}
  >
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="subtitle1" fontWeight={600} color={emphasize ? 'primary.main' : 'text.primary'}>
      {value}
    </Typography>
  </Box>
);

const SLIDER_OPTIONS: Array<{ key: ManualSlideKey; label: string }> = [
  { key: 'total', label: 'Total coverage' },
  { key: 'north', label: 'North coverage' },
  { key: 'south', label: 'South coverage' },
  { key: 'floater', label: 'Floater coverage' }
];

const ManualCoverageTooltip: React.FC<{ active?: boolean; payload?: any[]; slide: ManualSlideKey }> = ({
  active,
  payload,
  slide
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload as ManualCoveragePoint;
  const startMinutes = parseTimeToMinutes(point.startTime);
  const endLabel = minutesToTimeString(startMinutes + INTERVAL_MINUTES);
  return (
    <Paper elevation={3} sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>
        {SLIDER_OPTIONS.find((option) => option.key === slide)?.label ?? 'Coverage'} · {point.startTime} – {endLabel}
      </Typography>
      <Typography variant="body2">Requirement: {point.requirement.toFixed(1)}</Typography>
      <Typography variant="body2">Coverage: {point.coverage.toFixed(1)}</Typography>
      <Typography variant="body2">
        Difference: {point.difference >= 0 ? '+' : ''}
        {point.difference.toFixed(1)}
      </Typography>
      <Typography variant="body2">Break windows: {point.breakCount}</Typography>
    </Paper>
  );
};

export default ManualShiftAdjustmentsPage;

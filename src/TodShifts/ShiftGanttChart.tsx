import React, { useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Dialog
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip as RechartTooltip,
  Cell,
  Line,
  YAxis,
  CartesianGrid,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { RootState } from '../store/store';
import { DAY_TYPES, INTERVAL_MINUTES, parseTimeToMinutes } from './utils/timeUtils';
import { colorForValue, COLOR_BALANCED, COLOR_EXCESS_HEAVY, COLOR_DEFICIT_HEAVY } from './utils/colorScale';
import { useStableDifferenceDomain } from './utils/useStableDifferenceDomain';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import type { Shift } from './types/shift.types';

interface ChartRow {
  key: string;
  startTime: string;
  label: string;
  index: number;
  color: string;
  barValue: number;
  northExcess: number;
  southExcess: number;
  totalExcess: number;
  northRequired: number;
  southRequired: number;
  floaterRequired: number;
  floaterOperational: number;
  floaterAvailable: number;
  floaterAllocatedNorth: number;
  floaterAllocatedSouth: number;
  floaterExcess: number;
}

interface ZoneTimelinePoint {
  key: string;
  startTime: string;
  endTime: string;
  label: string;
  requirement: number;
  coverage: number;
  breakCount?: number;
  difference: number;
  floaterRequirement?: number;
  floaterCoverage?: number;
  floaterDifference?: number;
}

interface DayCoverageSummary {
  deficitHours: number;
  surplusHours: number;
  netHours: number;
  revenueHours: number;
  breakHours: number;
  dutyHours: number;
}

interface ChartSection {
  dayType: typeof DAY_TYPES[number];
  rows: ChartRow[];
  ticks: string[];
  totalSeries: ZoneTimelinePoint[];
  northSeries: ZoneTimelinePoint[];
  southSeries: ZoneTimelinePoint[];
  floaterSeries: ZoneTimelinePoint[];
  summary: DayCoverageSummary;
}

type SlideKey = 'total' | 'north' | 'south' | 'floater';
type SeriesKey = 'totalSeries' | 'northSeries' | 'southSeries' | 'floaterSeries';

interface SliderOption {
  key: SlideKey;
  label: string;
  seriesKey: SeriesKey;
  showBreaks: boolean;
}

const ShiftGanttChart: React.FC = () => {
  const theme = useTheme();
  const {
    coverageTimeline,
    colorScale,
    operationalTimeline,
    loading
  } = useSelector((state: RootState) => ({
    coverageTimeline: state.shiftManagement.coverageTimeline,
    colorScale: state.shiftManagement.colorScale,
    operationalTimeline: state.shiftManagement.operationalTimeline,
    loading: state.shiftManagement.loading
  }));

  const isLoading = loading.imports || loading.fetchRun;
  const [activeSlide, setActiveSlide] = useState<SlideKey>('total');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartData = useMemo<ChartSection[]>(() => {
    const breakMaps = DAY_TYPES.reduce((acc, dayType) => {
      const map = new Map<string, number>();
      (operationalTimeline[dayType] ?? []).forEach(interval => {
        map.set(interval.startTime, interval.breakCount ?? 0);
      });
      acc[dayType] = map;
      return acc;
    }, {} as Record<typeof DAY_TYPES[number], Map<string, number>>);

    return DAY_TYPES.map((dayType) => {
      const intervals = coverageTimeline[dayType] ?? [];
      const rows: ChartRow[] = intervals.map((interval, index) => {
        const floaterAvailable = Math.max(
          0,
          (interval.floaterOperational ?? 0) -
            (interval.floaterAllocatedNorth ?? 0) -
            (interval.floaterAllocatedSouth ?? 0)
        );

        return {
          key: `${dayType}-${interval.startTime}`,
          startTime: interval.startTime,
          label: `${interval.startTime} – ${interval.endTime}`,
          index,
          color: colorForValue(interval.totalExcess, colorScale),
          barValue: 1,
          northExcess: interval.northExcess,
          southExcess: interval.southExcess,
          totalExcess: interval.totalExcess,
          northRequired: interval.northRequired,
          southRequired: interval.southRequired,
          floaterRequired: interval.floaterRequired,
          floaterOperational: interval.floaterOperational,
          floaterAvailable,
          floaterAllocatedNorth: interval.floaterAllocatedNorth,
          floaterAllocatedSouth: interval.floaterAllocatedSouth,
          floaterExcess: interval.floaterExcess
        };
      });

      const ticks = rows.filter(row => row.index % 4 === 0).map(row => row.startTime);

      const breakMap = breakMaps[dayType] ?? new Map<string, number>();

      const totalSeries: ZoneTimelinePoint[] = intervals.map((interval, index) => {
        const coverageNorth = (interval.northOperational ?? 0) + (interval.floaterAllocatedNorth ?? 0);
        const coverageSouth = (interval.southOperational ?? 0) + (interval.floaterAllocatedSouth ?? 0);
        const floaterCoverage = Math.max(
          0,
          (interval.floaterOperational ?? 0) -
            (interval.floaterAllocatedNorth ?? 0) -
            (interval.floaterAllocatedSouth ?? 0)
        );
        const requirement =
          (interval.northRequired ?? 0) +
          (interval.southRequired ?? 0) +
          (interval.floaterRequired ?? 0);
        const coverage =
          (interval.northOperational ?? 0) +
          (interval.southOperational ?? 0) +
          (interval.floaterOperational ?? 0);
        return {
          key: `${dayType}-total-${interval.startTime}-${index}`,
          startTime: interval.startTime,
          endTime: interval.endTime,
          label: `${interval.startTime} – ${interval.endTime}`,
          requirement,
          coverage,
          floaterRequirement: interval.floaterRequired ?? 0,
          floaterCoverage,
          floaterDifference: floaterCoverage - (interval.floaterRequired ?? 0),
          breakCount: breakMap.get(interval.startTime) ?? 0,
          difference: coverage - requirement
        };
      });

      const northSeries: ZoneTimelinePoint[] = intervals.map((interval, index) => ({
        key: `${dayType}-north-${interval.startTime}-${index}`,
        startTime: interval.startTime,
        endTime: interval.endTime,
        label: `${interval.startTime} – ${interval.endTime}`,
        requirement: interval.northRequired ?? 0,
        coverage: (interval.northOperational ?? 0) + (interval.floaterAllocatedNorth ?? 0),
        breakCount: breakMap.get(interval.startTime) ?? 0,
        difference: ((interval.northOperational ?? 0) + (interval.floaterAllocatedNorth ?? 0)) - (interval.northRequired ?? 0)
      }));

      const southSeries: ZoneTimelinePoint[] = intervals.map((interval, index) => ({
        key: `${dayType}-south-${interval.startTime}-${index}`,
        startTime: interval.startTime,
        endTime: interval.endTime,
        label: `${interval.startTime} – ${interval.endTime}`,
        requirement: interval.southRequired ?? 0,
        coverage: (interval.southOperational ?? 0) + (interval.floaterAllocatedSouth ?? 0),
        breakCount: breakMap.get(interval.startTime) ?? 0,
        difference: ((interval.southOperational ?? 0) + (interval.floaterAllocatedSouth ?? 0)) - (interval.southRequired ?? 0)
      }));

      const hoursFactor = INTERVAL_MINUTES / 60;
      const deficitHours = totalSeries
        .filter(point => point.difference < 0)
        .reduce((sum, point) => sum + Math.abs(point.difference) * hoursFactor, 0);
      const surplusHours = totalSeries
        .filter(point => point.difference > 0)
        .reduce((sum, point) => sum + point.difference * hoursFactor, 0);
      const netHours = totalSeries
        .reduce((sum, point) => sum + point.difference * hoursFactor, 0);
      const revenueHours = totalSeries
        .reduce((sum, point) => sum + point.requirement * hoursFactor, 0);
      const dutyHours = totalSeries
        .reduce((sum, point) => sum + point.coverage * hoursFactor, 0);
      const breakHours = (operationalTimeline[dayType] ?? [])
        .reduce((sum, interval) => sum + (interval.breakCount ?? 0) * hoursFactor, 0);

      const floaterSeries: ZoneTimelinePoint[] = intervals.map((interval, index) => {
        const floaterCoverage = Math.max(
          0,
          (interval.floaterOperational ?? 0) -
            (interval.floaterAllocatedNorth ?? 0) -
            (interval.floaterAllocatedSouth ?? 0)
        );
        return {
          key: `${dayType}-floater-${interval.startTime}-${index}`,
          startTime: interval.startTime,
          endTime: interval.endTime,
          label: `${interval.startTime} – ${interval.endTime}`,
          requirement: interval.floaterRequired ?? 0,
          coverage: floaterCoverage,
          breakCount: breakMap.get(interval.startTime) ?? 0,
          difference: floaterCoverage - (interval.floaterRequired ?? 0)
        };
      });

      return {
        dayType,
        rows,
        ticks,
        totalSeries,
        northSeries,
        southSeries,
        floaterSeries,
        summary: {
          deficitHours,
          surplusHours,
          netHours,
          revenueHours,
          breakHours,
          dutyHours
        }
      };
    });
  }, [coverageTimeline, colorScale, operationalTimeline]);

  const hasData = chartData.some(section => section.rows.length > 0);
  const requirementColor = theme.palette.primary.main;
  const coverageColor = theme.palette.success.main;
  const breakColor = theme.palette.warning.main;
  const positiveDifferenceColor = theme.palette.success.light;
  const negativeDifferenceColor = theme.palette.error.light;

  const sliderOptions: SliderOption[] = [
    { key: 'total', label: 'Total coverage', seriesKey: 'totalSeries', showBreaks: true },
    { key: 'north', label: 'North coverage', seriesKey: 'northSeries', showBreaks: true },
    { key: 'south', label: 'South coverage', seriesKey: 'southSeries', showBreaks: true },
    { key: 'floater', label: 'Floater coverage', seriesKey: 'floaterSeries', showBreaks: true }
  ];

  const sharedContentProps: Omit<ShiftGanttChartContentProps, 'chartHeight'> = {
    isLoading,
    hasData,
    chartData,
    sliderOptions,
    activeSlide,
    onSlideChange: setActiveSlide,
    requirementColor,
    coverageColor,
    breakColor,
    positiveDifferenceColor,
    negativeDifferenceColor
  };

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, mb: 3, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Shift Timeline Visualization
          </Typography>
          <Tooltip title="Enter full screen view">
            <IconButton aria-label="Enter fullscreen" onClick={() => setIsFullscreen(true)}>
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <ShiftGanttChartContent {...sharedContentProps} chartHeight={260} />
      </Paper>

      <Dialog
        fullScreen
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        PaperProps={{ sx: { backgroundColor: 'background.default' } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: { xs: 2, md: 4 }, gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Shift Timeline Visualization
            </Typography>
            <Tooltip title="Exit full screen view">
              <IconButton aria-label="Exit fullscreen" onClick={() => setIsFullscreen(false)}>
                <FullscreenExitIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <ShiftGanttChartContent {...sharedContentProps} chartHeight={420} />
          </Box>
        </Box>
      </Dialog>
    </>
  );
};

interface ShiftGanttChartContentProps {
  isLoading: boolean;
  hasData: boolean;
  chartData: ChartSection[];
  sliderOptions: SliderOption[];
  activeSlide: SlideKey;
  onSlideChange: (key: SlideKey) => void;
  requirementColor: string;
  coverageColor: string;
  breakColor: string;
  positiveDifferenceColor: string;
  negativeDifferenceColor: string;
  chartHeight: number;
}

const ShiftGanttChartContent: React.FC<ShiftGanttChartContentProps> = ({
  isLoading,
  hasData,
  chartData,
  sliderOptions,
  activeSlide,
  onSlideChange,
  requirementColor,
  coverageColor,
  breakColor,
  positiveDifferenceColor,
  negativeDifferenceColor,
  chartHeight
}) => (
  <>
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      <Chip label="Excess" size="small" sx={{ backgroundColor: COLOR_EXCESS_HEAVY, color: 'common.white' }} />
      <Chip label="Balanced" size="small" sx={{ backgroundColor: COLOR_BALANCED }} />
      <Chip label="Deficit" size="small" sx={{ backgroundColor: COLOR_DEFICIT_HEAVY, color: 'common.white' }} />
    </Stack>

    {isLoading && (
      <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )}

    {!isLoading && !hasData && (
      <Alert severity="info">
        Import datasets to visualize coverage across the day. Once both files are processed, the timeline will display deficits and surpluses for each day type.
      </Alert>
    )}

    {!isLoading && hasData && chartData.map(section => (
      <Box key={section.dayType} sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, textTransform: 'capitalize' }}>
          {section.dayType}
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
            {sliderOptions.map(option => (
              <Chip
                key={option.key}
                label={option.label}
                clickable
                color={activeSlide === option.key ? 'primary' : 'default'}
                onClick={() => onSlideChange(option.key)}
              />
            ))}
          </Stack>
          <Box sx={{ position: 'relative', minHeight: chartHeight + 40 }}>
            {sliderOptions.map(option => {
              const data = section[option.seriesKey] as ZoneTimelinePoint[];
              const isActive = activeSlide === option.key;
              return (
                <Box
                  key={`${section.dayType}-${option.key}`}
                  sx={{
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateX(0)' : 'translateX(10px)',
                    pointerEvents: isActive ? 'auto' : 'none',
                    position: isActive ? 'relative' : 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    display: 'flex'
                  }}
                >
                  <TimelineSeriesChart
                    title={option.label}
                    data={data}
                    ticks={section.ticks}
                    requirementColor={requirementColor}
                    coverageColor={coverageColor}
                    showBreaks={option.showBreaks}
                    breakColor={breakColor}
                    showDifference
                    positiveDifferenceColor={positiveDifferenceColor}
                    negativeDifferenceColor={negativeDifferenceColor}
                    chartHeight={chartHeight}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <SummaryStat
              label="Total surplus"
              value={`${section.summary.surplusHours.toFixed(2)} vehicle-hours`}
              color="success.main"
            />
            <SummaryStat
              label="Total deficit"
              value={`${section.summary.deficitHours.toFixed(2)} vehicle-hours`}
              color="error.main"
            />
            <SummaryStat
              label="Net balance"
              value={`${section.summary.netHours >= 0 ? '+' : ''}${section.summary.netHours.toFixed(2)} vehicle-hours`}
              color={
                section.summary.netHours > 0
                  ? 'success.main'
                  : section.summary.netHours < 0
                    ? 'error.main'
                    : undefined
              }
            />
          </Stack>
        </Box>
      </Box>
    ))}
  </>
);

const GanttTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data: ChartRow = payload[0].payload;

  return (
    <Paper elevation={3} sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>
        {data.label}
      </Typography>
      <Typography variant="body2">North required: {data.northRequired}</Typography>
      <Typography variant="body2">South required: {data.southRequired}</Typography>
      <Typography variant="body2">Floater required: {data.floaterRequired}</Typography>
      <Typography variant="body2">Floaters scheduled: {data.floaterOperational}</Typography>
      <Typography variant="body2">Floaters available: {data.floaterAvailable}</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>North excess: {data.northExcess}</Typography>
      <Typography variant="body2">South excess: {data.southExcess}</Typography>
      <Typography variant="body2">Floater excess: {data.floaterExcess}</Typography>
      <Typography variant="body2">Total excess: {data.totalExcess}</Typography>
    </Paper>
  );
};

export default ShiftGanttChart;

interface TimelineSeriesChartProps {
  title: string;
  data: ZoneTimelinePoint[];
  ticks: string[];
  requirementColor: string;
  coverageColor: string;
  showBreaks?: boolean;
  breakColor?: string;
  showDifference?: boolean;
  positiveDifferenceColor?: string;
  negativeDifferenceColor?: string;
  chartHeight: number;
}

const TimelineSeriesChart: React.FC<TimelineSeriesChartProps> = ({
  title,
  data,
  ticks,
  requirementColor,
  coverageColor,
  showBreaks,
  breakColor,
  showDifference,
  positiveDifferenceColor,
  negativeDifferenceColor,
  chartHeight
}) => {
  const requirementLookup = useMemo(() => {
    return new Map(data.map((point) => [point.startTime, Math.round(point.requirement ?? 0)]));
  }, [data]);
  const differenceValues = useMemo(
    () => (showDifference ? data.map((point) => point.difference ?? 0) : []),
    [data, showDifference]
  );
  const differenceDomain = useStableDifferenceDomain(differenceValues, 3);
  const showDifferenceAxis = showDifference && differenceValues.length > 0;

  return (
    <Box sx={{ flex: '1 1 100%', minWidth: '100%' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack
        direction="row"
        spacing={2}
        flexWrap="wrap"
        alignItems="center"
        sx={{ mb: 1 }}
      >
      <LegendSwatch label="Requirement (City)" color={requirementColor} variant="line" />
      <LegendSwatch
        label="Coverage (MVT + floaters)"
        color={coverageColor}
        variant="line"
      />
      {showDifference && (
        <LegendSwatch
          label="Net difference (surplus / deficit)"
          color={positiveDifferenceColor ?? coverageColor}
          secondaryColor={negativeDifferenceColor}
          variant="bar"
        />
      )}
      {showBreaks && (
      <LegendSwatch label="Breaks" color={breakColor ?? coverageColor} variant="dashed" />
      )}
      </Stack>
      <Box sx={{ height: chartHeight, borderRadius: 1, backgroundColor: 'background.default', border: '1px solid', borderColor: 'divider', p: 1 }}>
      {data.length === 0 ? (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No data available
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, bottom: 16, left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              xAxisId="time"
              dataKey="startTime"
              ticks={ticks}
              tick={{ fontSize: 10 }}
              interval={0}
              height={30}
              label={{
                value: 'Time of day',
                position: 'insideBottom',
                offset: -4,
                fill: 'rgba(0,0,0,0.6)',
                fontSize: 11
              }}
            />
            <XAxis
              xAxisId="master"
              dataKey="startTime"
              ticks={ticks}
              tick={{ fontSize: 11, fontWeight: 600, fill: requirementColor }}
              interval={0}
              orientation="top"
              axisLine={false}
              tickLine={false}
              height={24}
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
            <YAxis yAxisId="coverage" allowDecimals={false} />
            {showDifferenceAxis && (
              <YAxis
                yAxisId="difference"
                domain={differenceDomain}
                allowDecimals={false}
                orientation="right"
                tickFormatter={(value) => (value > 0 ? `+${value}` : `${value}`)}
                width={40}
                stroke={negativeDifferenceColor}
              />
            )}
            {showDifferenceAxis && (
              <ReferenceLine
                yAxisId="difference"
                y={0}
                stroke={negativeDifferenceColor}
                strokeDasharray="3 3"
              />
            )}
            <RechartTooltip
              content={(props) => (
                <FleetTooltip
                  title={title}
                  showBreaks={showBreaks}
                  showDifference={showDifference}
                  {...props}
                />
              )}
            />
            {showDifference && (
              <Bar
                xAxisId="time"
                dataKey="difference"
                barSize={16}
                radius={[4, 4, 0, 0]}
                yAxisId="difference"
              >
                {data.map(point => (
                  <Cell
                    key={`${title}-${point.key}-difference`}
                    fill={
                      point.difference >= 0
                        ? positiveDifferenceColor
                        : negativeDifferenceColor
                    }
                  />
                ))}
              </Bar>
            )}
            <Line
              xAxisId="time"
              yAxisId="coverage"
              type="monotone"
              dataKey="requirement"
              stroke={requirementColor}
              strokeWidth={2}
              dot={{ r: 3, stroke: requirementColor, fill: '#ffffff', strokeWidth: 2 }}
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
            />
            {showBreaks && (
              <Line
                xAxisId="time"
                yAxisId="coverage"
                type="monotone"
                dataKey="breakCount"
                stroke={breakColor ?? coverageColor}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
      </Box>
    </Box>
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

interface SummaryStatProps {
  label: string;
  value: string;
  color?: string;
}

const SummaryStat: React.FC<SummaryStatProps> = ({ label, value, color }) => (
  <Box
    sx={{
      flex: '0 1 240px',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      px: 2,
      py: 1.5,
      backgroundColor: 'background.paper'
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        color: color ?? 'text.primary'
      }}
    >
      {value}
    </Typography>
  </Box>
);

interface FleetTooltipProps {
  title: string;
  showBreaks?: boolean;
  showDifference?: boolean;
  active?: boolean;
  payload?: any[];
}

const FleetTooltip: React.FC<FleetTooltipProps> = ({
  title,
  showBreaks,
  showDifference,
  active,
  payload
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point: ZoneTimelinePoint = payload[0].payload;

  return (
    <Paper elevation={3} sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2">{point.label}</Typography>
      <Typography variant="body2">Requirement: {point.requirement}</Typography>
      <Typography variant="body2">Coverage (with floaters): {point.coverage}</Typography>
      {typeof point.floaterRequirement === 'number' && (
        <Typography variant="body2">
          Floater requirement: {point.floaterRequirement}
        </Typography>
      )}
      {typeof point.floaterCoverage === 'number' && (
        <Typography variant="body2">
          Floater coverage: {point.floaterCoverage}
        </Typography>
      )}
      {typeof point.floaterDifference === 'number' && (
        <Typography variant="body2">
          Floater difference: {point.floaterDifference >= 0 ? '+' : ''}{point.floaterDifference}
        </Typography>
      )}
      {showDifference && (
        <Typography variant="body2">
          Net difference: {point.difference >= 0 ? '+' : ''}{point.difference}
        </Typography>
      )}
      {showBreaks && typeof point.breakCount === 'number' && (
        <Typography variant="body2">
          Breaks: {point.breakCount}
        </Typography>
      )}
    </Paper>
  );
};

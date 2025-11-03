/**
 * SummaryDisplay Component
 * Interactive component for displaying processed schedule summaries
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Paper,
  Chip,
  Alert,
  Grid,
  Divider,
  Collapse,
  CardContent
} from '@mui/material';
import {
  Download as DownloadIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { SummarySchedule, ScheduleStatistics } from '../types';
import { CalculationResults } from '../utils/calculator';
import {
  SummaryFormatOptions,
  FormattedScheduleData,
  generateSummaryDisplayData,
  exportToCSV,
  validateSummaryData,
  groupTripsByTimeBands
} from '../utils/summaryGenerator';
import { ParsedCsvData } from '../utils/csvParser';
import { TripDurationAnalyzer } from '../utils/tripDurationAnalyzer';
import { TripDurationTable } from './TripDurationTable';
import { TripDurationChart } from './TripDurationChart';

interface SummaryDisplayProps {
  /** Summary schedule data */
  summarySchedule: SummarySchedule;
  /** Calculation results from processing */
  calculationResults: CalculationResults;
  /** Optional formatting options */
  formatOptions?: Partial<SummaryFormatOptions>;
  /** Callback for export actions */
  onExport?: (data: string, filename: string) => void;
  /** Show advanced statistics */
  showAdvancedStats?: boolean;
  /** Raw CSV data for trip duration analysis (optional) */
  csvData?: ParsedCsvData;
}


interface ScheduleTableProps {
  scheduleData: FormattedScheduleData;
  dayType: string;
  routeName: string;
  onExport?: (data: string, filename: string) => void;
}

interface StatisticsCardProps {
  statistics: ScheduleStatistics;
  showAdvanced: boolean;
}


/**
 * Schedule table component
 */
const ScheduleTable: React.FC<ScheduleTableProps> = ({ 
  scheduleData, 
  dayType, 
  routeName, 
  onExport 
}) => {
  const handleExport = () => {
    if (onExport) {
      const csvData = exportToCSV(scheduleData, dayType, routeName);
      const filename = `${routeName}_${dayType}_schedule.csv`;
      onExport(csvData, filename);
    }
  };

  if (scheduleData.tripCount === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No trips scheduled for {dayType}.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ space: 2 }}>
      {/* Table Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip 
            label={`${scheduleData.tripCount} trips`} 
            variant="outlined" 
            size="small" 
          />
          <Chip 
            label={`${scheduleData.frequency} min avg frequency`} 
            variant="outlined" 
            size="small" 
          />
          <Chip 
            label={`${scheduleData.operatingHours.start} - ${scheduleData.operatingHours.end}`}
            variant="outlined" 
            size="small" 
          />
        </Box>
        {onExport && (
          <Button
            onClick={handleExport}
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Export CSV
          </Button>
        )}
      </Box>

      {/* Schedule Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell 
                sx={{ 
                  fontWeight: 'bold', 
                  backgroundColor: 'grey.100',
                  minWidth: 60
                }}
              >
                Trip
              </TableCell>
              {scheduleData.headers.map((header, index) => (
                <TableCell
                  key={index}
                  sx={{ 
                    fontWeight: 'bold', 
                    backgroundColor: 'grey.100',
                    minWidth: 80
                  }}
                  title={`Time Point ${index + 1}`}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {scheduleData.rows.map((row, tripIndex) => (
              <TableRow
                key={tripIndex}
                hover
                sx={{ '&:nth-of-type(odd)': { backgroundColor: 'grey.50' } }}
              >
                <TableCell 
                  component="th" 
                  scope="row" 
                  sx={{ fontWeight: 'medium' }}
                >
                  {tripIndex + 1}
                </TableCell>
                {row.map((cellValue, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    sx={{
                      color: cellValue === '' ? 'text.disabled' : 'text.primary',
                      fontStyle: cellValue === '' ? 'italic' : 'normal'
                    }}
                  >
                    {cellValue || '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Table Footer with Summary */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Operating from {scheduleData.operatingHours.start} to {scheduleData.operatingHours.end} | 
        Average frequency: {scheduleData.frequency} minutes between trips
      </Typography>
    </Box>
  );
};

/**
 * Statistics card component
 */
const StatisticsCard: React.FC<StatisticsCardProps> = ({ statistics, showAdvanced }) => {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Schedule Statistics
        </Typography>
        
        <Grid container spacing={3}>
          {/* Trip Counts */}
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Trip Counts
            </Typography>
            <Box sx={{ space: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Weekday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.totalTrips.weekday}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Saturday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.totalTrips.saturday}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Sunday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.totalTrips.sunday}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight="bold">Total:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {statistics.totalTrips.total}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Frequencies */}
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Average Frequency (min)
            </Typography>
            <Box sx={{ space: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Weekday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.averageFrequency.weekday}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Saturday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.averageFrequency.saturday}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Sunday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.averageFrequency.sunday}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Operating Hours */}
          <Grid
            size={{
              xs: 12,
              md: 4
            }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Operating Hours
            </Typography>
            <Box sx={{ space: 1 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Weekday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.operatingHours.weekday.start} - {statistics.operatingHours.weekday.end}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Saturday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.operatingHours.saturday.start} - {statistics.operatingHours.saturday.end}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Sunday:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {statistics.operatingHours.sunday.start} - {statistics.operatingHours.sunday.end}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {showAdvanced && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Advanced Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  Total Time Points:{' '}
                </Typography>
                <Typography variant="body2" fontWeight="medium" component="span">
                  {statistics.totalTimePoints}
                </Typography>
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  md: 6
                }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  Total Travel Time:{' '}
                </Typography>
                <Typography variant="body2" fontWeight="medium" component="span">
                  {statistics.totalTravelTime.weekday + 
                   statistics.totalTravelTime.saturday + 
                   statistics.totalTravelTime.sunday} minutes
                </Typography>
              </Grid>
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Main SummaryDisplay component
 */
const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  summarySchedule,
  calculationResults,
  formatOptions = {},
  onExport,
  showAdvancedStats = false,
  csvData
}) => {
  const [activeTab, setActiveTab] = useState<'weekday' | 'saturday' | 'sunday'>('weekday');
  const [showTimeBands, setShowTimeBands] = useState(false);
  const [showTripDurationAnalysis, setShowTripDurationAnalysis] = useState(false);
  const [tripDurationAnalysis, setTripDurationAnalysis] = useState<any>(null);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);

  // Generate display data with memoization for performance
  const displayData = useMemo(() => {
    const defaultOptions: SummaryFormatOptions = {
      includeTimePointNames: true,
      timeFormat: '24h',
      includeStatistics: true,
      ...formatOptions
    };

    return generateSummaryDisplayData(
      summarySchedule,
      calculationResults,
      defaultOptions
    );
  }, [summarySchedule, calculationResults, formatOptions]);

  // Validate data
  const validationResult = useMemo(() => {
    return validateSummaryData(displayData);
  }, [displayData]);

  // Time bands for active day type
  const timeBands = useMemo(() => {
    const dayTypeResults = calculationResults[activeTab];
    return groupTripsByTimeBands(dayTypeResults, 60); // 1-hour bands
  }, [calculationResults, activeTab]);

  // Handle tab changes
  const handleTabChange = (dayType: 'weekday' | 'saturday' | 'sunday') => {
    setActiveTab(dayType);
  };

  // Generate trip duration analysis on demand
  const handleGenerateTripDurationAnalysis = useCallback(async () => {
    if (!csvData || isGeneratingAnalysis) return;

    setIsGeneratingAnalysis(true);
    try {
      const parsedData = TripDurationAnalyzer.fromParsedCsvData(
        csvData,
        summarySchedule.routeId,
        summarySchedule.routeName,
        summarySchedule.direction
      );
      const analysis = TripDurationAnalyzer.analyzeTripDuration(parsedData);
      setTripDurationAnalysis(analysis);
      setShowTripDurationAnalysis(true);
    } catch (error) {
      console.error('Failed to generate trip duration analysis:', error);
      // You could add error state here if needed
    } finally {
      setIsGeneratingAnalysis(false);
    }
  }, [csvData, summarySchedule.routeId, summarySchedule.routeName, summarySchedule.direction, isGeneratingAnalysis]);

  // Handle export all
  const handleExportAll = () => {
    if (!onExport) return;

    const dayTypes: Array<'weekday' | 'saturday' | 'sunday'> = ['weekday', 'saturday', 'sunday'];
    dayTypes.forEach(dayType => {
      const csvData = exportToCSV(
        displayData.schedules[dayType],
        dayType,
        summarySchedule.routeName
      );
      const filename = `${summarySchedule.routeName}_${dayType}_schedule.csv`;
      onExport(csvData, filename);
    });
  };

  // Show validation errors if any
  if (!validationResult.isValid) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Data Validation Errors
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          {validationResult.errors.map((error, index) => (
            <Typography key={index} component="li" variant="body2">
              {error}
            </Typography>
          ))}
        </Box>
      </Alert>
    );
  }

  return (
    <Box sx={{ space: 3 }}>
      {/* Route Header */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
                {displayData.routeInfo.routeName}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Route {displayData.routeInfo.routeId} - {displayData.routeInfo.direction}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Effective: {displayData.routeInfo.effectiveDate.toLocaleDateString()}
                {displayData.routeInfo.expirationDate && 
                  ` - ${displayData.routeInfo.expirationDate.toLocaleDateString()}`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {onExport && (
                <Button
                  onClick={handleExportAll}
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Export All
                </Button>
              )}
              <Button
                onClick={() => setShowTimeBands(!showTimeBands)}
                variant="outlined"
                startIcon={<TimelineIcon />}
                sx={{ textTransform: 'none' }}
              >
                {showTimeBands ? 'Hide' : 'Show'} Time Bands
              </Button>
            </Box>
          </Box>

          {/* Show warnings if any */}
          {validationResult.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Warnings:
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {validationResult.warnings.map((warning, index) => (
                  <Typography key={index} component="li" variant="body2">
                    {warning}
                  </Typography>
                ))}
              </Box>
            </Alert>
          )}
        </CardContent>
      </Card>
      {/* Statistics Card */}
      <Box sx={{ mt: 3 }}>
        <StatisticsCard 
          statistics={displayData.statistics} 
          showAdvanced={showAdvancedStats} 
        />
      </Box>
      {/* Time Bands (if enabled) */}
      {showTimeBands && (
        <Card variant="outlined" sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Time Bands - {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </Typography>
            <Grid container spacing={2}>
              {timeBands.map((band, index) => (
                <Grid
                  key={index}
                  size={{
                    xs: 12,
                    md: 6,
                    lg: 4
                  }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {band.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {band.trips.length} trips | {Math.round(band.frequency)} min frequency
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
      {/* Schedule Tables */}
      <Card variant="outlined" sx={{ mt: 3 }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => handleTabChange(newValue)}
            sx={{ px: 2 }}
          >
            <Tab 
              value="weekday"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Weekday
                  <Chip 
                    label={displayData.schedules.weekday.tripCount} 
                    size="small" 
                    color="primary"
                  />
                </Box>
              }
              sx={{ textTransform: 'none' }}
            />
            <Tab 
              value="saturday"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Saturday
                  <Chip 
                    label={displayData.schedules.saturday.tripCount} 
                    size="small" 
                    color="primary"
                  />
                </Box>
              }
              sx={{ textTransform: 'none' }}
            />
            <Tab 
              value="sunday"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Sunday
                  <Chip 
                    label={displayData.schedules.sunday.tripCount} 
                    size="small" 
                    color="primary"
                  />
                </Box>
              }
              sx={{ textTransform: 'none' }}
            />
          </Tabs>
        </Box>

        {/* Active Tab Content */}
        <Box sx={{ p: 3 }}>
          <ScheduleTable
            scheduleData={displayData.schedules[activeTab]}
            dayType={activeTab}
            routeName={summarySchedule.routeName}
            onExport={onExport}
          />
        </Box>
      </Card>
      {/* Trip Duration Analysis Section */}
      {csvData && (
        <Card variant="outlined" sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon color="primary" />
                <Typography variant="h6">
                  Trip Duration Analysis
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                onClick={handleGenerateTripDurationAnalysis}
                disabled={isGeneratingAnalysis}
                startIcon={isGeneratingAnalysis ? undefined : <TimelineIcon />}
                sx={{ textTransform: 'none' }}
              >
                {isGeneratingAnalysis ? 'Analyzing...' : 'Analyze Trip Duration by Time of Day'}
              </Button>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Generate a detailed analysis showing how total trip duration varies throughout the day using travel time percentiles from your CSV data.
            </Typography>

            {showTripDurationAnalysis && tripDurationAnalysis && (
              <Collapse in={showTripDurationAnalysis}>
                <Box sx={{ mt: 3 }}>
                  <Grid container spacing={3}>
                    <Grid size={12}>
                      <TripDurationChart analysis={tripDurationAnalysis} />
                    </Grid>
                    <Grid size={12}>
                      <TripDurationTable analysis={tripDurationAnalysis} />
                    </Grid>
                  </Grid>
                </Box>
              </Collapse>
            )}
          </CardContent>
        </Card>
      )}
      {/* Footer Info */}
      <Typography 
        variant="body2" 
        color="text.secondary" 
        textAlign="center" 
        sx={{ mt: 3 }}
      >
        Generated at {displayData.formatInfo.generatedAt.toLocaleString()} |{' '}
        Time format: {displayData.formatInfo.timeFormat.toUpperCase()} |{' '}
        Total trips: {displayData.formatInfo.totalTrips}
      </Typography>
    </Box>
  );
};

export default SummaryDisplay;
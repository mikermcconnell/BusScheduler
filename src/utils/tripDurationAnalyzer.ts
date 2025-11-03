import { TripDurationAnalysis, TripDurationByTimeOfDay } from '../types/schedule';
import { ParsedCsvData, TimeSegment } from './csvParser';
import { sanitizeText } from './inputSanitizer';

/**
 * Raw travel time data structure from CSV parsing
 */
interface RawTravelTimeData {
  segment: string;
  timePeriods: string[];
  percentiles: {
    p25: number[];
    p50: number[];
    p80: number[];
    p90: number[];
  };
}

/**
 * Parsed CSV data structure for trip duration analysis
 */
export interface ParsedTravelTimeData {
  segments: RawTravelTimeData[];
  routeId: string;
  routeName: string;
  direction: string;
}

/**
 * Analyzes trip duration by time of day from raw travel time data
 */
export class TripDurationAnalyzer {
  
  /**
   * Converts ParsedCsvData to format needed for trip duration analysis
   * @param csvData Parsed CSV data from csvParser
   * @param routeId Route identifier
   * @param routeName Route name
   * @param direction Route direction
   * @returns Parsed travel time data ready for analysis
   */
  static fromParsedCsvData(
    csvData: ParsedCsvData,
    routeId: string,
    routeName: string,
    direction: string
  ): ParsedTravelTimeData {
    // Group segments by time slot
    const timeSlotMap = new Map<string, Map<string, TimeSegment>>();
    
    csvData.segments.forEach(segment => {
      if (!timeSlotMap.has(segment.timeSlot)) {
        timeSlotMap.set(segment.timeSlot, new Map());
      }
      const segmentKey = `${segment.fromLocation} to ${segment.toLocation}`;
      timeSlotMap.get(segment.timeSlot)!.set(segmentKey, segment);
    });

    // Get all unique time periods from the data
    const timePeriods = Array.from(timeSlotMap.keys()).sort();
    
    // Get all unique segments (route combinations)
    const segmentKeys = new Set<string>();
    csvData.segments.forEach(segment => {
      segmentKeys.add(`${segment.fromLocation} to ${segment.toLocation}`);
    });

    // Create structured segments
    const segments: RawTravelTimeData[] = Array.from(segmentKeys).map(segmentKey => {
      const segment = segmentKey;
      const percentiles = {
        p25: [] as number[],
        p50: [] as number[],
        p80: [] as number[],
        p90: [] as number[]
      };

      // For each time period, get the data for this segment
      timePeriods.forEach(timePeriod => {
        const segmentData = timeSlotMap.get(timePeriod)?.get(segmentKey);
        if (segmentData) {
          percentiles.p25.push(segmentData.percentile25);
          percentiles.p50.push(segmentData.percentile50);
          percentiles.p80.push(segmentData.percentile80);
          percentiles.p90.push(segmentData.percentile90);
        } else {
          // Fill with zeros if no data for this time period
          percentiles.p25.push(0);
          percentiles.p50.push(0);
          percentiles.p80.push(0);
          percentiles.p90.push(0);
        }
      });

      return {
        segment: sanitizeText(segment),
        timePeriods: timePeriods.map(tp => sanitizeText(tp)),
        percentiles
      };
    });

    return {
      segments,
      routeId: sanitizeText(routeId),
      routeName: sanitizeText(routeName),
      direction: sanitizeText(direction)
    };
  }

  /**
   * Analyzes trip duration from parsed CSV travel time data
   * @param data Parsed travel time data from CSV
   * @returns Trip duration analysis with table and chart data
   */
  static analyzeTripDuration(data: ParsedTravelTimeData): TripDurationAnalysis {
    const { segments, routeId, routeName, direction } = data;
    
    if (segments.length === 0) {
      throw new Error('No travel time segments found');
    }

    // Get time periods from first segment (all segments should have same periods)
    const timePeriods = segments[0].timePeriods;
    const durationByTimeOfDay: TripDurationByTimeOfDay[] = [];

    // Calculate total trip duration for each time period
    timePeriods.forEach((timePeriod, periodIndex) => {
      // Sum all segments for this time period across all percentiles
      const totalDurations = {
        p25: 0,
        p50: 0,
        p80: 0,
        p90: 0
      };

      segments.forEach(segment => {
        totalDurations.p25 += segment.percentiles.p25[periodIndex] || 0;
        totalDurations.p50 += segment.percentiles.p50[periodIndex] || 0;
        totalDurations.p80 += segment.percentiles.p80[periodIndex] || 0;
        totalDurations.p90 += segment.percentiles.p90[periodIndex] || 0;
      });

      // Extract start time from time period (e.g., "07:00" from "07:00 - 07:29")
      const startTime = this.extractStartTime(timePeriod);

      durationByTimeOfDay.push({
        timePeriod: sanitizeText(timePeriod),
        startTime,
        duration: {
          p25: Math.round(totalDurations.p25), // Round to nearest whole minute
          p50: Math.round(totalDurations.p50),
          p80: Math.round(totalDurations.p80),
          p90: Math.round(totalDurations.p90)
        }
      });
    });

    // Calculate summary statistics using median (p50) values
    const p50Durations = durationByTimeOfDay.map(d => d.duration.p50);
    const minDuration = Math.min(...p50Durations);
    const maxDuration = Math.max(...p50Durations);
    const avgDuration = Math.round(p50Durations.reduce((sum, d) => sum + d, 0) / p50Durations.length);

    // Find peak and fastest periods
    const maxIndex = p50Durations.indexOf(maxDuration);
    const minIndex = p50Durations.indexOf(minDuration);
    const peakPeriod = durationByTimeOfDay[maxIndex].timePeriod;
    const fastestPeriod = durationByTimeOfDay[minIndex].timePeriod;

    return {
      routeId: sanitizeText(routeId),
      routeName: sanitizeText(routeName),
      direction: sanitizeText(direction),
      durationByTimeOfDay,
      summary: {
        minDuration,
        maxDuration,
        avgDuration,
        peakPeriod,
        fastestPeriod
      }
    };
  }

  /**
   * Parses raw CSV data into structured travel time data
   * @param rawData Raw CSV data as array of arrays
   * @param routeId Route identifier
   * @param routeName Route name
   * @param direction Route direction
   * @returns Parsed travel time data ready for analysis
   */
  static parseRawCsvData(
    rawData: any[][], 
    routeId: string, 
    routeName: string, 
    direction: string
  ): ParsedTravelTimeData {
    const segments: RawTravelTimeData[] = [];
    let currentSegment: RawTravelTimeData | null = null;
    let timePeriods: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || '').trim();

      // Title row - indicates start of new segment
      if (firstCell === 'Title') {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        
        // Extract segment name from second cell
        const segmentName = String(row[1] || '').trim();
        currentSegment = {
          segment: sanitizeText(segmentName),
          timePeriods: [],
          percentiles: {
            p25: [],
            p50: [],
            p80: [],
            p90: []
          }
        };
        continue;
      }

      // Half-hour row - contains time periods
      if (firstCell === 'Half-Hour') {
        timePeriods = row.slice(1).map(cell => String(cell || '').trim()).filter(Boolean);
        if (currentSegment) {
          currentSegment.timePeriods = timePeriods.map(period => sanitizeText(period));
        }
        continue;
      }

      // Percentile data rows
      if (currentSegment && firstCell.includes('Observed Runtime-')) {
        const percentileMatch = firstCell.match(/Runtime-(\d+)%/);
        if (percentileMatch) {
          const percentile = percentileMatch[1];
          const values = row.slice(1, timePeriods.length + 1)
            .map(cell => {
              const num = parseFloat(String(cell || '0'));
              return isNaN(num) ? 0 : num;
            });

          switch (percentile) {
            case '25':
              currentSegment.percentiles.p25 = values;
              break;
            case '50':
              currentSegment.percentiles.p50 = values;
              break;
            case '80':
              currentSegment.percentiles.p80 = values;
              break;
            case '90':
              currentSegment.percentiles.p90 = values;
              break;
          }
        }
      }
    }

    // Add last segment
    if (currentSegment) {
      segments.push(currentSegment);
    }

    return {
      segments,
      routeId: sanitizeText(routeId),
      routeName: sanitizeText(routeName),
      direction: sanitizeText(direction)
    };
  }

  /**
   * Extracts start time from time period string
   * @param timePeriod Time period string (e.g., "07:00 - 07:29")
   * @returns Start time (e.g., "07:00")
   */
  private static extractStartTime(timePeriod: string): string {
    const match = timePeriod.match(/(\d{2}:\d{2})/);
    return match ? match[1] : '';
  }

  /**
   * Converts analysis data to table format for display
   * @param analysis Trip duration analysis
   * @returns Table data with headers and rows
   */
  static toTableData(analysis: TripDurationAnalysis) {
    const headers = [
      'Time Period',
      '25th Percentile (min)',
      'Median (min)', 
      '80th Percentile (min)',
      '90th Percentile (min)'
    ];

    const rows = analysis.durationByTimeOfDay.map(item => [
      item.timePeriod,
      item.duration.p25.toString(),
      item.duration.p50.toString(),
      item.duration.p80.toString(),
      item.duration.p90.toString()
    ]);

    return { headers, rows };
  }

  /**
   * Converts analysis data to chart format for visualization
   * @param analysis Trip duration analysis
   * @returns Chart data ready for bar chart display
   */
  static toChartData(analysis: TripDurationAnalysis) {
    const labels = analysis.durationByTimeOfDay.map(item => item.startTime);
    
    const datasets = [
      {
        label: '25th Percentile',
        data: analysis.durationByTimeOfDay.map(item => item.duration.p25),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Median (50th)',
        data: analysis.durationByTimeOfDay.map(item => item.duration.p50),
        backgroundColor: 'rgba(255, 206, 86, 0.6)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      },
      {
        label: '80th Percentile',
        data: analysis.durationByTimeOfDay.map(item => item.duration.p80),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      },
      {
        label: '90th Percentile',
        data: analysis.durationByTimeOfDay.map(item => item.duration.p90),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }
    ];

    return { labels, datasets };
  }
}
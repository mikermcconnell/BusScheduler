/**
 * Excel Export Utilities
 * Professional Excel export functionality with proper formatting and multiple sheets
 */

import * as XLSX from 'xlsx';
import {
  SummarySchedule,
  TimePoint,
  ScheduleMatrix,
  ScheduleStatistics
} from '../types/schedule';
import {
  CalculationResults,
  TripCalculationResult
} from '../utils/calculator';
import {
  SummaryDisplayData,
  FormattedScheduleData
} from '../utils/summaryGenerator';

/**
 * Export options for Excel generation
 */
export interface ExcelExportOptions {
  /** Include metadata sheet */
  includeMetadata: boolean;
  /** Include statistics sheet */
  includeStatistics: boolean;
  /** Include raw data sheets */
  includeRawData: boolean;
  /** Time format for display */
  timeFormat: '12h' | '24h';
  /** Route name for filename */
  routeName: string;
  /** Additional filename suffix */
  filenameSuffix?: string;
}

/**
 * Export results with file information
 */
export interface ExcelExportResult {
  /** Generated filename */
  filename: string;
  /** File blob */
  blob: Blob;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Creates a new Excel workbook
 */
const createWorkbook = (): XLSX.WorkBook => {
  return XLSX.utils.book_new();
};

/**
 * Formats schedule data for Excel export
 */
const formatScheduleForExport = (
  scheduleData: FormattedScheduleData,
  dayType: string,
  timeFormat: '12h' | '24h' = '24h'
): any[][] => {
  const data: any[][] = [];
  
  // Add header row with day type info
  data.push([`${dayType.toUpperCase()} SCHEDULE`]);
  data.push([]); // Empty row
  
  // Add operating hours and frequency info
  data.push(['Operating Hours:', `${scheduleData.operatingHours.start} - ${scheduleData.operatingHours.end}`]);
  data.push(['Average Frequency:', `${scheduleData.frequency} minutes`]);
  data.push(['Total Trips:', scheduleData.tripCount]);
  data.push([]); // Empty row
  
  // Add column headers
  const headers = ['Trip #', ...scheduleData.headers];
  data.push(headers);
  
  // Add data rows
  scheduleData.rows.forEach((row, index) => {
    const formattedRow = [
      index + 1, // Trip number
      ...row.map(time => time || '') // Times (already formatted)
    ];
    data.push(formattedRow);
  });
  
  return data;
};

/**
 * Creates metadata sheet data
 */
const createMetadataSheet = (
  summarySchedule: SummarySchedule,
  calculationResults: CalculationResults
): any[][] => {
  const data: any[][] = [];
  
  data.push(['SCHEDULE METADATA']);
  data.push([]);
  
  // Route Information
  data.push(['ROUTE INFORMATION']);
  data.push(['Route ID:', summarySchedule.routeId]);
  data.push(['Route Name:', summarySchedule.routeName]);
  data.push(['Direction:', summarySchedule.direction]);
  data.push(['Effective Date:', summarySchedule.effectiveDate.toLocaleDateString()]);
  if (summarySchedule.expirationDate) {
    data.push(['Expiration Date:', summarySchedule.expirationDate.toLocaleDateString()]);
  }
  data.push([]);
  
  // Time Points
  data.push(['TIME POINTS']);
  data.push(['Sequence', 'ID', 'Name']);
  summarySchedule.timePoints
    .sort((a, b) => a.sequence - b.sequence)
    .forEach(tp => {
      data.push([tp.sequence, tp.id, tp.name]);
    });
  data.push([]);
  
  // Trip Counts
  data.push(['TRIP COUNTS']);
  data.push(['Weekday:', summarySchedule.metadata.weekdayTrips]);
  data.push(['Saturday:', summarySchedule.metadata.saturdayTrips]);
  data.push(['Sunday:', summarySchedule.metadata.sundayTrips]);
  data.push(['Total:', summarySchedule.metadata.weekdayTrips + summarySchedule.metadata.saturdayTrips + summarySchedule.metadata.sundayTrips]);
  data.push([]);
  
  // Processing Information
  data.push(['PROCESSING INFORMATION']);
  data.push(['Total Time Points:', calculationResults.metadata.totalTimePoints]);
  data.push(['Total Trips Generated:', calculationResults.metadata.totalTrips]);
  data.push(['Calculation Time (ms):', calculationResults.metadata.calculationTime]);
  data.push(['Generated At:', new Date().toLocaleString()]);
  
  return data;
};

/**
 * Creates statistics sheet data
 */
const createStatisticsSheet = (statistics: ScheduleStatistics): any[][] => {
  const data: any[][] = [];
  
  data.push(['SCHEDULE STATISTICS']);
  data.push([]);
  
  // Trip Counts
  data.push(['TRIP COUNTS']);
  data.push(['Day Type', 'Trip Count']);
  data.push(['Weekday', statistics.totalTrips.weekday]);
  data.push(['Saturday', statistics.totalTrips.saturday]);
  data.push(['Sunday', statistics.totalTrips.sunday]);
  data.push(['Total', statistics.totalTrips.total]);
  data.push([]);
  
  // Average Frequencies
  data.push(['AVERAGE FREQUENCIES (minutes)']);
  data.push(['Day Type', 'Frequency']);
  data.push(['Weekday', statistics.averageFrequency.weekday]);
  data.push(['Saturday', statistics.averageFrequency.saturday]);
  data.push(['Sunday', statistics.averageFrequency.sunday]);
  data.push([]);
  
  // Operating Hours
  data.push(['OPERATING HOURS']);
  data.push(['Day Type', 'Start Time', 'End Time']);
  data.push(['Weekday', statistics.operatingHours.weekday.start, statistics.operatingHours.weekday.end]);
  data.push(['Saturday', statistics.operatingHours.saturday.start, statistics.operatingHours.saturday.end]);
  data.push(['Sunday', statistics.operatingHours.sunday.start, statistics.operatingHours.sunday.end]);
  data.push([]);
  
  // Travel Times
  data.push(['TOTAL TRAVEL TIME (minutes)']);
  data.push(['Day Type', 'Total Time']);
  data.push(['Weekday', statistics.totalTravelTime.weekday]);
  data.push(['Saturday', statistics.totalTravelTime.saturday]);
  data.push(['Sunday', statistics.totalTravelTime.sunday]);
  data.push(['Total', statistics.totalTravelTime.weekday + statistics.totalTravelTime.saturday + statistics.totalTravelTime.sunday]);
  
  return data;
};

/**
 * Creates raw calculation data sheet
 */
const createRawDataSheet = (
  calculationResults: CalculationResults,
  timePoints: TimePoint[]
): any[][] => {
  const data: any[][] = [];
  
  data.push(['RAW TRIP DATA']);
  data.push([]);
  
  // Headers
  const headers = ['Trip ID', 'Day Type', 'Valid', 'Total Travel Time', 'Errors'];
  const sortedTimePoints = [...timePoints].sort((a, b) => a.sequence - b.sequence);
  sortedTimePoints.forEach(tp => {
    headers.push(`${tp.name} (Arrival)`);
    headers.push(`${tp.name} (Departure)`);
  });
  data.push(headers);
  
  // Process all day types
  const dayTypes: Array<keyof CalculationResults> = ['weekday', 'saturday', 'sunday'];
  dayTypes.forEach(dayType => {
    if (dayType === 'metadata') return;
    
    const dayTrips = calculationResults[dayType] as TripCalculationResult[];
    dayTrips.forEach(trip => {
      const row: any[] = [
        trip.tripId,
        dayType,
        trip.isValid ? 'Yes' : 'No',
        trip.totalTravelTime,
        trip.errors.join('; ')
      ];
      
      // Add times for each time point
      sortedTimePoints.forEach(tp => {
        const entry = trip.scheduleEntries.find(e => e.timePointId === tp.id);
        if (entry) {
          row.push(entry.arrivalTime);
          row.push(entry.departureTime);
        } else {
          row.push('');
          row.push('');
        }
      });
      
      data.push(row);
    });
  });
  
  return data;
};

/**
 * Applies Excel formatting to worksheets
 */
const formatWorksheet = (worksheet: XLSX.WorkSheet): void => {
  // Get worksheet range
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  
  // Set column widths
  const columnWidths: XLSX.ColInfo[] = [];
  for (let col = 0; col <= range.e.c; col++) {
    columnWidths.push({ wch: 15 });
  }
  worksheet['!cols'] = columnWidths;
  
  // Set row heights for headers
  worksheet['!rows'] = [
    { hpt: 20 }, // First row height
  ];
};

/**
 * Main export function for complete summary schedule
 */
export const exportSummaryScheduleToExcel = (
  summaryDisplayData: SummaryDisplayData,
  calculationResults: CalculationResults,
  options: Partial<ExcelExportOptions> = {}
): ExcelExportResult => {
  try {
    const exportOptions: ExcelExportOptions = {
      includeMetadata: true,
      includeStatistics: true,
      includeRawData: false,
      timeFormat: '24h',
      routeName: 'Schedule',
      ...options
    };
    
    const workbook = createWorkbook();
    
    // Add schedule sheets for each day type
    const dayTypes = ['weekday', 'saturday', 'sunday'] as const;
    dayTypes.forEach(dayType => {
      const scheduleData = summaryDisplayData.schedules[dayType];
      const sheetData = formatScheduleForExport(scheduleData, dayType, exportOptions.timeFormat);
      
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      formatWorksheet(worksheet);
      
      XLSX.utils.book_append_sheet(workbook, worksheet, dayType.charAt(0).toUpperCase() + dayType.slice(1));
    });
    
    // Add metadata sheet
    if (exportOptions.includeMetadata) {
      const metadataData = createMetadataSheet(summaryDisplayData.routeInfo as any, calculationResults);
      const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
      formatWorksheet(metadataSheet);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    }
    
    // Add statistics sheet
    if (exportOptions.includeStatistics) {
      const statsData = createStatisticsSheet(summaryDisplayData.statistics);
      const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
      formatWorksheet(statsSheet);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');
    }
    
    // Add raw data sheet
    if (exportOptions.includeRawData) {
      const rawData = createRawDataSheet(calculationResults, summaryDisplayData.timePoints);
      const rawSheet = XLSX.utils.aoa_to_sheet(rawData);
      formatWorksheet(rawSheet);
      XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Data');
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const suffix = exportOptions.filenameSuffix ? `_${exportOptions.filenameSuffix}` : '';
    const filename = `${exportOptions.routeName}_Schedule_${timestamp}${suffix}.xlsx`;
    
    // Create blob
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    return {
      filename,
      blob,
      success: true
    };
    
  } catch (error) {
    return {
      filename: '',
      blob: new Blob(),
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
};

/**
 * Export single day type schedule to Excel
 */
export const exportDayTypeScheduleToExcel = (
  scheduleData: FormattedScheduleData,
  dayType: string,
  routeName: string,
  timeFormat: '12h' | '24h' = '24h'
): ExcelExportResult => {
  try {
    const workbook = createWorkbook();
    const sheetData = formatScheduleForExport(scheduleData, dayType, timeFormat);
    
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    formatWorksheet(worksheet);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, dayType);
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${routeName}_${dayType}_${timestamp}.xlsx`;
    
    // Create blob
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    return {
      filename,
      blob,
      success: true
    };
    
  } catch (error) {
    return {
      filename: '',
      blob: new Blob(),
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
};

/**
 * Downloads a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Utility function to export and download Excel file
 */
export const exportAndDownload = (
  summaryDisplayData: SummaryDisplayData,
  calculationResults: CalculationResults,
  options: Partial<ExcelExportOptions> = {}
): boolean => {
  const result = exportSummaryScheduleToExcel(summaryDisplayData, calculationResults, options);
  
  if (result.success) {
    downloadBlob(result.blob, result.filename);
    return true;
  } else {
    console.error('Export failed:', result.error);
    return false;
  }
};
/**
 * Export Templates and Formatting Utilities
 * Comprehensive formatting logic for different export templates
 */

import * as XLSX from 'xlsx';
import { 
  ExportDataBundle, 
  ExportTemplate, 
  ExportOptions,
  ExportField 
} from '../types/export';
import { SummarySchedule, TimePoint, ServiceBand } from '../types/schedule';
import { sanitizeText } from '../utils/inputSanitizer';

/**
 * GTFS (General Transit Feed Specification) Formatter
 */
export class GTFSFormatter {
  static formatScheduleData(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'trip_id',
      'route_id', 
      'service_id',
      'trip_headsign',
      'direction_id',
      'block_id',
      'shape_id'
    ];

    const rows: any[][] = [];

    if (dataBundle.summarySchedule) {
      const schedule = dataBundle.summarySchedule;
      let tripCounter = 1;

      // Process each day type
      ['weekday', 'saturday', 'sunday'].forEach(dayType => {
        const trips = (schedule as any)[dayType] || [];
        
        trips.forEach((trip: any, index: number) => {
          const blockId = Math.ceil(tripCounter / 3); // 3 trips per block
          
          rows.push([
            `trip_${tripCounter}`,
            schedule.routeId || 'route_001',
            dayType,
            schedule.routeName || 'Main Route',
            schedule.direction === 'outbound' ? '0' : '1',
            `block_${blockId}`,
            `shape_${schedule.routeId || '001'}`
          ]);
          
          tripCounter++;
        });
      });
    }

    return { headers, rows };
  }

  static formatStopTimes(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'trip_id',
      'arrival_time',
      'departure_time', 
      'stop_id',
      'stop_sequence',
      'pickup_type',
      'drop_off_type'
    ];

    const rows: any[][] = [];

    if (dataBundle.summarySchedule) {
      const schedule = dataBundle.summarySchedule;
      let tripCounter = 1;

      ['weekday', 'saturday', 'sunday'].forEach(dayType => {
        const trips = (schedule as any)[dayType] || [];
        
        trips.forEach((trip: any) => {
          schedule.timePoints.forEach((timePoint: TimePoint, stopSequence: number) => {
            // Generate sample times (this would be from actual trip data)
            const baseMinutes = 360 + (tripCounter - 1) * 30; // Start at 6:00 AM
            const stopMinutes = baseMinutes + (stopSequence * 5);
            const timeStr = this.minutesToGTFSTime(stopMinutes);
            
            rows.push([
              `trip_${tripCounter}`,
              timeStr, // arrival_time
              timeStr, // departure_time (same for most stops)
              `stop_${777 + stopSequence}`, // stop_id
              stopSequence + 1, // stop_sequence (1-based)
              0, // pickup_type (0 = regularly scheduled)
              0  // drop_off_type (0 = regularly scheduled)
            ]);
          });
          
          tripCounter++;
        });
      });
    }

    return { headers, rows };
  }

  private static minutesToGTFSTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  }
}

/**
 * Operational Schedule Formatter
 * Driver and dispatcher friendly format
 */
export class OperationalFormatter {
  static formatDriverSchedule(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Block #',
      'Trip #',
      'Day Type',
      'Service Period',
      'Depart Time'
    ];

    // Add timepoint headers
    if (dataBundle.summarySchedule?.timePoints) {
      dataBundle.summarySchedule.timePoints.forEach(tp => {
        headers.push(tp.name);
      });
    }

    headers.push('Recovery Time', 'Cycle Time', 'Notes');

    const rows: any[][] = [];

    if (dataBundle.summarySchedule) {
      const schedule = dataBundle.summarySchedule;
      let tripCounter = 1;

      ['weekday', 'saturday', 'sunday'].forEach(dayType => {
        const trips = (schedule as any)[dayType] || [];
        
        trips.forEach((trip: any, index: number) => {
          const blockId = Math.ceil(tripCounter / 3);
          const servicePeriod = this.getServicePeriod(trip[0] || '06:00');
          
          const row = [
            blockId,
            tripCounter,
            dayType.charAt(0).toUpperCase() + dayType.slice(1),
            servicePeriod,
            trip[0] || '06:00'
          ];

          // Add timepoint times
          schedule.timePoints.forEach((_: TimePoint, idx: number) => {
            row.push(trip[idx] || '');
          });

          // Add operational data
          row.push('2 min', '45 min', ''); // Recovery, Cycle, Notes

          rows.push(row);
          tripCounter++;
        });
      });
    }

    return { headers, rows };
  }

  static formatDispatcherView(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Time Slot',
      'Block 1',
      'Block 2', 
      'Block 3',
      'Block 4',
      'Block 5',
      'Active Buses',
      'Notes'
    ];

    const rows: any[][] = [];

    // Generate time slots from 5:00 AM to 11:00 PM every 30 minutes
    for (let hour = 5; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const row = [timeSlot, '', '', '', '', '', '0', ''];
        rows.push(row);
      }
    }

    return { headers, rows };
  }

  private static getServicePeriod(timeStr: string): string {
    if (!timeStr) return 'Morning';
    
    const hour = parseInt(timeStr.split(':')[0]);
    
    if (hour < 6) return 'Early Morning';
    if (hour < 9) return 'Morning Rush';
    if (hour < 15) return 'Midday';
    if (hour < 18) return 'Afternoon Rush';
    if (hour < 21) return 'Evening';
    return 'Late Evening';
  }
}

/**
 * Analysis Data Formatter
 * For route planning and technical analysis
 */
export class AnalysisFormatter {
  static formatTravelTimeAnalysis(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Segment',
      'From Stop',
      'To Stop',
      'Distance (mi)',
      'Travel Time P25 (min)',
      'Travel Time P50 (min)',
      'Travel Time P75 (min)',
      'Travel Time P90 (min)',
      'Scheduled Time (min)',
      'Buffer Time (min)',
      'Reliability Score'
    ];

    const rows: any[][] = [];

    if (dataBundle.timepointsAnalysis?.timePoints) {
      const timePoints = dataBundle.timepointsAnalysis.timePoints;
      
      for (let i = 0; i < timePoints.length - 1; i++) {
        const fromStop = timePoints[i];
        const toStop = timePoints[i + 1];
        
        // Generate sample data (would be from actual analysis)
        rows.push([
          `Segment ${i + 1}`,
          fromStop.name,
          toStop.name,
          '0.8', // Sample distance
          '3.2', // P25 travel time
          '4.1', // P50 travel time  
          '5.3', // P75 travel time
          '6.8', // P90 travel time
          '5.0', // Scheduled time
          '0.7', // Buffer time
          '87%'  // Reliability score
        ]);
      }
    }

    return { headers, rows };
  }

  static formatServiceBandAnalysis(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Service Band',
      'Time Period',
      'Color Code',
      'Travel Time (min)',
      'Recovery Time (min)',
      'Total Time (min)',
      'Frequency (trips)',
      'Utilization (%)'
    ];

    const rows: any[][] = [];

    if (dataBundle.timepointsAnalysis?.serviceBands) {
      dataBundle.timepointsAnalysis.serviceBands.forEach((band: ServiceBand) => {
        rows.push([
          band.name,
          `${band.startTime || '00:00'} - ${band.endTime || '23:59'}`,
          band.color || '#2196F3',
          band.totalMinutes?.toString() || '0',
          '2.0', // Sample recovery time
          ((band.totalMinutes || 0) + 2.0).toString(),
          '12', // Sample frequency
          '85%' // Sample utilization
        ]);
      });
    }

    return { headers, rows };
  }

  static formatOutlierAnalysis(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Outlier ID',
      'Time Period', 
      'Segment',
      'Observed Time (min)',
      'Expected Time (min)',
      'Deviation (%)',
      'Severity',
      'Possible Cause',
      'Recommendation'
    ];

    const rows: any[][] = [];

    if (dataBundle.timepointsAnalysis?.outliers) {
      dataBundle.timepointsAnalysis.outliers.forEach((outlier: any, index: number) => {
        rows.push([
          `OUT_${String(index + 1).padStart(3, '0')}`,
          outlier.timePeriod || 'Unknown',
          outlier.segment || 'Segment 1',
          outlier.observedTime || '0',
          outlier.expectedTime || '0',
          outlier.deviation || '0%',
          outlier.severity || 'Medium',
          outlier.possibleCause || 'Traffic congestion',
          outlier.recommendation || 'Increase recovery time'
        ]);
      });
    }

    return { headers, rows };
  }
}

/**
 * Management Report Formatter
 * Executive summary and KPIs
 */
export class ManagementFormatter {
  static formatExecutiveSummary(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Metric',
      'Weekday',
      'Saturday', 
      'Sunday',
      'Total/Average',
      'Target',
      'Status'
    ];

    const rows: any[][] = [];

    // Key performance indicators
    const metrics = [
      {
        name: 'Total Daily Trips',
        weekday: this.getTripCount(dataBundle, 'weekday'),
        saturday: this.getTripCount(dataBundle, 'saturday'),
        sunday: this.getTripCount(dataBundle, 'sunday'),
        target: 'Variable',
        status: '✓'
      },
      {
        name: 'Service Hours',
        weekday: '16.5',
        saturday: '14.0', 
        sunday: '12.0',
        target: '15.0',
        status: '✓'
      },
      {
        name: 'Average Frequency (min)',
        weekday: '30',
        saturday: '45',
        sunday: '60',
        target: '≤45',
        status: '⚠'
      },
      {
        name: 'On-Time Performance',
        weekday: '87%',
        saturday: '91%',
        sunday: '94%',
        target: '≥85%',
        status: '✓'
      },
      {
        name: 'Schedule Efficiency',
        weekday: '82%',
        saturday: '88%',
        sunday: '90%',
        target: '≥80%',
        status: '✓'
      }
    ];

    metrics.forEach(metric => {
      const total = metric.name.includes('Percentage') || metric.name.includes('Performance') || metric.name.includes('Efficiency')
        ? ((parseFloat(metric.weekday.replace('%', '')) + parseFloat(metric.saturday.replace('%', '')) + parseFloat(metric.sunday.replace('%', ''))) / 3).toFixed(0) + '%'
        : 'Variable';

      rows.push([
        metric.name,
        metric.weekday,
        metric.saturday,
        metric.sunday,
        total,
        metric.target,
        metric.status
      ]);
    });

    return { headers, rows };
  }

  static formatResourceUtilization(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Resource Type',
      'Peak Requirement',
      'Off-Peak Requirement',
      'Total Resources',
      'Utilization Rate',
      'Cost per Hour',
      'Daily Cost'
    ];

    const rows: any[][] = [];

    if (dataBundle.blockConfiguration) {
      const config = dataBundle.blockConfiguration;
      
      rows.push([
        'Buses',
        config.numberOfBuses.toString(),
        Math.ceil(config.numberOfBuses * 0.7).toString(),
        config.numberOfBuses.toString(),
        '85%',
        '$45.00',
        `$${(config.numberOfBuses * 45 * 16).toFixed(2)}`
      ]);

      rows.push([
        'Drivers',
        (config.numberOfBuses + 2).toString(), // Spare drivers
        config.numberOfBuses.toString(),
        (config.numberOfBuses + 2).toString(),
        '92%',
        '$28.50',
        `$${((config.numberOfBuses + 2) * 28.5 * 8).toFixed(2)}`
      ]);
    }

    return { headers, rows };
  }

  private static getTripCount(dataBundle: ExportDataBundle, dayType: string): string {
    if (dataBundle.summarySchedule) {
      const schedule = dataBundle.summarySchedule;
      const trips = (schedule as any)[dayType];
      return trips ? trips.length.toString() : '0';
    }
    return '0';
  }
}

/**
 * Excel Workbook Builder
 * Creates professional multi-sheet Excel workbooks
 */
export class ExcelWorkbookBuilder {
  static createProfessionalWorkbook(
    template: ExportTemplate,
    dataBundle: ExportDataBundle,
    options: ExportOptions
  ): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    switch (template.id) {
      case 'excel-professional-schedule':
        return this.buildProfessionalSchedule(workbook, dataBundle, options);
      case 'excel-management-report':
        return this.buildManagementReport(workbook, dataBundle, options);
      case 'excel-technical-analysis':
        return this.buildTechnicalAnalysis(workbook, dataBundle, options);
      default:
        return this.buildGenericWorkbook(workbook, dataBundle, options);
    }
  }

  private static buildProfessionalSchedule(
    workbook: XLSX.WorkBook,
    dataBundle: ExportDataBundle,
    options: ExportOptions
  ): XLSX.WorkBook {
    // Main Schedule Sheet
    const scheduleData = OperationalFormatter.formatDriverSchedule(dataBundle);
    const scheduleSheet = XLSX.utils.aoa_to_sheet([scheduleData.headers, ...scheduleData.rows]);
    this.formatWorksheet(scheduleSheet, 'schedule');
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');

    // Block Summary Sheet
    if (dataBundle.blockConfiguration) {
      const blockData = this.createBlockSummary(dataBundle);
      const blockSheet = XLSX.utils.aoa_to_sheet([blockData.headers, ...blockData.rows]);
      this.formatWorksheet(blockSheet, 'summary');
      XLSX.utils.book_append_sheet(workbook, blockSheet, 'Block Summary');
    }

    // Statistics Sheet
    const statsData = ManagementFormatter.formatExecutiveSummary(dataBundle);
    const statsSheet = XLSX.utils.aoa_to_sheet([statsData.headers, ...statsData.rows]);
    this.formatWorksheet(statsSheet, 'stats');
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

    return workbook;
  }

  private static buildManagementReport(
    workbook: XLSX.WorkBook,
    dataBundle: ExportDataBundle,
    options: ExportOptions
  ): XLSX.WorkBook {
    // Executive Summary
    const summaryData = ManagementFormatter.formatExecutiveSummary(dataBundle);
    const summarySheet = XLSX.utils.aoa_to_sheet([summaryData.headers, ...summaryData.rows]);
    this.formatWorksheet(summarySheet, 'management');
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

    // Resource Utilization
    const resourceData = ManagementFormatter.formatResourceUtilization(dataBundle);
    const resourceSheet = XLSX.utils.aoa_to_sheet([resourceData.headers, ...resourceData.rows]);
    this.formatWorksheet(resourceSheet, 'resources');
    XLSX.utils.book_append_sheet(workbook, resourceSheet, 'Resources');

    return workbook;
  }

  private static buildTechnicalAnalysis(
    workbook: XLSX.WorkBook,
    dataBundle: ExportDataBundle,
    options: ExportOptions
  ): XLSX.WorkBook {
    // Travel Time Analysis
    const travelData = AnalysisFormatter.formatTravelTimeAnalysis(dataBundle);
    const travelSheet = XLSX.utils.aoa_to_sheet([travelData.headers, ...travelData.rows]);
    this.formatWorksheet(travelSheet, 'analysis');
    XLSX.utils.book_append_sheet(workbook, travelSheet, 'Travel Times');

    // Service Band Analysis
    const bandData = AnalysisFormatter.formatServiceBandAnalysis(dataBundle);
    const bandSheet = XLSX.utils.aoa_to_sheet([bandData.headers, ...bandData.rows]);
    this.formatWorksheet(bandSheet, 'analysis');
    XLSX.utils.book_append_sheet(workbook, bandSheet, 'Service Bands');

    // Outlier Analysis
    const outlierData = AnalysisFormatter.formatOutlierAnalysis(dataBundle);
    const outlierSheet = XLSX.utils.aoa_to_sheet([outlierData.headers, ...outlierData.rows]);
    this.formatWorksheet(outlierSheet, 'outliers');
    XLSX.utils.book_append_sheet(workbook, outlierSheet, 'Outliers');

    return workbook;
  }

  private static buildGenericWorkbook(
    workbook: XLSX.WorkBook,
    dataBundle: ExportDataBundle,
    options: ExportOptions
  ): XLSX.WorkBook {
    // Generic schedule export
    if (dataBundle.summarySchedule) {
      const scheduleData = OperationalFormatter.formatDriverSchedule(dataBundle);
      const scheduleSheet = XLSX.utils.aoa_to_sheet([scheduleData.headers, ...scheduleData.rows]);
      this.formatWorksheet(scheduleSheet, 'schedule');
      XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');
    }

    return workbook;
  }

  private static createBlockSummary(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers = [
      'Block ID',
      'Number of Trips',
      'Start Time',
      'End Time',
      'Total Hours',
      'Break Time',
      'Driver Hours'
    ];

    const rows: any[][] = [];

    if (dataBundle.blockConfiguration) {
      const config = dataBundle.blockConfiguration;
      
      for (let i = 1; i <= config.numberOfBuses; i++) {
        rows.push([
          i,
          Math.ceil(12 / config.numberOfBuses), // Distribute trips evenly
          '05:30',
          '21:30',
          '16.0',
          '1.5',
          '8.0'
        ]);
      }
    }

    return { headers, rows };
  }

  private static formatWorksheet(worksheet: XLSX.WorkSheet, type: string): void {
    // Set column widths based on content type
    let columnWidths: XLSX.ColInfo[];

    switch (type) {
      case 'schedule':
        columnWidths = [
          { wch: 8 },  // Block
          { wch: 8 },  // Trip
          { wch: 12 }, // Day Type
          { wch: 15 }, // Service Period
          { wch: 12 }, // Times (repeated for each timepoint)
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 10 }, // Recovery
          { wch: 10 }, // Cycle
          { wch: 20 }  // Notes
        ];
        break;
      case 'management':
        columnWidths = [
          { wch: 25 }, // Metric
          { wch: 12 }, // Weekday
          { wch: 12 }, // Saturday
          { wch: 12 }, // Sunday
          { wch: 15 }, // Total/Average
          { wch: 12 }, // Target
          { wch: 8 }   // Status
        ];
        break;
      case 'analysis':
        columnWidths = Array(10).fill({ wch: 15 });
        break;
      default:
        columnWidths = Array(15).fill({ wch: 12 });
    }

    worksheet['!cols'] = columnWidths;

    // Set row heights
    worksheet['!rows'] = [
      { hpt: 25 } // Header row
    ];
  }
}

/**
 * CSV Formatter Utilities
 */
export class CSVFormatter {
  static formatForTemplate(
    template: ExportTemplate,
    dataBundle: ExportDataBundle
  ): { headers: string[], rows: any[][] } {
    switch (template.id) {
      case 'csv-gtfs-format':
        return GTFSFormatter.formatScheduleData(dataBundle);
      case 'csv-operational-format':
        return OperationalFormatter.formatDriverSchedule(dataBundle);
      case 'csv-analysis-format':
        return AnalysisFormatter.formatTravelTimeAnalysis(dataBundle);
      default:
        return OperationalFormatter.formatDriverSchedule(dataBundle);
    }
  }

  static sanitizeCSVContent(headers: string[], rows: any[][]): { headers: string[], rows: any[][] } {
    // Sanitize headers
    const sanitizedHeaders = headers.map(header => sanitizeText(header));

    // Sanitize row data
    const sanitizedRows = rows.map(row => 
      row.map(cell => {
        if (typeof cell === 'string') {
          return sanitizeText(cell).replace(/"/g, '""'); // Escape quotes for CSV
        }
        return cell;
      })
    );

    return { headers: sanitizedHeaders, rows: sanitizedRows };
  }
}
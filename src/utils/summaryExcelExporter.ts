import * as XLSX from 'xlsx';
import { SummarySchedule } from '../types/schedule';

export interface ExcelExportOptions {
  filename: string;
  includeMetrics: boolean;
  includeTimePoints: boolean;
  format: 'xlsx' | 'csv';
}

class SummaryExcelExporter {
  /**
   * Export summary schedule schedule to Excel format matching the example structure
   */
  exportSummarySchedule(
    schedule: SummarySchedule, 
    options: ExcelExportOptions
  ): Blob {
    const workbook = XLSX.utils.book_new();
    
    // Create Summary sheet in Excel format
    const summarySheet = this.createSummarySheet(schedule);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    if (options.includeMetrics) {
      const metricsSheet = this.createMetricsSheet(schedule);
      XLSX.utils.book_append_sheet(workbook, metricsSheet, 'Operational Metrics');
    }
    
    if (options.includeTimePoints) {
      const timePointsSheet = this.createTimePointsSheet(schedule);
      XLSX.utils.book_append_sheet(workbook, timePointsSheet, 'Time Points');
    }
    
    // Export as Excel or CSV
    if (options.format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(summarySheet);
      return new Blob([csvContent], { type: 'text/csv' });
    } else {
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'array',
        compression: true
      });
      return new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
    }
  }

  /**
   * Create the main Summary sheet matching the example Excel format
   */
  private createSummarySheet(schedule: SummarySchedule): XLSX.WorkSheet {
    const timePoints = schedule.timePoints;
    const dayType = this.getDayType(schedule);
    
    // Create worksheet schedule array
    const wsData: any[][] = [];
    
    // Row 1: Day type
    const row1 = [dayType.charAt(0).toUpperCase() + dayType.slice(1)];
    while (row1.length < timePoints.length + 5) row1.push('');
    wsData.push(row1);
    
    // Row 2: Route information
    const row2 = ['', '', '', '', '', schedule.routeName];
    while (row2.length < timePoints.length + 5) row2.push('');
    wsData.push(row2);
    
    // Row 3: Direction indicators
    const row3 = ['', '', '', '', '', 'DEPART'];
    for (let i = 1; i < timePoints.length - 1; i++) {
      row3.push('');
    }
    if (timePoints.length > 1) {
      row3.push('ARRIVE');
    }
    while (row3.length < timePoints.length + 5) row3.push('');
    wsData.push(row3);
    
    // Row 4: Time point names
    const row4 = ['', '', '', 'Block', 'Stop Name'];
    timePoints.forEach(tp => row4.push(tp.name));
    wsData.push(row4);
    
    // Row 5: Stop IDs
    const row5 = ['', '', '', '', 'Stop ID'];
    timePoints.forEach((tp, index) => row5.push((777 + index).toString())); // Mock stop IDs as strings
    wsData.push(row5);
    
    // Get the appropriate schedule matrix based on day type
    const scheduleMatrix = this.getScheduleMatrix(schedule, dayType);
    
    // Trip schedule rows
    for (let tripIndex = 0; tripIndex < scheduleMatrix.length; tripIndex++) {
      const tripTimes = scheduleMatrix[tripIndex];
      const servicePeriod = this.getServicePeriod(tripTimes[0]);
      const blockId = Math.ceil((tripIndex + 1) / 3); // 3 trips per block
      
      const tripRow = [
        '', // Empty column
        blockId,
        servicePeriod,
        tripIndex + 1,
        '' // Empty stop name column
      ];
      
      // Add trip times (convert to Excel decimal format)
      tripTimes.forEach((timeStr: string) => {
        const decimalTime = this.timeStringToExcelDecimal(timeStr);
        tripRow.push(decimalTime);
      });
      
      // Add recovery and cycle time columns
      tripRow.push(2); // Recovery indicator
      tripRow.push(''); // Additional columns as needed
      
      wsData.push(tripRow);
    }
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    const colWidths = [
      { wch: 5 },  // A
      { wch: 8 },  // B - Block
      { wch: 15 }, // C - Service Period  
      { wch: 8 },  // D - Trip Number
      { wch: 20 }, // E - Stop Name
    ];
    
    // Add widths for time point columns
    timePoints.forEach(() => {
      colWidths.push({ wch: 12 });
    });
    
    ws['!cols'] = colWidths;
    
    // Format time cells
    this.formatTimeCells(ws, wsData.length, timePoints.length);
    
    return ws;
  }

  /**
   * Get the day type from schedule
   */
  private getDayType(schedule: any): string {
    if (schedule.weekday.length > 0) return 'weekday';
    if (schedule.saturday.length > 0) return 'saturday';
    if (schedule.sunday.length > 0) return 'sunday';
    return 'weekday'; // Default
  }

  /**
   * Get the appropriate schedule matrix based on day type
   */
  private getScheduleMatrix(schedule: any, dayType: string) {
    switch (dayType) {
      case 'saturday': return schedule.saturday;
      case 'sunday': return schedule.sunday;
      default: return schedule.weekday;
    }
  }

  /**
   * Create operational metrics sheet
   */
  private createMetricsSheet(schedule: SummarySchedule): XLSX.WorkSheet {
    const dayType = this.getDayType(schedule);
    const totalTrips = schedule.metadata.weekdayTrips + schedule.metadata.saturdayTrips + schedule.metadata.sundayTrips;
    
    const metricsData = [
      ['Operational Metrics Summary'],
      [''],
      ['Route Name:', schedule.routeName],
      ['Day Type:', dayType],
      ['Direction:', schedule.direction],
      [''],
      ['Service Metrics:'],
      ['Total Trips:', totalTrips],
      ['Service Span:', `${schedule.metadata.operatingHours?.start || 'N/A'} - ${schedule.metadata.operatingHours?.end || 'N/A'}`],
      ['Frequency (min):', schedule.metadata.frequency || 'N/A'],
      [''],
      ['Schedule Metadata:'],
      ['Generated At:', new Date().toISOString()],
      ['Source:', 'Travel Time Analysis'],
      ['Frequency (min):', schedule.metadata?.frequency || 30],
      ['Operating Hours:', `${schedule.metadata?.operatingHours?.start || ''} - ${schedule.metadata?.operatingHours?.end || ''}`]
    ];
    
    return XLSX.utils.aoa_to_sheet(metricsData);
  }

  /**
   * Create time points reference sheet
   */
  private createTimePointsSheet(schedule: SummarySchedule): XLSX.WorkSheet {
    const timePoints = schedule.timePoints;
    
    const timePointData = [
      ['Time Points Reference'],
      [''],
      ['Sequence', 'Stop ID', 'Stop Name', 'Is Time Point']
    ];
    
    timePoints.forEach((tp: any, index: number) => {
      timePointData.push([
        tp.sequence + 1,
        777 + index, // Mock stop ID
        tp.name,
        'Yes' // All are time points in this system
      ]);
    });
    
    return XLSX.utils.aoa_to_sheet(timePointData);
  }

  /**
   * Determine service period based on time
   */
  private getServicePeriod(timeStr: string): string {
    if (!timeStr) return 'Morning';
    
    const hour = parseInt(timeStr.split(':')[0]);
    
    if (hour < 9) return 'Early Morning';
    if (hour < 15) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  }

  /**
   * Convert time string to Excel decimal format
   */
  private timeStringToExcelDecimal(timeStr: string): number {
    if (!timeStr) return 0;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60 + minutes) / (24 * 60); // Convert to fraction of day
  }

  /**
   * Format time cells in the worksheet
   */
  private formatTimeCells(ws: XLSX.WorkSheet, numRows: number, numTimePoints: number): void {
    // Define time format for Excel
    const timeFormat = 'h:mm AM/PM';
    
    // Format time columns (starting from column F, which is index 5)
    for (let row = 6; row <= numRows; row++) { // Start from schedule rows (skip headers)
      for (let col = 5; col < 5 + numTimePoints; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col });
        if (ws[cellAddress]) {
          ws[cellAddress].z = timeFormat;
          ws[cellAddress].t = 'n'; // Ensure it's treated as number
        }
      }
    }
  }

  /**
   * Download the exported file
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const summaryExcelExporter = new SummaryExcelExporter();
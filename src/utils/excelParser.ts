import { ExcelFormatDetector, DetectedFormat } from './formatDetector';
import { TimePoint, TravelTime } from '../types/schedule';
import { sanitizeTimePointName, sanitizeTimeValue, containsAttackPatterns } from './inputSanitizer';

export interface ParsedExcelData {
  timePoints: TimePoint[];
  travelTimes: TravelTime[];
  format: DetectedFormat;
  metadata: {
    fileName?: string;
    totalRows: number;
    processedRows: number;
    skippedRows: number;
  };
}

export interface ExcelParserOptions {
  strictValidation?: boolean;
  skipEmptyRows?: boolean;
  maxRowsToProcess?: number;
  allowPartialData?: boolean;
  maxCellsToProcess?: number;
  maxMemoryUsage?: number; // in bytes
  enableCircuitBreaker?: boolean;
  processingTimeout?: number; // in milliseconds
}

const DEFAULT_PARSER_OPTIONS: ExcelParserOptions = {
  strictValidation: false,
  skipEmptyRows: true,
  maxRowsToProcess: 500, // Reduced for security
  allowPartialData: true,
  maxCellsToProcess: 10000, // Prevent memory exhaustion
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB max memory usage
  enableCircuitBreaker: true,
  processingTimeout: 30000 // 30 seconds
};

// Circuit breaker for memory protection
class MemoryCircuitBreaker {
  private failures: number = 0;
  private lastFailTime: number = 0;
  private readonly maxFailures: number = 3;
  private readonly resetTimeout: number = 60000; // 1 minute

  canProcess(): boolean {
    const now = Date.now();
    
    // Reset circuit breaker after timeout
    if (now - this.lastFailTime > this.resetTimeout) {
      this.failures = 0;
    }

    return this.failures < this.maxFailures;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
  }

  recordSuccess(): void {
    this.failures = 0;
  }
}

// Memory usage monitor
class MemoryMonitor {
  private startMemory: number = 0;
  private maxAllowed: number;

  constructor(maxMemoryUsage: number) {
    this.maxAllowed = maxMemoryUsage;
    this.startMemory = this.getCurrentMemoryUsage();
  }

  private getCurrentMemoryUsage(): number {
    // Estimate memory usage based on available metrics
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return memory?.usedJSHeapSize || 0;
    }
    // Fallback: estimate based on processed data size
    return 0;
  }

  checkMemoryUsage(): boolean {
    const currentUsage = this.getCurrentMemoryUsage();
    const usedMemory = currentUsage - this.startMemory;
    return usedMemory < this.maxAllowed;
  }

  getMemoryUsage(): number {
    const currentUsage = this.getCurrentMemoryUsage();
    return currentUsage - this.startMemory;
  }
}

export class ExcelParser {
  private data: any[][];
  private options: ExcelParserOptions;
  private circuitBreaker: MemoryCircuitBreaker;
  private memoryMonitor: MemoryMonitor | null = null;
  private processedCells: number = 0;
  private startTime: number = 0;

  constructor(data: any[][], options: Partial<ExcelParserOptions> = {}) {
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
    this.circuitBreaker = new MemoryCircuitBreaker();
    
    // Validate data size before processing
    this.validateDataSize(data);
    this.data = data;
  }

  private validateDataSize(data: any[][]): void {
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format');
    }

    const totalRows = data.length;
    if (totalRows > (this.options.maxRowsToProcess || DEFAULT_PARSER_OPTIONS.maxRowsToProcess!)) {
      throw new Error(`Excel file too large: ${totalRows} rows exceeds maximum of ${this.options.maxRowsToProcess}`);
    }

    // Estimate total cells
    let estimatedCells = 0;
    const sampleSize = Math.min(10, totalRows);
    for (let i = 0; i < sampleSize; i++) {
      if (data[i] && Array.isArray(data[i])) {
        estimatedCells += data[i].length;
      }
    }

    const avgCellsPerRow = sampleSize > 0 ? estimatedCells / sampleSize : 0;
    const totalEstimatedCells = totalRows * avgCellsPerRow;

    if (totalEstimatedCells > (this.options.maxCellsToProcess || DEFAULT_PARSER_OPTIONS.maxCellsToProcess!)) {
      throw new Error(`Excel file too large: estimated ${Math.round(totalEstimatedCells)} cells exceeds maximum of ${this.options.maxCellsToProcess}`);
    }
  }

  parseScheduleData(fileName?: string): ParsedExcelData {
    // Check circuit breaker
    if (this.options.enableCircuitBreaker && !this.circuitBreaker.canProcess()) {
      throw new Error('Parser temporarily unavailable due to previous failures. Please try again later.');
    }

    this.startTime = Date.now();
    this.processedCells = 0;
    this.memoryMonitor = new MemoryMonitor(this.options.maxMemoryUsage || DEFAULT_PARSER_OPTIONS.maxMemoryUsage!);

    try {
      return this.parseScheduleDataInternal(fileName);
    } catch (error) {
      if (this.options.enableCircuitBreaker) {
        this.circuitBreaker.recordFailure();
      }
      throw error;
    }
  }

  private parseScheduleDataInternal(fileName?: string): ParsedExcelData {
    const detector = new ExcelFormatDetector(this.data);
    const format = detector.detectFormat();

    if (format.errors.length > 0 && this.options.strictValidation) {
      throw new Error(`Format detection failed: ${format.errors.join(', ')}`);
    }

    const timePoints = this.extractTimePoints(format);
    
    // Check memory and timeout before processing travel times
    this.checkProcessingLimits();
    
    const travelTimes = this.extractTravelTimes(format, timePoints);
    
    // Record success if we made it this far
    if (this.options.enableCircuitBreaker) {
      this.circuitBreaker.recordSuccess();
    }

    let processedRows = 0;
    let skippedRows = 0;

    if (format.dataStartRow >= 0) {
      const maxRow = this.options.maxRowsToProcess 
        ? format.dataStartRow + this.options.maxRowsToProcess
        : this.data.length;

      for (let i = format.dataStartRow; i < Math.min(maxRow, this.data.length); i++) {
        // Check processing limits periodically
        if (i % 100 === 0) {
          this.checkProcessingLimits();
        }

        const row = this.data[i];
        if (!row || this.isEmptyRow(row)) {
          if (!this.options.skipEmptyRows) {
            skippedRows++;
          }
          continue;
        }
        
        // Count processed cells for memory monitoring
        this.processedCells += row.length || 0;
        processedRows++;
      }
    }

    return {
      timePoints,
      travelTimes,
      format,
      metadata: {
        fileName,
        totalRows: this.data.length,
        processedRows,
        skippedRows
      }
    };
  }

  private extractTimePoints(format: DetectedFormat): TimePoint[] {
    const timePoints: TimePoint[] = [];

    for (let i = 0; i < format.timePointColumns.length; i++) {
      const column = format.timePointColumns[i];
      const name = format.timePointNames[i] || `TimePoint_${column + 1}`;

      timePoints.push({
        id: `tp_${column}`,
        name: this.cleanTimePointName(name),
        sequence: i
      });
    }

    return timePoints;
  }

  private extractTravelTimes(format: DetectedFormat, timePoints: TimePoint[]): TravelTime[] {
    const travelTimes: TravelTime[] = [];

    if (format.dataStartRow < 0 || timePoints.length < 2) {
      return travelTimes;
    }

    const maxRow = this.options.maxRowsToProcess 
      ? format.dataStartRow + this.options.maxRowsToProcess
      : this.data.length;

    for (let row = format.dataStartRow; row < Math.min(maxRow, this.data.length); row++) {
      // Check processing limits every 50 rows
      if (row % 50 === 0) {
        this.checkProcessingLimits();
      }

      const rowData = this.data[row];
      if (!rowData || this.isEmptyRow(rowData)) {
        continue;
      }

      // Count processed cells
      this.processedCells += rowData.length || 0;

      const tripTimes = this.extractTripTimes(rowData, format);
      if (tripTimes.length < 2) {
        continue;
      }

      for (let i = 0; i < tripTimes.length - 1; i++) {
        const fromTime = tripTimes[i];
        const toTime = tripTimes[i + 1];

        if (fromTime.time && toTime.time) {
          const travelMinutes = this.calculateTravelTime(fromTime.time, toTime.time);
          
          if (travelMinutes > 0 && travelMinutes <= 120) {
            const existing = travelTimes.find(tt => 
              tt.fromTimePoint === fromTime.timePointId && 
              tt.toTimePoint === toTime.timePointId
            );

            if (existing) {
              this.updateTravelTime(existing, travelMinutes, fromTime.dayType || 'weekday');
            } else {
              travelTimes.push(this.createTravelTime(
                fromTime.timePointId,
                toTime.timePointId,
                travelMinutes,
                fromTime.dayType || 'weekday'
              ));
            }
          }
        }
      }
    }

    return travelTimes;
  }

  private extractTripTimes(rowData: any[], format: DetectedFormat): Array<{
    timePointId: string;
    time: string | null;
    dayType?: 'weekday' | 'saturday' | 'sunday';
  }> {
    const tripTimes: Array<{
      timePointId: string;
      time: string | null;
      dayType?: 'weekday' | 'saturday' | 'sunday';
    }> = [];

    for (let i = 0; i < format.timePointColumns.length; i++) {
      const col = format.timePointColumns[i];
      const cell = rowData[col];
      
      const timeValue = this.parseTimeValue(cell);
      const dayType = this.determineDayType(col, format);

      tripTimes.push({
        timePointId: `tp_${col}`,
        time: timeValue,
        dayType
      });
    }

    return tripTimes;
  }

  private parseTimeValue(cell: any): string | null {
    // Use the enhanced sanitizer for time values
    return sanitizeTimeValue(cell);
  }

  private determineDayType(column: number, format: DetectedFormat): 'weekday' | 'saturday' | 'sunday' {
    if (format.dayTypeColumns.saturday?.includes(column)) {
      return 'saturday';
    }
    if (format.dayTypeColumns.sunday?.includes(column)) {
      return 'sunday';
    }
    return 'weekday';
  }

  private calculateTravelTime(fromTime: string, toTime: string): number {
    const fromMinutes = this.timeToMinutes(fromTime);
    const toMinutes = this.timeToMinutes(toTime);
    
    if (fromMinutes === null || toMinutes === null) {
      return 0;
    }

    let diff = toMinutes - fromMinutes;
    
    if (diff < 0) {
      diff += 24 * 60;
    }

    return diff;
  }

  private timeToMinutes(time: string): number | null {
    const parts = time.split(':');
    if (parts.length < 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    return hours * 60 + minutes;
  }

  private updateTravelTime(travelTime: TravelTime, minutes: number, dayType: 'weekday' | 'saturday' | 'sunday'): void {
    const currentValue = travelTime[dayType];
    if (currentValue === 0 || currentValue > minutes) {
      travelTime[dayType] = minutes;
    }
  }

  private createTravelTime(
    fromTimePointId: string, 
    toTimePointId: string, 
    minutes: number, 
    dayType: 'weekday' | 'saturday' | 'sunday'
  ): TravelTime {
    const travelTime: TravelTime = {
      fromTimePoint: fromTimePointId,
      toTimePoint: toTimePointId,
      weekday: 0,
      saturday: 0,
      sunday: 0
    };

    travelTime[dayType] = minutes;
    return travelTime;
  }

  private cleanTimePointName(name: string): string {
    if (!name || typeof name !== 'string') {
      return 'Invalid_TimePoint';
    }

    // Check for attack patterns first
    if (containsAttackPatterns(name)) {
      console.warn('Suspicious input detected in time point name, using sanitized version');
      return 'Sanitized_TimePoint';
    }

    // Use the comprehensive sanitizer
    const sanitized = sanitizeTimePointName(name);
    
    // Fallback if sanitization results in empty string
    return sanitized || 'Empty_TimePoint';
  }

  private checkProcessingLimits(): void {
    // Check timeout
    if (this.options.processingTimeout) {
      const elapsed = Date.now() - this.startTime;
      if (elapsed > this.options.processingTimeout) {
        throw new Error('Processing timeout exceeded. File may be too complex.');
      }
    }

    // Check memory usage
    if (this.memoryMonitor && !this.memoryMonitor.checkMemoryUsage()) {
      throw new Error('Memory usage limit exceeded during processing.');
    }

    // Check processed cells limit
    if (this.processedCells > (this.options.maxCellsToProcess || DEFAULT_PARSER_OPTIONS.maxCellsToProcess!)) {
      throw new Error(`Processed cell limit exceeded: ${this.processedCells} cells`);
    }
  }

  private isEmptyRow(row: any[]): boolean {
    if (!row || !Array.isArray(row)) {
      return true;
    }

    // Limit row size check to prevent DoS
    const maxCellsToCheck = Math.min(row.length, 100);
    
    for (let i = 0; i < maxCellsToCheck; i++) {
      const cell = row[i];
      if (cell !== null && cell !== undefined && cell !== '' && 
          !(typeof cell === 'string' && cell.trim() === '')) {
        return false;
      }
    }
    
    return true;
  }
}
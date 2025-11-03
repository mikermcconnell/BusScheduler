export interface DetectedFormat {
  hasHeader: boolean;
  headerRow: number;
  timePointColumns: number[];
  timePointNames: string[];
  dataStartRow: number;
  timeFormat: 'HH:MM' | 'H:MM' | 'HH:MM:SS' | 'mixed' | 'unknown';
  dayTypeColumns: {
    weekday?: number[];
    saturday?: number[];
    sunday?: number[];
  };
  confidence: number;
  errors: string[];
  warnings: string[];
}

export interface FormatDetectionOptions {
  maxRowsToScan?: number;
  minTimePoints?: number;
  maxTimePoints?: number;
  allowMissingData?: boolean;
}

const DEFAULT_OPTIONS: FormatDetectionOptions = {
  maxRowsToScan: 100,
  minTimePoints: 2,
  maxTimePoints: 15,
  allowMissingData: true
};

export class ExcelFormatDetector {
  private data: any[][];
  private options: FormatDetectionOptions;

  constructor(data: any[][], options: Partial<FormatDetectionOptions> = {}) {
    this.data = data;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  detectFormat(): DetectedFormat {
    const result: DetectedFormat = {
      hasHeader: false,
      headerRow: -1,
      timePointColumns: [],
      timePointNames: [],
      dataStartRow: -1,
      timeFormat: 'unknown',
      dayTypeColumns: {},
      confidence: 0,
      errors: [],
      warnings: []
    };

    if (!this.data || this.data.length === 0) {
      result.errors.push('No data provided');
      return result;
    }

    try {
      this.detectHeader(result);
      this.detectTimePoints(result);
      this.detectTimeFormat(result);
      this.detectDayTypes(result);
      this.calculateConfidence(result);
    } catch (error) {
      result.errors.push(`Format detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private detectHeader(result: DetectedFormat): void {
    const scanRows = Math.min(5, this.data.length);
    
    for (let i = 0; i < scanRows; i++) {
      const row = this.data[i];
      if (!row || row.length === 0) continue;

      const nonEmptyCount = row.filter(cell => 
        cell !== null && cell !== undefined && cell !== ''
      ).length;

      if (nonEmptyCount >= (this.options.minTimePoints || 2)) {
        const hasTimePointNames = this.containsTimePointNames(row);
        
        if (hasTimePointNames) {
          result.hasHeader = true;
          result.headerRow = i;
          result.dataStartRow = i + 1;
          return;
        }
      }
    }

    result.dataStartRow = 0;
    result.warnings.push('No header row detected, assuming data starts at row 1');
  }

  private containsTimePointNames(row: any[]): boolean {
    let textCount = 0;
    let timeCount = 0;

    for (const cell of row) {
      if (cell === null || cell === undefined || cell === '') continue;
      
      const str = String(cell).trim();
      if (str.length === 0) continue;

      if (this.isTimeValue(str)) {
        timeCount++;
      } else if (isNaN(Number(str))) {
        textCount++;
      }
    }

    return textCount >= Math.max(2, timeCount);
  }

  private detectTimePoints(result: DetectedFormat): void {
    // For travel time CSV data, look for time period headers (Half-Hour row)
    let timePeriodsRow = -1;
    
    for (let i = 0; i < Math.min(10, this.data.length); i++) {
      const row = this.data[i];
      if (row && row[0] && String(row[0]).toLowerCase().includes('half-hour')) {
        timePeriodsRow = i;
        break;
      }
    }
    
    if (timePeriodsRow >= 0) {
      // This is travel time data - time periods are the columns
      const timePeriodsRowData = this.data[timePeriodsRow];
      for (let col = 1; col < timePeriodsRowData.length; col++) {
        const cell = timePeriodsRowData[col];
        if (cell !== null && cell !== undefined && cell !== '') {
          const timePeriod = String(cell).trim();
          if (this.looksLikeTimePeriod(timePeriod)) {
            result.timePointColumns.push(col);
            result.timePointNames.push(timePeriod);
          }
        }
      }
    } else if (result.hasHeader && result.headerRow >= 0) {
      // Traditional schedule data with time points as headers
      const headerRow = this.data[result.headerRow];
      
      for (let col = 0; col < headerRow.length; col++) {
        const cell = headerRow[col];
        if (cell !== null && cell !== undefined && cell !== '') {
          const name = String(cell).trim();
          if (name && this.looksLikeTimePoint(name)) {
            result.timePointColumns.push(col);
            result.timePointNames.push(name);
          }
        }
      }
    } else {
      // Fallback to looking for time values in columns
      for (let col = 0; col < (this.data[0]?.length || 0); col++) {
        let hasTimeValues = false;
        let totalValues = 0;

        const scanRows = Math.min(10, this.data.length);
        for (let row = result.dataStartRow; row < result.dataStartRow + scanRows; row++) {
          if (row >= this.data.length) break;
          
          const cell = this.data[row]?.[col];
          if (cell !== null && cell !== undefined && cell !== '') {
            totalValues++;
            if (this.isTimeValue(String(cell))) {
              hasTimeValues = true;
            }
          }
        }

        if (hasTimeValues && totalValues > 0) {
          result.timePointColumns.push(col);
          result.timePointNames.push(`TimePoint_${col + 1}`);
        }
      }
    }

    if (result.timePointColumns.length < (this.options.minTimePoints || 2)) {
      result.errors.push(`Found only ${result.timePointColumns.length} time points, minimum required is ${this.options.minTimePoints}`);
    }

    if (result.timePointColumns.length > (this.options.maxTimePoints || 15)) {
      result.warnings.push(`Found ${result.timePointColumns.length} time points, which is more than expected (${this.options.maxTimePoints})`);
    }
  }

  private looksLikeTimePoint(name: string): boolean {
    const timePointKeywords = [
      'stop', 'station', 'point', 'terminal', 'depot', 'plaza', 'center',
      'mall', 'hospital', 'school', 'university', 'college', 'library',
      'park', 'street', 'avenue', 'road', 'way', 'lane', 'drive', 'blvd'
    ];

    const lowerName = name.toLowerCase();
    
    return timePointKeywords.some(keyword => lowerName.includes(keyword)) ||
           /\d{1,4}\s*(st|nd|rd|th|street|ave|avenue|rd|road|way|lane|dr|drive|blvd|boulevard)/i.test(name) ||
           /^[A-Za-z\s&-]{3,}$/i.test(name);
  }

  private looksLikeTimePeriod(value: string): boolean {
    // Match patterns like "07:00 - 07:29", "08:30 - 08:59"
    return /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(value.trim());
  }

  private detectTimeFormat(result: DetectedFormat): void {
    const timeFormats = new Set<string>();
    
    const sampleSize = Math.min(20, this.data.length - result.dataStartRow);
    
    for (let row = result.dataStartRow; row < result.dataStartRow + sampleSize; row++) {
      if (row >= this.data.length) break;
      
      for (const col of result.timePointColumns) {
        const cell = this.data[row]?.[col];
        if (cell !== null && cell !== undefined && cell !== '') {
          const format = this.identifyTimeFormat(String(cell));
          if (format) {
            timeFormats.add(format);
          }
        }
      }
    }

    if (timeFormats.size === 0) {
      result.timeFormat = 'unknown';
      result.warnings.push('No recognizable time format detected');
    } else if (timeFormats.size === 1) {
      result.timeFormat = Array.from(timeFormats)[0] as DetectedFormat['timeFormat'];
    } else {
      result.timeFormat = 'mixed';
      result.warnings.push(`Multiple time formats detected: ${Array.from(timeFormats).join(', ')}`);
    }
  }

  private identifyTimeFormat(value: string): string | null {
    const trimmed = value.trim();
    
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
      return 'HH:MM:SS';
    }
    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return 'HH:MM';
    }
    if (/^\d{1}:\d{2}$/.test(trimmed)) {
      return 'H:MM';
    }
    
    return null;
  }

  private detectDayTypes(result: DetectedFormat): void {
    if (!result.hasHeader || result.headerRow < 0) {
      result.warnings.push('Cannot detect day types without header row');
      return;
    }

    const headerRow = this.data[result.headerRow];
    
    for (let col = 0; col < headerRow.length; col++) {
      const cell = headerRow[col];
      if (cell === null || cell === undefined || cell === '') continue;
      
      const name = String(cell).toLowerCase().trim();
      
      if (name.includes('weekday') || name.includes('monday') || name.includes('tuesday') || 
          name.includes('wednesday') || name.includes('thursday') || name.includes('friday')) {
        if (!result.dayTypeColumns.weekday) result.dayTypeColumns.weekday = [];
        result.dayTypeColumns.weekday.push(col);
      } else if (name.includes('saturday') || name.includes('sat')) {
        if (!result.dayTypeColumns.saturday) result.dayTypeColumns.saturday = [];
        result.dayTypeColumns.saturday.push(col);
      } else if (name.includes('sunday') || name.includes('sun')) {
        if (!result.dayTypeColumns.sunday) result.dayTypeColumns.sunday = [];
        result.dayTypeColumns.sunday.push(col);
      }
    }

    const totalDayColumns = 
      (result.dayTypeColumns.weekday?.length || 0) +
      (result.dayTypeColumns.saturday?.length || 0) +
      (result.dayTypeColumns.sunday?.length || 0);

    if (totalDayColumns === 0) {
      result.warnings.push('No day type columns detected');
    }
  }

  private calculateConfidence(result: DetectedFormat): void {
    let confidence = 0;

    if (result.errors.length === 0) {
      confidence += 30;
    }

    if (result.hasHeader) {
      confidence += 20;
    }

    if (result.timePointColumns.length >= (this.options.minTimePoints || 2)) {
      confidence += 25;
    }

    if (result.timeFormat !== 'unknown') {
      confidence += 15;
    }

    if (Object.keys(result.dayTypeColumns).length > 0) {
      confidence += 10;
    }

    confidence -= result.warnings.length * 5;
    confidence -= result.errors.length * 20;

    result.confidence = Math.max(0, Math.min(100, confidence));
  }

  private isTimeValue(value: string): boolean {
    const trimmed = value.trim();
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed);
  }
}
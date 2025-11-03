import { sanitizeText } from './inputSanitizer';
import { TripDurationAnalysis } from '../types/schedule';

export interface TimeSegment {
  fromLocation: string;
  toLocation: string;
  timeSlot: string; // e.g., "07:00 - 07:29"
  percentile25: number;
  percentile50: number;
  percentile80: number;
  percentile90: number;
}

export interface ParsedCsvData {
  segments: TimeSegment[];
  timePoints: string[];
  validationSummary: {
    totalSegments: number;
    validSegments: number;
    invalidSegments: number;
    timeSlots: number;
  };
  tripDurationAnalysis?: TripDurationAnalysis; // Optional for persisting outlier changes
}

export interface CsvParseResult {
  success: boolean;
  data?: ParsedCsvData;
  error?: string;
  warnings: string[];
}

const CSV_MAGIC_BYTES = [
  // Common CSV indicators (not strict magic bytes, but file signature patterns)
  0x22, // " (quoted field)
  0x2C, // , (comma)
  0x0D, 0x0A, // CRLF
] as const;

// Security constants for CSV processing
const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB limit for CSV files
const MAX_ROWS = 1000; // Limit number of rows to prevent memory exhaustion
const MAX_COLUMNS = 50; // Limit number of columns
const MAX_CELL_LENGTH = 1000; // Maximum length of individual cell content

export class CsvParser {
  private warnings: string[] = [];

  /**
   * Validates CSV file before processing
   */
  private async validateCsvFile(file: File): Promise<string | null> {
    // File size validation
    if (file.size > MAX_CSV_SIZE) {
      return `CSV file size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum allowed size of 10MB`;
    }

    if (file.size < 10) {
      return 'CSV file is too small or empty';
    }

    // File extension validation
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      return 'File must have .csv extension';
    }

    // Basic content validation
    try {
      const sample = await file.slice(0, 1024).text(); // Read first 1KB
      if (!sample.includes(',') && !sample.includes(';') && !sample.includes('\t')) {
        return 'File does not appear to contain CSV data (no delimiters found)';
      }
    } catch (error) {
      return 'Unable to read file content';
    }

    return null;
  }

  /**
   * Parses CSV content into structured data
   */
  private parseCsvContent(content: string): string[][] {
    const lines = content.split(/\r?\n/);
    const rows: string[][] = [];

    // Security: Limit number of rows
    if (lines.length > MAX_ROWS) {
      this.warnings.push(`CSV contains ${lines.length} rows, processing limited to ${MAX_ROWS} rows`);
      lines.splice(MAX_ROWS);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;

      // Simple CSV parsing (handles quoted fields)
      const cells = this.parseCSVLine(line);
      
      // Security: Limit number of columns
      if (cells.length > MAX_COLUMNS) {
        this.warnings.push(`Row ${i + 1} contains ${cells.length} columns, limiting to ${MAX_COLUMNS}`);
        cells.splice(MAX_COLUMNS);
      }

      // Security: Limit cell content length and sanitize
      const sanitizedCells = cells.map((cell, cellIndex) => {
        if (cell.length > MAX_CELL_LENGTH) {
          this.warnings.push(`Cell content truncated in row ${i + 1}, column ${cellIndex + 1}`);
          cell = cell.substring(0, MAX_CELL_LENGTH);
        }
        return sanitizeText(cell);
      });

      rows.push(sanitizedCells);
    }

    return rows;
  }

  /**
   * Simple CSV line parser that handles quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    cells.push(current); // Add final cell
    return cells;
  }

  /**
   * Extracts timepoint segments and percentile data from Raw_Data.csv format
   */
  private extractTimepointData(rows: string[][]): TimeSegment[] {
    const segments: TimeSegment[] = [];
    let currentSegment: { from: string; to: string } | null = null;
    let timeSlots: string[] = [];
    let percentile25Data: number[] = [];
    let percentile50Data: number[] = [];
    let percentile80Data: number[] = [];
    let percentile90Data: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;

      const firstCell = row[0]?.toLowerCase() || '';

      // Detect title rows (segment descriptions)
      if (firstCell === 'title' && row.length > 1) {
        // Process previous segment if we have data (for backward compatibility)
        if (currentSegment && (percentile50Data.length > 0 || percentile80Data.length > 0) && timeSlots.length > 0) {
          const dataArrays = [percentile25Data, percentile50Data, percentile80Data, percentile90Data, timeSlots];
          const validArrays = dataArrays.filter(arr => arr.length > 0);
          const minLength = Math.min(...validArrays.map(arr => arr.length));
          
          for (let j = 0; j < minLength; j++) {
            const hasData = (percentile25Data[j] && percentile25Data[j] > 0) ||
                           (percentile50Data[j] && percentile50Data[j] > 0) ||
                           (percentile80Data[j] && percentile80Data[j] > 0) ||
                           (percentile90Data[j] && percentile90Data[j] > 0);
            
            if (hasData) {
              segments.push({
                fromLocation: currentSegment.from,
                toLocation: currentSegment.to,
                timeSlot: timeSlots[j],
                percentile25: percentile25Data[j] || 0,
                percentile50: percentile50Data[j] || 0,
                percentile80: percentile80Data[j] || 0,
                percentile90: percentile90Data[j] || 0
              });
            }
          }
          
          // Reset data arrays
          percentile25Data = [];
          percentile50Data = [];
          percentile80Data = [];
          percentile90Data = [];
        }

        // Extract "from" and "to" locations from title
        const titleText = row[1] || '';
        const match = titleText.match(/(.+?)\s+to\s+(.+)/i);
        if (match) {
          currentSegment = {
            from: match[1].trim(),
            to: match[2].replace(/ - \d+$/, '').trim() // Remove trailing numbers like " - 2"
          };
        }
        continue;
      }

      // Detect half-hour time slot rows
      if (firstCell === 'half-hour' && row.length > 1) {
        timeSlots = row.slice(1).filter(slot => slot.trim() !== '');
        continue;
      }

      // Detect 25th percentile data
      if (firstCell.includes('observed runtime-25%') && currentSegment) {
        percentile25Data = row.slice(1)
          .filter(val => val.trim() !== '')
          .map(val => {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
          });
        continue;
      }

      // Detect 50th percentile data
      if (firstCell.includes('observed runtime-50%') && currentSegment) {
        percentile50Data = row.slice(1)
          .filter(val => val.trim() !== '')
          .map(val => {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
          });
        continue;
      }

      // Detect 80th percentile data
      if (firstCell.includes('observed runtime-80%') && currentSegment) {
        percentile80Data = row.slice(1)
          .filter(val => val.trim() !== '')
          .map(val => {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
          });
        continue;
      }

      // Detect 90th percentile data
      if (firstCell.includes('observed runtime-90%') && currentSegment) {
        percentile90Data = row.slice(1)
          .filter(val => val.trim() !== '')
          .map(val => {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
          });

        // Process complete segment data when we have at least 50th and 80th percentiles (backward compatible)
        if ((percentile50Data.length > 0 || percentile80Data.length > 0) && timeSlots.length > 0) {
          const dataArrays = [percentile25Data, percentile50Data, percentile80Data, percentile90Data, timeSlots];
          const validArrays = dataArrays.filter(arr => arr.length > 0);
          const minLength = Math.min(...validArrays.map(arr => arr.length));
          
          for (let j = 0; j < minLength; j++) {
            // Include data if any available percentile has a value
            const hasData = (percentile25Data[j] && percentile25Data[j] > 0) ||
                           (percentile50Data[j] && percentile50Data[j] > 0) ||
                           (percentile80Data[j] && percentile80Data[j] > 0) ||
                           (percentile90Data[j] && percentile90Data[j] > 0);
            
            if (hasData) {
              segments.push({
                fromLocation: currentSegment.from,
                toLocation: currentSegment.to,
                timeSlot: timeSlots[j],
                percentile25: percentile25Data[j] || 0,
                percentile50: percentile50Data[j] || 0,
                percentile80: percentile80Data[j] || 0,
                percentile90: percentile90Data[j] || 0
              });
            }
          }
        }

        // Reset for next segment
        percentile25Data = [];
        percentile50Data = [];
        percentile80Data = [];
        percentile90Data = [];
        continue;
      }
    }

    // Process final segment if we have data (for backward compatibility)
    if (currentSegment && (percentile50Data.length > 0 || percentile80Data.length > 0) && timeSlots.length > 0) {
      const dataArrays = [percentile25Data, percentile50Data, percentile80Data, percentile90Data, timeSlots];
      const validArrays = dataArrays.filter(arr => arr.length > 0);
      const minLength = Math.min(...validArrays.map(arr => arr.length));
      
      for (let j = 0; j < minLength; j++) {
        const hasData = (percentile25Data[j] && percentile25Data[j] > 0) ||
                       (percentile50Data[j] && percentile50Data[j] > 0) ||
                       (percentile80Data[j] && percentile80Data[j] > 0) ||
                       (percentile90Data[j] && percentile90Data[j] > 0);
        
        if (hasData) {
          segments.push({
            fromLocation: currentSegment.from,
            toLocation: currentSegment.to,
            timeSlot: timeSlots[j],
            percentile25: percentile25Data[j] || 0,
            percentile50: percentile50Data[j] || 0,
            percentile80: percentile80Data[j] || 0,
            percentile90: percentile90Data[j] || 0
          });
        }
      }
    }

    return segments;
  }

  /**
   * Main parsing function for CSV files containing transit data
   */
  async parseCsvFile(file: File): Promise<CsvParseResult> {
    this.warnings = [];

    try {
      // Validate file first
      const validationError = await this.validateCsvFile(file);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          warnings: this.warnings
        };
      }

      // Read and parse file content
      const content = await file.text();
      const rows = this.parseCsvContent(content);

      if (rows.length === 0) {
        return {
          success: false,
          error: 'CSV file contains no data rows',
          warnings: this.warnings
        };
      }

      // Extract timepoint segments and percentile data
      const segments = this.extractTimepointData(rows);

      if (segments.length === 0) {
        return {
          success: false,
          error: 'No valid timepoint segments found in CSV. Expected Transify Segment Travel time export format with percentile data.',
          warnings: this.warnings
        };
      }

      // Extract unique timepoints
      const timePointsSet = new Set<string>();
      segments.forEach(segment => {
        timePointsSet.add(segment.fromLocation);
        timePointsSet.add(segment.toLocation);
      });
      const timePoints = Array.from(timePointsSet);

      // Count valid segments
      const validSegments = segments.filter(s => 
        s.percentile25 > 0 || s.percentile50 > 0 || s.percentile80 > 0 || s.percentile90 > 0
      ).length;
      const invalidSegments = segments.length - validSegments;

      // Extract unique time slots
      const timeSlotsSet = new Set(segments.map(s => s.timeSlot));

      const result: ParsedCsvData = {
        segments,
        timePoints,
        validationSummary: {
          totalSegments: segments.length,
          validSegments,
          invalidSegments,
          timeSlots: timeSlotsSet.size
        }
      };

      return {
        success: true,
        data: result,
        warnings: this.warnings
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse CSV file',
        warnings: this.warnings
      };
    }
  }

  /**
   * Converts CSV data to the format expected by existing schedule processing
   */
  static convertToScheduleFormat(csvData: ParsedCsvData): {
    timePoints: Array<{ id: string; name: string; sequence: number }>;
    travelTimes: Array<{
      fromTimePoint: string;
      toTimePoint: string;
      weekday: number;
      saturday: number;
      sunday: number;
    }>;
  } {
    // Create timepoint objects with IDs and sequence
    const timePoints = csvData.timePoints.map((name, index) => ({
      id: `tp_${index + 1}`,
      name: name,
      sequence: index + 1
    }));

    // Group segments by from/to locations and calculate average times
    const travelTimeMap = new Map<string, { 
      from: string; 
      to: string; 
      totalTime50: number; 
      totalTime80: number; 
      count: number;
    }>();

    csvData.segments.forEach(segment => {
      const fromIndex = csvData.timePoints.indexOf(segment.fromLocation);
      const toIndex = csvData.timePoints.indexOf(segment.toLocation);

      if (fromIndex >= 0 && toIndex >= 0 && (segment.percentile50 > 0 || segment.percentile80 > 0)) {
        const fromId = `tp_${fromIndex + 1}`;
        const toId = `tp_${toIndex + 1}`;
        const key = `${fromId}-${toId}`;

        const existing = travelTimeMap.get(key);
        if (existing) {
          existing.totalTime50 += segment.percentile50;
          existing.totalTime80 += segment.percentile80;
          existing.count++;
        } else {
          travelTimeMap.set(key, {
            from: fromId,
            to: toId,
            totalTime50: segment.percentile50,
            totalTime80: segment.percentile80,
            count: 1
          });
        }
      }
    });

    // Create travel time entries using averages (use 50th percentile for weekday, 80th for weekend)
    const travelTimes: Array<{
      fromTimePoint: string;
      toTimePoint: string;
      weekday: number;
      saturday: number;
      sunday: number;
    }> = [];

    travelTimeMap.forEach(data => {
      const avgTime50 = data.totalTime50 / data.count;
      const avgTime80 = data.totalTime80 / data.count;
      
      travelTimes.push({
        fromTimePoint: data.from,
        toTimePoint: data.to,
        weekday: Math.round(avgTime50), // Use 50th percentile for weekdays
        saturday: Math.round(avgTime80), // Use 80th percentile for weekends (more conservative)
        sunday: Math.round(avgTime80)    // Use 80th percentile for weekends (more conservative)
      });
    });

    return { timePoints, travelTimes };
  }
}

export default CsvParser;
import { useState, useCallback } from 'react';
import { ScheduleDataExtractor } from '../utils/dataExtractor';
import { ParsedExcelData } from '../utils/excelParser';
import { ValidationResult } from '../utils/validator';
import { sanitizeFileName as sanitizeFileNameUtil, sanitizeErrorMessage } from '../utils/inputSanitizer';
import { CsvParser, ParsedCsvData, TimeSegment } from '../utils/csvParser';
import { Trip } from '../types/schedule';
import parseQuickAdjustSchedule, {
  parseQuickAdjustCsv,
  QuickAdjustParseResult
} from '../utils/quickAdjustImporter';
import { normalizeSummaryScheduleTrips } from '../utils/blockAssignment';

// Security constants
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
] as const;

const CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain', // Some browsers report CSV as text/plain
] as const;

const EXCEL_MAGIC_BYTES = {
  xlsx: [0x50, 0x4B], // PK (ZIP signature)
  xls: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] // OLE2 signature
} as const;

interface FileUploadState {
  isLoading: boolean;
  error: string | null;
  rawData: any[] | null;
  extractedData: ParsedExcelData | null;
  csvData: ParsedCsvData | null;
  tripsByDay: Record<'weekday' | 'saturday' | 'sunday', Trip[]> | null;
  validation: ValidationResult | null;
  fileName: string | null;
  qualityReport: string | null;
  fileType: 'excel' | 'csv' | null;
}

interface FileUploadResult {
  success: boolean;
  rawData?: any[];
  extractedData?: ParsedExcelData;
  csvData?: ParsedCsvData;
  tripsByDay?: Record<'weekday' | 'saturday' | 'sunday', Trip[]>;
  validation?: ValidationResult;
  error?: string;
  fileName: string;
  qualityReport?: string;
  fileType?: 'excel' | 'csv';
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // Increased to 10MB for CSV files
const MIN_FILE_SIZE = 10; // Reduced minimum for CSV files
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;
const MAX_FILENAME_LENGTH = 255;
const SUSPICIOUS_FILENAME_PATTERNS = [
  /\.\.([/\\]|%2f|%5c)/i, // Directory traversal
  /[<>:"|?*]/g, // Invalid filename characters
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
  /\.(exe|bat|cmd|scr|vbs|js|jar|com|pif)$/i // Executable extensions
];

const QUICK_ADJUST_DAY_ORDER: Array<'weekday' | 'saturday' | 'sunday'> = ['weekday', 'saturday', 'sunday'];

const timeStringToMinutes = (value: string): number => {
  const [hoursStr, minutesStr] = value.split(':');
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
};

const calculateDurationInMinutes = (start: string, end: string): number | null => {
  const startMinutes = timeStringToMinutes(start);
  const endMinutes = timeStringToMinutes(end);
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    return null;
  }
  let diff = endMinutes - startMinutes;
  if (diff < 0) {
    diff += 24 * 60;
  }
  return diff;
};

const deriveQuickAdjustSegments = (parseResult: QuickAdjustParseResult): TimeSegment[] => {
  const candidateDay = QUICK_ADJUST_DAY_ORDER.find(day => parseResult.trips[day]?.length > 0);
  if (!candidateDay) {
    return [];
  }

  const firstTrip = parseResult.trips[candidateDay][0];
  if (!firstTrip) {
    return [];
  }

  const segments: TimeSegment[] = [];
  const points = parseResult.timePoints;

  for (let i = 0; i < points.length - 1; i += 1) {
    const origin = points[i];
    const destination = points[i + 1];
    const depart =
      firstTrip.departureTimes[origin.id] ||
      firstTrip.arrivalTimes[origin.id];
    const arrive =
      firstTrip.arrivalTimes[destination.id] ||
      firstTrip.departureTimes[destination.id];

    if (!depart || !arrive) {
      continue;
    }

    const duration = calculateDurationInMinutes(depart, arrive);
    if (duration === null) {
      continue;
    }

    segments.push({
      fromLocation: origin.name,
      toLocation: destination.name,
      timeSlot: `${depart} - ${arrive}`,
      percentile25: duration,
      percentile50: duration,
      percentile80: duration,
      percentile90: duration
    });
  }

  if (segments.length === 0 && points.length >= 2) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const origin = points[i];
      const destination = points[i + 1];
      segments.push({
        fromLocation: origin.name,
        toLocation: destination.name,
        timeSlot: `Quick Adjust Segment ${i + 1}`,
        percentile25: 0,
        percentile50: 0,
        percentile80: 0,
        percentile90: 0
      });
    }
  }

  return segments;
};

export const useFileUpload = () => {
  const [state, setState] = useState<FileUploadState>({
    isLoading: false,
    error: null,
    rawData: null,
    extractedData: null,
    csvData: null,
    tripsByDay: null,
    validation: null,
    fileName: null,
    qualityReport: null,
    fileType: null,
  });

  const validateFile = async (file: File): Promise<{ error?: string; fileType?: 'excel' | 'csv' }> => {
    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return { error: `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum allowed size of 10MB` };
    }

    if (file.size < MIN_FILE_SIZE) {
      return { error: 'File is too small or corrupted' };
    }

    // Filename validation
    if (!file.name || file.name.length > MAX_FILENAME_LENGTH) {
      return { error: 'Invalid filename or filename too long (maximum 255 characters)' };
    }

    // Check for suspicious filename patterns
    for (const pattern of SUSPICIOUS_FILENAME_PATTERNS) {
      if (pattern.test(file.name)) {
        return { error: 'Filename contains invalid or potentially dangerous characters' };
      }
    }

    // File extension validation
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(fileExtension as typeof ALLOWED_EXTENSIONS[number])) {
      return { error: `File type '${fileExtension}' not supported. Please upload .xlsx, .xls, or .csv files only` };
    }

    // Determine file type and validate accordingly
    const fileType: 'excel' | 'csv' = fileExtension === '.csv' ? 'csv' : 'excel';

    if (fileType === 'excel') {
      // MIME type validation for Excel files
      if (!EXCEL_MIME_TYPES.includes(file.type as typeof EXCEL_MIME_TYPES[number])) {
        return { error: `Invalid MIME type '${file.type}'. Expected Excel file format` };
      }

      // File content validation (magic bytes check)
      const contentValidation = await validateFileContent(file);
      if (contentValidation) {
        return { error: contentValidation };
      }
    } else if (fileType === 'csv') {
      // MIME type validation for CSV files (more lenient)
      if (file.type && !CSV_MIME_TYPES.includes(file.type as typeof CSV_MIME_TYPES[number])) {
        return { error: `Invalid MIME type '${file.type}'. Expected CSV file format` };
      }
    }

    return { fileType };
  };

  const validateFileContent = async (file: File): Promise<string | null> => {
    try {
      // Read first 8 bytes to check magic bytes
      const buffer = await file.slice(0, 8).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Check for xlsx (ZIP/PK signature)
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        if (bytes[0] !== EXCEL_MAGIC_BYTES.xlsx[0] || bytes[1] !== EXCEL_MAGIC_BYTES.xlsx[1]) {
          return 'File content does not match .xlsx format. File may be corrupted or renamed';
        }
      }

      // Check for xls (OLE2 signature)
      if (file.name.toLowerCase().endsWith('.xls')) {
        const xlsMagic = EXCEL_MAGIC_BYTES.xls;
        for (let i = 0; i < xlsMagic.length && i < bytes.length; i++) {
          if (bytes[i] !== xlsMagic[i]) {
            return 'File content does not match .xls format. File may be corrupted or renamed';
          }
        }
      }

      return null;
    } catch (error) {
      return 'Unable to validate file content. File may be corrupted';
    }
  };

  const processExcelFile = async (file: File): Promise<FileUploadResult> => {
    // Additional security: Create a timeout for processing to prevent DoS
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('File processing timeout')), 30000); // 30 second timeout
    });

    try {
      const processingPromise = (async () => {
        const extractor = new ScheduleDataExtractor({
          performDeepValidation: true,
          skipValidation: false
        });

        // Process with timeout protection
        const result = await extractor.extractFromFile(file);
        
        if (!result.success) {
          // Sanitize error message to prevent information disclosure
          const sanitizedError = sanitizeErrorMessage(result.error || 'Failed to process file');
          return {
            success: false,
            error: sanitizedError,
            fileName: sanitizeFileName(file.name),
            fileType: 'excel' as const
          };
        }

        const qualityReport = extractor.createQualityReport(result);

        return {
          success: true,
          rawData: [], // We can add raw data if needed
          extractedData: result.data,
          validation: result.validation,
          qualityReport,
          fileName: sanitizeFileName(file.name),
          fileType: 'excel' as const
        };
      })();

      return await Promise.race([processingPromise, timeoutPromise]);
    } catch (error) {
      const sanitizedError = sanitizeErrorMessage(
        error instanceof Error ? error.message : 'Failed to process Excel file'
      );
      return {
        success: false,
        error: sanitizedError,
        fileName: sanitizeFileName(file.name),
        fileType: 'excel' as const
      };
    }
  };

  const processCsvFile = async (file: File): Promise<FileUploadResult> => {
    // Additional security: Create a timeout for processing to prevent DoS
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('CSV processing timeout')), 30000); // 30 second timeout
    });

    try {
      const processingPromise = (async () => {
        const parser = new CsvParser();
        const baseResult = await parser.parseCsvFile(file);

        const attemptQuickAdjustParse = async (): Promise<{
          data: ParsedCsvData;
          warnings: string[];
          tripsByDay: Record<'weekday' | 'saturday' | 'sunday', Trip[]>;
        } | null> => {
          try {
            const rawContent = await file.text();
            const rows = parseQuickAdjustCsv(rawContent).filter(row => row.some(cell => cell.trim().length > 0));
            if (rows.length === 0) {
              return null;
            }

            const quickResult = parseQuickAdjustSchedule(rows);
            if (!quickResult.timePoints.length) {
              return null;
            }

            const normalizedSummary = normalizeSummaryScheduleTrips(quickResult.summarySchedule);
            quickResult.summarySchedule = normalizedSummary.summary;
            const tripsByDay = normalizedSummary.tripsByDay;

            const segments = deriveQuickAdjustSegments(quickResult);
            const timePoints = quickResult.timePoints.map(tp => tp.name);
            const totalSegments = segments.length > 0 ? segments.length : Math.max(timePoints.length - 1, 1);
            const parsedData: ParsedCsvData = {
              segments,
              timePoints,
              validationSummary: {
                totalSegments,
                validSegments: segments.length > 0 ? segments.length : totalSegments,
                invalidSegments: 0,
                timeSlots: segments.length > 0 ? new Set(segments.map(segment => segment.timeSlot)).size : totalSegments
              }
            };

            return {
              data: parsedData,
              warnings: quickResult.warnings,
              tripsByDay
            };
          } catch (quickError) {
            console.warn('Quick adjust CSV parse fallback failed:', quickError);
            return null;
          }
        };

        let csvData: ParsedCsvData | null = null;
        let warnings: string[] = [];
        let usedQuickAdjustFallback = false;
        let quickAdjustTripsByDay: Record<'weekday' | 'saturday' | 'sunday', any[]> | undefined;

        if (baseResult.success && baseResult.data) {
          csvData = baseResult.data;
          warnings = baseResult.warnings;
        } else {
          const fallback = await attemptQuickAdjustParse();
          if (!fallback) {
            const sanitizedError = sanitizeErrorMessage(baseResult.error || 'Failed to process CSV file');
            return {
              success: false,
              error: sanitizedError,
              fileName: sanitizeFileName(file.name),
              fileType: 'csv' as const
            };
          }
          csvData = fallback.data;
          warnings = fallback.warnings;
          quickAdjustTripsByDay = fallback.tripsByDay;
          usedQuickAdjustFallback = true;
        }

        const segmentDurations = csvData.segments.flatMap(segment =>
          [segment.percentile25, segment.percentile50, segment.percentile80, segment.percentile90].filter(value =>
            typeof value === 'number' && Number.isFinite(value) && value >= 0
          )
        );

        const averageTravelTime = csvData.segments.length > 0
          ? csvData.segments.reduce((sum, segment) => sum + (segment.percentile50 + segment.percentile80) / 2, 0) / csvData.segments.length
          : 0;
        const minTravelTime = segmentDurations.length > 0 ? Math.min(...segmentDurations) : 0;
        const maxTravelTime = segmentDurations.length > 0 ? Math.max(...segmentDurations) : 0;

        // Create a simple validation result for CSV data
        const validation: ValidationResult = {
          isValid: csvData.validationSummary.validSegments > 0 || usedQuickAdjustFallback,
          errors: csvData.validationSummary.validSegments > 0 || usedQuickAdjustFallback
            ? []
            : [{ type: 'ERROR' as const, code: 'NO_VALID_DATA', message: 'No valid percentile data found in CSV file' }],
          warnings: warnings.map(warning => ({ type: 'WARNING' as const, code: 'CSV_WARNING', message: warning })),
          statistics: {
            totalTimePoints: csvData.timePoints.length,
            totalTravelTimes: csvData.validationSummary.totalSegments,
            averageTravelTime,
            minTravelTime,
            maxTravelTime,
            missingConnections: csvData.validationSummary.invalidSegments,
            duplicateConnections: 0,
            dayTypeCoverage: {
              weekday: 100,
              saturday: 0,
              sunday: 0
            }
          }
        };

        const processingMode = usedQuickAdjustFallback ? 'Quick Adjust Schedule' : 'Travel Time Segments';

        // Create quality report
        const qualityReport = `CSV Processing Report:
Processing Mode: ${processingMode}
Total Segments: ${csvData.validationSummary.totalSegments}
Valid Segments: ${csvData.validationSummary.validSegments}
Invalid Segments: ${csvData.validationSummary.invalidSegments}
Time Slots: ${csvData.validationSummary.timeSlots}
Timepoints Found: ${csvData.timePoints.length}

Warnings: ${warnings.length > 0 ? warnings.join('\n') : 'None'}`;

        return {
          success: true,
          csvData,
          validation,
          qualityReport,
          fileName: sanitizeFileName(file.name),
          fileType: 'csv' as const,
          tripsByDay: quickAdjustTripsByDay
        };
      })();

      return await Promise.race([processingPromise, timeoutPromise]);
    } catch (error) {
      const sanitizedError = sanitizeErrorMessage(
        error instanceof Error ? error.message : 'Failed to process CSV file'
      );
      return {
        success: false,
        error: sanitizedError,
        fileName: sanitizeFileName(file.name),
        fileType: 'csv' as const
      };
    }
  };

  // Use the comprehensive sanitizer from utils

  const sanitizeFileName = (fileName: string): string => {
    return sanitizeFileNameUtil(fileName);
  };

  const uploadFile = useCallback(async (file: File): Promise<FileUploadResult> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      rawData: null,
      extractedData: null,
      csvData: null,
      tripsByDay: null,
      validation: null,
      qualityReport: null,
      fileName: file.name,
      fileType: null
    }));

    const validation = await validateFile(file);
    if (validation.error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: validation.error!,
        fileName: file.name
      }));
      return {
        success: false,
        error: validation.error,
        fileName: file.name
      };
    }

    const fileType = validation.fileType!;
    let result: FileUploadResult;

    if (fileType === 'csv') {
      result = await processCsvFile(file);
    } else {
      result = await processExcelFile(file);
    }
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: result.error || null,
      rawData: result.rawData || null,
      extractedData: result.extractedData || null,
      csvData: result.csvData || null,
      tripsByDay: result.tripsByDay || null,
      validation: result.validation || null,
      qualityReport: result.qualityReport || null,
      fileName: result.fileName,
      fileType: result.fileType || null
    }));

    return result;
  }, []);

  const clearFile = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      rawData: null,
      extractedData: null,
      csvData: null,
      tripsByDay: null,
      validation: null,
      fileName: null,
      qualityReport: null,
      fileType: null
    });
  }, []);

  return {
    ...state,
    uploadFile,
    clearFile
  };
};

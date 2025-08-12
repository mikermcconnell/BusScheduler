import { useState, useCallback } from 'react';
import { ScheduleDataExtractor, ExtractionResult } from '../utils/dataExtractor';
import { ParsedExcelData } from '../utils/excelParser';
import { ValidationResult } from '../utils/validator';
import { sanitizeFileName as sanitizeFileNameUtil, sanitizeErrorMessage } from '../utils/inputSanitizer';
import { CsvParser, ParsedCsvData } from '../utils/csvParser';

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
  /\.\.([\/\\]|%2f|%5c)/i, // Directory traversal
  /[<>:"|?*]/g, // Invalid filename characters
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
  /\.(exe|bat|cmd|scr|vbs|js|jar|com|pif)$/i // Executable extensions
];

export const useFileUpload = () => {
  const [state, setState] = useState<FileUploadState>({
    isLoading: false,
    error: null,
    rawData: null,
    extractedData: null,
    csvData: null,
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
        const result = await parser.parseCsvFile(file);
        
        if (!result.success) {
          const sanitizedError = sanitizeErrorMessage(result.error || 'Failed to process CSV file');
          return {
            success: false,
            error: sanitizedError,
            fileName: sanitizeFileName(file.name),
            fileType: 'csv' as const
          };
        }

        // Create a simple validation result for CSV data
        const validation: ValidationResult = {
          isValid: result.data!.validationSummary.validSegments > 0,
          errors: result.data!.validationSummary.validSegments === 0 ? 
            [{ type: 'ERROR' as const, code: 'NO_VALID_DATA', message: 'No valid percentile data found in CSV file' }] : [],
          warnings: result.warnings.map(warning => ({ type: 'WARNING' as const, code: 'CSV_WARNING', message: warning })),
          statistics: {
            totalTimePoints: result.data!.timePoints.length,
            totalTravelTimes: result.data!.validationSummary.totalSegments,
            averageTravelTime: result.data!.segments.reduce((sum, s) => sum + (s.percentile50 + s.percentile80) / 2, 0) / Math.max(1, result.data!.segments.length),
            minTravelTime: Math.min(...result.data!.segments.map(s => Math.min(s.percentile50, s.percentile80))),
            maxTravelTime: Math.max(...result.data!.segments.map(s => Math.max(s.percentile50, s.percentile80))),
            missingConnections: result.data!.validationSummary.invalidSegments,
            duplicateConnections: 0,
            dayTypeCoverage: {
              weekday: 100,
              saturday: 0,
              sunday: 0
            }
          }
        };

        // Create quality report
        const qualityReport = `CSV Processing Report:
Total Segments: ${result.data!.validationSummary.totalSegments}
Valid Segments: ${result.data!.validationSummary.validSegments}
Invalid Segments: ${result.data!.validationSummary.invalidSegments}
Time Slots: ${result.data!.validationSummary.timeSlots}
Timepoints Found: ${result.data!.timePoints.length}

Warnings: ${result.warnings.length > 0 ? result.warnings.join('\n') : 'None'}`;

        return {
          success: true,
          csvData: result.data,
          validation,
          qualityReport,
          fileName: sanitizeFileName(file.name),
          fileType: 'csv' as const
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
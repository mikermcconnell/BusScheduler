import { useState, useCallback } from 'react';
import { ScheduleDataExtractor, ExtractionResult } from '../utils/dataExtractor';
import { ParsedExcelData } from '../utils/excelParser';
import { ValidationResult } from '../utils/validator';
import { sanitizeFileName as sanitizeFileNameUtil, sanitizeErrorMessage } from '../utils/inputSanitizer';

// Security constants
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
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
  validation: ValidationResult | null;
  fileName: string | null;
  qualityReport: string | null;
}

interface FileUploadResult {
  success: boolean;
  rawData?: any[];
  extractedData?: ParsedExcelData;
  validation?: ValidationResult;
  error?: string;
  fileName: string;
  qualityReport?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // Reduced to 5MB for security
const MIN_FILE_SIZE = 1024; // 1KB minimum to prevent empty/malformed files
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'] as const;
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
    validation: null,
    fileName: null,
    qualityReport: null,
  });

  const validateFile = async (file: File): Promise<string | null> => {
    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum allowed size of 5MB`;
    }

    if (file.size < MIN_FILE_SIZE) {
      return 'File is too small or corrupted. Minimum file size is 1KB';
    }

    // Filename validation
    if (!file.name || file.name.length > MAX_FILENAME_LENGTH) {
      return 'Invalid filename or filename too long (maximum 255 characters)';
    }

    // Check for suspicious filename patterns
    for (const pattern of SUSPICIOUS_FILENAME_PATTERNS) {
      if (pattern.test(file.name)) {
        return 'Filename contains invalid or potentially dangerous characters';
      }
    }

    // File extension validation
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(fileExtension as typeof ALLOWED_EXTENSIONS[number])) {
      return `File type '${fileExtension}' not supported. Please upload .xlsx or .xls files only`;
    }

    // MIME type validation
    if (!EXCEL_MIME_TYPES.includes(file.type as typeof EXCEL_MIME_TYPES[number])) {
      return `Invalid MIME type '${file.type}'. Expected Excel file format`;
    }

    // File content validation (magic bytes check)
    const contentValidation = await validateFileContent(file);
    if (contentValidation) {
      return contentValidation;
    }

    return null;
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
            fileName: sanitizeFileName(file.name)
          };
        }

        const qualityReport = extractor.createQualityReport(result);

        return {
          success: true,
          rawData: [], // We can add raw data if needed
          extractedData: result.data,
          validation: result.validation,
          qualityReport,
          fileName: sanitizeFileName(file.name)
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
        fileName: sanitizeFileName(file.name)
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
      validation: null,
      qualityReport: null,
      fileName: file.name
    }));

    const validationError = await validateFile(file);
    if (validationError) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: validationError,
        fileName: file.name
      }));
      return {
        success: false,
        error: validationError,
        fileName: file.name
      };
    }

    const result = await processExcelFile(file);
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: result.error || null,
      rawData: result.rawData || null,
      extractedData: result.extractedData || null,
      validation: result.validation || null,
      qualityReport: result.qualityReport || null,
      fileName: result.fileName
    }));

    return result;
  }, []);

  const clearFile = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      rawData: null,
      extractedData: null,
      validation: null,
      fileName: null,
      qualityReport: null
    });
  }, []);

  return {
    ...state,
    uploadFile,
    clearFile
  };
};
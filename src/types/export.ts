/**
 * Export System TypeScript Interfaces
 * Comprehensive type definitions for the unified export system
 */

import { ServiceBand, TimePoint, SummarySchedule } from './schedule';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { BlockConfiguration } from './workflow';

/**
 * Export formats supported by the system
 */
export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

/**
 * Export data types that can be included in exports
 */
export interface ExportScope {
  /** Include original uploaded data */
  includeRawData: boolean;
  /** Include timepoints analysis data */
  includeAnalysis: boolean;
  /** Include block configuration data */
  includeConfiguration: boolean;
  /** Include generated summary schedule */
  includeGeneratedSchedule: boolean;
  /** Specific trip IDs to export (if selective) */
  selectedTrips?: string[];
  /** Specific time periods to include */
  selectedTimePeriods?: string[];
  /** Include metadata and processing information */
  includeMetadata: boolean;
}

/**
 * Export template configuration
 */
export interface ExportTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Template description */
  description: string;
  /** Target export format */
  format: ExportFormat;
  /** Default export scope */
  defaultScope: ExportScope;
  /** Custom formatting options */
  customOptions?: Record<string, any>;
  /** Required data types for this template */
  requiredData: ExportDataType[];
  /** Template category for grouping */
  category: 'operational' | 'analytical' | 'management' | 'technical' | 'public';
  /** Is this a system template or user-created */
  isSystemTemplate: boolean;
  /** Template creation/modification dates */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data types available for export
 */
export type ExportDataType = 
  | 'raw-upload'
  | 'timepoints-analysis' 
  | 'service-bands'
  | 'block-configuration'
  | 'summary-schedule'
  | 'trip-details'
  | 'validation-results'
  | 'statistics'
  | 'metadata';

/**
 * Export configuration options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Selected template */
  template: ExportTemplate;
  /** Export scope configuration */
  scope: ExportScope;
  /** Custom filename (optional) */
  filename?: string;
  /** Time format preference */
  timeFormat: '12h' | '24h';
  /** Include file headers */
  includeHeaders: boolean;
  /** Compression level (for applicable formats) */
  compressionLevel?: number;
  /** Custom field mappings */
  fieldMappings?: Record<string, string>;
  /** Export quality/detail level */
  qualityLevel: 'basic' | 'standard' | 'detailed' | 'comprehensive';
}

/**
 * Export data bundle - all available data for export
 */
export interface ExportDataBundle {
  /** Original uploaded file data */
  rawData?: {
    fileName: string;
    fileType: 'excel' | 'csv';
    data: ParsedExcelData | ParsedCsvData;
    uploadedAt: Date;
  };
  
  /** Timepoints analysis results */
  timepointsAnalysis?: {
    serviceBands: ServiceBand[];
    timePoints: TimePoint[];
    travelTimes: Record<string, number[]>;
    outliers: any[];
    validationResults: any[];
  };
  
  /** Block configuration data */
  blockConfiguration?: {
    numberOfBuses: number;
    cycleTimeMinutes: number;
    automateBlockStartTimes: boolean;
    configurations: BlockConfiguration[];
  };
  
  /** Generated summary schedule */
  summarySchedule?: SummarySchedule;
  
  /** Processing metadata */
  metadata?: {
    projectName: string;
    routeName: string;
    direction: string;
    processedAt: Date;
    processingTime: number;
    version: string;
    generatedBy: string;
  };
  
  /** Export context information */
  context: {
    exportedAt: Date;
    exportedBy?: string;
    exportVersion: string;
    sourceApplication: string;
  };
}

/**
 * Export result information
 */
export interface ExportResult {
  /** Export success status */
  success: boolean;
  /** Generated filename */
  filename: string;
  /** File blob for download */
  blob?: Blob;
  /** File size in bytes */
  fileSize?: number;
  /** Export format used */
  format: ExportFormat;
  /** Template used */
  templateId: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Error message if failed */
  error?: string;
  /** Warnings generated during export */
  warnings?: string[];
  /** Export statistics */
  stats?: ExportStats;
}

/**
 * Export processing statistics
 */
export interface ExportStats {
  /** Total records exported */
  totalRecords: number;
  /** Records by type */
  recordsByType: Record<string, number>;
  /** Data size before compression */
  uncompressedSize: number;
  /** Final file size */
  compressedSize: number;
  /** Compression ratio */
  compressionRatio: number;
  /** Export validation passed */
  validationPassed: boolean;
  /** Validation issues found */
  validationIssues: string[];
}

/**
 * Batch export configuration
 */
export interface BatchExportConfig {
  /** Export configurations to process */
  exports: ExportOptions[];
  /** Create ZIP archive */
  createArchive: boolean;
  /** Archive filename */
  archiveName?: string;
  /** Execute in parallel */
  parallel: boolean;
  /** Progress callback */
  onProgress?: (completed: number, total: number, currentExport: string) => void;
}

/**
 * Batch export result
 */
export interface BatchExportResult {
  /** Overall success status */
  success: boolean;
  /** Individual export results */
  results: ExportResult[];
  /** Archive blob if created */
  archiveBlob?: Blob;
  /** Archive filename */
  archiveFilename?: string;
  /** Total processing time */
  totalProcessingTime: number;
  /** Exports that succeeded */
  successCount: number;
  /** Exports that failed */
  failureCount: number;
  /** Overall error message */
  error?: string;
}

/**
 * Export preview data structure
 */
export interface ExportPreview {
  /** Preview format */
  format: ExportFormat;
  /** Estimated file size */
  estimatedSize: number;
  /** Number of records */
  recordCount: number;
  /** Column headers for tabular formats */
  headers?: string[];
  /** Sample data rows (first 10) */
  sampleData?: any[][];
  /** Preview generated timestamp */
  previewedAt: Date;
  /** Preview is truncated */
  isTruncated: boolean;
  /** Full content (for small exports) */
  fullContent?: string;
}

/**
 * Export validation result
 */
export interface ExportValidationResult {
  /** Validation passed */
  isValid: boolean;
  /** Critical errors that prevent export */
  errors: string[];
  /** Warnings that don't prevent export */
  warnings: string[];
  /** Missing required data */
  missingData: string[];
  /** Validation performed at */
  validatedAt: Date;
  /** Data quality score (0-100) */
  qualityScore: number;
}

/**
 * Export progress information
 */
export interface ExportProgress {
  /** Current stage of export */
  stage: 'preparing' | 'processing' | 'formatting' | 'compressing' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current operation description */
  currentOperation: string;
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;
  /** Processing speed (records/second) */
  processingSpeed?: number;
  /** Started at timestamp */
  startedAt: Date;
  /** Completed records */
  completedRecords: number;
  /** Total records to process */
  totalRecords: number;
}

/**
 * Export history entry
 */
export interface ExportHistoryEntry {
  /** Unique export ID */
  id: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Export configuration used */
  config: ExportOptions;
  /** Export result */
  result: ExportResult;
  /** File still available for re-download */
  fileAvailable: boolean;
  /** File expiration date */
  expiresAt?: Date;
  /** Re-download URL */
  downloadUrl?: string;
}

/**
 * Custom export field definition
 */
export interface ExportField {
  /** Field identifier */
  id: string;
  /** Display name */
  name: string;
  /** Data type */
  type: 'string' | 'number' | 'date' | 'boolean' | 'time';
  /** Is field required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Field formatter function */
  formatter?: (value: any) => string;
  /** Field validation function */
  validator?: (value: any) => boolean;
  /** Field description */
  description?: string;
}

/**
 * Export security configuration
 */
export interface ExportSecurityConfig {
  /** Maximum file size allowed (bytes) */
  maxFileSize: number;
  /** Maximum records per export */
  maxRecords: number;
  /** Allowed export formats */
  allowedFormats: ExportFormat[];
  /** Require user authentication */
  requireAuth: boolean;
  /** Export audit logging enabled */
  auditLogging: boolean;
  /** Data sanitization enabled */
  sanitizeData: boolean;
  /** Watermark exported files */
  addWatermark: boolean;
}
/**
 * Represents a cell value in an Excel worksheet
 */
export type ExcelCellValue = string | number | boolean | Date | null | undefined;

/**
 * Represents a row in an Excel worksheet
 */
export type ExcelRow = ExcelCellValue[];

/**
 * Represents an Excel worksheet data structure
 */
export interface ExcelWorksheet {
  /** Name of the worksheet */
  name: string;
  /** Raw data from the worksheet */
  data: ExcelRow[];
  /** Column headers (first row) */
  headers: string[];
  /** Number of rows (excluding headers) */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
}

/**
 * Represents an Excel workbook structure
 */
export interface ExcelWorkbook {
  /** Array of worksheets in the workbook */
  worksheets: ExcelWorksheet[];
  /** Name of the uploaded file */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Date when file was uploaded */
  uploadedAt: Date;
}

/**
 * File upload progress information
 */
export interface FileUploadProgress {
  /** Current upload progress (0-100) */
  progress: number;
  /** Whether upload is complete */
  isComplete: boolean;
  /** Any error that occurred during upload */
  error?: string;
  /** File being uploaded */
  file: File;
}

/**
 * Excel parsing options
 */
export interface ExcelParsingOptions {
  /** Which worksheet to parse (by index or name) */
  worksheetTarget?: number | string;
  /** Whether to treat first row as headers */
  hasHeaders: boolean;
  /** Range of cells to parse (e.g., "A1:Z100") */
  range?: string;
  /** Whether to skip empty rows */
  skipEmptyRows: boolean;
  /** Whether to skip empty columns */
  skipEmptyColumns: boolean;
  /** Date format to use when parsing dates */
  dateFormat?: string;
}

/**
 * Result of Excel parsing operation
 */
export interface ExcelParsingResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed workbook data */
  workbook?: ExcelWorkbook;
  /** Error message if parsing failed */
  error?: string;
  /** Warnings encountered during parsing */
  warnings: string[];
  /** Parsing statistics */
  stats: {
    /** Number of worksheets processed */
    worksheetsProcessed: number;
    /** Total rows processed */
    totalRows: number;
    /** Total cells processed */
    totalCells: number;
    /** Processing time in milliseconds */
    processingTime: number;
  };
}

/**
 * Excel export options
 */
export interface ExcelExportOptions {
  /** Name for the output file */
  fileName: string;
  /** Whether to include headers */
  includeHeaders: boolean;
  /** Format for dates */
  dateFormat?: string;
  /** Worksheet name */
  worksheetName?: string;
  /** Column widths (auto-size if not specified) */
  columnWidths?: number[];
}

/**
 * Supported Excel file formats
 */
export type ExcelFileFormat = 'xlsx' | 'xls' | 'csv';

/**
 * File validation result
 */
export interface FileValidationResult {
  /** Whether file is valid */
  isValid: boolean;
  /** File format detected */
  format?: ExcelFileFormat;
  /** Validation errors */
  errors: string[];
  /** File metadata */
  metadata: {
    /** File size in bytes */
    size: number;
    /** File MIME type */
    mimeType: string;
    /** Last modified date */
    lastModified: Date;
  };
}

/**
 * Column mapping for schedule data
 */
export interface ScheduleColumnMapping {
  /** Column index or name for time point names */
  timePointColumn: number | string;
  /** Column indices or names for schedule times */
  scheduleColumns: (number | string)[];
  /** Column for trip identifiers (optional) */
  tripIdColumn?: number | string;
  /** Column for route information (optional) */
  routeColumn?: number | string;
}

/**
 * Excel template validation
 */
export interface TemplateValidation {
  /** Whether template structure is valid */
  isValid: boolean;
  /** Required columns that are missing */
  missingColumns: string[];
  /** Extra columns found */
  extraColumns: string[];
  /** Validation messages */
  messages: string[];
}
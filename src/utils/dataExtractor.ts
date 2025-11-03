import { ExcelParser, ParsedExcelData, ExcelParserOptions } from './excelParser';
import { DataValidator, ValidationResult, ValidationOptions } from './validator';

export interface ExtractionResult {
  success: boolean;
  data?: ParsedExcelData;
  validation?: ValidationResult;
  error?: string;
  metadata: {
    fileName: string;
    processingTime: number;
    extractedAt: Date;
  };
}

export interface ExtractionOptions {
  parserOptions?: Partial<ExcelParserOptions>;
  validationOptions?: Partial<ValidationOptions>;
  skipValidation?: boolean;
  performDeepValidation?: boolean;
}

const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  skipValidation: false,
  performDeepValidation: true,
  parserOptions: {
    strictValidation: false,
    skipEmptyRows: true,
    allowPartialData: true
  },
  validationOptions: {
    requireAllConnections: false,
    allowDuplicates: false,
    strictTimeValidation: true
  }
};

export class ScheduleDataExtractor {
  private options: ExtractionOptions;

  constructor(options: Partial<ExtractionOptions> = {}) {
    this.options = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
  }

  async extractFromExcelData(
    data: any[][],
    fileName: string = 'unknown.xlsx'
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      const parser = new ExcelParser(data, this.options.parserOptions);
      const parsedData = parser.parseScheduleData(fileName);

      let validationResult: ValidationResult | undefined;

      if (!this.options.skipValidation) {
        const validator = new DataValidator(this.options.validationOptions);
        validationResult = validator.validateScheduleData(parsedData);

        if (!validationResult.isValid && this.options.parserOptions?.strictValidation) {
          const criticalErrors = validationResult.errors
            .filter(e => e.type === 'CRITICAL')
            .map(e => e.message)
            .join('; ');

          return {
            success: false,
            error: `Critical validation errors: ${criticalErrors}`,
            metadata: {
              fileName,
              processingTime: Date.now() - startTime,
              extractedAt: new Date()
            }
          };
        }
      }

      return {
        success: true,
        data: parsedData,
        validation: validationResult,
        metadata: {
          fileName,
          processingTime: Date.now() - startTime,
          extractedAt: new Date()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
        metadata: {
          fileName,
          processingTime: Date.now() - startTime,
          extractedAt: new Date()
        }
      };
    }
  }

  async extractFromFile(file: File): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        return {
          success: false,
          error: 'Excel file contains no worksheets',
          metadata: {
            fileName: file.name,
            processingTime: Date.now() - startTime,
            extractedAt: new Date()
          }
        };
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        raw: false
      });

      return this.extractFromExcelData(jsonData as any[][], file.name);

    } catch (error) {
      return {
        success: false,
        error: `File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          fileName: file.name,
          processingTime: Date.now() - startTime,
          extractedAt: new Date()
        }
      };
    }
  }

  createQualityReport(result: ExtractionResult): string {
    if (!result.success || !result.data || !result.validation) {
      return `Extraction failed: ${result.error || 'Unknown error'}`;
    }

    const { data, validation } = result;
    const stats = validation.statistics;

    let report = `## Data Quality Report for ${result.metadata.fileName}\n\n`;
    
    report += `**Processing Summary:**\n`;
    report += `- Processing time: ${result.metadata.processingTime}ms\n`;
    report += `- Total rows in file: ${data.metadata.totalRows}\n`;
    report += `- Processed rows: ${data.metadata.processedRows}\n`;
    report += `- Skipped rows: ${data.metadata.skippedRows}\n`;
    report += `- Format confidence: ${data.format.confidence}%\n\n`;

    report += `**Data Overview:**\n`;
    report += `- Time points detected: ${stats.totalTimePoints}\n`;
    report += `- Travel time connections: ${stats.totalTravelTimes}\n`;
    report += `- Average travel time: ${stats.averageTravelTime.toFixed(1)} minutes\n`;
    report += `- Travel time range: ${stats.minTravelTime}-${stats.maxTravelTime} minutes\n\n`;

    report += `**Day Type Coverage:**\n`;
    report += `- Weekday: ${stats.dayTypeCoverage.weekday} connections\n`;
    report += `- Saturday: ${stats.dayTypeCoverage.saturday} connections\n`;
    report += `- Sunday: ${stats.dayTypeCoverage.sunday} connections\n\n`;

    if (validation.errors.length > 0) {
      report += `**Errors (${validation.errors.length}):**\n`;
      for (const error of validation.errors) {
        report += `- [${error.type}] ${error.message}\n`;
      }
      report += '\n';
    }

    if (validation.warnings.length > 0) {
      report += `**Warnings (${validation.warnings.length}):**\n`;
      for (const warning of validation.warnings) {
        report += `- [${warning.type}] ${warning.message}\n`;
      }
      report += '\n';
    }

    report += `**Validation Result:** ${validation.isValid ? 'PASSED' : 'FAILED'}\n`;

    return report;
  }

  summarizeTimePoints(data: ParsedExcelData): string {
    const report = `Time Points (${data.timePoints.length}):\n`;
    return report + data.timePoints
      .map(tp => `${tp.sequence + 1}. ${tp.name}`)
      .join('\n');
  }

  summarizeTravelTimes(data: ParsedExcelData): string {
    let report = `Travel Time Connections (${data.travelTimes.length}):\n\n`;
    
    const timePointMap = new Map(data.timePoints.map(tp => [tp.id, tp.name]));
    
    for (const tt of data.travelTimes.slice(0, 10)) {
      const fromName = timePointMap.get(tt.fromTimePoint) || tt.fromTimePoint;
      const toName = timePointMap.get(tt.toTimePoint) || tt.toTimePoint;
      
      report += `${fromName} → ${toName}:\n`;
      if (tt.weekday > 0) report += `  Weekday: ${tt.weekday}min\n`;
      if (tt.saturday > 0) report += `  Saturday: ${tt.saturday}min\n`;
      if (tt.sunday > 0) report += `  Sunday: ${tt.sunday}min\n`;
      report += '\n';
    }
    
    if (data.travelTimes.length > 10) {
      report += `... and ${data.travelTimes.length - 10} more connections\n`;
    }
    
    return report;
  }
}
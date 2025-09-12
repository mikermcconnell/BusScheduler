/**
 * Enhanced Export Service
 * Unified export service that consolidates all export functionality
 * Supports multiple formats, templates, and comprehensive data handling
 */

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  ExportOptions,
  ExportResult,
  ExportDataBundle,
  ExportTemplate,
  ExportPreview,
  ExportValidationResult,
  ExportProgress,
  BatchExportConfig,
  BatchExportResult,
  ExportFormat,
  ExportScope,
  ExportStats
} from '../types/export';
import { SummarySchedule, TimePoint, ServiceBand } from '../types/schedule';
import { sanitizeText } from '../utils/inputSanitizer';

/**
 * System export templates
 */
const SYSTEM_TEMPLATES: ExportTemplate[] = [
  // CSV Templates
  {
    id: 'csv-gtfs-format',
    name: 'GTFS Transit Format',
    description: 'Industry standard GTFS format for transit agencies',
    format: 'csv',
    category: 'operational',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: false,
      includeAnalysis: false,
      includeConfiguration: false,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['summary-schedule'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'csv-operational-format',
    name: 'Operations Schedule',
    description: 'Driver and dispatcher friendly format',
    format: 'csv',
    category: 'operational',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: false,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['summary-schedule', 'block-configuration'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'csv-analysis-format',
    name: 'Route Analysis Data',
    description: 'Comprehensive data for route planning and analysis',
    format: 'csv',
    category: 'analytical',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: true,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['raw-upload', 'timepoints-analysis', 'summary-schedule'],
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Excel Templates
  {
    id: 'excel-professional-schedule',
    name: 'Professional Schedule Workbook',
    description: 'Multi-sheet Excel workbook with comprehensive schedule data',
    format: 'excel',
    category: 'operational',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: false,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['summary-schedule', 'statistics'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'excel-management-report',
    name: 'Management Report',
    description: 'Executive summary with charts and key metrics',
    format: 'excel',
    category: 'management',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: false,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['summary-schedule', 'statistics', 'metadata'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'excel-technical-analysis',
    name: 'Technical Analysis Workbook',
    description: 'Detailed technical analysis with all underlying data',
    format: 'excel',
    category: 'technical',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: true,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['raw-upload', 'timepoints-analysis', 'summary-schedule', 'validation-results'],
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // JSON Templates
  {
    id: 'json-api-format',
    name: 'API Data Format',
    description: 'JSON format suitable for API consumption',
    format: 'json',
    category: 'technical',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: false,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['summary-schedule'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'json-complete-export',
    name: 'Complete Data Export',
    description: 'All available data in structured JSON format',
    format: 'json',
    category: 'technical',
    isSystemTemplate: true,
    defaultScope: {
      includeRawData: true,
      includeAnalysis: true,
      includeConfiguration: true,
      includeGeneratedSchedule: true,
      includeMetadata: true
    },
    requiredData: ['raw-upload', 'timepoints-analysis', 'block-configuration', 'summary-schedule'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * Enhanced Export Service Class
 */
class ExportService {
  private progressCallbacks: Map<string, (progress: ExportProgress) => void> = new Map();
  private exportHistory: Map<string, ExportResult> = new Map();

  /**
   * Get all available export templates
   */
  getTemplates(): ExportTemplate[] {
    return [...SYSTEM_TEMPLATES];
  }

  /**
   * Get templates for specific format
   */
  getTemplatesByFormat(format: ExportFormat): ExportTemplate[] {
    return SYSTEM_TEMPLATES.filter(template => template.format === format);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): ExportTemplate | undefined {
    return SYSTEM_TEMPLATES.find(template => template.id === templateId);
  }

  /**
   * Validate export configuration
   */
  validateExportConfig(
    options: ExportOptions,
    dataBundle: ExportDataBundle
  ): ExportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingData: string[] = [];

    // Check template exists
    const template = this.getTemplate(options.template.id);
    if (!template) {
      errors.push(`Template not found: ${options.template.id}`);
    } else {
      // Validate required data is available
      template.requiredData.forEach(dataType => {
        if (!this.hasRequiredData(dataBundle, dataType)) {
          missingData.push(dataType);
        }
      });
    }

    // Validate scope configuration
    if (options.scope.includeGeneratedSchedule && !dataBundle.summarySchedule) {
      missingData.push('summary-schedule');
    }

    if (options.scope.includeConfiguration && !dataBundle.blockConfiguration) {
      missingData.push('block-configuration');
    }

    if (options.scope.includeAnalysis && !dataBundle.timepointsAnalysis) {
      missingData.push('timepoints-analysis');
    }

    if (options.scope.includeRawData && !dataBundle.rawData) {
      missingData.push('raw-upload');
    }

    // Quality assessment
    let qualityScore = 100;
    if (missingData.length > 0) {
      qualityScore -= missingData.length * 20;
    }
    if (warnings.length > 0) {
      qualityScore -= warnings.length * 5;
    }

    return {
      isValid: errors.length === 0 && missingData.length === 0,
      errors,
      warnings,
      missingData,
      validatedAt: new Date(),
      qualityScore: Math.max(0, qualityScore)
    };
  }

  /**
   * Generate export preview
   */
  async generatePreview(
    options: ExportOptions,
    dataBundle: ExportDataBundle
  ): Promise<ExportPreview> {
    const validation = this.validateExportConfig(options, dataBundle);
    if (!validation.isValid) {
      throw new Error(`Invalid export configuration: ${validation.errors.join(', ')}`);
    }

    // Generate sample data based on format and scope
    const sampleData = this.generateSampleData(options, dataBundle, 10);
    const estimatedSize = this.estimateFileSize(options, dataBundle);

    return {
      format: options.format,
      estimatedSize,
      recordCount: this.countRecords(options, dataBundle),
      headers: sampleData.headers,
      sampleData: sampleData.rows,
      previewedAt: new Date(),
      isTruncated: true,
      fullContent: sampleData.rows.length <= 100 ? this.formatSampleContent(options.format, sampleData) : undefined
    };
  }

  /**
   * Execute export with progress tracking
   */
  async executeExport(
    options: ExportOptions,
    dataBundle: ExportDataBundle,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const exportId = this.generateExportId();
    const startTime = Date.now();

    try {
      // Register progress callback
      if (onProgress) {
        this.progressCallbacks.set(exportId, onProgress);
      }

      // Update progress
      this.updateProgress(exportId, {
        stage: 'preparing',
        progress: 0,
        currentOperation: 'Validating configuration',
        startedAt: new Date(),
        completedRecords: 0,
        totalRecords: this.countRecords(options, dataBundle)
      });

      // Validate configuration
      const validation = this.validateExportConfig(options, dataBundle);
      if (!validation.isValid) {
        throw new Error(`Export validation failed: ${validation.errors.join(', ')}`);
      }

      // Update progress
      this.updateProgress(exportId, {
        stage: 'processing',
        progress: 20,
        currentOperation: 'Processing data',
        startedAt: new Date(),
        completedRecords: 0,
        totalRecords: this.countRecords(options, dataBundle)
      });

      // Process data based on format
      let result: ExportResult;
      switch (options.format) {
        case 'csv':
          result = await this.exportToCsv(options, dataBundle, exportId);
          break;
        case 'excel':
          result = await this.exportToExcel(options, dataBundle, exportId);
          break;
        case 'json':
          result = await this.exportToJson(options, dataBundle, exportId);
          break;
        case 'pdf':
          result = await this.exportToPdf(options, dataBundle, exportId);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Final processing time
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;
      result.exportedAt = new Date();

      // Store in history
      this.exportHistory.set(exportId, result);

      // Update progress to complete
      this.updateProgress(exportId, {
        stage: 'complete',
        progress: 100,
        currentOperation: 'Export complete',
        startedAt: new Date(),
        completedRecords: result.stats?.totalRecords || 0,
        totalRecords: result.stats?.totalRecords || 0
      });

      return result;

    } catch (error) {
      // Update progress to error
      this.updateProgress(exportId, {
        stage: 'error',
        progress: 0,
        currentOperation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        startedAt: new Date(),
        completedRecords: 0,
        totalRecords: 0
      });

      return {
        success: false,
        filename: '',
        format: options.format,
        templateId: options.template.id,
        exportedAt: new Date(),
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    } finally {
      // Clean up progress callback
      this.progressCallbacks.delete(exportId);
    }
  }

  /**
   * Execute batch export
   */
  async executeBatchExport(config: BatchExportConfig, dataBundle: ExportDataBundle): Promise<BatchExportResult> {
    const startTime = Date.now();
    const results: ExportResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      if (config.parallel) {
        // Execute exports in parallel
        const exportPromises = config.exports.map(async (exportOptions, index) => {
          const result = await this.executeExport(exportOptions, dataBundle, (progress) => {
            if (config.onProgress) {
              config.onProgress(index + 1, config.exports.length, `${exportOptions.template.name} - ${progress.currentOperation}`);
            }
          });
          return result;
        });

        const exportResults = await Promise.all(exportPromises);
        results.push(...exportResults);
      } else {
        // Execute exports sequentially
        for (let i = 0; i < config.exports.length; i++) {
          const exportOptions = config.exports[i];
          
          if (config.onProgress) {
            config.onProgress(i, config.exports.length, exportOptions.template.name);
          }

          const result = await this.executeExport(exportOptions, dataBundle);
          results.push(result);

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        }
      }

      // Count successes and failures
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      });

      // Create archive if requested
      let archiveBlob: Blob | undefined;
      let archiveFilename: string | undefined;

      if (config.createArchive && successCount > 0) {
        const zip = new JSZip();
        
        results.forEach(result => {
          if (result.success && result.blob) {
            zip.file(result.filename, result.blob);
          }
        });

        const timestamp = new Date().toISOString().slice(0, 10);
        archiveFilename = config.archiveName || `schedule_export_${timestamp}.zip`;
        archiveBlob = await zip.generateAsync({ type: 'blob' });
      }

      return {
        success: failureCount === 0,
        results,
        archiveBlob,
        archiveFilename,
        totalProcessingTime: Date.now() - startTime,
        successCount,
        failureCount
      };

    } catch (error) {
      return {
        success: false,
        results,
        totalProcessingTime: Date.now() - startTime,
        successCount,
        failureCount,
        error: error instanceof Error ? error.message : 'Batch export failed'
      };
    }
  }

  /**
   * Download export result
   */
  downloadExport(result: ExportResult): void {
    if (!result.success || !result.blob) {
      throw new Error('Export result is not valid for download');
    }

    const url = window.URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Download batch export result
   */
  downloadBatchExport(result: BatchExportResult): void {
    if (result.archiveBlob && result.archiveFilename) {
      // Download archive
      const url = window.URL.createObjectURL(result.archiveBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.archiveFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      // Download individual files
      result.results.forEach(exportResult => {
        if (exportResult.success) {
          this.downloadExport(exportResult);
        }
      });
    }
  }

  // Private helper methods

  private hasRequiredData(dataBundle: ExportDataBundle, dataType: string): boolean {
    switch (dataType) {
      case 'raw-upload':
        return !!dataBundle.rawData;
      case 'timepoints-analysis':
        return !!dataBundle.timepointsAnalysis;
      case 'block-configuration':
        return !!dataBundle.blockConfiguration;
      case 'summary-schedule':
        return !!dataBundle.summarySchedule;
      case 'metadata':
        return !!dataBundle.metadata;
      default:
        return true;
    }
  }

  private countRecords(options: ExportOptions, dataBundle: ExportDataBundle): number {
    let count = 0;

    if (options.scope.includeGeneratedSchedule && dataBundle.summarySchedule) {
      // Count trips in summary schedule
      const schedule = dataBundle.summarySchedule;
      count += (schedule.weekday?.length || 0) + (schedule.saturday?.length || 0) + (schedule.sunday?.length || 0);
    }

    if (options.scope.includeRawData && dataBundle.rawData) {
      // Estimate based on raw data size
      count += 100; // Rough estimate
    }

    return Math.max(count, 1);
  }

  private generateSampleData(options: ExportOptions, dataBundle: ExportDataBundle, limit: number): { headers: string[], rows: any[][] } {
    // Generate sample based on template and scope
    const headers: string[] = [];
    const rows: any[][] = [];

    if (options.scope.includeGeneratedSchedule && dataBundle.summarySchedule) {
      headers.push('Trip', 'Block', 'Day Type', 'Departure Time');
      
      // Add timepoint headers
      if (dataBundle.summarySchedule.timePoints) {
        dataBundle.summarySchedule.timePoints.forEach(tp => {
          headers.push(tp.name);
        });
      }

      // Add sample rows (limited)
      let rowCount = 0;
      const addSampleTrips = (trips: any[], dayType: string) => {
        for (let i = 0; i < Math.min(trips.length, limit - rowCount); i++) {
          const trip = trips[i];
          const row = [i + 1, Math.ceil((i + 1) / 3), dayType, '06:00'];
          
          // Add sample times for each timepoint
          if (dataBundle.summarySchedule?.timePoints) {
            dataBundle.summarySchedule.timePoints.forEach((_, idx) => {
              row.push(`06:${String(idx * 5).padStart(2, '0')}`);
            });
          }
          
          rows.push(row);
          rowCount++;
        }
      };

      if (dataBundle.summarySchedule.weekday?.length) {
        addSampleTrips(dataBundle.summarySchedule.weekday, 'Weekday');
      }
    }

    return { headers, rows };
  }

  private estimateFileSize(options: ExportOptions, dataBundle: ExportDataBundle): number {
    const recordCount = this.countRecords(options, dataBundle);
    const fieldsPerRecord = 10; // Rough estimate
    const bytesPerField = 15; // Average

    let baseSize = recordCount * fieldsPerRecord * bytesPerField;

    // Format-specific multipliers
    switch (options.format) {
      case 'csv':
        baseSize *= 1.0;
        break;
      case 'excel':
        baseSize *= 2.5; // Excel has more overhead
        break;
      case 'json':
        baseSize *= 1.8; // JSON has structural overhead
        break;
      case 'pdf':
        baseSize *= 4.0; // PDF has significant overhead
        break;
    }

    return Math.round(baseSize);
  }

  private formatSampleContent(format: ExportFormat, sampleData: { headers: string[], rows: any[][] }): string {
    switch (format) {
      case 'csv':
        const csvLines = [sampleData.headers.join(',')];
        sampleData.rows.forEach(row => {
          csvLines.push(row.map(cell => `"${cell}"`).join(','));
        });
        return csvLines.join('\n');

      case 'json':
        const jsonData = sampleData.rows.map(row => {
          const obj: any = {};
          sampleData.headers.forEach((header, idx) => {
            obj[header] = row[idx];
          });
          return obj;
        });
        return JSON.stringify(jsonData, null, 2);

      default:
        return `${format.toUpperCase()} Preview\n\nHeaders: ${sampleData.headers.join(', ')}\nRows: ${sampleData.rows.length}`;
    }
  }

  private async exportToCsv(options: ExportOptions, dataBundle: ExportDataBundle, exportId: string): Promise<ExportResult> {
    // Implement CSV export logic
    this.updateProgress(exportId, {
      stage: 'formatting',
      progress: 50,
      currentOperation: 'Formatting CSV data',
      startedAt: new Date(),
      completedRecords: 0,
      totalRecords: this.countRecords(options, dataBundle)
    });

    const sampleData = this.generateSampleData(options, dataBundle, 1000);
    const csvLines = [sampleData.headers.join(',')];
    
    sampleData.rows.forEach(row => {
      csvLines.push(row.map(cell => {
        const sanitized = sanitizeText(String(cell || ''));
        return `"${sanitized.replace(/"/g, '""')}"`;
      }).join(','));
    });

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = this.generateFilename(options, 'csv');

    return {
      success: true,
      filename,
      blob,
      fileSize: blob.size,
      format: 'csv',
      templateId: options.template.id,
      exportedAt: new Date(),
      processingTime: 0, // Will be set by caller
      stats: {
        totalRecords: sampleData.rows.length,
        recordsByType: { 'trips': sampleData.rows.length },
        uncompressedSize: blob.size,
        compressedSize: blob.size,
        compressionRatio: 1.0,
        validationPassed: true,
        validationIssues: []
      }
    };
  }

  private async exportToExcel(options: ExportOptions, dataBundle: ExportDataBundle, exportId: string): Promise<ExportResult> {
    // Implement Excel export logic using actual schedule data
    this.updateProgress(exportId, {
      stage: 'formatting',
      progress: 50,
      currentOperation: 'Creating Excel workbook',
      startedAt: new Date(),
      completedRecords: 0,
      totalRecords: this.countRecords(options, dataBundle)
    });

    const workbook = XLSX.utils.book_new();
    
    // Use actual schedule data instead of sample data
    const { headers, rows } = this.generateActualScheduleData(dataBundle);
    
    // Create main sheet
    const wsData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

    // Add metadata sheet if included
    if (options.scope.includeMetadata && dataBundle.metadata) {
      const metadataData = [
        ['Export Metadata'],
        [''],
        ['Project Name', dataBundle.metadata.projectName || 'Unknown'],
        ['Route Name', dataBundle.metadata.routeName || 'Unknown'],
        ['Exported At', new Date().toISOString()],
        ['Export Template', options.template.name]
      ];
      const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    }

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const filename = this.generateFilename(options, 'xlsx');

    return {
      success: true,
      filename,
      blob,
      fileSize: blob.size,
      format: 'excel',
      templateId: options.template.id,
      exportedAt: new Date(),
      processingTime: 0,
      stats: {
        totalRecords: rows.length,
        recordsByType: { 'trips': rows.length },
        uncompressedSize: blob.size,
        compressedSize: blob.size,
        compressionRatio: 1.0,
        validationPassed: true,
        validationIssues: []
      }
    };
  }

  private generateActualScheduleData(dataBundle: ExportDataBundle): { headers: string[], rows: any[][] } {
    const headers: string[] = [];
    const rows: any[][] = [];

    if (!dataBundle.summarySchedule) {
      // Fallback to basic headers if no schedule data
      return { headers: ['Trip', 'Block', 'Start Time'], rows: [] };
    }

    const schedule = dataBundle.summarySchedule;
    
    // Create headers: Trip info + Timepoint columns
    headers.push('Trip', 'Block', 'Day Type');
    
    if (schedule.timePoints && schedule.timePoints.length > 0) {
      schedule.timePoints.forEach(tp => {
        headers.push(tp.name);
      });
    }

    // Process weekday trips
    if (schedule.weekday && schedule.weekday.length > 0) {
      schedule.weekday.forEach((tripTimes, tripIndex) => {
        const row = [
          tripIndex + 1, // Trip number
          Math.ceil((tripIndex + 1) / 3), // Block number (assuming 3 trips per block)
          'Weekday' // Day type
        ];
        
        // Add time for each timepoint
        if (Array.isArray(tripTimes)) {
          tripTimes.forEach(time => {
            row.push(time || '');
          });
        } else {
          // Handle case where tripTimes might not be an array
          schedule.timePoints?.forEach(() => {
            row.push('');
          });
        }
        
        rows.push(row);
      });
    }

    // Process Saturday trips (if available)
    if (schedule.saturday && schedule.saturday.length > 0) {
      schedule.saturday.forEach((tripTimes, tripIndex) => {
        const row = [
          tripIndex + 1,
          Math.ceil((tripIndex + 1) / 3),
          'Saturday'
        ];
        
        if (Array.isArray(tripTimes)) {
          tripTimes.forEach(time => {
            row.push(time || '');
          });
        } else {
          schedule.timePoints?.forEach(() => {
            row.push('');
          });
        }
        
        rows.push(row);
      });
    }

    // Process Sunday trips (if available)
    if (schedule.sunday && schedule.sunday.length > 0) {
      schedule.sunday.forEach((tripTimes, tripIndex) => {
        const row = [
          tripIndex + 1,
          Math.ceil((tripIndex + 1) / 3),
          'Sunday'
        ];
        
        if (Array.isArray(tripTimes)) {
          tripTimes.forEach(time => {
            row.push(time || '');
          });
        } else {
          schedule.timePoints?.forEach(() => {
            row.push('');
          });
        }
        
        rows.push(row);
      });
    }

    return { headers, rows };
  }

  private async exportToJson(options: ExportOptions, dataBundle: ExportDataBundle, exportId: string): Promise<ExportResult> {
    // Implement JSON export logic
    this.updateProgress(exportId, {
      stage: 'formatting',
      progress: 50,
      currentOperation: 'Structuring JSON data',
      startedAt: new Date(),
      completedRecords: 0,
      totalRecords: this.countRecords(options, dataBundle)
    });

    const exportData: any = {
      exportInfo: {
        template: options.template.name,
        exportedAt: new Date().toISOString(),
        format: 'json'
      }
    };

    if (options.scope.includeGeneratedSchedule && dataBundle.summarySchedule) {
      exportData.summarySchedule = dataBundle.summarySchedule;
    }

    if (options.scope.includeConfiguration && dataBundle.blockConfiguration) {
      exportData.blockConfiguration = dataBundle.blockConfiguration;
    }

    if (options.scope.includeAnalysis && dataBundle.timepointsAnalysis) {
      exportData.timepointsAnalysis = dataBundle.timepointsAnalysis;
    }

    if (options.scope.includeMetadata && dataBundle.metadata) {
      exportData.metadata = dataBundle.metadata;
    }

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const filename = this.generateFilename(options, 'json');

    return {
      success: true,
      filename,
      blob,
      fileSize: blob.size,
      format: 'json',
      templateId: options.template.id,
      exportedAt: new Date(),
      processingTime: 0,
      stats: {
        totalRecords: Object.keys(exportData).length,
        recordsByType: { 'data_objects': Object.keys(exportData).length },
        uncompressedSize: blob.size,
        compressedSize: blob.size,
        compressionRatio: 1.0,
        validationPassed: true,
        validationIssues: []
      }
    };
  }

  private async exportToPdf(options: ExportOptions, dataBundle: ExportDataBundle, exportId: string): Promise<ExportResult> {
    // PDF export would require additional libraries like jsPDF
    // For now, return a placeholder
    throw new Error('PDF export not yet implemented');
  }

  private generateFilename(options: ExportOptions, extension: string): string {
    if (options.filename) {
      return `${options.filename}.${extension}`;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const templateName = options.template.name.replace(/[^a-zA-Z0-9]/g, '_');
    return `schedule_${templateName}_${timestamp}.${extension}`;
  }

  private updateProgress(exportId: string, progress: ExportProgress): void {
    const callback = this.progressCallbacks.get(exportId);
    if (callback) {
      callback(progress);
    }
  }

  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const exportService = new ExportService();
import { TimePoint, TravelTime } from '../types/schedule';
import { ParsedExcelData } from './excelParser';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
}

export interface ValidationError {
  type: 'CRITICAL' | 'ERROR';
  code: string;
  message: string;
  details?: any;
}

export interface ValidationWarning {
  type: 'WARNING' | 'INFO';
  code: string;
  message: string;
  details?: any;
}

export interface ValidationStatistics {
  totalTimePoints: number;
  totalTravelTimes: number;
  averageTravelTime: number;
  minTravelTime: number;
  maxTravelTime: number;
  missingConnections: number;
  duplicateConnections: number;
  dayTypeCoverage: {
    weekday: number;
    saturday: number;
    sunday: number;
  };
}

export interface ValidationOptions {
  minTravelTime?: number;
  maxTravelTime?: number;
  requireAllConnections?: boolean;
  allowDuplicates?: boolean;
  minimumTimePoints?: number;
  maximumTimePoints?: number;
  strictTimeValidation?: boolean;
}

const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  minTravelTime: 1,
  maxTravelTime: 120,
  requireAllConnections: false,
  allowDuplicates: false,
  minimumTimePoints: 2,
  maximumTimePoints: 15,
  strictTimeValidation: true
};

export class DataValidator {
  private options: ValidationOptions;

  constructor(options: Partial<ValidationOptions> = {}) {
    this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  }

  validateScheduleData(data: ParsedExcelData): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: this.calculateStatistics(data)
    };

    this.validateTimePoints(data.timePoints, result);
    this.validateTravelTimes(data.travelTimes, result);
    this.validateConnectivity(data.timePoints, data.travelTimes, result);
    this.validateDataConsistency(data, result);
    this.validateFormatQuality(data.format, result);

    result.isValid = result.errors.filter(e => e.type === 'CRITICAL').length === 0;

    return result;
  }

  private validateTimePoints(timePoints: TimePoint[], result: ValidationResult): void {
    if (timePoints.length < (this.options.minimumTimePoints || 2)) {
      result.errors.push({
        type: 'CRITICAL',
        code: 'INSUFFICIENT_TIMEPOINTS',
        message: `Found ${timePoints.length} time points, minimum required is ${this.options.minimumTimePoints}`,
        details: { found: timePoints.length, required: this.options.minimumTimePoints }
      });
    }

    if (timePoints.length > (this.options.maximumTimePoints || 15)) {
      result.warnings.push({
        type: 'WARNING',
        code: 'TOO_MANY_TIMEPOINTS',
        message: `Found ${timePoints.length} time points, which may be excessive`,
        details: { found: timePoints.length, recommended: this.options.maximumTimePoints }
      });
    }

    const duplicateNames = this.findDuplicateTimePointNames(timePoints);
    if (duplicateNames.length > 0) {
      result.errors.push({
        type: 'ERROR',
        code: 'DUPLICATE_TIMEPOINT_NAMES',
        message: `Duplicate time point names found: ${duplicateNames.join(', ')}`,
        details: { duplicates: duplicateNames }
      });
    }

    const invalidNames = timePoints.filter(tp => !tp.name || tp.name.trim().length === 0);
    if (invalidNames.length > 0) {
      result.errors.push({
        type: 'ERROR',
        code: 'INVALID_TIMEPOINT_NAMES',
        message: `${invalidNames.length} time points have invalid or empty names`,
        details: { invalid: invalidNames.map(tp => tp.id) }
      });
    }

    const sequenceErrors = this.validateSequence(timePoints);
    if (sequenceErrors.length > 0) {
      result.warnings.push({
        type: 'WARNING',
        code: 'SEQUENCE_ISSUES',
        message: 'Time point sequence may have issues',
        details: { issues: sequenceErrors }
      });
    }
  }

  private validateTravelTimes(travelTimes: TravelTime[], result: ValidationResult): void {
    if (travelTimes.length === 0) {
      result.errors.push({
        type: 'CRITICAL',
        code: 'NO_TRAVEL_TIMES',
        message: 'No travel times found in the data',
        details: {}
      });
      return;
    }

    const invalidTravelTimes = travelTimes.filter(tt => 
      this.isTravelTimeInvalid(tt)
    );

    if (invalidTravelTimes.length > 0) {
      result.errors.push({
        type: 'ERROR',
        code: 'INVALID_TRAVEL_TIMES',
        message: `${invalidTravelTimes.length} travel times are outside valid range (${this.options.minTravelTime}-${this.options.maxTravelTime} minutes)`,
        details: { 
          count: invalidTravelTimes.length,
          range: { min: this.options.minTravelTime, max: this.options.maxTravelTime }
        }
      });
    }

    const zeroTravelTimes = travelTimes.filter(tt => 
      tt.weekday === 0 && tt.saturday === 0 && tt.sunday === 0
    );

    if (zeroTravelTimes.length > 0) {
      result.warnings.push({
        type: 'WARNING',
        code: 'ZERO_TRAVEL_TIMES',
        message: `${zeroTravelTimes.length} travel time entries have no data for any day type`,
        details: { count: zeroTravelTimes.length }
      });
    }

    if (!this.options.allowDuplicates) {
      const duplicates = this.findDuplicateTravelTimes(travelTimes);
      if (duplicates.length > 0) {
        result.errors.push({
          type: 'ERROR',
          code: 'DUPLICATE_TRAVEL_TIMES',
          message: `${duplicates.length} duplicate travel time entries found`,
          details: { duplicates: duplicates.map(d => `${d.fromTimePoint} -> ${d.toTimePoint}`) }
        });
      }
    }
  }

  private validateConnectivity(timePoints: TimePoint[], travelTimes: TravelTime[], result: ValidationResult): void {
    const timePointIds = new Set(timePoints.map(tp => tp.id));
    
    const orphanedConnections = travelTimes.filter(tt => 
      !timePointIds.has(tt.fromTimePoint) || !timePointIds.has(tt.toTimePoint)
    );

    if (orphanedConnections.length > 0) {
      result.errors.push({
        type: 'ERROR',
        code: 'ORPHANED_CONNECTIONS',
        message: `${orphanedConnections.length} travel times reference non-existent time points`,
        details: { count: orphanedConnections.length }
      });
    }

    if (this.options.requireAllConnections) {
      const missingConnections = this.findMissingConnections(timePoints, travelTimes);
      if (missingConnections.length > 0) {
        result.warnings.push({
          type: 'WARNING',
          code: 'MISSING_CONNECTIONS',
          message: `${missingConnections.length} expected connections are missing`,
          details: { missing: missingConnections }
        });
      }
    }

    const isolatedTimePoints = this.findIsolatedTimePoints(timePoints, travelTimes);
    if (isolatedTimePoints.length > 0) {
      result.warnings.push({
        type: 'WARNING',
        code: 'ISOLATED_TIMEPOINTS',
        message: `${isolatedTimePoints.length} time points have no connections`,
        details: { isolated: isolatedTimePoints.map(tp => tp.name) }
      });
    }
  }

  private validateDataConsistency(data: ParsedExcelData, result: ValidationResult): void {
    const dayTypes = ['weekday', 'saturday', 'sunday'] as const;
    const coverage = { weekday: 0, saturday: 0, sunday: 0 };

    for (const tt of data.travelTimes) {
      for (const dayType of dayTypes) {
        if (tt[dayType] > 0) {
          coverage[dayType]++;
        }
      }
    }

    const totalConnections = data.travelTimes.length;
    for (const dayType of dayTypes) {
      const percent = totalConnections > 0 ? (coverage[dayType] / totalConnections) * 100 : 0;
      if (percent < 50) {
        result.warnings.push({
          type: 'WARNING',
          code: 'LOW_DAY_COVERAGE',
          message: `Low ${dayType} coverage: ${percent.toFixed(1)}% of connections have data`,
          details: { dayType, coverage: percent, connections: coverage[dayType] }
        });
      }
    }

    if (data.metadata.skippedRows > data.metadata.processedRows * 0.3) {
      result.warnings.push({
        type: 'WARNING',
        code: 'HIGH_SKIP_RATE',
        message: `High number of skipped rows: ${data.metadata.skippedRows} out of ${data.metadata.totalRows}`,
        details: { 
          skipped: data.metadata.skippedRows, 
          total: data.metadata.totalRows,
          percentage: (data.metadata.skippedRows / data.metadata.totalRows) * 100
        }
      });
    }
  }

  private validateFormatQuality(format: any, result: ValidationResult): void {
    if (format.confidence < 70) {
      result.warnings.push({
        type: 'WARNING',
        code: 'LOW_FORMAT_CONFIDENCE',
        message: `Format detection confidence is low: ${format.confidence}%`,
        details: { confidence: format.confidence }
      });
    }

    if (format.errors && format.errors.length > 0) {
      for (const error of format.errors) {
        result.errors.push({
          type: 'ERROR',
          code: 'FORMAT_ERROR',
          message: `Format error: ${error}`,
          details: { formatError: error }
        });
      }
    }
  }

  private calculateStatistics(data: ParsedExcelData): ValidationStatistics {
    const travelTimes = data.travelTimes.flatMap(tt => 
      [tt.weekday, tt.saturday, tt.sunday].filter(time => time > 0)
    );

    const dayTypeCoverage = { weekday: 0, saturday: 0, sunday: 0 };
    for (const tt of data.travelTimes) {
      if (tt.weekday > 0) dayTypeCoverage.weekday++;
      if (tt.saturday > 0) dayTypeCoverage.saturday++;
      if (tt.sunday > 0) dayTypeCoverage.sunday++;
    }

    return {
      totalTimePoints: data.timePoints.length,
      totalTravelTimes: data.travelTimes.length,
      averageTravelTime: travelTimes.length > 0 
        ? travelTimes.reduce((sum, time) => sum + time, 0) / travelTimes.length 
        : 0,
      minTravelTime: travelTimes.length > 0 ? Math.min(...travelTimes) : 0,
      maxTravelTime: travelTimes.length > 0 ? Math.max(...travelTimes) : 0,
      missingConnections: this.countMissingConnections(data.timePoints, data.travelTimes),
      duplicateConnections: this.findDuplicateTravelTimes(data.travelTimes).length,
      dayTypeCoverage
    };
  }

  private findDuplicateTimePointNames(timePoints: TimePoint[]): string[] {
    const nameCount = new Map<string, number>();
    for (const tp of timePoints) {
      const count = nameCount.get(tp.name) || 0;
      nameCount.set(tp.name, count + 1);
    }
    
    return Array.from(nameCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([name, _]) => name);
  }

  private validateSequence(timePoints: TimePoint[]): string[] {
    const issues: string[] = [];
    const sequences = timePoints.map(tp => tp.sequence).sort((a, b) => a - b);
    
    for (let i = 0; i < sequences.length - 1; i++) {
      if (sequences[i] === sequences[i + 1]) {
        issues.push(`Duplicate sequence number: ${sequences[i]}`);
      }
    }

    if (sequences.length > 0 && (sequences[0] !== 0 && sequences[0] !== 1)) {
      issues.push('Sequence does not start at 0 or 1');
    }

    return issues;
  }

  private isTravelTimeInvalid(tt: TravelTime): boolean {
    const times = [tt.weekday, tt.saturday, tt.sunday].filter(time => time > 0);
    return times.some(time => 
      time < (this.options.minTravelTime || 1) || 
      time > (this.options.maxTravelTime || 120)
    );
  }

  private findDuplicateTravelTimes(travelTimes: TravelTime[]): TravelTime[] {
    const seen = new Set<string>();
    const duplicates: TravelTime[] = [];

    for (const tt of travelTimes) {
      const key = `${tt.fromTimePoint}->${tt.toTimePoint}`;
      if (seen.has(key)) {
        duplicates.push(tt);
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }

  private findMissingConnections(timePoints: TimePoint[], travelTimes: TravelTime[]): string[] {
    const existingConnections = new Set(
      travelTimes.map(tt => `${tt.fromTimePoint}->${tt.toTimePoint}`)
    );

    const missing: string[] = [];
    for (let i = 0; i < timePoints.length - 1; i++) {
      const from = timePoints[i].id;
      const to = timePoints[i + 1].id;
      const key = `${from}->${to}`;
      
      if (!existingConnections.has(key)) {
        missing.push(key);
      }
    }

    return missing;
  }

  private countMissingConnections(timePoints: TimePoint[], travelTimes: TravelTime[]): number {
    return this.findMissingConnections(timePoints, travelTimes).length;
  }

  private findIsolatedTimePoints(timePoints: TimePoint[], travelTimes: TravelTime[]): TimePoint[] {
    const connectedPoints = new Set<string>();
    
    for (const tt of travelTimes) {
      connectedPoints.add(tt.fromTimePoint);
      connectedPoints.add(tt.toTimePoint);
    }

    return timePoints.filter(tp => !connectedPoints.has(tp.id));
  }
}
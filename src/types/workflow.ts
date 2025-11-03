/**
 * Unified workflow state management types
 */

import { SummarySchedule, TimePoint, ServiceBand, ScheduleValidationResult } from './schedule';
import { ConnectionPoint, ConnectionOptimizationResult, DayType } from './connectionOptimization';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';

export interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

// ServiceBand type is already defined in schedule.ts, using that definition
// The workflow system references ServiceBand from schedule.ts

export interface TimePointData {
  timePeriod: string;
  from: string;
  to: string;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
  isOutlier?: boolean;
  outlierType?: 'high' | 'low';
}

export interface OutlierData {
  timePeriod: string;
  segment: string;
  value: number;
  deviation: number;
  type: 'high' | 'low';
}

export interface TimepointsModification {
  type: 'outlier-removed' | 'service-band-adjusted' | 'travel-time-modified';
  target: string;
  previousValue: any;
  newValue: any;
  timestamp: string;
}

export interface ScheduleGenerationMetadata {
  generationMethod: 'block-based' | 'frequency-based' | 'quick-adjust';
  parameters: Record<string, any>;
  validationResults: ScheduleValidationResult[];
  performanceMetrics: {
    generationTimeMs: number;
    tripCount: number;
    memoryUsageMB: number;
  };
}

/**
 * Unified workflow state that persists across all steps
 */
export interface WorkflowDraftState {
  /** Unique draft identifier that persists across all workflow steps */
  draftId: string;
  
  /** Current step in the workflow */
  currentStep: 'upload' | 'timepoints' | 'blocks' | 'block-config' | 'summary' | 'connections' | 'ready-to-publish';

  /** Indicates whether this draft is using the quick adjust workflow */
  workflowMode?: 'full' | 'quick-adjust';
  
  /** Original uploaded data */
  originalData: {
    fileName: string;
    fileType: 'excel' | 'csv';
    uploadedData: ParsedExcelData | ParsedCsvData;
    uploadTimestamp: string;
  };
  
  /** TimePoints analysis results */
  timepointsAnalysis?: {
    serviceBands: ServiceBand[];
    travelTimeData: TimePointData[];
    outliers: OutlierData[];
    userModifications: TimepointsModification[];
    deletedPeriods?: string[];
    timePeriodServiceBands?: { [timePeriod: string]: string };
    analysisTimestamp: string;
  };
  
  /** Block configuration settings */
  blockConfiguration?: {
    numberOfBuses: number;
    cycleTimeMinutes: number;
    automateBlockStartTimes: boolean;
    blockConfigurations: BlockConfiguration[];
    configurationTimestamp: string;
  };
  
  /** Generated summary schedule (still draft) */
  summarySchedule?: {
    schedule: SummarySchedule;
    metadata: ScheduleGenerationMetadata;
    generationTimestamp: string;
  };

  /** Connection optimization results */
  connectionOptimization?: {
    selectedConnections: ConnectionPoint[];
    lastResult?: ConnectionOptimizationResult;
    optimizationHistory: ConnectionOptimizationResult[];
    optimizationTimestamp: string;
  };
  
  /** Workflow metadata */
  metadata: {
    createdAt: string;
    lastModifiedAt: string;
    lastModifiedStep: string;
    version: number;
    isPublished: boolean;
    publishedAt?: string;
    isQuickAdjust?: boolean;
    quickAdjustPrimaryDay?: DayType;
  };
}

export interface WorkflowDraftResult {
  success: boolean;
  draftId?: string;
  scheduleId?: string;
  error?: string;
}

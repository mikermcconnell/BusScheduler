import { DataValidator } from './validator';
import { ParsedExcelData } from './excelParser';

describe('DataValidator', () => {
  const createMockData = (overrides: Partial<ParsedExcelData> = {}): ParsedExcelData => ({
    timePoints: [
      { id: 'tp_0', name: 'Station A', sequence: 0 },
      { id: 'tp_1', name: 'Station B', sequence: 1 },
      { id: 'tp_2', name: 'Station C', sequence: 2 }
    ],
    travelTimes: [
      { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 15, saturday: 18, sunday: 20 },
      { fromTimePoint: 'tp_1', toTimePoint: 'tp_2', weekday: 12, saturday: 15, sunday: 18 }
    ],
    format: {
      hasHeader: true,
      headerRow: 0,
      timePointColumns: [1, 2, 3],
      timePointNames: ['Station A', 'Station B', 'Station C'],
      dataStartRow: 1,
      timeFormat: 'HH:MM' as const,
      dayTypeColumns: {},
      confidence: 85,
      errors: [],
      warnings: []
    },
    metadata: {
      totalRows: 10,
      processedRows: 8,
      skippedRows: 2
    },
    ...overrides
  });

  describe('validateScheduleData', () => {
    test('should validate good quality data successfully', () => {
      const mockData = createMockData();
      const validator = new DataValidator();
      
      const result = validator.validateScheduleData(mockData);

      expect(result.isValid).toBe(true);
      expect(result.errors.filter(e => e.type === 'CRITICAL').length).toBe(0);
      expect(result.statistics.totalTimePoints).toBe(3);
      expect(result.statistics.totalTravelTimes).toBe(2);
    });

    test('should detect insufficient time points', () => {
      const mockData = createMockData({
        timePoints: [{ id: 'tp_0', name: 'Station A', sequence: 0 }]
      });
      
      const validator = new DataValidator({ minimumTimePoints: 2 });
      const result = validator.validateScheduleData(mockData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_TIMEPOINTS')).toBe(true);
    });

    test('should detect no travel times', () => {
      const mockData = createMockData({
        travelTimes: []
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'NO_TRAVEL_TIMES')).toBe(true);
    });

    test('should detect invalid travel times', () => {
      const mockData = createMockData({
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 150, saturday: 0, sunday: 0 } // 150 minutes is too long
        ]
      });
      
      const validator = new DataValidator({ maxTravelTime: 120 });
      const result = validator.validateScheduleData(mockData);

      expect(result.errors.some(e => e.code === 'INVALID_TRAVEL_TIMES')).toBe(true);
    });

    test('should detect duplicate time point names', () => {
      const mockData = createMockData({
        timePoints: [
          { id: 'tp_0', name: 'Station A', sequence: 0 },
          { id: 'tp_1', name: 'Station A', sequence: 1 } // Duplicate name
        ]
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.errors.some(e => e.code === 'DUPLICATE_TIMEPOINT_NAMES')).toBe(true);
    });

    test('should detect orphaned connections', () => {
      const mockData = createMockData({
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'nonexistent', weekday: 15, saturday: 18, sunday: 20 }
        ]
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.errors.some(e => e.code === 'ORPHANED_CONNECTIONS')).toBe(true);
    });

    test('should warn about zero travel times', () => {
      const mockData = createMockData({
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 0, saturday: 0, sunday: 0 }
        ]
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.warnings.some(w => w.code === 'ZERO_TRAVEL_TIMES')).toBe(true);
    });

    test('should detect low day coverage', () => {
      const mockData = createMockData({
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 15, saturday: 0, sunday: 0 },
          { fromTimePoint: 'tp_1', toTimePoint: 'tp_2', weekday: 12, saturday: 0, sunday: 0 }
        ]
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.warnings.some(w => w.code === 'LOW_DAY_COVERAGE')).toBe(true);
    });

    test('should warn about high skip rate', () => {
      const mockData = createMockData({
        metadata: {
          totalRows: 100,
          processedRows: 30,
          skippedRows: 70 // 70% skip rate
        }
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.warnings.some(w => w.code === 'HIGH_SKIP_RATE')).toBe(true);
    });

    test('should find isolated time points', () => {
      const mockData = createMockData({
        timePoints: [
          { id: 'tp_0', name: 'Station A', sequence: 0 },
          { id: 'tp_1', name: 'Station B', sequence: 1 },
          { id: 'tp_2', name: 'Station C', sequence: 2 }
        ],
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 15, saturday: 18, sunday: 20 }
          // tp_2 is isolated - no connections to/from it
        ]
      });
      
      const validator = new DataValidator();
      const result = validator.validateScheduleData(mockData);

      expect(result.warnings.some(w => w.code === 'ISOLATED_TIMEPOINTS')).toBe(true);
    });
  });

  describe('statistics calculation', () => {
    test('should calculate statistics correctly', () => {
      const mockData = createMockData();
      const validator = new DataValidator();
      
      const result = validator.validateScheduleData(mockData);

      expect(result.statistics.totalTimePoints).toBe(3);
      expect(result.statistics.totalTravelTimes).toBe(2);
      expect(result.statistics.averageTravelTime).toBeCloseTo(16.33, 1); // (15+18+20+12+15+18)/6
      expect(result.statistics.minTravelTime).toBe(12);
      expect(result.statistics.maxTravelTime).toBe(20);
      expect(result.statistics.dayTypeCoverage.weekday).toBe(2);
      expect(result.statistics.dayTypeCoverage.saturday).toBe(2);
      expect(result.statistics.dayTypeCoverage.sunday).toBe(2);
    });
  });

  describe('validation options', () => {
    test('should respect custom validation options', () => {
      const mockData = createMockData({
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 5, saturday: 0, sunday: 0 } // Below custom minimum
        ]
      });
      
      const validator = new DataValidator({
        minTravelTime: 10,
        maxTravelTime: 60
      });
      
      const result = validator.validateScheduleData(mockData);

      expect(result.errors.some(e => e.code === 'INVALID_TRAVEL_TIMES')).toBe(true);
    });

    test('should allow duplicates when configured', () => {
      const mockData = createMockData({
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 15, saturday: 18, sunday: 20 },
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 16, saturday: 19, sunday: 21 } // Duplicate connection
        ]
      });
      
      const validatorStrict = new DataValidator({ allowDuplicates: false });
      const resultStrict = validatorStrict.validateScheduleData(mockData);
      expect(resultStrict.errors.some(e => e.code === 'DUPLICATE_TRAVEL_TIMES')).toBe(true);

      const validatorPermissive = new DataValidator({ allowDuplicates: true });
      const resultPermissive = validatorPermissive.validateScheduleData(mockData);
      expect(resultPermissive.errors.some(e => e.code === 'DUPLICATE_TRAVEL_TIMES')).toBe(false);
    });
  });
});
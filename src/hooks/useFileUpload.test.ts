import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from './useFileUpload';

// Mock the data extractor
jest.mock('../utils/dataExtractor', () => ({
  ScheduleDataExtractor: jest.fn().mockImplementation(() => ({
    extractFromFile: jest.fn().mockResolvedValue({
      success: true,
      data: {
        timePoints: [
          { id: 'tp_0', name: 'Station A', sequence: 0 },
          { id: 'tp_1', name: 'Station B', sequence: 1 }
        ],
        travelTimes: [
          { fromTimePoint: 'tp_0', toTimePoint: 'tp_1', weekday: 15, saturday: 18, sunday: 20 }
        ],
        format: { confidence: 85, errors: [], warnings: [] },
        metadata: { totalRows: 10, processedRows: 8, skippedRows: 2 }
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        statistics: {
          totalTimePoints: 2,
          totalTravelTimes: 1,
          averageTravelTime: 17.7,
          minTravelTime: 15,
          maxTravelTime: 20,
          missingConnections: 0,
          duplicateConnections: 0,
          dayTypeCoverage: { weekday: 1, saturday: 1, sunday: 1 }
        }
      }
    }),
    createQualityReport: jest.fn().mockReturnValue('Mock quality report')
  }))
}));

describe('useFileUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with default state', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.extractedData).toBe(null);
    expect(result.current.validation).toBe(null);
    expect(result.current.fileName).toBe(null);
    expect(result.current.qualityReport).toBe(null);
  });

  test('should reject files that are too large', async () => {
    const { result } = renderHook(() => useFileUpload());

    const largeFile = new File([''], 'large.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Mock file size to be larger than 10MB
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

    let uploadResult: any;
    await act(async () => {
      uploadResult = await result.current.uploadFile(largeFile);
    });

    expect(uploadResult?.success).toBe(false);
    expect(uploadResult?.error).toContain('exceeds maximum allowed size');
    expect(result.current.error).toContain('exceeds maximum allowed size');
  });

  test('should reject unsupported file types', async () => {
    const { result } = renderHook(() => useFileUpload());

    const unsupportedFile = new File([''], 'document.pdf', {
      type: 'application/pdf',
    });

    let uploadResult: any;
    await act(async () => {
      uploadResult = await result.current.uploadFile(unsupportedFile);
    });

    expect(uploadResult?.success).toBe(false);
    expect(uploadResult?.error).toContain('not supported');
    expect(result.current.error).toContain('not supported');
  });

  test('should successfully process valid Excel file', async () => {
    const { result } = renderHook(() => useFileUpload());

    const validFile = new File(['mock excel content'], 'schedule.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    let uploadResult: any;
    await act(async () => {
      uploadResult = await result.current.uploadFile(validFile);
    });

    expect(uploadResult?.success).toBe(true);
    expect(uploadResult?.extractedData).toBeDefined();
    expect(uploadResult?.validation).toBeDefined();
    expect(uploadResult?.qualityReport).toBeDefined();
    expect(result.current.extractedData).toBeDefined();
    expect(result.current.validation).toBeDefined();
    expect(result.current.fileName).toBe('schedule.xlsx');
  });

  test('should clear state when clearFile is called', () => {
    const { result } = renderHook(() => useFileUpload());

    act(() => {
      result.current.clearFile();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.extractedData).toBe(null);
    expect(result.current.validation).toBe(null);
    expect(result.current.fileName).toBe(null);
    expect(result.current.qualityReport).toBe(null);
  });
});
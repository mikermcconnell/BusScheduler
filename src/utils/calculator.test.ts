/**
 * Tests for Travel Time Calculator
 */

import {
  timeToMinutes,
  minutesToTime,
  buildTravelMatrix,
  calculateTravelTimes,
  calculateSequentialTravelTimes,
  generateTripSchedule,
  generateTripsFromTimeBands,
  convertToScheduleMatrix,
  validateTravelTimes,
  calculateOptimizedSchedule,
  handleMissingConnections,
  validateMatrixCompleteness,
  DayType,
  TimeBand,
  TravelTimeMatrix
} from './calculator';

import { TimePoint, TravelTime } from '../types';

// Test data
const mockTimePoints: TimePoint[] = [
  { id: 'tp1', name: 'Downtown Terminal', sequence: 1 },
  { id: 'tp2', name: 'Main Street', sequence: 2 },
  { id: 'tp3', name: 'Shopping Center', sequence: 3 },
  { id: 'tp4', name: 'University', sequence: 4 }
];

const mockTravelTimes: TravelTime[] = [
  { fromTimePoint: 'tp1', toTimePoint: 'tp2', weekday: 5, saturday: 6, sunday: 7 },
  { fromTimePoint: 'tp2', toTimePoint: 'tp3', weekday: 8, saturday: 9, sunday: 10 },
  { fromTimePoint: 'tp3', toTimePoint: 'tp4', weekday: 12, saturday: 13, sunday: 14 }
];

describe('Time Conversion Functions', () => {
  test('timeToMinutes converts time string to minutes correctly', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('12:45')).toBe(765);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  test('minutesToTime converts minutes to time string correctly', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(90)).toBe('01:30');
    expect(minutesToTime(765)).toBe('12:45');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  test('time conversion functions are reversible', () => {
    const testTimes = ['06:30', '12:00', '18:45', '23:30'];
    testTimes.forEach(time => {
      const minutes = timeToMinutes(time);
      const convertedBack = minutesToTime(minutes);
      expect(convertedBack).toBe(time);
    });
  });
});

describe('Travel Matrix Functions', () => {
  test('buildTravelMatrix creates correct matrix structure', () => {
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    
    expect(matrix['tp1']['tp2']).toBe(5);
    expect(matrix['tp2']['tp3']).toBe(8);
    expect(matrix['tp3']['tp4']).toBe(12);
    
    // Test bidirectional routes
    expect(matrix['tp2']['tp1']).toBe(5);
    expect(matrix['tp3']['tp2']).toBe(8);
    expect(matrix['tp4']['tp3']).toBe(12);
  });

  test('buildTravelMatrix handles different day types', () => {
    const weekdayMatrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const saturdayMatrix = buildTravelMatrix(mockTravelTimes, 'saturday');
    const sundayMatrix = buildTravelMatrix(mockTravelTimes, 'sunday');
    
    expect(weekdayMatrix['tp1']['tp2']).toBe(5);
    expect(saturdayMatrix['tp1']['tp2']).toBe(6);
    expect(sundayMatrix['tp1']['tp2']).toBe(7);
  });

  test('calculateTravelTimes returns matrices for all day types', () => {
    const matrices = calculateTravelTimes(mockTimePoints, mockTravelTimes);
    
    expect(matrices.weekday).toBeDefined();
    expect(matrices.saturday).toBeDefined();
    expect(matrices.sunday).toBeDefined();
    
    expect(matrices.weekday['tp1']['tp2']).toBe(5);
    expect(matrices.saturday['tp1']['tp2']).toBe(6);
    expect(matrices.sunday['tp1']['tp2']).toBe(7);
  });
});

describe('Sequential Travel Time Calculations', () => {
  test('calculateSequentialTravelTimes computes cumulative times correctly', () => {
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const sequentialTimes = calculateSequentialTravelTimes(mockTimePoints, matrix);
    
    expect(sequentialTimes['tp1']).toBe(0);      // Starting point
    expect(sequentialTimes['tp2']).toBe(5);      // 0 + 5
    expect(sequentialTimes['tp3']).toBe(13);     // 5 + 8
    expect(sequentialTimes['tp4']).toBe(25);     // 13 + 12
  });

  test('calculateSequentialTravelTimes handles unordered time points', () => {
    const unorderedTimePoints = [
      { id: 'tp3', name: 'Shopping Center', sequence: 3 },
      { id: 'tp1', name: 'Downtown Terminal', sequence: 1 },
      { id: 'tp4', name: 'University', sequence: 4 },
      { id: 'tp2', name: 'Main Street', sequence: 2 }
    ];
    
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const sequentialTimes = calculateSequentialTravelTimes(unorderedTimePoints, matrix);
    
    expect(sequentialTimes['tp1']).toBe(0);
    expect(sequentialTimes['tp2']).toBe(5);
    expect(sequentialTimes['tp3']).toBe(13);
    expect(sequentialTimes['tp4']).toBe(25);
  });
});

describe('Trip Schedule Generation', () => {
  test('generateTripSchedule creates valid trip schedule', () => {
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const result = generateTripSchedule('test-trip', '08:00', mockTimePoints, matrix);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.scheduleEntries).toHaveLength(4);
    expect(result.totalTravelTime).toBe(25);
    
    // Check specific times
    const tp1Entry = result.scheduleEntries.find(e => e.timePointId === 'tp1');
    const tp2Entry = result.scheduleEntries.find(e => e.timePointId === 'tp2');
    const tp4Entry = result.scheduleEntries.find(e => e.timePointId === 'tp4');
    
    expect(tp1Entry?.arrivalTime).toBe('08:00');
    expect(tp2Entry?.arrivalTime).toBe('08:05');
    expect(tp4Entry?.arrivalTime).toBe('08:25');
  });

  test('generateTripSchedule handles edge case times', () => {
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const result = generateTripSchedule('test-trip', '23:50', mockTimePoints, matrix);
    
    expect(result.isValid).toBe(true);
    
    const tp4Entry = result.scheduleEntries.find(e => e.timePointId === 'tp4');
    expect(tp4Entry?.arrivalTime).toBe('24:15'); // This would need handling for day overflow
  });
});

describe('Time Band Processing', () => {
  test('generateTripsFromTimeBands creates correct number of trips', () => {
    const timeBands = [
      { startTime: '08:00', endTime: '08:30', frequency: 15 },
      { startTime: '17:00', endTime: '17:30', frequency: 10 }
    ];
    
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const trips = generateTripsFromTimeBands(timeBands, mockTimePoints, matrix, 'weekday');
    
    // Band 1: 08:00, 08:15, 08:30 = 3 trips
    // Band 2: 17:00, 17:10, 17:20, 17:30 = 4 trips
    expect(trips).toHaveLength(7);
    
    expect(trips[0].tripId).toBe('weekday_band1_trip1');
    expect(trips[3].tripId).toBe('weekday_band2_trip4');
  });

  test('convertToScheduleMatrix creates proper matrix format', () => {
    const mockTrips = [
      {
        tripId: 'trip1',
        scheduleEntries: [
          { timePointId: 'tp1', arrivalTime: '08:00', departureTime: '08:00' },
          { timePointId: 'tp2', arrivalTime: '08:05', departureTime: '08:05' }
        ],
        totalTravelTime: 5,
        isValid: true,
        errors: []
      }
    ];
    
    const matrix = convertToScheduleMatrix(mockTrips, mockTimePoints.slice(0, 2));
    
    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toEqual(['08:00', '08:05']);
  });
});

describe('Validation Functions', () => {
  test('validateTravelTimes identifies valid data', () => {
    const result = validateTravelTimes(mockTimePoints, mockTravelTimes);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validateTravelTimes identifies missing travel times', () => {
    const incompleteTimePoints = [...mockTimePoints, { id: 'tp5', name: 'Airport', sequence: 5 }];
    const result = validateTravelTimes(incompleteTimePoints, mockTravelTimes);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Missing travel time');
  });

  test('validateTravelTimes identifies negative travel times', () => {
    const invalidTravelTimes = [
      ...mockTravelTimes,
      { fromTimePoint: 'tp4', toTimePoint: 'tp1', weekday: -5, saturday: 6, sunday: 7 }
    ];
    
    const result = validateTravelTimes(mockTimePoints, invalidTravelTimes);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('Negative travel time'))).toBe(true);
  });

  test('validateTravelTimes identifies unrealistic travel times', () => {
    const unrealisticTravelTimes = [
      ...mockTravelTimes,
      { fromTimePoint: 'tp1', toTimePoint: 'tp4', weekday: 150, saturday: 150, sunday: 150 }
    ];
    
    const result = validateTravelTimes(mockTimePoints, unrealisticTravelTimes);
    
    expect(result.warnings.some(warning => warning.includes('Unusually long travel time'))).toBe(true);
  });
});

describe('Optimized Schedule Calculation', () => {
  test('calculateOptimizedSchedule handles complete workflow', () => {
    const timeBands = {
      weekday: [{ startTime: '08:00', endTime: '08:15', frequency: 15 }],
      saturday: [{ startTime: '09:00', endTime: '09:15', frequency: 15 }],
      sunday: [{ startTime: '10:00', endTime: '10:15', frequency: 15 }]
    };
    
    const result = calculateOptimizedSchedule(mockTimePoints, mockTravelTimes, timeBands);
    
    expect(result.weekday).toHaveLength(2); // 08:00, 08:15
    expect(result.saturday).toHaveLength(2); // 09:00, 09:15
    expect(result.sunday).toHaveLength(2); // 10:00, 10:15
    
    expect(result.metadata.totalTimePoints).toBe(4);
    expect(result.metadata.totalTrips).toBe(6);
    expect(result.metadata.calculationTime).toBeGreaterThan(0);
  });

  test('calculateOptimizedSchedule throws error for invalid data', () => {
    const invalidTravelTimes = [
      { fromTimePoint: 'tp1', toTimePoint: 'tp2', weekday: -5, saturday: 6, sunday: 7 }
    ];
    
    const timeBands = {
      weekday: [{ startTime: '08:00', endTime: '08:15', frequency: 15 }],
      saturday: [],
      sunday: []
    };
    
    expect(() => {
      calculateOptimizedSchedule(mockTimePoints.slice(0, 2), invalidTravelTimes, timeBands);
    }).toThrow('Invalid travel time data');
  });
});

describe('Edge Cases and Error Handling', () => {
  test('handles empty time points array', () => {
    const result = validateTravelTimes([], []);
    expect(result.isValid).toBe(true);
  });

  test('handles single time point', () => {
    const singleTimePoint = [mockTimePoints[0]];
    const result = validateTravelTimes(singleTimePoint, []);
    expect(result.isValid).toBe(true);
  });

  test('handles missing travel matrix entries gracefully', () => {
    const incompleteMatrix = { 'tp1': { 'tp2': 5 } };
    const sequentialTimes = calculateSequentialTravelTimes(mockTimePoints, incompleteMatrix);
    
    // Should handle missing entries by using 0 as default
    expect(sequentialTimes['tp1']).toBe(0);
    expect(sequentialTimes['tp2']).toBe(5);
    expect(sequentialTimes['tp3']).toBe(5); // No additional travel time due to missing entry
  });
});

// Enhanced tests for Phase 3 functionality
describe('Enhanced Matrix Functions (Phase 3)', () => {
  const extendedTimePoints: TimePoint[] = [
    ...mockTimePoints,
    { id: 'tp5', name: 'Airport', sequence: 5 }
  ];

  describe('handleMissingConnections', () => {
    test('fills missing connections with estimated times', () => {
      const incompleteMatrix: TravelTimeMatrix = {
        'tp1': { 'tp2': 5 },
        'tp2': { 'tp3': 8, 'tp1': 5 }
      };

      const enhancedMatrix = handleMissingConnections(extendedTimePoints, incompleteMatrix);
      
      // Should have estimated connection from tp1 to tp3
      expect(enhancedMatrix['tp1']['tp3']).toBeDefined();
      expect(enhancedMatrix['tp1']['tp3']).toBeGreaterThan(0);
      
      // Should preserve existing connections
      expect(enhancedMatrix['tp1']['tp2']).toBe(5);
      expect(enhancedMatrix['tp2']['tp3']).toBe(8);
    });

    test('handles adjacent time points with default travel time', () => {
      const emptyMatrix: TravelTimeMatrix = {};
      const enhanced = handleMissingConnections(mockTimePoints, emptyMatrix);
      
      // Adjacent points should have default 5-minute travel time
      expect(enhanced['tp1']['tp2']).toBe(5);
      expect(enhanced['tp2']['tp3']).toBe(5);
      expect(enhanced['tp3']['tp4']).toBe(5);
    });

    test('estimates non-adjacent connections correctly', () => {
      const partialMatrix: TravelTimeMatrix = {
        'tp1': { 'tp2': 5 },
        'tp2': { 'tp3': 8, 'tp1': 5 }
      };

      const enhanced = handleMissingConnections(mockTimePoints, partialMatrix);
      
      // tp1 to tp3 should be estimated (sequence difference = 2, so 2 * 5 = 10)
      expect(enhanced['tp1']['tp3']).toBe(10);
    });
  });

  describe('validateMatrixCompleteness', () => {
    test('validates complete matrix correctly', () => {
      const completeMatrix: TravelTimeMatrix = {
        'tp1': { 'tp2': 5 },
        'tp2': { 'tp3': 8, 'tp1': 5 },
        'tp3': { 'tp4': 12, 'tp2': 8 },
        'tp4': { 'tp3': 12 }
      };

      const result = validateMatrixCompleteness(mockTimePoints, completeMatrix);
      expect(result.isComplete).toBe(true);
      expect(result.missingConnections).toHaveLength(0);
    });

    test('identifies missing consecutive connections', () => {
      const incompleteMatrix: TravelTimeMatrix = {
        'tp1': { 'tp2': 5 },
        'tp2': { 'tp1': 5 }
        // Missing tp2->tp3, tp3->tp4
      };

      const result = validateMatrixCompleteness(mockTimePoints, incompleteMatrix);
      expect(result.isComplete).toBe(false);
      expect(result.missingConnections).toContain('Main Street -> Shopping Center');
      expect(result.missingConnections).toContain('Shopping Center -> University');
    });
  });
});

describe('Performance Tests (Phase 3)', () => {
  test('matrix calculation performance with max data (15x15)', () => {
    // Create large dataset (15x15 matrix scenario)
    const largeTimePoints: TimePoint[] = Array.from({ length: 15 }, (_, i) => ({
      id: `tp${i + 1}`,
      name: `Station ${String.fromCharCode(65 + i)}`,
      sequence: i + 1
    }));
    
    // Create sequential travel times only (not full matrix)
    const largeTravelTimes: TravelTime[] = [];
    for (let i = 0; i < largeTimePoints.length - 1; i++) {
      largeTravelTimes.push({
        fromTimePoint: `tp${i + 1}`,
        toTimePoint: `tp${i + 2}`,
        weekday: Math.floor(Math.random() * 10) + 5,
        saturday: Math.floor(Math.random() * 10) + 7,
        sunday: Math.floor(Math.random() * 10) + 8
      });
    }
    
    const startTime = Date.now();
    const matrices = calculateTravelTimes(largeTimePoints, largeTravelTimes);
    const executionTime = Date.now() - startTime;
    
    // Should complete matrix calculation quickly (less than 500ms)
    expect(executionTime).toBeLessThan(500);
    expect(Object.keys(matrices.weekday)).toHaveLength(15);
  });

  test('optimized schedule calculation handles large datasets', () => {
    // Create larger dataset for performance testing
    const largeTimePoints: TimePoint[] = Array.from({ length: 15 }, (_, i) => ({
      id: `tp${i + 1}`,
      name: `Station ${String.fromCharCode(65 + i)}`,
      sequence: i + 1
    }));
    
    const largeTravelTimes: TravelTime[] = [];
    for (let i = 0; i < largeTimePoints.length - 1; i++) {
      largeTravelTimes.push({
        fromTimePoint: `tp${i + 1}`,
        toTimePoint: `tp${i + 2}`,
        weekday: Math.floor(Math.random() * 10) + 5,
        saturday: Math.floor(Math.random() * 10) + 7,
        sunday: Math.floor(Math.random() * 10) + 8
      });
    }
    
    const timeBands = {
      weekday: [{ startTime: '06:00', endTime: '08:00', frequency: 30 }], // 4 trips
      saturday: [{ startTime: '08:00', endTime: '09:00', frequency: 60 }], // 1 trip
      sunday: [{ startTime: '09:00', endTime: '10:00', frequency: 60 }] // 1 trip
    };
    
    const startTime = Date.now();
    const result = calculateOptimizedSchedule(largeTimePoints, largeTravelTimes, timeBands);
    const executionTime = Date.now() - startTime;
    
    // Should complete within reasonable time (less than 1 second)
    expect(executionTime).toBeLessThan(1000);
    expect(result.metadata.totalTimePoints).toBe(15);
    expect(result.weekday.length).toBeGreaterThan(0);
    expect(result.metadata.calculationTime).toBeGreaterThan(0);
  });

  test('batch processing performance with many trips', () => {
    const manyTimeBands: TimeBand[] = Array.from({ length: 10 }, (_, i) => ({
      startTime: `${6 + i}:00`,
      endTime: `${6 + i}:45`,
      frequency: 15 // Every 15 minutes = 3 trips per hour (0, 15, 30, 45)
    }));
    
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    
    const startTime = Date.now();
    const trips = generateTripsFromTimeBands(manyTimeBands, mockTimePoints, matrix, 'weekday');
    const executionTime = Date.now() - startTime;
    
    expect(executionTime).toBeLessThan(200); // Less than 200ms
    expect(trips).toHaveLength(40); // 10 bands * 4 trips each (0, 15, 30, 45 minutes)
  });
});

describe('Enhanced Edge Cases (Phase 3)', () => {
  test('handles midnight boundary times correctly', () => {
    const midnightTimeBands: TimeBand[] = [
      { startTime: '23:30', endTime: '23:59', frequency: 30 },
      { startTime: '00:00', endTime: '01:00', frequency: 60 }
    ];
    
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    
    expect(() => {
      generateTripsFromTimeBands(midnightTimeBands, mockTimePoints, matrix, 'weekday');
    }).not.toThrow();
  });

  test('handles very high frequency time bands', () => {
    const highFrequencyBand: TimeBand[] = [
      { startTime: '06:00', endTime: '06:59', frequency: 1 } // Every minute for 60 minutes
    ];
    
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    const trips = generateTripsFromTimeBands(highFrequencyBand, mockTimePoints, matrix, 'weekday');
    
    expect(trips).toHaveLength(60); // 60 minutes = 60 trips (06:00 to 06:59 inclusive)
  });

  test('handles time points with duplicate sequences', () => {
    const duplicateSequencePoints: TimePoint[] = [
      { id: 'tp1', name: 'Station A', sequence: 1 },
      { id: 'tp2', name: 'Station B', sequence: 1 }, // Duplicate sequence
      { id: 'tp3', name: 'Station C', sequence: 2 }
    ];
    
    const matrix = buildTravelMatrix(mockTravelTimes, 'weekday');
    
    expect(() => {
      calculateSequentialTravelTimes(duplicateSequencePoints, matrix);
    }).not.toThrow();
  });

  test('handles missing connections in optimized calculation', () => {
    // Create travel times with all consecutive connections (to pass validation)
    // but missing some intermediate connections that will be filled by enhancement
    const validTravelTimes: TravelTime[] = [
      { fromTimePoint: 'tp1', toTimePoint: 'tp2', weekday: 8, saturday: 10, sunday: 12 },
      { fromTimePoint: 'tp2', toTimePoint: 'tp3', weekday: 6, saturday: 7, sunday: 8 },
      { fromTimePoint: 'tp3', toTimePoint: 'tp4', weekday: 10, saturday: 11, sunday: 13 }
    ];
    
    const timeBands = {
      weekday: [{ startTime: '06:00', endTime: '06:30', frequency: 30 }],
      saturday: [],
      sunday: []
    };
    
    // Should not throw error and should enhance the matrix with missing connections
    expect(() => {
      const result = calculateOptimizedSchedule(mockTimePoints, validTravelTimes, timeBands);
      expect(result.weekday.length).toBe(2); // 06:00 and 06:30
    }).not.toThrow();
  });

  test('validates enhanced schedule data with warnings', () => {
    const warnableTravelTimes: TravelTime[] = [
      { fromTimePoint: 'tp1', toTimePoint: 'tp2', weekday: 150, saturday: 10, sunday: 12 }, // Long time
      { fromTimePoint: 'tp2', toTimePoint: 'tp3', weekday: 6, saturday: 7, sunday: 8 }
    ];
    
    const result = validateTravelTimes(mockTimePoints.slice(0, 3), warnableTravelTimes);
    
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('Unusually long travel time'))).toBe(true);
  });
});
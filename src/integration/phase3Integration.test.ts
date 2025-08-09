/**
 * Phase 3 Integration Tests
 * Tests the complete integration between calculator, scheduleService, and summaryGenerator
 */

import { TimePoint, TravelTime, SummarySchedule } from '../types';
import { scheduleService, ScheduleGenerationOptions } from '../services/scheduleService';
import {
  calculateOptimizedSchedule,
  TimeBand
} from '../utils/calculator';
import {
  generateSummaryDisplayData,
  SummaryFormatOptions
} from '../utils/summaryGenerator';

describe('Phase 3 Integration Tests', () => {
  // Mock realistic bus route data
  const realTimePoints: TimePoint[] = [
    { id: 'downtown', name: 'Downtown Terminal', sequence: 1 },
    { id: 'mainst', name: 'Main Street', sequence: 2 },
    { id: 'mall', name: 'Shopping Mall', sequence: 3 },
    { id: 'university', name: 'University Campus', sequence: 4 },
    { id: 'hospital', name: 'General Hospital', sequence: 5 }
  ];

  const realTravelTimes: TravelTime[] = [
    { fromTimePoint: 'downtown', toTimePoint: 'mainst', weekday: 8, saturday: 9, sunday: 10 },
    { fromTimePoint: 'mainst', toTimePoint: 'mall', weekday: 6, saturday: 7, sunday: 8 },
    { fromTimePoint: 'mall', toTimePoint: 'university', weekday: 12, saturday: 13, sunday: 14 },
    { fromTimePoint: 'university', toTimePoint: 'hospital', weekday: 7, saturday: 8, sunday: 9 }
  ];

  const realTimeBands: { weekday: TimeBand[]; saturday: TimeBand[]; sunday: TimeBand[]; } = {
    weekday: [
      { startTime: '06:00', endTime: '09:00', frequency: 15 }, // Peak morning
      { startTime: '09:00', endTime: '15:00', frequency: 30 }, // Mid-day
      { startTime: '15:00', endTime: '18:00', frequency: 10 }, // Peak afternoon
      { startTime: '18:00', endTime: '22:00', frequency: 20 }  // Evening
    ],
    saturday: [
      { startTime: '07:00', endTime: '12:00', frequency: 20 }, // Morning
      { startTime: '12:00', endTime: '20:00', frequency: 30 }  // Afternoon/Evening
    ],
    sunday: [
      { startTime: '08:00', endTime: '18:00', frequency: 45 }  // All day
    ]
  };

  describe('End-to-End Schedule Generation', () => {
    test('generates complete schedule from raw data to display format', async () => {
      // Step 1: Create schedule generation options
      const options: ScheduleGenerationOptions = {
        routeId: 'R001',
        routeName: 'Metro Express',
        direction: 'Inbound',
        effectiveDate: new Date('2024-01-01'),
        expirationDate: new Date('2024-12-31'),
        timeBands: realTimeBands
      };

      // Step 2: Generate summary schedule using the service
      const summarySchedule = await scheduleService.generateSummarySchedule(
        realTimePoints,
        realTravelTimes,
        options
      );

      // Verify summary schedule structure
      expect(summarySchedule.routeId).toBe('R001');
      expect(summarySchedule.routeName).toBe('Metro Express');
      expect(summarySchedule.timePoints).toHaveLength(5);
      expect(summarySchedule.weekday.length).toBeGreaterThan(0);
      expect(summarySchedule.saturday.length).toBeGreaterThan(0);
      expect(summarySchedule.sunday.length).toBeGreaterThan(0);

      // Step 3: Get calculation results for display formatting
      const calculationResults = scheduleService.getLastCalculationResults();
      expect(calculationResults).not.toBeNull();
      expect(calculationResults!.metadata.totalTimePoints).toBe(5);

      // Step 4: Generate display data
      const formatOptions: SummaryFormatOptions = {
        includeTimePointNames: true,
        timeFormat: '24h',
        includeStatistics: true
      };

      const displayData = generateSummaryDisplayData(
        summarySchedule,
        calculationResults!,
        formatOptions
      );

      // Verify display data structure
      expect(displayData.routeInfo.routeName).toBe('Metro Express');
      expect(displayData.timePoints).toHaveLength(5);
      expect(displayData.schedules.weekday.tripCount).toBeGreaterThan(0);
      expect(displayData.statistics.totalTrips.total).toBeGreaterThan(0);

      // Verify time point sequence is maintained
      const sortedTimePoints = displayData.timePoints.sort((a, b) => a.sequence - b.sequence);
      expect(sortedTimePoints[0].name).toBe('Downtown Terminal');
      expect(sortedTimePoints[4].name).toBe('General Hospital');
    });

    test('handles large dataset performance requirements', async () => {
      // Create a larger 15-stop route
      const largeTimePoints: TimePoint[] = Array.from({ length: 15 }, (_, i) => ({
        id: `stop${i + 1}`,
        name: `Stop ${i + 1}`,
        sequence: i + 1
      }));

      const largeTravelTimes: TravelTime[] = [];
      for (let i = 0; i < largeTimePoints.length - 1; i++) {
        largeTravelTimes.push({
          fromTimePoint: `stop${i + 1}`,
          toTimePoint: `stop${i + 2}`,
          weekday: Math.floor(Math.random() * 8) + 5, // 5-12 minutes
          saturday: Math.floor(Math.random() * 8) + 6, // 6-13 minutes
          sunday: Math.floor(Math.random() * 8) + 7    // 7-14 minutes
        });
      }

      const largeTimeBands = {
        weekday: [
          { startTime: '06:00', endTime: '08:00', frequency: 30 }, // 4 trips
          { startTime: '08:00', endTime: '10:00', frequency: 15 }  // 8 trips
        ],
        saturday: [{ startTime: '08:00', endTime: '12:00', frequency: 60 }], // 4 trips
        sunday: [{ startTime: '09:00', endTime: '15:00', frequency: 120 }]   // 3 trips
      };

      const largeOptions: ScheduleGenerationOptions = {
        routeId: 'R999',
        routeName: 'Large Route Test',
        direction: 'Outbound',
        effectiveDate: new Date('2024-01-01'),
        timeBands: largeTimeBands
      };

      const startTime = Date.now();
      const summarySchedule = await scheduleService.generateSummarySchedule(
        largeTimePoints,
        largeTravelTimes,
        largeOptions
      );
      const processingTime = Date.now() - startTime;

      // Should process large dataset quickly (within 2 seconds)
      expect(processingTime).toBeLessThan(2000);
      expect(summarySchedule.timePoints).toHaveLength(15);
      expect(summarySchedule.metadata.weekdayTrips).toBe(12); // 4 + 8 trips
    });
  });

  describe('Matrix Calculations and Missing Connections', () => {
    test('handles incomplete travel time data gracefully', async () => {
      // Create travel times with some gaps
      const incompleteTimePoints = realTimePoints;
      const incompleteTravelTimes: TravelTime[] = [
        { fromTimePoint: 'downtown', toTimePoint: 'mainst', weekday: 8, saturday: 9, sunday: 10 },
        // Skip mainst -> mall connection
        { fromTimePoint: 'mall', toTimePoint: 'university', weekday: 12, saturday: 13, sunday: 14 },
        { fromTimePoint: 'university', toTimePoint: 'hospital', weekday: 7, saturday: 8, sunday: 9 }
      ];

      const options: ScheduleGenerationOptions = {
        routeId: 'R002',
        routeName: 'Incomplete Test Route',
        direction: 'Inbound',
        effectiveDate: new Date('2024-01-01'),
        timeBands: {
          weekday: [{ startTime: '08:00', endTime: '08:30', frequency: 30 }],
          saturday: [],
          sunday: []
        }
      };

      // Should use enhanced travel matrices to fill gaps
      const matrices = scheduleService.buildEnhancedTravelMatrices(
        incompleteTimePoints,
        incompleteTravelTimes
      );

      expect(matrices.weekday['mainst']['mall']).toBeDefined();
      expect(matrices.weekday['mainst']['mall']).toBe(5); // Default for adjacent points

      // Should generate schedule successfully despite gaps
      const summarySchedule = await scheduleService.generateSummarySchedule(
        incompleteTimePoints,
        incompleteTravelTimes,
        options
      );

      expect(summarySchedule.weekday).toHaveLength(2); // Should have generated 2 trips
    });

    test('validates matrix performance and provides recommendations', () => {
      const matrices = scheduleService.buildEnhancedTravelMatrices(
        realTimePoints,
        realTravelTimes
      );

      const performanceResult = scheduleService.validateMatrixPerformance(
        realTimePoints,
        matrices
      );

      expect(performanceResult.performance.matrixSize).toBe(5);
      expect(performanceResult.performance.connectionRate).toBeGreaterThan(0);
      expect(performanceResult.performance.averageTravelTime.weekday).toBeGreaterThan(0);

      // Should be optimal for small datasets
      expect(performanceResult.isOptimal).toBe(true);
      expect(performanceResult.recommendations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Schedule Statistics and Validation', () => {
    test('calculates accurate schedule statistics', async () => {
      const options: ScheduleGenerationOptions = {
        routeId: 'R003',
        routeName: 'Stats Test Route',
        direction: 'Inbound',
        effectiveDate: new Date('2024-01-01'),
        timeBands: realTimeBands
      };

      const summarySchedule = await scheduleService.generateSummarySchedule(
        realTimePoints,
        realTravelTimes,
        options
      );

      const calculationResults = scheduleService.getLastCalculationResults()!;
      const stats = scheduleService.calculateScheduleStatistics(
        calculationResults,
        realTimePoints
      );

      expect(stats.totalTimePoints).toBe(5);
      expect(stats.totalTrips.total).toBeGreaterThan(0);
      expect(stats.totalTrips.weekday).toBeGreaterThan(stats.totalTrips.saturday);
      expect(stats.totalTrips.saturday).toBeGreaterThan(stats.totalTrips.sunday);

      // Validate operating hours make sense
      expect(stats.operatingHours.weekday.start < stats.operatingHours.weekday.end).toBe(true);
      expect(stats.averageFrequency.weekday).toBeGreaterThan(0);
    });

    test('validates schedule data integrity', async () => {
      const options: ScheduleGenerationOptions = {
        routeId: 'R004',
        routeName: 'Validation Test Route',
        direction: 'Inbound',
        effectiveDate: new Date('2024-01-01'),
        timeBands: realTimeBands
      };

      const summarySchedule = await scheduleService.generateSummarySchedule(
        realTimePoints,
        realTravelTimes,
        options
      );

      // Validate using schedule service
      const validation = scheduleService.validateScheduleData(realTimePoints, realTravelTimes);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Validate complete display data
      const calculationResults = scheduleService.getLastCalculationResults()!;
      const displayData = generateSummaryDisplayData(summarySchedule, calculationResults);
      
      // Should have consistent data across all components
      expect(displayData.statistics.totalTimePoints).toBe(realTimePoints.length);
      expect(displayData.timePoints).toHaveLength(realTimePoints.length);
      
      // All day types should have proper schedule data
      Object.values(displayData.schedules).forEach(schedule => {
        if (schedule.tripCount > 0) {
          expect(schedule.headers).toHaveLength(realTimePoints.length);
          schedule.rows.forEach(row => {
            expect(row).toHaveLength(realTimePoints.length);
          });
        }
      });
    });
  });

  describe('Format Options and Export', () => {
    test('supports different time formats and display options', async () => {
      const options: ScheduleGenerationOptions = {
        routeId: 'R005',
        routeName: 'Format Test Route',
        direction: 'Inbound',
        effectiveDate: new Date('2024-01-01'),
        timeBands: {
          weekday: [{ startTime: '14:30', endTime: '15:30', frequency: 30 }], // Afternoon times
          saturday: [],
          sunday: []
        }
      };

      const summarySchedule = await scheduleService.generateSummarySchedule(
        realTimePoints,
        realTravelTimes,
        options
      );

      const calculationResults = scheduleService.getLastCalculationResults()!;

      // Test 24-hour format
      const format24h = generateSummaryDisplayData(
        summarySchedule,
        calculationResults,
        { includeTimePointNames: true, timeFormat: '24h', includeStatistics: true }
      );

      // Test 12-hour format
      const format12h = generateSummaryDisplayData(
        summarySchedule,
        calculationResults,
        { includeTimePointNames: true, timeFormat: '12h', includeStatistics: true }
      );

      expect(format24h.formatInfo.timeFormat).toBe('24h');
      expect(format12h.formatInfo.timeFormat).toBe('12h');

      // Verify times are formatted differently
      const time24h = format24h.schedules.weekday.rows[0][0];
      const time12h = format12h.schedules.weekday.rows[0][0];
      
      expect(time24h).toMatch(/^\d{2}:\d{2}$/); // 24h format: HH:MM
      expect(time12h).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/); // 12h format: H:MM AM/PM

      // Test time point ID vs name display
      const withNames = generateSummaryDisplayData(
        summarySchedule,
        calculationResults,
        { includeTimePointNames: true, timeFormat: '24h', includeStatistics: true }
      );

      const withoutNames = generateSummaryDisplayData(
        summarySchedule,
        calculationResults,
        { includeTimePointNames: false, timeFormat: '24h', includeStatistics: true }
      );

      expect(withNames.timePoints[0].displayName).toBe('Downtown Terminal');
      expect(withoutNames.timePoints[0].displayName).toBe('downtown');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles service errors gracefully', async () => {
      // Test with invalid data
      const invalidTimePoints: TimePoint[] = [];
      const invalidTravelTimes: TravelTime[] = [];
      
      const options: ScheduleGenerationOptions = {
        routeId: '',
        routeName: '',
        direction: '',
        effectiveDate: new Date(),
        timeBands: { weekday: [], saturday: [], sunday: [] }
      };

      await expect(
        scheduleService.generateSummarySchedule(invalidTimePoints, invalidTravelTimes, options)
      ).rejects.toThrow();
    });

    test('optimized calculation works with boundary conditions', () => {
      // Test with minimal data
      const minimalTimePoints = realTimePoints.slice(0, 2);
      const minimalTravelTimes = realTravelTimes.slice(0, 1);
      const minimalTimeBands = {
        weekday: [{ startTime: '23:50', endTime: '23:59', frequency: 5 }],
        saturday: [],
        sunday: []
      };

      const result = calculateOptimizedSchedule(
        minimalTimePoints,
        minimalTravelTimes,
        minimalTimeBands
      );

      expect(result.weekday.length).toBeGreaterThan(0);
      expect(result.metadata.totalTimePoints).toBe(2);
      expect(result.metadata.calculationTime).toBeGreaterThan(0);
    });
  });
});
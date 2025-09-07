/**
 * Comprehensive Test for Complete Firebase Draft Service Fix
 * Tests all methods that were causing "undefined field value" Firebase errors
 */

import { draftService } from './draftService';
import { ValidationResult } from '../utils/validator';
import { ParsedCsvData } from '../utils/csvParser';
import { ServiceBand } from '../types/schedule';
import { TimePointData, OutlierData, TimepointsModification, BlockConfiguration } from '../types/workflow';

describe('Complete Firebase Draft Service Fix', () => {
  const mockCsvData: ParsedCsvData = {
    segments: [
      {
        fromLocation: 'Downtown Terminal',
        toLocation: 'Johnson',
        timeSlot: '07:00 - 07:29',
        percentile25: 23,
        percentile50: 25,
        percentile80: 27,
        percentile90: 29
      },
      {
        fromLocation: 'Johnson',
        toLocation: 'City Center',
        timeSlot: '07:30 - 07:59',
        percentile25: 25,
        percentile50: 27,
        percentile80: 29,
        percentile90: 31
      }
    ],
    timePoints: ['Downtown Terminal', 'Johnson', 'City Center'],
    validationSummary: {
      totalSegments: 2,
      validSegments: 2,
      invalidSegments: 0,
      timeSlots: 2
    }
  };

  let testDraftId: string;

  beforeAll(async () => {
    // Create a test draft for all the update operations
    const result = await draftService.createDraft(
      'Complete Test Draft',
      'test.csv',
      'csv',
      mockCsvData,
      {
        isValid: true,
        errors: [],
        warnings: [{ type: 'INFO', code: 'TEST', message: 'Test validation', details: {} }],
        statistics: {
          totalTimePoints: 3,
          totalTravelTimes: 2,
          averageTravelTime: 26,
          minTravelTime: 23,
          maxTravelTime: 31,
          missingConnections: 0,
          duplicateConnections: 0,
          dayTypeCoverage: { weekday: 2, saturday: 2, sunday: 2 }
        }
      } as ValidationResult
    );
    expect(result.success).toBe(true);
    testDraftId = result.draftId!;
  });

  afterAll(async () => {
    // Cleanup test draft
    if (testDraftId) {
      await draftService.deleteDraft(testDraftId);
    }
  });

  describe('All update methods use Firebase serialization', () => {
    it('updateDraftWithTimepointsAnalysis should handle undefined fields', async () => {
      console.log('🧪 Testing updateDraftWithTimepointsAnalysis');
      
      const mockAnalysisData = {
        serviceBands: [
          {
            name: 'Fast',
            color: '#green',
            segmentTimes: [20, 22, 21, 23],
            totalMinutes: 25
          }
        ] as ServiceBand[],
        travelTimeData: [
          {
            from: 'Downtown Terminal',
            to: 'Johnson',
            timePeriod: '07:00-07:30',
            percentile25: 23,
            percentile50: 25,
            percentile75: 26,
            percentile90: 27
          }
        ] as TimePointData[],
        outliers: [] as OutlierData[],
        userModifications: [] as TimepointsModification[],
        deletedPeriods: undefined, // This could be undefined
        timePeriodServiceBands: undefined // This could be undefined
      };

      const result = await draftService.updateDraftWithTimepointsAnalysis(
        testDraftId,
        mockAnalysisData
      );

      expect(result.success).toBe(true);
      console.log('✅ updateDraftWithTimepointsAnalysis handled undefined fields correctly');
    });

    it('updateDraftWithBlockConfiguration should handle undefined fields', async () => {
      console.log('🧪 Testing updateDraftWithBlockConfiguration');
      
      const mockBlockConfig = {
        numberOfBuses: 3,
        cycleTimeMinutes: 60,
        automateBlockStartTimes: true,
        blockConfigurations: [
          {
            blockNumber: 1,
            startTime: '07:00',
            endTime: '22:00'
          }
        ] as BlockConfiguration[]
      };

      const result = await draftService.updateDraftWithBlockConfiguration(
        testDraftId,
        mockBlockConfig
      );

      expect(result.success).toBe(true);
      console.log('✅ updateDraftWithBlockConfiguration handled data correctly');
    });

    it('updateDraftWithSummarySchedule should handle complex nested data', async () => {
      console.log('🧪 Testing updateDraftWithSummarySchedule');
      
      const mockSummaryData = {
        schedule: {
          routeInfo: {
            routeId: 'R1',
            routeName: 'Test Route'
          },
          timePoints: ['Stop A', 'Stop B'],
          trips: [],
          serviceBands: []
        } as any,
        metadata: {
          generationMethod: 'block-based' as const,
          parameters: {},
          validationResults: [],
          performanceMetrics: {
            generationTimeMs: 100,
            tripCount: 0,
            memoryUsageMB: 1
          }
        }
      };

      const result = await draftService.updateDraftWithSummarySchedule(
        testDraftId,
        mockSummaryData
      );

      expect(result.success).toBe(true);
      console.log('✅ updateDraftWithSummarySchedule handled nested data correctly');
    });

    it('should retrieve updated draft with all data intact', async () => {
      console.log('🧪 Testing final draft retrieval');
      
      const retrievedDraft = await draftService.getDraftByIdUnified(testDraftId);
      expect(retrievedDraft).toBeTruthy();
      expect(retrievedDraft!.draftName).toBe('Complete Test Draft');
      
      // Verify data integrity through all the updates
      expect(retrievedDraft!.originalData.uploadedData).toBeTruthy();
      expect(retrievedDraft!.originalData.validation).toBeTruthy();
      
      console.log('✅ All data retrieved correctly after multiple updates');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle draft with completely undefined analysis data', async () => {
      const mockAnalysisData = {
        serviceBands: [],
        travelTimeData: [],
        outliers: [],
        userModifications: [],
        deletedPeriods: undefined,
        timePeriodServiceBands: undefined
      };

      const result = await draftService.updateDraftWithTimepointsAnalysis(
        testDraftId,
        mockAnalysisData
      );

      expect(result.success).toBe(true);
    });

    it('should handle non-existent draft gracefully', async () => {
      const result = await draftService.updateDraftWithTimepointsAnalysis(
        'non-existent-draft',
        {
          serviceBands: [],
          travelTimeData: [],
          outliers: [],
          userModifications: []
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Draft not found');
    });
  });
});
/**
 * Integration Test: Complete CSV Draft Workflow
 * Tests the full flow from CSV upload to draft library to ensure Firebase saving works end-to-end
 */

import { draftService } from '../services/draftService';
import { ValidationResult } from '../utils/validator';
import { ParsedCsvData } from '../utils/csvParser';

describe('CSV Draft Workflow Integration', () => {
  // Mock realistic CSV data similar to what would be uploaded
  const mockRealisticCsvData: ParsedCsvData = {
    segments: [
      {
        fromLocation: 'Downtown Terminal',
        toLocation: 'Johnson',
        timeSlot: '07:00 - 07:29',
        percentile25: 24,
        percentile50: 26,
        percentile80: 28,
        percentile90: 30
      },
      {
        fromLocation: 'Downtown Terminal',
        toLocation: 'Johnson',
        timeSlot: '07:30 - 07:59',
        percentile25: 25,
        percentile50: 27,
        percentile80: 29,
        percentile90: 31
      },
      {
        fromLocation: 'Johnson',
        toLocation: 'City Center',
        timeSlot: '07:00 - 07:29',
        percentile25: 18,
        percentile50: 20,
        percentile80: 22,
        percentile90: 24
      },
      {
        fromLocation: 'Johnson',
        toLocation: 'City Center',
        timeSlot: '07:30 - 07:59',
        percentile25: 19,
        percentile50: 21,
        percentile80: 23,
        percentile90: 25
      }
    ],
    timePoints: ['Downtown Terminal', 'Johnson', 'City Center'],
    validationSummary: {
      totalSegments: 4,
      validSegments: 4,
      invalidSegments: 0,
      timeSlots: 2
    }
  };

  const mockValidationResult: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [{ type: 'INFO', code: 'TEST_DATA', message: 'This is test data for validation' }],
    statistics: {
      totalTimePoints: 2,
      totalTravelTimes: 4,
      averageTravelTime: 25,
      minTravelTime: 18,
      maxTravelTime: 32,
      missingConnections: 0,
      duplicateConnections: 0,
      dayTypeCoverage: { weekday: 4, saturday: 4, sunday: 4 }
    }
  };

  beforeEach(async () => {
    // Clean up any test drafts from previous runs
    const allDrafts = await draftService.getAllDraftsUnified();
    for (const draft of allDrafts.filter(d => d.draftName.includes('Test'))) {
      await draftService.deleteDraft(draft.draftId);
    }
  });

  describe('Complete CSV Draft Flow', () => {
    it('should handle complete CSV upload to draft library flow', async () => {
      // Step 1: Create draft from CSV upload
      console.log('📁 Step 1: Creating draft from CSV upload');
      const createResult = await draftService.createDraft(
        'Test CSV Draft Integration',
        'raw_schedule_data.csv',
        'csv',
        mockRealisticCsvData,
        mockValidationResult
      );

      expect(createResult.success).toBe(true);
      expect(createResult.draftId).toBeDefined();
      const draftId = createResult.draftId!;
      console.log('✅ Draft created successfully:', draftId);

      // Step 2: Retrieve draft and verify data integrity
      console.log('📁 Step 2: Retrieving draft and verifying data');
      const retrievedDraft = await draftService.getDraftByIdUnified(draftId);
      expect(retrievedDraft).toBeTruthy();
      expect(retrievedDraft!.draftName).toBe('Test CSV Draft Integration');
      expect(retrievedDraft!.originalData.fileName).toBe('raw_schedule_data.csv');
      expect(retrievedDraft!.originalData.fileType).toBe('csv');
      
      // Verify CSV data was properly serialized and deserialized
      const uploadedData = retrievedDraft!.originalData.uploadedData as ParsedCsvData;
      expect(uploadedData.segments).toEqual(mockRealisticCsvData.segments);
      expect(uploadedData.timePoints).toEqual(mockRealisticCsvData.timePoints);
      expect(uploadedData.validationSummary).toEqual(mockRealisticCsvData.validationSummary);
      
      // Verify validation was properly saved (not undefined)
      expect(retrievedDraft!.originalData.validation).toBeDefined();
      expect(retrievedDraft!.originalData.validation!.isValid).toBe(true);
      expect(retrievedDraft!.originalData.validation!.warnings).toContain('This is test data for validation');
      console.log('✅ Draft data verified successfully');

      // Step 3: Simulate progression through workflow steps
      console.log('📁 Step 3: Testing workflow progression');
      
      // Update to timepoints analysis
      const timepointsUpdate = await draftService.updateDraftStep(
        draftId,
        'timepoints',
        30,
        {
          timepoints: {
            serviceBands: [
              {
                name: 'Fast Service',
                color: '#4CAF50',
                description: 'Median travel times',
                segmentTimes: []
              }
            ],
            travelTimeData: [],
            outliers: []
          }
        }
      );
      expect(timepointsUpdate.success).toBe(true);
      console.log('✅ Timepoints step updated');

      // Update to block configuration  
      const blocksUpdate = await draftService.updateDraftStep(
        draftId,
        'blocks', 
        60,
        {
          blockConfiguration: {
            numberOfBuses: 3,
            cycleTimeMinutes: 45,
            automateBlockStartTimes: true,
            blockConfigurations: []
          }
        }
      );
      expect(blocksUpdate.success).toBe(true);
      console.log('✅ Block configuration step updated');

      // Step 4: Test draft library listing
      console.log('📁 Step 4: Testing draft library functionality');
      const allDrafts = await draftService.getAllDraftsUnified();
      const testDraft = allDrafts.find(d => d.draftId === draftId);
      expect(testDraft).toBeDefined();
      expect(testDraft!.currentStep).toBe('blocks');
      expect(testDraft!.progress).toBe(60);
      console.log('✅ Draft appears in library correctly');

      // Step 5: Test workflow state integration
      console.log('📁 Step 5: Testing UI workflow state');
      const workflow = draftService.getOrCreateWorkflow(draftId, 'Test CSV Draft Integration');
      expect(workflow).toBeTruthy();
      expect(workflow.draftId).toBe(draftId);
      expect(workflow.draftName).toBe('Test CSV Draft Integration');
      console.log('✅ Workflow state created successfully');

      // Step 6: Clean up
      console.log('📁 Step 6: Cleaning up test draft');
      const deleteResult = await draftService.deleteDraft(draftId);
      expect(deleteResult.success).toBe(true);
      console.log('✅ Test draft cleaned up successfully');

      console.log('🎉 Complete CSV draft workflow integration test passed!');
    }, 45000); // 45 second timeout for full integration test

    it('should handle drafts with null validation without Firebase errors', async () => {
      console.log('📁 Testing null validation handling');
      
      const createResult = await draftService.createDraft(
        'Test No Validation Draft',
        'minimal_data.csv',
        'csv',
        {
          segments: [{
            fromLocation: 'Start',
            toLocation: 'End',
            timeSlot: '08:00',
            percentile25: 25,
            percentile50: 25,
            percentile80: 25,
            percentile90: 25
          }],
          timePoints: ['Start', 'End'],
          validationSummary: {
            totalSegments: 1,
            validSegments: 1,
            invalidSegments: 0,
            timeSlots: 1
          }
        },
        null as any // Explicitly null validation
      );

      expect(createResult.success).toBe(true);
      const draftId = createResult.draftId!;

      const retrievedDraft = await draftService.getDraftByIdUnified(draftId);
      expect(retrievedDraft).toBeTruthy();
      
      // Validation should be undefined/not present (not cause Firebase errors)
      expect(retrievedDraft!.originalData.validation).toBeUndefined();
      
      // Clean up
      await draftService.deleteDraft(draftId);
      console.log('✅ Null validation handled correctly');
    });

    it('should handle empty validation without Firebase errors', async () => {
      console.log('📁 Testing empty validation handling');
      
      const emptyValidation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        statistics: {
          totalTimePoints: 1,
          totalTravelTimes: 1,
          averageTravelTime: 15,
          minTravelTime: 15,
          maxTravelTime: 15,
          missingConnections: 0,
          duplicateConnections: 0,
          dayTypeCoverage: { weekday: 1, saturday: 1, sunday: 1 }
        }
      };

      const createResult = await draftService.createDraft(
        'Test Empty Validation Draft',
        'empty_validation.csv', 
        'csv',
        {
          segments: [{
            fromLocation: 'A',
            toLocation: 'B',
            timeSlot: '08:00',
            percentile25: 15,
            percentile50: 15,
            percentile80: 15,
            percentile90: 15
          }],
          timePoints: ['A', 'B'],
          validationSummary: {
            totalSegments: 1,
            validSegments: 1,
            invalidSegments: 0,
            timeSlots: 1
          }
        },
        emptyValidation
      );

      expect(createResult.success).toBe(true);
      const draftId = createResult.draftId!;

      const retrievedDraft = await draftService.getDraftByIdUnified(draftId);
      expect(retrievedDraft).toBeTruthy();
      expect(retrievedDraft!.originalData.validation).toEqual(emptyValidation);
      
      // Clean up
      await draftService.deleteDraft(draftId);
      console.log('✅ Empty validation handled correctly');
    });
  });

  describe('Firebase Data Integrity', () => {
    it('should preserve complex nested CSV data through Firebase serialization', async () => {
      console.log('📁 Testing complex CSV data preservation');
      
      const complexCsvData: ParsedCsvData = {
        segments: [
          {
            fromLocation: 'Terminal',
            toLocation: 'First',
            timeSlot: '06:00-06:29',
            percentile25: 22,
            percentile50: 24,
            percentile80: 26,
            percentile90: 28
          },
          {
            fromLocation: 'Terminal',
            toLocation: 'First',
            timeSlot: '06:30-06:59',
            percentile25: 23,
            percentile50: 25,
            percentile80: 27,
            percentile90: 29
          },
          {
            fromLocation: 'First',
            toLocation: 'Second',
            timeSlot: '06:00-06:29',
            percentile25: 15,
            percentile50: 17,
            percentile80: 19,
            percentile90: 21
          },
          {
            fromLocation: 'First',
            toLocation: 'Second',
            timeSlot: '06:30-06:59',
            percentile25: 16,
            percentile50: 18,
            percentile80: 20,
            percentile90: 22
          }
        ],
        timePoints: ['Terminal', 'First', 'Second'],
        validationSummary: {
          totalSegments: 4,
          validSegments: 4,
          invalidSegments: 0,
          timeSlots: 2
        }
      };

      const createResult = await draftService.createDraft(
        'Complex CSV Data Test',
        'complex_schedule.csv',
        'csv', 
        complexCsvData,
        {
          isValid: true,
          errors: [],
          warnings: [{ type: 'INFO', code: 'COMPLEX_DATA', message: 'Complex data structure test' }],
          statistics: {
            totalTimePoints: 2,
            totalTravelTimes: 4,
            averageTravelTime: 20,
            minTravelTime: 15,
            maxTravelTime: 25,
            missingConnections: 0,
            duplicateConnections: 0,
            dayTypeCoverage: { weekday: 4, saturday: 4, sunday: 4 }
          }
        }
      );

      expect(createResult.success).toBe(true);
      const draftId = createResult.draftId!;

      // Verify the nested data survived Firebase serialization/deserialization
      const retrieved = await draftService.getDraftByIdUnified(draftId);
      expect(retrieved).toBeTruthy();
      
      const retrievedCsvData = retrieved!.originalData.uploadedData as ParsedCsvData;
      expect(retrievedCsvData.segments).toEqual(complexCsvData.segments);
      expect(retrievedCsvData.timePoints).toEqual(complexCsvData.timePoints);
      expect(retrievedCsvData.validationSummary).toEqual(complexCsvData.validationSummary);

      // Clean up
      await draftService.deleteDraft(draftId);
      console.log('✅ Complex CSV data preserved correctly');
    });
  });
});
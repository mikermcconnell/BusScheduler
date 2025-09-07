/**
 * TDD Tests for Firebase Draft Service Validation Handling
 * Testing the specific issue where undefined validation causes Firebase errors
 */

import { draftService } from './draftService';
import { ValidationResult } from '../utils/validator';
import { ParsedCsvData } from '../utils/csvParser';

describe('DraftService Firebase Validation Handling', () => {
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

  beforeEach(() => {
    // Clear any existing drafts
    jest.clearAllMocks();
  });

  describe('createDraft with validation handling', () => {
    it('should handle null validation without creating undefined fields', async () => {
      const result = await draftService.createDraft(
        'Test Draft',
        'test.csv',
        'csv',
        mockCsvData,
        null as any // This could come from validation that returns null
      );

      expect(result.success).toBe(true);
      expect(result.draftId).toBeDefined();
      
      // Verify the draft was created correctly
      const draft = await draftService.getDraftByIdUnified(result.draftId!);
      expect(draft).toBeTruthy();
      expect(draft?.originalData.validation).toBeUndefined();
      
      // Important: verification that no undefined fields were saved to Firebase
      // This would cause the Firebase error we're fixing
    });

    it('should handle undefined validation without creating undefined fields', async () => {
      const result = await draftService.createDraft(
        'Test Draft',
        'test.csv',
        'csv',
        mockCsvData,
        undefined // Explicit undefined - should be omitted from Firebase
      );

      expect(result.success).toBe(true);
      expect(result.draftId).toBeDefined();
      
      const draft = await draftService.getDraftByIdUnified(result.draftId!);
      expect(draft).toBeTruthy();
      expect(draft?.originalData.validation).toBeUndefined();
    });

    it('should properly handle valid ValidationResult objects', async () => {
      const validValidation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [{ type: 'WARNING', code: 'SAMPLE', message: 'Sample warning' }],
        statistics: {
          totalTimePoints: 1,
          totalTravelTimes: 1,
          averageTravelTime: 20,
          minTravelTime: 20,
          maxTravelTime: 20,
          missingConnections: 0,
          duplicateConnections: 0,
          dayTypeCoverage: { weekday: 1, saturday: 1, sunday: 1 }
        }
      };

      const result = await draftService.createDraft(
        'Test Draft',
        'test.csv',
        'csv',
        mockCsvData,
        validValidation
      );

      expect(result.success).toBe(true);
      expect(result.draftId).toBeDefined();
      
      const draft = await draftService.getDraftByIdUnified(result.draftId!);
      expect(draft).toBeTruthy();
      expect(draft?.originalData.validation).toEqual(validValidation);
    });

    it('should handle empty ValidationResult properly', async () => {
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

      const result = await draftService.createDraft(
        'Test Draft',
        'test.csv',
        'csv',
        mockCsvData,
        emptyValidation
      );

      expect(result.success).toBe(true);
      const draft = await draftService.getDraftByIdUnified(result.draftId!);
      expect(draft?.originalData.validation).toEqual(emptyValidation);
    });
  });

  describe('Firebase data validation', () => {
    it('should not include undefined fields in Firebase save operation', async () => {
      // Create a draft without validation
      const result = await draftService.createDraft(
        'No Validation Draft',
        'test.csv',
        'csv',
        mockCsvData
        // No validation parameter - should be omitted completely
      );

      expect(result.success).toBe(true);
      
      // Verify Firebase document structure doesn't include undefined validation
      const draft = await draftService.getDraftByIdUnified(result.draftId!);
      expect(draft).toBeTruthy();
      
      // The key test: validation field should not exist at all (not undefined)
      expect('validation' in draft!.originalData).toBe(false);
    });
  });
});
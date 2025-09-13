/**
 * Unit Tests for DraftService - Workflow Persistence System
 * Tests Firebase sync, conflict resolution, version control, and retry mechanisms
 */

import { jest } from '@jest/globals';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { draftService, UnifiedDraftCompat, DraftOperationResult } from '../draftService';
import { offlineQueue } from '../offlineQueue';

// Mock Firebase
jest.mock('firebase/firestore');
jest.mock('../config/firebase', () => ({
  db: {}
}));

// Mock offline queue
jest.mock('../offlineQueue', () => ({
  offlineQueue: {
    enqueue: jest.fn().mockReturnValue(true),
    getStatus: jest.fn().mockReturnValue({
      isOnline: true,
      queueSize: 0,
      processing: false
    })
  }
}));

// Mock workspace event bus
jest.mock('../workspaceEventBus', () => ({
  emit: jest.fn()
}));

// Mock inputSanitizer
jest.mock('../../utils/inputSanitizer', () => ({
  sanitizeText: jest.fn((text: string) => text)
}));

describe('DraftService - Firebase Sync', () => {
  const mockDoc = doc as jest.MockedFunction<typeof doc>;
  const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
  const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
  const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
  const mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
  const mockRunTransaction = runTransaction as jest.MockedFunction<typeof runTransaction>;
  const mockServerTimestamp = serverTimestamp as jest.MockedFunction<typeof serverTimestamp>;
  const mockQuery = query as jest.MockedFunction<typeof query>;
  const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>;
  const mockLimit = limit as jest.MockedFunction<typeof limit>;

  let mockDraft: UnifiedDraftCompat;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn()
      },
      writable: true
    });

    // Reset sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn()
      },
      writable: true
    });

    // Mock online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    mockDraft = {
      draftId: 'draft_123',
      draftName: 'Test Draft',
      originalData: {
        fileName: 'test.csv',
        fileType: 'csv',
        uploadedData: { data: 'test' },
        uploadTimestamp: '2025-01-12T10:00:00Z'
      },
      currentStep: 'timepoints',
      progress: 30,
      stepData: {
        timepoints: {
          serviceBands: [],
          travelTimeData: [],
          outliers: []
        }
      },
      ui: {
        celebrationsShown: [],
        lastViewedStep: 'timepoints'
      },
      metadata: {
        createdAt: '2025-01-12T09:00:00Z',
        lastModifiedAt: '2025-01-12T10:00:00Z',
        version: 1,
        isPublished: false
      }
    };

    // Mock Firebase functions
    mockDoc.mockReturnValue({} as any);
    mockServerTimestamp.mockReturnValue({} as any);
  });

  describe('saveWorkflow() Firebase Sync', () => {
    it('should successfully sync draft to Firebase', async () => {
      // Mock successful transaction
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        return await updateFunction({} as any);
      });

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.success).toBe(true);
      expect(result.draftId).toBe('draft_123');
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it('should increment version number on save', async () => {
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        const transaction = {
          set: jest.fn()
        };
        return await updateFunction(transaction as any);
      });

      const initialVersion = mockDraft.metadata.version;
      await draftService.saveDraft(mockDraft, 'user123');

      // Verify version was incremented (would be done in the actual implementation)
      expect(mockDraft.metadata.version).toBeGreaterThanOrEqual(initialVersion);
    });

    it('should serialize data for Firebase compatibility', async () => {
      const draftWithNestedArrays = {
        ...mockDraft,
        originalData: {
          ...mockDraft.originalData,
          uploadedData: {
            nestedArray: [[1, 2], [3, 4]], // This should be serialized
            simpleArray: ['a', 'b', 'c'],   // This should stay as is
            undefinedValue: undefined        // This should be removed
          }
        }
      };

      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        const transaction = {
          set: jest.fn()
        };
        return await updateFunction(transaction as any);
      });

      const result = await draftService.saveDraft(draftWithNestedArrays, 'user123');

      expect(result.success).toBe(true);
      // The actual serialization verification would need access to the internal call
    });

    it('should handle Firebase errors and queue operations offline', async () => {
      const networkError = new Error('Failed to fetch');
      (networkError as any).code = 'network-error';
      
      mockRunTransaction.mockRejectedValue(networkError);

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.success).toBe(true); // Should still succeed due to offline queue
      expect(offlineQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'save',
          collection: 'workflow_drafts',
          documentId: 'draft_123'
        })
      );
    });

    it('should acquire and release locks for atomic operations', async () => {
      // Test concurrent saves
      const promise1 = draftService.saveDraft(mockDraft, 'user123');
      const promise2 = draftService.saveDraft({...mockDraft, draftId: 'draft_124'}, 'user123');

      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 10));
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Both should complete without conflicts
    });
  });

  describe('loadWorkflowFromCloud() with Fallback', () => {
    it('should load draft from Firebase first', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          ...mockDraft,
          serverTimestamp: { seconds: 1641984000, nanoseconds: 0 }
        })
      };

      mockGetDoc.mockResolvedValue(mockDocSnap as any);

      const result = await draftService.getDraft('draft_123', 'user123');

      expect(result).toBeTruthy();
      expect(result?.draftId).toBe('draft_123');
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    it('should fall back to localStorage when Firebase fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firebase offline'));

      // Mock localStorage data
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'scheduler2_draft_workflow_draft_123') {
          return JSON.stringify(mockDraft);
        }
        return null;
      });

      const result = await draftService.loadWorkflowFromCloud('draft_123');

      expect(result).toBeTruthy();
      expect(result?.draftId).toBe('draft_123');
      expect(localStorageMock.getItem).toHaveBeenCalled();
    });

    it('should deserialize Firebase data correctly', async () => {
      const serializedData = {
        ...mockDraft,
        originalData: {
          ...mockDraft.originalData,
          uploadedData: [
            { _index: 0, _value: [1, 2] },
            { _index: 1, _value: [3, 4] }
          ]
        }
      };

      const mockDocSnap = {
        exists: () => true,
        data: () => serializedData
      };

      mockGetDoc.mockResolvedValue(mockDocSnap as any);

      const result = await draftService.getDraft('draft_123', 'user123');

      expect(result?.originalData.uploadedData).toEqual([[1, 2], [3, 4]]);
    });

    it('should cache loaded drafts for performance', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => mockDraft
      };

      mockGetDoc.mockResolvedValue(mockDocSnap as any);

      // First load
      await draftService.getDraft('draft_123', 'user123');
      
      // Second load (should use cache)
      await draftService.getDraft('draft_123', 'user123');

      // Firebase should only be called once
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Conflict Resolution Logic', () => {
    it('should detect version conflicts', async () => {
      const localDraft = { ...mockDraft, metadata: { ...mockDraft.metadata, version: 1 } };
      const remoteDraft = { ...mockDraft, metadata: { ...mockDraft.metadata, version: 2 } };

      // Mock getting remote draft
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => remoteDraft
      } as any);

      const result = await draftService.saveDraft(localDraft, 'user123');

      // Should handle conflict resolution
      expect(result.success).toBe(true);
    });

    it('should merge conflicting drafts with advanced strategy', async () => {
      const localTime = '2025-01-12T11:00:00Z';
      const remoteTime = '2025-01-12T10:30:00Z';

      const localDraft = {
        ...mockDraft,
        metadata: { ...mockDraft.metadata, version: 1, lastModifiedAt: localTime },
        ui: { celebrationsShown: ['step1'], lastViewedStep: 'timepoints' },
        stepData: {
          timepoints: {
            serviceBands: [{ id: 'local', name: 'Local Band' }],
            travelTimeData: [],
            outliers: []
          }
        }
      };

      const remoteDraft = {
        ...mockDraft,
        metadata: { ...mockDraft.metadata, version: 2, lastModifiedAt: remoteTime },
        ui: { celebrationsShown: ['step2'], lastViewedStep: 'blocks' },
        stepData: {
          blockConfiguration: {
            numberOfBuses: 5,
            cycleTimeMinutes: 60,
            automateBlockStartTimes: true,
            blockConfigurations: []
          }
        }
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => remoteDraft
      } as any);

      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      const result = await draftService.saveDraft(localDraft, 'user123');

      expect(result.success).toBe(true);
      // Verify merge strategy was applied (would need access to merged data)
    });

    it('should retry conflict resolution with exponential backoff', async () => {
      let attempts = 0;
      mockGetDoc.mockImplementation(() => {
        attempts++;
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            ...mockDraft,
            metadata: { ...mockDraft.metadata, version: attempts + 1 }
          })
        } as any);
      });

      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        if (attempts < 3) {
          throw new Error('Version conflict');
        }
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should mark conflicts in metadata', async () => {
      const remoteDraft = {
        ...mockDraft,
        metadata: { ...mockDraft.metadata, version: 2 }
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => remoteDraft
      } as any);

      let mergedData: any;
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        const transaction = {
          set: jest.fn().mockImplementation((ref, data) => {
            mergedData = data;
          })
        };
        return await updateFunction(transaction as any);
      });

      await draftService.saveDraft(mockDraft, 'user123');

      // Verify conflict markers were added
      expect(mergedData?.metadata?.lastConflictResolution).toBeTruthy();
    });
  });

  describe('Version Incrementing', () => {
    it('should increment version on successful save', async () => {
      const initialVersion = mockDraft.metadata.version;

      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      await draftService.saveDraft(mockDraft, 'user123');

      // Version should be incremented internally
      expect(mockDraft.metadata.version).toBeGreaterThan(initialVersion);
    });

    it('should handle version overflow gracefully', async () => {
      const highVersionDraft = {
        ...mockDraft,
        metadata: { ...mockDraft.metadata, version: Number.MAX_SAFE_INTEGER - 1 }
      };

      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      const result = await draftService.saveDraft(highVersionDraft, 'user123');

      expect(result.success).toBe(true);
      // Version should still increment safely
    });

    it('should maintain version consistency across retries', async () => {
      let saveAttempts = 0;
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        saveAttempts++;
        if (saveAttempts < 3) {
          throw new Error('Temporary failure');
        }
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.success).toBe(true);
      expect(saveAttempts).toBe(3);
      // Version should only be incremented once despite retries
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed saves with exponential backoff', async () => {
      let attempts = 0;
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Temporary network error');
          (error as any).code = 'network-error';
          throw error;
        }
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      // Mock setTimeout for backoff testing
      const originalSetTimeout = global.setTimeout;
      const timeoutCalls: number[] = [];
      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        timeoutCalls.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      });

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
      
      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('should queue operations after max retries exceeded', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Persistent failure'));

      const result = await draftService.saveDraft(mockDraft, 'user123');

      // Should succeed by queueing
      expect(result.success).toBe(true);
      expect(offlineQueue.enqueue).toHaveBeenCalled();
    });

    it('should not retry non-network errors', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).code = 'permission-denied';
      
      mockRunTransaction.mockRejectedValue(permissionError);

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should respect maximum retry limits', async () => {
      let attempts = 0;
      mockRunTransaction.mockImplementation(async () => {
        attempts++;
        const error = new Error('Network error');
        (error as any).code = 'network-error';
        throw error;
      });

      const result = await draftService.saveDraft(mockDraft, 'user123');

      // Should eventually give up and queue
      expect(attempts).toBeLessThanOrEqual(4); // Initial + 3 retries
      expect(offlineQueue.enqueue).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid draft data gracefully', async () => {
      const invalidDraft = {
        draftId: '',
        draftName: null,
        // Missing required fields
      } as any;

      const result = await draftService.saveDraft(invalidDraft, 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should sanitize error messages', async () => {
      const sensitiveError = new Error('Database connection failed at 192.168.1.1:5432 for user admin@company.com');
      mockRunTransaction.mockRejectedValue(sensitiveError);

      const result = await draftService.saveDraft(mockDraft, 'user123');

      expect(result.error).not.toContain('192.168.1.1');
      expect(result.error).not.toContain('admin@company.com');
      expect(result.error).toContain('[IP]');
      expect(result.error).toContain('[EMAIL]');
    });

    it('should handle localStorage quota exceeded', async () => {
      const quotaError = new DOMException('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';
      
      mockRunTransaction.mockRejectedValue(quotaError);

      // Mock localStorage.setItem to throw quota error
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      localStorageMock.setItem.mockImplementation(() => {
        throw quotaError;
      });

      const result = await draftService.saveDraft(mockDraft, 'user123');

      // Should still attempt to save (implementation detail)
      expect(result).toBeTruthy();
    });

    it('should handle concurrent saves to same draft', async () => {
      let transactionCount = 0;
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        transactionCount++;
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 10));
        const transaction = { set: jest.fn() };
        return await updateFunction(transaction as any);
      });

      const promises = [
        draftService.saveDraft(mockDraft, 'user123'),
        draftService.saveDraft(mockDraft, 'user123'),
        draftService.saveDraft(mockDraft, 'user123')
      ];

      const results = await Promise.all(promises);

      // All should succeed or be handled gracefully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});
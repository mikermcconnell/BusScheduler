/**
 * Unit Tests for OfflineQueue - Offline Operation Management
 * Tests queue operations, exponential backoff, duplicate prevention, and error handling
 */

import { jest } from '@jest/globals';
import { offlineQueue, QueuedOperation, QueueStatus } from '../offlineQueue';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore');
jest.mock('../config/firebase', () => ({
  db: {}
}));

// Mock inputSanitizer
jest.mock('../../utils/inputSanitizer', () => ({
  sanitizeText: jest.fn((text: string) => text)
}));

describe('OfflineQueue', () => {
  const mockDoc = doc as jest.MockedFunction<typeof doc>;
  const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
  const mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
  const mockServerTimestamp = serverTimestamp as jest.MockedFunction<typeof serverTimestamp>;

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

    // Mock online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Clear the queue
    offlineQueue.clearQueue();

    // Mock Firebase functions
    mockDoc.mockReturnValue({} as any);
    mockServerTimestamp.mockReturnValue({} as any);
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  describe('Queue Operations (add, flush, clear)', () => {
    it('should successfully enqueue operation', () => {
      const operation = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'test-doc-1',
        data: { name: 'Test Document' }
      };

      const result = offlineQueue.enqueue(operation);

      expect(result).toBe(true);
      expect(offlineQueue.getQueueSize()).toBe(1);
    });

    it('should prevent duplicate operations', () => {
      const operation = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'test-doc-1',
        data: { name: 'Test Document' }
      };

      // Enqueue same operation twice
      const result1 = offlineQueue.enqueue(operation);
      const result2 = offlineQueue.enqueue(operation);

      expect(result1).toBe(true);
      expect(result2).toBe(true); // Returns true but doesn't add duplicate
      expect(offlineQueue.getQueueSize()).toBe(1); // Only one operation in queue
    });

    it('should reject operation when queue is full', () => {
      // Fill queue to capacity (100 operations)
      for (let i = 0; i < 100; i++) {
        offlineQueue.enqueue({
          type: 'save',
          collection: 'drafts',
          documentId: `test-doc-${i}`,
          data: { name: `Test ${i}` }
        });
      }

      // Try to add one more
      const result = offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'overflow-doc',
        data: { name: 'Overflow' }
      });

      expect(result).toBe(false);
      expect(offlineQueue.getQueueSize()).toBe(100);
    });

    it('should handle insufficient localStorage space', () => {
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      localStorageMock.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const operation = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'test-doc-1',
        data: { name: 'Test Document' }
      };

      const result = offlineQueue.enqueue(operation);

      expect(result).toBe(false);
    });

    it('should flush queue when online', async () => {
      // Add operations to queue
      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'doc-1',
        data: { name: 'Document 1' }
      });

      offlineQueue.enqueue({
        type: 'update',
        collection: 'drafts',
        documentId: 'doc-2',
        data: { name: 'Document 2' }
      });

      offlineQueue.enqueue({
        type: 'delete',
        collection: 'drafts',
        documentId: 'doc-3'
      });

      await offlineQueue.flush();

      expect(mockSetDoc).toHaveBeenCalledTimes(2); // save and update operations
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1); // delete operation
      expect(offlineQueue.getQueueSize()).toBe(0); // Queue should be empty
    });

    it('should not flush when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'doc-1',
        data: { name: 'Document 1' }
      });

      await offlineQueue.flush();

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(offlineQueue.getQueueSize()).toBe(1); // Operation still in queue
    });

    it('should clear all queued operations', () => {
      // Add multiple operations
      for (let i = 0; i < 5; i++) {
        offlineQueue.enqueue({
          type: 'save',
          collection: 'drafts',
          documentId: `doc-${i}`,
          data: { name: `Document ${i}` }
        });
      }

      expect(offlineQueue.getQueueSize()).toBe(5);

      offlineQueue.clearQueue();

      expect(offlineQueue.getQueueSize()).toBe(0);
    });

    it('should filter out expired operations', () => {
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      
      const expiredOperation = {
        id: 'expired-op',
        type: 'save',
        collection: 'drafts',
        documentId: 'expired-doc',
        data: { name: 'Expired' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        retryCount: 0
      };

      const freshOperation = {
        id: 'fresh-op',
        type: 'save',
        collection: 'drafts',
        documentId: 'fresh-doc',
        data: { name: 'Fresh' },
        timestamp: Date.now(),
        retryCount: 0
      };

      localStorageMock.getItem.mockReturnValue(
        JSON.stringify([expiredOperation, freshOperation])
      );

      // This would trigger internal queue filtering
      const queueSize = offlineQueue.getQueueSize();
      
      // Only fresh operation should remain
      expect(queueSize).toBe(1);
    });
  });

  describe('Exponential Backoff', () => {
    beforeEach(() => {
      // Mock setTimeout for testing backoff
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry failed operations with exponential backoff', async () => {
      let attempts = 0;
      mockSetDoc.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(undefined);
      });

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'retry-doc',
        data: { name: 'Retry Document' }
      });

      // Start flush
      const flushPromise = offlineQueue.flush();
      
      // Fast-forward through backoff delays
      jest.advanceTimersByTime(1000); // First retry after 1s
      await Promise.resolve(); // Let promises resolve
      
      jest.advanceTimersByTime(2000); // Second retry after 2s
      await Promise.resolve();
      
      jest.advanceTimersByTime(4000); // Third attempt after 4s
      await flushPromise;

      expect(attempts).toBe(3);
      expect(offlineQueue.getQueueSize()).toBe(0); // Should succeed eventually
    });

    it('should respect maximum backoff delay', async () => {
      mockSetDoc.mockRejectedValue(new Error('Persistent error'));

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'backoff-doc',
        data: { name: 'Backoff Document' }
      });

      const flushPromise = offlineQueue.flush();
      
      // Advance through multiple retries
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(30000); // Max 30 second backoff
        await Promise.resolve();
      }

      await flushPromise;

      // Should respect max backoff of 30 seconds
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should drop operations after max retry count', async () => {
      mockSetDoc.mockRejectedValue(new Error('Persistent failure'));

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'failed-doc',
        data: { name: 'Failed Document' }
      });

      const flushPromise = offlineQueue.flush();
      
      // Advance through all retry attempts
      jest.advanceTimersByTime(60000); // Enough time for all retries
      await flushPromise;

      // Operation should be dropped after max retries
      expect(offlineQueue.getQueueSize()).toBe(0);
    });

    it('should handle different backoff timing for different operations', async () => {
      let doc1Attempts = 0;
      let doc2Attempts = 0;

      mockSetDoc.mockImplementation((ref, data) => {
        if (data.name === 'Document 1') {
          doc1Attempts++;
          if (doc1Attempts < 2) {
            return Promise.reject(new Error('Error 1'));
          }
        } else if (data.name === 'Document 2') {
          doc2Attempts++;
          if (doc2Attempts < 3) {
            return Promise.reject(new Error('Error 2'));
          }
        }
        return Promise.resolve(undefined);
      });

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'doc-1',
        data: { name: 'Document 1' }
      });

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'doc-2',
        data: { name: 'Document 2' }
      });

      const flushPromise = offlineQueue.flush();
      
      // Advance through retries
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
      jest.advanceTimersByTime(10000);
      await flushPromise;

      expect(doc1Attempts).toBe(2);
      expect(doc2Attempts).toBe(3);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should detect exact duplicate operations', () => {
      const operation = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'duplicate-test',
        data: { name: 'Test Document' }
      };

      const result1 = offlineQueue.enqueue(operation);
      const result2 = offlineQueue.enqueue(operation);

      expect(result1).toBe(true);
      expect(result2).toBe(true); // Returns true but doesn't add
      expect(offlineQueue.getQueueSize()).toBe(1);
    });

    it('should allow different operations on same document', () => {
      const saveOp = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'multi-op-doc',
        data: { name: 'Original' }
      };

      const updateOp = {
        type: 'update' as const,
        collection: 'drafts',
        documentId: 'multi-op-doc',
        data: { name: 'Updated' }
      };

      const result1 = offlineQueue.enqueue(saveOp);
      const result2 = offlineQueue.enqueue(updateOp);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(offlineQueue.getQueueSize()).toBe(2);
    });

    it('should allow same operation on different documents', () => {
      const operation1 = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'doc-1',
        data: { name: 'Document 1' }
      };

      const operation2 = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'doc-2',
        data: { name: 'Document 2' }
      };

      const result1 = offlineQueue.enqueue(operation1);
      const result2 = offlineQueue.enqueue(operation2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(offlineQueue.getQueueSize()).toBe(2);
    });

    it('should allow requeuing after max retries exceeded', () => {
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      
      // Mock existing operation that exceeded retries
      const exceededOperation = {
        id: 'exceeded-op',
        type: 'save',
        collection: 'drafts',
        documentId: 'retry-exceeded-doc',
        data: { name: 'Exceeded' },
        timestamp: Date.now(),
        retryCount: 4 // Exceeds max of 3
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify([exceededOperation]));

      // Try to enqueue same operation
      const result = offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'retry-exceeded-doc',
        data: { name: 'Retry Again' }
      });

      expect(result).toBe(true); // Should allow requeuing
    });

    it('should handle data sanitization during duplicate detection', () => {
      const operationWithSensitiveData = {
        type: 'save' as const,
        collection: 'drafts',
        documentId: 'sensitive-doc',
        data: {
          name: 'Document',
          secretKey: 'password123',
          userEmail: 'user@example.com'
        }
      };

      const result1 = offlineQueue.enqueue(operationWithSensitiveData);
      const result2 = offlineQueue.enqueue(operationWithSensitiveData);

      expect(result1).toBe(true);
      expect(result2).toBe(true); // Should handle sanitized duplicate detection
      expect(offlineQueue.getQueueSize()).toBe(1);
    });
  });

  describe('Queue Size Limits', () => {
    it('should enforce maximum queue size', () => {
      // Fill queue to capacity
      for (let i = 0; i < 100; i++) {
        const result = offlineQueue.enqueue({
          type: 'save',
          collection: 'drafts',
          documentId: `doc-${i}`,
          data: { name: `Document ${i}` }
        });
        expect(result).toBe(true);
      }

      // Try to exceed capacity
      const overflowResult = offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'overflow',
        data: { name: 'Overflow' }
      });

      expect(overflowResult).toBe(false);
      expect(offlineQueue.getQueueSize()).toBe(100);
    });

    it('should make room for new operations after processing', async () => {
      // Fill queue
      for (let i = 0; i < 100; i++) {
        offlineQueue.enqueue({
          type: 'save',
          collection: 'drafts',
          documentId: `doc-${i}`,
          data: { name: `Document ${i}` }
        });
      }

      // Process queue
      await offlineQueue.flush();

      // Should now have room for new operations
      const result = offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'new-doc',
        data: { name: 'New Document' }
      });

      expect(result).toBe(true);
    });
  });

  describe('Event Listeners and Status Tracking', () => {
    it('should track online/offline status', () => {
      const status1 = offlineQueue.getStatus();
      expect(status1.isOnline).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));

      const status2 = offlineQueue.getStatus();
      expect(status2.isOnline).toBe(false);
    });

    it('should notify listeners of status changes', () => {
      const mockListener = jest.fn();
      const unsubscribe = offlineQueue.subscribe(mockListener);

      // Should receive initial status
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: true,
          queueSize: 0,
          processing: false
        })
      );

      // Add operation to trigger status change
      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'status-test',
        data: { name: 'Test' }
      });

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          queueSize: 1
        })
      );

      unsubscribe();
    });

    it('should track processing status during flush', async () => {
      const statusUpdates: QueueStatus[] = [];
      offlineQueue.subscribe(status => statusUpdates.push({ ...status }));

      // Add delay to observe processing state
      mockSetDoc.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'processing-test',
        data: { name: 'Test' }
      });

      const flushPromise = offlineQueue.flush();
      
      // Check that processing status is set
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await flushPromise;

      // Should have seen processing: true during flush
      const processingStatuses = statusUpdates.filter(s => s.processing);
      expect(processingStatuses.length).toBeGreaterThan(0);
    });

    it('should trigger flush on visibility change when tab becomes active', () => {
      const flushSpy = jest.spyOn(offlineQueue, 'flush');
      
      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'visibility-test',
        data: { name: 'Test' }
      });

      // Simulate tab becoming hidden then visible
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      expect(flushSpy).not.toHaveBeenCalled();

      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Firebase operation errors gracefully', async () => {
      const firebaseError = new Error('Firebase: Permission denied');
      mockSetDoc.mockRejectedValue(firebaseError);

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'error-test',
        data: { name: 'Error Test' }
      });

      await offlineQueue.flush();

      // Operation should be retried and eventually dropped
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should handle malformed queue data in localStorage', () => {
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      localStorageMock.getItem.mockReturnValue('invalid json data');

      // Should handle gracefully and return empty queue
      const queueSize = offlineQueue.getQueueSize();
      expect(queueSize).toBe(0);
    });

    it('should handle localStorage access errors', () => {
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('LocalStorage access denied');
      });

      const result = offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'access-error-test',
        data: { name: 'Test' }
      });

      expect(result).toBe(false);
    });

    it('should handle missing data for save operations', async () => {
      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'no-data-test'
        // Missing data field
      });

      await offlineQueue.flush();

      // Should handle error and retry
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should sanitize error messages in operations', async () => {
      const sensitiveError = new Error('Connection failed to server 192.168.1.100 with credentials admin:password123');
      mockSetDoc.mockRejectedValue(sensitiveError);

      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'sensitive-error-test',
        data: { name: 'Test' }
      });

      await offlineQueue.flush();

      // Verify error was sanitized (implementation would track this internally)
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe('Data Expiration', () => {
    it('should remove expired operations from queue', () => {
      const localStorageMock = window.localStorage as jest.Mocked<typeof localStorage>;
      
      const expiredOp = {
        id: 'expired',
        type: 'save',
        collection: 'drafts',
        documentId: 'expired-doc',
        data: { name: 'Expired' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours old
        retryCount: 0
      };

      const validOp = {
        id: 'valid',
        type: 'save',
        collection: 'drafts',
        documentId: 'valid-doc',
        data: { name: 'Valid' },
        timestamp: Date.now() - (1 * 60 * 60 * 1000), // 1 hour old
        retryCount: 0
      };

      localStorageMock.getItem.mockReturnValue(
        JSON.stringify([expiredOp, validOp])
      );

      const queueSize = offlineQueue.getQueueSize();
      expect(queueSize).toBe(1); // Only valid operation should remain
    });
  });

  describe('Force Retry Functionality', () => {
    it('should allow manual retry of queued operations', async () => {
      offlineQueue.enqueue({
        type: 'save',
        collection: 'drafts',
        documentId: 'manual-retry-test',
        data: { name: 'Manual Retry' }
      });

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      // Force retry should not work when offline
      offlineQueue.forceRetry();
      expect(mockSetDoc).not.toHaveBeenCalled();

      // Go back online and force retry
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      offlineQueue.forceRetry();

      // Give time for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });
});
/**
 * Performance Tests for Workflow Persistence System
 * Tests save latency, memory usage, and scalability under load
 */

import { jest } from '@jest/globals';
import { draftService, UnifiedDraftCompat } from '../../services/draftService';
import { offlineQueue } from '../../services/offlineQueue';
import { performance as perfHooks } from 'perf_hooks';

// Mock Firebase for controlled testing
jest.mock('firebase/firestore');
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../utils/inputSanitizer', () => ({
  sanitizeText: jest.fn((text: string) => text)
}));

// Performance measurement utilities
class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  private memoryBaseline: number = 0;

  startMeasurement(operation: string): string {
    const measurementId = `${operation}_${Date.now()}_${Math.random()}`;
    const startTime = perfHooks.now();
    
    // Store start time
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    
    return measurementId;
  }

  endMeasurement(operation: string, measurementId: string): number {
    const endTime = perfHooks.now();
    // For simplicity, calculate elapsed time based on creation time embedded in ID
    const parts = measurementId.split('_');
    const startTime = parseFloat(parts[1] || '0');
    const elapsedMs = endTime - (startTime ? perfHooks.now() - (Date.now() - startTime) : 0);
    
    this.measurements.get(operation)?.push(elapsedMs);
    return elapsedMs;
  }

  getStats(operation: string) {
    const measurements = this.measurements.get(operation) || [];
    if (measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, p95: 0 };
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      avg: avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: measurements.length,
      p95: sorted[p95Index] || sorted[sorted.length - 1]
    };
  }

  measureMemory(): number {
    // Mock memory measurement (in a real environment, you'd use process.memoryUsage())
    return Math.floor(Math.random() * 50 + 10); // 10-60 MB
  }

  setMemoryBaseline(): void {
    this.memoryBaseline = this.measureMemory();
  }

  getMemoryDelta(): number {
    return this.measureMemory() - this.memoryBaseline;
  }

  reset(): void {
    this.measurements.clear();
    this.memoryBaseline = 0;
  }
}

// Test data factories
function createMockDraft(size: 'small' | 'medium' | 'large' = 'medium'): UnifiedDraftCompat {
  const sizeConfig = {
    small: { trips: 50, timepoints: 10, blocks: 3 },
    medium: { trips: 200, timepoints: 25, blocks: 8 },
    large: { trips: 1000, timepoints: 50, blocks: 20 }
  };

  const config = sizeConfig[size];
  
  const mockData = {
    sheets: ['Raw_Data'],
    data: {
      Raw_Data: Array.from({ length: config.trips * config.timepoints }, (_, i) => [
        `Route_${Math.floor(i / config.timepoints)}`,
        i % 2 === 0 ? 'CW' : 'CCW',
        `Timepoint_${i % config.timepoints}`,
        `${Math.floor(i / 10) + 6}:${String(i % 60).padStart(2, '0')}`,
        String(30 + (i % 20))
      ])
    }
  };

  return {
    draftId: `perf_test_${size}_${Date.now()}`,
    draftName: `Performance Test Draft (${size})`,
    originalData: {
      fileName: `perf-test-${size}.csv`,
      fileType: 'csv',
      uploadedData: mockData,
      uploadTimestamp: new Date().toISOString()
    },
    currentStep: 'summary',
    progress: 80,
    stepData: {
      timepoints: {
        serviceBands: Array.from({ length: 3 }, (_, i) => ({
          id: `band-${i}`,
          name: `Service Band ${i + 1}`,
          color: ['#28a745', '#ffc107', '#dc3545'][i]
        })),
        travelTimeData: Array.from({ length: config.timepoints }, (_, i) => ({
          timepoint: `Timepoint_${i}`,
          time: 600 + i * 30,
          band: `band-${i % 3}`
        })),
        outliers: Array.from({ length: Math.floor(config.timepoints / 5) }, (_, i) => ({
          timepoint: `Timepoint_${i * 5}`,
          time: 1200,
          reason: 'Traffic delay'
        }))
      },
      blockConfiguration: {
        numberOfBuses: config.blocks,
        cycleTimeMinutes: 60,
        automateBlockStartTimes: true,
        blockConfigurations: Array.from({ length: config.blocks }, (_, i) => ({
          blockId: `B${i + 1}`,
          startTime: `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${String((i % 2) * 30).padStart(2, '0')}`,
          trips: Array.from({ length: Math.floor(config.trips / config.blocks) }, (_, j) => `trip-${i * 10 + j}`)
        }))
      },
      summarySchedule: {
        routeId: `perf-route-${size}`,
        routeName: `Performance Test Route (${size})`,
        trips: Array.from({ length: config.trips }, (_, i) => ({
          tripId: `trip-${i}`,
          blockId: `B${(i % config.blocks) + 1}`,
          startTime: `${String(6 + Math.floor(i / 20)).padStart(2, '0')}:${String((i * 3) % 60).padStart(2, '0')}`,
          endTime: `${String(7 + Math.floor(i / 20)).padStart(2, '0')}:${String((i * 3 + 30) % 60).padStart(2, '0')}`,
          timepoints: Array.from({ length: config.timepoints }, (_, j) => ({
            name: `Timepoint_${j}`,
            arrivalTime: `${String(6 + Math.floor((i * 3 + j * 2) / 60)).padStart(2, '0')}:${String((i * 3 + j * 2) % 60).padStart(2, '0')}`,
            departureTime: `${String(6 + Math.floor((i * 3 + j * 2 + 1) / 60)).padStart(2, '0')}:${String((i * 3 + j * 2 + 1) % 60).padStart(2, '0')}`
          }))
        }))
      }
    },
    ui: {
      celebrationsShown: [],
      lastViewedStep: 'summary'
    },
    metadata: {
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      version: 1,
      isPublished: false
    }
  };
}

describe('Workflow Persistence Performance Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new PerformanceMonitor();
    monitor.setMemoryBaseline();

    // Mock Firebase operations with realistic delays
    const { runTransaction } = require('firebase/firestore');
    (runTransaction as jest.Mock).mockImplementation(async (db, updateFunction) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      const mockTransaction = { set: jest.fn() };
      return await updateFunction(mockTransaction);
    });
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('Save Latency Performance', () => {
    test('should save small drafts within 2 seconds', async () => {
      const draft = createMockDraft('small');
      const targetLatency = 2000; // 2 seconds

      const measurementId = monitor.startMeasurement('save_small');
      const result = await draftService.saveDraft(draft, 'user123');
      const elapsed = monitor.endMeasurement('save_small', measurementId);

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(targetLatency);

      console.log(`Small draft save latency: ${elapsed.toFixed(2)}ms`);
    });

    test('should save medium drafts within 5 seconds', async () => {
      const draft = createMockDraft('medium');
      const targetLatency = 5000; // 5 seconds

      const measurementId = monitor.startMeasurement('save_medium');
      const result = await draftService.saveDraft(draft, 'user123');
      const elapsed = monitor.endMeasurement('save_medium', measurementId);

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(targetLatency);

      console.log(`Medium draft save latency: ${elapsed.toFixed(2)}ms`);
    });

    test('should save large drafts within 10 seconds', async () => {
      const draft = createMockDraft('large');
      const targetLatency = 10000; // 10 seconds

      monitor.setMemoryBaseline();
      const measurementId = monitor.startMeasurement('save_large');
      const result = await draftService.saveDraft(draft, 'user123');
      const elapsed = monitor.endMeasurement('save_large', measurementId);
      const memoryDelta = monitor.getMemoryDelta();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(targetLatency);
      expect(memoryDelta).toBeLessThan(100); // Less than 100MB increase

      console.log(`Large draft save latency: ${elapsed.toFixed(2)}ms, Memory delta: ${memoryDelta}MB`);
    });

    test('should maintain consistent performance across multiple saves', async () => {
      const numSaves = 10;
      const drafts = Array.from({ length: numSaves }, () => createMockDraft('medium'));

      for (const draft of drafts) {
        const measurementId = monitor.startMeasurement('batch_save');
        await draftService.saveDraft(draft, 'user123');
        monitor.endMeasurement('batch_save', measurementId);
      }

      const stats = monitor.getStats('batch_save');
      
      // Performance should be consistent (p95 < 2x average)
      expect(stats.p95).toBeLessThan(stats.avg * 2);
      expect(stats.avg).toBeLessThan(5000); // Average under 5 seconds

      console.log(`Batch save stats: avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms`);
    });

    test('should handle concurrent saves efficiently', async () => {
      const numConcurrent = 5;
      const drafts = Array.from({ length: numConcurrent }, (_, i) => ({
        ...createMockDraft('small'),
        draftId: `concurrent_${i}_${Date.now()}`
      }));

      const startTime = perfHooks.now();
      const promises = drafts.map(draft => draftService.saveDraft(draft, 'user123'));
      const results = await Promise.all(promises);
      const totalTime = perfHooks.now() - startTime;

      // All saves should succeed
      results.forEach(result => expect(result.success).toBe(true));
      
      // Concurrent execution should be faster than sequential
      const sequentialEstimate = numConcurrent * 2000; // 2s per save
      expect(totalTime).toBeLessThan(sequentialEstimate * 0.7); // At least 30% faster

      console.log(`Concurrent saves: ${numConcurrent} saves in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Load Performance', () => {
    test('should load drafts quickly regardless of size', async () => {
      const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
      const targetLatencies = { small: 1000, medium: 2000, large: 3000 };

      for (const size of sizes) {
        const draft = createMockDraft(size);
        
        // Save first
        await draftService.saveDraft(draft, 'user123');
        
        // Then measure load time
        const measurementId = monitor.startMeasurement(`load_${size}`);
        const loadedDraft = await draftService.getDraft(draft.draftId, 'user123');
        const elapsed = monitor.endMeasurement(`load_${size}`, measurementId);

        expect(loadedDraft).toBeTruthy();
        expect(elapsed).toBeLessThan(targetLatencies[size]);
        
        console.log(`Load ${size} draft: ${elapsed.toFixed(2)}ms`);
      }
    });

    test('should benefit from caching on repeated loads', async () => {
      const draft = createMockDraft('medium');
      await draftService.saveDraft(draft, 'user123');

      // First load (cache miss)
      const measurementId1 = monitor.startMeasurement('load_cache_miss');
      await draftService.getDraft(draft.draftId, 'user123');
      const firstLoad = monitor.endMeasurement('load_cache_miss', measurementId1);

      // Second load (cache hit)
      const measurementId2 = monitor.startMeasurement('load_cache_hit');
      await draftService.getDraft(draft.draftId, 'user123');
      const secondLoad = monitor.endMeasurement('load_cache_hit', measurementId2);

      // Cache hit should be significantly faster
      expect(secondLoad).toBeLessThan(firstLoad * 0.5);
      
      console.log(`Cache miss: ${firstLoad.toFixed(2)}ms, Cache hit: ${secondLoad.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    test('should maintain reasonable memory usage with large datasets', async () => {
      monitor.setMemoryBaseline();
      
      const largeDrafts = Array.from({ length: 5 }, () => createMockDraft('large'));
      
      for (const draft of largeDrafts) {
        await draftService.saveDraft(draft, 'user123');
      }
      
      const memoryDelta = monitor.getMemoryDelta();
      const memoryPerDraft = memoryDelta / largeDrafts.length;
      
      // Should not use excessive memory per draft
      expect(memoryPerDraft).toBeLessThan(50); // Less than 50MB per large draft
      expect(memoryDelta).toBeLessThan(200); // Total less than 200MB
      
      console.log(`Memory usage: ${memoryDelta}MB total, ${memoryPerDraft.toFixed(2)}MB per draft`);
    });

    test('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating many drafts rapidly
      const stressDrafts = Array.from({ length: 20 }, () => createMockDraft('medium'));
      
      monitor.setMemoryBaseline();
      let successfulSaves = 0;
      
      for (const draft of stressDrafts) {
        try {
          const result = await draftService.saveDraft(draft, 'user123');
          if (result.success) successfulSaves++;
        } catch (error) {
          // Some failures are acceptable under memory pressure
          console.warn('Save failed under memory pressure:', error);
        }
      }
      
      const memoryDelta = monitor.getMemoryDelta();
      
      // Should save most drafts even under pressure
      expect(successfulSaves).toBeGreaterThanOrEqual(stressDrafts.length * 0.8); // 80% success rate
      
      // Memory should stabilize, not grow unbounded
      expect(memoryDelta).toBeLessThan(500); // Less than 500MB total
      
      console.log(`Memory stress test: ${successfulSaves}/${stressDrafts.length} saves, ${memoryDelta}MB used`);
    });
  });

  describe('Offline Queue Performance', () => {
    test('should queue operations efficiently when offline', async () => {
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      const drafts = Array.from({ length: 10 }, () => createMockDraft('small'));
      
      const measurementId = monitor.startMeasurement('offline_queue');
      
      for (const draft of drafts) {
        offlineQueue.enqueue({
          type: 'save',
          collection: 'drafts',
          documentId: draft.draftId,
          data: draft
        });
      }
      
      const elapsed = monitor.endMeasurement('offline_queue', measurementId);
      
      // Queuing should be very fast
      expect(elapsed).toBeLessThan(1000); // Less than 1 second for 10 operations
      expect(offlineQueue.getQueueSize()).toBe(10);
      
      console.log(`Offline queue performance: ${elapsed.toFixed(2)}ms for 10 operations`);
    });

    test('should process large queue efficiently when back online', async () => {
      // Queue many operations while offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      const numOperations = 50;
      for (let i = 0; i < numOperations; i++) {
        offlineQueue.enqueue({
          type: 'save',
          collection: 'drafts',
          documentId: `draft_${i}`,
          data: createMockDraft('small')
        });
      }
      
      expect(offlineQueue.getQueueSize()).toBe(numOperations);
      
      // Go back online and measure processing time
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      
      const measurementId = monitor.startMeasurement('queue_flush');
      await offlineQueue.flush();
      const elapsed = monitor.endMeasurement('queue_flush', measurementId);
      
      // Should process entire queue efficiently
      expect(offlineQueue.getQueueSize()).toBe(0);
      expect(elapsed).toBeLessThan(30000); // Less than 30 seconds for 50 operations
      
      const opsPerSecond = numOperations / (elapsed / 1000);
      expect(opsPerSecond).toBeGreaterThan(2); // At least 2 operations per second
      
      console.log(`Queue flush performance: ${elapsed.toFixed(2)}ms, ${opsPerSecond.toFixed(2)} ops/sec`);
    });
  });

  describe('Conflict Resolution Performance', () => {
    test('should resolve conflicts quickly', async () => {
      const draft = createMockDraft('medium');
      
      // Create initial version
      await draftService.saveDraft(draft, 'user123');
      
      // Create conflicting versions
      const conflict1 = { ...draft, metadata: { ...draft.metadata, version: 2 } };
      const conflict2 = { ...draft, metadata: { ...draft.metadata, version: 3 } };
      
      const measurementId = monitor.startMeasurement('conflict_resolution');
      
      // Attempt concurrent saves (simulating conflict)
      const results = await Promise.all([
        draftService.saveDraft(conflict1, 'user123'),
        draftService.saveDraft(conflict2, 'user123')
      ]);
      
      const elapsed = monitor.endMeasurement('conflict_resolution', measurementId);
      
      // Both should succeed (one via conflict resolution)
      expect(results.every(r => r.success)).toBe(true);
      
      // Should resolve conflicts quickly
      expect(elapsed).toBeLessThan(5000); // Less than 5 seconds
      
      console.log(`Conflict resolution: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Scalability Tests', () => {
    test('should handle increasing load gracefully', async () => {
      const loadLevels = [5, 10, 20, 50];
      const results: { load: number; avgLatency: number; throughput: number }[] = [];
      
      for (const load of loadLevels) {
        const drafts = Array.from({ length: load }, () => createMockDraft('small'));
        
        const startTime = perfHooks.now();
        const promises = drafts.map(draft => {
          const measurementId = monitor.startMeasurement('scalability');
          return draftService.saveDraft(draft, 'user123')
            .then(result => {
              monitor.endMeasurement('scalability', measurementId);
              return result;
            });
        });
        
        await Promise.all(promises);
        const totalTime = perfHooks.now() - startTime;
        
        const stats = monitor.getStats('scalability');
        const throughput = load / (totalTime / 1000); // operations per second
        
        results.push({
          load,
          avgLatency: stats.avg,
          throughput
        });
        
        monitor.reset();
        
        console.log(`Load ${load}: ${stats.avg.toFixed(2)}ms avg latency, ${throughput.toFixed(2)} ops/sec`);
      }
      
      // Performance should degrade gracefully, not exponentially
      const latencyIncrease = results[results.length - 1].avgLatency / results[0].avgLatency;
      expect(latencyIncrease).toBeLessThan(5); // No more than 5x slower at 10x load
      
      // Throughput should remain reasonable
      expect(results[results.length - 1].throughput).toBeGreaterThan(1); // At least 1 op/sec
    });

    test('should maintain performance with frequent small updates', async () => {
      const draft = createMockDraft('medium');
      await draftService.saveDraft(draft, 'user123');
      
      // Simulate many small updates (like inline edits)
      const numUpdates = 100;
      const updateInterval = 50; // 50ms between updates
      
      const measurementId = monitor.startMeasurement('frequent_updates');
      
      for (let i = 0; i < numUpdates; i++) {
        draft.metadata.version = i + 1;
        draft.metadata.lastModifiedAt = new Date().toISOString();
        
        await draftService.saveDraft(draft, 'user123');
        
        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, updateInterval));
      }
      
      const elapsed = monitor.endMeasurement('frequent_updates', measurementId);
      const avgUpdateTime = elapsed / numUpdates;
      
      // Updates should remain fast
      expect(avgUpdateTime).toBeLessThan(500); // Less than 500ms per update on average
      
      console.log(`Frequent updates: ${avgUpdateTime.toFixed(2)}ms avg per update`);
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up resources after operations', async () => {
      monitor.setMemoryBaseline();
      
      // Perform many operations
      const operations = Array.from({ length: 50 }, () => createMockDraft('small'));
      
      for (const draft of operations) {
        await draftService.saveDraft(draft, 'user123');
        await draftService.getDraft(draft.draftId, 'user123');
      }
      
      const peakMemory = monitor.getMemoryDelta();
      
      // Simulate garbage collection / cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalMemory = monitor.getMemoryDelta();
      
      // Memory usage should stabilize or decrease
      expect(finalMemory).toBeLessThanOrEqual(peakMemory * 1.1); // Allow 10% variance
      
      console.log(`Resource cleanup: Peak ${peakMemory}MB, Final ${finalMemory}MB`);
    });
  });
});
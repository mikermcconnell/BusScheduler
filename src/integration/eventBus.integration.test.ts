/**
 * Event Bus Integration Tests
 * Focused testing for cross-panel communication via workspace event bus
 * Tests priority handling, debouncing, throttling, and error recovery
 */

import { workspaceEventBus, emit, subscribe, unsubscribe } from '../services/workspaceEventBus';
import { WorkspaceEvent, WorkspaceEventInput, ScheduleDataEvent } from '../types/workspaceEvents';

describe('Event Bus Integration Tests', () => {
  let eventSubscriptions: string[] = [];

  beforeEach(() => {
    // Clear event bus state
    workspaceEventBus.clearHistory();
    workspaceEventBus.resetStats();
    
    // Clean up any existing subscriptions
    eventSubscriptions.forEach(id => unsubscribe(id));
    eventSubscriptions = [];
  });

  afterEach(() => {
    // Clean up subscriptions
    eventSubscriptions.forEach(id => unsubscribe(id));
    eventSubscriptions = [];
  });

  describe('Event Priority and Ordering', () => {
    test('should execute high priority handlers before low priority handlers', async () => {
      const executionOrder: string[] = [];

      // Subscribe with different priorities
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          executionOrder.push('low-priority');
        }, { priority: 0 })
      );

      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          executionOrder.push('high-priority');
        }, { priority: 2 })
      );

      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          executionOrder.push('medium-priority');
        }, { priority: 1 })
      );

      // Emit event
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'upload', action: 'create', data: {} }
      });

      // Verify execution order
      expect(executionOrder).toEqual(['high-priority', 'medium-priority', 'low-priority']);
    });

    test('should handle concurrent events with proper ordering', async () => {
      const events: WorkspaceEvent[] = [];

      eventSubscriptions.push(
        subscribe(['schedule-data', 'workflow-progress'], (event) => {
          events.push(event);
        })
      );

      // Emit multiple events rapidly
      const promises = [
        emit({
          type: 'schedule-data',
          source: 'panel-1',
          priority: 1,
          payload: { dataType: 'upload', action: 'update', data: {} }
        }),
        emit({
          type: 'workflow-progress',
          source: 'panel-2',
          priority: 2,
          payload: { currentStep: 'upload', progress: 50, canProceed: true }
        }),
        emit({
          type: 'schedule-data',
          source: 'panel-3',
          priority: 0,
          payload: { dataType: 'timepoints', action: 'update', data: {} }
        })
      ];

      await Promise.all(promises);

      // Should receive all events
      expect(events).toHaveLength(3);
      
      // Verify event sources
      const sources = events.map(e => e.source);
      expect(sources).toContain('panel-1');
      expect(sources).toContain('panel-2');
      expect(sources).toContain('panel-3');
    });
  });

  describe('Debouncing and Throttling', () => {
    test('should debounce rapid events properly', async () => {
      let executionCount = 0;
      const executionTimes: number[] = [];

      eventSubscriptions.push(
        subscribe('user-interaction', (event) => {
          executionCount++;
          executionTimes.push(Date.now());
        }, { debounce: 100 }) // 100ms debounce
      );

      // Emit rapid events
      for (let i = 0; i < 5; i++) {
        await emit({
          type: 'user-interaction',
          source: 'test',
          priority: 1,
          payload: { action: 'click', element: 'button', elementType: 'button' }
        });
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms between events
      }

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should only execute once due to debouncing
      expect(executionCount).toBe(1);
    });

    test('should throttle events within time window', async () => {
      let executionCount = 0;
      const executionTimes: number[] = [];

      eventSubscriptions.push(
        subscribe('user-interaction', (event) => {
          executionCount++;
          executionTimes.push(Date.now());
        }, { throttle: 100 }) // 100ms throttle
      );

      // Emit events rapidly
      for (let i = 0; i < 10; i++) {
        await emit({
          type: 'user-interaction',
          source: 'test',
          priority: 1,
          payload: { action: 'scroll', element: 'panel', elementType: 'panel' }
        });
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms between events
      }

      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should execute limited number of times due to throttling
      expect(executionCount).toBeGreaterThan(0);
      expect(executionCount).toBeLessThan(10);

      // Verify time gaps between executions
      if (executionTimes.length > 1) {
        for (let i = 1; i < executionTimes.length; i++) {
          const gap = executionTimes[i] - executionTimes[i - 1];
          expect(gap).toBeGreaterThanOrEqual(90); // Allow some timing variance
        }
      }
    });
  });

  describe('Event Filtering and Conditional Subscriptions', () => {
    test('should filter events based on custom conditions', async () => {
      const uploadEvents: WorkspaceEvent[] = [];
      const timePointsEvents: WorkspaceEvent[] = [];

      // Subscribe with filter for upload panel events only
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          uploadEvents.push(event);
        }, {
          filter: (event) => event.source === 'upload-panel'
        })
      );

      // Subscribe with filter for timepoints panel events only
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          timePointsEvents.push(event);
        }, {
          filter: (event) => event.source === 'timepoints-panel'
        })
      );

      // Emit events from different sources
      await emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: { dataType: 'upload', action: 'create', data: {} }
      });

      await emit({
        type: 'schedule-data',
        source: 'timepoints-panel',
        priority: 1,
        payload: { dataType: 'timepoints', action: 'create', data: {} }
      });

      await emit({
        type: 'schedule-data',
        source: 'blocks-panel',
        priority: 1,
        payload: { dataType: 'blocks', action: 'create', data: {} }
      });

      // Verify filtering works correctly
      expect(uploadEvents).toHaveLength(1);
      expect(uploadEvents[0].source).toBe('upload-panel');

      expect(timePointsEvents).toHaveLength(1);
      expect(timePointsEvents[0].source).toBe('timepoints-panel');
    });

    test('should support complex filtering logic', async () => {
      const highPriorityUploadEvents: WorkspaceEvent[] = [];

      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          highPriorityUploadEvents.push(event);
        }, {
          filter: (event) => {
            if (event.type === 'schedule-data') {
              const scheduleEvent = event as ScheduleDataEvent;
              return event.source.includes('upload') && 
                     event.priority >= 2 && 
                     scheduleEvent.payload.action === 'create';
            }
            return false;
          }
        })
      );

      // Emit various events
      const testEvents: WorkspaceEventInput[] = [
        {
          type: 'schedule-data' as const,
          source: 'upload-panel',
          priority: 1,
          payload: { dataType: 'upload', action: 'create', data: {} }
        },
        {
          type: 'schedule-data' as const,
          source: 'upload-panel',
          priority: 2,
          payload: { dataType: 'upload', action: 'create', data: {} }
        },
        {
          type: 'schedule-data' as const,
          source: 'timepoints-panel',
          priority: 3,
          payload: { dataType: 'timepoints', action: 'create', data: {} }
        },
        {
          type: 'schedule-data' as const,
          source: 'upload-panel',
          priority: 2,
          payload: { dataType: 'upload', action: 'update', data: {} }
        }
      ];

      for (const event of testEvents) {
        await emit(event);
      }

      // Only one event should match all filter conditions
      expect(highPriorityUploadEvents).toHaveLength(1);
      expect(highPriorityUploadEvents[0].source).toBe('upload-panel');
      expect(highPriorityUploadEvents[0].priority).toBe(2);
      const scheduleEvent = highPriorityUploadEvents[0] as ScheduleDataEvent;
      expect(scheduleEvent.payload.action).toBe('create');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle handler errors without affecting other handlers', async () => {
      let successHandler1Executed = false;
      let successHandler2Executed = false;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Subscribe handlers: one that throws, two that succeed
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          successHandler1Executed = true;
        })
      );

      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          throw new Error('Handler error for testing');
        })
      );

      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          successHandler2Executed = true;
        })
      );

      // Emit event
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'upload', action: 'create', data: {} }
      });

      // Successful handlers should still execute
      expect(successHandler1Executed).toBe(true);
      expect(successHandler2Executed).toBe(true);

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test('should maintain event bus state after errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Subscribe error-throwing handler
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          throw new Error('Test error');
        })
      );

      // Emit event that causes error
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'upload', action: 'create', data: {} }
      });

      // Event bus should still be functional
      let normalHandlerExecuted = false;
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          normalHandlerExecuted = true;
        })
      );

      // Emit normal event
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'timepoints', action: 'update', data: {} }
      });

      expect(normalHandlerExecuted).toBe(true);

      // Check event bus statistics
      const stats = workspaceEventBus.getStats();
      expect(stats.totalEvents).toBe(2);

      consoleErrorSpy.mockRestore();
    });

    test('should handle subscription cleanup properly', async () => {
      let handlerExecuted = false;

      const subscriptionId = subscribe('schedule-data', (event) => {
        handlerExecuted = true;
      });

      // Emit event - should execute
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'blocks', action: 'delete', data: {} }
      });

      expect(handlerExecuted).toBe(true);

      // Unsubscribe
      const unsubscribed = unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);

      // Reset flag and emit again
      handlerExecuted = false;
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'trips', action: 'delete', data: {} }
      });

      // Handler should not execute after unsubscribe
      expect(handlerExecuted).toBe(false);
    });
  });

  describe('Event History and Debugging', () => {
    test('should maintain event history correctly', async () => {
      const testEvents: WorkspaceEventInput[] = [
        {
          type: 'schedule-data' as const,
          source: 'upload-panel',
          priority: 1,
          payload: { dataType: 'upload', action: 'create', data: {} }
        },
        {
          type: 'workflow-progress' as const,
          source: 'timepoints-panel',
          priority: 1,
          payload: { currentStep: 'timepoints' as const, progress: 50, canProceed: true }
        },
        {
          type: 'user-interaction' as const,
          source: 'blocks-panel',
          priority: 1,
          payload: { action: 'click', element: 'button', elementType: 'button' }
        }
      ];

      // Emit test events
      for (const event of testEvents) {
        await emit(event);
      }

      // Check complete history
      const history = workspaceEventBus.getHistory();
      expect(history).toHaveLength(3);

      // Check filtered history
      const scheduleDataHistory = workspaceEventBus.getHistory('schedule-data');
      expect(scheduleDataHistory).toHaveLength(1);
      expect(scheduleDataHistory[0].type).toBe('schedule-data');

      // Check limited history
      const limitedHistory = workspaceEventBus.getHistory(undefined, 2);
      expect(limitedHistory).toHaveLength(2);

      // History should include generated IDs and timestamps
      history.forEach(event => {
        expect(event.id).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe('number');
      });
    });

    test('should provide accurate statistics', async () => {
      // Clear stats to start fresh
      workspaceEventBus.resetStats();

      const initialStats = workspaceEventBus.getStats();
      expect(initialStats.totalEvents).toBe(0);

      // Subscribe handlers
      eventSubscriptions.push(
        subscribe('schedule-data', () => {})
      );
      eventSubscriptions.push(
        subscribe(['workflow-progress', 'user-interaction'], () => {})
      );

      // Emit various events
      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'service-bands', action: 'update', data: {} }
      });

      await emit({
        type: 'schedule-data',
        source: 'test',
        priority: 1,
        payload: { dataType: 'timepoints', action: 'bulk-update', data: {} }
      });

      await emit({
        type: 'workflow-progress',
        source: 'test',
        priority: 1,
        payload: { currentStep: 'upload', progress: 25, canProceed: true }
      });

      const finalStats = workspaceEventBus.getStats();

      // Check statistics
      expect(finalStats.totalEvents).toBe(3);
      expect(finalStats.totalSubscriptions).toBeGreaterThan(0);
      expect(finalStats.eventsByType['schedule-data']).toBe(2);
      expect(finalStats.eventsByType['workflow-progress']).toBe(1);
      expect(finalStats.averageProcessingTime).toBeGreaterThan(0);
      expect(finalStats.lastReset).toBeDefined();
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle high-frequency events efficiently', async () => {
      let eventCount = 0;
      const startTime = Date.now();

      eventSubscriptions.push(
        subscribe('user-interaction', () => {
          eventCount++;
        })
      );

      // Emit 100 events rapidly
      const eventPromises = [];
      for (let i = 0; i < 100; i++) {
        eventPromises.push(emit({
          type: 'user-interaction' as const,
          source: 'performance-test',
          priority: 1,
          payload: { action: 'rapid-event', element: 'test', elementType: 'panel' }
        } as WorkspaceEventInput));
      }

      await Promise.all(eventPromises);

      const processingTime = Date.now() - startTime;
      
      // Should handle 100 events quickly (within 1 second)
      expect(processingTime).toBeLessThan(1000);
      expect(eventCount).toBe(100);

      // Check performance metrics
      const stats = workspaceEventBus.getStats();
      expect(stats.averageProcessingTime).toBeLessThan(50); // < 50ms average
    });

    test('should manage memory with history size limits', async () => {
      // Emit more events than the default history limit (1000)
      const eventPromises = [];
      for (let i = 0; i < 1200; i++) {
        eventPromises.push(emit({
          type: 'user-interaction' as const,
          source: 'memory-test',
          priority: 1,
          payload: { action: 'memory-event', element: 'test', elementType: 'panel' }
        } as WorkspaceEventInput));
      }

      await Promise.all(eventPromises);

      const history = workspaceEventBus.getHistory();
      
      // Should not exceed maximum history size
      expect(history.length).toBeLessThanOrEqual(1000);

      // Should keep the most recent events
      const lastEvent = history[history.length - 1];
      expect(lastEvent.source).toBe('memory-test');
    });

    test('should cleanup subscriptions and handlers properly', async () => {
      const subscriptionIds: string[] = [];

      // Create multiple subscriptions
      for (let i = 0; i < 10; i++) {
        subscriptionIds.push(
          subscribe('schedule-data', () => {})
        );
      }

      const initialSubscriptions = workspaceEventBus.getSubscriptions();
      expect(initialSubscriptions.get('schedule-data')?.length).toBe(10);

      // Unsubscribe half of them
      for (let i = 0; i < 5; i++) {
        unsubscribe(subscriptionIds[i]);
      }

      const afterCleanupSubscriptions = workspaceEventBus.getSubscriptions();
      expect(afterCleanupSubscriptions.get('schedule-data')?.length).toBe(5);

      // Unsubscribe remaining
      for (let i = 5; i < 10; i++) {
        unsubscribe(subscriptionIds[i]);
      }

      const finalSubscriptions = workspaceEventBus.getSubscriptions();
      expect(finalSubscriptions.has('schedule-data')).toBe(false);
    });
  });

  describe('Real-world Event Scenarios', () => {
    test('should handle complete upload-to-export workflow events', async () => {
      const workflowEvents: WorkspaceEvent[] = [];

      // Subscribe to all workflow events
      eventSubscriptions.push(
        subscribe(['schedule-data', 'workflow-progress', 'data-validation', 'user-interaction'], (event) => {
          workflowEvents.push(event);
        })
      );

      // Simulate complete workflow
      
      // 1. Upload file
      await emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: { 
          dataType: 'upload', 
          action: 'create', 
          data: { fileName: 'test-schedule.csv', fileType: 'csv' }
        }
      });

      // 2. Progress to timepoints
      await emit({
        type: 'workflow-progress',
        source: 'upload-panel',
        priority: 1,
        payload: { 
          currentStep: 'timepoints', 
          progress: 25, 
          canProceed: true
        }
      });

      // 3. Analyze timepoints
      await emit({
        type: 'schedule-data',
        source: 'timepoints-panel',
        priority: 1,
        payload: { 
          dataType: 'timepoints', 
          action: 'create', 
          data: { serviceBands: [], travelTimes: [] }
        }
      });

      // 4. Configure blocks
      await emit({
        type: 'schedule-data',
        source: 'blocks-panel',
        priority: 1,
        payload: { 
          dataType: 'blocks', 
          action: 'create', 
          data: { blockCount: 3, cycleTime: 45 }
        }
      });

      // 5. Generate export
      await emit({
        type: 'schedule-data',
        source: 'export-panel',
        priority: 1,
        payload: { 
          dataType: 'trips', 
          action: 'create', 
          data: { format: 'csv', size: '2.5MB' }
        }
      });

      // Verify complete workflow was captured
      expect(workflowEvents).toHaveLength(5);
      
      const eventTypes = workflowEvents.map(e => e.type);
      expect(eventTypes).toContain('schedule-data');
      expect(eventTypes).toContain('workflow-progress');
      
      const sources = workflowEvents.map(e => e.source);
      expect(sources).toContain('upload-panel');
      expect(sources).toContain('timepoints-panel');
      expect(sources).toContain('blocks-panel');
      expect(sources).toContain('export-panel');
      
      // Verify event ordering (should be chronological)
      for (let i = 1; i < workflowEvents.length; i++) {
        expect(workflowEvents[i].timestamp).toBeGreaterThanOrEqual(workflowEvents[i-1].timestamp);
      }
    });

    test('should handle error recovery scenarios', async () => {
      const errorRecoveryEvents: WorkspaceEvent[] = [];

      eventSubscriptions.push(
        subscribe(['schedule-data', 'notification', 'auto-save'], (event) => {
          errorRecoveryEvents.push(event);
        })
      );

      // Simulate error scenario
      await emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: { 
          dataType: 'upload', 
          action: 'delete', 
          data: { error: 'Network timeout', retryable: true }
        }
      });

      // Simulate recovery
      await emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: { 
          dataType: 'upload', 
          action: 'update', 
          data: { attempt: 2, maxAttempts: 3 }
        }
      });

      // Simulate successful recovery
      await emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: { 
          dataType: 'upload', 
          action: 'create', 
          data: { fileName: 'recovered-schedule.csv', fromRetry: true }
        }
      });

      // Verify error recovery flow
      expect(errorRecoveryEvents).toHaveLength(3);
      
      const scheduleEvents = errorRecoveryEvents.filter(e => e.type === 'schedule-data') as ScheduleDataEvent[];
      const actions = scheduleEvents.map(e => e.payload.action);
      expect(actions).toEqual(['delete', 'update', 'create']);
      
      // Verify last event indicates successful recovery
      const finalEvent = scheduleEvents[scheduleEvents.length - 1];
      expect(finalEvent.payload.data.fromRetry).toBe(true);
    });
  });
});
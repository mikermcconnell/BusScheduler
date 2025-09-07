/**
 * Workspace Event Bus
 * Type-safe pub/sub system for cross-panel communication
 * Provides reliable, debounced, and prioritized event handling
 */

import {
  WorkspaceEvent,
  WorkspaceEventInput,
  EventHandler,
  EventSubscription,
  EventListenerOptions,
  EventBusStats,
  EventBusConfig
} from '../types/workspaceEvents';
import { sanitizeText } from '../utils/inputSanitizer';

/**
 * Default event bus configuration
 */
const DEFAULT_CONFIG: EventBusConfig = {
  maxHistorySize: 1000,
  debug: process.env.NODE_ENV === 'development',
  enableMetrics: true,
  maxProcessingTime: 100, // 100ms warning threshold
  enableReplay: false
};

/**
 * Debounced function wrapper
 */
interface DebouncedFunction {
  (...args: any[]): void;
  cancel(): void;
}

/**
 * Workspace Event Bus Implementation
 */
class WorkspaceEventBus {
  private static instance: WorkspaceEventBus;
  private subscriptions: Map<string, EventSubscription[]>;
  private eventHistory: WorkspaceEvent[];
  private stats: EventBusStats;
  private config: EventBusConfig;
  private debouncedHandlers: Map<string, DebouncedFunction>;
  private throttledHandlers: Map<string, { handler: Function; lastExecution: number }>;

  private constructor(config: Partial<EventBusConfig> = {}) {
    this.subscriptions = new Map();
    this.eventHistory = [];
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debouncedHandlers = new Map();
    this.throttledHandlers = new Map();
    
    this.stats = {
      totalEvents: 0,
      totalSubscriptions: 0,
      eventsByType: {},
      subscribersByType: {},
      averageProcessingTime: 0,
      lastReset: Date.now()
    };

    // Set up cleanup interval
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<EventBusConfig>): WorkspaceEventBus {
    if (!WorkspaceEventBus.instance) {
      WorkspaceEventBus.instance = new WorkspaceEventBus(config);
    }
    return WorkspaceEventBus.instance;
  }

  /**
   * Subscribe to events
   */
  subscribe<T extends WorkspaceEvent>(
    eventType: T['type'] | T['type'][],
    handler: EventHandler<T>,
    options: EventListenerOptions = {}
  ): string {
    const subscriptionId = this.generateId();
    const types = Array.isArray(eventType) ? eventType : [eventType];
    
    types.forEach(type => {
      if (!this.subscriptions.has(type)) {
        this.subscriptions.set(type, []);
      }
      
      const subscription: EventSubscription = {
        id: subscriptionId,
        eventType: type,
        handler: handler as EventHandler,
        options,
        created: Date.now(),
        executionCount: 0
      };
      
      this.subscriptions.get(type)!.push(subscription);
      
      // Update stats
      this.stats.totalSubscriptions++;
      this.stats.subscribersByType[type] = (this.stats.subscribersByType[type] || 0) + 1;
    });

    this.log(`Subscribed to [${types.join(', ')}] with ID: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    let found = false;
    
    this.subscriptions.forEach((subs, eventType) => {
      const index = subs.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        found = true;
        
        // Update stats
        this.stats.totalSubscriptions--;
        this.stats.subscribersByType[eventType]--;
        if (this.stats.subscribersByType[eventType] <= 0) {
          delete this.stats.subscribersByType[eventType];
        }
        
        // Clean up empty arrays
        if (subs.length === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    });

    // Clean up debounced/throttled handlers
    this.debouncedHandlers.delete(subscriptionId);
    this.throttledHandlers.delete(subscriptionId);

    if (found) {
      this.log(`Unsubscribed: ${subscriptionId}`);
    }
    
    return found;
  }

  /**
   * Emit an event
   */
  async emit(event: WorkspaceEventInput): Promise<void> {
    const startTime = performance.now();
    
    // Create complete event with ID and timestamp
    const completeEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now()
    } as WorkspaceEvent;

    // Sanitize event payload for security
    this.sanitizeEvent(completeEvent);

    // Add to history
    this.addToHistory(completeEvent);

    // Update stats
    this.stats.totalEvents++;
    this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1;

    this.log(`Emitting event: ${event.type}`, completeEvent);

    // Get subscribers for this event type
    const subscribers = this.subscriptions.get(event.type) || [];
    if (subscribers.length === 0) {
      this.log(`No subscribers for event type: ${event.type}`);
      return;
    }

    // Sort by priority (higher first)
    const sortedSubscribers = [...subscribers].sort((a, b) => 
      (b.options.priority || 0) - (a.options.priority || 0)
    );

    // Execute handlers
    const handlerPromises = sortedSubscribers.map(async (subscription) => {
      try {
        // Apply filter if provided
        if (subscription.options.filter && !subscription.options.filter(completeEvent)) {
          return;
        }

        // Handle debouncing
        if (subscription.options.debounce) {
          this.executeDebounced(subscription, completeEvent);
          return;
        }

        // Handle throttling
        if (subscription.options.throttle) {
          this.executeThrottled(subscription, completeEvent);
          return;
        }

        // Execute handler
        await this.executeHandler(subscription, completeEvent);

      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });

    await Promise.all(handlerPromises);

    // Update performance stats
    const processingTime = performance.now() - startTime;
    this.updateProcessingTime(processingTime);

    if (processingTime > this.config.maxProcessingTime) {
      console.warn(`Event processing took ${processingTime.toFixed(2)}ms (threshold: ${this.config.maxProcessingTime}ms)`);
    }
  }

  /**
   * Execute handler with proper error handling and stats
   */
  private async executeHandler(subscription: EventSubscription, event: WorkspaceEvent): Promise<void> {
    const startTime = performance.now();
    
    try {
      await subscription.handler(event);
      
      // Update subscription stats
      subscription.executionCount++;
      subscription.lastExecuted = Date.now();
      
      // Remove if once option is set
      if (subscription.options.once) {
        this.unsubscribe(subscription.id);
      }
      
    } catch (error) {
      console.error(`Handler execution failed for subscription ${subscription.id}:`, error);
      throw error;
    } finally {
      const executionTime = performance.now() - startTime;
      this.log(`Handler executed in ${executionTime.toFixed(2)}ms`);
    }
  }

  /**
   * Execute debounced handler
   */
  private executeDebounced(subscription: EventSubscription, event: WorkspaceEvent): void {
    const key = subscription.id;
    
    // Cancel existing debounced call
    if (this.debouncedHandlers.has(key)) {
      this.debouncedHandlers.get(key)!.cancel();
    }
    
    // Create new debounced function
    const debouncedFn = this.debounce(
      () => this.executeHandler(subscription, event),
      subscription.options.debounce!
    );
    
    this.debouncedHandlers.set(key, debouncedFn);
    debouncedFn();
  }

  /**
   * Execute throttled handler
   */
  private executeThrottled(subscription: EventSubscription, event: WorkspaceEvent): void {
    const key = subscription.id;
    const now = Date.now();
    const throttleInfo = this.throttledHandlers.get(key);
    
    if (!throttleInfo || (now - throttleInfo.lastExecution) >= subscription.options.throttle!) {
      this.throttledHandlers.set(key, {
        handler: () => this.executeHandler(subscription, event),
        lastExecution: now
      });
      
      this.executeHandler(subscription, event);
    }
  }

  /**
   * Debounce utility
   */
  private debounce(func: Function, wait: number): DebouncedFunction {
    let timeout: NodeJS.Timeout;
    
    const debounced = (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(null, args), wait);
    };
    
    debounced.cancel = () => {
      clearTimeout(timeout);
    };
    
    return debounced;
  }

  /**
   * Get event history
   */
  getHistory(eventType?: string, limit?: number): WorkspaceEvent[] {
    let history = eventType 
      ? this.eventHistory.filter(e => e.type === eventType)
      : this.eventHistory;
      
    if (limit) {
      history = history.slice(-limit);
    }
    
    return [...history]; // Return copy
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get statistics
   */
  getStats(): EventBusStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalEvents: 0,
      totalSubscriptions: this.stats.totalSubscriptions, // Keep current subscriptions
      eventsByType: {},
      subscribersByType: { ...this.stats.subscribersByType }, // Keep current subscribers
      averageProcessingTime: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }

  /**
   * Add event to history with size limit
   */
  private addToHistory(event: WorkspaceEvent): void {
    this.eventHistory.push(event);
    
    // Maintain history size limit
    if (this.eventHistory.length > this.config.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Update processing time statistics
   */
  private updateProcessingTime(time: number): void {
    if (this.stats.totalEvents === 1) {
      this.stats.averageProcessingTime = time;
    } else {
      // Running average
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.totalEvents - 1) + time) / this.stats.totalEvents;
    }
  }

  /**
   * Sanitize event data for security
   */
  private sanitizeEvent(event: WorkspaceEvent): void {
    // Sanitize string fields in the event
    if (event.source) {
      event.source = sanitizeText(event.source);
    }
    if (event.target) {
      event.target = sanitizeText(event.target);
    }
    
    // Recursively sanitize payload strings
    this.sanitizeObjectStrings(event.payload);
  }

  /**
   * Recursively sanitize strings in objects
   */
  private sanitizeObjectStrings(obj: any): void {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeText(obj[key]);
        } else if (typeof obj[key] === 'object') {
          this.sanitizeObjectStrings(obj[key]);
        }
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[EventBus] ${message}`, data || '');
    }
  }

  /**
   * Cleanup old handlers and subscriptions
   */
  private cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean up old debounced handlers
    this.debouncedHandlers.forEach((handler, key) => {
      // Cancel any pending debounced calls
      handler.cancel();
    });
    
    // Clean up old throttled handlers
    this.throttledHandlers.forEach((throttleInfo, key) => {
      if (throttleInfo.lastExecution < oneHourAgo) {
        this.throttledHandlers.delete(key);
      }
    });
    
    this.log('Cleanup completed');
  }

  /**
   * Destroy the event bus
   */
  destroy(): void {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.debouncedHandlers.clear();
    this.throttledHandlers.clear();
  }
}

// Export singleton instance
export const workspaceEventBus = WorkspaceEventBus.getInstance();

// Export convenience functions
export const subscribe = workspaceEventBus.subscribe.bind(workspaceEventBus);
export const unsubscribe = workspaceEventBus.unsubscribe.bind(workspaceEventBus);
export const emit = workspaceEventBus.emit.bind(workspaceEventBus);

// Export type guards for event handling
export const isDataValidationEvent = (event: WorkspaceEvent): event is import('../types/workspaceEvents').DataValidationEvent => 
  event.type === 'data-validation';

export const isPanelStateEvent = (event: WorkspaceEvent): event is import('../types/workspaceEvents').PanelStateEvent => 
  event.type === 'panel-state';

export const isScheduleDataEvent = (event: WorkspaceEvent): event is import('../types/workspaceEvents').ScheduleDataEvent => 
  event.type === 'schedule-data';

export const isWorkflowProgressEvent = (event: WorkspaceEvent): event is import('../types/workspaceEvents').WorkflowProgressEvent => 
  event.type === 'workflow-progress';
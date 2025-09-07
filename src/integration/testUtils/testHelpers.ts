/**
 * Test Helper Utilities for Integration Tests
 * Provides utilities for setup, mocking, assertions, and performance monitoring
 */

import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { workspaceEventBus, subscribe, unsubscribe, emit } from '../../services/workspaceEventBus';
import { WorkspaceEvent } from '../../types/workspaceEvents';

/**
 * Event capture utility for testing event bus communication
 */
export class EventCapture {
  private events: WorkspaceEvent[] = [];
  private subscriptionIds: string[] = [];
  private filters: Map<string, (event: WorkspaceEvent) => boolean> = new Map();

  constructor(eventTypes?: string | string[], filter?: (event: WorkspaceEvent) => boolean) {
    const types = Array.isArray(eventTypes) ? eventTypes : eventTypes ? [eventTypes] : ['*'];
    
    if (types.includes('*')) {
      // Subscribe to all events
      this.subscriptionIds.push(
        subscribe(['schedule-data', 'workflow-progress', 'user-interaction', 'data-validation', 'auto-save', 'panel-state'], (event) => {
          if (!filter || filter(event)) {
            this.events.push(event);
          }
        })
      );
    } else {
      // Subscribe to specific event types
      this.subscriptionIds.push(
        subscribe(types as any, (event) => {
          if (!filter || filter(event)) {
            this.events.push(event);
          }
        })
      );
    }
  }

  /**
   * Get all captured events
   */
  getEvents(): WorkspaceEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): WorkspaceEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events by source
   */
  getEventsBySource(source: string): WorkspaceEvent[] {
    return this.events.filter(e => e.source === source);
  }

  /**
   * Wait for a specific event to be emitted
   */
  async waitForEvent(
    predicate: (event: WorkspaceEvent) => boolean,
    timeout: number = 5000
  ): Promise<WorkspaceEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for event after ${timeout}ms`));
      }, timeout);

      const checkExistingEvents = () => {
        const existingEvent = this.events.find(predicate);
        if (existingEvent) {
          clearTimeout(timeoutId);
          resolve(existingEvent);
          return true;
        }
        return false;
      };

      // Check if event already exists
      if (checkExistingEvents()) return;

      // Set up interval to check for new events
      const checkInterval = setInterval(() => {
        if (checkExistingEvents()) {
          clearInterval(checkInterval);
        }
      }, 50);
    });
  }

  /**
   * Wait for multiple events matching criteria
   */
  async waitForEvents(
    predicate: (event: WorkspaceEvent) => boolean,
    count: number,
    timeout: number = 5000
  ): Promise<WorkspaceEvent[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${count} events after ${timeout}ms`));
      }, timeout);

      const checkEvents = () => {
        const matchingEvents = this.events.filter(predicate);
        if (matchingEvents.length >= count) {
          clearTimeout(timeoutId);
          resolve(matchingEvents.slice(0, count));
          return true;
        }
        return false;
      };

      // Check existing events first
      if (checkEvents()) return;

      // Set up interval to check for new events
      const checkInterval = setInterval(() => {
        if (checkEvents()) {
          clearInterval(checkInterval);
        }
      }, 50);
    });
  }

  /**
   * Clear captured events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get event statistics
   */
  getStats() {
    const eventsByType = this.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySource = this.events.reduce((acc, event) => {
      acc[event.source] = (acc[event.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySource,
      timeRange: this.events.length > 0 ? {
        first: this.events[0].timestamp,
        last: this.events[this.events.length - 1].timestamp,
        duration: this.events[this.events.length - 1].timestamp - this.events[0].timestamp
      } : null
    };
  }

  /**
   * Cleanup subscriptions
   */
  destroy(): void {
    this.subscriptionIds.forEach(id => unsubscribe(id));
    this.subscriptionIds = [];
    this.events = [];
  }
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private markers: Map<string, number> = new Map();
  private measurements: Array<{ name: string; duration: number; timestamp: number }> = [];

  /**
   * Start timing
   */
  start(name: string = 'default'): void {
    this.startTime = performance.now();
    this.markers.set(name, this.startTime);
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.markers.set(name, performance.now());
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark?: string, endMark?: string): number {
    const endTime = endMark ? this.markers.get(endMark) : performance.now();
    const startTime = startMark ? this.markers.get(startMark) : this.startTime;
    
    if (!endTime || !startTime) {
      throw new Error('Invalid marks for measurement');
    }

    const duration = endTime - startTime;
    this.measurements.push({
      name,
      duration,
      timestamp: performance.now()
    });

    return duration;
  }

  /**
   * Get all measurements
   */
  getMeasurements() {
    return [...this.measurements];
  }

  /**
   * Get measurement by name
   */
  getMeasurement(name: string) {
    return this.measurements.find(m => m.name === name);
  }

  /**
   * Assert performance thresholds
   */
  assertThreshold(name: string, maxDuration: number): void {
    const measurement = this.getMeasurement(name);
    if (!measurement) {
      throw new Error(`No measurement found for: ${name}`);
    }
    
    if (measurement.duration > maxDuration) {
      throw new Error(
        `Performance threshold exceeded for ${name}: ${measurement.duration.toFixed(2)}ms > ${maxDuration}ms`
      );
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const durations = this.measurements.map(m => m.duration);
    return {
      totalMeasurements: this.measurements.length,
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      averageDuration: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      measurements: this.measurements.map(m => ({
        name: m.name,
        duration: Math.round(m.duration * 100) / 100,
        timestamp: m.timestamp
      }))
    };
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = [];
    this.markers.clear();
    this.startTime = 0;
  }
}

/**
 * Memory monitoring utility
 */
export class MemoryMonitor {
  private snapshots: Array<{ name: string; memory: any; timestamp: number }> = [];

  /**
   * Take memory snapshot
   */
  snapshot(name: string): void {
    const memory = (performance as any).memory;
    this.snapshots.push({
      name,
      memory: memory ? {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      } : null,
      timestamp: Date.now()
    });
  }

  /**
   * Get memory usage difference between snapshots
   */
  getDifference(startSnapshot: string, endSnapshot: string): number {
    const start = this.snapshots.find(s => s.name === startSnapshot);
    const end = this.snapshots.find(s => s.name === endSnapshot);
    
    if (!start || !end || !start.memory || !end.memory) {
      return 0;
    }

    return end.memory.used - start.memory.used;
  }

  /**
   * Assert memory usage within limits
   */
  assertMemoryLimit(snapshotName: string, maxBytes: number): void {
    const snapshot = this.snapshots.find(s => s.name === snapshotName);
    if (!snapshot || !snapshot.memory) {
      throw new Error(`No memory snapshot found for: ${snapshotName}`);
    }

    if (snapshot.memory.used > maxBytes) {
      const usedMB = (snapshot.memory.used / (1024 * 1024)).toFixed(2);
      const maxMB = (maxBytes / (1024 * 1024)).toFixed(2);
      throw new Error(`Memory limit exceeded for ${snapshotName}: ${usedMB}MB > ${maxMB}MB`);
    }
  }

  /**
   * Get memory usage summary
   */
  getSummary() {
    return {
      totalSnapshots: this.snapshots.length,
      snapshots: this.snapshots.map(s => ({
        name: s.name,
        memory: s.memory ? {
          usedMB: Math.round((s.memory.used / (1024 * 1024)) * 100) / 100,
          totalMB: Math.round((s.memory.total / (1024 * 1024)) * 100) / 100,
          limitMB: Math.round((s.memory.limit / (1024 * 1024)) * 100) / 100,
          utilization: Math.round((s.memory.used / s.memory.total) * 100)
        } : null,
        timestamp: s.timestamp
      }))
    };
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
  }
}

/**
 * Panel interaction utilities
 */
export class PanelTestHelper {
  constructor(private screen: any, private user: ReturnType<typeof userEvent.setup>) {}

  /**
   * Open a panel by name
   */
  async openPanel(panelName: string): Promise<void> {
    const openButton = this.screen.getByRole('button', { 
      name: new RegExp(panelName, 'i') 
    });
    await this.user.click(openButton);
    
    await waitFor(() => {
      expect(this.screen.getByTestId(`${panelName.toLowerCase()}-panel`)).toBeInTheDocument();
    });
  }

  /**
   * Close a panel
   */
  async closePanel(panelName: string): Promise<void> {
    const panel = this.screen.getByTestId(`${panelName.toLowerCase()}-panel`);
    const closeButton = panel.querySelector('[aria-label*="close"], [title*="close"]');
    
    if (closeButton) {
      await this.user.click(closeButton);
      await waitFor(() => {
        expect(this.screen.queryByTestId(`${panelName.toLowerCase()}-panel`)).not.toBeInTheDocument();
      });
    }
  }

  /**
   * Minimize a panel
   */
  async minimizePanel(panelName: string): Promise<void> {
    const panel = this.screen.getByTestId(`${panelName.toLowerCase()}-panel`);
    const minimizeButton = panel.querySelector('[aria-label*="minimize"], [title*="minimize"]');
    
    if (minimizeButton) {
      await this.user.click(minimizeButton);
      await waitFor(() => {
        expect(panel).toHaveClass('minimized');
      });
    }
  }

  /**
   * Wait for panel to be ready
   */
  async waitForPanelReady(panelName: string, timeout: number = 5000): Promise<void> {
    await waitFor(() => {
      const panel = this.screen.getByTestId(`${panelName.toLowerCase()}-panel`);
      expect(panel).toBeInTheDocument();
      expect(panel).not.toHaveClass('loading');
    }, { timeout });
  }

  /**
   * Check if panel is open
   */
  isPanelOpen(panelName: string): boolean {
    return this.screen.queryByTestId(`${panelName.toLowerCase()}-panel`) !== null;
  }

  /**
   * Get panel element
   */
  getPanel(panelName: string): HTMLElement {
    return this.screen.getByTestId(`${panelName.toLowerCase()}-panel`);
  }

  /**
   * Upload file to upload panel
   */
  async uploadFile(file: File): Promise<void> {
    const uploadPanel = this.getPanel('upload');
    const fileInput = uploadPanel.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (fileInput) {
      await act(async () => {
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          configurable: true
        });
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      });
    }
  }

  /**
   * Configure blocks in blocks panel
   */
  async configureBlocks(busCount: number, cycleTime: number): Promise<void> {
    const blocksPanel = this.getPanel('blocks');
    
    // Set bus count
    const busCountInput = blocksPanel.querySelector('input[data-testid="bus-count"]') as HTMLInputElement;
    if (busCountInput) {
      await this.user.clear(busCountInput);
      await this.user.type(busCountInput, busCount.toString());
    }
    
    // Set cycle time
    const cycleTimeInput = blocksPanel.querySelector('input[data-testid="cycle-time"]') as HTMLInputElement;
    if (cycleTimeInput) {
      await this.user.clear(cycleTimeInput);
      await this.user.type(cycleTimeInput, cycleTime.toString());
    }
    
    // Apply configuration
    const applyButton = blocksPanel.querySelector('button[data-testid="apply-config"]');
    if (applyButton) {
      await this.user.click(applyButton);
    }
  }

  /**
   * Export schedule from export panel
   */
  async exportSchedule(format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<void> {
    const exportPanel = this.getPanel('export');
    
    // Select format
    const formatSelect = exportPanel.querySelector('select[data-testid="export-format"]') as HTMLSelectElement;
    if (formatSelect) {
      await this.user.selectOptions(formatSelect, format);
    }
    
    // Click export button
    const exportButton = exportPanel.querySelector('button[data-testid="export-button"]');
    if (exportButton) {
      await this.user.click(exportButton);
    }
  }
}

/**
 * Test data validation utilities
 */
export class DataValidator {
  /**
   * Validate event structure
   */
  static validateEvent(event: WorkspaceEvent): void {
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('source');
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('payload');
    expect(event).toHaveProperty('priority');
    
    expect(typeof event.id).toBe('string');
    expect(typeof event.type).toBe('string');
    expect(typeof event.source).toBe('string');
    expect(typeof event.timestamp).toBe('number');
    expect(typeof event.payload).toBe('object');
    expect(typeof event.priority).toBe('number');
  }

  /**
   * Validate schedule data structure
   */
  static validateScheduleData(scheduleData: any): void {
    expect(scheduleData).toHaveProperty('routeId');
    expect(scheduleData).toHaveProperty('routeName');
    expect(scheduleData).toHaveProperty('timePoints');
    expect(scheduleData).toHaveProperty('weekday');
    expect(scheduleData).toHaveProperty('saturday');
    expect(scheduleData).toHaveProperty('sunday');
    
    expect(Array.isArray(scheduleData.timePoints)).toBe(true);
    expect(Array.isArray(scheduleData.weekday)).toBe(true);
    expect(Array.isArray(scheduleData.saturday)).toBe(true);
    expect(Array.isArray(scheduleData.sunday)).toBe(true);
  }

  /**
   * Validate performance metrics
   */
  static validatePerformanceMetrics(metrics: any, thresholds: any): void {
    if (thresholds.maxDuration !== undefined) {
      expect(metrics.duration).toBeLessThanOrEqual(thresholds.maxDuration);
    }
    
    if (thresholds.maxMemory !== undefined) {
      expect(metrics.memoryUsage).toBeLessThanOrEqual(thresholds.maxMemory);
    }
    
    if (thresholds.minThroughput !== undefined) {
      expect(metrics.throughput).toBeGreaterThanOrEqual(thresholds.minThroughput);
    }
  }

  /**
   * Validate security sanitization
   */
  static validateSanitization(input: string, output: string): void {
    // Check that dangerous patterns are removed or escaped
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /'.*or.*'.*=/i, // SQL injection
      /drop\s+table/i
    ];
    
    dangerousPatterns.forEach(pattern => {
      if (pattern.test(input)) {
        expect(output).not.toMatch(pattern);
      }
    });
  }
}

/**
 * Mock setup utilities
 */
export class MockHelper {
  private static originalMethods: Map<string, any> = new Map();

  /**
   * Mock localStorage
   */
  static mockLocalStorage(): void {
    const mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      configurable: true
    });
  }

  /**
   * Mock fetch
   */
  static mockFetch(mockResponse: any = {}): jest.Mock {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
        ...mockResponse
      })
    );

    global.fetch = mockFetch;
    return mockFetch;
  }

  /**
   * Mock performance API
   */
  static mockPerformance(): void {
    if (!global.performance) {
      global.performance = {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByName: jest.fn(() => []),
        getEntriesByType: jest.fn(() => []),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn()
      } as any;
    }
    
    // Mock memory API if available
    if (!((global.performance as any).memory)) {
      (global.performance as any).memory = {
        usedJSHeapSize: 1024 * 1024 * 10, // 10MB
        totalJSHeapSize: 1024 * 1024 * 50, // 50MB
        jsHeapSizeLimit: 1024 * 1024 * 1024 * 4 // 4GB
      };
    }
  }

  /**
   * Mock console methods
   */
  static mockConsole(): { error: jest.SpyInstance; warn: jest.SpyInstance; log: jest.SpyInstance } {
    return {
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {})
    };
  }

  /**
   * Mock file reader
   */
  static mockFileReader(): void {
    const mockFileReader = {
      readAsText: jest.fn(),
      readAsDataURL: jest.fn(),
      result: '',
      error: null,
      onload: null,
      onerror: null,
      onloadend: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    global.FileReader = jest.fn(() => mockFileReader) as any;
  }

  /**
   * Restore all mocks
   */
  static restoreAll(): void {
    jest.restoreAllMocks();
    this.originalMethods.forEach((method, key) => {
      const [obj, prop] = key.split('.');
      if (obj === 'global') {
        (global as any)[prop] = method;
      } else if (obj === 'window') {
        (window as any)[prop] = method;
      }
    });
    this.originalMethods.clear();
  }
}

/**
 * Async test utilities
 */
export class AsyncTestUtils {
  /**
   * Wait for multiple conditions to be true
   */
  static async waitForAll(
    conditions: (() => boolean)[],
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (conditions.every(condition => condition())) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error('Timeout waiting for all conditions to be met');
  }

  /**
   * Wait for any condition to be true
   */
  static async waitForAny(
    conditions: (() => boolean)[],
    timeout: number = 5000
  ): Promise<number> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      for (let i = 0; i < conditions.length; i++) {
        if (conditions[i]()) {
          return i;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error('Timeout waiting for any condition to be met');
  }

  /**
   * Retry an async operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let attempt = 1;
    
    while (attempt <= maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
    
    throw new Error('Max attempts exceeded');
  }
}

/**
 * Test scenario builder
 */
export class TestScenarioBuilder {
  private steps: Array<{
    name: string;
    action: () => Promise<void>;
    validation?: () => void;
    timeout?: number;
  }> = [];

  /**
   * Add a step to the scenario
   */
  step(
    name: string,
    action: () => Promise<void>,
    validation?: () => void,
    timeout?: number
  ): this {
    this.steps.push({ name, action, validation, timeout });
    return this;
  }

  /**
   * Execute all steps in sequence
   */
  async execute(): Promise<void> {
    for (const step of this.steps) {
      try {
        await step.action();
        if (step.validation) {
          step.validation();
        }
      } catch (error) {
        throw new Error(`Step "${step.name}" failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Clear all steps
   */
  clear(): this {
    this.steps = [];
    return this;
  }
}
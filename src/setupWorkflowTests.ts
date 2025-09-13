/**
 * Test Setup for Workflow Persistence Tests
 * Configures test environment, mocks, and utilities
 */

import 'jest-localstorage-mock';
import '@testing-library/jest-dom';

// In React projects, jest is available globally

// Mock Firebase completely for tests
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __type: 'timestamp' })),
  runTransaction: jest.fn(),
  collection: jest.fn()
}));

jest.mock('../config/firebase', () => ({
  db: {}
}));

// Mock workspace event bus
jest.mock('../services/workspaceEventBus', () => ({
  emit: jest.fn(),
  subscribe: jest.fn(() => () => {}), // Return unsubscribe function
  clearAllListeners: jest.fn()
}));

// Mock input sanitizer
jest.mock('../utils/inputSanitizer', () => ({
  sanitizeText: jest.fn((text: string) => text),
  sanitizeHtml: jest.fn((html: string) => html)
}));

// Enhanced localStorage mock for persistence tests
interface LocalStorageMock {
  store: Map<string, string>;
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
  key: jest.Mock;
  readonly length: number;
}

const localStorageMock: LocalStorageMock = (() => {
  const store = new Map<string, string>();
  
  return {
    store,
    getItem: jest.fn((key: string): string | null => store.get(key) || null),
    setItem: jest.fn((key: string, value: string): void => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string): void => {
      store.delete(key);
    }),
    clear: jest.fn((): void => {
      store.clear();
    }),
    key: jest.fn((index: number): string | null => {
      const keys = Array.from(store.keys());
      return keys[index] || null;
    }),
    get length(): number {
      return store.size;
    }
  };
})();

// Enhanced sessionStorage mock
interface SessionStorageMock {
  store: Map<string, string>;
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
  key: jest.Mock;
  readonly length: number;
}

const sessionStorageMock: SessionStorageMock = (() => {
  const store = new Map<string, string>();
  
  return {
    store,
    getItem: jest.fn((key: string): string | null => store.get(key) || null),
    setItem: jest.fn((key: string, value: string): void => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string): void => {
      store.delete(key);
    }),
    clear: jest.fn((): void => {
      store.clear();
    }),
    key: jest.fn((index: number): string | null => {
      const keys = Array.from(store.keys());
      return keys[index] || null;
    }),
    get length(): number {
      return store.size;
    }
  };
})();

// Global test utilities
(global as any).localStorageMock = localStorageMock;
(global as any).sessionStorageMock = sessionStorageMock;

// Mock browser APIs
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
});

Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
});

// Mock performance API for performance tests
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn()
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock ResizeObserver for component tests
class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true
});

// Mock IntersectionObserver for component tests
class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    // Store callback for potential manual triggering in tests
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  value: IntersectionObserverMock,
  writable: true
});

// Mock crypto for ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
  }
});

// Mock fetch for network requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    status: 200,
    statusText: 'OK'
  } as Response)
);

// Test utilities
export const createMockUser = (overrides = {}) => ({
  uid: 'mock-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  ...overrides
});

export const createMockDraftId = () => `test-draft-${Date.now()}-${Math.random()}`;

export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const mockNetworkDelay = (ms: number = 100) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const simulateNetworkError = () => {
  const error = new Error('Network error');
  (error as any).code = 'network-error';
  return error;
};

export const simulateOffline = () => {
  Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
  window.dispatchEvent(new Event('offline'));
};

export const simulateOnline = () => {
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  window.dispatchEvent(new Event('online'));
};

// Clean up between tests
beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  jest.clearAllMocks();
  
  // Reset online status
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
});

// Performance test helpers
export class TestPerformanceMonitor {
  private startTimes: Map<string, number> = new Map();
  
  start(label: string): void {
    this.startTimes.set(label, performance.now());
  }
  
  end(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) throw new Error(`No start time found for ${label}`);
    
    const elapsed = performance.now() - startTime;
    this.startTimes.delete(label);
    return elapsed;
  }
  
  reset(): void {
    this.startTimes.clear();
  }
}

// Export for use in tests
export { localStorageMock, sessionStorageMock };

console.log('✅ Workflow persistence test environment configured');
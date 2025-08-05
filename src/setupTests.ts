// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock window.matchMedia with comprehensive support for Material-UI useMediaQuery
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => {
    // Default to desktop view for most tests
    const matches = query.includes('max-width') ? false : query.includes('min-width') ? true : false;
    
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  }),
});

// Enhanced mock for Material-UI's useMediaQuery hook
const mockUseMediaQuery = jest.fn();
jest.mock('@mui/material/useMediaQuery', () => mockUseMediaQuery);

// Set default behavior for useMediaQuery
beforeEach(() => {
  mockUseMediaQuery.mockImplementation((query) => {
    // Default to desktop view for most tests
    if (typeof query === 'string') {
      return query.includes('max-width') ? false : query.includes('min-width') ? true : false;
    }
    return false;
  });
});

// Mock IntersectionObserver
(global as any).IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock ResizeObserver
(global as any).ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
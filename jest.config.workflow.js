/**
 * Jest Configuration for Workflow Persistence Tests
 * Optimized configuration for testing the persistence system
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  
  // Test environment setup
  testEnvironment: 'jsdom',
  
  // Test file patterns for workflow persistence
  testMatch: [
    '<rootDir>/src/services/__tests__/draftService.test.ts',
    '<rootDir>/src/services/__tests__/offlineQueue.test.ts',
    '<rootDir>/src/components/__tests__/SyncStatusIndicator.test.tsx',
    '<rootDir>/src/integration/__tests__/workflowPersistence.test.ts',
    '<rootDir>/src/performance/__tests__/workflowPersistence.performance.test.ts'
  ],
  
  // Setup files for testing environment
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.ts',
    '<rootDir>/src/setupWorkflowTests.ts'
  ],
  
  // Module name mapping for proper imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/services/draftService.ts',
    'src/services/offlineQueue.ts',
    'src/components/SyncStatusIndicator.tsx',
    'src/hooks/useWorkflowDraft.ts',
    'src/contexts/WorkspaceContext.tsx',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/draftService.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/offlineQueue.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Test timeout for performance tests
  testTimeout: 30000,
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Performance test configuration
  runner: '@jest/runner',
  maxWorkers: '50%', // Use half the available CPU cores
  
  // Test result processors
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-reports',
      filename: 'workflow-persistence-report.html',
      expand: true,
      hideIcon: false
    }],
    ['jest-junit', {
      outputDirectory: './test-reports',
      outputName: 'workflow-persistence-junit.xml'
    }]
  ],
  
  // Global test setup
  globals: {
    'ts-jest': {
      useESM: false,
      isolatedModules: true
    }
  }
};
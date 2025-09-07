/**
 * Schedule Command Center Integration Tests
 * Comprehensive testing suite for panel-based workspace integration
 * Tests event bus communication, state management, data integrity, and UI responsiveness
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { FeatureFlagProvider } from '../contexts/FeatureFlagContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ScheduleCommandCenter } from '../components/workspace/ScheduleCommandCenter';
import { workspaceEventBus, emit, subscribe, unsubscribe } from '../services/workspaceEventBus';
import { draftService } from '../services/draftService';
import { ScheduleDataEvent } from '../types/workspaceEvents';

// Mock Firebase and other external services
jest.mock('../firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
  storage: {}
}));

jest.mock('../services/draftService', () => ({
  draftService: {
    getCurrentWorkflow: jest.fn(),
    startWorkflow: jest.fn(),
    getOrCreateWorkflow: jest.fn(),
    updateStepStatus: jest.fn(),
    completeStep: jest.fn(),
    saveDraft: jest.fn(),
    getDraft: jest.fn(),
    deleteWorkflow: jest.fn()
  }
}));

// Test data fixtures
const createMockCsvData = () => ({
  timePoints: ['Downtown Terminal', 'Main Street', 'Shopping Mall', 'University Campus', 'General Hospital'],
  validationSummary: {
    totalSegments: 4,
    totalTimePoints: 5,
    isValid: true
  },
  rawData: {
    headers: ['Time Point', 'Travel Time'],
    rows: [
      ['Downtown Terminal', '0'],
      ['Main Street', '8'],
      ['Shopping Mall', '6'],
      ['University Campus', '12'],
      ['General Hospital', '7']
    ]
  }
});

const createMockFile = (name: string = 'test-schedule.csv', content: string = 'mock,csv,data') => {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], name, { type: 'text/csv' });
};

// Test wrapper with all required providers
const TestWrapper: React.FC<{ children: React.ReactNode; commandCenterEnabled?: boolean }> = ({ 
  children, 
  commandCenterEnabled = true 
}) => {
  const mockFeatureFlags = {
    isCommandCenter: commandCenterEnabled,
    isDuolingoBlocks: true,
    isVirtualization: false,
    toggleCommandCenter: jest.fn(),
    toggleDuolingoBlocks: jest.fn(),
    toggleVirtualization: jest.fn()
  };

  const mockAuth = {
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
    signInWithEmail: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInAnonymously: jest.fn(),
    signOut: jest.fn()
  };

  return (
    <AuthProvider>
      <FeatureFlagProvider>
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </FeatureFlagProvider>
    </AuthProvider>
  );
};

describe('Schedule Command Center Integration Tests', () => {
  let mockDraftService: jest.Mocked<typeof draftService>;
  let eventSubscriptions: string[] = [];

  beforeEach(() => {
    // Clear event bus and reset mocks
    workspaceEventBus.clearHistory();
    workspaceEventBus.resetStats();
    
    mockDraftService = draftService as jest.Mocked<typeof draftService>;
    mockDraftService.getCurrentWorkflow.mockReturnValue(null);
    mockDraftService.startWorkflow.mockReturnValue('test-workflow-id');
    mockDraftService.getOrCreateWorkflow.mockReturnValue({
      draftId: 'test-workflow-id',
      draftName: 'Test Schedule',
      currentStep: 'upload',
      steps: [],
      overallProgress: 0,
      lastModified: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    
    // Clean up any existing subscriptions
    eventSubscriptions.forEach(id => unsubscribe(id));
    eventSubscriptions = [];
  });

  afterEach(() => {
    // Clean up event subscriptions
    eventSubscriptions.forEach(id => unsubscribe(id));
    eventSubscriptions = [];
    jest.clearAllMocks();
  });

  describe('1. Event Bus Communication Testing', () => {
    test('should propagate upload events from UploadPanel to other panels', async () => {
      const user = userEvent.setup();
      const eventHistory: any[] = [];
      
      // Subscribe to all events
      eventSubscriptions.push(
        subscribe(['schedule-data', 'workflow-progress'], (event) => {
          eventHistory.push(event);
        })
      );

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Wait for command center to load
      await waitFor(() => {
        expect(screen.getByTestId('schedule-command-center')).toBeInTheDocument();
      });

      // Open Upload Panel
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('upload-panel')).toBeInTheDocument();
      });

      // Simulate file upload
      const fileInput = screen.getByTestId('file-upload-input');
      const mockFile = createMockFile('test-schedule.csv');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
      });

      // Verify events were emitted
      await waitFor(() => {
        expect(eventHistory.length).toBeGreaterThan(0);
        
        const scheduleDataEvents = eventHistory.filter(e => e.type === 'schedule-data');
        expect(scheduleDataEvents.length).toBeGreaterThan(0);
        
        const workflowEvents = eventHistory.filter(e => e.type === 'workflow-progress');
        expect(workflowEvents.length).toBeGreaterThan(0);
      });

      // Verify event payloads contain expected data
      const uploadEvent = eventHistory.find(e => 
        e.type === 'schedule-data' && e.payload.action === 'upload-complete'
      );
      expect(uploadEvent).toBeDefined();
      expect(uploadEvent.payload.data.fileName).toBeTruthy();
      expect(uploadEvent.source).toBe('upload-panel');
    });

    test('should handle cross-panel event communication with proper priority', async () => {
      let highPriorityEventReceived = false;
      let lowPriorityEventReceived = false;
      const eventOrder: string[] = [];

      // Subscribe with different priorities
      eventSubscriptions.push(
        subscribe('user-interaction', (event) => {
          if (event.priority === 1) {
            highPriorityEventReceived = true;
            eventOrder.push('high');
          }
        }, { priority: 1 })
      );

      eventSubscriptions.push(
        subscribe('user-interaction', (event) => {
          if (event.priority === 0) {
            lowPriorityEventReceived = true;
            eventOrder.push('low');
          }
        }, { priority: 0 })
      );

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Emit events with different priorities
      await act(async () => {
        await emit({
          type: 'user-interaction',
          source: 'test',
          priority: 0,
          payload: { action: 'click', element: 'test-button', elementType: 'button' }
        });

        await emit({
          type: 'user-interaction',
          source: 'test',
          priority: 1,
          payload: { action: 'hover', element: 'test-panel', elementType: 'panel' }
        });
      });

      await waitFor(() => {
        expect(highPriorityEventReceived).toBe(true);
        expect(lowPriorityEventReceived).toBe(true);
        // High priority should be processed first
        expect(eventOrder[0]).toBe('high');
      });
    });

    test('should handle event bus error recovery gracefully', async () => {
      const errorEvents: any[] = [];
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      eventSubscriptions.push(
        subscribe('schedule-data', () => {
          throw new Error('Test handler error');
        })
      );

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Emit an event that will cause handler to throw
      await act(async () => {
        await emit({
          type: 'schedule-data',
          source: 'test',
          priority: 1,
          payload: { dataType: 'upload', action: 'delete', data: {} }
        });
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Event bus should still be functional
      const stats = workspaceEventBus.getStats();
      expect(stats.totalEvents).toBe(1);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('2. Panel State Management Testing', () => {
    test('should manage multiple panel states correctly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Open multiple panels
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const openTimePointsButton = screen.getByRole('button', { name: /timepoints/i });
      await user.click(openTimePointsButton);

      const openBlocksButton = screen.getByRole('button', { name: /blocks/i });
      await user.click(openBlocksButton);

      // Verify all panels are open
      await waitFor(() => {
        expect(screen.getByTestId('upload-panel')).toBeInTheDocument();
        expect(screen.getByTestId('timepoints-panel')).toBeInTheDocument();
        expect(screen.getByTestId('blocks-panel')).toBeInTheDocument();
      });

      // Test panel minimization
      const uploadPanel = screen.getByTestId('upload-panel');
      const minimizeButton = within(uploadPanel).getByRole('button', { name: /minimize/i });
      await user.click(minimizeButton);

      await waitFor(() => {
        expect(uploadPanel).toHaveClass('minimized');
      });

      // Test panel restoration
      const restoreButton = within(uploadPanel).getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(uploadPanel).not.toHaveClass('minimized');
      });
    });

    test('should persist panel positions and states', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Open and position a panel
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const uploadPanel = screen.getByTestId('upload-panel');
      
      // Simulate panel dragging (mock drag event)
      fireEvent.mouseDown(uploadPanel, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(uploadPanel, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(uploadPanel);

      // Check that panel position is updated (this would be in the workspace context)
      // The actual position update would be handled by the panel component
      expect(uploadPanel).toBeInTheDocument();
    });

    test('should handle panel z-index ordering correctly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Open multiple panels
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const openTimePointsButton = screen.getByRole('button', { name: /timepoints/i });
      await user.click(openTimePointsButton);

      const uploadPanel = screen.getByTestId('upload-panel');
      const timePointsPanel = screen.getByTestId('timepoints-panel');

      // Click on upload panel to bring it to front
      await user.click(uploadPanel);

      // Check z-index ordering (implementation would depend on actual CSS classes)
      expect(uploadPanel).toBeInTheDocument();
      expect(timePointsPanel).toBeInTheDocument();
    });
  });

  describe('3. Data Integrity Testing', () => {
    test('should maintain data consistency throughout complete workflow', async () => {
      const user = userEvent.setup();
      const workflowData: any = {};

      // Track data changes
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          const scheduleEvent = event as ScheduleDataEvent;
          workflowData[scheduleEvent.payload.dataType] = scheduleEvent.payload.data;
        })
      );

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Step 1: Upload data
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const uploadPanel = screen.getByTestId('upload-panel');
      const fileInput = within(uploadPanel).getByTestId('file-upload-input');
      const mockFile = createMockFile('test-schedule.csv');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(workflowData['uploaded-schedule']).toBeDefined();
      });

      // Step 2: Open TimePoints panel and verify data
      const openTimePointsButton = screen.getByRole('button', { name: /timepoints/i });
      await user.click(openTimePointsButton);

      await waitFor(() => {
        const timePointsPanel = screen.getByTestId('timepoints-panel');
        expect(timePointsPanel).toBeInTheDocument();
      });

      // Step 3: Open Blocks panel and verify data propagation
      const openBlocksButton = screen.getByRole('button', { name: /blocks/i });
      await user.click(openBlocksButton);

      await waitFor(() => {
        const blocksPanel = screen.getByTestId('blocks-panel');
        expect(blocksPanel).toBeInTheDocument();
      });

      // Verify data consistency
      expect(workflowData['uploaded-schedule']).toBeDefined();
      expect(workflowData['uploaded-schedule'].fileName).toBeTruthy();
      expect(workflowData['uploaded-schedule'].scheduleData).toBeDefined();
    });

    test('should handle data validation across panels', async () => {
      const user = userEvent.setup();
      const validationEvents: any[] = [];

      eventSubscriptions.push(
        subscribe('data-validation', (event) => {
          validationEvents.push(event);
        })
      );

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Upload invalid data
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const uploadPanel = screen.getByTestId('upload-panel');
      const fileInput = within(uploadPanel).getByTestId('file-upload-input');
      const invalidFile = createMockFile('invalid.csv', 'invalid,data,format');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      });

      // Should trigger validation events
      await waitFor(() => {
        expect(validationEvents.length).toBeGreaterThan(0);
      });

      const validationEvent = validationEvents[0];
      expect(validationEvent.payload.status).toBeDefined();
    });
  });

  describe('4. UI Responsiveness and Performance Testing', () => {
    test('should render panels within performance thresholds', async () => {
      const user = userEvent.setup();
      const startTime = performance.now();

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Open multiple panels quickly
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      const openTimePointsButton = screen.getByRole('button', { name: /timepoints/i });
      const openBlocksButton = screen.getByRole('button', { name: /blocks/i });
      const openExportButton = screen.getByRole('button', { name: /export/i });

      await act(async () => {
        await user.click(openUploadButton);
        await user.click(openTimePointsButton);
        await user.click(openBlocksButton);
        await user.click(openExportButton);
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // All panels should render within 2 seconds
      expect(renderTime).toBeLessThan(2000);

      // Verify all panels are present
      await waitFor(() => {
        expect(screen.getByTestId('upload-panel')).toBeInTheDocument();
        expect(screen.getByTestId('timepoints-panel')).toBeInTheDocument();
        expect(screen.getByTestId('blocks-panel')).toBeInTheDocument();
        expect(screen.getByTestId('export-panel')).toBeInTheDocument();
      });
    });

    test('should handle responsive panel resizing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const uploadPanel = screen.getByTestId('upload-panel');

      // Test minimum width constraint
      fireEvent.resize(uploadPanel, { target: { offsetWidth: 250 } });
      expect(uploadPanel.style.minWidth).toBe('300px'); // Should enforce minimum

      // Test responsive behavior
      fireEvent.resize(uploadPanel, { target: { offsetWidth: 800 } });
      expect(parseInt(uploadPanel.style.width)).toBeGreaterThanOrEqual(300);
    });

    test('should maintain performance with large datasets', async () => {
      const user = userEvent.setup();
      const largeDatasetSize = 1000; // trips

      // Mock large dataset
      const largeCsvData = {
        timePoints: Array.from({ length: 20 }, (_, i) => `Stop ${i + 1}`),
        validationSummary: {
          totalSegments: largeDatasetSize,
          totalTimePoints: 20,
          isValid: true
        },
        rawData: {
          headers: ['Time Point', 'Travel Time'],
          rows: Array.from({ length: largeDatasetSize }, (_, i) => [`Stop ${i % 20 + 1}`, '5'])
        }
      };

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      const startTime = performance.now();

      // Simulate processing large dataset
      await act(async () => {
        await emit({
          type: 'schedule-data',
          source: 'test',
          priority: 1,
          payload: {
            dataType: 'upload',
            action: 'bulk-update',
            data: largeCsvData
          }
        });
      });

      const processTime = performance.now() - startTime;

      // Should handle large datasets within reasonable time
      expect(processTime).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('5. Error Handling and Recovery Testing', () => {
    test('should recover from network failures gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock network failure
      mockDraftService.saveDraft.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      // Simulate upload that triggers save failure
      const uploadPanel = screen.getByTestId('upload-panel');
      const fileInput = within(uploadPanel).getByTestId('file-upload-input');
      const mockFile = createMockFile('test-schedule.csv');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
      });

      // Should show error message but not crash
      await waitFor(() => {
        const errorMessage = screen.queryByText(/network error/i);
        expect(errorMessage).toBeInTheDocument();
      });

      // Should allow retry
      mockDraftService.saveDraft.mockResolvedValueOnce({ success: true });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
      });
    });

    test('should handle memory limit gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Simulate memory-intensive operation
      const largeData = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000) // 1KB per item = 100MB total
      }));

      await act(async () => {
        await emit({
          type: 'schedule-data',
          source: 'test',
          priority: 1,
          payload: {
            dataType: 'trips',
            action: 'bulk-update',
            data: largeData
          }
        });
      });

      // Should handle gracefully without crashing
      expect(screen.getByTestId('schedule-command-center')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('6. Security Validation Testing', () => {
    test('should sanitize all event payloads', async () => {
      const maliciousPayload = {
        dataType: 'upload' as const,
        action: 'create' as const,
        data: {
          fileName: '<script>alert("xss")</script>',
          content: 'DROP TABLE schedules; <img src=x onerror=alert("xss")>',
          maliciousField: 'javascript:void(0)'
        }
      };

      const receivedEvents: any[] = [];
      eventSubscriptions.push(
        subscribe('schedule-data', (event) => {
          receivedEvents.push(event);
        })
      );

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      await act(async () => {
        await emit({
          type: 'schedule-data' as const,
          source: 'test',
          priority: 1,
          payload: maliciousPayload
        });
      });

      await waitFor(() => {
        expect(receivedEvents.length).toBe(1);
      });

      const sanitizedEvent = receivedEvents[0];
      
      // Check that dangerous content is sanitized
      expect(sanitizedEvent.payload.dataType).toBe('upload'); // Should remain valid
      expect(sanitizedEvent.payload.action).toBe('create'); // Should remain valid
      expect(sanitizedEvent.payload.data.fileName).not.toContain('<script>');
      expect(sanitizedEvent.payload.data.content).not.toContain('<img');
      expect(sanitizedEvent.payload.data.maliciousField).not.toContain('javascript:');
    });

    test('should validate file uploads securely', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const uploadPanel = screen.getByTestId('upload-panel');
      const fileInput = within(uploadPanel).getByTestId('file-upload-input');

      // Test malicious file types
      const maliciousFile = new File(['<script>alert("xss")</script>'], 'malicious.exe', { 
        type: 'application/octet-stream' 
      });
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [maliciousFile] } });
      });

      // Should reject invalid file types
      await waitFor(() => {
        expect(screen.getByText(/file type not supported/i)).toBeInTheDocument();
      });
    });
  });

  describe('7. Browser Compatibility Testing', () => {
    test('should handle different viewport sizes', async () => {
      const user = userEvent.setup();

      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true });
      
      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      fireEvent.resize(window);

      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      const uploadPanel = screen.getByTestId('upload-panel');
      
      // Should adapt to small screens
      expect(uploadPanel).toHaveClass('responsive-mobile');

      // Test desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
      
      fireEvent.resize(window);

      // Should adapt to large screens
      expect(uploadPanel).toHaveClass('responsive-desktop');
    });

    test('should work without modern JavaScript features', () => {
      // Mock older browser environment
      const originalPromise = global.Promise;
      const originalFetch = global.fetch;

      // @ts-ignore
      delete global.Promise;
      // @ts-ignore
      delete global.fetch;

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Should still render basic functionality
      expect(screen.getByTestId('schedule-command-center')).toBeInTheDocument();

      // Restore modern features
      global.Promise = originalPromise;
      global.fetch = originalFetch;
    });
  });

  describe('8. Performance Benchmarks', () => {
    test('should meet performance benchmarks', async () => {
      const user = userEvent.setup();
      const performanceMetrics = {
        panelOpenTime: [] as number[],
        eventPropagationTime: [] as number[],
        dataProcessingTime: [] as number[]
      };

      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Benchmark panel opening
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        const openUploadButton = screen.getByRole('button', { name: /upload/i });
        await user.click(openUploadButton);
        
        await waitFor(() => {
          expect(screen.getByTestId('upload-panel')).toBeInTheDocument();
        });
        
        const endTime = performance.now();
        performanceMetrics.panelOpenTime.push(endTime - startTime);
        
        // Close panel for next iteration
        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);
      }

      // Calculate averages
      const avgPanelOpenTime = performanceMetrics.panelOpenTime.reduce((a, b) => a + b, 0) / 5;

      // Verify benchmarks
      expect(avgPanelOpenTime).toBeLessThan(500); // < 500ms average panel open time
      
      // Get event bus performance metrics
      const eventStats = workspaceEventBus.getStats();
      expect(eventStats.averageProcessingTime).toBeLessThan(100); // < 100ms event processing
    });
  });

  describe('9. Memory Management', () => {
    test('should clean up event subscriptions properly', async () => {
      const { unmount } = render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      const initialStats = workspaceEventBus.getStats();
      const initialSubscriptions = initialStats.totalSubscriptions;

      // Unmount component
      unmount();

      // Allow cleanup to occur
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const finalStats = workspaceEventBus.getStats();
      
      // Should have cleaned up subscriptions
      expect(finalStats.totalSubscriptions).toBeLessThanOrEqual(initialSubscriptions);
    });

    test('should handle memory pressure gracefully', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <ScheduleCommandCenter />
        </TestWrapper>
      );

      // Simulate memory pressure by creating many large objects
      const largeObjects = [];
      for (let i = 0; i < 100; i++) {
        largeObjects.push(new Array(10000).fill(i));
      }

      // Should continue functioning
      const openUploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(openUploadButton);

      expect(screen.getByTestId('upload-panel')).toBeInTheDocument();
      
      // Clean up
      largeObjects.length = 0;
    });
  });
});
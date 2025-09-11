/**
 * useDashboardMetrics Hook Tests
 * Test-driven development for React hook with real-time updates
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardMetrics } from './useDashboardMetrics';
import { dashboardMetrics } from '../services/dashboardMetrics';
import { workspaceEventBus } from '../services/workspaceEventBus';

// Mock dependencies
jest.mock('../services/dashboardMetrics');
jest.mock('../services/workspaceEventBus');

const mockDashboardMetrics = dashboardMetrics as jest.Mocked<typeof dashboardMetrics>;
const mockEventBus = workspaceEventBus as jest.Mocked<typeof workspaceEventBus>;

const mockMetrics = {
  scheduleQuality: {
    averageRecoveryPercentage: 15.5,
    schedulesWithHealthyRecovery: 4,
    schedulesNeedingAttention: 1,
    validationPassRate: 90,
    averageBlockUtilization: 85
  },
  planningEfficiency: {
    averageCycleTime: 120,
    averageServiceFrequency: 30,
    peakHourCoverage: 95,
    serviceBandDistribution: {
      fastest: 30,
      standard: 50,
      slowest: 20
    }
  },
  draftPipeline: {
    uploading: 1,
    analyzing: 2,
    configuring: 1,
    reviewing: 2,
    readyToPublish: 1,
    totalDrafts: 7
  },
  validationStatus: {
    schedulesWithErrors: 0,
    schedulesWithWarnings: 2,
    commonIssues: ['Low recovery time', 'Peak hour gaps'],
    criticalAlerts: 0
  },
  recentActivity: {
    thisWeekSchedulesCreated: 3,
    thisWeekSchedulesModified: 5,
    lastPublishedSchedule: {
      name: 'Route 101 - Weekday',
      timestamp: new Date().toISOString()
    },
    upcomingExpirations: 2
  },
  systemHealth: {
    storageUsedPercentage: 15,
    averageProcessingTime: 35.5,
    dataIntegrityScore: 95
  },
  lastUpdated: Date.now()
};

describe('useDashboardMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardMetrics.getMetrics.mockResolvedValue(mockMetrics);
    mockEventBus.subscribe.mockReturnValue('test-subscription-id');
  });

  describe('initial loading', () => {
    it('should start with loading state', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.metrics).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should load metrics on mount', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.metrics).toEqual(mockMetrics);
      expect(result.current.error).toBe(null);
    });

    it('should handle loading errors', async () => {
      const error = new Error('Failed to load metrics');
      mockDashboardMetrics.getMetrics.mockRejectedValue(error);
      
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.metrics).toBe(null);
      expect(result.current.error).toBe('Failed to load metrics');
    });
  });

  describe('event subscriptions', () => {
    it('should subscribe to workspace events on mount', async () => {
      renderHook(() => useDashboardMetrics());
      
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ['schedule-data', 'workflow-progress', 'data-validation'],
        expect.any(Function),
        expect.objectContaining({
          throttle: 2000
        })
      );
    });

    it('should refresh metrics when relevant events occur', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      // Simulate relevant event
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      await act(async () => {
        eventHandler({
          type: 'schedule-data',
          payload: { action: 'create', dataType: 'trips', data: {} },
          id: 'test-event',
          timestamp: Date.now(),
          source: 'test',
          priority: 1
        } as any);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useDashboardMetrics());
      
      unmount();
      
      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith('test-subscription-id');
    });
  });

  describe('manual refresh', () => {
    it('should provide refresh function', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(typeof result.current.refresh).toBe('function');
    });

    it('should refresh metrics when refresh is called', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      await act(async () => {
        await result.current.refresh();
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(2);
    });

    it('should show refreshing state during manual refresh', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Make getMetrics take some time
      mockDashboardMetrics.getMetrics.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockMetrics as any), 100))
      );
      
      act(() => {
        result.current.refresh();
      });
      
      expect(result.current.isRefreshing).toBe(true);
      
      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false);
      });
    });
  });

  describe('auto-refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should auto-refresh every 5 minutes by default', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      // Fast-forward 5 minutes
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(2);
    });

    it('should respect custom auto-refresh interval', async () => {
      const { result } = renderHook(() => useDashboardMetrics({ autoRefreshInterval: 2 * 60 * 1000 }));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      // Fast-forward 2 minutes
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(2);
    });

    it('should disable auto-refresh when interval is null', async () => {
      const { result } = renderHook(() => useDashboardMetrics({ autoRefreshInterval: null }));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      // Fast-forward 10 minutes
      act(() => {
        jest.advanceTimersByTime(10 * 60 * 1000);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1); // Still just initial load
    });
  });

  describe('window visibility handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should refresh when window becomes visible', async () => {
      const { result } = renderHook(() => useDashboardMetrics());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      // Simulate window becoming hidden
      Object.defineProperty(document, 'hidden', { value: true });
      
      // Fast-forward to cause a missed refresh
      act(() => {
        jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      });
      
      // Should not have refreshed while hidden
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(1);
      
      // Simulate window becoming visible
      Object.defineProperty(document, 'hidden', { value: false });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      expect(mockDashboardMetrics.getMetrics).toHaveBeenCalledTimes(2);
    });
  });

  describe('options', () => {
    it('should respect immediate option', async () => {
      renderHook(() => useDashboardMetrics({ immediate: false }));
      
      // Should not load immediately
      expect(mockDashboardMetrics.getMetrics).not.toHaveBeenCalled();
    });

    it('should still provide refresh function with immediate: false', () => {
      const { result } = renderHook(() => useDashboardMetrics({ immediate: false }));
      
      expect(typeof result.current.refresh).toBe('function');
    });
  });
});
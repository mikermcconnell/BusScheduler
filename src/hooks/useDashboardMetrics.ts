/**
 * useDashboardMetrics Hook
 * React hook for consuming dashboard metrics with real-time updates
 * Provides loading states, error handling, and auto-refresh capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardMetrics, DashboardMetrics } from '../services/dashboardMetrics';
import { workspaceEventBus } from '../services/workspaceEventBus';
import { WorkspaceEvent } from '../types/workspaceEvents';

export interface UseDashboardMetricsOptions {
  /** Whether to load metrics immediately on mount (default: true) */
  immediate?: boolean;
  /** Auto-refresh interval in milliseconds (default: 5 minutes, null to disable) */
  autoRefreshInterval?: number | null;
}

export interface UseDashboardMetricsResult {
  /** Current metrics data */
  metrics: DashboardMetrics | null;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether a manual refresh is in progress */
  isRefreshing: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Last successful update timestamp */
  lastUpdated: number | null;
}

/**
 * Hook for consuming dashboard metrics with real-time updates
 */
export function useDashboardMetrics(options: UseDashboardMetricsOptions = {}): UseDashboardMetricsResult {
  const {
    immediate = true,
    autoRefreshInterval = 5 * 60 * 1000 // 5 minutes default
  } = options;

  // State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(immediate);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Refs for cleanup
  const subscriptionIdRef = useRef<string | null>(null);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Load metrics from service
   */
  const loadMetrics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const newMetrics = await dashboardMetrics.getMetrics();
      
      if (isMountedRef.current) {
        setMetrics(newMetrics);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
        setError(errorMessage);
        setMetrics(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await loadMetrics(true);
  }, [loadMetrics]);

  /**
   * Handle workspace events that should trigger refresh
   */
  const handleWorkspaceEvent = useCallback((event: WorkspaceEvent) => {
    // Only refresh for events that affect dashboard metrics
    const shouldRefresh = (() => {
      switch (event.type) {
        case 'schedule-data':
          return ['create', 'update', 'delete', 'bulk-update'].includes(event.payload.action);
        case 'workflow-progress':
          // Refresh on any step change to update pipeline status
          return true;
        case 'data-validation':
          return event.payload.status === 'valid' || event.payload.status === 'invalid';
        case 'recovery-time-change':
          // Refresh when recovery times change to update quality metrics
          return true;
        default:
          return false;
      }
    })();

    if (shouldRefresh) {
      loadMetrics(false);
    }
  }, [loadMetrics]);

  /**
   * Setup auto-refresh timer
   */
  const setupAutoRefresh = useCallback(() => {
    if (autoRefreshInterval && autoRefreshInterval > 0) {
      autoRefreshTimerRef.current = setInterval(() => {
        // Only refresh if window is visible
        if (!document.hidden) {
          loadMetrics(false);
        }
      }, autoRefreshInterval);
    }
  }, [autoRefreshInterval, loadMetrics]);

  /**
   * Handle window visibility change
   */
  const handleVisibilityChange = useCallback(() => {
    if (!document.hidden && lastUpdated) {
      const timeSinceLastUpdate = Date.now() - lastUpdated;
      // Refresh if it's been more than the auto-refresh interval since last update
      if (autoRefreshInterval && timeSinceLastUpdate > autoRefreshInterval) {
        loadMetrics(false);
      }
    }
  }, [lastUpdated, autoRefreshInterval, loadMetrics]);

  // Initial load and setup
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    if (immediate) {
      loadMetrics(false);
    }

    // Subscribe to workspace events for real-time updates
    subscriptionIdRef.current = workspaceEventBus.subscribe(
      ['schedule-data', 'workflow-progress', 'data-validation', 'recovery-time-change'],
      handleWorkspaceEvent,
      {
        throttle: 2000 // Throttle to prevent excessive updates
      }
    );

    // Setup auto-refresh
    setupAutoRefresh();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      
      // Cleanup subscription
      if (subscriptionIdRef.current) {
        workspaceEventBus.unsubscribe(subscriptionIdRef.current);
      }
      
      // Cleanup auto-refresh timer
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
      
      // Cleanup visibility listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount/unmount

  // Update auto-refresh when interval changes
  useEffect(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }
    setupAutoRefresh();

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [setupAutoRefresh]);

  return {
    metrics,
    isLoading,
    isRefreshing,
    error,
    refresh,
    lastUpdated
  };
}
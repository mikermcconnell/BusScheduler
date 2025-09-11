/**
 * Dashboard Metrics Service Tests
 * Test-driven development for dynamic dashboard data aggregation
 */

import { DashboardMetricsService } from './dashboardMetrics';
import { scheduleStorage } from './scheduleStorage';
import { draftService } from './draftService';
import { auditLogger } from './auditLogger';
import { workspaceEventBus } from './workspaceEventBus';

// Mock dependencies
jest.mock('./scheduleStorage');
jest.mock('./draftService');
jest.mock('./auditLogger');
jest.mock('./workspaceEventBus');

const mockScheduleStorage = scheduleStorage as jest.Mocked<typeof scheduleStorage>;
const mockDraftService = draftService as jest.Mocked<typeof draftService>;
const mockAuditLogger = auditLogger as jest.Mocked<typeof auditLogger>;
const mockEventBus = workspaceEventBus as jest.Mocked<typeof workspaceEventBus>;

describe('DashboardMetricsService', () => {
  let service: DashboardMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardMetricsService();
    
    // Clear sessionStorage
    sessionStorage.clear();
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      // Mock scheduleStorage
      mockScheduleStorage.getAllSchedules.mockReturnValue([
        { id: '1', status: 'Active', createdAt: '2025-01-01' } as any,
        { id: '2', status: 'Draft', createdAt: '2025-01-02' } as any,
        { id: '3', status: 'Active', createdAt: '2025-01-03' } as any,
      ]);
      
      mockScheduleStorage.getAllDraftSchedules.mockReturnValue([
        { id: 'draft1', createdAt: '2025-01-04' } as any,
        { id: 'draft2', createdAt: '2025-01-05' } as any,
      ]);
      
      mockScheduleStorage.getStorageStats.mockReturnValue({
        scheduleCount: 3,
        draftCount: 2,
        totalSize: 1024000,
        remainingCapacity: 47,
        remainingDraftCapacity: 18
      });

      // Mock draftService  
      mockDraftService.getAllDraftsUnified.mockResolvedValue([
        { 
          draftId: 'firebase1', 
          currentStep: 'summary', 
          progress: 80,
          metadata: { createdAt: '2025-01-06', lastModifiedAt: '2025-01-07' }
        } as any,
        { 
          draftId: 'firebase2', 
          currentStep: 'ready-to-publish', 
          progress: 100,
          metadata: { createdAt: '2025-01-08', lastModifiedAt: '2025-01-09' }
        } as any,
      ]);

      // Mock auditLogger
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      mockAuditLogger.getLogs.mockReturnValue([
        { timestamp: '2025-01-07', eventType: 'SCHEDULE_CREATED' } as any,
        { timestamp: '2025-01-08', eventType: 'FILE_UPLOADED' } as any,
        { timestamp: '2025-01-09', eventType: 'SCHEDULE_UPDATED' } as any,
      ]);

      // Mock workspaceEventBus
      mockEventBus.getStats.mockReturnValue({
        totalEvents: 150,
        totalSubscriptions: 12,
        eventsByType: { 'schedule-data': 45, 'workflow-progress': 30 },
        subscribersByType: {},
        averageProcessingTime: 25.5,
        lastReset: Date.now() - 86400000
      });
    });

    it('should return correct active schedules count', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.activeSchedules).toBe(2); // Only Active status schedules
    });

    it('should return combined drafts count from localStorage and Firebase', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.activeDrafts).toBe(4); // 2 from localStorage + 2 from Firebase
    });

    it('should calculate this week activity count', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.thisWeekActivity).toBe(3); // All 3 audit events from this week
    });

    it('should calculate workflow completion rate', async () => {
      const metrics = await service.getMetrics();
      
      // 1 draft at 100% + 1 draft at 80% = average 90%
      expect(metrics.workflowCompletionRate).toBe(90);
    });

    it('should return storage usage statistics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.storageUsage).toEqual({
        totalSize: 1024000,
        usedPercentage: expect.any(Number),
        remainingCapacity: 47
      });
    });

    it('should return performance metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.performanceMetrics).toEqual({
        averageProcessingTime: 25.5,
        totalEvents: 150,
        eventTypesActive: 2 // Two event types in eventsByType
      });
    });

    it('should include lastUpdated timestamp', async () => {
      const before = Date.now();
      const metrics = await service.getMetrics();
      const after = Date.now();
      
      expect(metrics.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(metrics.lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('caching', () => {
    it('should cache metrics in sessionStorage', async () => {
      await service.getMetrics();
      
      const cached = sessionStorage.getItem('dashboard_metrics_cache');
      expect(cached).toBeTruthy();
      
      const parsedCache = JSON.parse(cached!);
      expect(parsedCache).toHaveProperty('metrics');
      expect(parsedCache).toHaveProperty('timestamp');
    });

    it('should return cached metrics if fresh (< 5 minutes)', async () => {
      // Set up cache
      const cachedMetrics = {
        activeSchedules: 99,
        activeDrafts: 99,
        thisWeekActivity: 99,
        workflowCompletionRate: 99,
        storageUsage: { totalSize: 0, usedPercentage: 0, remainingCapacity: 0 },
        performanceMetrics: { averageProcessingTime: 0, totalEvents: 0, eventTypesActive: 0 },
        lastUpdated: Date.now()
      };
      
      sessionStorage.setItem('dashboard_metrics_cache', JSON.stringify({
        metrics: cachedMetrics,
        timestamp: Date.now() - 60000 // 1 minute ago
      }));
      
      const metrics = await service.getMetrics();
      expect(metrics.activeSchedules).toBe(99); // Should use cached value
    });

    it('should refresh cache if stale (> 5 minutes)', async () => {
      // Set up stale cache
      sessionStorage.setItem('dashboard_metrics_cache', JSON.stringify({
        metrics: { activeSchedules: 99 },
        timestamp: Date.now() - 360000 // 6 minutes ago
      }));
      
      // Need to set up fresh mock data again since this is in a different test
      mockScheduleStorage.getAllSchedules.mockReturnValue([
        { id: '1', status: 'Active', createdAt: '2025-01-01' } as any,
        { id: '2', status: 'Draft', createdAt: '2025-01-02' } as any,
        { id: '3', status: 'Active', createdAt: '2025-01-03' } as any,
      ]);
      
      const metrics = await service.getMetrics();
      expect(metrics.activeSchedules).toBe(2); // Should use fresh value, not cached 99
    });
  });

  describe('error handling', () => {
    it('should handle Firebase connection errors gracefully', async () => {
      // Set up localStorage mocks for this test
      mockScheduleStorage.getAllSchedules.mockReturnValue([
        { id: '1', status: 'Active', createdAt: '2025-01-01' } as any,
        { id: '2', status: 'Draft', createdAt: '2025-01-02' } as any,
        { id: '3', status: 'Active', createdAt: '2025-01-03' } as any,
      ]);
      
      mockScheduleStorage.getAllDraftSchedules.mockReturnValue([
        { id: 'draft1', createdAt: '2025-01-04' } as any,
        { id: 'draft2', createdAt: '2025-01-05' } as any,
      ]);
      
      mockDraftService.getAllDraftsUnified.mockRejectedValue(new Error('Firebase offline'));
      
      const metrics = await service.getMetrics();
      
      // Should still return metrics with localStorage data
      expect(metrics.activeSchedules).toBe(2);
      expect(metrics.activeDrafts).toBe(2); // Only localStorage drafts
    });

    it('should handle corrupted cache gracefully', async () => {
      sessionStorage.setItem('dashboard_metrics_cache', 'invalid json');
      
      const metrics = await service.getMetrics();
      
      // Should compute fresh metrics
      expect(metrics).toHaveProperty('activeSchedules');
      expect(metrics).toHaveProperty('activeDrafts');
    });
  });

  describe('event subscriptions', () => {
    it('should subscribe to relevant workspace events on initialization', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ['schedule-data', 'workflow-progress', 'data-validation'],
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should invalidate cache when relevant events occur', async () => {
      // Get initial metrics to populate cache
      await service.getMetrics();
      expect(sessionStorage.getItem('dashboard_metrics_cache')).toBeTruthy();
      
      // Simulate event that should invalidate cache
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      eventHandler({
        type: 'schedule-data',
        payload: { action: 'create' },
        timestamp: Date.now()
      } as any);
      
      expect(sessionStorage.getItem('dashboard_metrics_cache')).toBe(null);
    });
  });
});
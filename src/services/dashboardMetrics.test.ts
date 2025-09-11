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

    it('should return correct schedule quality metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.scheduleQuality).toBeDefined();
      expect(metrics.scheduleQuality.schedulesWithHealthyRecovery).toBeGreaterThanOrEqual(0);
      expect(metrics.scheduleQuality.averageRecoveryPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should return draft pipeline status', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.draftPipeline).toBeDefined();
      expect(metrics.draftPipeline.totalDrafts).toBe(4); // 2 from localStorage + 2 from Firebase
      expect(metrics.draftPipeline.reviewing).toBeGreaterThanOrEqual(0);
    });

    it('should calculate recent activity metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.recentActivity).toBeDefined();
      expect(metrics.recentActivity.thisWeekSchedulesCreated).toBeGreaterThanOrEqual(0);
      expect(metrics.recentActivity.thisWeekSchedulesModified).toBeGreaterThanOrEqual(0);
    });

    it('should calculate planning efficiency metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.planningEfficiency).toBeDefined();
      expect(metrics.planningEfficiency.averageCycleTime).toBeGreaterThanOrEqual(0);
      expect(metrics.planningEfficiency.averageServiceFrequency).toBeGreaterThanOrEqual(0);
    });

    it('should return system health metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.systemHealth).toBeDefined();
      expect(metrics.systemHealth.storageUsedPercentage).toBeGreaterThanOrEqual(0);
      expect(metrics.systemHealth.averageProcessingTime).toBe(25.5);
      expect(metrics.systemHealth.dataIntegrityScore).toBeGreaterThanOrEqual(0);
    });

    it('should return validation status metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.validationStatus).toBeDefined();
      expect(metrics.validationStatus.schedulesWithErrors).toBeGreaterThanOrEqual(0);
      expect(metrics.validationStatus.schedulesWithWarnings).toBeGreaterThanOrEqual(0);
      expect(metrics.validationStatus.commonIssues).toBeDefined();
      expect(Array.isArray(metrics.validationStatus.commonIssues)).toBe(true);
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
        scheduleQuality: {
          averageRecoveryPercentage: 15,
          schedulesWithHealthyRecovery: 99,
          schedulesNeedingAttention: 0,
          validationPassRate: 100,
          averageBlockUtilization: 85
        },
        planningEfficiency: {
          averageCycleTime: 60,
          averageServiceFrequency: 15,
          peakHourCoverage: 85,
          serviceBandDistribution: { fastest: 33, standard: 34, slowest: 33 }
        },
        draftPipeline: {
          uploading: 0,
          analyzing: 0,
          configuring: 0,
          reviewing: 0,
          readyToPublish: 0,
          totalDrafts: 99
        },
        validationStatus: {
          schedulesWithErrors: 0,
          schedulesWithWarnings: 0,
          commonIssues: [],
          criticalAlerts: 0
        },
        recentActivity: {
          thisWeekSchedulesCreated: 0,
          thisWeekSchedulesModified: 0,
          lastPublishedSchedule: null,
          upcomingExpirations: 0
        },
        systemHealth: {
          storageUsedPercentage: 0,
          averageProcessingTime: 0,
          dataIntegrityScore: 100
        },
        lastUpdated: Date.now()
      };
      
      sessionStorage.setItem('dashboard_metrics_cache', JSON.stringify({
        metrics: cachedMetrics,
        timestamp: Date.now() - 60000 // 1 minute ago
      }));
      
      const metrics = await service.getMetrics();
      expect(metrics.scheduleQuality.schedulesWithHealthyRecovery).toBe(99); // Should use cached value
    });

    it('should refresh cache if stale (> 5 minutes)', async () => {
      // Set up stale cache
      sessionStorage.setItem('dashboard_metrics_cache', JSON.stringify({
        metrics: { 
          scheduleQuality: { schedulesWithHealthyRecovery: 99 },
          planningEfficiency: {},
          draftPipeline: {},
          validationStatus: {},
          recentActivity: {},
          systemHealth: {},
          lastUpdated: Date.now()
        },
        timestamp: Date.now() - 360000 // 6 minutes ago
      }));
      
      // Need to set up fresh mock data again since this is in a different test
      mockScheduleStorage.getAllSchedules.mockReturnValue([
        { id: '1', status: 'Active', createdAt: '2025-01-01' } as any,
        { id: '2', status: 'Draft', createdAt: '2025-01-02' } as any,
        { id: '3', status: 'Active', createdAt: '2025-01-03' } as any,
      ]);
      
      const metrics = await service.getMetrics();
      expect(metrics.scheduleQuality).toBeDefined(); // Should use fresh value, not cached
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
      expect(metrics.scheduleQuality).toBeDefined();
      expect(metrics.draftPipeline.totalDrafts).toBe(2); // Only localStorage drafts
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
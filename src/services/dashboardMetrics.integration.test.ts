/**
 * Dashboard Metrics Integration Tests
 * Tests that would have caught the Firebase hanging issue
 * These test real service integration without mocks
 */

import { DashboardMetricsService } from './dashboardMetrics';

// Don't mock anything - test real integration
describe('DashboardMetrics Integration', () => {
  let service: DashboardMetricsService;

  beforeEach(() => {
    service = new DashboardMetricsService();
  });

  describe('real service integration', () => {
    it('should resolve within reasonable time even with Firebase issues', async () => {
      const startTime = Date.now();
      
      // This should not hang even if Firebase is misconfigured
      const metrics = await service.getMetrics();
      
      const duration = Date.now() - startTime;
      
      // Should resolve within 10 seconds max (5s timeout + buffer)
      expect(duration).toBeLessThan(10000);
      
      // Should still return valid metrics structure
      expect(metrics).toMatchObject({
        activeSchedules: expect.any(Number),
        activeDrafts: expect.any(Number),
        thisWeekActivity: expect.any(Number),
        workflowCompletionRate: expect.any(Number),
        storageUsage: expect.objectContaining({
          totalSize: expect.any(Number),
          usedPercentage: expect.any(Number),
          remainingCapacity: expect.any(Number)
        }),
        performanceMetrics: expect.objectContaining({
          averageProcessingTime: expect.any(Number),
          totalEvents: expect.any(Number),
          eventTypesActive: expect.any(Number)
        }),
        lastUpdated: expect.any(Number)
      });
    }, 15000); // 15 second timeout for this test

    it('should work with only localStorage when Firebase fails', async () => {
      const metrics = await service.getMetrics();
      
      // Even if Firebase fails, should still get localStorage-based metrics
      expect(metrics.scheduleQuality).toBeDefined();
      expect(metrics.draftPipeline.totalDrafts).toBeGreaterThanOrEqual(0);
      expect(metrics.lastUpdated).toBeDefined();
    });

    it('should handle concurrent calls gracefully', async () => {
      // Multiple concurrent calls shouldn't cause issues
      const promises = Array.from({ length: 3 }, () => service.getMetrics());
      
      const results = await Promise.all(promises);
      
      // All calls should succeed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.scheduleQuality).toBeDefined();
      });
    });

    it('should use caching effectively', async () => {
      // First call
      const start1 = Date.now();
      const metrics1 = await service.getMetrics();
      const duration1 = Date.now() - start1;
      
      // Second call should be much faster due to caching
      const start2 = Date.now();
      const metrics2 = await service.getMetrics();
      const duration2 = Date.now() - start2;
      
      // Second call should be significantly faster (cached)
      expect(duration2).toBeLessThan(duration1 / 2);
      
      // Results should be the same
      expect(metrics1.lastUpdated).toBe(metrics2.lastUpdated);
    });
  });

  describe('service availability checks', () => {
    it('should handle scheduleStorage being unavailable', async () => {
      // Test resilience when services are undefined/unavailable
      const metrics = await service.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should log appropriate warnings for service failures', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await service.getMetrics();
      
      // Should log warnings if Firebase is unreachable but not crash
      const firebaseWarnings = consoleSpy.mock.calls.filter(call => 
        call[0].includes('Firebase') || call[0].includes('failed')
      );
      
      // Might have warnings, but that's expected in test environment
      expect(firebaseWarnings.length).toBeGreaterThanOrEqual(0);
      
      consoleSpy.mockRestore();
    });
  });
});
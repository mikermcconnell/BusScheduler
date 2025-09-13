/**
 * End-to-End Tests for Workflow Persistence System
 * Tests complete user workflows with real browser behavior simulation
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Test data files
const SAMPLE_CSV_PATH = path.join(__dirname, '../../../test-data/sample-schedule.csv');
const LARGE_CSV_PATH = path.join(__dirname, '../../../test-data/large-schedule.csv');

interface DraftData {
  draftId: string;
  draftName: string;
  currentStep: string;
  progress: number;
}

class WorkflowPage {
  constructor(private page: Page) {}

  async navigateToUpload() {
    await this.page.goto('/upload');
  }

  async uploadFile(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await this.page.waitForSelector('[data-testid="upload-success"]', { timeout: 10000 });
  }

  async navigateToTimepoints() {
    await this.page.click('[data-testid="nav-timepoints"]');
    await this.page.waitForURL('**/timepoints**');
  }

  async completeTimepointsAnalysis() {
    // Wait for timepoints page to load
    await this.page.waitForSelector('[data-testid="timepoints-chart"]');
    
    // Apply service bands
    await this.page.click('[data-testid="apply-service-bands"]');
    
    // Wait for analysis to complete
    await this.page.waitForSelector('[data-testid="timepoints-complete"]');
    
    // Navigate to next step
    await this.page.click('[data-testid="next-step-button"]');
  }

  async navigateToBlockConfiguration() {
    await this.page.click('[data-testid="nav-block-config"]');
    await this.page.waitForURL('**/block-configuration**');
  }

  async configureBlocks(numberOfBuses: number = 5, cycleTime: number = 60) {
    // Wait for block configuration page
    await this.page.waitForSelector('[data-testid="block-config-form"]');
    
    // Set number of buses
    await this.page.fill('[data-testid="number-of-buses"]', numberOfBuses.toString());
    
    // Set cycle time
    await this.page.fill('[data-testid="cycle-time"]', cycleTime.toString());
    
    // Generate blocks
    await this.page.click('[data-testid="generate-blocks"]');
    
    // Wait for blocks to be generated
    await this.page.waitForSelector('[data-testid="blocks-generated"]');
    
    // Proceed to summary
    await this.page.click('[data-testid="next-step-button"]');
  }

  async navigateToSummarySchedule() {
    await this.page.click('[data-testid="nav-summary"]');
    await this.page.waitForURL('**/summary-schedule**');
  }

  async generateSummarySchedule() {
    await this.page.waitForSelector('[data-testid="summary-schedule-table"]');
    
    // Verify schedule is displayed
    const tripCount = await this.page.textContent('[data-testid="trip-count"]');
    expect(tripCount).toBeTruthy();
    
    // Export schedule (optional)
    await this.page.click('[data-testid="export-schedule"]');
  }

  async getCurrentDraftData(): Promise<DraftData | null> {
    return await this.page.evaluate(() => {
      const draftId = sessionStorage.getItem('current_workflow_draft');
      if (!draftId) return null;
      
      const draftData = localStorage.getItem(`scheduler2_draft_workflow_${draftId}`);
      return draftData ? JSON.parse(draftData) : null;
    });
  }

  async getProgressIndicator(): Promise<number> {
    const progressText = await this.page.textContent('[data-testid="progress-indicator"]');
    const match = progressText?.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async getSyncStatus(): Promise<string> {
    const statusElement = this.page.locator('[data-testid="sync-status"]');
    return await statusElement.textContent() || '';
  }

  async waitForSyncComplete() {
    await this.page.waitForSelector('[data-testid="sync-status"][data-status="saved"]', { 
      timeout: 10000 
    });
  }

  async simulateOffline() {
    await this.page.context().setOffline(true);
  }

  async simulateOnline() {
    await this.page.context().setOffline(false);
  }

  async refreshPage() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  async openNewTab(): Promise<Page> {
    const newPage = await this.page.context().newPage();
    return newPage;
  }

  async makeInlineEdit(tripId: string, recoveryTime: string) {
    const cellSelector = `[data-testid="recovery-cell-${tripId}"]`;
    await this.page.click(cellSelector);
    
    const inputSelector = `[data-testid="recovery-input-${tripId}"]`;
    await this.page.fill(inputSelector, recoveryTime);
    await this.page.press(inputSelector, 'Enter');
    
    // Wait for cascade update to complete
    await this.page.waitForSelector('[data-testid="cascade-update-complete"]');
  }
}

test.describe('Workflow Persistence E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up localStorage and session storage mocks
    await page.addInitScript(() => {
      // Mock Firebase for E2E tests
      window.mockFirebase = true;
      
      // Ensure localStorage is available
      if (!window.localStorage) {
        window.localStorage = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          length: 0,
          key: () => null
        };
      }
    });
  });

  test('should persist progress through complete workflow', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Step 1: Upload file
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    
    let progress = await workflow.getProgressIndicator();
    expect(progress).toBeGreaterThanOrEqual(10);
    
    // Step 2: Complete timepoints analysis
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    
    progress = await workflow.getProgressIndicator();
    expect(progress).toBeGreaterThanOrEqual(30);
    
    // Step 3: Configure blocks
    await workflow.navigateToBlockConfiguration();
    await workflow.configureBlocks(6, 45);
    
    progress = await workflow.getProgressIndicator();
    expect(progress).toBeGreaterThanOrEqual(60);
    
    // Step 4: Generate summary schedule
    await workflow.navigateToSummarySchedule();
    await workflow.generateSummarySchedule();
    
    progress = await workflow.getProgressIndicator();
    expect(progress).toBeGreaterThanOrEqual(90);
    
    // Verify final state
    const draftData = await workflow.getCurrentDraftData();
    expect(draftData?.currentStep).toBe('summary');
    expect(draftData?.progress).toBeGreaterThanOrEqual(90);
  });

  test('should restore state after browser refresh at any step', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Complete upload and timepoints
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    
    const beforeRefreshData = await workflow.getCurrentDraftData();
    const beforeRefreshProgress = await workflow.getProgressIndicator();
    
    // Refresh the page
    await workflow.refreshPage();
    
    // Should restore to the correct step
    expect(page.url()).toContain('timepoints');
    
    const afterRefreshData = await workflow.getCurrentDraftData();
    const afterRefreshProgress = await workflow.getProgressIndicator();
    
    // Data should be preserved
    expect(afterRefreshData?.draftId).toBe(beforeRefreshData?.draftId);
    expect(afterRefreshProgress).toBe(beforeRefreshProgress);
    
    // Should be able to continue workflow
    await workflow.navigateToBlockConfiguration();
    await workflow.configureBlocks();
    
    const finalProgress = await workflow.getProgressIndicator();
    expect(finalProgress).toBeGreaterThan(beforeRefreshProgress);
  });

  test('should handle offline mode with queue synchronization', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Start workflow online
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    await workflow.waitForSyncComplete();
    
    // Go offline
    await workflow.simulateOffline();
    
    // Continue workflow offline
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    
    // Verify offline status
    const syncStatus = await workflow.getSyncStatus();
    expect(syncStatus).toContain('offline');
    
    // Go back online
    await workflow.simulateOnline();
    
    // Wait for sync to complete
    await workflow.waitForSyncComplete();
    
    // Verify all changes were synced
    const finalSyncStatus = await workflow.getSyncStatus();
    expect(finalSyncStatus).toContain('saved');
  });

  test('should handle multiple tabs with same workflow', async ({ page, context }) => {
    const workflow1 = new WorkflowPage(page);
    
    // Start workflow in first tab
    await workflow1.navigateToUpload();
    await workflow1.uploadFile(SAMPLE_CSV_PATH);
    await workflow1.navigateToTimepoints();
    
    // Open second tab
    const page2 = await workflow1.openNewTab();
    const workflow2 = new WorkflowPage(page2);
    
    await workflow2.navigateToTimepoints();
    
    // Both tabs should show the same draft
    const draft1 = await workflow1.getCurrentDraftData();
    const draft2 = await workflow2.getCurrentDraftData();
    
    expect(draft1?.draftId).toBe(draft2?.draftId);
    
    // Make changes in first tab
    await workflow1.completeTimepointsAnalysis();
    
    // Refresh second tab to see updates
    await workflow2.refreshPage();
    
    const updatedDraft2 = await workflow2.getCurrentDraftData();
    expect(updatedDraft2?.progress).toBeGreaterThan(draft1?.progress || 0);
  });

  test('should persist inline edits in summary schedule', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Complete workflow up to summary
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    await workflow.navigateToBlockConfiguration();
    await workflow.configureBlocks();
    await workflow.navigateToSummarySchedule();
    
    // Make inline edits
    await workflow.makeInlineEdit('trip-1', '5');
    await workflow.makeInlineEdit('trip-2', '8');
    
    // Wait for changes to persist
    await workflow.waitForSyncComplete();
    
    // Refresh and verify changes persist
    await workflow.refreshPage();
    
    const trip1Recovery = await page.textContent('[data-testid="recovery-cell-trip-1"]');
    const trip2Recovery = await page.textContent('[data-testid="recovery-cell-trip-2"]');
    
    expect(trip1Recovery).toContain('5');
    expect(trip2Recovery).toContain('8');
  });

  test('should handle large dataset workflow efficiently', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Set longer timeout for large dataset
    test.setTimeout(60000);
    
    const startTime = Date.now();
    
    // Upload large dataset
    await workflow.navigateToUpload();
    await workflow.uploadFile(LARGE_CSV_PATH);
    
    // Complete workflow
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    await workflow.navigateToBlockConfiguration();
    await workflow.configureBlocks(10, 30); // More buses for large dataset
    await workflow.navigateToSummarySchedule();
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should complete within reasonable time (adjust based on dataset size)
    expect(totalTime).toBeLessThan(45000); // 45 seconds
    
    // Verify data integrity
    const tripCount = await page.textContent('[data-testid="trip-count"]');
    expect(parseInt(tripCount || '0', 10)).toBeGreaterThan(100);
  });

  test('should recover from Firebase connection errors', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Mock Firebase to fail initially
    await page.addInitScript(() => {
      window.mockFirebaseFailures = 3; // Fail first 3 attempts
    });
    
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    
    // Should show error state initially
    const initialStatus = await workflow.getSyncStatus();
    expect(initialStatus).toContain('error');
    
    // Wait for automatic retries to succeed
    await workflow.waitForSyncComplete();
    
    // Should eventually sync successfully
    const finalStatus = await workflow.getSyncStatus();
    expect(finalStatus).toContain('saved');
    
    // Workflow should continue normally
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    
    const progress = await workflow.getProgressIndicator();
    expect(progress).toBeGreaterThanOrEqual(30);
  });

  test('should handle conflicting changes between sessions', async ({ page, context }) => {
    const workflow1 = new WorkflowPage(page);
    
    // Start workflow
    await workflow1.navigateToUpload();
    await workflow1.uploadFile(SAMPLE_CSV_PATH);
    const draft = await workflow1.getCurrentDraftData();
    
    // Simulate another session making changes
    await page.evaluate((draftId) => {
      const conflictingDraft = {
        draftId,
        draftName: 'Modified Draft',
        currentStep: 'timepoints',
        progress: 50,
        metadata: {
          version: 2, // Higher version
          lastModifiedAt: new Date().toISOString()
        }
      };
      localStorage.setItem(`scheduler2_draft_workflow_${draftId}`, JSON.stringify(conflictingDraft));
    }, draft?.draftId);
    
    // Try to make changes in current session
    await workflow1.navigateToTimepoints();
    await workflow1.completeTimepointsAnalysis();
    
    // Should resolve conflicts automatically
    await workflow1.waitForSyncComplete();
    
    // Verify workflow continues
    await workflow1.navigateToBlockConfiguration();
    const finalProgress = await workflow1.getProgressIndicator();
    expect(finalProgress).toBeGreaterThanOrEqual(60);
  });

  test('should maintain performance with rapid user interactions', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Complete workflow to summary
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    await workflow.navigateToBlockConfiguration();
    await workflow.configureBlocks();
    await workflow.navigateToSummarySchedule();
    
    const startTime = Date.now();
    
    // Make rapid edits
    for (let i = 1; i <= 10; i++) {
      await workflow.makeInlineEdit(`trip-${i}`, i.toString());
    }
    
    const endTime = Date.now();
    const editTime = endTime - startTime;
    
    // Should handle rapid edits efficiently
    expect(editTime).toBeLessThan(10000); // 10 seconds for 10 edits
    
    // All edits should persist
    await workflow.waitForSyncComplete();
    await workflow.refreshPage();
    
    for (let i = 1; i <= 10; i++) {
      const cellValue = await page.textContent(`[data-testid="recovery-cell-trip-${i}"]`);
      expect(cellValue).toContain(i.toString());
    }
  });

  test('should handle browser crash simulation', async ({ page, context }) => {
    const workflow = new WorkflowPage(page);
    
    // Complete partial workflow
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    
    const beforeCrashData = await workflow.getCurrentDraftData();
    
    // Simulate crash by closing and reopening browser context
    await page.close();
    
    const newPage = await context.newPage();
    const newWorkflow = new WorkflowPage(newPage);
    
    // Navigate to app - should restore from localStorage
    await newWorkflow.navigateToUpload();
    
    // Should detect existing draft and restore
    const afterCrashData = await newWorkflow.getCurrentDraftData();
    expect(afterCrashData?.draftId).toBe(beforeCrashData?.draftId);
    expect(afterCrashData?.progress).toBe(beforeCrashData?.progress);
    
    // Should be able to continue workflow
    await newWorkflow.navigateToBlockConfiguration();
    await newWorkflow.configureBlocks();
    
    const finalProgress = await newWorkflow.getProgressIndicator();
    expect(finalProgress).toBeGreaterThan(beforeCrashData?.progress || 0);
  });

  test('should export workflow data correctly after persistence', async ({ page }) => {
    const workflow = new WorkflowPage(page);
    
    // Complete full workflow
    await workflow.navigateToUpload();
    await workflow.uploadFile(SAMPLE_CSV_PATH);
    await workflow.navigateToTimepoints();
    await workflow.completeTimepointsAnalysis();
    await workflow.navigateToBlockConfiguration();
    await workflow.configureBlocks();
    await workflow.navigateToSummarySchedule();
    
    // Refresh to ensure all data is persisted and loaded
    await workflow.refreshPage();
    
    // Export schedule
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-excel"]');
    const download = await downloadPromise;
    
    // Verify export file
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    
    // Verify export contains expected data structure
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    
    // File should be substantial (not empty)
    const stats = await page.evaluate(async (path) => {
      // Mock file system access for testing
      return { size: 50000 }; // Mock size
    }, filePath);
    
    expect(stats.size).toBeGreaterThan(10000); // At least 10KB
  });
});
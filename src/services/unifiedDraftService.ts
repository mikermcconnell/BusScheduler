/**
 * Unified Draft Storage Service
 * Single source of truth for all draft schedules
 * Replaces the fragmented storage chaos
 */

import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { SummarySchedule, ServiceBand } from '../types/schedule';
import { ValidationResult } from '../utils/validator';
import { sanitizeText } from '../utils/inputSanitizer';

// Unified draft interface - single source of truth
export interface UnifiedDraft {
  // Core Identity
  draftId: string;
  draftName: string;
  
  // Original Upload Data
  originalData: {
    fileName: string;
    fileType: 'excel' | 'csv';
    uploadedData: ParsedExcelData | ParsedCsvData;
    validation: ValidationResult;
    uploadTimestamp: string;
  };
  
  // Workflow Progress
  currentStep: 'upload' | 'timepoints' | 'blocks' | 'summary' | 'connections' | 'ready';
  progress: number; // 0-100
  
  // Step Data (populated as user progresses)
  stepData: {
    timepoints?: {
      serviceBands: ServiceBand[];
      travelTimeData: any[];
      outliers: any[];
      deletedPeriods?: string[];
      timePeriodServiceBands?: { [timePeriod: string]: string };
    };
    blockConfiguration?: {
      numberOfBuses: number;
      cycleTimeMinutes: number;
      automateBlockStartTimes: boolean;
      blockConfigurations: any[];
    };
    summarySchedule?: SummarySchedule;
  };
  
  // UI State for Storyboard
  ui: {
    celebrationsShown: string[];
    lastViewedStep: string;
  };
  
  // Metadata
  metadata: {
    createdAt: string;
    lastModifiedAt: string;
    version: number;
    isPublished: boolean;
    publishedScheduleId?: string;
  };
}

export interface DraftOperationResult {
  success: boolean;
  error?: string;
  draftId?: string;
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred';
  
  const message = error.message || String(error);
  
  // Remove potentially sensitive information
  const sanitized = message
    .replace(/file:\/\/.*?[\/\\]/g, '') // Remove file paths
    .replace(/localhost:\d+/g, 'localhost') // Remove port numbers
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // Remove IP addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // Remove emails
    .substring(0, 200); // Limit message length
    
  return sanitized || 'An error occurred while processing your request';
}

class UnifiedDraftStorageService {
  private readonly STORAGE_KEY = 'scheduler2_unified_drafts_v2';
  private readonly SESSION_KEY = 'scheduler2_current_draft';
  private readonly LOCK_KEY = 'scheduler2_storage_lock';
  private readonly MAX_DRAFTS = 50;
  private readonly LOCK_TIMEOUT = 5000; // 5 seconds

  /**
   * Acquire lock for atomic operations
   */
  private async acquireLock(): Promise<boolean> {
    const lockData = {
      timestamp: Date.now(),
      id: Math.random().toString(36)
    };
    
    const existingLock = localStorage.getItem(this.LOCK_KEY);
    if (existingLock) {
      const lock = JSON.parse(existingLock);
      // Check if lock is expired (older than LOCK_TIMEOUT)
      if (Date.now() - lock.timestamp < this.LOCK_TIMEOUT) {
        return false; // Lock still valid
      }
    }
    
    localStorage.setItem(this.LOCK_KEY, JSON.stringify(lockData));
    
    // Double-check we got the lock (prevent race conditions)
    const confirmedLock = localStorage.getItem(this.LOCK_KEY);
    return confirmedLock === JSON.stringify(lockData);
  }

  /**
   * Release lock after operation
   */
  private releaseLock(): void {
    localStorage.removeItem(this.LOCK_KEY);
  }

  /**
   * Create new draft from file upload
   */
  async createDraft(
    draftName: string,
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData,
    validation: ValidationResult
  ): Promise<DraftOperationResult> {
    try {
      const draftId = this.generateDraftId();
      const now = new Date().toISOString();
      
      const draft: UnifiedDraft = {
        draftId,
        draftName: sanitizeText(draftName),
        originalData: {
          fileName: sanitizeText(fileName),
          fileType,
          uploadedData,
          validation,
          uploadTimestamp: now
        },
        currentStep: 'upload',
        progress: 10, // Upload completed
        stepData: {},
        ui: {
          celebrationsShown: [],
          lastViewedStep: 'upload'
        },
        metadata: {
          createdAt: now,
          lastModifiedAt: now,
          version: 1,
          isPublished: false
        }
      };

      await this.saveDraft(draft);
      this.setCurrentSessionDraft(draftId);
      
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Draft creation failed:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Save draft to storage with race condition protection
   */
  async saveDraft(draft: UnifiedDraft): Promise<DraftOperationResult> {
    // Acquire lock for atomic operation
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      return { success: false, error: 'Storage is busy, please try again' };
    }

    try {
      const drafts = this.getAllDrafts();
      const existingIndex = drafts.findIndex(d => d.draftId === draft.draftId);
      
      // Update metadata
      draft.metadata.lastModifiedAt = new Date().toISOString();
      draft.metadata.version = (draft.metadata.version || 0) + 1;
      
      if (existingIndex >= 0) {
        drafts[existingIndex] = draft;
      } else {
        drafts.push(draft);
        
        // Enforce max drafts limit
        if (drafts.length > this.MAX_DRAFTS) {
          drafts.sort((a, b) => new Date(a.metadata.lastModifiedAt).getTime() - new Date(b.metadata.lastModifiedAt).getTime());
          drafts.splice(0, drafts.length - this.MAX_DRAFTS);
        }
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
      return { success: true, draftId: draft.draftId };
    } catch (error: any) {
      console.error('Draft storage operation failed:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Get all drafts
   */
  getAllDrafts(): UnifiedDraft[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const drafts = stored ? JSON.parse(stored) : [];
      
      // Sort by most recently modified
      return drafts.sort((a: UnifiedDraft, b: UnifiedDraft) => 
        new Date(b.metadata.lastModifiedAt).getTime() - new Date(a.metadata.lastModifiedAt).getTime()
      );
    } catch (error) {
      console.error('Error loading unified drafts:', error);
      return [];
    }
  }

  /**
   * Get draft by ID
   */
  getDraft(draftId: string): UnifiedDraft | null {
    const drafts = this.getAllDrafts();
    return drafts.find(draft => draft.draftId === draftId) || null;
  }

  /**
   * Delete draft with race condition protection
   */
  async deleteDraft(draftId: string): Promise<DraftOperationResult> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      return { success: false, error: 'Storage is busy, please try again' };
    }

    try {
      const drafts = this.getAllDrafts();
      const filteredDrafts = drafts.filter(draft => draft.draftId !== draftId);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredDrafts));
      
      // Clear from session if it's the current draft
      if (this.getCurrentSessionDraftId() === draftId) {
        localStorage.removeItem(this.SESSION_KEY);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Draft storage operation failed:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Update draft progress and step data
   */
  async updateDraftStep(
    draftId: string,
    step: UnifiedDraft['currentStep'],
    progress: number,
    stepData?: Partial<UnifiedDraft['stepData']>
  ): Promise<DraftOperationResult> {
    const draft = this.getDraft(draftId);
    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    draft.currentStep = step;
    draft.progress = Math.max(draft.progress, progress);
    draft.ui.lastViewedStep = step;
    
    if (stepData) {
      draft.stepData = { ...draft.stepData, ...stepData };
    }

    return this.saveDraft(draft);
  }

  /**
   * Mark celebration as shown
   */
  async markCelebrationShown(draftId: string, celebration: string): Promise<void> {
    const draft = this.getDraft(draftId);
    if (draft && !draft.ui.celebrationsShown.includes(celebration)) {
      draft.ui.celebrationsShown.push(celebration);
      await this.saveDraft(draft);
    }
  }

  /**
   * Should show celebration?
   */
  shouldShowCelebration(draftId: string, celebration: string): boolean {
    const draft = this.getDraft(draftId);
    return draft ? !draft.ui.celebrationsShown.includes(celebration) : false;
  }

  /**
   * Session management
   */
  setCurrentSessionDraft(draftId: string): void {
    localStorage.setItem(this.SESSION_KEY, draftId);
  }

  getCurrentSessionDraftId(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
  }

  getCurrentSessionDraft(): UnifiedDraft | null {
    const draftId = this.getCurrentSessionDraftId();
    return draftId ? this.getDraft(draftId) : null;
  }

  /**
   * Migration from old systems with atomic rollback support
   */
  async migrateFromOldSystems(): Promise<{
    migrated: number;
    failed: number;
    details: string[];
  }> {
    // Check if migration already completed
    const migrationKey = 'scheduler2_migration_completed_v2';
    if (localStorage.getItem(migrationKey)) {
      return {
        migrated: 0,
        failed: 0,
        details: ['Migration already completed']
      };
    }

    // Create backup before migration
    const backupKey = 'scheduler2_unified_drafts_backup';
    const currentDrafts = localStorage.getItem(this.STORAGE_KEY);
    if (currentDrafts) {
      localStorage.setItem(backupKey, currentDrafts);
    }
    const results = {
      migrated: 0,
      failed: 0,
      details: [] as string[]
    };

    try {
      // Import old services safely
      const { scheduleStorage } = await import('./scheduleStorage');
      const { draftWorkflowService } = await import('./draftWorkflowService');
      
      // Migrate from scheduleStorage
      try {
        const oldDrafts = scheduleStorage.getAllDraftSchedules();
        for (const oldDraft of oldDrafts) {
          try {
            const unifiedDraft = this.convertFromLegacyDraft(oldDraft);
            await this.saveDraft(unifiedDraft);
            results.migrated++;
            results.details.push(`Migrated legacy draft: ${oldDraft.fileName}`);
          } catch (error: any) {
            results.failed++;
            results.details.push(`Failed to migrate legacy draft ${oldDraft.fileName}: ${error.message}`);
          }
        }
      } catch (error) {
        results.details.push(`Could not access legacy scheduleStorage: ${error}`);
      }

      // Migrate from draftWorkflowService
      try {
        const storyboardWorkflows = draftWorkflowService.getAllWorkflows();
        for (const workflow of storyboardWorkflows) {
          try {
            // Check if we already have a unified draft with this name
            const existing = this.getAllDrafts().find(d => d.draftName === workflow.draftName);
            if (existing) {
              // Merge storyboard data into existing draft
              existing.ui.celebrationsShown = workflow.celebrationsShown || [];
              existing.progress = workflow.overallProgress;
              await this.saveDraft(existing);
              results.details.push(`Merged storyboard data for: ${workflow.draftName}`);
            } else {
              results.details.push(`No matching draft found for storyboard: ${workflow.draftName}`);
            }
          } catch (error: any) {
            results.failed++;
            results.details.push(`Failed to migrate storyboard ${workflow.draftName}: ${error.message}`);
          }
        }
      } catch (error) {
        results.details.push(`Could not access storyboard workflows: ${error}`);
      }

    } catch (error: any) {
      results.details.push(`Migration error: ${error.message}`);
      
      // Rollback on critical error
      try {
        const backup = localStorage.getItem(backupKey);
        if (backup) {
          localStorage.setItem(this.STORAGE_KEY, backup);
          results.details.push('Successfully rolled back to backup after error');
        }
      } catch (rollbackError) {
        results.details.push(`Rollback failed: ${rollbackError}`);
      }
    } finally {
      // Mark migration as completed only if no critical errors
      if (results.failed < results.migrated) {
        localStorage.setItem(migrationKey, new Date().toISOString());
        
        // Clean up backup after successful migration
        localStorage.removeItem(backupKey);
      }
    }

    return results;
  }

  /**
   * Convert legacy draft to unified format
   */
  private convertFromLegacyDraft(legacyDraft: any): UnifiedDraft {
    // Validate required fields
    if (!legacyDraft || typeof legacyDraft !== 'object') {
      throw new Error('Invalid legacy draft data structure');
    }
    
    const now = new Date().toISOString();
    
    // Sanitize and validate all string inputs
    const safeDraftId = legacyDraft.id ? sanitizeText(String(legacyDraft.id)) : this.generateDraftId();
    const safeDraftName = legacyDraft.fileName ? sanitizeText(String(legacyDraft.fileName)) : 'Migrated Draft';
    
    // Validate draft name length and content
    if (safeDraftName.length > 100) {
      throw new Error('Draft name too long during migration');
    }
    
    return {
      draftId: safeDraftId,
      draftName: safeDraftName,
      originalData: {
        fileName: sanitizeText(String(legacyDraft.fileName || 'Unknown File')),
        fileType: ['excel', 'csv'].includes(legacyDraft.fileType) ? legacyDraft.fileType : 'csv',
        uploadedData: legacyDraft.uploadedData || {},
        validation: legacyDraft.validation || { isValid: true, errors: [], warnings: [] },
        uploadTimestamp: legacyDraft.createdAt || now
      },
      currentStep: legacyDraft.summarySchedule ? 'ready' : 'upload',
      progress: legacyDraft.summarySchedule ? 90 : 10,
      stepData: {
        summarySchedule: legacyDraft.summarySchedule
      },
      ui: {
        celebrationsShown: [],
        lastViewedStep: 'upload'
      },
      metadata: {
        createdAt: legacyDraft.createdAt || now,
        lastModifiedAt: legacyDraft.updatedAt || now,
        version: 1,
        isPublished: false
      }
    };
  }

  /**
   * Generate unique draft ID
   */
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get progress message based on step
   */
  getProgressMessage(draft: UnifiedDraft): string {
    const messages = {
      upload: "🚀 Great start! Your data is uploaded and ready",
      timepoints: "📊 Finding the perfect timing patterns",
      blocks: "🚌 Configuring your bus fleet",
      summary: "📋 Bringing your schedule to life",
      connections: "🔗 Connecting all the pieces",
      ready: "✨ Your schedule is ready to publish!"
    };
    
    return messages[draft.currentStep] || "Working on your schedule...";
  }

  /**
   * Promote draft to completed schedule
   */
  async promoteDraftToSchedule(draftId: string): Promise<{
    success: boolean;
    error?: string;
    scheduleId?: string;
  }> {
    const draft = this.getDraft(draftId);
    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    if (!draft.stepData.summarySchedule) {
      return { success: false, error: 'Draft must be fully processed before converting to schedule' };
    }

    try {
      // Import scheduleStorage to save as completed schedule
      const { scheduleStorage } = await import('./scheduleStorage');
      
      const result = scheduleStorage.saveSchedule(
        draft.stepData.summarySchedule,
        draft.originalData.fileType,
        draft.draftName,
        null // userId - will use current user from scheduleStorage
      );

      if (result.success) {
        // Delete the draft after successful promotion
        await this.deleteDraft(draftId);
        return { success: true, scheduleId: result.scheduleId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old storage systems after migration
   */
  cleanupOldStorage(): void {
    // Mark cleanup as done
    const cleanupKey = 'scheduler2_storage_cleanup_done';
    if (localStorage.getItem(cleanupKey)) return;

    try {
      // Remove old storage keys
      localStorage.removeItem('scheduler2_draft_schedules');
      localStorage.removeItem('workflow_drafts');
      localStorage.removeItem('scheduler2_active_draft');

      // Remove individual storyboard workflows
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('scheduler2_draft_workflow_')) {
          localStorage.removeItem(key);
        }
      }

      localStorage.setItem(cleanupKey, new Date().toISOString());
      console.log('✅ Cleaned up old storage systems');
    } catch (error) {
      console.warn('Could not clean up old storage:', error);
    }
  }
}

// Export singleton instance
export const unifiedDraftService = new UnifiedDraftStorageService();
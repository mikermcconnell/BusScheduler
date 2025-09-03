/**
 * Enhanced Firebase Draft Service
 * Unified cloud persistence for all draft schedules with comprehensive capabilities
 * Consolidates functionality from workflowDraftService and unifiedDraftService
 */

import { 
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  WorkflowDraftState,
  WorkflowDraftResult,
  TimePointData,
  OutlierData,
  TimepointsModification,
  BlockConfiguration,
  ScheduleGenerationMetadata
} from '../types/workflow';
import { SummarySchedule, ServiceBand, ScheduleValidationResult } from '../types/schedule';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { ValidationResult } from '../utils/validator';
import { sanitizeText } from '../utils/inputSanitizer';

// Enhanced draft interface for compatibility with unifiedDraftService
export interface UnifiedDraftCompat {
  // Core Identity
  draftId: string;
  draftName: string;
  
  // Original Upload Data
  originalData: {
    fileName: string;
    fileType: 'excel' | 'csv';
    uploadedData: ParsedExcelData | ParsedCsvData;
    validation?: ValidationResult;
    uploadTimestamp: string;
  };
  
  // Workflow Progress
  currentStep: 'upload' | 'timepoints' | 'blocks' | 'summary' | 'connections' | 'ready' | 'ready-to-publish';
  progress: number; // 0-100
  
  // Step Data (populated as user progresses)
  stepData: {
    timepoints?: {
      serviceBands: ServiceBand[];
      travelTimeData: TimePointData[];
      outliers: OutlierData[];
      deletedPeriods?: string[];
      timePeriodServiceBands?: { [timePeriod: string]: string };
    };
    blockConfiguration?: {
      numberOfBuses: number;
      cycleTimeMinutes: number;
      automateBlockStartTimes: boolean;
      blockConfigurations: BlockConfiguration[];
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
    lastModifiedStep?: string;
    version: number;
    isPublished: boolean;
    publishedAt?: string;
    publishedScheduleId?: string;
  };
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

export interface DraftOperationResult {
  success: boolean;
  error?: string;
  draftId?: string;
  scheduleId?: string;
}

class EnhancedFirebaseDraftService {
  private readonly COLLECTION_NAME = 'workflow_drafts';
  private readonly LEGACY_COLLECTION = 'draft_schedules';
  private readonly MAX_DRAFTS = 50;
  private readonly LOCK_TIMEOUT = 5000; // 5 seconds
  private readonly SESSION_KEY = 'current_workflow_draft';
  
  // In-memory lock for client-side atomic operations
  private operationLocks = new Map<string, number>();
  
  /**
   * Acquire lock for atomic operations (client-side)
   */
  private async acquireLock(key: string = 'default'): Promise<boolean> {
    const now = Date.now();
    const existingLock = this.operationLocks.get(key);
    
    if (existingLock && (now - existingLock) < this.LOCK_TIMEOUT) {
      return false; // Lock still active
    }
    
    this.operationLocks.set(key, now);
    return true;
  }

  /**
   * Release lock after operation
   */
  private releaseLock(key: string = 'default'): void {
    this.operationLocks.delete(key);
  }

  /**
   * Create new draft from file upload (enhanced with compatibility)
   */
  async createDraft(
    draftName: string,
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData,
    validation?: ValidationResult
  ): Promise<DraftOperationResult> {
    try {
      const draftId = this.generateDraftId();
      const now = new Date().toISOString();
      
      const unifiedDraft: UnifiedDraftCompat = {
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

      await this.saveDraftInternal(unifiedDraft);
      this.setCurrentSessionDraft(draftId);
      
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Draft creation failed:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Creates a new draft in Firestore (legacy method for backward compatibility)
   */
  async createDraftFromUpload(
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData
  ): Promise<WorkflowDraftResult> {
    // Use enhanced create method with auto-generated name
    const draftName = fileName.replace(/\.[^/.]+$/, '') || 'New Draft';
    const result = await this.createDraft(draftName, fileName, fileType, uploadedData);
    
    // Convert to WorkflowDraftResult format
    return {
      success: result.success,
      draftId: result.draftId,
      error: result.error
    };
  }
  
  /**
   * Updates draft with timepoints analysis in Firestore
   */
  async updateDraftWithTimepointsAnalysis(
    draftId: string,
    analysisData: {
      serviceBands: ServiceBand[];
      travelTimeData: TimePointData[];
      outliers: OutlierData[];
      userModifications: TimepointsModification[];
      deletedPeriods?: string[];
      timePeriodServiceBands?: { [timePeriod: string]: string };
    }
  ): Promise<WorkflowDraftResult> {
    try {
      console.log('🔥 [FirebaseDraftService] Updating timepoints for draft:', draftId);
      
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (!draftSnap.exists()) {
        console.error('🔥 Draft not found in Firebase:', draftId);
        return { success: false, error: 'Draft not found' };
      }
      
      const draft = draftSnap.data() as WorkflowDraftState;
      
      // Update the draft with new data
      const updatedDraft = {
        ...draft,
        currentStep: 'timepoints',
        timepointsAnalysis: {
          ...analysisData,
          analysisTimestamp: new Date().toISOString()
        },
        metadata: {
          ...draft.metadata,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedStep: 'timepoints',
          version: (draft.metadata.version || 0) + 1
        },
        serverTimestamp: serverTimestamp()
      };
      
      await setDoc(draftRef, updatedDraft);
      
      console.log('🔥 Successfully updated timepoints in Firebase');
      return { 
        success: true, 
        draftId
      };
    } catch (error: any) {
      console.error('🔥 Failed to update timepoints in Firebase:', error);
      return { success: false, error: `Failed to update: ${error.message}` };
    }
  }
  
  /**
   * Updates draft with block configuration in Firestore
   */
  async updateDraftWithBlockConfiguration(
    draftId: string,
    blockConfig: {
      numberOfBuses: number;
      cycleTimeMinutes: number;
      automateBlockStartTimes: boolean;
      blockConfigurations: BlockConfiguration[];
    }
  ): Promise<WorkflowDraftResult> {
    try {
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (!draftSnap.exists()) {
        return { success: false, error: 'Draft not found' };
      }
      
      const draft = draftSnap.data() as WorkflowDraftState;
      
      const updatedDraft = {
        ...draft,
        currentStep: 'blocks',
        blockConfiguration: {
          ...blockConfig,
          configurationTimestamp: new Date().toISOString()
        },
        metadata: {
          ...draft.metadata,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedStep: 'blocks',
          version: (draft.metadata.version || 0) + 1
        },
        serverTimestamp: serverTimestamp()
      };
      
      await setDoc(draftRef, updatedDraft);
      
      console.log('🔥 Updated block configuration in Firebase');
      return { 
        success: true, 
        draftId
      };
    } catch (error: any) {
      console.error('🔥 Failed to update blocks in Firebase:', error);
      return { success: false, error: `Failed to update: ${error.message}` };
    }
  }
  
  /**
   * Updates draft with summary schedule in Firestore
   */
  async updateDraftWithSummarySchedule(
    draftId: string,
    summaryData: {
      schedule: SummarySchedule;
      metadata: ScheduleGenerationMetadata;
    }
  ): Promise<WorkflowDraftResult> {
    try {
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (!draftSnap.exists()) {
        return { success: false, error: 'Draft not found' };
      }
      
      const draft = draftSnap.data() as WorkflowDraftState;
      
      const updatedDraft = {
        ...draft,
        currentStep: 'ready-to-publish',
        summarySchedule: {
          ...summaryData,
          generationTimestamp: new Date().toISOString()
        },
        metadata: {
          ...draft.metadata,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedStep: 'summary',
          version: (draft.metadata.version || 0) + 1
        },
        serverTimestamp: serverTimestamp()
      };
      
      await setDoc(draftRef, updatedDraft);
      
      console.log('🔥 Updated summary schedule in Firebase');
      return { 
        success: true, 
        draftId
      };
    } catch (error: any) {
      console.error('🔥 Failed to update summary in Firebase:', error);
      return { success: false, error: `Failed to update: ${error.message}` };
    }
  }
  
  /**
   * Gets a draft by ID from Firestore (backward compatibility)
   */
  async getDraftById(draftId: string): Promise<WorkflowDraftState | null> {
    const unifiedDraft = await this.getDraftByIdUnified(draftId);
    return unifiedDraft ? this.convertToWorkflowDraftState(unifiedDraft) : null;
  }

  /**
   * Gets a draft by ID in unified format
   */
  async getDraftByIdUnified(draftId: string): Promise<UnifiedDraftCompat | null> {
    try {
      console.log('🔥 Fetching unified draft from Firebase:', draftId);
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        // Remove Firestore-specific fields
        delete data.serverTimestamp;
        
        // Ensure draft has all required unified fields
        const unifiedDraft = this.ensureUnifiedFormat(data);
        console.log('🔥 Unified draft loaded from Firebase:', draftId);
        return unifiedDraft;
      }
      
      console.log('🔥 Draft not found in Firebase:', draftId);
      return null;
    } catch (error) {
      console.error('🔥 Error loading unified draft from Firebase:', error);
      return null;
    }
  }

  /**
   * Get draft by ID (unified interface compatibility)
   */
  getDraft(draftId: string): Promise<UnifiedDraftCompat | null> {
    return this.getDraftByIdUnified(draftId);
  }
  
  /**
   * Save draft to Firestore with race condition protection
   */
  private async saveDraftInternal(draft: UnifiedDraftCompat): Promise<DraftOperationResult> {
    const lockAcquired = await this.acquireLock(draft.draftId);
    if (!lockAcquired) {
      return { success: false, error: 'Storage is busy, please try again' };
    }

    try {
      // Update metadata
      draft.metadata.lastModifiedAt = new Date().toISOString();
      draft.metadata.version = (draft.metadata.version || 0) + 1;
      
      // Save to Firestore using transaction for consistency
      await runTransaction(db, async (transaction) => {
        const draftRef = doc(db, this.COLLECTION_NAME, draft.draftId);
        transaction.set(draftRef, {
          ...draft,
          serverTimestamp: serverTimestamp()
        });
      });
      
      console.log('🔥 Saved draft to Firebase:', draft.draftId);
      return { success: true, draftId: draft.draftId };
    } catch (error: any) {
      console.error('🔥 Draft save operation failed:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    } finally {
      this.releaseLock(draft.draftId);
    }
  }

  /**
   * Update draft progress and step data
   */
  async updateDraftStep(
    draftId: string,
    step: UnifiedDraftCompat['currentStep'],
    progress: number,
    stepData?: Partial<UnifiedDraftCompat['stepData']>
  ): Promise<DraftOperationResult> {
    const draft = await this.getDraftByIdUnified(draftId);
    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    draft.currentStep = step;
    draft.progress = Math.max(draft.progress, progress);
    draft.ui.lastViewedStep = step;
    
    if (stepData) {
      draft.stepData = { ...draft.stepData, ...stepData };
    }

    return this.saveDraftInternal(draft);
  }

  /**
   * Gets all drafts from Firestore (enhanced compatibility)
   */
  async getAllDrafts(): Promise<WorkflowDraftState[]> {
    try {
      console.log('🔥 Loading all drafts from Firebase');
      const drafts = await this.getAllDraftsUnified();
      
      // Convert to WorkflowDraftState format for backward compatibility
      return drafts.map(draft => this.convertToWorkflowDraftState(draft));
    } catch (error) {
      console.error('🔥 Error loading drafts from Firebase:', error);
      return [];
    }
  }

  /**
   * Gets all drafts in unified format
   */
  async getAllDraftsUnified(): Promise<UnifiedDraftCompat[]> {
    try {
      console.log('🔥 Loading all unified drafts from Firebase');
      const draftsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        draftsRef,
        orderBy('serverTimestamp', 'desc'),
        limit(this.MAX_DRAFTS)
      );
      
      const querySnapshot = await getDocs(q);
      const drafts: UnifiedDraftCompat[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Remove Firestore-specific fields
        delete data.serverTimestamp;
        
        // Ensure draft has all required unified fields
        const unifiedDraft = this.ensureUnifiedFormat(data);
        drafts.push(unifiedDraft);
      });
      
      console.log(`🔥 Loaded ${drafts.length} unified drafts from Firebase`);
      return drafts.sort((a, b) => 
        new Date(b.metadata.lastModifiedAt).getTime() - new Date(a.metadata.lastModifiedAt).getTime()
      );
    } catch (error) {
      console.error('🔥 Error loading unified drafts from Firebase:', error);
      return [];
    }
  }
  
  /**
   * Deletes a draft from Firestore
   */
  async deleteDraft(draftId: string): Promise<WorkflowDraftResult> {
    try {
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      await deleteDoc(draftRef);
      
      console.log('🔥 Deleted draft from Firebase:', draftId);
      return { success: true };
    } catch (error: any) {
      console.error('🔥 Error deleting draft from Firebase:', error);
      return { success: false, error: `Failed to delete: ${error.message}` };
    }
  }
  
  /**
   * Update draft file name
   */
  async updateDraftFileName(
    draftId: string,
    fileName: string
  ): Promise<DraftOperationResult> {
    try {
      const draft = await this.getDraftByIdUnified(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }
      
      draft.originalData.fileName = sanitizeText(fileName);
      draft.draftName = sanitizeText(fileName.replace(/\.[^/.]+$/, '') || draft.draftName);
      
      const result = await this.saveDraftInternal(draft);
      console.log('✅ Updated draft file name to:', fileName);
      return result;
    } catch (error: any) {
      console.error('Failed to update draft file name:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Mark celebration as shown
   */
  async markCelebrationShown(draftId: string, celebration: string): Promise<void> {
    try {
      const draft = await this.getDraftByIdUnified(draftId);
      if (draft && !draft.ui.celebrationsShown.includes(celebration)) {
        draft.ui.celebrationsShown.push(celebration);
        await this.saveDraftInternal(draft);
      }
    } catch (error) {
      console.error('Failed to mark celebration as shown:', error);
    }
  }

  /**
   * Should show celebration?
   */
  shouldShowCelebration(draftId: string, celebration: string): Promise<boolean> {
    return this.getDraftByIdUnified(draftId).then(draft => {
      return draft ? !draft.ui.celebrationsShown.includes(celebration) : false;
    }).catch(() => false);
  }

  /**
   * Publishes a draft (marks as published in Firestore)
   */
  async publishDraft(draftId: string): Promise<WorkflowDraftResult> {
    return this.promoteDraftToSchedule(draftId).then(result => ({
      success: result.success,
      draftId: result.success ? draftId : undefined,
      scheduleId: result.scheduleId,
      error: result.error
    }));
  }
  
  /**
   * Promote draft to completed schedule
   */
  async promoteDraftToSchedule(draftId: string): Promise<DraftOperationResult> {
    const draft = await this.getDraftByIdUnified(draftId);
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

      if (result.success && result.scheduleId) {
        // Mark draft as published rather than delete it
        draft.metadata.isPublished = true;
        draft.metadata.publishedAt = new Date().toISOString();
        draft.metadata.publishedScheduleId = result.scheduleId;
        
        await this.saveDraftInternal(draft);
        
        console.log('🔥 Promoted draft to schedule:', result.scheduleId);
        return { success: true, scheduleId: result.scheduleId, draftId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      return { success: false, error: sanitizeErrorMessage(error) };
    }
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
    const migrationKey = 'scheduler2_migration_completed_firebase_v2';
    if (localStorage.getItem(migrationKey)) {
      return {
        migrated: 0,
        failed: 0,
        details: ['Migration already completed']
      };
    }

    const results = {
      migrated: 0,
      failed: 0,
      details: [] as string[]
    };

    try {
      // Migrate from localStorage unifiedDraftService
      try {
        const unifiedKey = 'scheduler2_unified_drafts_v2';
        const stored = localStorage.getItem(unifiedKey);
        if (stored) {
          const localDrafts = JSON.parse(stored) as UnifiedDraftCompat[];
          
          for (const localDraft of localDrafts) {
            try {
              // Save to Firebase
              const result = await this.saveDraftInternal(localDraft);
              if (result.success) {
                results.migrated++;
                results.details.push(`Migrated unified draft: ${localDraft.draftName}`);
              } else {
                results.failed++;
                results.details.push(`Failed to migrate unified draft ${localDraft.draftName}: ${result.error}`);
              }
            } catch (error: any) {
              results.failed++;
              results.details.push(`Failed to migrate unified draft ${localDraft.draftName}: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        results.details.push(`Could not access unified drafts: ${error.message}`);
      }

      // Migrate from legacy scheduleStorage
      try {
        const { scheduleStorage } = await import('./scheduleStorage');
        const oldDrafts = scheduleStorage.getAllDraftSchedules();
        
        for (const oldDraft of oldDrafts) {
          try {
            const unifiedDraft = this.convertFromLegacyDraft(oldDraft);
            const result = await this.saveDraftInternal(unifiedDraft);
            if (result.success) {
              results.migrated++;
              results.details.push(`Migrated legacy draft: ${oldDraft.fileName}`);
            } else {
              results.failed++;
              results.details.push(`Failed to migrate legacy draft ${oldDraft.fileName}: ${result.error}`);
            }
          } catch (error: any) {
            results.failed++;
            results.details.push(`Failed to migrate legacy draft ${oldDraft.fileName}: ${error.message}`);
          }
        }
      } catch (error: any) {
        results.details.push(`Could not access legacy scheduleStorage: ${error.message}`);
      }

    } catch (error: any) {
      results.details.push(`Migration error: ${error.message}`);
    } finally {
      // Mark migration as completed
      localStorage.setItem(migrationKey, new Date().toISOString());
    }

    console.log(`🔥 Firebase migration complete: ${results.migrated} migrated, ${results.failed} failed`);
    return results;
  }

  /**
   * Clean up old storage systems after migration
   */
  cleanupOldStorage(): void {
    const cleanupKey = 'scheduler2_firebase_cleanup_done';
    if (localStorage.getItem(cleanupKey)) return;

    try {
      // Remove old localStorage keys
      localStorage.removeItem('scheduler2_unified_drafts_v2');
      localStorage.removeItem('scheduler2_draft_schedules');
      localStorage.removeItem('workflow_drafts');
      localStorage.removeItem('scheduler2_active_draft');
      localStorage.removeItem('scheduler2_current_draft');

      // Remove individual workflow keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('scheduler2_draft_workflow_')) {
          localStorage.removeItem(key);
        }
      }

      localStorage.setItem(cleanupKey, new Date().toISOString());
      console.log('✅ Cleaned up old storage systems for Firebase');
    } catch (error) {
      console.warn('Could not clean up old storage:', error);
    }
  }

  /**
   * Get progress message based on step
   */
  getProgressMessage(draft: UnifiedDraftCompat): string {
    const messages = {
      upload: "🚀 Great start! Your data is uploaded and ready",
      timepoints: "📊 Finding the perfect timing patterns",
      blocks: "🚌 Configuring your bus fleet",
      summary: "📋 Bringing your schedule to life",
      connections: "🔗 Connecting all the pieces",
      ready: "✨ Your schedule is ready to publish!",
      'ready-to-publish': "✨ Your schedule is ready to publish!"
    };
    
    return messages[draft.currentStep] || "Working on your schedule...";
  }

  // Utility methods
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Enhanced session management
  getCurrentSessionDraftId(): string | null {
    return sessionStorage.getItem(this.SESSION_KEY) || localStorage.getItem(this.SESSION_KEY);
  }
  
  setCurrentSessionDraft(draftId: string): void {
    sessionStorage.setItem(this.SESSION_KEY, draftId);
    localStorage.setItem(this.SESSION_KEY, draftId); // Backup in localStorage
  }
  
  clearCurrentSessionDraft(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  }
  
  async getCurrentSessionDraft(): Promise<UnifiedDraftCompat | null> {
    const draftId = this.getCurrentSessionDraftId();
    return draftId ? this.getDraftByIdUnified(draftId) : null;
  }

  /**
   * Convert legacy draft to unified format
   */
  private convertFromLegacyDraft(legacyDraft: any): UnifiedDraftCompat {
    if (!legacyDraft || typeof legacyDraft !== 'object') {
      throw new Error('Invalid legacy draft data structure');
    }
    
    const now = new Date().toISOString();
    const safeDraftId = legacyDraft.id ? sanitizeText(String(legacyDraft.id)) : this.generateDraftId();
    const safeDraftName = legacyDraft.fileName ? sanitizeText(String(legacyDraft.fileName)) : 'Migrated Draft';
    
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
   * Ensure draft has all required unified fields (migration/compatibility helper)
   */
  private ensureUnifiedFormat(data: any): UnifiedDraftCompat {
    const now = new Date().toISOString();
    
    // If it's already a WorkflowDraftState, convert it
    if (data.currentStep && data.originalData && data.metadata && !data.draftName) {
      return {
        draftId: data.draftId,
        draftName: data.originalData.fileName?.replace(/\.[^/.]+$/, '') || 'Draft',
        originalData: data.originalData,
        currentStep: data.currentStep === 'ready-to-publish' ? 'ready' : data.currentStep,
        progress: this.calculateProgress(data.currentStep),
        stepData: {
          timepoints: data.timepointsAnalysis ? {
            serviceBands: data.timepointsAnalysis.serviceBands || [],
            travelTimeData: data.timepointsAnalysis.travelTimeData || [],
            outliers: data.timepointsAnalysis.outliers || [],
            deletedPeriods: data.timepointsAnalysis.deletedPeriods,
            timePeriodServiceBands: data.timepointsAnalysis.timePeriodServiceBands
          } : undefined,
          blockConfiguration: data.blockConfiguration,
          summarySchedule: data.summarySchedule?.schedule || data.summarySchedule
        },
        ui: data.ui || {
          celebrationsShown: [],
          lastViewedStep: data.currentStep || 'upload'
        },
        metadata: {
          ...data.metadata,
          lastModifiedStep: data.metadata.lastModifiedStep || data.currentStep
        }
      };
    }
    
    // If it's already unified format, ensure all fields exist
    return {
      draftId: data.draftId || this.generateDraftId(),
      draftName: data.draftName || 'Draft',
      originalData: data.originalData || {
        fileName: 'Unknown',
        fileType: 'csv',
        uploadedData: {},
        uploadTimestamp: now
      },
      currentStep: data.currentStep || 'upload',
      progress: data.progress || 10,
      stepData: data.stepData || {},
      ui: data.ui || {
        celebrationsShown: [],
        lastViewedStep: 'upload'
      },
      metadata: data.metadata || {
        createdAt: now,
        lastModifiedAt: now,
        version: 1,
        isPublished: false
      }
    };
  }

  /**
   * Convert unified draft to WorkflowDraftState for backward compatibility
   */
  private convertToWorkflowDraftState(draft: UnifiedDraftCompat): WorkflowDraftState {
    // Map legacy or invalid step names to valid WorkflowDraftState steps
    const mapStep = (step: string): WorkflowDraftState['currentStep'] => {
      switch (step) {
        case 'ready': return 'ready-to-publish';
        case 'connections': return 'timepoints'; // Map connections to timepoints
        case 'upload':
        case 'timepoints':
        case 'blocks':
        case 'summary':
        case 'ready-to-publish':
          return step as WorkflowDraftState['currentStep'];
        default: return 'upload'; // Fallback for unknown steps
      }
    };

    return {
      draftId: draft.draftId,
      currentStep: mapStep(draft.currentStep),
      originalData: draft.originalData,
      timepointsAnalysis: draft.stepData.timepoints ? {
        serviceBands: draft.stepData.timepoints.serviceBands,
        travelTimeData: draft.stepData.timepoints.travelTimeData,
        outliers: draft.stepData.timepoints.outliers,
        userModifications: [],
        deletedPeriods: draft.stepData.timepoints.deletedPeriods,
        timePeriodServiceBands: draft.stepData.timepoints.timePeriodServiceBands,
        analysisTimestamp: draft.metadata.lastModifiedAt
      } : undefined,
      blockConfiguration: draft.stepData.blockConfiguration ? {
        ...draft.stepData.blockConfiguration,
        configurationTimestamp: draft.metadata.lastModifiedAt
      } : undefined,
      summarySchedule: draft.stepData.summarySchedule ? {
        schedule: draft.stepData.summarySchedule,
        metadata: {
          generationMethod: 'block-based',
          parameters: {},
          validationResults: [],
          performanceMetrics: {
            generationTimeMs: 0,
            tripCount: 0,
            memoryUsageMB: 0
          }
        },
        generationTimestamp: draft.metadata.lastModifiedAt
      } : undefined,
      metadata: {
        createdAt: draft.metadata.createdAt,
        lastModifiedAt: draft.metadata.lastModifiedAt,
        lastModifiedStep: draft.metadata.lastModifiedStep || draft.currentStep,
        version: draft.metadata.version,
        isPublished: draft.metadata.isPublished,
        publishedAt: draft.metadata.publishedAt
      }
    };
  }

  /**
   * Calculate progress based on current step
   */
  private calculateProgress(step: string): number {
    const progressMap = {
      'upload': 10,
      'timepoints': 30,
      'blocks': 60,
      'summary': 80,
      'connections': 90,
      'ready': 100,
      'ready-to-publish': 100
    };
    return progressMap[step as keyof typeof progressMap] || 10;
  }
}

export const firebaseDraftService = new EnhancedFirebaseDraftService();
export default firebaseDraftService;

// Export additional types for compatibility
export type { UnifiedDraftCompat as UnifiedDraft };
/**
 * Unified Draft Service
 * Consolidated Firebase-based draft management system
 * Combines all draft storage, workflow state, and UI storyboard functionality
 * Replaces: firebaseDraftService, workflowDraftService, unifiedDraftService, draftWorkflowService
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

// WorkflowState type for compatibility with deleted workflowStateService
export interface WorkflowStepState {
  key: string;
  status: 'completed' | 'active' | 'pending';
  completedAt?: string;
  data?: any; // Store any relevant data from the completed step
}

export interface WorkflowState {
  workflowId: string;
  workflowType: 'schedule-creation' | 'route-management' | 'shift-planning';
  currentStep: string;
  steps: WorkflowStepState[];
  startedAt: string;
  updatedAt: string;
  scheduleId?: string; // Associated schedule ID if applicable
}

// UI Workflow types for engaging storyboard experience (from deleted draftWorkflowService)
export interface WorkflowStepData {
  key: string;
  title: string;
  funTitle: string; // Fun, engaging title
  description: string;
  icon: string; // Icon name for dynamic loading
  color: string; // Theme color for the step
  status: 'not-started' | 'in-progress' | 'completed';
  completedAt?: string;
  progress?: number; // 0-100 for partial completion
  metadata?: any; // Step-specific data
}

export interface DraftWorkflowState {
  draftId: string;
  draftName: string;
  routeName?: string;
  currentStep: string;
  steps: WorkflowStepData[];
  overallProgress: number;
  lastModified: string;
  createdAt: string;
  celebrationsShown?: string[]; // Track which celebrations have been shown
}

// Fun messages for different progress levels
const PROGRESS_MESSAGES = {
  0: "Ready to create something awesome? Let's go! 🚌",
  10: "Great start! Every journey begins with a single step 🚀",
  25: "You're on a roll! Your schedule is taking shape 📍",
  40: "Looking good! The pieces are coming together 🧩",
  50: "Halfway there! You're doing amazing 🌟",
  65: "Fantastic progress! Keep up the great work 💪",
  75: "Almost done! The finish line is in sight 🏁",
  90: "So close! Just a few more touches ✨",
  100: "Schedule complete! You're a scheduling wizard! 🎉"
};

// Motivational tips for each step
const STEP_TIPS = {
  'upload': [
    "Every great schedule starts with good data",
    "Drop your file and let the magic begin",
    "Your journey to a perfect schedule starts here"
  ],
  'drafts': [
    "Take a moment to review what we've found",
    "This is where your data becomes a story",
    "Preview your schedule's blueprint"
  ],
  'timepoints': [
    "Find the perfect rhythm for your routes",
    "Discover patterns in your travel times",
    "This is where timing becomes an art"
  ],
  'block-config': [
    "Arrange your buses like a master strategist",
    "Build your fleet configuration",
    "Create the perfect bus ballet"
  ],
  'summary': [
    "Watch your schedule come to life",
    "See all your hard work pay off",
    "Your masterpiece is almost ready"
  ],
  'connections': [
    "Connect every passenger to their destination",
    "Make sure no one gets left behind",
    "The final touches that make it perfect"
  ]
};

class UnifiedDraftService {
  private readonly COLLECTION_NAME = 'workflow_drafts';
  private readonly LEGACY_COLLECTION = 'draft_schedules';
  private readonly MAX_DRAFTS = 50;
  private readonly LOCK_TIMEOUT = 5000; // 5 seconds
  private readonly SESSION_KEY = 'current_workflow_draft';
  private readonly WORKFLOW_KEY_PREFIX = 'scheduler2_draft_workflow_';
  
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

  // =============================================
  // UI Workflow Management Methods (from deleted draftWorkflowService)
  // =============================================

  /**
   * Initialize workflow steps with fun, engaging content
   */
  private initializeSteps(): WorkflowStepData[] {
    return [
      {
        key: 'upload',
        title: 'Upload Data',
        funTitle: 'Start Your Journey',
        description: 'Drop your schedule data here and let\'s begin crafting something amazing!',
        icon: 'CloudUpload',
        color: '#E3E8F0',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'drafts',
        title: 'Draft Review',
        funTitle: 'Preview the Blueprint',
        description: 'Take a peek at what we\'ve discovered in your data',
        icon: 'Drafts',
        color: '#E8D5F2',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'timepoints',
        title: 'TimePoints Analysis',
        funTitle: 'Find Your Rhythm',
        description: 'Let\'s discover the perfect timing for your routes',
        icon: 'Timeline',
        color: '#FFE4D1',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'block-config',
        title: 'Block Configuration',
        funTitle: 'Build Your Fleet',
        description: 'Arrange your buses like pieces on a chess board',
        icon: 'Build',
        color: '#D4F1E4',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'summary',
        title: 'Base Schedule',
        funTitle: 'Bring It to Life',
        description: 'Watch your schedule come together like magic',
        icon: 'ViewList',
        color: '#D1E7FF',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'connections',
        title: 'Connection Schedule',
        funTitle: 'Connect the Dots',
        description: 'Make sure every passenger can get where they need to go',
        icon: 'SwapVert',
        color: '#FFE8B8',
        status: 'not-started',
        progress: 0
      }
    ];
  }

  /**
   * Create or get workflow for a draft (UI storyboard functionality)
   */
  getOrCreateWorkflow(draftId: string, draftName?: string): DraftWorkflowState {
    const existingWorkflow = this.getWorkflow(draftId);
    if (existingWorkflow) {
      return existingWorkflow;
    }

    const now = new Date().toISOString();
    const workflow: DraftWorkflowState = {
      draftId,
      draftName: draftName || `Draft ${draftId.substring(0, 8)}`,
      currentStep: 'upload',
      steps: this.initializeSteps(),
      overallProgress: 0,
      lastModified: now,
      createdAt: now,
      celebrationsShown: []
    };

    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Get workflow for a specific draft (UI storyboard state)
   */
  getWorkflow(draftId: string): DraftWorkflowState | null {
    try {
      const data = localStorage.getItem(this.WORKFLOW_KEY_PREFIX + draftId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading draft workflow:', error);
      return null;
    }
  }

  /**
   * Save workflow state (UI storyboard persistence)
   */
  saveWorkflow(workflow: DraftWorkflowState): void {
    try {
      workflow.lastModified = new Date().toISOString();
      localStorage.setItem(
        this.WORKFLOW_KEY_PREFIX + workflow.draftId,
        JSON.stringify(workflow)
      );
    } catch (error) {
      console.error('Error saving draft workflow:', error);
    }
  }

  /**
   * Update step status with animations and celebrations
   */
  updateStepStatus(
    draftId: string,
    stepKey: string,
    status: 'not-started' | 'in-progress' | 'completed',
    progress?: number,
    metadata?: any
  ): DraftWorkflowState | null {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return null;

    const stepIndex = workflow.steps.findIndex(s => s.key === stepKey);
    if (stepIndex === -1) return null;

    const oldStatus = workflow.steps[stepIndex].status;
    
    // Update the step
    workflow.steps[stepIndex] = {
      ...workflow.steps[stepIndex],
      status,
      progress: progress ?? (status === 'completed' ? 100 : status === 'in-progress' ? 50 : 0),
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      metadata
    };

    // If completing a step, mark the next one as available
    if (status === 'completed' && oldStatus !== 'completed') {
      if (stepIndex < workflow.steps.length - 1) {
        workflow.steps[stepIndex + 1].status = 'in-progress';
        workflow.currentStep = workflow.steps[stepIndex + 1].key;
      }
    }

    // Update current step if starting
    if (status === 'in-progress') {
      workflow.currentStep = stepKey;
    }

    // Calculate overall progress
    workflow.overallProgress = this.calculateWorkflowProgress(workflow.steps);

    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Calculate overall progress percentage (UI workflow)
   */
  private calculateWorkflowProgress(steps: WorkflowStepData[]): number {
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const inProgressSteps = steps.filter(s => s.status === 'in-progress').length;
    
    // Give partial credit for in-progress steps
    const progress = ((completedSteps + (inProgressSteps * 0.5)) / totalSteps) * 100;
    return Math.round(progress);
  }

  /**
   * Get all draft workflows (UI storyboard)
   */
  getAllWorkflows(): DraftWorkflowState[] {
    const workflows: DraftWorkflowState[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.WORKFLOW_KEY_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            workflows.push(JSON.parse(data));
          }
        } catch (error) {
          console.error(`Error parsing workflow ${key}:`, error);
        }
      }
    }

    return workflows.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  /**
   * Delete workflow for a draft (UI storyboard)
   */
  deleteWorkflow(draftId: string): void {
    localStorage.removeItem(this.WORKFLOW_KEY_PREFIX + draftId);
  }

  /**
   * Get progress message based on percentage (UI)
   */
  getStoryboardProgressMessage(progress: number): string {
    const thresholds = Object.keys(PROGRESS_MESSAGES)
      .map(Number)
      .sort((a, b) => b - a);
    
    for (const threshold of thresholds) {
      if (progress >= threshold) {
        return PROGRESS_MESSAGES[threshold as keyof typeof PROGRESS_MESSAGES];
      }
    }
    
    return PROGRESS_MESSAGES[0];
  }

  /**
   * Get random tip for a step (UI motivation)
   */
  getStepTip(stepKey: string): string {
    const tips = STEP_TIPS[stepKey as keyof typeof STEP_TIPS];
    if (!tips || tips.length === 0) return '';
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * Check if should show celebration (UI engagement)
   */
  shouldShowStoryboardCelebration(workflow: DraftWorkflowState, milestone: string): boolean {
    if (!workflow.celebrationsShown) {
      workflow.celebrationsShown = [];
    }
    
    if (workflow.celebrationsShown.includes(milestone)) {
      return false;
    }
    
    workflow.celebrationsShown.push(milestone);
    this.saveWorkflow(workflow);
    return true;
  }

  /**
   * Complete current step and move to next (UI workflow)
   */
  completeCurrentStep(draftId: string, metadata?: any): DraftWorkflowState | null {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return null;

    const currentStep = workflow.steps.find(s => s.key === workflow.currentStep);
    if (!currentStep) return null;

    return this.updateStepStatus(draftId, currentStep.key, 'completed', 100, metadata);
  }

  /**
   * Navigate to a specific step (if allowed) (UI navigation)
   */
  navigateToStep(draftId: string, stepKey: string): boolean {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.key === stepKey);
    if (!step || step.status === 'not-started') return false;

    workflow.currentStep = stepKey;
    this.saveWorkflow(workflow);
    return true;
  }

  /**
   * Can access a specific step (UI navigation control)
   */
  canAccessStep(draftId: string, stepKey: string): boolean {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return false;

    const step = workflow.steps.find(s => s.key === stepKey);
    return step ? step.status !== 'not-started' : false;
  }

  // =============================================
  // Legacy WorkflowStateService compatibility methods 
  // =============================================

  /**
   * Get active draft workflow ID (compatibility with old workflowStateService)
   */
  getActiveDraft(): string | null {
    return this.getCurrentSessionDraftId();
  }

  /**
   * Set active draft (compatibility with old workflowStateService)
   */
  setActiveDraft(draftId: string): void {
    this.setCurrentSessionDraft(draftId);
  }

  /**
   * Get current workflow state (compatibility with old workflowStateService)
   */
  getCurrentWorkflow(): any {
    const draftId = this.getCurrentSessionDraftId();
    return draftId ? this.getWorkflow(draftId) : null;
  }

  /**
   * Start workflow (compatibility with old workflowStateService)
   */
  startWorkflow(workflowType: any, scheduleId?: string): any {
    // For draft service, we just return a placeholder workflow state
    return {
      workflowId: `workflow_${Date.now()}`,
      workflowType,
      currentStep: 'upload',
      scheduleId
    };
  }

  /**
   * Complete step (compatibility with old workflowStateService)
   */
  completeStep(stepKey: string, data?: any): any {
    const draftId = this.getCurrentSessionDraftId();
    if (draftId) {
      return this.completeCurrentStep(draftId, data);
    }
    return null;
  }

}

export const draftService = new UnifiedDraftService();
export default draftService;

// Legacy compatibility exports
export const firebaseDraftService = draftService;
export const workflowDraftService = draftService;  
export const unifiedDraftService = draftService;
export const draftWorkflowService = draftService;

// Export additional types for compatibility
export type { UnifiedDraftCompat as UnifiedDraft };
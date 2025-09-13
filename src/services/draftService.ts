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
  orderBy,
  limit,
  serverTimestamp,
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
import { emit } from './workspaceEventBus';
import { offlineQueue } from './offlineQueue';

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
  currentStep: 'upload' | 'timepoints' | 'blocks' | 'summary' | 'ready-to-publish';
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
    lastConflictResolution?: string;
    conflictResolutionFailed?: boolean;
    syncStatus?: 'synced' | 'pending' | 'conflict' | 'error';
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
    .replace(/file:\/\/.*?[/\\]/g, '') // Remove file paths
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
  stepData?: any; // Store step-specific data synced from Firebase
}

// Progress levels
const PROGRESS_MESSAGES = {
  0: "",
  10: "",
  25: "",
  40: "",
  50: "",
  65: "",
  75: "",
  90: "",
  100: ""
};

// Motivational tips for each step
const STEP_TIPS = {
  'upload': [],
  'drafts': [],
  'timepoints': [],
  'block-config': [],
  'summary': [],
  'connections': []
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
  
  // Cache for draft data to reduce Firebase calls
  private draftCache = new Map<string, { draft: UnifiedDraftCompat, timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  
  // Online/offline state tracking
  private isOnline: boolean = navigator.onLine;
  private onlineListeners: Set<() => void> = new Set();
  
  constructor() {
    this.initializeOnlineListeners();
  }
  
  /**
   * Initialize online/offline event listeners
   */
  private initializeOnlineListeners(): void {
    const handleOnline = () => {
      this.isOnline = true;
      console.log('🌐 DraftService: Connection restored - will retry pending operations');
      this.notifyOnlineListeners();
      // Let the offline queue handle the retry logic
    };
    
    const handleOffline = () => {
      this.isOnline = false;
      console.log('📵 DraftService: Connection lost - operations will be queued');
      this.notifyOnlineListeners();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Store references for cleanup if needed
    (this as any)._handleOnline = handleOnline;
    (this as any)._handleOffline = handleOffline;
  }
  
  /**
   * Notify listeners of online state change
   */
  private notifyOnlineListeners(): void {
    this.onlineListeners.forEach(listener => listener());
  }
  
  /**
   * Subscribe to online/offline state changes
   */
  subscribeToOnlineStatus(listener: () => void): () => void {
    this.onlineListeners.add(listener);
    return () => this.onlineListeners.delete(listener);
  }
  
  /**
   * Get current online status
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }
  
  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    const entries = Array.from(this.draftCache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.draftCache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache for specific draft
   */
  private invalidateCache(draftId: string): void {
    this.draftCache.delete(draftId);
  }

  /**
   * Get draft from cache if valid
   */
  private getCachedDraft(draftId: string): UnifiedDraftCompat | null {
    this.clearExpiredCache();
    const cached = this.draftCache.get(draftId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.draft;
    }
    return null;
  }

  /**
   * Set draft in cache
   */
  private setCachedDraft(draftId: string, draft: UnifiedDraftCompat): void {
    this.draftCache.set(draftId, { draft, timestamp: Date.now() });
  }

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
   * Serialize data for Firebase (handles nested arrays and undefined values)
   */
  private serializeForFirebase(data: any): any {
    if (data === null || data === undefined) {
      return null; // Firebase can handle null, but not undefined
    }
    
    if (Array.isArray(data)) {
      // Check if this array contains nested arrays that need conversion
      const hasNestedArrays = data.some(item => Array.isArray(item));
      
      if (hasNestedArrays) {
        // Only convert to indexed format if there are nested arrays
        return data.map((item, index) => ({
          _index: index,
          _value: this.serializeForFirebase(item)
        }));
      } else {
        // Simple arrays (strings, numbers, objects) can stay as arrays
        return data.map(item => this.serializeForFirebase(item));
      }
    }
    
    if (typeof data === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) { // Omit undefined values completely
          serialized[key] = this.serializeForFirebase(value);
        }
      }
      return serialized;
    }
    
    return data; // Primitive values are fine as-is
  }

  /**
   * Deserialize data from Firebase (reconstructs nested arrays)
   */
  private deserializeFromFirebase(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data) && data.length > 0 && data[0]?._index !== undefined) {
      // Reconstruct nested arrays
      return data
        .sort((a, b) => a._index - b._index)
        .map(item => this.deserializeFromFirebase(item._value));
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.deserializeFromFirebase(item));
    }
    
    if (typeof data === 'object') {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        deserialized[key] = this.deserializeFromFirebase(value);
      }
      return deserialized;
    }
    
    return data;
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
      
      // Create the draft structure with proper handling of undefined values
      const originalData: any = {
        fileName: sanitizeText(fileName),
        fileType,
        uploadedData: this.serializeForFirebase(uploadedData),
        uploadTimestamp: now
      };
      
      // Only include validation if it exists and is not null/undefined
      if (validation && (validation.isValid !== undefined || validation.errors?.length || validation.warnings?.length)) {
        originalData.validation = validation;
      }
      
      const unifiedDraft: UnifiedDraftCompat = {
        draftId,
        draftName: sanitizeText(draftName),
        originalData,
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
      
      // Mark upload step as completed in workflow progress
      this.updateStepStatus(draftId, 'upload', 'completed', 100, {
        uploadCompleted: true,
        fileName: fileName,
        fileType: fileType,
        dataSize: uploadedData ? Object.keys(uploadedData).length : 0
      });
      
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
      
      // Serialize for Firebase compatibility (removes undefined values and handles nested arrays)
      const serializedDraft = this.serializeForFirebase(updatedDraft);
      await setDoc(draftRef, serializedDraft);
      
      // Mark timepoints step as completed in workflow progress
      this.updateStepStatus(draftId, 'timepoints', 'completed', 100, {
        analysisCompleted: true,
        serviceBandsCount: analysisData.serviceBands?.length || 0,
        travelTimeDataCount: analysisData.travelTimeData?.length || 0
      });
      
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
      
      // Serialize for Firebase compatibility (removes undefined values and handles nested arrays)
      const serializedDraft = this.serializeForFirebase(updatedDraft);
      await setDoc(draftRef, serializedDraft);
      
      // Mark blocks step as completed in workflow progress
      this.updateStepStatus(draftId, 'blocks', 'completed', 100, {
        configurationCompleted: true,
        numberOfBuses: blockConfig.numberOfBuses,
        cycleTimeMinutes: blockConfig.cycleTimeMinutes,
        blockCount: blockConfig.blockConfigurations?.length || 0
      });
      
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
      
      // Serialize for Firebase compatibility (removes undefined values and handles nested arrays)
      const serializedDraft = this.serializeForFirebase(updatedDraft);
      await setDoc(draftRef, serializedDraft);
      
      // Mark summary step as completed in workflow progress
      this.updateStepStatus(draftId, 'summary', 'completed', 100, {
        scheduleGenerated: true,
        tripCount: summaryData.metadata?.performanceMetrics?.tripCount || 0,
        generationTimeMs: summaryData.metadata?.performanceMetrics?.generationTimeMs || 0
      });
      
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
   * Load draft with full state restoration data
   * This method loads everything needed to restore the user to exactly where they left off
   */
  async loadDraftWithFullState(draftId: string): Promise<{
    draft: UnifiedDraftCompat;
    restorationData: {
      currentStep: string;
      progress: number;
      fromDraft: boolean;
      draftId: string;
      // TimePoints data
      serviceBands?: any[];
      travelTimeData?: any[];
      outliers?: any[];
      deletedPeriods?: string[];
      timePeriodServiceBands?: { [timePeriod: string]: string };
      // Block Configuration data
      numberOfBuses?: number;
      cycleTimeMinutes?: number;
      automateBlockStartTimes?: boolean;
      blockConfigurations?: any[];
      // Summary Schedule data
      summarySchedule?: any;
      trips?: any[];
      // Original upload data for context
      uploadedData?: any;
      fileName?: string;
    };
  } | null> {
    try {
      console.log('📖 Loading draft with full state restoration:', draftId);
      
      // Load the draft from Firebase first, falls back to localStorage
      const draft = await this.getDraftByIdUnified(draftId);
      if (!draft) {
        console.error('Draft not found:', draftId);
        return null;
      }
      
      // Also load the workflow state for additional context
      const workflow = await this.loadWorkflowFromCloud(draftId);
      
      // Build comprehensive restoration data
      const restorationData: any = {
        currentStep: draft.currentStep,
        progress: draft.progress,
        fromDraft: true,
        draftId: draft.draftId,
        fileName: draft.originalData?.fileName,
        uploadedData: draft.originalData?.uploadedData
      };
      
      // Add TimePoints data if available
      if (draft.stepData?.timepoints) {
        restorationData.serviceBands = draft.stepData.timepoints.serviceBands;
        restorationData.travelTimeData = draft.stepData.timepoints.travelTimeData;
        restorationData.outliers = draft.stepData.timepoints.outliers;
        restorationData.deletedPeriods = draft.stepData.timepoints.deletedPeriods;
        restorationData.timePeriodServiceBands = draft.stepData.timepoints.timePeriodServiceBands;
      }
      
      // Add Block Configuration data if available
      if (draft.stepData?.blockConfiguration) {
        restorationData.numberOfBuses = draft.stepData.blockConfiguration.numberOfBuses;
        restorationData.cycleTimeMinutes = draft.stepData.blockConfiguration.cycleTimeMinutes;
        restorationData.automateBlockStartTimes = draft.stepData.blockConfiguration.automateBlockStartTimes;
        restorationData.blockConfigurations = draft.stepData.blockConfiguration.blockConfigurations;
      }
      
      // Add Summary Schedule data if available
      if (draft.stepData?.summarySchedule) {
        restorationData.summarySchedule = draft.stepData.summarySchedule;
      }
      
      // Add workflow step data if available from Firebase workflow
      if (workflow?.stepData) {
        // Merge any additional step data from workflow
        Object.assign(restorationData, workflow.stepData);
      }
      
      console.log('✅ Draft loaded with full state restoration data:', {
        draftId,
        currentStep: draft.currentStep,
        hasTimePointsData: !!restorationData.serviceBands,
        hasBlockData: !!restorationData.blockConfigurations,
        hasSummaryData: !!restorationData.summarySchedule
      });
      
      return {
        draft,
        restorationData
      };
    } catch (error) {
      console.error('Error loading draft with full state:', error);
      return null;
    }
  }

  /**
   * Resume workflow - navigates to last active step with all data
   */
  async resumeWorkflow(draftId: string): Promise<{
    success: boolean;
    targetStep?: string;
    restorationData?: any;
    error?: string;
  }> {
    try {
      const result = await this.loadDraftWithFullState(draftId);
      if (!result) {
        return { success: false, error: 'Draft not found' };
      }
      
      const { draft, restorationData } = result;
      
      // Set as current session
      this.setCurrentSessionDraft(draftId);
      
      // Determine target navigation step
      let targetStep = '/upload'; // Default
      
      switch (draft.currentStep) {
        case 'timepoints':
          targetStep = '/timepoints';
          break;
        case 'blocks':
          targetStep = '/block-configuration';
          break;
        case 'summary':
        case 'ready-to-publish':
          targetStep = '/summary-schedule';
          break;
        default:
          targetStep = '/upload';
      }
      
      console.log(`📍 Resuming workflow at step: ${targetStep}`);
      
      return {
        success: true,
        targetStep,
        restorationData
      };
    } catch (error: any) {
      console.error('Error resuming workflow:', error);
      return { success: false, error: sanitizeErrorMessage(error) };
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
      // Check cache first
      const cached = this.getCachedDraft(draftId);
      if (cached) {
        console.log('🚀 Retrieved draft from cache:', draftId);
        return cached;
      }

      console.log('🔥 Fetching unified draft from Firebase:', draftId);
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        // Remove Firestore-specific fields
        delete data.serverTimestamp;
        
        // Deserialize uploaded data to restore nested arrays
        if (data.originalData?.uploadedData) {
          console.log('🔥 Deserializing uploadedData for draft:', draftId);
          data.originalData.uploadedData = this.deserializeFromFirebase(data.originalData.uploadedData);
        }
        
        // Also deserialize timepointsAnalysis data if present
        if (data.timepointsAnalysis?.travelTimeData) {
          data.timepointsAnalysis.travelTimeData = this.deserializeFromFirebase(data.timepointsAnalysis.travelTimeData);
        }
        if (data.timepointsAnalysis?.serviceBands) {
          data.timepointsAnalysis.serviceBands = this.deserializeFromFirebase(data.timepointsAnalysis.serviceBands);
        }
        
        // Ensure draft has all required unified fields
        const unifiedDraft = this.ensureUnifiedFormat(data);
        
        // Cache the result
        this.setCachedDraft(draftId, unifiedDraft);
        
        console.log('🔥 Unified draft loaded from Firebase and cached:', draftId, 'has uploadedData:', !!unifiedDraft.originalData?.uploadedData);
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
      
      // Serialize the entire draft for Firebase compatibility (removes undefined values and handles nested arrays)
      const serializedDraft = this.serializeForFirebase(draft);
      
      // Save to Firestore using transaction for consistency
      await runTransaction(db, async (transaction) => {
        const draftRef = doc(db, this.COLLECTION_NAME, draft.draftId);
        transaction.set(draftRef, {
          ...serializedDraft,
          serverTimestamp: serverTimestamp()
        });
      });
      
      console.log('🔥 Saved draft to Firebase:', draft.draftId);
      
      // Invalidate cache since draft was updated
      this.invalidateCache(draft.draftId);
      
      return { success: true, draftId: draft.draftId };
    } catch (error: any) {
      console.error('🔥 Draft save operation failed:', error);
      
      // If offline or network error, queue the operation
      if (this.isNetworkError(error)) {
        const queued = offlineQueue.enqueue({
          type: 'save',
          collection: this.COLLECTION_NAME,
          documentId: draft.draftId,
          data: this.serializeForFirebase(draft)
        });
        
        if (queued) {
          console.log('📦 Operation queued for offline sync');
          return { success: true, draftId: draft.draftId };
        }
      }
      
      return { success: false, error: sanitizeErrorMessage(error) };
    } finally {
      this.releaseLock(draft.draftId);
    }
  }

  /**
   * Save draft with advanced conflict resolution
   */
  async saveWithConflictResolution(draft: UnifiedDraftCompat): Promise<DraftOperationResult> {
    const maxConflictRetries = 3;
    let conflictRetryCount = 0;
    
    while (conflictRetryCount < maxConflictRetries) {
      try {
        // Get the current remote version with fresh data
        const remoteDraft = await this.getRemoteDraft(draft.draftId);
        
        if (remoteDraft) {
          const localVersion = draft.metadata.version || 0;
          const remoteVersion = remoteDraft.metadata.version || 0;
          
          // Check for version conflict
          if (remoteVersion > localVersion) {
            console.warn('⚠️ Version conflict detected (attempt %d):', conflictRetryCount + 1, {
              local: localVersion,
              remote: remoteVersion,
              localModified: draft.metadata.lastModifiedAt,
              remoteModified: remoteDraft.metadata.lastModifiedAt
            });
            
            // Enhanced merge strategy with conflict resolution
            const mergedDraft = this.mergeConflictsAdvanced(draft, remoteDraft);
            
            // Update version to be higher than remote with conflict marker
            mergedDraft.metadata.version = remoteVersion + 1;
            mergedDraft.metadata.lastConflictResolution = new Date().toISOString();
            
            // Try to save merged version
            const result = await this.saveDraftInternal(mergedDraft);
            if (result.success) {
              console.log('✅ Conflict resolved successfully after', conflictRetryCount + 1, 'attempts');
              return result;
            }
            
            // If save failed, retry conflict resolution
            conflictRetryCount++;
            await this.sleep(Math.pow(2, conflictRetryCount) * 100); // Exponential backoff
            continue;
            
          } else if (remoteVersion === localVersion) {
            // Safe to save, increment version
            draft.metadata.version = localVersion + 1;
            return await this.saveDraftInternal(draft);
          } else {
            // Local version is ahead (edge case - proceed with caution)
            console.warn('⚠️ Local version ahead of remote:', {
              local: localVersion,
              remote: remoteVersion
            });
            draft.metadata.version = Math.max(localVersion, remoteVersion) + 1;
            return await this.saveDraftInternal(draft);
          }
        } else {
          // No remote version exists, safe to save
          draft.metadata.version = (draft.metadata.version || 0) + 1;
          return await this.saveDraftInternal(draft);
        }
      } catch (error: any) {
        console.error('Conflict resolution attempt failed:', conflictRetryCount + 1, error);
        conflictRetryCount++;
        
        if (conflictRetryCount >= maxConflictRetries) {
          console.error('Max conflict resolution retries exceeded');
          break;
        }
        
        await this.sleep(Math.pow(2, conflictRetryCount) * 100); // Exponential backoff
      }
    }
    
    // Final fallback - save with optimistic versioning
    console.warn('🔄 Falling back to optimistic save after conflict resolution failures');
    draft.metadata.version = (draft.metadata.version || 0) + 1;
    draft.metadata.conflictResolutionFailed = true;
    return await this.saveDraftInternal(draft);
  }

  /**
   * Save with retry and exponential backoff
   */
  async saveWithRetry(
    draft: UnifiedDraftCompat, 
    maxRetries: number = 3
  ): Promise<DraftOperationResult> {
    let retryCount = 0;
    let lastError: any;
    
    while (retryCount < maxRetries) {
      try {
        // Try to save with conflict resolution
        const result = await this.saveWithConflictResolution(draft);
        if (result.success) {
          return result;
        }
        
        // If it failed but not due to network, don't retry
        if (!this.isNetworkError(lastError)) {
          return result;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Save attempt ${retryCount + 1} failed:`, error.message);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const backoffMs = Math.pow(2, retryCount) * 1000;
        console.log(`⏳ Retrying in ${backoffMs}ms...`);
        await this.sleep(backoffMs);
      }
    }
    
    // All retries failed, queue for offline
    const queued = offlineQueue.enqueue({
      type: 'save',
      collection: this.COLLECTION_NAME,
      documentId: draft.draftId,
      data: this.serializeForFirebase(draft)
    });
    
    if (queued) {
      console.log('📦 Operation queued after max retries');
      return { success: true, draftId: draft.draftId };
    }
    
    return { 
      success: false, 
      error: `Failed after ${maxRetries} attempts: ${sanitizeErrorMessage(lastError)}` 
    };
  }

  /**
   * Get draft directly from Firebase (bypasses cache)
   */
  private async getRemoteDraft(draftId: string): Promise<UnifiedDraftCompat | null> {
    try {
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        delete data.serverTimestamp;
        
        // Deserialize data
        if (data.originalData?.uploadedData) {
          data.originalData.uploadedData = this.deserializeFromFirebase(data.originalData.uploadedData);
        }
        
        return this.ensureUnifiedFormat(data);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get remote draft:', error);
      return null;
    }
  }

  /**
   * Merge conflicting drafts (basic strategy)
   */
  private mergeConflicts(
    localDraft: UnifiedDraftCompat, 
    remoteDraft: UnifiedDraftCompat
  ): UnifiedDraftCompat {
    console.log('🔀 Merging conflicts between local and remote drafts');
    
    // Strategy: Keep remote data for shared fields, preserve local-only changes
    const merged: UnifiedDraftCompat = {
      ...remoteDraft,
      // Preserve local UI state
      ui: localDraft.ui,
      // Merge metadata
      metadata: {
        ...remoteDraft.metadata,
        lastModifiedAt: new Date().toISOString(),
        version: Math.max(
          localDraft.metadata.version || 0,
          remoteDraft.metadata.version || 0
        )
      }
    };
    
    // Merge stepData - prefer remote but don't lose local-only data
    if (localDraft.stepData) {
      merged.stepData = {
        ...localDraft.stepData,
        ...remoteDraft.stepData
      };
    }
    
    return merged;
  }

  /**
   * Advanced merge conflicts with field-level resolution
   */
  private mergeConflictsAdvanced(
    localDraft: UnifiedDraftCompat, 
    remoteDraft: UnifiedDraftCompat
  ): UnifiedDraftCompat {
    console.log('🔀 Advanced merge of conflicts between local and remote drafts');
    
    const localTime = new Date(localDraft.metadata.lastModifiedAt).getTime();
    const remoteTime = new Date(remoteDraft.metadata.lastModifiedAt).getTime();
    const timeDifferenceMs = Math.abs(localTime - remoteTime);
    
    console.log('📊 Conflict analysis:', {
      localVersion: localDraft.metadata.version,
      remoteVersion: remoteDraft.metadata.version,
      timeDifferenceMinutes: Math.round(timeDifferenceMs / 60000),
      localStep: localDraft.currentStep,
      remoteStep: remoteDraft.currentStep
    });
    
    // Start with remote as base (preference for server state)
    const merged: UnifiedDraftCompat = { ...remoteDraft };
    
    // FIELD-LEVEL MERGE STRATEGIES:
    
    // 1. UI State - Always prefer local (user's current view state)
    merged.ui = {
      ...remoteDraft.ui,
      ...localDraft.ui,
      // Merge celebrations shown from both versions
      celebrationsShown: Array.from(new Set([
        ...(localDraft.ui.celebrationsShown || []),
        ...(remoteDraft.ui.celebrationsShown || [])
      ]))
    };
    
    // 2. Progress - Use higher progress value
    merged.progress = Math.max(localDraft.progress || 0, remoteDraft.progress || 0);
    
    // 3. Current Step - Use the most advanced step
    const stepOrder = ['upload', 'timepoints', 'blocks', 'summary', 'ready-to-publish'];
    const localStepIndex = stepOrder.indexOf(localDraft.currentStep);
    const remoteStepIndex = stepOrder.indexOf(remoteDraft.currentStep);
    
    if (localStepIndex > remoteStepIndex) {
      merged.currentStep = localDraft.currentStep;
    }
    
    // 4. Step Data - Merge with recent-wins strategy
    merged.stepData = {};
    
    // Merge timepoints data
    if (localDraft.stepData.timepoints || remoteDraft.stepData.timepoints) {
      const localTimepoints = localDraft.stepData.timepoints;
      const remoteTimepoints = remoteDraft.stepData.timepoints;
      
      // Use most recent timepoints data based on modification time
      if (localTimepoints && remoteTimepoints) {
        merged.stepData.timepoints = localTime > remoteTime ? localTimepoints : remoteTimepoints;
      } else {
        merged.stepData.timepoints = localTimepoints || remoteTimepoints;
      }
    }
    
    // Merge block configuration
    if (localDraft.stepData.blockConfiguration || remoteDraft.stepData.blockConfiguration) {
      const localBlocks = localDraft.stepData.blockConfiguration;
      const remoteBlocks = remoteDraft.stepData.blockConfiguration;
      
      if (localBlocks && remoteBlocks) {
        merged.stepData.blockConfiguration = localTime > remoteTime ? localBlocks : remoteBlocks;
      } else {
        merged.stepData.blockConfiguration = localBlocks || remoteBlocks;
      }
    }
    
    // Merge summary schedule
    if (localDraft.stepData.summarySchedule || remoteDraft.stepData.summarySchedule) {
      const localSummary = localDraft.stepData.summarySchedule;
      const remoteSummary = remoteDraft.stepData.summarySchedule;
      
      if (localSummary && remoteSummary) {
        merged.stepData.summarySchedule = localTime > remoteTime ? localSummary : remoteSummary;
      } else {
        merged.stepData.summarySchedule = localSummary || remoteSummary;
      }
    }
    
    // 5. Original Data - Prefer remote (shouldn't change often)
    merged.originalData = remoteDraft.originalData;
    
    // 6. Metadata - Merge with conflict tracking
    merged.metadata = {
      ...remoteDraft.metadata,
      lastModifiedAt: new Date().toISOString(),
      lastModifiedStep: localTime > remoteTime ? 
        localDraft.metadata.lastModifiedStep : 
        remoteDraft.metadata.lastModifiedStep,
      version: Math.max(
        localDraft.metadata.version || 0,
        remoteDraft.metadata.version || 0
      ),
      syncStatus: 'conflict',
      lastConflictResolution: new Date().toISOString(),
      conflictResolutionFailed: false
    };
    
    console.log('✅ Advanced merge completed:', {
      resultStep: merged.currentStep,
      resultProgress: merged.progress,
      hasTimepoints: !!merged.stepData.timepoints,
      hasBlocks: !!merged.stepData.blockConfiguration,
      hasSummary: !!merged.stepData.summarySchedule
    });
    
    return merged;
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const networkErrors = ['unavailable', 'network-error', 'failed-precondition'];
    if (networkErrors.includes(error.code)) return true;
    
    const messageIndicators = ['network', 'offline', 'fetch', 'connect'];
    const errorMessage = (error.message || '').toLowerCase();
    return messageIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    // Use save with retry for resilience
    return this.saveWithRetry(draft, 2);
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
      // No authentication needed
      console.log('🔥 Loading all unified drafts from Firebase', {
        isAuthenticated: false,
        userId: 'anonymous',
        isAnonymous: true,
        timestamp: new Date().toISOString()
      });
      const draftsRef = collection(db, this.COLLECTION_NAME);
      
      // Try ordered query first, fallback to unordered if it fails
      let querySnapshot;
      try {
        const q = query(
          draftsRef,
          orderBy('serverTimestamp', 'desc'),
          limit(this.MAX_DRAFTS)
        );
        querySnapshot = await getDocs(q);
        console.log('🔥 Successfully used ordered query');
      } catch (orderError) {
        console.warn('🔥 Ordered query failed, trying unordered fallback:', orderError);
        // Fallback: get all drafts without ordering
        const fallbackQuery = query(draftsRef, limit(this.MAX_DRAFTS));
        querySnapshot = await getDocs(fallbackQuery);
        console.log('🔥 Using unordered fallback query');
      }
      
      const drafts: UnifiedDraftCompat[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('🔥 Processing draft document:', doc.id, 'hasServerTimestamp:', !!data.serverTimestamp);
        
        // Remove Firestore-specific fields
        delete data.serverTimestamp;
        
        // Ensure draft has all required unified fields
        const unifiedDraft = this.ensureUnifiedFormat(data);
        drafts.push(unifiedDraft);
      });
      
      console.log(`🔥 Loaded ${drafts.length} unified drafts from Firebase`);
      
      // Sort by lastModifiedAt in memory (more reliable)
      return drafts.sort((a, b) => {
        const timeA = new Date(a.metadata.lastModifiedAt).getTime();
        const timeB = new Date(b.metadata.lastModifiedAt).getTime();
        return timeB - timeA;
      });
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
    console.log('📝 Set current session draft to:', draftId);
  }
  
  /**
   * Force set the session to use the working draft for consolidation
   */
  forceWorkingDraftSession(workingDraftId: string): void {
    console.log('🔧 Forcing session to use working draft:', workingDraftId);
    this.setCurrentSessionDraft(workingDraftId);
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
      currentStep: legacyDraft.summarySchedule ? 'ready-to-publish' : 'upload',
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
    console.log('🔧 Ensuring unified format for data:', {
      hasDraftId: !!data.draftId,
      hasDraftName: !!data.draftName,
      hasCurrentStep: !!data.currentStep,
      hasOriginalData: !!data.originalData,
      hasUploadedData: !!data.originalData?.uploadedData,
      uploadedDataKeys: data.originalData?.uploadedData ? Object.keys(data.originalData.uploadedData).slice(0, 5) : [],
      originalFileName: data.originalData?.fileName,
      currentStep: data.currentStep
    });

    const now = new Date().toISOString();
    
    // If it's already a WorkflowDraftState, convert it
    if (data.currentStep && data.originalData && data.metadata && !data.draftName) {
      console.log('🔧 Converting WorkflowDraftState to UnifiedDraftCompat');
      
      // Preserve the originalData with all its contents including uploadedData
      const originalData = { ...data.originalData };
      
      // Make sure uploadedData is preserved
      if (data.originalData.uploadedData) {
        originalData.uploadedData = data.originalData.uploadedData;
        console.log('🔧 Preserving uploadedData in conversion, data exists:', !!originalData.uploadedData);
      }
      
      return {
        draftId: data.draftId,
        draftName: data.originalData.fileName?.replace(/\.[^/.]+$/, '') || 'Draft',
        originalData: originalData, // Use the preserved originalData
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
    console.log('🔄 Converting unified draft to WorkflowDraftState:', {
      draftId: draft.draftId,
      draftName: draft.draftName,
      currentStep: draft.currentStep,
      hasOriginalData: !!draft.originalData,
      hasUploadedData: !!draft.originalData?.uploadedData,
      originalFileName: draft.originalData?.fileName
    });

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
        default: 
          console.warn('🔄 Unknown step found, defaulting to upload:', step);
          return 'upload'; // Fallback for unknown steps
      }
    };

    // Preserve originalData exactly as it is - don't create empty fallback
    const safeOriginalData = draft.originalData || {
      fileName: draft.draftName || 'Unknown Draft',
      fileType: 'csv' as const,
      uploadedData: null as any, // Don't create empty object, use null
      uploadTimestamp: draft.metadata.createdAt
    };

    const converted = {
      draftId: draft.draftId,
      currentStep: mapStep(draft.currentStep),
      originalData: safeOriginalData,
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
          generationMethod: 'block-based' as const,
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

    console.log('🔄 Successfully converted draft:', converted.draftId, 'fileName:', converted.originalData.fileName);
    return converted;
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
        funTitle: 'Load Data',
        description: 'Drop your schedule data here and let\'s begin crafting something amazing!',
        icon: 'CloudUpload',
        color: '#E3E8F0',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'drafts',
        title: 'Draft Review',
        funTitle: 'Draft Review',
        description: 'Take a peek at what we\'ve discovered in your data',
        icon: 'Drafts',
        color: '#E8D5F2',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'timepoints',
        title: 'TimePoints Analysis',
        funTitle: 'Review Times',
        description: 'Let\'s discover the perfect timing for your routes',
        icon: 'Timeline',
        color: '#FFE4D1',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'block-config',
        title: 'Block Configuration',
        funTitle: 'Plan Blocks',
        description: 'Arrange your buses like pieces on a chess board',
        icon: 'Build',
        color: '#D4F1E4',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'summary',
        title: 'Base Schedule',
        funTitle: 'Build Schedule',
        description: 'Watch your schedule come together like magic',
        icon: 'ViewList',
        color: '#D1E7FF',
        status: 'not-started',
        progress: 0
      },
      {
        key: 'connections',
        title: 'Connection Schedule',
        funTitle: 'Add Connections',
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

    // Save sync to localStorage first for immediate availability
    try {
      localStorage.setItem(
        this.WORKFLOW_KEY_PREFIX + workflow.draftId,
        JSON.stringify(workflow)
      );
    } catch (error) {
      console.error('Error saving new workflow to localStorage:', error);
    }
    
    // Save async to Firebase in background
    this.saveWorkflow(workflow).catch(error => {
      console.warn('Background Firebase save failed:', error);
    });
    
    return workflow;
  }

  /**
   * Get workflow for a specific draft (UI storyboard state) - sync version
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
   * Get workflow for a specific draft with cloud sync (async version)
   */
  async getWorkflowAsync(draftId: string): Promise<DraftWorkflowState | null> {
    return await this.loadWorkflowFromCloud(draftId);
  }

  /**
   * Load workflow from cloud (Firebase first, fallback to localStorage)
   */
  async loadWorkflowFromCloud(draftId: string): Promise<DraftWorkflowState | null> {
    try {
      // Try loading from Firebase first
      console.log('🔥 Loading workflow from Firebase:', draftId);
      const workflowProgressRef = doc(db, 'workflow_progress', draftId);
      const workflowSnap = await getDoc(workflowProgressRef);
      
      if (workflowSnap.exists()) {
        const firebaseWorkflow = workflowSnap.data();
        console.log('✅ Workflow loaded from Firebase:', draftId);
        
        // Cache in localStorage for offline use
        localStorage.setItem(
          this.WORKFLOW_KEY_PREFIX + draftId,
          JSON.stringify(firebaseWorkflow)
        );
        
        return firebaseWorkflow as DraftWorkflowState;
      } else {
        console.log('🔍 No workflow found in Firebase, checking localStorage');
      }
    } catch (error) {
      console.warn('🔥 Firebase load failed, falling back to localStorage:', error);
    }
    
    // Fall back to localStorage if Firebase fails or no data
    try {
      const localData = localStorage.getItem(this.WORKFLOW_KEY_PREFIX + draftId);
      if (localData) {
        const localWorkflow = JSON.parse(localData) as DraftWorkflowState;
        console.log('📱 Workflow loaded from localStorage:', draftId);
        return localWorkflow;
      }
    } catch (error) {
      console.error('Error loading workflow from localStorage:', error);
    }
    
    console.log('❌ No workflow found anywhere for:', draftId);
    return null;
  }

  /**
   * Save workflow state with resilience (UI storyboard persistence)
   */
  async saveWorkflow(workflow: DraftWorkflowState): Promise<void> {
    try {
      workflow.lastModified = new Date().toISOString();
      
      // Save to localStorage first (instant feedback)
      localStorage.setItem(
        this.WORKFLOW_KEY_PREFIX + workflow.draftId,
        JSON.stringify(workflow)
      );
      
      // Then sync to Firebase with resilience
      await this.saveWorkflowToFirebase(workflow);
    } catch (error) {
      console.error('Error saving draft workflow:', error);
    }
  }

  /**
   * Save workflow to Firebase with retry logic
   */
  private async saveWorkflowToFirebase(
    workflow: DraftWorkflowState, 
    maxRetries: number = 2
  ): Promise<void> {
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const workflowProgressRef = doc(db, 'workflow_progress', workflow.draftId);
        const workflowData = {
          draftId: workflow.draftId,
          draftName: workflow.draftName,
          routeName: workflow.routeName || null,
          currentStep: workflow.currentStep,
          steps: workflow.steps,
          overallProgress: workflow.overallProgress,
          lastModified: workflow.lastModified,
          createdAt: workflow.createdAt,
          celebrationsShown: workflow.celebrationsShown || [],
          stepData: workflow.stepData || {},
          serverTimestamp: serverTimestamp()
        };
        
        await setDoc(workflowProgressRef, workflowData);
        console.log('✅ Workflow synced to Firebase:', workflow.draftId);
        return;
        
      } catch (error: any) {
        retryCount++;
        console.warn(`🔥 Firebase workflow sync failed (attempt ${retryCount}):`, error);
        
        if (retryCount > maxRetries) {
          // Queue for offline sync if all retries failed
          if (this.isNetworkError(error)) {
            const queued = offlineQueue.enqueue({
              type: 'save',
              collection: 'workflow_progress',
              documentId: workflow.draftId,
              data: {
                draftId: workflow.draftId,
                draftName: workflow.draftName,
                routeName: workflow.routeName || null,
                currentStep: workflow.currentStep,
                steps: workflow.steps,
                overallProgress: workflow.overallProgress,
                lastModified: workflow.lastModified,
                createdAt: workflow.createdAt,
                celebrationsShown: workflow.celebrationsShown || [],
                stepData: workflow.stepData || {}
              }
            });
            
            if (queued) {
              console.log('📦 Workflow operation queued for offline sync');
            }
          }
          break;
        } else {
          // Exponential backoff for retry
          const backoffMs = Math.pow(2, retryCount) * 500;
          await this.sleep(backoffMs);
        }
      }
    }
  }

  /**
   * Update step status with animations and celebrations
   */
  async updateStepStatus(
    draftId: string,
    stepKey: string,
    status: 'not-started' | 'in-progress' | 'completed',
    progress?: number,
    metadata?: any
  ): Promise<DraftWorkflowState | null> {
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

    await this.saveWorkflow(workflow);
    
    // Also persist to Firebase for proper sync
    try {
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        // Update the Firebase draft with step completion status
        const updateData: any = {
          currentStep: workflow.currentStep,
          progress: workflow.overallProgress,
          'metadata.lastModifiedAt': serverTimestamp(),
          'metadata.lastModifiedStep': stepKey
        };
        
        // Store step completion data
        if (!draftSnap.data().stepData) {
          updateData.stepData = {};
        }
        
        updateData[`stepData.${stepKey}`] = {
          status,
          completedAt: status === 'completed' ? new Date().toISOString() : null,
          progress: progress || 0,
          metadata
        };
        
        await setDoc(draftRef, updateData, { merge: true });
        console.log(`✅ Step ${stepKey} status (${status}) persisted to Firebase`);
      }
    } catch (error) {
      console.error('Failed to persist step status to Firebase:', error);
      // Don't fail the operation if Firebase update fails - localStorage is still updated
    }

    // Emit workflow progress event for real-time UI updates
    try {
      // Map workflow step keys to expected values
      const currentStepMapped = workflow.currentStep === 'block-config' ? 'blocks' : 
                               workflow.currentStep === 'ready-to-publish' ? 'summary' : 
                               workflow.currentStep as 'upload' | 'timepoints' | 'blocks' | 'summary' | 'ready-to-publish';
      
      emit({
        type: 'workflow-progress',
        source: 'DraftService',
        priority: 1,
        payload: {
          currentStep: currentStepMapped,
          progress: workflow.overallProgress || 0,
          canProceed: status === 'completed'
        }
      });
    } catch (eventError) {
      console.warn('Failed to emit workflow progress event:', eventError);
    }
    
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
    
    // Save sync to localStorage first
    try {
      localStorage.setItem(
        this.WORKFLOW_KEY_PREFIX + workflow.draftId,
        JSON.stringify(workflow)
      );
    } catch (error) {
      console.error('Error saving workflow celebration to localStorage:', error);
    }
    
    // Save async to Firebase in background
    this.saveWorkflow(workflow).catch(error => {
      console.warn('Background Firebase save failed for celebration:', error);
    });
    
    return true;
  }

  /**
   * Complete current step and move to next (UI workflow)
   */
  async completeCurrentStep(draftId: string, metadata?: any): Promise<DraftWorkflowState | null> {
    const workflow = this.getWorkflow(draftId);
    if (!workflow) return null;

    const currentStep = workflow.steps.find(s => s.key === workflow.currentStep);
    if (!currentStep) return null;

    return await this.updateStepStatus(draftId, currentStep.key, 'completed', 100, metadata);
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
    
    // Save sync to localStorage first
    try {
      localStorage.setItem(
        this.WORKFLOW_KEY_PREFIX + workflow.draftId,
        JSON.stringify(workflow)
      );
    } catch (error) {
      console.error('Error saving workflow navigation to localStorage:', error);
    }
    
    // Save async to Firebase in background
    this.saveWorkflow(workflow).catch(error => {
      console.warn('Background Firebase save failed during navigation:', error);
    });
    
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
  async completeStep(stepKey: string, data?: any): Promise<any> {
    const draftId = this.getCurrentSessionDraftId();
    if (draftId) {
      return await this.completeCurrentStep(draftId, data);
    }
    return null;
  }

  /**
   * Public method to save a draft (for WorkspaceContext compatibility)
   * Uses the resilient save workflow with retry and conflict resolution
   */
  async saveDraft(draft: UnifiedDraftCompat, userId: string): Promise<DraftOperationResult> {
    try {
      // Mark sync status as pending
      draft.metadata.syncStatus = 'pending';
      
      // Use the resilient save workflow
      const result = await this.saveWithRetry(draft, 3);
      
      if (result.success) {
        // Update sync status on success
        draft.metadata.syncStatus = 'synced';
        // Don't need to save again, just update cache
        this.setCachedDraft(draft.draftId, draft);
      } else {
        draft.metadata.syncStatus = 'error';
      }
      
      return result;
    } catch (error) {
      console.error('Failed to save draft:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error)
      };
    }
  }

  /**
   * Public method to get a draft (for WorkspaceContext compatibility)
   */
  async getDraft(draftId: string, userId: string): Promise<UnifiedDraftCompat | null> {
    try {
      return await this.getDraftByIdUnified(draftId);
    } catch (error) {
      console.error('Failed to get draft:', error);
      return null;
    }
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
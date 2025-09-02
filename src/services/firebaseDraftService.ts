/**
 * Firebase-integrated Draft Service
 * Provides real cloud persistence for draft schedules
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
  Timestamp
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
import { SummarySchedule, ServiceBand } from '../types/schedule';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';

class FirebaseDraftService {
  private readonly COLLECTION_NAME = 'workflow_drafts';
  private readonly MAX_DRAFTS = 50;
  
  /**
   * Creates a new draft in Firestore
   */
  async createDraftFromUpload(
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData
  ): Promise<WorkflowDraftResult> {
    try {
      const draftId = this.generateDraftId();
      
      const workflowDraft: WorkflowDraftState = {
        draftId,
        currentStep: 'upload',
        originalData: {
          fileName,
          fileType,
          uploadedData,
          uploadTimestamp: new Date().toISOString()
        },
        metadata: {
          createdAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
          lastModifiedStep: 'upload',
          version: 1,
          isPublished: false
        }
      };
      
      // Save to Firestore
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      await setDoc(draftRef, {
        ...workflowDraft,
        // Add Firestore server timestamp
        serverTimestamp: serverTimestamp()
      });
      
      console.log('🔥 Created new draft in Firebase:', draftId);
      return { 
        success: true, 
        draftId
      };
    } catch (error: any) {
      console.error('🔥 Failed to create draft in Firebase:', error);
      return { success: false, error: `Failed to create draft: ${error.message}` };
    }
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
   * Gets a draft by ID from Firestore
   */
  async getDraftById(draftId: string): Promise<WorkflowDraftState | null> {
    try {
      console.log('🔥 Fetching draft from Firebase:', draftId);
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        // Remove Firestore-specific fields
        delete data.serverTimestamp;
        console.log('🔥 Draft loaded from Firebase:', draftId);
        return data as WorkflowDraftState;
      }
      
      console.log('🔥 Draft not found in Firebase:', draftId);
      return null;
    } catch (error) {
      console.error('🔥 Error loading draft from Firebase:', error);
      return null;
    }
  }
  
  /**
   * Gets all drafts from Firestore
   */
  async getAllDrafts(): Promise<WorkflowDraftState[]> {
    try {
      console.log('🔥 Loading all drafts from Firebase');
      const draftsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        draftsRef,
        orderBy('serverTimestamp', 'desc'),
        limit(this.MAX_DRAFTS)
      );
      
      const querySnapshot = await getDocs(q);
      const drafts: WorkflowDraftState[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Remove Firestore-specific fields
        delete data.serverTimestamp;
        drafts.push(data as WorkflowDraftState);
      });
      
      console.log(`🔥 Loaded ${drafts.length} drafts from Firebase`);
      return drafts;
    } catch (error) {
      console.error('🔥 Error loading drafts from Firebase:', error);
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
   * Publishes a draft (marks as published in Firestore)
   */
  async publishDraft(draftId: string): Promise<WorkflowDraftResult> {
    try {
      const draftRef = doc(db, this.COLLECTION_NAME, draftId);
      const draftSnap = await getDoc(draftRef);
      
      if (!draftSnap.exists()) {
        return { success: false, error: 'Draft not found' };
      }
      
      const draft = draftSnap.data() as WorkflowDraftState;
      
      if (!draft.summarySchedule) {
        return { success: false, error: 'Draft must have a summary schedule before publishing' };
      }
      
      // Update the draft as published
      await setDoc(draftRef, {
        ...draft,
        metadata: {
          ...draft.metadata,
          isPublished: true,
          publishedAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString()
        },
        serverTimestamp: serverTimestamp()
      });
      
      console.log('🔥 Published draft in Firebase:', draftId);
      return { success: true, draftId };
    } catch (error: any) {
      console.error('🔥 Failed to publish draft in Firebase:', error);
      return { success: false, error: `Failed to publish: ${error.message}` };
    }
  }
  
  // Utility methods
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Session management (still uses localStorage for current session)
  getCurrentSessionDraftId(): string | null {
    return sessionStorage.getItem('current_workflow_draft');
  }
  
  setCurrentSessionDraft(draftId: string): void {
    sessionStorage.setItem('current_workflow_draft', draftId);
  }
  
  clearCurrentSessionDraft(): void {
    sessionStorage.removeItem('current_workflow_draft');
  }
}

export const firebaseDraftService = new FirebaseDraftService();
export default firebaseDraftService;
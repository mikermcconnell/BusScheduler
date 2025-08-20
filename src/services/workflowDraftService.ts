/**
 * Unified draft workflow management service
 * Replaces fragmented draft states with single source of truth
 */

import { 
  WorkflowDraftState, 
  TimepointsModification, 
  BlockConfiguration,
  ServiceBand,
  TimePointData,
  OutlierData,
  ScheduleGenerationMetadata,
  WorkflowDraftResult
} from '../types/workflow';
import { SummarySchedule } from '../types/schedule';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { scheduleStorage } from './scheduleStorage';

class WorkflowDraftService {
  private readonly DRAFT_STORAGE_KEY = 'workflow_drafts';
  private readonly SESSION_DRAFT_KEY = 'current_workflow_draft';
  private readonly MAX_DRAFTS = 20;
  
  /**
   * Creates a new draft from uploaded data
   */
  async createDraftFromUpload(
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData
  ): Promise<WorkflowDraftResult> {
    try {
      const draftId = this.generateDraftId();
      const now = new Date().toISOString();
      
      const workflowDraft: WorkflowDraftState = {
        draftId,
        currentStep: 'upload',
        originalData: {
          fileName,
          fileType,
          uploadedData,
          uploadTimestamp: now
        },
        metadata: {
          createdAt: now,
          lastModifiedAt: now,
          lastModifiedStep: 'upload',
          version: 1,
          isPublished: false
        }
      };
      
      await this.saveDraft(workflowDraft);
      this.setCurrentSessionDraft(draftId);
      
      console.log('✅ Created new workflow draft:', draftId);
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Failed to create draft:', error);
      return { success: false, error: `Failed to create draft: ${error.message}` };
    }
  }
  
  /**
   * Updates draft with TimePoints analysis results
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
      const draft = await this.getDraftById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }
      
      const updatedDraft: WorkflowDraftState = {
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
          version: draft.metadata.version + 1
        }
      };
      
      await this.saveDraft(updatedDraft);
      console.log('✅ Updated draft with TimePoints analysis');
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Failed to update draft with timepoints:', error);
      return { success: false, error: `Failed to update draft: ${error.message}` };
    }
  }
  
  /**
   * Updates draft with block configuration
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
      const draft = await this.getDraftById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }
      
      const updatedDraft: WorkflowDraftState = {
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
          version: draft.metadata.version + 1
        }
      };
      
      await this.saveDraft(updatedDraft);
      console.log('✅ Updated draft with block configuration');
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Failed to update draft with blocks:', error);
      return { success: false, error: `Failed to update draft: ${error.message}` };
    }
  }
  
  /**
   * Updates draft with generated summary schedule
   */
  async updateDraftWithSummarySchedule(
    draftId: string,
    summaryData: {
      schedule: SummarySchedule;
      metadata: ScheduleGenerationMetadata;
    }
  ): Promise<WorkflowDraftResult> {
    try {
      const draft = await this.getDraftById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }
      
      const updatedDraft: WorkflowDraftState = {
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
          version: draft.metadata.version + 1
        }
      };
      
      await this.saveDraft(updatedDraft);
      console.log('✅ Updated draft with summary schedule');
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Failed to update draft with summary:', error);
      return { success: false, error: `Failed to update draft: ${error.message}` };
    }
  }
  
  /**
   * Publishes a completed draft to become a live schedule
   */
  async publishDraft(draftId: string): Promise<WorkflowDraftResult> {
    try {
      const draft = await this.getDraftById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }
      
      if (!draft.summarySchedule) {
        return { success: false, error: 'Draft must have a generated summary schedule before publishing' };
      }
      
      // Use existing scheduleStorage to save as published schedule
      const publishResult = await scheduleStorage.saveSchedule(
        draft.summarySchedule.schedule,
        draft.originalData.fileType,
        draft.originalData.fileName,
        draft.originalData.uploadedData
      );
      
      if (publishResult.success) {
        // Mark draft as published but keep it for reference
        const publishedDraft: WorkflowDraftState = {
          ...draft,
          metadata: {
            ...draft.metadata,
            isPublished: true,
            publishedAt: new Date().toISOString()
          }
        };
        
        await this.saveDraft(publishedDraft);
        
        // Clear from session
        this.clearCurrentSessionDraft();
        
        console.log('✅ Published draft as schedule:', publishResult.scheduleId);
        return { success: true, scheduleId: publishResult.scheduleId, draftId };
      }
      
      return publishResult;
    } catch (error: any) {
      console.error('Failed to publish draft:', error);
      return { success: false, error: `Failed to publish draft: ${error.message}` };
    }
  }
  
  /**
   * Gets a draft by ID
   */
  async getDraftById(draftId: string): Promise<WorkflowDraftState | null> {
    try {
      const drafts = await this.getAllDrafts();
      return drafts.find(d => d.draftId === draftId) || null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }
  
  /**
   * Gets all workflow drafts
   */
  async getAllDrafts(): Promise<WorkflowDraftState[]> {
    try {
      const data = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as WorkflowDraftState[];
    } catch (error) {
      console.error('Error loading drafts:', error);
      return [];
    }
  }
  
  /**
   * Gets the current session draft ID
   */
  getCurrentSessionDraftId(): string | null {
    return sessionStorage.getItem(this.SESSION_DRAFT_KEY);
  }
  
  /**
   * Sets the current session draft ID
   */
  setCurrentSessionDraft(draftId: string): void {
    sessionStorage.setItem(this.SESSION_DRAFT_KEY, draftId);
  }
  
  /**
   * Clears the current session draft
   */
  clearCurrentSessionDraft(): void {
    sessionStorage.removeItem(this.SESSION_DRAFT_KEY);
  }
  
  /**
   * Deletes a draft by ID
   */
  async deleteDraft(draftId: string): Promise<WorkflowDraftResult> {
    try {
      const drafts = await this.getAllDrafts();
      const filteredDrafts = drafts.filter(d => d.draftId !== draftId);
      
      if (drafts.length === filteredDrafts.length) {
        return { success: false, error: 'Draft not found' };
      }
      
      localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
      
      // Clear from session if it's the current draft
      if (this.getCurrentSessionDraftId() === draftId) {
        this.clearCurrentSessionDraft();
      }
      
      console.log('✅ Deleted draft:', draftId);
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      return { success: false, error: `Failed to delete draft: ${error.message}` };
    }
  }
  
  /**
   * Migrate existing drafts to new workflow format
   */
  async migrateExistingDrafts(): Promise<{ migrated: number; failed: number }> {
    let migrated = 0;
    let failed = 0;
    
    try {
      const existingDrafts = scheduleStorage.getAllDraftSchedules();
      
      for (const oldDraft of existingDrafts) {
        try {
          const workflowDraft: WorkflowDraftState = {
            draftId: oldDraft.id,
            currentStep: this.determineStepFromProcessingStep(oldDraft.processingStep),
            originalData: {
              fileName: oldDraft.fileName,
              fileType: oldDraft.fileType,
              uploadedData: oldDraft.uploadedData,
              uploadTimestamp: oldDraft.createdAt
            },
            metadata: {
              createdAt: oldDraft.createdAt,
              lastModifiedAt: oldDraft.updatedAt,
              lastModifiedStep: 'upload',
              version: 1,
              isPublished: false
            }
          };
          
          // Add existing summary schedule if present
          if (oldDraft.summarySchedule) {
            workflowDraft.summarySchedule = {
              schedule: oldDraft.summarySchedule,
              metadata: {
                generationMethod: 'block-based',
                parameters: {},
                validationResults: oldDraft.validation ? [oldDraft.validation] : [],
                performanceMetrics: {
                  generationTimeMs: 0,
                  tripCount: 0,
                  memoryUsageMB: 0
                }
              },
              generationTimestamp: oldDraft.updatedAt
            };
          }
          
          await this.saveDraft(workflowDraft);
          migrated++;
        } catch (error) {
          console.error(`Failed to migrate draft ${oldDraft.id}:`, error);
          failed++;
        }
      }
      
      console.log(`✅ Migration complete: ${migrated} migrated, ${failed} failed`);
    } catch (error) {
      console.error('Error during migration:', error);
    }
    
    return { migrated, failed };
  }
  
  // Private utility methods
  private generateDraftId(): string {
    return `workflow_draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async saveDraft(draft: WorkflowDraftState): Promise<void> {
    const drafts = await this.getAllDrafts();
    const existingIndex = drafts.findIndex(d => d.draftId === draft.draftId);
    
    if (existingIndex >= 0) {
      drafts[existingIndex] = draft;
    } else {
      // Check if we've reached the limit
      if (drafts.length >= this.MAX_DRAFTS) {
        // Remove oldest non-published draft
        const nonPublishedDrafts = drafts.filter(d => !d.metadata.isPublished);
        if (nonPublishedDrafts.length > 0) {
          const oldestDraft = nonPublishedDrafts.sort((a, b) => 
            new Date(a.metadata.createdAt).getTime() - new Date(b.metadata.createdAt).getTime()
          )[0];
          const removeIndex = drafts.findIndex(d => d.draftId === oldestDraft.draftId);
          drafts.splice(removeIndex, 1);
        }
      }
      drafts.push(draft);
    }
    
    localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }
  
  private determineStepFromProcessingStep(processingStep: string): WorkflowDraftState['currentStep'] {
    switch (processingStep) {
      case 'uploaded': return 'upload';
      case 'validated': return 'timepoints';
      case 'processed': return 'blocks';
      case 'completed': return 'summary';
      default: return 'upload';
    }
  }
}

export const workflowDraftService = new WorkflowDraftService();
export default workflowDraftService;
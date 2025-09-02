/**
 * Unified draft workflow management service
 * Replaces fragmented draft states with single source of truth
 */

import { 
  WorkflowDraftState, 
  TimepointsModification, 
  BlockConfiguration,
  TimePointData,
  OutlierData,
  ScheduleGenerationMetadata,
  WorkflowDraftResult
} from '../types/workflow';
import { SummarySchedule, ServiceBand, ScheduleValidationResult } from '../types/schedule';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { scheduleStorage } from './scheduleStorage';
import { firebaseDraftService } from './firebaseDraftService';

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
    console.log('📝 [workflowDraftService] Creating draft via Firebase');
    const result = await firebaseDraftService.createDraftFromUpload(
      fileName,
      fileType,
      uploadedData
    );
    
    if (result.success && result.draftId) {
      firebaseDraftService.setCurrentSessionDraft(result.draftId);
    }
    
    return result;
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
    console.log('📝 [workflowDraftService] Updating timepoints via Firebase');
    return firebaseDraftService.updateDraftWithTimepointsAnalysis(
      draftId,
      analysisData
    );
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
    console.log('📝 [workflowDraftService] Updating blocks via Firebase');
    return firebaseDraftService.updateDraftWithBlockConfiguration(
      draftId,
      blockConfig
    );
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
    console.log('📝 [workflowDraftService] Updating summary via Firebase');
    return firebaseDraftService.updateDraftWithSummarySchedule(
      draftId,
      summaryData
    );
  }
  
  /**
   * Updates draft file name
   */
  async updateDraftFileName(
    draftId: string,
    fileName: string
  ): Promise<WorkflowDraftResult> {
    try {
      const draft = await this.getDraftById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }
      
      const updatedDraft: WorkflowDraftState = {
        ...draft,
        originalData: {
          ...draft.originalData,
          fileName: fileName
        },
        metadata: {
          ...draft.metadata,
          lastModifiedAt: new Date().toISOString(),
          version: draft.metadata.version + 1
        }
      };
      
      await this.saveDraft(updatedDraft);
      console.log('✅ Updated draft file name to:', fileName);
      return { success: true, draftId };
    } catch (error: any) {
      console.error('Failed to update draft file name:', error);
      return { success: false, error: `Failed to update draft: ${error.message}` };
    }
  }
  
  /**
   * Publishes a completed draft to become a live schedule
   */
  async publishDraft(draftId: string): Promise<WorkflowDraftResult> {
    console.log('📝 [workflowDraftService] Publishing draft via Firebase:', draftId);
    return firebaseDraftService.publishDraft(draftId);
  }
  
  /**
   * Gets a draft by ID
   */
  async getDraftById(draftId: string): Promise<WorkflowDraftState | null> {
    console.log('📝 [workflowDraftService] Fetching draft from Firebase:', draftId);
    return firebaseDraftService.getDraftById(draftId);
  }
  
  /**
   * Gets all workflow drafts
   */
  async getAllDrafts(): Promise<WorkflowDraftState[]> {
    console.log('📝 [workflowDraftService] Loading all drafts from Firebase');
    return firebaseDraftService.getAllDrafts();
  }
  
  /**
   * Gets the current session draft ID
   */
  getCurrentSessionDraftId(): string | null {
    return firebaseDraftService.getCurrentSessionDraftId();
  }
  
  /**
   * Sets the current session draft ID
   */
  setCurrentSessionDraft(draftId: string): void {
    firebaseDraftService.setCurrentSessionDraft(draftId);
  }
  
  /**
   * Clears the current session draft
   */
  clearCurrentSessionDraft(): void {
    firebaseDraftService.clearCurrentSessionDraft();
  }
  
  /**
   * Deletes a draft by ID
   */
  async deleteDraft(draftId: string): Promise<WorkflowDraftResult> {
    console.log('📝 [workflowDraftService] Deleting draft from Firebase:', draftId);
    const result = await firebaseDraftService.deleteDraft(draftId);
    
    if (result.success && firebaseDraftService.getCurrentSessionDraftId() === draftId) {
      firebaseDraftService.clearCurrentSessionDraft();
    }
    
    return result;
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
            // Convert ValidationResult to ScheduleValidationResult
            const validationResult: ScheduleValidationResult = oldDraft.validation ? {
              isValid: oldDraft.validation.isValid,
              errors: oldDraft.validation.errors.map(e => e.message),
              warnings: oldDraft.validation.warnings.map(w => w.message)
            } : {
              isValid: true,
              errors: [],
              warnings: []
            };
            
            workflowDraft.summarySchedule = {
              schedule: oldDraft.summarySchedule,
              metadata: {
                generationMethod: 'block-based',
                parameters: {},
                validationResults: [validationResult],
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
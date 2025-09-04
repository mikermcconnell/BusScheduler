/**
 * Custom hook for managing unified workflow draft state
 */

import { useState, useEffect, useCallback } from 'react';
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
import { draftService } from '../services/draftService';

export interface UseWorkflowDraftReturn {
  draft: WorkflowDraftState | null;
  loading: boolean;
  error: string | null;
  isSaving: boolean;
  lastSaved: string | null;
  createDraftFromUpload: (
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData
  ) => Promise<WorkflowDraftResult>;
  updateTimepointsAnalysis: (analysisData: {
    serviceBands: ServiceBand[];
    travelTimeData: TimePointData[];
    outliers: OutlierData[];
    userModifications: TimepointsModification[];
    deletedPeriods?: string[];
    timePeriodServiceBands?: { [timePeriod: string]: string };
  }) => Promise<WorkflowDraftResult>;
  updateBlockConfiguration: (blockConfig: {
    numberOfBuses: number;
    cycleTimeMinutes: number;
    automateBlockStartTimes: boolean;
    blockConfigurations: BlockConfiguration[];
  }) => Promise<WorkflowDraftResult>;
  updateSummarySchedule: (summaryData: {
    schedule: SummarySchedule;
    metadata: ScheduleGenerationMetadata;
  }) => Promise<WorkflowDraftResult>;
  publishDraft: () => Promise<WorkflowDraftResult>;
  deleteDraft: () => Promise<WorkflowDraftResult>;
  refreshDraft: () => Promise<void>;
}

export const useWorkflowDraft = (draftId?: string): UseWorkflowDraftReturn => {
  const [draft, setDraft] = useState<WorkflowDraftState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  
  // Load draft from service
  const loadDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const loadedDraft = await draftService.getDraftById(id);
      if (loadedDraft) {
        setDraft(loadedDraft);
        setLastSaved(loadedDraft.metadata.lastModifiedAt);
      } else {
        setError('Draft not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load draft');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Create new draft from upload
  const createDraftFromUpload = useCallback(async (
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData
  ): Promise<WorkflowDraftResult> => {
    setIsSaving(true);
    setError(null);
    
    try {
      const result = await draftService.createDraftFromUpload(
        fileName,
        fileType,
        uploadedData
      );
      
      if (result.success && result.draftId) {
        await loadDraft(result.draftId);
      } else {
        setError(result.error || 'Failed to create draft');
      }
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create draft';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [loadDraft]);
  
  // Update timepoints analysis
  const updateTimepointsAnalysis = useCallback(async (analysisData: {
    serviceBands: ServiceBand[];
    travelTimeData: TimePointData[];
    outliers: OutlierData[];
    userModifications: TimepointsModification[];
    deletedPeriods?: string[];
    timePeriodServiceBands?: { [timePeriod: string]: string };
  }): Promise<WorkflowDraftResult> => {
    if (!draft) return { success: false, error: 'No active draft' };
    
    // TODO(human): Add debugging to track save flow
    console.log('📊 [useWorkflowDraft] Starting timepoints analysis update:', {
      draftId: draft.draftId,
      fileName: draft.originalData.fileName,
      dataSize: {
        serviceBands: analysisData.serviceBands?.length || 0,
        travelTimeData: analysisData.travelTimeData?.length || 0,
        outliers: analysisData.outliers?.length || 0,
        deletedPeriods: analysisData.deletedPeriods?.length || 0
      },
      timestamp: new Date().toISOString()
    });
    
    setIsSaving(true);
    setError(null);
    
    try {
      const result = await draftService.updateDraftWithTimepointsAnalysis(
        draft.draftId,
        analysisData
      );
      
      if (result.success) {
        console.log('✅ [useWorkflowDraft] Analysis saved successfully:', {
          draftId: draft.draftId,
          success: result.success
        });
        await loadDraft(draft.draftId);
      } else {
        console.error('❌ [useWorkflowDraft] Failed to save analysis:', {
          draftId: draft.draftId,
          error: result.error
        });
        setError(result.error || 'Failed to update analysis');
      }
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update analysis';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [draft, loadDraft]);
  
  // Update block configuration
  const updateBlockConfiguration = useCallback(async (blockConfig: {
    numberOfBuses: number;
    cycleTimeMinutes: number;
    automateBlockStartTimes: boolean;
    blockConfigurations: BlockConfiguration[];
  }): Promise<WorkflowDraftResult> => {
    if (!draft) return { success: false, error: 'No active draft' };
    
    setIsSaving(true);
    setError(null);
    
    try {
      const result = await draftService.updateDraftWithBlockConfiguration(
        draft.draftId,
        blockConfig
      );
      
      if (result.success) {
        await loadDraft(draft.draftId);
      } else {
        setError(result.error || 'Failed to update configuration');
      }
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update configuration';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [draft, loadDraft]);
  
  // Update summary schedule
  const updateSummarySchedule = useCallback(async (summaryData: {
    schedule: SummarySchedule;
    metadata: ScheduleGenerationMetadata;
  }): Promise<WorkflowDraftResult> => {
    if (!draft) return { success: false, error: 'No active draft' };
    
    setIsSaving(true);
    setError(null);
    
    try {
      const result = await draftService.updateDraftWithSummarySchedule(
        draft.draftId,
        summaryData
      );
      
      if (result.success) {
        await loadDraft(draft.draftId);
      } else {
        setError(result.error || 'Failed to update summary');
      }
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update summary';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [draft, loadDraft]);
  
  // Publish draft
  const publishDraft = useCallback(async (): Promise<WorkflowDraftResult> => {
    if (!draft) return { success: false, error: 'No active draft' };
    
    setIsSaving(true);
    setError(null);
    
    try {
      const result = await draftService.publishDraft(draft.draftId);
      
      if (result.success) {
        setDraft(null); // Clear draft after publishing
      } else {
        setError(result.error || 'Failed to publish');
      }
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to publish';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [draft]);
  
  // Delete draft
  const deleteDraft = useCallback(async (): Promise<WorkflowDraftResult> => {
    if (!draft) return { success: false, error: 'No active draft' };
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await draftService.deleteDraft(draft.draftId);
      
      if (result.success) {
        setDraft(null);
      } else {
        setError(result.error || 'Failed to delete draft');
      }
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete draft';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [draft]);
  
  // Refresh draft
  const refreshDraft = useCallback(async (): Promise<void> => {
    if (draft) {
      await loadDraft(draft.draftId);
    }
  }, [draft, loadDraft]);
  
  // Initialize with provided draftId or session draft
  useEffect(() => {
    const initializeDraft = async () => {
      let draftIdToLoad = draftId;
      
      // If no draftId provided, check for session draft
      if (!draftIdToLoad) {
        const sessionDraftId = draftService.getCurrentSessionDraftId();
        if (sessionDraftId) {
          draftIdToLoad = sessionDraftId;
        }
      }
      
      if (draftIdToLoad) {
        await loadDraft(draftIdToLoad);
      }
    };
    
    initializeDraft();
  }, [draftId, loadDraft]);
  
  return {
    draft,
    loading,
    error,
    isSaving,
    lastSaved,
    createDraftFromUpload,
    updateTimepointsAnalysis,
    updateBlockConfiguration,
    updateSummarySchedule,
    publishDraft,
    deleteDraft,
    refreshDraft
  };
};
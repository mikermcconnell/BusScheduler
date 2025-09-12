/**
 * Workspace Context
 * Centralized state management for the Schedule Command Center
 * Integrates with React 19 concurrent features and existing services
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo,
  startTransition
} from 'react';
import { workspaceEventBus, emit, subscribe, unsubscribe } from '../services/workspaceEventBus';
import { isScheduleDataEvent, isWorkflowProgressEvent, isPanelStateEvent } from '../services/workspaceEventBus';
import { draftService, UnifiedDraftCompat } from '../services/draftService';
import { WorkflowDraftState } from '../types/workflow';
import { Schedule, SummarySchedule, ServiceBand } from '../types/schedule';
import { WorkspaceEvent, WorkspaceEventInput } from '../types/workspaceEvents';
import { ValidationResult } from '../utils/validator';
import { useFeatureFlags } from './FeatureFlagContext';
import { AUTO_SAVE_CONFIG, AUTO_SAVE_CONTEXTS } from '../config/autoSave';

/**
 * Panel state management
 */
export interface PanelState {
  id: string;
  type: 'upload' | 'timepoints' | 'blocks' | 'summary' | 'connections' | 'library' | 'analytics';
  isOpen: boolean;
  isMinimized: boolean;
  position: { x: number; y: number; width: number; height: number };
  dockZone?: 'left' | 'right' | 'bottom' | 'center';
  isDocked: boolean;
  zIndex: number;
  data?: any;
}

/**
 * Validation state for the workspace
 */
export interface WorkspaceValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedSteps: string[];
  lastValidated: string | null;
}

/**
 * Current schedule data state
 */
export interface ScheduleDataState {
  currentDraft: UnifiedDraftCompat | null;
  summarySchedule: SummarySchedule | null;
  serviceBands: ServiceBand[];
  isDirty: boolean;
  lastSaved: string | null;
  autoSaveEnabled: boolean;
}

/**
 * Overall workspace state
 */
export interface WorkspaceState {
  // Core state
  activePanel: string | null;
  panels: Record<string, PanelState>;
  
  // Schedule data
  scheduleData: ScheduleDataState;
  
  // Validation
  validation: WorkspaceValidationState;
  
  // Workflow
  currentStep: 'upload' | 'timepoints' | 'blocks' | 'summary' | 'ready-to-publish';
  progress: number;
  canProceed: boolean;
  
  // UI state
  layout: 'wizard' | 'command-center';
  isLoading: boolean;
  sidebarOpen: boolean;
  
  // Performance
  lastRender: number;
  renderCount: number;
}

/**
 * Workspace actions
 */
type WorkspaceAction = 
  | { type: 'SET_ACTIVE_PANEL'; payload: string | null }
  | { type: 'OPEN_PANEL'; payload: { id: string; type: PanelState['type']; data?: any } }
  | { type: 'CLOSE_PANEL'; payload: string }
  | { type: 'MINIMIZE_PANEL'; payload: string }
  | { type: 'MAXIMIZE_PANEL'; payload: string }
  | { type: 'DOCK_PANEL'; payload: { id: string; zone: PanelState['dockZone']; position: PanelState['position'] } }
  | { type: 'UPDATE_PANEL_POSITION'; payload: { id: string; position: PanelState['position'] } }
  | { type: 'SET_SCHEDULE_DATA'; payload: Partial<ScheduleDataState> }
  | { type: 'SET_CURRENT_DRAFT'; payload: UnifiedDraftCompat | null }
  | { type: 'UPDATE_DRAFT_NAME'; payload: { draftId: string; draftName: string } }
  | { type: 'SET_VALIDATION_STATE'; payload: Partial<WorkspaceValidationState> }
  | { type: 'SET_WORKFLOW_STEP'; payload: { step: WorkspaceState['currentStep']; progress: number; canProceed: boolean } }
  | { type: 'SET_LAYOUT'; payload: 'wizard' | 'command-center' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'RESET_WORKSPACE' }
  | { type: 'UPDATE_PERFORMANCE_METRICS' };

/**
 * Initial state
 */
const initialState: WorkspaceState = {
  activePanel: null,
  panels: {},
  scheduleData: {
    currentDraft: null,
    summarySchedule: null,
    serviceBands: [],
    isDirty: false,
    lastSaved: null,
    autoSaveEnabled: true
  },
  validation: {
    isValid: false,
    errors: [],
    warnings: [],
    validatedSteps: [],
    lastValidated: null
  },
  currentStep: 'upload',
  progress: 0,
  canProceed: false,
  layout: 'wizard',
  isLoading: false,
  sidebarOpen: true,
  lastRender: Date.now(),
  renderCount: 0
};

/**
 * Workspace reducer
 */
function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'SET_ACTIVE_PANEL':
      return {
        ...state,
        activePanel: action.payload
      };
      
    case 'OPEN_PANEL':
      const { id, type, data } = action.payload;
      const newPanel: PanelState = {
        id,
        type,
        isOpen: true,
        isMinimized: false,
        position: { x: 100 + Object.keys(state.panels).length * 50, y: 100, width: 600, height: 400 },
        isDocked: false,
        zIndex: Math.max(...Object.values(state.panels).map(p => p.zIndex), 0) + 1,
        data
      };
      
      return {
        ...state,
        panels: {
          ...state.panels,
          [id]: newPanel
        },
        activePanel: id
      };
      
    case 'CLOSE_PANEL':
      const { [action.payload]: removedPanel, ...remainingPanels } = state.panels;
      return {
        ...state,
        panels: remainingPanels,
        activePanel: state.activePanel === action.payload ? null : state.activePanel
      };
      
    case 'MINIMIZE_PANEL':
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.payload]: {
            ...state.panels[action.payload],
            isMinimized: true
          }
        }
      };
      
    case 'MAXIMIZE_PANEL':
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.payload]: {
            ...state.panels[action.payload],
            isMinimized: false
          }
        }
      };
      
    case 'DOCK_PANEL':
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.payload.id]: {
            ...state.panels[action.payload.id],
            dockZone: action.payload.zone,
            isDocked: true,
            position: action.payload.position
          }
        }
      };
      
    case 'UPDATE_PANEL_POSITION':
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.payload.id]: {
            ...state.panels[action.payload.id],
            position: action.payload.position
          }
        }
      };
      
    case 'SET_SCHEDULE_DATA':
      return {
        ...state,
        scheduleData: {
          ...state.scheduleData,
          ...action.payload
        }
      };
      
    case 'SET_CURRENT_DRAFT':
      return {
        ...state,
        scheduleData: {
          ...state.scheduleData,
          currentDraft: action.payload
        }
      };
      
    case 'UPDATE_DRAFT_NAME':
      return {
        ...state,
        scheduleData: {
          ...state.scheduleData,
          currentDraft: state.scheduleData.currentDraft?.draftId === action.payload.draftId
            ? { ...state.scheduleData.currentDraft, draftName: action.payload.draftName }
            : state.scheduleData.currentDraft
        }
      };
      
    case 'SET_VALIDATION_STATE':
      return {
        ...state,
        validation: {
          ...state.validation,
          ...action.payload
        }
      };
      
    case 'SET_WORKFLOW_STEP':
      return {
        ...state,
        currentStep: action.payload.step,
        progress: action.payload.progress,
        canProceed: action.payload.canProceed
      };
      
    case 'SET_LAYOUT':
      return {
        ...state,
        layout: action.payload
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
      
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen
      };
      
    case 'RESET_WORKSPACE':
      return {
        ...initialState,
        layout: state.layout // Preserve layout
      };
      
    case 'UPDATE_PERFORMANCE_METRICS':
      return {
        ...state,
        lastRender: Date.now(),
        renderCount: state.renderCount + 1
      };
      
    default:
      return state;
  }
}

/**
 * Workspace Context Type
 */
interface WorkspaceContextType {
  // State
  state: WorkspaceState;
  
  // Panel actions
  setActivePanel: (panelId: string | null) => void;
  openPanel: (id: string, type: PanelState['type'], data?: any) => void;
  closePanel: (id: string) => void;
  minimizePanel: (id: string) => void;
  maximizePanel: (id: string) => void;
  dockPanel: (id: string, zone: PanelState['dockZone'], position: PanelState['position']) => void;
  updatePanelPosition: (id: string, position: PanelState['position']) => void;
  
  // Schedule data actions
  setScheduleData: (data: Partial<ScheduleDataState>) => void;
  updateScheduleData: (data: Partial<ScheduleDataState>) => void; // Alias for panels
  setCurrentDraft: (draft: UnifiedDraftCompat | null) => void;
  loadDraft: (draftId: string) => Promise<void>;
  saveDraft: () => Promise<void>;
  
  // Validation actions
  validateWorkspace: () => Promise<void>;
  setValidationState: (state: Partial<WorkspaceValidationState>) => void;
  
  // Workflow actions
  setWorkflowStep: (step: WorkspaceState['currentStep'], progress: number, canProceed: boolean) => void;
  proceedToNextStep: () => void;
  
  // Layout actions
  setLayout: (layout: 'wizard' | 'command-center') => void;
  toggleSidebar: () => void;
  
  // Utility actions
  resetWorkspace: () => void;
  refreshData: () => Promise<void>;
  
  // Panel compatibility - direct access to frequently used state
  scheduleData: ScheduleDataState;
  validation: WorkspaceValidationState;
  emitEvent: (event: WorkspaceEventInput) => Promise<void>;
}

/**
 * Create context
 */
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

/**
 * Workspace Provider Props
 */
interface WorkspaceProviderProps {
  children: ReactNode;
}

/**
 * Workspace Provider Component
 */
export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const { isCommandCenter } = useFeatureFlags();
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  /**
   * Set layout based on feature flags
   */
  useEffect(() => {
    const layout = isCommandCenter ? 'command-center' : 'wizard';
    dispatch({ type: 'SET_LAYOUT', payload: layout });
  }, [isCommandCenter]);

  /**
   * Subscribe to workspace events
   */
  useEffect(() => {
    const subscriptions: string[] = [];

    // Subscribe to panel state events
    subscriptions.push(
      subscribe('panel-state', (event) => {
        if (isPanelStateEvent(event)) {
          const { panelId, action, position, dockZone } = event.payload;
          
          switch (action) {
            case 'open':
              // Panel opening handled via openPanel action
              break;
            case 'close':
              dispatch({ type: 'CLOSE_PANEL', payload: panelId });
              break;
            case 'minimize':
              dispatch({ type: 'MINIMIZE_PANEL', payload: panelId });
              break;
            case 'maximize':
              dispatch({ type: 'MAXIMIZE_PANEL', payload: panelId });
              break;
            case 'dock':
              if (position && dockZone) {
                dispatch({ type: 'DOCK_PANEL', payload: { id: panelId, zone: dockZone, position } });
              }
              break;
          }
        }
      })
    );

    // Subscribe to schedule data events
    subscriptions.push(
      subscribe('schedule-data', (event) => {
        if (isScheduleDataEvent(event)) {
          // Handle schedule data updates
          startTransition(() => {
            dispatch({ type: 'SET_SCHEDULE_DATA', payload: { isDirty: true } });
          });
        }
      })
    );

    // Subscribe to workflow progress events
    subscriptions.push(
      subscribe('workflow-progress', (event) => {
        if (isWorkflowProgressEvent(event)) {
          const { currentStep, progress, canProceed } = event.payload;
          dispatch({ 
            type: 'SET_WORKFLOW_STEP', 
            payload: { step: currentStep, progress, canProceed } 
          });
        }
      })
    );

    // Subscribe to draft update events
    subscriptions.push(
      subscribe('draft-update', (event) => {
        if (event.type === 'draft-update' && event.payload.updateType === 'name') {
          dispatch({ 
            type: 'UPDATE_DRAFT_NAME', 
            payload: { 
              draftId: event.payload.draftId, 
              draftName: event.payload.draftName 
            } 
          });
        }
      })
    );

    return () => {
      subscriptions.forEach(id => unsubscribe(id));
    };
  }, []);

  /**
   * Auto-save functionality with optimized timing
   */
  useEffect(() => {
    if (state.scheduleData.isDirty && state.scheduleData.autoSaveEnabled) {
      const autoSaveTimer = setTimeout(() => {
        saveDraft();
      }, AUTO_SAVE_CONFIG.NAVIGATION_AUTO_SAVE); // 3s optimal interval

      return () => clearTimeout(autoSaveTimer);
    }
  }, [state.scheduleData.isDirty]);

  /**
   * Panel actions
   */
  const setActivePanel = useCallback((panelId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: panelId });
    
    emit({
      type: 'panel-state',
      source: 'workspace',
      priority: 1,
      payload: {
        panelId: panelId || '',
        action: 'open'
      }
    });
  }, []);

  const openPanel = useCallback((id: string, type: PanelState['type'], data?: any) => {
    dispatch({ type: 'OPEN_PANEL', payload: { id, type, data } });
    
    emit({
      type: 'panel-state',
      source: 'workspace',
      priority: 1,
      payload: {
        panelId: id,
        action: 'open'
      }
    });
  }, []);

  const closePanel = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_PANEL', payload: id });
    
    emit({
      type: 'panel-state',
      source: 'workspace',
      priority: 1,
      payload: {
        panelId: id,
        action: 'close'
      }
    });
  }, []);

  const minimizePanel = useCallback((id: string) => {
    dispatch({ type: 'MINIMIZE_PANEL', payload: id });
  }, []);

  const maximizePanel = useCallback((id: string) => {
    dispatch({ type: 'MAXIMIZE_PANEL', payload: id });
  }, []);

  const dockPanel = useCallback((id: string, zone: PanelState['dockZone'], position: PanelState['position']) => {
    dispatch({ type: 'DOCK_PANEL', payload: { id, zone, position } });
  }, []);

  const updatePanelPosition = useCallback((id: string, position: PanelState['position']) => {
    dispatch({ type: 'UPDATE_PANEL_POSITION', payload: { id, position } });
  }, []);

  /**
   * Schedule data actions
   */
  const setScheduleData = useCallback((data: Partial<ScheduleDataState>) => {
    dispatch({ type: 'SET_SCHEDULE_DATA', payload: data });
  }, []);

  // Alias for panel compatibility
  const updateScheduleData = setScheduleData;

  // Event emitter for panels
  const emitEvent = useCallback(async (event: WorkspaceEventInput) => {
    await emit(event);
  }, []);

  const setCurrentDraft = useCallback((draft: UnifiedDraftCompat | null) => {
    dispatch({ type: 'SET_CURRENT_DRAFT', payload: draft });
  }, []);

  const loadDraft = useCallback(async (draftId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const draft = await draftService.getDraft(draftId, 'anonymous');
      if (draft) {
        setCurrentDraft(draft);
        
        // Set workflow step based on draft progress
        dispatch({
          type: 'SET_WORKFLOW_STEP',
          payload: {
            step: draft.currentStep,
            progress: draft.progress,
            canProceed: true
          }
        });
        
        emit({
          type: 'workflow-progress',
          source: 'workspace',
          priority: 1,
          payload: {
            currentStep: draft.currentStep,
            progress: draft.progress,
            canProceed: true,
            stepData: draft as any
          }
        });
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [setCurrentDraft]);

  const saveDraft = useCallback(async () => {
    if (!state.scheduleData.currentDraft) return;
    
    try {
      await draftService.saveDraft(state.scheduleData.currentDraft, 'anonymous');
      
      dispatch({
        type: 'SET_SCHEDULE_DATA',
        payload: {
          isDirty: false,
          lastSaved: new Date().toISOString()
        }
      });
      
      emit({
        type: 'auto-save',
        source: 'workspace',
        priority: 1,
        payload: {
          draftId: state.scheduleData.currentDraft.draftId,
          status: 'saved',
          lastSaved: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
      
      emit({
        type: 'auto-save',
        source: 'workspace',
        priority: 1,
        payload: {
          draftId: state.scheduleData.currentDraft.draftId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }, [state.scheduleData.currentDraft]);

  /**
   * Validation actions
   */
  const validateWorkspace = useCallback(async () => {
    // Implement workspace validation logic
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!state.scheduleData.currentDraft) {
      errors.push('No active draft to validate');
    }
    
    const validationState = {
      isValid: errors.length === 0,
      errors,
      warnings,
      lastValidated: new Date().toISOString()
    };
    
    dispatch({ type: 'SET_VALIDATION_STATE', payload: validationState });
    
    emit({
      type: 'data-validation',
      source: 'workspace',
      priority: 1,
      payload: {
        validationId: Date.now().toString(),
        status: validationState.isValid ? 'valid' : 'invalid',
        errors,
        warnings
      }
    });
  }, [state.scheduleData.currentDraft]);

  const setValidationState = useCallback((validationState: Partial<WorkspaceValidationState>) => {
    dispatch({ type: 'SET_VALIDATION_STATE', payload: validationState });
  }, []);

  /**
   * Workflow actions
   */
  const setWorkflowStep = useCallback((step: WorkspaceState['currentStep'], progress: number, canProceed: boolean) => {
    dispatch({ type: 'SET_WORKFLOW_STEP', payload: { step, progress, canProceed } });
  }, []);

  const proceedToNextStep = useCallback(() => {
    const stepOrder: WorkspaceState['currentStep'][] = ['upload', 'timepoints', 'blocks', 'summary', 'ready-to-publish'];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    const nextStep = stepOrder[currentIndex + 1];
    
    if (nextStep) {
      const progress = ((currentIndex + 2) / stepOrder.length) * 100;
      setWorkflowStep(nextStep, progress, true);
    }
  }, [state.currentStep, setWorkflowStep]);

  /**
   * Layout actions
   */
  const setLayout = useCallback((layout: 'wizard' | 'command-center') => {
    dispatch({ type: 'SET_LAYOUT', payload: layout });
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  /**
   * Utility actions
   */
  const resetWorkspace = useCallback(() => {
    dispatch({ type: 'RESET_WORKSPACE' });
    
    emit({
      type: 'workflow-progress',
      source: 'workspace',
      priority: 1,
      payload: {
        currentStep: 'upload',
        progress: 0,
        canProceed: false
      }
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (state.scheduleData.currentDraft) {
      await loadDraft(state.scheduleData.currentDraft.draftId);
    }
  }, [state.scheduleData.currentDraft, loadDraft]);

  /**
   * Performance tracking
   */
  useEffect(() => {
    dispatch({ type: 'UPDATE_PERFORMANCE_METRICS' });
  });

  const value = useMemo<WorkspaceContextType>(() => ({
    // State
    state,
    
    // Panel actions
    setActivePanel,
    openPanel,
    closePanel,
    minimizePanel,
    maximizePanel,
    dockPanel,
    updatePanelPosition,
    
    // Schedule data actions
    setScheduleData,
    updateScheduleData,
    setCurrentDraft,
    loadDraft,
    saveDraft,
    
    // Validation actions
    validateWorkspace,
    setValidationState,
    
    // Workflow actions
    setWorkflowStep,
    proceedToNextStep,
    
    // Layout actions
    setLayout,
    toggleSidebar,
    
    // Utility actions
    resetWorkspace,
    refreshData,
    
    // Panel compatibility - direct access
    scheduleData: state.scheduleData,
    validation: state.validation,
    emitEvent
  }), [
    state,
    setActivePanel,
    openPanel,
    closePanel,
    minimizePanel,
    maximizePanel,
    dockPanel,
    updatePanelPosition,
    setScheduleData,
    updateScheduleData,
    setCurrentDraft,
    loadDraft,
    saveDraft,
    validateWorkspace,
    setValidationState,
    setWorkflowStep,
    proceedToNextStep,
    setLayout,
    toggleSidebar,
    resetWorkspace,
    refreshData,
    emitEvent
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

/**
 * Hook to use workspace context
 */
export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

/**
 * Hook to use workspace state only
 */
export const useWorkspaceState = (): WorkspaceState => {
  const { state } = useWorkspace();
  return state;
};
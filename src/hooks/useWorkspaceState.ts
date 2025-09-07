/**
 * Workspace State Hooks
 * Custom hooks for accessing and managing workspace state
 * Provides optimized selectors and reactive state subscriptions
 */

import { useCallback, useMemo } from 'react';
import { useWorkspace, useWorkspaceState } from '../contexts/WorkspaceContext';
import { PanelState, WorkspaceState } from '../contexts/WorkspaceContext';

/**
 * Hook to get active panel
 */
export const useActivePanel = (): PanelState | null => {
  const state = useWorkspaceState();
  return useMemo(() => {
    if (!state.activePanel) return null;
    return state.panels[state.activePanel] || null;
  }, [state.activePanel, state.panels]);
};

/**
 * Hook to get specific panel by ID
 */
export const usePanel = (panelId: string): PanelState | null => {
  const state = useWorkspaceState();
  return useMemo(() => state.panels[panelId] || null, [state.panels, panelId]);
};

/**
 * Hook to get all open panels
 */
export const useOpenPanels = (): PanelState[] => {
  const state = useWorkspaceState();
  return useMemo(() => 
    Object.values(state.panels).filter(panel => panel.isOpen),
    [state.panels]
  );
};

/**
 * Hook to get panels by type
 */
export const usePanelsByType = (type: PanelState['type']): PanelState[] => {
  const state = useWorkspaceState();
  return useMemo(() => 
    Object.values(state.panels).filter(panel => panel.type === type),
    [state.panels, type]
  );
};

/**
 * Hook to get docked panels by zone
 */
export const useDockedPanels = (zone?: PanelState['dockZone']): PanelState[] => {
  const state = useWorkspaceState();
  return useMemo(() => {
    const docked = Object.values(state.panels).filter(panel => panel.isDocked);
    return zone ? docked.filter(panel => panel.dockZone === zone) : docked;
  }, [state.panels, zone]);
};

/**
 * Hook to check if a panel is open
 */
export const usePanelOpen = (panelId: string): boolean => {
  const panel = usePanel(panelId);
  return panel?.isOpen || false;
};

/**
 * Hook to get current draft
 */
export const useCurrentDraft = () => {
  const state = useWorkspaceState();
  return state.scheduleData.currentDraft;
};

/**
 * Hook to get schedule data
 */
export const useScheduleData = () => {
  const state = useWorkspaceState();
  return state.scheduleData;
};

/**
 * Hook to get validation state
 */
export const useValidationState = () => {
  const state = useWorkspaceState();
  return state.validation;
};

/**
 * Hook to get workflow state
 */
export const useWorkflowState = () => {
  const state = useWorkspaceState();
  return {
    currentStep: state.currentStep,
    progress: state.progress,
    canProceed: state.canProceed
  };
};

/**
 * Hook to check if workspace is in command center mode
 */
export const useIsCommandCenter = (): boolean => {
  const state = useWorkspaceState();
  return state.layout === 'command-center';
};

/**
 * Hook to check if workspace is loading
 */
export const useWorkspaceLoading = (): boolean => {
  const state = useWorkspaceState();
  return state.isLoading;
};

/**
 * Hook to check if data is dirty (unsaved changes)
 */
export const useDataDirty = (): boolean => {
  const state = useWorkspaceState();
  return state.scheduleData.isDirty;
};

/**
 * Hook to get last saved timestamp
 */
export const useLastSaved = (): string | null => {
  const state = useWorkspaceState();
  return state.scheduleData.lastSaved;
};

/**
 * Hook for panel management actions
 */
export const usePanelActions = () => {
  const { 
    openPanel, 
    closePanel, 
    minimizePanel, 
    maximizePanel, 
    dockPanel, 
    updatePanelPosition 
  } = useWorkspace();
  
  return {
    openPanel,
    closePanel,
    minimizePanel,
    maximizePanel,
    dockPanel,
    updatePanelPosition
  };
};

/**
 * Hook for schedule data actions
 */
export const useScheduleActions = () => {
  const { 
    setScheduleData, 
    setCurrentDraft, 
    loadDraft, 
    saveDraft,
    refreshData
  } = useWorkspace();
  
  return {
    setScheduleData,
    setCurrentDraft,
    loadDraft,
    saveDraft,
    refreshData
  };
};

/**
 * Hook for workflow actions
 */
export const useWorkflowActions = () => {
  const { 
    setWorkflowStep, 
    proceedToNextStep 
  } = useWorkspace();
  
  return {
    setWorkflowStep,
    proceedToNextStep
  };
};

/**
 * Hook to get workspace performance metrics
 */
export const useWorkspaceMetrics = () => {
  const state = useWorkspaceState();
  return {
    renderCount: state.renderCount,
    lastRender: state.lastRender,
    panelCount: Object.keys(state.panels).length,
    openPanelCount: Object.values(state.panels).filter(p => p.isOpen).length
  };
};

/**
 * Hook to manage panel focus
 */
export const usePanelFocus = () => {
  const { setActivePanel } = useWorkspace();
  
  const focusPanel = useCallback((panelId: string) => {
    setActivePanel(panelId);
  }, [setActivePanel]);
  
  const blurPanel = useCallback(() => {
    setActivePanel(null);
  }, [setActivePanel]);
  
  return { focusPanel, blurPanel };
};

/**
 * Hook for optimized panel rendering
 */
export const usePanelRenderer = (panelId: string) => {
  const panel = usePanel(panelId);
  const { updatePanelPosition } = useWorkspace();
  
  const shouldRender = useMemo(() => {
    if (!panel) return false;
    return panel.isOpen && !panel.isMinimized;
  }, [panel]);
  
  const updatePosition = useCallback((position: PanelState['position']) => {
    updatePanelPosition(panelId, position);
  }, [panelId, updatePanelPosition]);
  
  return {
    panel,
    shouldRender,
    updatePosition
  };
};

/**
 * Hook to get workspace layout info
 */
export const useWorkspaceLayout = () => {
  const state = useWorkspaceState();
  const { setLayout, toggleSidebar } = useWorkspace();
  
  return {
    layout: state.layout,
    sidebarOpen: state.sidebarOpen,
    setLayout,
    toggleSidebar,
    isWizardMode: state.layout === 'wizard',
    isCommandCenter: state.layout === 'command-center'
  };
};

/**
 * Hook for workspace keyboard shortcuts
 */
export const useWorkspaceShortcuts = () => {
  const { 
    toggleSidebar,
    resetWorkspace,
    saveDraft 
  } = useWorkspace();
  
  const shortcuts = useMemo(() => ({
    'ctrl+s': saveDraft,
    'ctrl+shift+s': toggleSidebar,
    'ctrl+shift+r': resetWorkspace,
  }), [saveDraft, toggleSidebar, resetWorkspace]);
  
  return shortcuts;
};
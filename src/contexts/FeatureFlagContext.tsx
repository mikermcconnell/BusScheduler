/**
 * Feature Flag Context
 * Provides feature flag state and controls throughout the React application
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { featureFlags, FeatureFlag, isCommandCenterMode } from '../utils/featureFlags';

/**
 * Feature Flag Context Type
 */
interface FeatureFlagContextType {
  // Feature flag states
  isCommandCenter: boolean;
  isWorkspacePanels: boolean;
  isRealTimeCollab: boolean;
  isAdvancedAnalytics: boolean;
  isConnectionScheduling: boolean;
  isDraftLibrary: boolean;
  isCsvInlineEditing: boolean;
  isNewScheduleEnabled: boolean;
  isEditScheduleEnabled: boolean;
  isBrowseSchedulesEnabled: boolean;
  isManageRoutesEnabled: boolean;
  isBlockConfigurationEnabled: boolean;
  
  // Control functions
  toggleCommandCenter: () => Promise<boolean>;
  setFeatureFlag: (flag: FeatureFlag, enabled: boolean) => Promise<void>;
  isFeatureEnabled: (flag: FeatureFlag) => boolean;
  getAllFlags: () => Record<FeatureFlag, boolean>;
  resetToDefaults: () => Promise<void>;
  
  // Loading state
  isLoading: boolean;
}

/**
 * Create the context
 */
const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

/**
 * Feature Flag Provider Props
 */
interface FeatureFlagProviderProps {
  children: ReactNode;
}

/**
 * Feature Flag Provider Component
 */
export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Feature flag states
  const [isCommandCenter, setIsCommandCenter] = useState(false);
  const [isWorkspacePanels, setIsWorkspacePanels] = useState(false);
  const [isRealTimeCollab, setIsRealTimeCollab] = useState(false);
  const [isAdvancedAnalytics, setIsAdvancedAnalytics] = useState(false);
  const [isConnectionScheduling, setIsConnectionScheduling] = useState(false);
  const [isDraftLibrary, setIsDraftLibrary] = useState(false);
  const [isCsvInlineEditing, setIsCsvInlineEditing] = useState(false);
  const [isNewScheduleEnabled, setIsNewScheduleEnabled] = useState(false);
  const [isEditScheduleEnabled, setIsEditScheduleEnabled] = useState(false);
  const [isBrowseSchedulesEnabled, setIsBrowseSchedulesEnabled] = useState(false);
  const [isManageRoutesEnabled, setIsManageRoutesEnabled] = useState(false);
  const [isBlockConfigurationEnabled, setIsBlockConfigurationEnabled] = useState(false);

  /**
   * Initialize feature flags when user changes
   */
  useEffect(() => {
    const initializeFlags = async () => {
      setIsLoading(true);
      
      try {
        // Initialize without user ID
        await featureFlags.initialize(null);
        
        // Update all flag states
        updateAllFlagStates();
      } catch (error) {
        console.error('Failed to initialize feature flags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeFlags();
  }, []);

  /**
   * Update all flag states from the feature flag manager
   */
  const updateAllFlagStates = useCallback(() => {
    setIsCommandCenter(featureFlags.isEnabled(FeatureFlag.COMMAND_CENTER_MODE));
    setIsWorkspacePanels(featureFlags.isEnabled(FeatureFlag.WORKSPACE_PANELS));
    setIsRealTimeCollab(featureFlags.isEnabled(FeatureFlag.REAL_TIME_COLLAB));
    setIsAdvancedAnalytics(featureFlags.isEnabled(FeatureFlag.ADVANCED_ANALYTICS));
    setIsConnectionScheduling(featureFlags.isEnabled(FeatureFlag.CONNECTION_SCHEDULING));
    setIsDraftLibrary(featureFlags.isEnabled(FeatureFlag.DRAFT_LIBRARY));
    setIsCsvInlineEditing(featureFlags.isEnabled(FeatureFlag.CSV_INLINE_EDITING));
    setIsNewScheduleEnabled(featureFlags.isEnabled(FeatureFlag.NAV_NEW_SCHEDULE));
    setIsEditScheduleEnabled(featureFlags.isEnabled(FeatureFlag.NAV_EDIT_SCHEDULE));
    setIsBrowseSchedulesEnabled(featureFlags.isEnabled(FeatureFlag.NAV_BROWSE_SCHEDULES));
    setIsManageRoutesEnabled(featureFlags.isEnabled(FeatureFlag.NAV_MANAGE_ROUTES));
    setIsBlockConfigurationEnabled(featureFlags.isEnabled(FeatureFlag.NAV_BLOCK_CONFIGURATION));
  }, []);

  /**
   * Toggle Command Center mode
   */
  const toggleCommandCenter = useCallback(async () => {
    try {
      const newValue = await featureFlags.toggleCommandCenterMode();
      setIsCommandCenter(newValue);
      
      // Update workspace panels state as well
      if (newValue) {
        setIsWorkspacePanels(true);
      }
      
      // Dispatch custom event for other components to react
      window.dispatchEvent(new CustomEvent('commandCenterToggled', {
        detail: { enabled: newValue }
      }));
      
      return newValue;
    } catch (error) {
      console.error('Failed to toggle command center:', error);
      return false;
    }
  }, []);

  /**
   * Set a specific feature flag
   */
  const setFeatureFlag = useCallback(async (flag: FeatureFlag, enabled: boolean) => {
    try {
      await featureFlags.setFlag(flag, enabled);
      updateAllFlagStates();
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('featureFlagChanged', {
        detail: { flag, enabled }
      }));
    } catch (error) {
      console.error(`Failed to set feature flag ${flag}:`, error);
    }
  }, [updateAllFlagStates]);

  /**
   * Check if a feature is enabled
   */
  const isFeatureEnabled = useCallback((flag: FeatureFlag): boolean => {
    return featureFlags.isEnabled(flag);
  }, []);

  /**
   * Get all feature flags
   */
  const getAllFlags = useCallback((): Record<FeatureFlag, boolean> => {
    return featureFlags.getAllFlags();
  }, []);

  /**
   * Reset all flags to defaults
   */
  const resetToDefaults = useCallback(async () => {
    try {
      await featureFlags.resetToDefaults();
      updateAllFlagStates();
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('featureFlagsReset'));
    } catch (error) {
      console.error('Failed to reset feature flags:', error);
    }
  }, [updateAllFlagStates]);

  /**
   * Listen for feature flag changes from other tabs/windows
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'featureFlags') {
        updateAllFlagStates();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [updateAllFlagStates]);

  const value: FeatureFlagContextType = {
    // Feature flag states
    isCommandCenter,
    isWorkspacePanels,
    isRealTimeCollab,
    isAdvancedAnalytics,
    isConnectionScheduling,
    isDraftLibrary,
    isCsvInlineEditing,
    isNewScheduleEnabled,
    isEditScheduleEnabled,
    isBrowseSchedulesEnabled,
    isManageRoutesEnabled,
    isBlockConfigurationEnabled,
    
    // Control functions
    toggleCommandCenter,
    setFeatureFlag,
    isFeatureEnabled,
    getAllFlags,
    resetToDefaults,
    
    // Loading state
    isLoading
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

/**
 * Hook to use feature flags
 */
export const useFeatureFlags = (): FeatureFlagContextType => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

/**
 * Hook to check if Command Center is enabled
 */
export const useCommandCenter = (): boolean => {
  const { isCommandCenter } = useFeatureFlags();
  return isCommandCenter;
};

/**
 * Hook to check if a specific feature is enabled
 */
export const useFeature = (flag: FeatureFlag): boolean => {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(flag);
};

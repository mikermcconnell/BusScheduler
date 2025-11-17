/**
 * Feature Flag System
 * Manages feature toggles for gradual rollout and A/B testing
 * Integrates with localStorage and Firebase user preferences
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Available feature flags in the system
 */
export enum FeatureFlag {
  // Schedule Command Center vs Linear Wizard
  COMMAND_CENTER_MODE = 'command_center_mode',
  // Enable workspace panels
  WORKSPACE_PANELS = 'workspace_panels',
  // Enable real-time collaboration
  REAL_TIME_COLLAB = 'real_time_collab',
  // Enable advanced analytics
  ADVANCED_ANALYTICS = 'advanced_analytics',
  // Enable connection schedule features
  CONNECTION_SCHEDULING = 'connection_scheduling',
  // Enable draft library view
  DRAFT_LIBRARY = 'draft_library',
  // Enable CSV editing in command center
  CSV_INLINE_EDITING = 'csv_inline_editing',
  // Navigation visibility controls
  NAV_NEW_SCHEDULE = 'nav_new_schedule',
  NAV_EDIT_SCHEDULE = 'nav_edit_schedule',
  NAV_BROWSE_SCHEDULES = 'nav_browse_schedules',
  NAV_MANAGE_ROUTES = 'nav_manage_routes',
  NAV_BLOCK_CONFIGURATION = 'nav_block_configuration'
}

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  name: string;
  description: string;
  defaultValue: boolean;
  rolloutPercentage?: number;
  userGroups?: string[];
  environments?: ('development' | 'staging' | 'production')[];
}

/**
 * User feature preferences stored in Firebase
 */
export interface UserFeaturePreferences {
  userId: string;
  flags: Record<FeatureFlag, boolean>;
  overrides: Record<FeatureFlag, boolean>;
  lastUpdated: string;
}

/**
 * Feature flag definitions with configurations
 */
const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  [FeatureFlag.COMMAND_CENTER_MODE]: {
    name: 'Schedule Command Center',
    description: 'Enable unified workspace view instead of linear wizard',
    defaultValue: false, // Start with wizard mode by default
    rolloutPercentage: 20, // 20% of users get Command Center
    environments: ['development', 'staging', 'production']
  },
  [FeatureFlag.WORKSPACE_PANELS]: {
    name: 'Workspace Panels',
    description: 'Enable dockable panel system for contextual editing',
    defaultValue: false,
    rolloutPercentage: 100, // Available to all when Command Center is on
    environments: ['development', 'staging', 'production']
  },
  [FeatureFlag.REAL_TIME_COLLAB]: {
    name: 'Real-time Collaboration',
    description: 'Enable multiple users to work on same schedule',
    defaultValue: false,
    rolloutPercentage: 0, // Not yet available
    environments: ['development']
  },
  [FeatureFlag.ADVANCED_ANALYTICS]: {
    name: 'Advanced Analytics',
    description: 'Enable advanced schedule analytics and insights',
    defaultValue: false,
    rolloutPercentage: 50,
    environments: ['development', 'staging', 'production']
  },
  [FeatureFlag.CONNECTION_SCHEDULING]: {
    name: 'Connection Scheduling',
    description: 'Enable GO Train and school bell connection features',
    defaultValue: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production']
  },
  [FeatureFlag.DRAFT_LIBRARY]: {
    name: 'Draft Library',
    description: 'Enable draft library management view',
    defaultValue: true,
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production']
  },
  [FeatureFlag.CSV_INLINE_EDITING]: {
    name: 'CSV Inline Editing',
    description: 'Enable direct CSV editing in command center',
    defaultValue: false,
    rolloutPercentage: 30,
    environments: ['development', 'staging']
  },
  [FeatureFlag.NAV_NEW_SCHEDULE]: {
    name: 'New Schedule Workflow',
    description: 'Enable access to the new schedule creation workflow',
    defaultValue: true,
    environments: ['development', 'staging']
  },
  [FeatureFlag.NAV_EDIT_SCHEDULE]: {
    name: 'Fixed Transit Workspace',
    description: 'Enable the consolidated Fixed Transit workflow entry point',
    defaultValue: true,
    environments: ['development', 'staging']
  },
  [FeatureFlag.NAV_BROWSE_SCHEDULES]: {
    name: 'Browse Schedules',
    description: 'Enable browsing previously published schedules',
    defaultValue: true,
    environments: ['development', 'staging']
  },
  [FeatureFlag.NAV_MANAGE_ROUTES]: {
    name: 'Manage Routes',
    description: 'Enable the manage routes section',
    defaultValue: true,
    environments: ['development', 'staging']
  },
  [FeatureFlag.NAV_BLOCK_CONFIGURATION]: {
    name: 'Block Configuration',
    description: 'Enable block configuration workflow',
    defaultValue: true,
    environments: ['development', 'staging']
  }
};

/**
 * Feature Flag Manager Class
 */
class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private localCache: Map<FeatureFlag, boolean>;
  private userId: string | null = null;
  private environment: 'development' | 'staging' | 'production';

  private constructor() {
    this.localCache = new Map();
    this.environment = this.detectEnvironment();
    this.loadFromLocalStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): 'development' | 'staging' | 'production' {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
    if (hostname.includes('staging')) {
      return 'staging';
    }
    return 'production';
  }

  /**
   * Load feature flags from localStorage
   */
  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem('featureFlags');
    if (stored) {
      try {
        const flags = JSON.parse(stored);
        Object.entries(flags).forEach(([key, value]) => {
          if (key in FeatureFlag) {
            this.localCache.set(key as FeatureFlag, value as boolean);
          }
        });
      } catch (error) {
        console.error('Failed to parse feature flags from localStorage:', error);
      }
    }
  }

  /**
   * Save feature flags to localStorage
   */
  private saveToLocalStorage(): void {
    const flags: Record<string, boolean> = {};
    this.localCache.forEach((value, key) => {
      flags[key] = value;
    });
    localStorage.setItem('featureFlags', JSON.stringify(flags));
  }

  /**
   * Initialize with user ID for personalized flags
   */
  async initialize(userId: string | null): Promise<void> {
    this.userId = userId;
    
    if (userId) {
      await this.loadUserPreferences(userId);
    } else {
      // Load default flags for anonymous users
      this.loadDefaults();
    }
  }

  /**
   * Load user preferences from Firebase
   */
  private async loadUserPreferences(userId: string): Promise<void> {
    try {
      const userDoc = doc(db, 'user_features', userId);
      const snapshot = await getDoc(userDoc);
      
      if (snapshot.exists()) {
        const prefs = snapshot.data() as UserFeaturePreferences;
        Object.entries(prefs.flags).forEach(([flag, enabled]) => {
          this.localCache.set(flag as FeatureFlag, enabled);
        });
      } else {
        // First time user - apply rollout logic
        await this.applyRolloutLogic(userId);
      }
    } catch (error) {
      console.error('Failed to load user feature preferences:', error);
      this.loadDefaults();
    }
    
    this.saveToLocalStorage();
  }

  /**
   * Apply rollout logic for new users
   */
  private async applyRolloutLogic(userId: string): Promise<void> {
    const flags: Record<FeatureFlag, boolean> = {} as any;
    
    Object.entries(FEATURE_FLAGS).forEach(([flag, config]) => {
      // Check if feature is available in current environment
      if (!config.environments?.includes(this.environment)) {
        flags[flag as FeatureFlag] = false;
        return;
      }
      
      // Apply rollout percentage
      if (config.rolloutPercentage !== undefined) {
        const hash = this.hashUserId(userId);
        const threshold = config.rolloutPercentage / 100;
        flags[flag as FeatureFlag] = hash < threshold;
      } else {
        flags[flag as FeatureFlag] = config.defaultValue;
      }
    });
    
    // Save to Firebase
    const userPrefs: UserFeaturePreferences = {
      userId,
      flags,
      overrides: {
        [FeatureFlag.COMMAND_CENTER_MODE]: false,
        [FeatureFlag.WORKSPACE_PANELS]: false,
        [FeatureFlag.REAL_TIME_COLLAB]: false,
        [FeatureFlag.ADVANCED_ANALYTICS]: false,
        [FeatureFlag.CONNECTION_SCHEDULING]: false,
        [FeatureFlag.DRAFT_LIBRARY]: false,
        [FeatureFlag.CSV_INLINE_EDITING]: false,
        [FeatureFlag.NAV_NEW_SCHEDULE]: false,
        [FeatureFlag.NAV_EDIT_SCHEDULE]: false,
        [FeatureFlag.NAV_BROWSE_SCHEDULES]: false,
        [FeatureFlag.NAV_MANAGE_ROUTES]: false,
        [FeatureFlag.NAV_BLOCK_CONFIGURATION]: false
      },
      lastUpdated: new Date().toISOString()
    };
    
    try {
      const userDoc = doc(db, 'user_features', userId);
      await setDoc(userDoc, userPrefs);
    } catch (error) {
      console.error('Failed to save user feature preferences:', error);
    }
    
    // Update local cache
    Object.entries(flags).forEach(([flag, enabled]) => {
      this.localCache.set(flag as FeatureFlag, enabled);
    });
  }

  /**
   * Hash user ID to number between 0 and 1 for rollout
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / Math.pow(2, 31);
  }

  /**
   * Load default feature flags
   */
  private loadDefaults(): void {
    Object.entries(FEATURE_FLAGS).forEach(([flag, config]) => {
      // Check environment availability
      if (!config.environments?.includes(this.environment)) {
        this.localCache.set(flag as FeatureFlag, false);
      } else {
        this.localCache.set(flag as FeatureFlag, config.defaultValue);
      }
    });
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flag: FeatureFlag): boolean {
    if (!this.localCache.has(flag)) {
      const config = FEATURE_FLAGS[flag];
      return config?.defaultValue || false;
    }
    return this.localCache.get(flag) || false;
  }

  /**
   * Set a feature flag value (for testing/override)
   */
  async setFlag(flag: FeatureFlag, enabled: boolean): Promise<void> {
    this.localCache.set(flag, enabled);
    this.saveToLocalStorage();
    
    // Update Firebase if user is authenticated
    if (this.userId) {
      try {
        const userDoc = doc(db, 'user_features', this.userId);
        await updateDoc(userDoc, {
          [`overrides.${flag}`]: enabled,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to update user feature flag:', error);
      }
    }
  }

  /**
   * Get all feature flags and their current values
   */
  getAllFlags(): Record<FeatureFlag, boolean> {
    const flags = {} as Record<FeatureFlag, boolean>;
    Object.values(FeatureFlag).forEach(flag => {
      flags[flag] = this.isEnabled(flag);
    });
    return flags;
  }

  /**
   * Get feature flag configuration
   */
  getFlagConfig(flag: FeatureFlag): FeatureFlagConfig | undefined {
    return FEATURE_FLAGS[flag];
  }

  /**
   * Reset all flags to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.loadDefaults();
    this.saveToLocalStorage();
    
    if (this.userId) {
      await this.applyRolloutLogic(this.userId);
    }
  }

  /**
   * Check if Command Center mode is enabled
   */
  isCommandCenterEnabled(): boolean {
    return this.isEnabled(FeatureFlag.COMMAND_CENTER_MODE);
  }

  /**
   * Toggle between Command Center and Wizard mode
   */
  async toggleCommandCenterMode(): Promise<boolean> {
    const currentValue = this.isEnabled(FeatureFlag.COMMAND_CENTER_MODE);
    await this.setFlag(FeatureFlag.COMMAND_CENTER_MODE, !currentValue);
    
    // If enabling Command Center, also enable workspace panels
    if (!currentValue) {
      await this.setFlag(FeatureFlag.WORKSPACE_PANELS, true);
    }
    
    return !currentValue;
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance();

// Export convenience functions
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  return featureFlags.isEnabled(flag);
};

export const isCommandCenterMode = (): boolean => {
  return featureFlags.isCommandCenterEnabled();
};

export const toggleCommandCenter = async (): Promise<boolean> => {
  return featureFlags.toggleCommandCenterMode();
};

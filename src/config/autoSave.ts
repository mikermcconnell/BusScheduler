/**
 * Centralized Auto-Save Configuration
 * Optimal intervals and settings for consistent auto-save behavior
 */

export const AUTO_SAVE_CONFIG = {
  // Core intervals (in milliseconds)
  USER_TYPING_DEBOUNCE: 1500,     // 1.5s after user stops typing
  NAVIGATION_AUTO_SAVE: 3000,     // 3s before page changes
  BACKGROUND_SYNC: 45000,         // 45s background sync to cloud
  FORM_INPUT_SAVE: 2000,          // 2s for critical form inputs
  
  // Retry and reliability settings
  MAX_RETRIES: 3,                 // Number of retry attempts for failed saves
  RETRY_DELAY: 1000,              // Base delay between retries (exponential backoff)
  
  // User experience settings
  SHOW_SAVE_STATUS: true,         // Always show save indicator
  SUCCESS_MESSAGE_DURATION: 3000, // How long to show "saved" message
  ERROR_MESSAGE_DURATION: 6000,   // How long to show error messages
  
  // Performance settings
  BATCH_SAVE_DELAY: 500,          // Batch multiple rapid saves
  MIN_SAVE_INTERVAL: 1000,        // Minimum time between actual saves
  
  // Feature flags
  ENABLE_OFFLINE_QUEUE: true,     // Queue saves when offline
  ENABLE_CONFLICT_RESOLUTION: false, // Disable for now, future feature
  ENABLE_SAVE_HISTORY: false,     // Disable for now, future feature
} as const;

/**
 * Network-aware auto-save intervals
 */
export const getAutoSaveInterval = (connectionType?: string): number => {
  switch (connectionType) {
    case 'slow-2g':
    case '2g':
      return AUTO_SAVE_CONFIG.BACKGROUND_SYNC; // 45s on slow connections
    case '3g':
      return AUTO_SAVE_CONFIG.NAVIGATION_AUTO_SAVE * 2; // 6s on 3g
    case '4g':
    case 'wifi':
      return AUTO_SAVE_CONFIG.FORM_INPUT_SAVE; // 2s on fast connections
    default:
      return AUTO_SAVE_CONFIG.NAVIGATION_AUTO_SAVE; // 3s default
  }
};

/**
 * Exponential backoff for retry attempts
 */
export const getRetryDelay = (attemptNumber: number): number => {
  return AUTO_SAVE_CONFIG.RETRY_DELAY * Math.pow(2, attemptNumber - 1);
};

/**
 * Auto-save status types
 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'offline';

/**
 * Auto-save state interface
 */
export interface AutoSaveState {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  nextSave: Date | null;
  isDirty: boolean;
  errorMessage?: string;
  retryCount: number;
}

/**
 * Create initial auto-save state
 */
export const createInitialAutoSaveState = (): AutoSaveState => ({
  status: 'idle',
  lastSaved: null,
  nextSave: null,
  isDirty: false,
  retryCount: 0,
});

/**
 * Auto-save context for different scenarios
 */
export const AUTO_SAVE_CONTEXTS = {
  USER_INPUT: {
    debounce: AUTO_SAVE_CONFIG.USER_TYPING_DEBOUNCE,
    showStatus: true,
    retryOnFailure: true,
  },
  PAGE_NAVIGATION: {
    debounce: 0, // Immediate save before navigation
    showStatus: true,
    retryOnFailure: true,
  },
  BACKGROUND_SYNC: {
    debounce: AUTO_SAVE_CONFIG.BACKGROUND_SYNC,
    showStatus: false, // Don't show status for background saves
    retryOnFailure: false,
  },
  CRITICAL_DATA: {
    debounce: AUTO_SAVE_CONFIG.FORM_INPUT_SAVE,
    showStatus: true,
    retryOnFailure: true,
  },
} as const;
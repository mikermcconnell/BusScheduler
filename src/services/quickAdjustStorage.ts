/**
 * Lightweight persistence for quick adjust uploads. Persists the raw CSV rows
 * so schedules can be rebuilt without asking the user to re-upload the file.
 */

const STORAGE_PREFIX = 'scheduler2_quick_adjust_raw_rows';

export interface StoredQuickAdjustUpload {
  rows: string[][];
  fileName?: string;
  savedAt: string;
}

export const quickAdjustStorage = {
  save(draftId: string, payload: StoredQuickAdjustUpload): void {
    if (!draftId || !Array.isArray(payload?.rows)) {
      return;
    }

    try {
      const storageKey = `${STORAGE_PREFIX}:${draftId}`;
      const serialized = JSON.stringify({
        rows: payload.rows,
        fileName: payload.fileName,
        savedAt: payload.savedAt
      });
      window.localStorage.setItem(storageKey, serialized);
    } catch (error) {
      console.warn('Unable to persist quick adjust upload payload:', error);
    }
  },

  load(draftId: string): StoredQuickAdjustUpload | null {
    if (!draftId) {
      return null;
    }

    try {
      const storageKey = `${STORAGE_PREFIX}:${draftId}`;
      const storedValue = window.localStorage.getItem(storageKey);
      if (!storedValue) {
        return null;
      }

      const parsed = JSON.parse(storedValue) as StoredQuickAdjustUpload;
      if (!Array.isArray(parsed?.rows)) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn('Unable to load quick adjust upload payload:', error);
      return null;
    }
  },

  clear(draftId: string): void {
    if (!draftId) {
      return;
    }

    try {
      const storageKey = `${STORAGE_PREFIX}:${draftId}`;
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Unable to clear quick adjust upload payload:', error);
    }
  }
};

export default quickAdjustStorage;

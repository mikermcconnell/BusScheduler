const REMEMBER_ME_KEY = 'scheduler2:rememberMe';

const hasBrowserStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

export const authPersistence = {
  getRememberMePreference(): boolean {
    if (!hasBrowserStorage()) {
      return false;
    }

    try {
      return window.localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    } catch (error) {
      console.warn('authPersistence: failed to read remember-me flag', error);
      return false;
    }
  },

  setRememberMePreference(remember: boolean): void {
    if (!hasBrowserStorage()) {
      return;
    }

    try {
      if (remember) {
        window.localStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        window.localStorage.removeItem(REMEMBER_ME_KEY);
      }
    } catch (error) {
      console.warn('authPersistence: failed to write remember-me flag', error);
    }
  },

  clear(): void {
    if (!hasBrowserStorage()) {
      return;
    }

    try {
      window.localStorage.removeItem(REMEMBER_ME_KEY);
    } catch (error) {
      console.warn('authPersistence: failed to clear remember-me flag', error);
    }
  }
};

export type AuthPersistenceService = typeof authPersistence;

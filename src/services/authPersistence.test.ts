import { authPersistence } from './authPersistence';

const STORAGE_KEY = 'scheduler2:rememberMe';

describe('authPersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  it('returns false when preference is unset', () => {
    expect(authPersistence.getRememberMePreference()).toBe(false);
  });

  it('stores and retrieves a remember preference', () => {
    authPersistence.setRememberMePreference(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(authPersistence.getRememberMePreference()).toBe(true);
  });

  it('removes preference when set to false', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    authPersistence.setRememberMePreference(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(authPersistence.getRememberMePreference()).toBe(false);
  });

  it('clears the stored preference', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    authPersistence.clear();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

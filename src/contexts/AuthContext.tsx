import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { draftService } from '../services/draftService';
import { firebaseStorage } from '../services/firebaseStorage';
import { authPersistence } from '../services/authPersistence';

interface Credentials {
  email: string;
  password: string;
  displayName?: string;
  remember?: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      draftService.setCurrentUser(firebaseUser?.uid ?? null);
      firebaseStorage.setUserContext(firebaseUser?.uid ?? null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const deriveErrorMessage = (err: unknown): string => {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as Error).message).replace('Firebase: ', '').replace('auth/', '');
    }
    return 'Authentication failed. Please try again.';
  };

  const ensurePersistence = useCallback(async (remember?: boolean) => {
    const shouldRemember =
      typeof remember === 'boolean' ? remember : authPersistence.getRememberMePreference();

    await setPersistence(auth, shouldRemember ? browserLocalPersistence : browserSessionPersistence);
    authPersistence.setRememberMePreference(shouldRemember);
  }, []);

  const signIn = useCallback(async ({ email, password, remember }: Credentials) => {
    setError(null);
    try {
      await ensurePersistence(remember);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const userId = credential?.user?.uid;
      if (userId) {
        firebaseStorage.setUserContext(userId);
      }
    } catch (err) {
      const message = deriveErrorMessage(err);
      setError(message);
      throw err;
    }
  }, [ensurePersistence]);

  const register = useCallback(async ({ email, password, displayName }: Credentials) => {
    setError(null);
    try {
      await ensurePersistence(true);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential?.user;
      if (user?.uid) {
        firebaseStorage.setUserContext(user.uid);
      }
      if (user && displayName) {
        await updateProfile(user, { displayName });
      }
    } catch (err) {
      const message = deriveErrorMessage(err);
      setError(message);
      throw err;
    }
  }, [ensurePersistence]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      draftService.setCurrentUser(null);
      firebaseStorage.clearUserContext();
    } catch (err) {
      const message = deriveErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    signIn,
    register,
    signOut,
    clearError
  }), [user, loading, error, signIn, register, signOut, clearError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

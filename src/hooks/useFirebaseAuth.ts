import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../config/firebase';

interface UseFirebaseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useFirebaseAuth = (): UseFirebaseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setIsLoading(false);
          console.log('🔥 Firebase authenticated:', currentUser.isAnonymous ? 'Anonymous' : currentUser.uid);
        } else {
          // Automatically sign in anonymously if no user is present
          console.log('🔥 No Firebase user - signing in anonymously...');
          try {
            const result = await signInAnonymously(auth);
            console.log('🔥 Anonymous authentication successful:', result.user.uid);
            // User will be set in the next onAuthStateChanged call
          } catch (authError: any) {
            console.error('🔥 Anonymous authentication failed:', authError);
            setError(authError.message);
            setIsLoading(false);
          }
        }
      },
      (error) => {
        console.error('Firebase auth state change error:', error);
        setError(error.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error
  };
};
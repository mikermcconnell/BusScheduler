/**
 * Authentication Context
 * Manages user authentication state and Google OAuth integration
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInAnonymously, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../config/firebase';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  authMethod?: 'google' | 'email' | 'anonymous';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<{ success: boolean; error?: string }>;
  firebaseUser: FirebaseUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gapi, setGapi] = useState<any>(null);
  
  // Bypass authentication for development
  const bypassAuth = process.env.REACT_APP_BYPASS_AUTH === 'true';

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        console.log('🔥 Firebase user authenticated:', firebaseUser.uid);
        
        // Check if user signed in with email link
        if (firebaseUser.email && !firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
          // User signed in with magic link
          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || 'user@scheduler.app',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            picture: firebaseUser.photoURL || '',
            accessToken: await firebaseUser.getIdToken(),
            authMethod: firebaseUser.isAnonymous ? 'anonymous' : 'email'
          };
          setUser(user);
          localStorage.setItem('scheduler2_user', JSON.stringify(user));
        } else if (firebaseUser.isAnonymous) {
          // Anonymous user
          const user: User = {
            id: firebaseUser.uid,
            email: 'user@scheduler.app',
            name: 'Schedule User',
            picture: '',
            accessToken: 'anonymous_token',
            authMethod: 'anonymous'
          };
          setUser(user);
        }
        // Google auth is handled separately by Google API
      } else {
        // No Firebase user, check if we need anonymous auth
        if (bypassAuth && !user) {
          try {
            const result = await signInAnonymously(auth);
            console.log('🔥 Signed in anonymously with Firebase:', result.user.uid);
          } catch (error) {
            console.error('Failed to sign in anonymously:', error);
          }
        }
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [bypassAuth]);

  // Initialize Google API or bypass
  useEffect(() => {
    const setupAuth = async () => {
      // Only initialize Google API if we have a client ID and not in bypass mode
      if (!bypassAuth && process.env.REACT_APP_GOOGLE_CLIENT_ID) {
        initializeGoogleAPI();
      }
    };
    
    setupAuth();
  }, [bypassAuth]);

  const initializeGoogleAPI = async () => {
    try {
      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn('Google API initialization timeout - falling back to anonymous mode');
        const mockUser: User = {
          id: 'anonymous_user',
          email: 'user@scheduler.app',
          name: 'Schedule User',
          picture: '',
          accessToken: 'anonymous_token'
        };
        setUser(mockUser);
        setIsLoading(false);
      }, 5000); // 5 second timeout

      // Load Google API script if not already loaded
      if (!(window as any).gapi) {
        await loadGoogleAPIScript();
      }

      const gapiInstance = (window as any).gapi;
      setGapi(gapiInstance);

      // Initialize the API
      await new Promise<void>((resolve, reject) => {
        gapiInstance.load('client:auth2', async () => {
          try {
            await gapiInstance.client.init({
              apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
              clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
              scope: 'https://www.googleapis.com/auth/drive.file profile email'
            });
            
            // Check if user is already signed in
            const authInstance = gapiInstance.auth2.getAuthInstance();
            const isSignedIn = authInstance.isSignedIn.get();
            
            if (isSignedIn) {
              const googleUser = authInstance.currentUser.get();
              setUserFromGoogleUser(googleUser);
            }
            
            // Listen for sign-in state changes
            authInstance.isSignedIn.listen((signedIn: boolean) => {
              if (signedIn) {
                const googleUser = authInstance.currentUser.get();
                setUserFromGoogleUser(googleUser);
              } else {
                setUser(null);
                localStorage.removeItem('scheduler2_user');
              }
            });
            
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });

    } catch (error) {
      console.error('Error initializing Google API:', error);
      // Fall back to anonymous mode on error
      const mockUser: User = {
        id: 'anonymous_user',
        email: 'user@scheduler.app',
        name: 'Schedule User',
        picture: '',
        accessToken: 'anonymous_token'
      };
      setUser(mockUser);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGoogleAPIScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.body.appendChild(script);
    });
  };

  const setUserFromGoogleUser = (googleUser: any) => {
    const profile = googleUser.getBasicProfile();
    const authResponse = googleUser.getAuthResponse();
    
    const user: User = {
      id: profile.getId(),
      email: profile.getEmail(),
      name: profile.getName(),
      picture: profile.getImageUrl(),
      accessToken: authResponse.access_token,
      authMethod: 'google'
    };
    
    setUser(user);
    
    // Persist user data
    localStorage.setItem('scheduler2_user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      authMethod: user.authMethod
    }));
  };

  const signIn = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (bypassAuth) {
        // Already signed in with mock user
        return { success: true };
      }
      
      if (!gapi) {
        return { success: false, error: 'Google API not initialized' };
      }

      const authInstance = gapi.auth2.getAuthInstance();
      const googleUser = await authInstance.signIn();
      
      setUserFromGoogleUser(googleUser);
      return { success: true };

    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Handle specific error cases
      if (error.error === 'popup_closed_by_user') {
        return { success: false, error: 'Sign-in was cancelled' };
      } else if (error.error === 'access_denied') {
        return { success: false, error: 'Access was denied' };
      } else {
        return { success: false, error: 'Failed to sign in. Please try again.' };
      }
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Sign out from Firebase (handles both email and anonymous)
      if (firebaseUser && !firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
        await firebaseSignOut(auth);
      }
      
      // Sign out from Google if applicable
      if (gapi && user?.authMethod === 'google') {
        const authInstance = gapi.auth2.getAuthInstance();
        await authInstance.signOut();
      }
      
      setUser(null);
      setFirebaseUser(null);
      localStorage.removeItem('scheduler2_user');
      localStorage.removeItem('scheduler2_emailForSignIn');
      
    } catch (error) {
      console.error('Sign out error:', error);
      // Force local sign out even if remote sign out fails
      setUser(null);
      setFirebaseUser(null);
      localStorage.removeItem('scheduler2_user');
      localStorage.removeItem('scheduler2_emailForSignIn');
    }
  };

  const refreshToken = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (bypassAuth) {
        // In bypass mode, token refresh always succeeds
        return { success: true };
      }
      
      if (!gapi || !user) {
        return { success: false, error: 'Not signed in' };
      }

      const authInstance = gapi.auth2.getAuthInstance();
      const googleUser = authInstance.currentUser.get();
      
      await googleUser.reloadAuthResponse();
      setUserFromGoogleUser(googleUser);
      
      return { success: true };

    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Failed to refresh authentication' };
    }
  };

  // Restore user from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('scheduler2_user');
    if (savedUser && !user && !isLoading) {
      try {
        JSON.parse(savedUser);
        // Don't set access token from localStorage for security
        // User will need to sign in again for API access
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('scheduler2_user');
      }
    }
  }, [user, isLoading]);

  const value: AuthContextType = {
    user,
    isLoading,
    isSignedIn: !!user,
    signIn,
    signOut,
    refreshToken,
    firebaseUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
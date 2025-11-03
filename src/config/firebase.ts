/**
 * Firebase Configuration
 * Set up Firebase app and services for the Scheduler2 application
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
// Firebase configuration
// Check if we have real Firebase config, otherwise use a flag to disable Firebase
const hasRealFirebaseConfig = process.env.REACT_APP_FIREBASE_API_KEY &&
  process.env.REACT_APP_FIREBASE_API_KEY !== "demo-api-key" &&
  process.env.REACT_APP_FIREBASE_API_KEY !== "AIzaSyFakeKeyForLocalStorageOnly";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyFakeKeyForLocalStorageOnly",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "scheduler2-local.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "scheduler2-local",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "scheduler2-local.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-ABCDEFGHIJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const functions = getFunctions(app);
const authInstance = getAuth(app);

// Initialize Analytics only in production with valid config
// Skip analytics if using fake/local config to avoid API key errors
export const analytics = (process.env.NODE_ENV === 'production' && hasRealFirebaseConfig) 
  ? getAnalytics(app) 
  : null;

// Track if emulators are already connected to prevent duplicate connections
let emulatorsConnected = false;

// Connect to emulators in development
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true' && !emulatorsConnected) {
  try {
    // Firestore emulator - connect without checking internal state
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error: any) {
      // Already connected error is expected on hot reload
      if (!error.message?.includes('already started')) {
        throw error;
      }
    }
    
    // Auth emulator
    try {
      connectAuthEmulator(authInstance, 'http://localhost:9099');
    } catch (error: any) {
      if (!error.message?.includes('auth/emulator-configured')) {
        throw error;
      }
    }

    // Functions emulator
    try {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    } catch (error: any) {
      // Already connected error is expected on hot reload
      if (!error.message?.includes('already connected')) {
        throw error;
      }
    }
    
    emulatorsConnected = true;
    console.log('🔥 Firebase emulators connected');
  } catch (error) {
    console.warn('Firebase emulator connection failed:', error);
  }
}

export const auth = authInstance;

// Export the initialized app
export default app;

// Utility functions for Firebase operations
export const getFirebaseErrorMessage = (error: any): string => {
  switch (error.code) {
    case 'permission-denied':
      return 'You do not have permission to perform this action.';
    case 'unavailable':
      return 'Firebase service is currently unavailable. Please try again later.';
    case 'unauthenticated':
      return 'Authentication required for this operation.';
    case 'not-found':
      return 'The requested document was not found.';
    case 'already-exists':
      return 'A document with this ID already exists.';
    case 'resource-exhausted':
      return 'Firebase quota exceeded. Please try again later.';
    case 'cancelled':
      return 'The operation was cancelled.';
    case 'data-loss':
      return 'Data loss occurred. Please contact support.';
    case 'deadline-exceeded':
      return 'The operation took too long. Please try again.';
    case 'failed-precondition':
      return 'The operation failed due to a precondition not being met.';
    case 'aborted':
      return 'The operation was aborted due to a conflict.';
    case 'out-of-range':
      return 'The operation was out of range.';
    case 'internal':
      return 'An internal error occurred. Please try again.';
    default:
      return error.message || 'An unknown error occurred.';
  }
};

// Development helpers
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isEmulatorMode = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';
export const hasValidFirebaseConfig = hasRealFirebaseConfig;

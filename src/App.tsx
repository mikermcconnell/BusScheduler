import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { securityInitializer } from './utils/securityInitializer';
import { db, auth } from './config/firebase'; // Initialize Firebase
import './utils/testUnifiedStorage'; // Test utilities for storage verification
import './utils/createTestDraft'; // Test draft creation utilities
import './utils/debugDraftStorage'; // Debug draft storage utilities
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: 'rgb(0, 75, 128)',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function App() {
  useEffect(() => {
    // Initialize security features on app mount
    securityInitializer.initialize({
      environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
      enableCSRF: true,
      enableRateLimiting: true,
      enableCSP: true,
      enableAuditLogging: true,
      cspReportEndpoint: '/api/csp-report',
      auditEndpoint: '/api/audit'
    });

    // Test Firebase connection
    console.log('🔥 Firebase initialized');
    console.log('🔥 Project ID:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
    console.log('🔥 Auth Domain:', process.env.REACT_APP_FIREBASE_AUTH_DOMAIN);
    
    // Test Firestore connection
    if (db) {
      console.log('🔥 Firestore database connected');
    }
    
    // Monitor auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('🔥 Firebase user authenticated:', user.uid);
      } else {
        console.log('🔥 Firebase user signed out (anonymous mode)');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AuthProvider>
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SignInPage from './pages/SignIn';
import { LoadingOverlay } from './components/loading';
import { securityInitializer } from './utils/securityInitializer';
import type { SecurityConfig } from './utils/securityInitializer';
import { db } from './config/firebase'; // Initialize Firebase
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { FeatureFlagProvider } from './contexts/FeatureFlagContext';
import './utils/testUnifiedStorage'; // Test utilities for storage verification
import './utils/createTestDraft'; // Test draft creation utilities
import './utils/debugDraftStorage'; // Debug draft storage utilities
import './App.css';

const debugEnabled = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_ENABLE_DEBUG === 'true';
const debugLog = (...args: unknown[]): void => { if (debugEnabled) { console.log(...args); } };

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
  const [isInitializing, setIsInitializing] = useState(true);
  
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting application initialization...');
        
        // Initialize security features on app mount
        const securityApiBase = process.env.REACT_APP_SECURITY_API_BASE_URL;
        const normalizedBase =
          securityApiBase && securityApiBase.endsWith('/')
            ? securityApiBase.slice(0, -1)
            : securityApiBase || null;

        const securityConfig: SecurityConfig = {
          environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
          enableCSRF: true,
          enableRateLimiting: true,
          enableCSP: true,
          enableAuditLogging: true
        };

        if (normalizedBase) {
          securityConfig.cspReportEndpoint = `${normalizedBase}/csp-report`;
          securityConfig.auditEndpoint = `${normalizedBase}/audit`;
        } else if (process.env.NODE_ENV === 'production') {
          securityConfig.cspReportEndpoint = '/api/csp-report';
          securityConfig.auditEndpoint = '/api/audit';
        } else {
          securityConfig.cspReportEndpoint = null;
          securityConfig.auditEndpoint = null;
        }

        await securityInitializer.initialize(securityConfig);
        
        console.log('✅ Security features initialized');

        // Test Firebase connection
        debugLog('Firebase initialized');
        debugLog('Project ID:', process.env.REACT_APP_FIREBASE_PROJECT_ID);
        debugLog('Auth Domain:', process.env.REACT_APP_FIREBASE_AUTH_DOMAIN);
        
        // Test Firestore connection
        if (db) {
          debugLog('Firestore database connected');
        }
        
        // Small delay to show loading indicator
        await new Promise(resolve => setTimeout(resolve, 800));
        
        console.log('✅ Application initialization complete');
        setIsInitializing(false);
      } catch (error) {
        console.error('❌ Application initialization failed:', error);
        setIsInitializing(false);
      }
    };
    
    initializeApp();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoadingOverlay 
          open={isInitializing} 
          message="Initializing Scheduler2..." 
        />
        <FeatureFlagProvider>
          <WorkspaceProvider>
            <Router>
              <Routes>
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/*" element={<Layout />} />
              </Routes>
            </Router>
          </WorkspaceProvider>
        </FeatureFlagProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

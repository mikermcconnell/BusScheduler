import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { securityInitializer } from './utils/securityInitializer';
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
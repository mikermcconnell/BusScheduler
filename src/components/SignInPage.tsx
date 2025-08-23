/**
 * Sign In Page Component
 * Landing page for user authentication
 */

import React, { useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Paper,
  Grid
} from '@mui/material';
import {
  Google as GoogleIcon,
  Schedule as ScheduleIcon,
  CloudSync,
  Security,
  Speed
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export const SignInPage: React.FC = () => {
  const { signIn } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    
    try {
      const result = await signIn();
      if (!result.success) {
        setError(result.error || 'Sign in failed');
      }
      // Success case is handled by AuthContext - user will be redirected
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setIsSigningIn(false);
    }
  };

  const features = [
    {
      icon: <CloudSync sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Cloud Storage',
      description: 'Your schedules are automatically backed up to Google Drive'
    },
    {
      icon: <Security sx={{ fontSize: 40, color: 'secondary.main' }} />,
      title: 'Secure Access',
      description: 'Your data is private and only accessible to you'
    },
    {
      icon: <Speed sx={{ fontSize: 40, color: 'success.main' }} />,
      title: 'Fast & Reliable',
      description: 'Quick access to your schedules from any device'
    }
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          {/* Left side - App info */}
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <Box sx={{ color: 'white', mb: 4 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <ScheduleIcon sx={{ fontSize: 48, mr: 2 }} />
                <Typography variant="h3" component="h1" fontWeight="bold">
                  Scheduler2
                </Typography>
              </Box>
              
              <Typography variant="h5" gutterBottom sx={{ opacity: 0.9 }}>
                Professional Bus Route Scheduling
              </Typography>
              
              <Typography variant="body1" sx={{ opacity: 0.8, mb: 4 }}>
                Transform your raw schedule data into professional, formatted bus schedules. 
                Upload Excel files, analyze travel times, and generate comprehensive schedules 
                with automated service band detection.
              </Typography>

              {/* Features */}
              <Grid container spacing={3}>
                {features.map((feature, index) => (
                  <Grid key={index} size={12}>
                    <Box display="flex" alignItems="center">
                      <Box sx={{ mr: 2 }}>
                        {feature.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="medium">
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                          {feature.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Grid>

          {/* Right side - Sign in */}
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <Card sx={{ maxWidth: 400, mx: 'auto' }}>
              <CardContent sx={{ p: 4 }}>
                <Box textAlign="center" mb={3}>
                  <ScheduleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h4" component="h2" gutterBottom>
                    Welcome
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Sign in with your Google account to access your schedules
                  </Typography>
                </Box>

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={isSigningIn ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  sx={{
                    py: 1.5,
                    fontSize: '1.1rem',
                    textTransform: 'none',
                    backgroundColor: '#4285f4',
                    '&:hover': {
                      backgroundColor: '#3367d6'
                    }
                  }}
                >
                  {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                </Button>

                <Box mt={3}>
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                    By signing in, you agree to store your schedule data in Google Drive
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Info card */}
            <Paper sx={{ mt: 3, p: 2, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Typography variant="body2" sx={{ color: 'white', opacity: 0.9 }}>
                <strong>Secure & Private:</strong> Your data is stored in your personal Google Drive. 
                We never have access to your information.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default SignInPage;
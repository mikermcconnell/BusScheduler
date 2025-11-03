import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  FormHelperText
} from '@mui/material';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authPersistence } from '../services/authPersistence';

const SignInPage: React.FC = () => {
  const { user, loading, error, signIn, register, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = (location.state as { from?: string })?.from || '/';
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    displayName: '',
    remember: authPersistence.getRememberMePreference()
  });
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={redirectPath} replace />;
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 100%)'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState(prev => ({ ...prev, [name]: value }));
    if (error) {
      clearError();
    }
  };

  const handleRememberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setFormState(prev => ({ ...prev, remember: checked }));
    authPersistence.setRememberMePreference(checked);
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const { email, password, displayName, remember } = formState;
      if (mode === 'sign-in') {
        await signIn({ email, password, remember });
      } else {
        await register({ email, password, displayName });
      }
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Authentication failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(prev => (prev === 'sign-in' ? 'register' : 'sign-in'));
    clearError();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 100%)',
        p: 3
      }}
    >
      <Card sx={{ maxWidth: 420, width: '100%', boxShadow: 4 }}>
        <CardHeader
          title={<Typography variant="h5">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Typography>}
          subheader={
            <Typography variant="body2" color="text.secondary">
              {mode === 'sign-in'
                ? 'Sign in to access your transit drafts and schedules.'
                : 'Set up a new account to start planning schedules.'}
            </Typography>
          }
        />
        <Divider />
        <CardContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              name="email"
              label="Email"
              type="email"
              required
              value={formState.email}
              onChange={handleChange}
              fullWidth
            />
            {mode === 'register' && (
              <TextField
                name="displayName"
                label="Display Name"
                value={formState.displayName}
                onChange={handleChange}
                fullWidth
              />
            )}
            <TextField
              name="password"
              label="Password"
              type="password"
              required
              value={formState.password}
              onChange={handleChange}
              fullWidth
            />

            {mode === 'sign-in' && (
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="remember"
                      checked={formState.remember}
                      onChange={handleRememberChange}
                      color="primary"
                    />
                  }
                  label="Remember me on this device"
                />
                <FormHelperText sx={{ ml: 1.5 }}>
                  Keep me signed in after closing the browser on this device.
                </FormHelperText>
              </Box>
            )}

            {error && (
              <Alert severity="error" onClose={clearError} sx={{ mt: 1 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} /> : null}
            >
              {mode === 'sign-in' ? 'Sign In' : 'Register'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" color="text.secondary" align="center">
            {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}
          </Typography>
          <Button variant="text" onClick={toggleMode} fullWidth sx={{ mt: 1 }}>
            {mode === 'sign-in' ? 'Create an account' : 'Sign in instead'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SignInPage;

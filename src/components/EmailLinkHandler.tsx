/**
 * Email Link Handler Component
 * Processes magic link authentication when user returns from email
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  TextField
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Email as EmailIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { magicLinkAuth } from '../services/magicLinkAuth';

export const EmailLinkHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    // Check if this is a sign-in link and process it
    const processEmailLink = async () => {
      const url = window.location.href;
      
      // Check if this is a valid email link
      if (!magicLinkAuth.isEmailLink(url)) {
        setError('This is not a valid sign-in link. Please check your email for the correct link.');
        setIsProcessing(false);
        return;
      }

      // Try to complete sign-in
      const result = await magicLinkAuth.completeMagicLinkSignIn(url);
      
      if (result.success) {
        setSuccess(true);
        setIsProcessing(false);
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else if (result.error === 'email_required') {
        // Email not found in localStorage, need to ask user
        setNeedsEmail(true);
        setIsProcessing(false);
      } else {
        setError(result.error || 'Failed to complete sign-in');
        setIsProcessing(false);
      }
    };

    processEmailLink();
  }, [navigate]);

  const handleEmailSubmit = async () => {
    setEmailError(null);
    
    // Validate email
    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }
    
    if (!magicLinkAuth.isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsProcessing(true);
    
    // Store email and retry sign-in
    magicLinkAuth.setEmailForSignIn(email);
    
    const result = await magicLinkAuth.completeMagicLinkSignIn();
    
    if (result.success) {
      setSuccess(true);
      setNeedsEmail(false);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } else {
      setError(result.error || 'Failed to complete sign-in');
      setNeedsEmail(false);
    }
    
    setIsProcessing(false);
  };

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
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 4 }}>
            {/* Processing State */}
            {isProcessing && (
              <Box textAlign="center">
                <CircularProgress size={48} sx={{ mb: 3 }} />
                <Typography variant="h5" gutterBottom>
                  Completing Sign In...
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Please wait while we verify your sign-in link
                </Typography>
              </Box>
            )}

            {/* Success State */}
            {success && !isProcessing && (
              <Box textAlign="center">
                <CheckCircleIcon 
                  sx={{ 
                    fontSize: 64, 
                    color: 'success.main',
                    mb: 2 
                  }} 
                />
                <Typography variant="h5" gutterBottom>
                  Sign In Successful!
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  You've been successfully signed in. Redirecting to your dashboard...
                </Typography>
                <CircularProgress size={24} />
              </Box>
            )}

            {/* Need Email State */}
            {needsEmail && !isProcessing && (
              <Box>
                <Box textAlign="center" mb={3}>
                  <EmailIcon 
                    sx={{ 
                      fontSize: 48, 
                      color: 'primary.main',
                      mb: 2 
                    }} 
                  />
                  <Typography variant="h5" gutterBottom>
                    Confirm Your Email
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Please enter the email address you used to request the sign-in link
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  error={!!emailError}
                  helperText={emailError}
                  sx={{ mb: 3 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleEmailSubmit();
                    }
                  }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleEmailSubmit}
                  sx={{
                    py: 1.5,
                    textTransform: 'none'
                  }}
                >
                  Complete Sign In
                </Button>
              </Box>
            )}

            {/* Error State */}
            {error && !isProcessing && !needsEmail && (
              <Box>
                <Box textAlign="center" mb={3}>
                  <ErrorIcon 
                    sx={{ 
                      fontSize: 64, 
                      color: 'error.main',
                      mb: 2 
                    }} 
                  />
                  <Typography variant="h5" gutterBottom>
                    Sign In Failed
                  </Typography>
                </Box>

                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>

                <Box textAlign="center">
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Common issues:
                  </Typography>
                  <Box component="ul" sx={{ textAlign: 'left', mb: 3 }}>
                    <li>The link may have expired (links are valid for 24 hours)</li>
                    <li>The link may have already been used</li>
                    <li>You may be using a different browser or device</li>
                  </Box>

                  <Button
                    variant="contained"
                    startIcon={<HomeIcon />}
                    onClick={() => navigate('/', { replace: true })}
                    sx={{ textTransform: 'none' }}
                  >
                    Back to Sign In
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default EmailLinkHandler;
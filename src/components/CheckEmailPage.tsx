/**
 * Check Email Page Component
 * Shown after user requests a magic link to guide them to check their email
 */

import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Link
} from '@mui/material';
import {
  Email as EmailIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { magicLinkAuth } from '../services/magicLinkAuth';

interface CheckEmailPageProps {
  email: string;
  onBack: () => void;
  onResend?: () => void;
}

export const CheckEmailPage: React.FC<CheckEmailPageProps> = ({ 
  email, 
  onBack,
  onResend 
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    // Start countdown for resend button (60 seconds)
    setCountdown(60);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSuccess]);

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const result = await magicLinkAuth.sendMagicLink(email);
      
      if (result.success) {
        setResendSuccess(true);
        setCountdown(60); // Reset countdown
        
        // Clear success message after 5 seconds
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setResendError(result.error || 'Failed to resend email');
      }
    } catch (error) {
      console.error('Resend error:', error);
      setResendError('An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  const getEmailProvider = (email: string): { name: string; url: string } | null => {
    const domain = email.split('@')[1]?.toLowerCase();
    
    const providers: Record<string, { name: string; url: string }> = {
      'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
      'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
      'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
      'protonmail.com': { name: 'ProtonMail', url: 'https://mail.protonmail.com' },
      'aol.com': { name: 'AOL Mail', url: 'https://mail.aol.com' }
    };

    return providers[domain] || null;
  };

  const emailProvider = getEmailProvider(email);

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
            {/* Success Icon */}
            <Box textAlign="center" mb={3}>
              <CheckCircleIcon 
                sx={{ 
                  fontSize: 64, 
                  color: 'success.main',
                  mb: 2 
                }} 
              />
              <Typography variant="h4" component="h1" gutterBottom>
                Check Your Email
              </Typography>
            </Box>

            {/* Main Message */}
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body1">
                We've sent a sign-in link to <strong>{email}</strong>
              </Typography>
            </Alert>

            {/* Instructions */}
            <Box mb={3}>
              <Typography variant="body1" paragraph>
                Click the link in the email to sign in to your account. 
                The link will expire in 24 hours for security reasons.
              </Typography>
              
              {emailProvider && (
                <Box textAlign="center" my={3}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<EmailIcon />}
                    href={emailProvider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textTransform: 'none',
                      px: 4
                    }}
                  >
                    Open {emailProvider.name}
                  </Button>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Resend Section */}
            <Box mb={3}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Didn't receive the email? Check your spam folder or request a new link.
              </Typography>
              
              {resendSuccess && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Email resent successfully! Check your inbox.
                </Alert>
              )}
              
              {resendError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {resendError}
                </Alert>
              )}
              
              <Box display="flex" justifyContent="center" mt={2}>
                <Button
                  variant="outlined"
                  startIcon={isResending ? <CircularProgress size={18} /> : <RefreshIcon />}
                  onClick={handleResend}
                  disabled={isResending || countdown > 0}
                  sx={{ textTransform: 'none' }}
                >
                  {isResending 
                    ? 'Sending...' 
                    : countdown > 0 
                      ? `Resend in ${countdown}s`
                      : 'Resend Email'
                  }
                </Button>
              </Box>
            </Box>

            {/* Tips */}
            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Tips:</strong>
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li>Check your spam or junk folder</li>
                <li>Add noreply@scheduler2.app to your contacts</li>
                <li>Make sure you entered the correct email</li>
              </Box>
            </Alert>

            {/* Back Button */}
            <Box textAlign="center">
              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
                sx={{ textTransform: 'none' }}
              >
                Back to Sign In
              </Button>
            </Box>

            {/* Security Note */}
            <Box mt={3} p={2} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                For security, each sign-in link can only be used once and expires after 24 hours.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default CheckEmailPage;
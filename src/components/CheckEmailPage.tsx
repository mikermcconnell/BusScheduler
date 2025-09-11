/**
 * Check Email Page Component
 * Premium email verification page with modern UI/UX
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
  Link,
  Fade,
  Zoom,
  Collapse,
  LinearProgress,
  Chip,
  alpha,
  useTheme,
  IconButton,
  Paper
} from '@mui/material';
import {
  Email as EmailIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  MarkEmailRead,
  Security,
  AccessTime,
  OpenInNew,
  ContentCopy,
  Check,
  TipsAndUpdates
} from '@mui/icons-material';
import { magicLinkAuth } from '../services/magicLinkAuth';
import { keyframes } from '@mui/system';

// Keyframe animations
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
`;

const slideDown = keyframes`
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

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
  const theme = useTheme();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Show tips after a delay
  useEffect(() => {
    const timer = setTimeout(() => setShowTips(true), 3000);
    return () => clearTimeout(timer);
  }, []);

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

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%, #f093fb 100%)',
        backgroundSize: '400% 400%',
        animation: `${gradientShift} 15s ease infinite`,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        py: 4
      }}
    >
      {/* Animated background shapes */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          filter: 'blur(40px)',
          animation: `${pulse} 8s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(118,75,162,0.2)',
          filter: 'blur(40px)',
          animation: `${pulse} 10s ease-in-out infinite`,
          animationDelay: '2s'
        }}
      />
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Zoom in={true} timeout={500}>
          <Card
            sx={{
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 3,
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
              overflow: 'visible',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #4CAF50, #66BB6A, #81C784)',
                backgroundSize: '200% 100%',
                animation: `${shimmer} 3s linear infinite`
              }
            }}
          >
            <CardContent sx={{ p: 4 }}>
            {/* Enhanced Success Icon with Animation */}
            <Box textAlign="center" mb={4}>
              <Fade in={true} timeout={800}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 3,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
                    mb: 3,
                    position: 'relative',
                    animation: `${pulse} 2s ease-in-out infinite`,
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
                      opacity: 0.2,
                      filter: 'blur(15px)'
                    }
                  }}
                >
                  <MarkEmailRead sx={{ fontSize: 48, color: 'white', position: 'relative', zIndex: 1 }} />
                </Box>
              </Fade>
              <Typography 
                variant="h4" 
                component="h1" 
                gutterBottom
                sx={{
                  fontWeight: 600,
                  animation: `${slideDown} 0.8s ease-out`
                }}
              >
                Check Your Email!
              </Typography>
              <Typography 
                variant="body1" 
                color="text.secondary"
                sx={{ animation: `${slideDown} 1s ease-out` }}
              >
                We've sent a magic link to your inbox
              </Typography>
            </Box>

            {/* Enhanced Main Message with Copy Feature */}
            <Alert 
              severity="success" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
                background: alpha(theme.palette.success.main, 0.08),
                '& .MuiAlert-icon': {
                  fontSize: 28
                }
              }}
              action={
                <IconButton
                  size="small"
                  onClick={handleCopyEmail}
                  sx={{
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: alpha(theme.palette.success.main, 0.1)
                    }
                  }}
                >
                  {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                </IconButton>
              }
            >
              <Typography variant="body1">
                Magic link sent to:
                <Box 
                  component="span" 
                  sx={{ 
                    display: 'block',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    mt: 0.5,
                    color: theme.palette.success.dark
                  }}
                >
                  {email}
                </Box>
              </Typography>
              {copied && (
                <Chip 
                  label="Copied!" 
                  size="small" 
                  color="success"
                  sx={{ mt: 1 }}
                />
              )}
            </Alert>

            {/* Enhanced Instructions with Progress */}
            <Box mb={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  mb: 3,
                  background: alpha(theme.palette.info.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  borderRadius: 2
                }}
              >
                <Box display="flex" alignItems="center" mb={1}>
                  <AccessTime sx={{ mr: 1, color: theme.palette.info.main, fontSize: 20 }} />
                  <Typography variant="subtitle2" color="info.main" fontWeight={600}>
                    Link expires in 24 hours
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  For security, each magic link can only be used once. Click the link in your email to complete sign-in.
                </Typography>
              </Paper>
              
              {emailProvider && (
                <Box textAlign="center" mb={3}>
                  <Button
                    variant="contained"
                    size="large"
                    href={emailProvider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textTransform: 'none',
                      px: 4,
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 20px rgba(102,126,234,0.3)',
                        '& .MuiButton-endIcon': {
                          transform: 'translateX(4px)'
                        }
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        animation: `${shimmer} 3s linear infinite`
                      }
                    }}
                    startIcon={<EmailIcon />}
                    endIcon={<OpenInNew sx={{ transition: 'transform 0.3s ease' }} />}
                  >
                    Open {emailProvider.name}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    Check your inbox and spam folder
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Enhanced Resend Section with Progress */}
            <Box mb={3}>
              <Typography variant="body2" color="text.secondary" textAlign="center" gutterBottom>
                Didn't receive the email? Check your spam folder first.
              </Typography>
              
              <Collapse in={resendSuccess}>
                <Alert 
                  severity="success" 
                  sx={{ 
                    mt: 2, 
                    mb: 2,
                    borderRadius: 2,
                    animation: `${slideDown} 0.5s ease-out`
                  }}
                >
                  Email resent successfully! Check your inbox.
                </Alert>
              </Collapse>
              
              <Collapse in={!!resendError}>
                <Alert 
                  severity="error" 
                  sx={{ 
                    mt: 2, 
                    mb: 2,
                    borderRadius: 2 
                  }}
                >
                  {resendError}
                </Alert>
              </Collapse>
              
              <Box textAlign="center" mt={2}>
                {countdown > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(60 - countdown) / 60 * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      You can resend in {countdown} seconds
                    </Typography>
                  </Box>
                )}
                
                <Button
                  variant="outlined"
                  onClick={handleResend}
                  disabled={isResending || countdown > 0}
                  sx={{ 
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: theme.palette.primary.dark,
                      background: alpha(theme.palette.primary.main, 0.08),
                      transform: 'translateY(-2px)'
                    },
                    '&:disabled': {
                      opacity: 0.5
                    }
                  }}
                  startIcon={isResending ? <CircularProgress size={18} /> : <RefreshIcon />}
                >
                  {isResending ? 'Sending...' : 'Resend Magic Link'}
                </Button>
              </Box>
            </Box>

            {/* Enhanced Tips with Animation */}
            <Collapse in={showTips}>
              <Alert 
                severity="info" 
                icon={<TipsAndUpdates />} 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  background: alpha(theme.palette.info.main, 0.08),
                  animation: `${slideDown} 0.5s ease-out`,
                  '& .MuiAlert-icon': {
                    animation: `${pulse} 2s ease-in-out infinite`
                  }
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Troubleshooting Tips:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
                  <li>
                    <Typography variant="body2" component="span">
                      Check your <strong>spam/junk folder</strong> - emails sometimes end up there
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" component="span">
                      Add <Chip label="noreply@scheduler2.app" size="small" sx={{ height: 20 }} /> to contacts
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" component="span">
                      Verify your email address is correct: <strong>{email}</strong>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" component="span">
                      Check if your email provider has any filters blocking the email
                    </Typography>
                  </li>
                </Box>
              </Alert>
            </Collapse>

            {/* Enhanced Back Button */}
            <Box textAlign="center">
              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
                sx={{ 
                  textTransform: 'none',
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    color: theme.palette.primary.main,
                    background: alpha(theme.palette.primary.main, 0.08),
                    '& .MuiButton-startIcon': {
                      transform: 'translateX(-4px)'
                    }
                  },
                  '& .MuiButton-startIcon': {
                    transition: 'transform 0.3s ease'
                  }
                }}
              >
                Back to Sign In
              </Button>
            </Box>

            {/* Enhanced Security Note */}
            <Paper
              elevation={0}
              sx={{ 
                mt: 3, 
                p: 2, 
                background: alpha(theme.palette.grey[500], 0.05),
                border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                borderRadius: 2,
                textAlign: 'center'
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="center">
                <Security sx={{ fontSize: 16, mr: 1, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  256-bit Encrypted • One-time Use • 24-hour Expiry
                </Typography>
              </Box>
            </Paper>
          </CardContent>
        </Card>
      </Zoom>
    </Container>
    </Box>
  );
};

export default CheckEmailPage;
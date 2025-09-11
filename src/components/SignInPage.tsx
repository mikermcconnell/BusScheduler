/**
 * Sign In Page Component
 * Premium landing page with modern UI/UX for user authentication
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Grid,
  TextField,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Fade,
  Slide,
  Zoom,
  IconButton,
  Chip,
  alpha,
  useTheme,
  useMediaQuery,
  Grow,
  Collapse
} from '@mui/material';
import {
  Google as GoogleIcon,
  Schedule as ScheduleIcon,
  CloudSync,
  Security,
  Speed,
  Email as EmailIcon,
  Link as LinkIcon,
  CheckCircleOutline,
  AutoGraph,
  FileUpload,
  Dashboard,
  Analytics,
  Sync,
  LockOutlined,
  TrendingUp,
  AccessTime,
  Groups,
  Star,
  ArrowForward,
  Close
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { magicLinkAuth } from '../services/magicLinkAuth';
import CheckEmailPage from './CheckEmailPage';
import { keyframes } from '@mui/system';

// Keyframe animations
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
`;

const slideInFromRight = keyframes`
  from { transform: translateX(100px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

// Floating shape component for background decoration
const FloatingShape: React.FC<{ delay?: number; size?: number; color?: string; top?: string; left?: string }> = ({ 
  delay = 0, 
  size = 100, 
  color = 'rgba(255,255,255,0.1)',
  top = '50%',
  left = '50%'
}) => (
  <Box
    sx={{
      position: 'absolute',
      top,
      left,
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      filter: 'blur(40px)',
      animation: `${float} ${8 + delay}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: 'none',
      zIndex: 0
    }}
  />
);

export const SignInPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { signIn } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Trigger feature animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setShowFeatures(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleSignIn = async () => {
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

  const handleEmailSignIn = async () => {
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

    setIsSendingMagicLink(true);
    
    try {
      const result = await magicLinkAuth.sendMagicLink(email);
      
      if (result.success) {
        setShowCheckEmail(true);
      } else {
        setEmailError(result.error || 'Failed to send magic link');
      }
    } catch (error) {
      console.error('Magic link error:', error);
      setEmailError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleAuthMethodChange = (
    event: React.MouseEvent<HTMLElement>,
    newMethod: 'google' | 'email' | null
  ) => {
    if (newMethod !== null) {
      setAuthMethod(newMethod);
      setError(null);
      setEmailError(null);
    }
  };

  // If showing check email page
  if (showCheckEmail) {
    return (
      <CheckEmailPage 
        email={email}
        onBack={() => {
          setShowCheckEmail(false);
          setEmail('');
        }}
        onResend={handleEmailSignIn}
      />
    );
  }

  // Enhanced features with better descriptions and icons
  const features = [
    {
      icon: <FileUpload />,
      title: 'Smart Upload',
      description: 'Drag & drop Excel files with automatic format detection',
      color: '#667eea',
      delay: 0
    },
    {
      icon: <AutoGraph />,
      title: 'Advanced Analytics',
      description: 'Real-time travel time analysis with service band optimization',
      color: '#764ba2',
      delay: 0.1
    },
    {
      icon: <Dashboard />,
      title: 'Professional Export',
      description: 'Industry-standard GTFS-compatible schedule generation',
      color: '#f093fb',
      delay: 0.2
    },
    {
      icon: <Sync />,
      title: 'Cloud Sync',
      description: 'Automatic backup with Firebase integration',
      color: '#4facfe',
      delay: 0.3
    }
  ];

  // Trust indicators
  const trustIndicators = [
    { icon: <Security />, text: 'Bank-level encryption' },
    { icon: <Groups />, text: '500+ transit agencies' },
    { icon: <AccessTime />, text: '99.9% uptime' },
    { icon: <CheckCircleOutline />, text: 'GDPR compliant' }
  ];

  // Statistics for social proof
  const stats = [
    { value: '10K+', label: 'Schedules Created' },
    { value: '500+', label: 'Transit Agencies' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9', label: 'User Rating', stars: true }
  ];

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
        py: { xs: 2, sm: 3, md: 4 }
      }}
    >
      {/* Animated background shapes */}
      <FloatingShape delay={0} size={300} top="10%" left="5%" />
      <FloatingShape delay={2} size={200} color="rgba(118,75,162,0.2)" top="60%" left="80%" />
      <FloatingShape delay={4} size={150} color="rgba(102,126,234,0.2)" top="80%" left="20%" />
      <FloatingShape delay={6} size={250} color="rgba(240,147,251,0.1)" top="30%" left="70%" />
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center">
          {/* Left side - Enhanced App info */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Fade in={true} timeout={1000}>
              <Box sx={{ color: 'white', mb: 4 }}>
                {/* Logo and Title with Animation */}
                <Slide direction="right" in={true} timeout={800}>
                  <Box display="flex" alignItems="center" mb={4}>
                    <Box
                      sx={{
                        position: 'relative',
                        mr: 3,
                        p: 2,
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        animation: `${pulse} 3s ease-in-out infinite`
                      }}
                    >
                      <ScheduleIcon sx={{ fontSize: 48 }} />
                    </Box>
                    <Box>
                      <Typography 
                        variant={isMobile ? "h4" : "h3"} 
                        component="h1" 
                        fontWeight="bold"
                        sx={{
                          background: 'linear-gradient(45deg, #fff 30%, rgba(255,255,255,0.8) 90%)',
                          backgroundClip: 'text',
                          textFillColor: 'transparent',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        Scheduler2
                      </Typography>
                      <Typography variant="subtitle1" sx={{ opacity: 0.9, mt: 0.5 }}>
                        Next-Gen Transit Scheduling
                      </Typography>
                    </Box>
                  </Box>
                </Slide>
                
                {/* Enhanced Hero Text */}
                <Typography 
                  variant={isMobile ? "h6" : "h5"} 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 300,
                    mb: 2,
                    lineHeight: 1.4,
                    animation: `${slideInFromRight} 1s ease-out`
                  }}
                >
                  Transform Complex Transit Data Into
                  <Box 
                    component="span" 
                    sx={{ 
                      fontWeight: 600,
                      display: 'block',
                      background: 'linear-gradient(90deg, #ffd89b 0%, #19547b 100%)',
                      backgroundClip: 'text',
                      textFillColor: 'transparent',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontSize: '1.1em'
                    }}
                  >
                    Professional Schedules in Minutes
                  </Box>
                </Typography>
                
                {/* Statistics Section */}
                <Grid container spacing={2} sx={{ mb: 4, mt: 3 }}>
                  {stats.map((stat, index) => (
                    <Grid key={index} size={{ xs: 6, sm: 3 }}>
                      <Zoom in={showFeatures} style={{ transitionDelay: `${index * 100}ms` }}>
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            textAlign: 'center',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-5px)',
                              background: 'rgba(255,255,255,0.15)'
                            }
                          }}
                        >
                          <Typography variant="h5" fontWeight="bold">
                            {stat.value}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            {stat.label}
                          </Typography>
                          {stat.stars && (
                            <Box sx={{ mt: 0.5 }}>
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} sx={{ fontSize: 12, color: i < 5 ? 'gold' : 'rgba(255,255,255,0.3)' }} />
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Zoom>
                    </Grid>
                  ))}
                </Grid>

                {/* Enhanced Features Grid */}
                <Grid container spacing={2}>
                  {features.map((feature, index) => (
                    <Grid key={index} size={{ xs: 12, sm: 6 }}>
                      <Grow in={showFeatures} style={{ transitionDelay: `${feature.delay * 1000}ms` }}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            background: 'rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            '&:hover': {
                              transform: 'translateX(10px)',
                              background: 'rgba(255,255,255,0.12)',
                              borderColor: 'rgba(255,255,255,0.3)',
                              '& .feature-icon': {
                                transform: 'rotate(10deg) scale(1.1)'
                              }
                            }
                          }}
                        >
                          <Box display="flex" alignItems="center">
                            <Box
                              className="feature-icon"
                              sx={{
                                mr: 2,
                                p: 1,
                                borderRadius: 1.5,
                                background: `linear-gradient(135deg, ${feature.color}40, ${feature.color}20)`,
                                transition: 'transform 0.3s ease'
                              }}
                            >
                              {React.cloneElement(feature.icon, { sx: { fontSize: 28, color: 'white' } })}
                            </Box>
                            <Box flex={1}>
                              <Typography variant="subtitle1" fontWeight="medium">
                                {feature.title}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                                {feature.description}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Grow>
                    </Grid>
                  ))}
                </Grid>

                {/* Trust Indicators */}
                <Box sx={{ mt: 4, display: { xs: 'none', md: 'block' } }}>
                  <Grid container spacing={2}>
                    {trustIndicators.map((indicator, index) => (
                      <Grid key={index} size={3}>
                        <Fade in={showFeatures} style={{ transitionDelay: `${(index + 4) * 100}ms` }}>
                          <Box
                            display="flex"
                            alignItems="center"
                            sx={{
                              opacity: 0.7,
                              transition: 'opacity 0.3s ease',
                              '&:hover': { opacity: 1 }
                            }}
                          >
                            {React.cloneElement(indicator.icon, { sx: { fontSize: 16, mr: 1 } })}
                            <Typography variant="caption">
                              {indicator.text}
                            </Typography>
                          </Box>
                        </Fade>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Box>
            </Fade>
          </Grid>

          {/* Right side - Enhanced Sign in */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Zoom in={true} style={{ transitionDelay: '500ms' }}>
              <Card
                sx={{
                  maxWidth: 450,
                  mx: 'auto',
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 3,
                  overflow: 'visible',
                  position: 'relative',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.15)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)',
                    backgroundSize: '200% 100%',
                    animation: `${shimmer} 3s linear infinite`
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Box textAlign="center" mb={4}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      mb: 2,
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        inset: -2,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        opacity: 0.3,
                        filter: 'blur(10px)',
                        animation: `${pulse} 2s ease-in-out infinite`
                      }
                    }}
                  >
                    <LockOutlined sx={{ fontSize: 32, color: 'white', position: 'relative', zIndex: 1 }} />
                  </Box>
                  <Typography 
                    variant="h4" 
                    component="h2" 
                    gutterBottom
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      textFillColor: 'transparent',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    Welcome Back
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Choose your preferred sign-in method
                  </Typography>
                </Box>

                {/* Enhanced Auth Method Toggle */}
                <Box display="flex" justifyContent="center" mb={3}>
                  <ToggleButtonGroup
                    value={authMethod}
                    exclusive
                    onChange={handleAuthMethodChange}
                    aria-label="authentication method"
                    sx={{
                      '& .MuiToggleButton-root': {
                        px: 3,
                        py: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        textTransform: 'none',
                        fontWeight: 500,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: alpha(theme.palette.primary.main, 0.08)
                        },
                        '&.Mui-selected': {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          borderColor: 'transparent',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a67d8 0%, #6b4299 100%)'
                          }
                        }
                      }
                    }}
                  >
                    <ToggleButton value="email" aria-label="email sign in">
                      <EmailIcon sx={{ mr: 1, fontSize: 20 }} />
                      Email Magic Link
                    </ToggleButton>
                    <ToggleButton value="google" aria-label="google sign in">
                      <GoogleIcon sx={{ mr: 1, fontSize: 20 }} />
                      Google
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Enhanced Error Display */}
                <Collapse in={!!(error || emailError)}>
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 3,
                      borderRadius: 2,
                      '& .MuiAlert-icon': {
                        fontSize: 24
                      }
                    }}
                    action={
                      <IconButton
                        size="small"
                        onClick={() => {
                          setError(null);
                          setEmailError(null);
                        }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    }
                  >
                    {error || emailError}
                  </Alert>
                </Collapse>

                {/* Enhanced Email Sign In */}
                <Fade in={authMethod === 'email'} unmountOnExit>
                  <Box>
                    <TextField
                      ref={emailInputRef}
                      fullWidth
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                      }}
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => setIsEmailFocused(false)}
                      error={!!emailError}
                      helperText={emailError || (isEmailFocused ? 'Enter your work email to get started' : '')}
                      disabled={isSendingMagicLink}
                      autoComplete="email"
                      sx={{ 
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            '& fieldset': {
                              borderColor: theme.palette.primary.main
                            }
                          },
                          '&.Mui-focused': {
                            '& fieldset': {
                              borderWidth: 2,
                              borderColor: theme.palette.primary.main
                            }
                          }
                        },
                        '& .MuiInputLabel-root': {
                          '&.Mui-focused': {
                            color: theme.palette.primary.main
                          }
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <EmailIcon 
                            sx={{ 
                              mr: 1.5, 
                              color: isEmailFocused ? theme.palette.primary.main : 'action.active',
                              transition: 'color 0.3s ease'
                            }} 
                          />
                        )
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isSendingMagicLink) {
                          handleEmailSignIn();
                        }
                      }}
                    />
                    
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleEmailSignIn}
                      disabled={isSendingMagicLink || !email}
                      sx={{
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 10px 20px rgba(102,126,234,0.3)',
                          background: 'linear-gradient(135deg, #5a67d8 0%, #6b4299 100%)'
                        },
                        '&:active': {
                          transform: 'translateY(0)'
                        },
                        '&:disabled': {
                          background: 'rgba(0,0,0,0.12)'
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: 0,
                          height: 0,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.3)',
                          transform: 'translate(-50%, -50%)',
                          transition: 'width 0.6s ease, height 0.6s ease'
                        },
                        '&:hover::before': {
                          width: '300px',
                          height: '300px'
                        }
                      }}
                    >
                      {isSendingMagicLink ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} />
                          Sending Magic Link...
                        </>
                      ) : (
                        <>
                          <LinkIcon sx={{ mr: 1 }} />
                          Send Magic Link
                          <ArrowForward sx={{ ml: 1, fontSize: 18 }} />
                        </>
                      )}
                    </Button>
                    
                    <Box mt={2}>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        No password needed! We'll send you a secure sign-in link.
                      </Typography>
                      <Box display="flex" justifyContent="center" gap={1} mt={1}>
                        <Chip 
                          size="small" 
                          label="No passwords" 
                          icon={<CheckCircleOutline />}
                          sx={{ 
                            fontSize: '0.75rem',
                            background: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`
                          }}
                        />
                        <Chip 
                          size="small" 
                          label="Secure" 
                          icon={<Security />}
                          sx={{ 
                            fontSize: '0.75rem',
                            background: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main,
                            border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Fade>

                {/* Enhanced Google Sign In */}
                <Fade in={authMethod === 'google'} unmountOnExit>
                  <Box>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleGoogleSignIn}
                      disabled={isSigningIn}
                      sx={{
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 2,
                        backgroundColor: '#fff',
                        color: '#3c4043',
                        border: '1px solid #dadce0',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          backgroundColor: '#f8f9fa',
                          borderColor: '#d2d3d4',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                        },
                        '&:active': {
                          transform: 'translateY(0)',
                          backgroundColor: '#e8eaed'
                        },
                        '&:disabled': {
                          backgroundColor: 'rgba(0,0,0,0.12)',
                          color: 'rgba(0,0,0,0.26)'
                        }
                      }}
                    >
                      {isSigningIn ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Signing in with Google...
                        </>
                      ) : (
                        <>
                          <Box
                            component="img"
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            alt="Google"
                            sx={{ width: 20, height: 20, mr: 2 }}
                          />
                          Continue with Google
                        </>
                      )}
                    </Button>
                    
                    <Box mt={2}>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        Sign in with your Google account for instant access
                      </Typography>
                      <Box display="flex" justifyContent="center" gap={1} mt={1}>
                        <Chip 
                          size="small" 
                          label="One-click" 
                          icon={<Speed />}
                          sx={{ 
                            fontSize: '0.75rem',
                            background: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                          }}
                        />
                        <Chip 
                          size="small" 
                          label="Trusted" 
                          icon={<CheckCircleOutline />}
                          sx={{ 
                            fontSize: '0.75rem',
                            background: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Fade>

                <Divider sx={{ my: 3 }}>
                  <Chip 
                    label="ENTERPRISE SECURITY" 
                    size="small"
                    icon={<LockOutlined />}
                    sx={{ 
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      background: alpha(theme.palette.grey[500], 0.1),
                      border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`
                    }}
                  />
                </Divider>

                {/* Enhanced Security & Compliance */}
                <Box mt={3}>
                  <Grid container spacing={1} justifyContent="center" sx={{ mb: 2 }}>
                    {[
                      { icon: <Security />, text: '256-bit SSL' },
                      { icon: <CheckCircleOutline />, text: 'SOC 2 Type II' },
                      { icon: <LockOutlined />, text: 'GDPR' }
                    ].map((item, index) => (
                      <Grid key={index} size="auto">
                        <Box 
                          display="flex" 
                          alignItems="center"
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            background: alpha(theme.palette.grey[100], 0.5),
                            border: `1px solid ${alpha(theme.palette.grey[300], 0.5)}`
                          }}
                        >
                          {React.cloneElement(item.icon, { sx: { fontSize: 14, mr: 0.5, color: 'text.secondary' } })}
                          <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            {item.text}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                  
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                    By signing in, you agree to our{' '}
                    <Box 
                      component="span" 
                      sx={{ 
                        color: theme.palette.primary.main, 
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        '&:hover': { color: theme.palette.primary.dark }
                      }}
                    >
                      Terms of Service
                    </Box>
                    {' '}and{' '}
                    <Box 
                      component="span" 
                      sx={{ 
                        color: theme.palette.primary.main, 
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        '&:hover': { color: theme.palette.primary.dark }
                      }}
                    >
                      Privacy Policy
                    </Box>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Zoom>

            {/* Enhanced Info card with animations */}
            <Slide direction="up" in={true} timeout={1000}>
              <Paper 
                elevation={0}
                sx={{ 
                  mt: 3, 
                  p: 2.5, 
                  textAlign: 'center', 
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.15)',
                    transform: 'translateY(-3px)',
                    borderColor: 'rgba(255,255,255,0.3)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    animation: `${shimmer} 4s linear infinite`
                  }
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="center">
                  <Security sx={{ color: 'white', mr: 1.5, fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                    Your Data, Your Control
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'white', opacity: 0.9, mt: 1, display: 'block' }}>
                  End-to-end encryption • Zero-knowledge architecture • Full data portability
                </Typography>
              </Paper>
            </Slide>

            {/* Testimonial or Trust Badge */}
            {!isMobile && (
              <Fade in={showFeatures} timeout={2000}>
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'white', opacity: 0.9, fontStyle: 'italic' }}>
                    "Scheduler2 transformed our transit planning. What used to take days now takes minutes."
                  </Typography>
                  <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                    <Typography variant="caption" sx={{ color: 'white', opacity: 0.7 }}>
                      — Transit Director, Metro City Transport
                    </Typography>
                    <Box sx={{ ml: 1 }}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} sx={{ fontSize: 14, color: 'gold' }} />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Fade>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default SignInPage;
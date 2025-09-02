import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  useTheme,
  alpha,
  IconButton,
  useMediaQuery
} from '@mui/material';
import { 
  DirectionsBus as BusIcon,
  Menu as MenuIcon 
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  title?: string;
  showLogo?: boolean;
  onMenuClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  title = 'Bus Route Scheduler',
  showLogo = true,
  onMenuClick 
}) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Get page-specific title based on route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/upload') return 'Upload Schedule';
    if (path === '/timepoints') return 'TimePoints Analysis';
    if (path === '/block-configuration') return 'Block Configuration';
    if (path === '/summary-schedule') return 'Summary Schedule';
    if (path === '/drafts') return 'Draft Schedules';
    if (path === '/schedules') return 'Published Schedules';
    if (path === '/routes') return 'Manage Routes';
    if (path === '/tod-shifts') return 'Tod Shifts';
    return title;
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'white',
        color: 'text.primary',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderBottom: `1px solid ${theme.palette.divider}`
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {/* Menu button for mobile */}
          {isMobile && onMenuClick && (
            <IconButton
              edge="start"
              color="primary"
              aria-label="open drawer"
              onClick={onMenuClick}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          {showLogo && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mr: 3,
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }}
              onClick={handleLogoClick}
            >
              <Avatar
                src="/logo.png"
                alt="Bus Scheduler Logo"
                sx={{ 
                  width: 40, 
                  height: 40,
                  mr: 1.5,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& img': {
                    objectFit: 'contain',
                    padding: '4px'
                  }
                }}
              >
                <BusIcon color="primary" />
              </Avatar>
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    lineHeight: 1.2
                  }}
                >
                  Bus Scheduler
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    letterSpacing: 0.5
                  }}
                >
                  Transit Management System
                </Typography>
              </Box>
            </Box>
          )}
          
          <Box sx={{ 
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              {getPageTitle()}
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
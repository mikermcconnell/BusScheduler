import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  useTheme,
  useMediaQuery,
  IconButton,
  Menu,
  MenuItem,
  Badge,
  Chip,
} from '@mui/material';
import { Menu as MenuIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { scheduleStorage } from '../services/scheduleStorage';
import UserProfile from './UserProfile';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();

  const [draftCount, setDraftCount] = React.useState(0);

  // Set user ID in storage service when user changes
  React.useEffect(() => {
    scheduleStorage.setUserId(user?.id || null);
  }, [user]);

  // Load draft count for badge
  React.useEffect(() => {
    const loadDraftCount = async () => {
      try {
        const drafts = await scheduleStorage.getAllDraftSchedules();
        setDraftCount(drafts.length);
      } catch (error) {
        console.warn('Failed to load draft count:', error);
      }
    };
    
    loadDraftCount();
    
    // Refresh count periodically
    const interval = setInterval(loadDraftCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const navigationItems = [
    { path: '/', label: 'Dashboard', key: 'dashboard' },
    { path: '/drafts', label: 'Draft Schedules', key: 'drafts', badge: draftCount, priority: 'high' },
    { path: '/upload', label: 'New Schedule', key: 'upload', priority: 'high' },
    { path: '/schedules', label: 'Browse Schedules', key: 'schedules', priority: 'medium' },
    { path: '/block-configuration', label: 'Block Configuration', key: 'block-configuration', priority: 'medium' },
    { path: '/tod-shifts', label: 'Tod Shifts', key: 'tod-shifts', priority: 'low', beta: true },
    { path: '/routes', label: 'Manage Routes', key: 'routes', priority: 'low' },
    { path: '/settings', label: 'Settings', key: 'settings', priority: 'low' },
  ];

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    handleMenuClose();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ 
            flexGrow: 0, 
            mr: 4, 
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          Bus Route Scheduler
        </Typography>

        {isMobile ? (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <UserProfile />
            <IconButton
              size="large"
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={handleMenuClick}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              {navigationItems.map((item) => {
                const showBadge = item.key === 'drafts' && item.badge && item.badge > 0;
                
                return (
                  <MenuItem
                    key={item.key}
                    onClick={() => handleNavigation(item.path)}
                    selected={isActive(item.path)}
                    sx={{
                      fontWeight: item.priority === 'high' ? 'medium' : 'normal'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      {item.key === 'drafts' && <ScheduleIcon fontSize="small" />}
                      {item.label}
                      {showBadge && (
                        <Badge 
                          badgeContent={item.badge} 
                          color="secondary" 
                          sx={{ ml: 'auto' }}
                        />
                      )}
                      {item.beta && (
                        <Chip 
                          label="Beta" 
                          size="small" 
                          sx={{ 
                            ml: 'auto', 
                            height: 16, 
                            fontSize: '0.5rem' 
                          }} 
                        />
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Menu>
          </>
        ) : (
          <>
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
              {navigationItems.map((item) => {
                const showBadge = item.key === 'drafts' && item.badge && item.badge > 0;
                const isPriority = item.priority === 'high';
                
                return (
                  <Box key={item.key} sx={{ position: 'relative' }}>
                    <Button
                      color="inherit"
                      onClick={() => handleNavigation(item.path)}
                      startIcon={item.key === 'drafts' ? <ScheduleIcon /> : undefined}
                      sx={{
                        backgroundColor: isActive(item.path) 
                          ? 'rgba(255, 255, 255, 0.15)' 
                          : 'transparent',
                        fontWeight: isPriority ? 'medium' : 'normal',
                        border: isPriority ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          transform: isPriority ? 'translateY(-1px)' : 'none',
                        },
                        transition: 'all 0.2s ease',
                        px: 2
                      }}
                    >
                      {item.label}
                      {item.beta && (
                        <Chip 
                          label="Beta" 
                          size="small" 
                          sx={{ 
                            ml: 1, 
                            height: 18, 
                            fontSize: '0.625rem',
                            backgroundColor: 'warning.main',
                            color: 'warning.contrastText'
                          }} 
                        />
                      )}
                    </Button>
                    
                    {showBadge && (
                      <Badge
                        badgeContent={item.badge}
                        color="secondary"
                        sx={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          '& .MuiBadge-badge': {
                            fontSize: '0.625rem',
                            minWidth: 16,
                            height: 16
                          }
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
            <UserProfile />
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;
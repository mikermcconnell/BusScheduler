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
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
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

  // Set user ID in storage service when user changes
  React.useEffect(() => {
    scheduleStorage.setUserId(user?.id || null);
  }, [user]);
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const navigationItems = [
    { path: '/', label: 'Dashboard', key: 'dashboard' },
    { path: '/upload', label: 'Upload Schedule', key: 'upload' },
    { path: '/drafts', label: 'Draft Schedules', key: 'drafts' },
    { path: '/block-configuration', label: 'Block Configuration', key: 'block-configuration' },
    { path: '/tod-shifts', label: 'Tod Shifts', key: 'tod-shifts' },
    { path: '/schedules', label: 'View Schedules', key: 'schedules' },
    { path: '/routes', label: 'Manage Routes', key: 'routes' },
    { path: '/settings', label: 'Settings', key: 'settings' },
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
              {navigationItems.map((item) => (
                <MenuItem
                  key={item.key}
                  onClick={() => handleNavigation(item.path)}
                  selected={isActive(item.path)}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <>
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
              {navigationItems.map((item) => (
                <Button
                  key={item.key}
                  color="inherit"
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    backgroundColor: isActive(item.path) 
                      ? 'rgba(255, 255, 255, 0.1)' 
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
            <UserProfile />
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;
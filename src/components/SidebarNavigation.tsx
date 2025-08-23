import React, { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Typography,
  Box,
  Collapse,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CloudUpload as UploadIcon,
  Drafts as DraftsIcon,
  ViewList as ViewIcon,
  Build as ConfigIcon,
  Schedule as ShiftsIcon,
  Route as RoutesIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  Search as SearchIcon,
  History as HistoryIcon,
  Star as StarIcon,
  KeyboardArrowRight as WorkflowIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { scheduleStorage } from '../services/scheduleStorage';
import ContextualActions from './ContextualActions';

const DRAWER_WIDTH = 280;
const COLLAPSED_WIDTH = 72;

interface NavigationItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
  children?: NavigationItem[];
}

interface RecentItem {
  id: string;
  name: string;
  path: string;
  timestamp: number;
  type: 'schedule' | 'draft' | 'config';
}

interface SidebarNavigationProps {
  open: boolean;
  onToggle: () => void;
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ open, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['scheduling']);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  // Load recent items from localStorage
  useEffect(() => {
    const savedRecent = localStorage.getItem('recentNavItems');
    if (savedRecent) {
      try {
        setRecentItems(JSON.parse(savedRecent));
      } catch (error) {
        console.error('Failed to parse recent items:', error);
      }
    }
  }, []);

  // Save recent items when they change
  useEffect(() => {
    localStorage.setItem('recentNavItems', JSON.stringify(recentItems));
  }, [recentItems]);

  const [draftCount, setDraftCount] = React.useState(0);

  // Load draft count for navigation badge
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
    const interval = setInterval(loadDraftCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const navigationGroups: { [key: string]: NavigationItem[] } = {
    primary: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        path: '/',
        icon: <DashboardIcon />,
        description: 'Overview and quick actions'
      },
      {
        key: 'drafts',
        label: 'Draft Schedules',
        path: '/drafts',
        icon: <DraftsIcon />,
        description: 'Continue working on schedules',
        badge: draftCount > 0 ? draftCount.toString() : undefined
      },
      {
        key: 'upload',
        label: 'New Schedule',
        path: '/upload',
        icon: <UploadIcon />,
        description: 'Start creating a new schedule'
      },
      {
        key: 'schedules',
        label: 'Browse Schedules',
        path: '/schedules',
        icon: <ViewIcon />,
        description: 'View published schedules'
      }
    ],
    advanced: [
      {
        key: 'block-configuration',
        label: 'Block Configuration',
        path: '/block-configuration',
        icon: <ConfigIcon />,
        description: 'Configure bus blocks and timing'
      },
      {
        key: 'tod-shifts',
        label: 'Tod Shifts',
        path: '/tod-shifts',
        icon: <ShiftsIcon />,
        description: 'Manage operator shift schedules',
        badge: 'Beta'
      },
      {
        key: 'routes',
        label: 'Manage Routes',
        path: '/routes',
        icon: <RoutesIcon />,
        description: 'Configure route settings'
      }
    ],
    settings: [
      {
        key: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: <SettingsIcon />,
        description: 'Application preferences'
      }
    ]
  };

  const addRecentItem = (item: Omit<RecentItem, 'timestamp'>) => {
    const newItem: RecentItem = {
      ...item,
      timestamp: Date.now()
    };
    
    setRecentItems(prev => {
      const filtered = prev.filter(i => i.id !== item.id);
      return [newItem, ...filtered].slice(0, 5); // Keep only 5 recent items
    });
  };

  const handleGroupToggle = (groupKey: string) => {
    if (collapsed) return; // Don't expand groups when collapsed
    
    setExpandedGroups(prev => 
      prev.includes(groupKey) 
        ? prev.filter(key => key !== groupKey)
        : [...prev, groupKey]
    );
  };

  const handleNavigation = (path: string, item?: NavigationItem) => {
    navigate(path);
    
    if (item) {
      addRecentItem({
        id: item.key,
        name: item.label,
        path: item.path,
        type: getItemType(item.key)
      });
    }
    
    if (isMobile) {
      onToggle(); // Close sidebar on mobile after navigation
    }
  };

  const getItemType = (key: string): RecentItem['type'] => {
    if (['drafts', 'upload'].includes(key)) return 'draft';
    if (['block-configuration', 'routes'].includes(key)) return 'config';
    return 'schedule';
  };

  const isActive = (path: string) => location.pathname === path;

  const getGroupLabel = (groupKey: string) => {
    const labels = {
      primary: 'Main Navigation',
      advanced: 'Advanced Tools', 
      settings: 'System'
    };
    return labels[groupKey as keyof typeof labels] || groupKey;
  };

  const getGroupIcon = (groupKey: string) => {
    const icons = {
      primary: <DashboardIcon />,
      advanced: <ConfigIcon />,
      settings: <SettingsIcon />
    };
    return icons[groupKey as keyof typeof icons] || <DashboardIcon />;
  };

  // Filter items based on search
  const filterItems = (items: NavigationItem[]) => {
    if (!searchQuery) return items;
    return items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        p: collapsed ? 1 : 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {!collapsed && (
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Bus Scheduler
          </Typography>
        )}
        <IconButton 
          onClick={() => setCollapsed(!collapsed)}
          size="small"
          sx={{ ml: collapsed ? 0 : 'auto' }}
        >
          {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      {/* Search */}
      {!collapsed && (
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search navigation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'grey.50'
              }
            }}
          />
        </Box>
      )}

      {/* Recent Items */}
      {!collapsed && recentItems.length > 0 && !searchQuery && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" sx={{ 
            color: 'text.secondary', 
            fontWeight: 'medium',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Recent
          </Typography>
          <List dense sx={{ py: 0.5 }}>
            {recentItems.slice(0, 3).map((item) => (
              <ListItem
                key={item.id}
                disablePadding
                sx={{ mb: 0.5 }}
              >
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 1,
                    minHeight: 32,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <HistoryIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      noWrap: true
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1 }} />
        </Box>
      )}

      {/* Navigation Groups */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(navigationGroups).map(([groupKey, items]) => {
          const filteredItems = filterItems(items);
          const isExpanded = expandedGroups.includes(groupKey);
          
          if (searchQuery && filteredItems.length === 0) return null;
          
          return (
            <Box key={groupKey}>
              {/* Group Header */}
              <ListItem
                disablePadding
                sx={{ px: collapsed ? 1 : 2, py: 0.5 }}
              >
                <ListItemButton
                  onClick={() => handleGroupToggle(groupKey)}
                  sx={{
                    borderRadius: 1,
                    minHeight: collapsed ? 48 : 40,
                    justifyContent: collapsed ? 'center' : 'flex-start'
                  }}
                >
                  <ListItemIcon sx={{ 
                    minWidth: collapsed ? 'auto' : 40,
                    color: 'primary.main'
                  }}>
                    {getGroupIcon(groupKey)}
                  </ListItemIcon>
                  {!collapsed && (
                    <>
                      <ListItemText
                        primary={getGroupLabel(groupKey)}
                        primaryTypographyProps={{
                          fontWeight: 'medium',
                          fontSize: '0.875rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'primary.main'
                        }}
                      />
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </>
                  )}
                </ListItemButton>
              </ListItem>

              {/* Group Items */}
              <Collapse in={collapsed || isExpanded || !!searchQuery} timeout="auto">
                <List component="div" disablePadding sx={{ px: collapsed ? 0.5 : 1 }}>
                  {filteredItems.map((item) => (
                    <ListItem
                      key={item.key}
                      disablePadding
                      sx={{ mb: 0.5 }}
                    >
                      <Tooltip 
                        title={collapsed ? `${item.label}${item.description ? ` - ${item.description}` : ''}` : ''}
                        placement="right"
                        arrow
                      >
                        <ListItemButton
                          onClick={() => handleNavigation(item.path, item)}
                          selected={isActive(item.path)}
                          sx={{
                            borderRadius: 1,
                            minHeight: 44,
                            backgroundColor: isActive(item.path) ? 'primary.main' : 'transparent',
                            color: isActive(item.path) ? 'white' : 'text.primary',
                            '&:hover': {
                              backgroundColor: isActive(item.path) ? 'primary.dark' : 'action.hover'
                            },
                            '&.Mui-selected': {
                              backgroundColor: 'primary.main',
                              '&:hover': {
                                backgroundColor: 'primary.dark'
                              }
                            },
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            px: collapsed ? 1 : 2
                          }}
                        >
                          <ListItemIcon sx={{ 
                            minWidth: collapsed ? 'auto' : 40,
                            color: isActive(item.path) ? 'white' : 'action.active'
                          }}>
                            {item.icon}
                          </ListItemIcon>
                          {!collapsed && (
                            <>
                              <ListItemText
                                primary={item.label}
                                secondary={item.description}
                                primaryTypographyProps={{
                                  fontWeight: isActive(item.path) ? 'medium' : 'normal',
                                  fontSize: '0.875rem'
                                }}
                                secondaryTypographyProps={{
                                  fontSize: '0.75rem',
                                  color: isActive(item.path) ? 'rgba(255,255,255,0.7)' : 'text.secondary'
                                }}
                              />
                              {item.badge && (
                                <Chip
                                  label={item.badge}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.625rem',
                                    backgroundColor: 'secondary.main',
                                    color: 'secondary.contrastText'
                                  }}
                                />
                              )}
                            </>
                          )}
                        </ListItemButton>
                      </Tooltip>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      {!collapsed && (
        <Box sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: 'grey.50'
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Bus Route Scheduler v2.0
          </Typography>
          <Typography variant="caption" color="text.secondary">
            © 2024 Schedule Management
          </Typography>
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onToggle}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden'
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default SidebarNavigation;
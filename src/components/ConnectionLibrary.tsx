/**
 * Connection Library Component
 * Displays available connection templates for selection in optimization
 * 
 * ⚠️ CURRENTLY USING SAMPLE DATA - See sampleConnectionData.ts
 * This component will need to be updated when real connection data is integrated
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Tooltip,
  Grid,
  Divider,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Train as TrainIcon,
  School as SchoolIcon,
  BusinessCenter as CollegeIcon,
  SwapHoriz as TransferIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Star as PriorityIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

import { ConnectionPoint } from '../types/connectionOptimization';
import { SampleConnectionDataService } from '../services/sampleConnectionData';

interface ConnectionLibraryProps {
  onConnectionSelect: (connection: ConnectionPoint) => void;
  selectedConnectionIds?: string[];
}

const ConnectionLibrary: React.FC<ConnectionLibraryProps> = ({
  onConnectionSelect,
  selectedConnectionIds = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showSampleDataWarning, setShowSampleDataWarning] = useState(true);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  // Get all sample connections
  const allConnections = useMemo(() => {
    return SampleConnectionDataService.getAllSampleConnections();
  }, []);

  // Filter connections based on search and type
  const filteredConnections = useMemo(() => {
    let connections = allConnections;

    // Filter by type
    if (selectedType !== 'all') {
      connections = connections.filter(conn => conn.type === selectedType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      connections = SampleConnectionDataService.searchConnections(searchQuery);
      if (selectedType !== 'all') {
        connections = connections.filter(conn => conn.type === selectedType);
      }
    }

    return connections;
  }, [allConnections, searchQuery, selectedType]);

  // Get connection statistics
  const stats = useMemo(() => {
    return SampleConnectionDataService.getConnectionStats();
  }, []);

  // Get icon for connection type
  const getConnectionIcon = (type: ConnectionPoint['type']) => {
    switch (type) {
      case 'go-train':
        return <TrainIcon color="primary" />;
      case 'high-school':
        return <SchoolIcon color="secondary" />;
      case 'college-arrival':
      case 'college-departure':
        return <CollegeIcon color="info" />;
      default:
        return <TransferIcon color="action" />;
    }
  };

  // Get color for priority level
  const getPriorityColor = (priority: number): 'error' | 'warning' | 'success' | 'default' => {
    if (priority >= 9) return 'error';
    if (priority >= 7) return 'warning';
    if (priority >= 5) return 'success';
    return 'default';
  };

  // Get priority label
  const getPriorityLabel = (priority: number): string => {
    if (priority >= 9) return 'Critical';
    if (priority >= 7) return 'Important';
    if (priority >= 5) return 'Standard';
    return 'Low';
  };

  // Toggle connection details expansion
  const toggleConnectionExpansion = (connectionId: string) => {
    const newExpanded = new Set(expandedConnections);
    if (newExpanded.has(connectionId)) {
      newExpanded.delete(connectionId);
    } else {
      newExpanded.add(connectionId);
    }
    setExpandedConnections(newExpanded);
  };

  // Handle connection selection
  const handleConnectionSelect = (connection: ConnectionPoint) => {
    onConnectionSelect(connection);
  };

  // Check if connection is already selected
  const isConnectionSelected = (connectionId: string) => {
    return selectedConnectionIds.includes(connectionId);
  };

  return (
    <Box>
      {/* Sample Data Warning */}
      <Collapse in={showSampleDataWarning}>
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setShowSampleDataWarning(false)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          <AlertTitle>Using Sample Data</AlertTitle>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            This library shows sample connection templates for development. 
            Real connection data integration pending.
          </Typography>
        </Alert>
      </Collapse>

      {/* Search and Filter Controls */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search connections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All Types"
            color={selectedType === 'all' ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedType('all')}
            variant={selectedType === 'all' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`GO Trains (${stats.byType['go-train']})`}
            color={selectedType === 'go-train' ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedType('go-train')}
            variant={selectedType === 'go-train' ? 'filled' : 'outlined'}
            icon={<TrainIcon fontSize="small" />}
          />
          <Chip
            label={`Schools (${stats.byType['high-school']})`}
            color={selectedType === 'high-school' ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedType('high-school')}
            variant={selectedType === 'high-school' ? 'filled' : 'outlined'}
            icon={<SchoolIcon fontSize="small" />}
          />
          <Chip
            label={`College (${stats.byType['college-arrival'] + stats.byType['college-departure']})`}
            color={selectedType.startsWith('college') ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedType('college-arrival')}
            variant={selectedType.startsWith('college') ? 'filled' : 'outlined'}
            icon={<CollegeIcon fontSize="small" />}
          />
        </Box>
      </Box>

      {/* Statistics Summary */}
      <Box sx={{ mb: 2, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Showing {filteredConnections.length} of {stats.total} connections •{' '}
          <Chip label={`${stats.byPriority.critical} Critical`} size="small" color="error" variant="outlined" sx={{ mx: 0.5, height: 20 }} />
          <Chip label={`${stats.byPriority.important} Important`} size="small" color="warning" variant="outlined" sx={{ mx: 0.5, height: 20 }} />
          <Chip label={`${stats.byPriority.standard} Standard`} size="small" color="success" variant="outlined" sx={{ mx: 0.5, height: 20 }} />
        </Typography>
      </Box>

      {/* Connection Templates List */}
      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        {filteredConnections.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <InfoIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body1">No connections found</Typography>
            <Typography variant="body2">
              {searchQuery ? 'Try adjusting your search terms' : 'No connections match the selected filters'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {filteredConnections.map((connection) => (
              <Card 
                key={connection.id} 
                sx={{ 
                  mb: 1, 
                  border: '1px solid',
                  borderColor: isConnectionSelected(connection.id) ? 'primary.main' : 'divider',
                  backgroundColor: isConnectionSelected(connection.id) ? 'primary.50' : 'background.paper'
                }}
              >
                <ListItemButton
                  onClick={() => toggleConnectionExpansion(connection.id)}
                  sx={{ p: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getConnectionIcon(connection.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" component="span">
                          {connection.name}
                        </Typography>
                        <Chip
                          label={getPriorityLabel(connection.priority)}
                          size="small"
                          color={getPriorityColor(connection.priority)}
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                        {isConnectionSelected(connection.id) && (
                          <Chip
                            label="Selected"
                            size="small"
                            color="primary"
                            variant="filled"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="caption">{connection.timepointName}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="small" color="action" />
                          <Typography variant="caption">
                            {connection.scheduleTimes.arrivalTime || connection.scheduleTimes.departureTime || 'Variable'}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  <Tooltip title="Add to Active Connections">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnectionSelect(connection);
                      }}
                      disabled={isConnectionSelected(connection.id)}
                      sx={{
                        mr: 1,
                        backgroundColor: isConnectionSelected(connection.id) ? 'transparent' : 'primary.50',
                        '&:hover': {
                          backgroundColor: isConnectionSelected(connection.id) ? 'transparent' : 'primary.100',
                        }
                      }}
                    >
                      <ArrowForwardIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small">
                    {expandedConnections.has(connection.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </ListItemButton>

                <Collapse in={expandedConnections.has(connection.id)}>
                  <CardContent sx={{ pt: 0, pb: 1 }}>
                    <Divider sx={{ mb: 2 }} />
                    
                    {/* Connection Details */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Service
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {connection.metadata?.serviceName || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Priority Level
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PriorityIcon fontSize="small" color="action" />
                          <Typography variant="body2" fontWeight="medium">
                            {connection.priority}/10 - {getPriorityLabel(connection.priority)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Connection Windows */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Connection Windows
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`Ideal: ${connection.connectionWindows.ideal.min}-${connection.connectionWindows.ideal.max}min`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                        <Chip
                          label={`Partial: ${connection.connectionWindows.partial.min}-${connection.connectionWindows.partial.max}min`}
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                        <Chip
                          label={`Missed: >${connection.connectionWindows.missed.threshold}min`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      </Box>
                    </Box>

                    {/* Operating Days */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Operating Days
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {connection.dayTypes.map((day) => (
                          <Chip
                            key={day}
                            label={day.charAt(0).toUpperCase() + day.slice(1)}
                            size="small"
                            variant="outlined"
                            color="default"
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* Notes */}
                    {connection.metadata?.notes && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          Notes
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {connection.metadata.notes}
                        </Typography>
                      </Box>
                    )}

                    {/* Action Button */}
                    <CardActions sx={{ px: 0, pb: 0 }}>
                      <Button
                        variant={isConnectionSelected(connection.id) ? "outlined" : "contained"}
                        color="primary"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleConnectionSelect(connection)}
                        disabled={isConnectionSelected(connection.id)}
                        fullWidth
                      >
                        {isConnectionSelected(connection.id) ? 'Already Selected' : 'Add Connection'}
                      </Button>
                    </CardActions>
                  </CardContent>
                </Collapse>
              </Card>
            ))}
          </List>
        )}
      </Box>

      {/* Quick Stats Footer */}
      <Box sx={{ mt: 2, p: 1, backgroundColor: 'info.50', borderRadius: 1 }}>
        <Typography variant="caption" color="info.dark">
          💡 Sample data covers {stats.timeSpan.earliest} - {stats.timeSpan.latest} service hours
          with realistic Barrie transit scenarios
        </Typography>
      </Box>
    </Box>
  );
};

export default ConnectionLibrary;
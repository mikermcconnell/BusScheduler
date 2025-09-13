import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  Chip,
  Slider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Avatar,
  Collapse,
  Divider,
  Grid,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  Train as TrainIcon,
  School as SchoolIcon,
  DirectionsBus as BusIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Flag as PriorityIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { ConnectionPoint } from '../types/connectionOptimization';

interface ConnectionPriorityListProps {
  connections: ConnectionPoint[];
  onConnectionRemove: (connectionId: string) => void;
  onPriorityChange: (connectionId: string, priority: number) => void;
  onConnectionUpdate?: (connectionId: string, updates: Partial<ConnectionPoint>) => void;
}

interface ConnectionCardProps {
  connection: ConnectionPoint;
  onRemove: () => void;
  onPriorityChange: (priority: number) => void;
  onUpdate?: (updates: Partial<ConnectionPoint>) => void;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  onRemove,
  onPriorityChange,
  onUpdate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState(connection);

  const getTypeIcon = () => {
    switch (connection.type) {
      case 'go-train': return <TrainIcon />;
      case 'high-school': return <SchoolIcon />;
      case 'college-arrival':
      case 'college-departure': return <BusIcon />;
      default: return <ScheduleIcon />;
    }
  };

  const getTypeColor = () => {
    switch (connection.type) {
      case 'go-train': return '#2196F3';
      case 'high-school': return '#4CAF50';
      case 'college-arrival':
      case 'college-departure': return '#9C27B0';
      default: return '#757575';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'error';
    if (priority >= 5) return 'warning';
    if (priority >= 3) return 'success';
    return 'default';
  };

  const getPriorityLabel = (priority: number): string => {
    if (priority >= 8) return 'High';
    if (priority >= 5) return 'Medium';
    if (priority >= 3) return 'Low';
    return 'Very Low';
  };

  const getPriorityNumeric = (priority: number): number => {
    return priority;
  };

  const getPriorityFromNumeric = (value: number): number => {
    return Math.max(1, Math.min(10, Math.round(value)));
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(editData);
    }
    setEditDialogOpen(false);
  };

  const formatDayTypes = (dayTypes: string[]) => {
    const dayMap: { [key: string]: string } = {
      'weekday': 'Weekdays',
      'saturday': 'Saturdays',
      'sunday': 'Sundays',
    };
    return dayTypes.map(day => dayMap[day] || day).join(', ');
  };

  return (
    <>
      <Card 
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: 2,
            borderColor: getTypeColor(),
          }
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {/* Drag Handle */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 0.5 }}>
              <DragIcon sx={{ color: 'text.disabled', cursor: 'grab' }} />
            </Box>

            {/* Connection Icon */}
            <Avatar 
              sx={{ 
                bgcolor: getTypeColor(), 
                width: 36, 
                height: 36,
                fontSize: '1rem'
              }}
            >
              {getTypeIcon()}
            </Avatar>

            {/* Main Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" noWrap sx={{ fontWeight: 'medium' }}>
                  {connection.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Edit connection">
                    <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View details">
                    <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                      {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove connection">
                    <IconButton size="small" onClick={onRemove} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip 
                  label={connection.type.replace('_', ' ')}
                  size="small"
                  sx={{ bgcolor: getTypeColor(), color: 'white', fontSize: '0.7rem' }}
                />
                <Chip 
                  label={getPriorityLabel(connection.priority)}
                  size="small"
                  color={getPriorityColor(connection.priority) as any}
                  variant="outlined"
                />
                {(connection.scheduleTimes.arrivalTime || connection.scheduleTimes.departureTime) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {connection.scheduleTimes.arrivalTime || connection.scheduleTimes.departureTime}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Typography variant="body2" color="text.secondary" noWrap>
                → {connection.metadata?.serviceName || 'Unknown Service'}
              </Typography>

              {/* Priority Slider */}
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PriorityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Priority Level
                  </Typography>
                </Box>
                <Slider
                  value={getPriorityNumeric(connection.priority)}
                  onChange={(_, value) => {
                    const newPriority = getPriorityFromNumeric(value as number);
                    onPriorityChange(newPriority);
                  }}
                  min={1}
                  max={10}
                  step={1}
                  marks={[
                    { value: 2, label: 'Low' },
                    { value: 5, label: 'Medium' },
                    { value: 9, label: 'High' },
                  ]}
                  sx={{
                    color: getTypeColor(),
                    '& .MuiSlider-mark': {
                      backgroundColor: 'currentColor',
                    },
                    '& .MuiSlider-markLabel': {
                      fontSize: '0.7rem',
                    },
                  }}
                />
              </Box>

              {/* Expanded Details */}
              <Collapse in={expanded}>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Transfer Time
                      </Typography>
                      <Typography variant="body2">
                        Min: {connection.connectionWindows.ideal.min}min
                        {connection.connectionWindows.ideal.max && ` | Max: ${connection.connectionWindows.ideal.max}min`}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Operating Days
                      </Typography>
                      <Typography variant="body2">
                        {formatDayTypes(connection.dayTypes)}
                      </Typography>
                    </Box>
                  </Grid>
                  {connection.metadata?.notes && (
                    <Grid size={{ xs: 12 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Notes
                        </Typography>
                        <Typography variant="body2">
                          {connection.metadata.notes}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Collapse>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Connection: {connection.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Location Name"
              fullWidth
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            />

            <TextField
              label="Target Service"
              fullWidth
              value={editData.metadata?.serviceName || ''}
              onChange={(e) => setEditData({ 
                ...editData, 
                metadata: { 
                  ...editData.metadata, 
                  serviceName: e.target.value 
                }
              })}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Arrival Time"
                  type="time"
                  value={editData.scheduleTimes?.arrivalTime || ''}
                  onChange={(e) => setEditData({ 
                    ...editData, 
                    scheduleTimes: { ...editData.scheduleTimes, arrivalTime: e.target.value }
                  })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Departure Time"
                  type="time"
                  value={editData.scheduleTimes?.departureTime || ''}
                  onChange={(e) => setEditData({ 
                    ...editData, 
                    scheduleTimes: { ...editData.scheduleTimes, departureTime: e.target.value }
                  })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Min Connection Time (min)"
                  type="number"
                  value={editData.connectionWindows?.ideal?.min || ''}
                  onChange={(e) => setEditData({ 
                    ...editData, 
                    connectionWindows: { 
                      ...editData.connectionWindows, 
                      ideal: { ...editData.connectionWindows.ideal, min: parseInt(e.target.value) || 0 }
                    }
                  })}
                  inputProps={{ min: 1, max: 30 }}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Max Connection Time (min)"
                  type="number"
                  value={editData.connectionWindows?.ideal?.max || ''}
                  onChange={(e) => setEditData({ 
                    ...editData, 
                    connectionWindows: { 
                      ...editData.connectionWindows, 
                      ideal: { ...editData.connectionWindows.ideal, max: parseInt(e.target.value) || 0 }
                    }
                  })}
                  inputProps={{ min: 1, max: 60 }}
                  fullWidth
                />
              </Grid>
            </Grid>

            <TextField
              label="Priority (1-10)"
              type="number"
              fullWidth
              value={editData.priority}
              onChange={(e) => setEditData({ ...editData, priority: parseInt(e.target.value) || 1 })}
              inputProps={{ min: 1, max: 10, step: 1 }}
              helperText="1=Very Low, 3-4=Low, 5-7=Medium, 8-9=High, 10=Critical"
            />

            <TextField
              label="Notes"
              multiline
              rows={2}
              fullWidth
              value={editData.metadata?.notes || ''}
              onChange={(e) => setEditData({ 
                ...editData, 
                metadata: { 
                  ...editData.metadata, 
                  notes: e.target.value 
                }
              })}
              placeholder="Additional notes about this connection..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const ConnectionPriorityList: React.FC<ConnectionPriorityListProps> = ({
  connections,
  onConnectionRemove,
  onPriorityChange,
  onConnectionUpdate,
}) => {
  // Sort connections by priority (HIGH -> MEDIUM -> LOW) and then by name
  const sortedConnections = [...connections].sort((a, b) => {
    // Priority is a number (1-10), so sort descending (highest priority first)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    
    return a.name.localeCompare(b.name);
  });

  const priorityStats = connections.reduce((acc, conn) => {
    acc[conn.priority] = (acc[conn.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box>
      {/* Priority Summary */}
      {connections.length > 0 && (
        <Box sx={{ 
          mb: 2, 
          p: 2, 
          backgroundColor: 'grey.50', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="subtitle2" gutterBottom>
            Priority Distribution
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map(priority => (
              <Box key={priority} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip
                  label={`${priority}: ${priorityStats[priority] || 0}`}
                  size="small"
                  color={
                    priority === 'HIGH' ? 'error' :
                    priority === 'MEDIUM' ? 'warning' : 'success'
                  }
                  variant="outlined"
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Connection Cards */}
      <Box>
        {sortedConnections.map((connection) => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            onRemove={() => onConnectionRemove(connection.id)}
            onPriorityChange={(priority) => onPriorityChange(connection.id, priority)}
            onUpdate={onConnectionUpdate ? (updates) => onConnectionUpdate(connection.id, updates) : undefined}
          />
        ))}
      </Box>

      {/* Help Text */}
      <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'info.50', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          💡 <strong>Priority Guide:</strong> High priority connections are optimized first, 
          Medium priority are balanced with schedule reliability, Low priority are optimized 
          when possible without affecting higher priorities.
        </Typography>
      </Box>
    </Box>
  );
};

export default ConnectionPriorityList;
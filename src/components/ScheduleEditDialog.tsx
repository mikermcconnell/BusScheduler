import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { SavedSchedule } from '../services/scheduleStorage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-dialog-tabpanel-${index}`}
      aria-labelledby={`schedule-dialog-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface ScheduleEditDialogProps {
  open: boolean;
  schedule: SavedSchedule | null;
  onClose: () => void;
  onSave: () => void;
  mode: 'view' | 'edit';
}

interface EditableField {
  key: string;
  value: string;
  isEditing: boolean;
}

const ScheduleEditDialog: React.FC<ScheduleEditDialogProps> = ({
  open,
  schedule,
  onClose,
  onSave,
  mode,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [editableFields, setEditableFields] = useState<EditableField[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (schedule) {
      setEditableFields([
        { key: 'routeName', value: schedule.routeName, isEditing: false },
        { key: 'direction', value: schedule.direction, isEditing: false },
        { key: 'status', value: schedule.status, isEditing: false },
        { key: 'effectiveDate', value: schedule.effectiveDate, isEditing: false },
      ]);
    }
  }, [schedule]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditField = (key: string) => {
    if (mode === 'view') return;
    
    setEditableFields(prev => prev.map(field => 
      field.key === key 
        ? { ...field, isEditing: true }
        : { ...field, isEditing: false }
    ));
  };

  const handleSaveField = (key: string, value: string) => {
    setEditableFields(prev => prev.map(field => 
      field.key === key 
        ? { ...field, value, isEditing: false }
        : field
    ));
    setHasChanges(true);
  };

  const handleCancelEdit = (key: string) => {
    setEditableFields(prev => prev.map(field => 
      field.key === key 
        ? { ...field, isEditing: false }
        : field
    ));
  };

  const handleSave = () => {
    // In a real implementation, this would save the changes
    setHasChanges(false);
    onSave();
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    
    setHasChanges(false);
    setTabValue(0);
    onClose();
  };

  const getFieldValue = (key: string) => {
    const field = editableFields.find(f => f.key === key);
    return field?.value || '';
  };

  const isFieldEditing = (key: string) => {
    const field = editableFields.find(f => f.key === key);
    return field?.isEditing || false;
  };

  if (!schedule) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {mode === 'edit' ? 'Edit Schedule' : 'View Schedule'}: {schedule.routeName}
          </Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {hasChanges && mode === 'edit' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You have unsaved changes.
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Schedule Details" />
            <Tab label="Time Points" />
            <Tab label="Trip Data" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 120 }}>
                Route Name:
              </Typography>
              {isFieldEditing('routeName') ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    defaultValue={getFieldValue('routeName')}
                    onBlur={(e) => handleSaveField('routeName', e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveField('routeName', (e.target as HTMLInputElement).value);
                      }
                    }}
                    autoFocus
                  />
                  <IconButton size="small" onClick={() => handleCancelEdit('routeName')}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">
                    {getFieldValue('routeName')}
                  </Typography>
                  {mode === 'edit' && (
                    <IconButton size="small" onClick={() => handleEditField('routeName')}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 120 }}>
                Direction:
              </Typography>
              <Typography variant="body1">
                {getFieldValue('direction')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 120 }}>
                Status:
              </Typography>
              <Chip 
                label={getFieldValue('status')} 
                color={schedule.status === 'Active' ? 'success' : 'default'}
                size="small"
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 120 }}>
                Trip Count:
              </Typography>
              <Typography variant="body1">
                {typeof schedule.tripCount === 'object' 
                  ? schedule.tripCount.weekday + schedule.tripCount.saturday + schedule.tripCount.sunday
                  : schedule.tripCount}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 120 }}>
                Effective Date:
              </Typography>
              <Typography variant="body1">
                {new Date(getFieldValue('effectiveDate')).toLocaleDateString()}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ minWidth: 120 }}>
                Created:
              </Typography>
              <Typography variant="body1">
                {new Date(schedule.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Time point data would be displayed and editable here.
          </Alert>
          
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time Point</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Travel Time</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Downtown Terminal</TableCell>
                  <TableCell>123 Main Street</TableCell>
                  <TableCell>0 min</TableCell>
                  <TableCell align="right">
                    {mode === 'edit' && (
                      <IconButton size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Johnson at Napier</TableCell>
                  <TableCell>Johnson St & Napier St</TableCell>
                  <TableCell>15 min</TableCell>
                  <TableCell align="right">
                    {mode === 'edit' && (
                      <IconButton size="small">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Alert severity="info">
            Trip timing data and schedule matrix would be displayed here.
          </Alert>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {hasChanges ? 'Cancel' : 'Close'}
        </Button>
        {mode === 'edit' && hasChanges && (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleEditDialog;
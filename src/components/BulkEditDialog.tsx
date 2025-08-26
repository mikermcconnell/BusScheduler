/**
 * Bulk Edit Dialog Component
 * Allows selecting and editing multiple trips at once
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Box,
  Typography,
  Chip,
  Alert,
  RadioGroup,
  Radio
} from '@mui/material';
interface Trip {
  tripNumber: number;
  blockNumber: number;
  departureTime: string;
  serviceBand?: string;
  arrivalTimes: { [timepointId: string]: string };
  recoveryTimes?: { [timepointId: string]: number };
}

interface BulkEditDialogProps {
  open: boolean;
  onClose: () => void;
  selectedTrips: Trip[];
  onApply: (changes: BulkEditChanges) => void;
  serviceBands: string[];
}

export interface BulkEditChanges {
  editType: 'recovery' | 'service-band' | 'shift-time';
  
  // Recovery time changes
  recoveryChange?: {
    operation: 'set' | 'add' | 'multiply';
    value: number;
    applyTo: 'all' | 'first' | 'last' | 'intermediate';
  };
  
  // Service band change
  newServiceBand?: string;
  
  // Time shift
  timeShift?: {
    direction: 'earlier' | 'later';
    minutes: number;
  };
}

const BulkEditDialog: React.FC<BulkEditDialogProps> = ({
  open,
  onClose,
  selectedTrips,
  onApply,
  serviceBands
}) => {
  const [editType, setEditType] = useState<'recovery' | 'service-band' | 'shift-time'>('recovery');
  
  // Recovery time state
  const [recoveryOperation, setRecoveryOperation] = useState<'set' | 'add' | 'multiply'>('set');
  const [recoveryValue, setRecoveryValue] = useState<number>(0);
  const [recoveryApplyTo, setRecoveryApplyTo] = useState<'all' | 'first' | 'last' | 'intermediate'>('all');
  
  // Service band state
  const [newServiceBand, setNewServiceBand] = useState<string>('');
  
  // Time shift state
  const [shiftDirection, setShiftDirection] = useState<'earlier' | 'later'>('later');
  const [shiftMinutes, setShiftMinutes] = useState<number>(5);

  const handleApply = () => {
    const changes: BulkEditChanges = {
      editType
    };

    switch (editType) {
      case 'recovery':
        changes.recoveryChange = {
          operation: recoveryOperation,
          value: recoveryValue,
          applyTo: recoveryApplyTo
        };
        break;
      
      case 'service-band':
        changes.newServiceBand = newServiceBand;
        break;
      
      case 'shift-time':
        changes.timeShift = {
          direction: shiftDirection,
          minutes: shiftMinutes
        };
        break;
    }

    onApply(changes);
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setEditType('recovery');
    setRecoveryOperation('set');
    setRecoveryValue(0);
    setRecoveryApplyTo('all');
    setNewServiceBand('');
    setShiftDirection('later');
    setShiftMinutes(5);
    onClose();
  };

  const getEditDescription = () => {
    switch (editType) {
      case 'recovery':
        const opText = recoveryOperation === 'set' ? 'Set to' : 
                      recoveryOperation === 'add' ? 'Add' : 'Multiply by';
        const targetText = recoveryApplyTo === 'all' ? 'all timepoints' :
                         recoveryApplyTo === 'first' ? 'first timepoint' :
                         recoveryApplyTo === 'last' ? 'last timepoint' :
                         'intermediate timepoints';
        return `${opText} ${recoveryValue} minutes for ${targetText}`;
      
      case 'service-band':
        return `Change service band to "${newServiceBand || 'None selected'}"`;
      
      case 'shift-time':
        return `Shift all times ${shiftMinutes} minutes ${shiftDirection}`;
      
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Bulk Edit {selectedTrips.length} Trips
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Selected trips summary */}
          <Alert severity="info">
            <Typography variant="body2">
              Selected trips: {selectedTrips.map(t => t.tripNumber).join(', ')}
            </Typography>
          </Alert>

          {/* Edit type selection */}
          <FormControl>
            <Typography variant="subtitle2" gutterBottom>
              Edit Type
            </Typography>
            <RadioGroup
              value={editType}
              onChange={(e) => setEditType(e.target.value as typeof editType)}
            >
              <FormControlLabel 
                value="recovery" 
                control={<Radio />} 
                label="Recovery Times" 
              />
              <FormControlLabel 
                value="service-band" 
                control={<Radio />} 
                label="Service Band" 
              />
              <FormControlLabel 
                value="shift-time" 
                control={<Radio />} 
                label="Shift Times" 
              />
            </RadioGroup>
          </FormControl>

          {/* Recovery time options */}
          {editType === 'recovery' && (
            <>
              <FormControl fullWidth>
                <InputLabel>Operation</InputLabel>
                <Select
                  value={recoveryOperation}
                  onChange={(e) => setRecoveryOperation(e.target.value as typeof recoveryOperation)}
                  label="Operation"
                >
                  <MenuItem value="set">Set to value</MenuItem>
                  <MenuItem value="add">Add to current</MenuItem>
                  <MenuItem value="multiply">Multiply by factor</MenuItem>
                </Select>
              </FormControl>

              <TextField
                type="number"
                label={recoveryOperation === 'multiply' ? 'Factor' : 'Minutes'}
                value={recoveryValue}
                onChange={(e) => setRecoveryValue(Number(e.target.value))}
                fullWidth
                inputProps={{
                  min: recoveryOperation === 'multiply' ? 0.5 : 0,
                  max: recoveryOperation === 'multiply' ? 2 : 30,
                  step: recoveryOperation === 'multiply' ? 0.1 : 1
                }}
              />

              <FormControl fullWidth>
                <InputLabel>Apply To</InputLabel>
                <Select
                  value={recoveryApplyTo}
                  onChange={(e) => setRecoveryApplyTo(e.target.value as typeof recoveryApplyTo)}
                  label="Apply To"
                >
                  <MenuItem value="all">All timepoints</MenuItem>
                  <MenuItem value="first">First timepoint only</MenuItem>
                  <MenuItem value="last">Last timepoint only</MenuItem>
                  <MenuItem value="intermediate">Intermediate timepoints</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          {/* Service band options */}
          {editType === 'service-band' && (
            <FormControl fullWidth>
              <InputLabel>New Service Band</InputLabel>
              <Select
                value={newServiceBand}
                onChange={(e) => setNewServiceBand(e.target.value)}
                label="New Service Band"
              >
                {serviceBands.map(band => (
                  <MenuItem key={band} value={band}>{band}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Time shift options */}
          {editType === 'shift-time' && (
            <>
              <FormControl fullWidth>
                <InputLabel>Direction</InputLabel>
                <Select
                  value={shiftDirection}
                  onChange={(e) => setShiftDirection(e.target.value as typeof shiftDirection)}
                  label="Direction"
                >
                  <MenuItem value="earlier">Earlier</MenuItem>
                  <MenuItem value="later">Later</MenuItem>
                </Select>
              </FormControl>

              <TextField
                type="number"
                label="Minutes"
                value={shiftMinutes}
                onChange={(e) => setShiftMinutes(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 1, max: 60 }}
              />
            </>
          )}

          {/* Preview of changes */}
          <Alert severity="warning">
            <Typography variant="body2">
              <strong>Preview:</strong> {getEditDescription()}
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleApply} 
          variant="contained" 
          color="primary"
          disabled={
            (editType === 'service-band' && !newServiceBand) ||
            (editType === 'shift-time' && shiftMinutes <= 0)
          }
        >
          Apply Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkEditDialog;
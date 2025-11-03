import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  FormControlLabel,
  RadioGroup,
  Radio,
  Paper,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  Save as SaveIcon,
  Schedule as ScheduleIcon,
  Edit as RenameIcon,
  Add as AddIcon,
  SwapHoriz as ReplaceIcon,
  DirectionsBus as RouteIcon,
  AutoAwesome as AutoIcon
} from '@mui/icons-material';
import { draftService } from '../services/draftService';
import { WorkflowDraftState } from '../types/workflow';
import { RouteDetector, RouteDetectionResult } from '../utils/routeDetector';
import { ParsedCsvData } from '../utils/csvParser';
import { ParsedExcelData } from '../utils/excelParser';

export interface DraftNamingResult {
  action: 'create' | 'replace';
  draftName: string;
  existingDraftId?: string;
  routeInfo?: {
    routeNumber?: string;
    routeName?: string;
    direction?: string;
  };
  workflowMode: 'full' | 'quick-adjust';
}

interface DraftNamingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: DraftNamingResult) => void;
  fileName: string;
  suggestedName?: string;
  uploadedData?: ParsedCsvData | ParsedExcelData;
  fileType: 'excel' | 'csv';
  workflowContext?: 'new' | 'edit';
}

const DraftNamingDialog: React.FC<DraftNamingDialogProps> = ({
  open,
  onClose,
  onConfirm,
  fileName,
  suggestedName,
  uploadedData,
  fileType,
  workflowContext = 'new'
}) => {
  const [draftName, setDraftName] = useState('');
  const [action, setAction] = useState<'create' | 'replace'>('create');
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [existingDrafts, setExistingDrafts] = useState<WorkflowDraftState[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const isEditContext = workflowContext === 'edit';
  const [workflowMode, setWorkflowMode] = useState<'full' | 'quick-adjust'>(
    isEditContext ? 'quick-adjust' : 'full'
  );
  
  // Route detection states
  const [routeDetection, setRouteDetection] = useState<RouteDetectionResult | null>(null);
  const [routeNumber, setRouteNumber] = useState('');
  const [routeName, setRouteName] = useState('');
  const [direction, setDirection] = useState('');
  const [routeNameSuggestions, setRouteNameSuggestions] = useState<string[]>([]);
  const supportsQuickAdjust = fileType === 'csv';

  // Load existing drafts and set up initial state
  useEffect(() => {
    const loadDrafts = async () => {
      if (open) {
        try {
          // Use Firebase drafts to match what's shown in Draft Library
          const drafts = await draftService.getAllDrafts();
          setExistingDrafts(drafts);
        } catch (error) {
          console.error('Failed to load drafts for duplicate check:', error);
          // Fallback to empty array if Firebase fails
          setExistingDrafts([]);
        }
        
        // Perform route detection if uploaded data is available
        if (uploadedData) {
          const detection = RouteDetector.detect(uploadedData);
          setRouteDetection(detection);
          
          // Set route fields from detection
          setRouteNumber(detection.routeNumber || '');
          setRouteName(detection.routeName || '');
          setDirection(detection.direction || '');
          
          // Generate alternative name suggestions
          const alternatives = RouteDetector.generateAlternativeNames(detection);
          setRouteNameSuggestions(alternatives);
          
          // Use the detected route name as the draft name if we have high confidence
          if (detection.confidence === 'high') {
            setDraftName(detection.suggestedName);
          } else {
            // Generate suggested name from file name
            const baseName = fileName.replace(/\.(csv|xlsx?)$/i, '');
            const cleanName = baseName
              .replace(/[_-]/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase())
              .trim();
            
            setDraftName(suggestedName || cleanName || 'New Schedule Draft');
          }
        } else {
          // No uploaded data, use filename-based name
          const baseName = fileName.replace(/\.(csv|xlsx?)$/i, '');
          const cleanName = baseName
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
          
          setDraftName(suggestedName || cleanName || 'New Schedule Draft');
        }
        
        setAction('create');
        setSelectedDraftId(null);
        setNameError(null);
      }
    };
    
    loadDrafts();
    setWorkflowMode(isEditContext ? 'quick-adjust' : 'full');
  }, [open, fileName, suggestedName, uploadedData, fileType, isEditContext]);

  const validateDraftName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Draft name is required';
    }
    if (name.trim().length < 3) {
      return 'Draft name must be at least 3 characters';
    }
    if (name.trim().length > 50) {
      return 'Draft name must be less than 50 characters';
    }
    
    // Check for duplicate names when creating new draft
    if (action === 'create') {
      const duplicate = existingDrafts.find(
        draft => draft.originalData.fileName.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        return 'A draft with this name already exists';
      }
    }
    
    return null;
  };

  const handleNameChange = (name: string) => {
    setDraftName(name);
    setNameError(validateDraftName(name));
  };

  const handleActionChange = (newAction: 'create' | 'replace') => {
    if (isEditContext) {
      setAction('create');
      setSelectedDraftId(null);
      setNameError(validateDraftName(draftName));
      return;
    }
    setAction(newAction);
    if (newAction === 'create') {
      setSelectedDraftId(null);
      setNameError(validateDraftName(draftName));
    } else {
      setNameError(null);
    }
  };

  const handleDraftSelect = (draftId: string) => {
    setSelectedDraftId(draftId);
    const selectedDraft = existingDrafts.find(d => d.draftId === draftId);
    if (selectedDraft) {
      setDraftName(selectedDraft.originalData.fileName);
    }
  };

  const handleConfirm = () => {
    const error = validateDraftName(draftName);
    if (error) {
      setNameError(error);
      return;
    }

    if (action === 'replace' && !selectedDraftId) {
      setNameError('Please select a draft to replace');
      return;
    }

    const result: DraftNamingResult = {
      action,
      draftName: draftName.trim(),
      existingDraftId: action === 'replace' ? selectedDraftId || undefined : undefined,
      routeInfo: {
        routeNumber: routeNumber.trim() || undefined,
        routeName: routeName.trim() || undefined,
        direction: direction.trim() || undefined
      },
      workflowMode
    };

    onConfirm(result);
  };

  const handleCancel = () => {
    onClose();
  };

  const generateUniqueName = () => {
    const baseName = draftName.replace(/ \(\d+\)$/, ''); // Remove existing number suffix
    let counter = 1;
    let uniqueName = baseName;

    while (existingDrafts.some(draft => 
      draft.originalData.fileName.toLowerCase() === uniqueName.toLowerCase()
    )) {
      uniqueName = `${baseName} (${counter})`;
      counter++;
    }

    setDraftName(uniqueName);
    setNameError(null);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(25, 118, 210, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          pb: 1,
          background: 'linear-gradient(90deg, rgba(25, 118, 210, 0.08) 0%, rgba(156, 39, 176, 0.08) 100%)',
          borderRadius: '12px 12px 0 0',
          borderBottom: '1px solid rgba(25, 118, 210, 0.1)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h5" fontWeight="bold" color="primary.dark">
            Save Your Schedule Draft
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 500 }}>
          Give your schedule a memorable name so you can easily find it later
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
        <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.05)', borderRadius: 2, border: '1px solid rgba(25, 118, 210, 0.1)' }}>
          <Typography variant="body2" color="text.primary" sx={{ mb: 1, fontWeight: 500 }}>
            📄 Uploading: <strong>{fileName}</strong>
          </Typography>
        </Box>

        {/* Route Detection Section */}
        {routeDetection && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(76, 175, 80, 0.05)', borderRadius: 2, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <RouteIcon color="success" />
              <Typography variant="subtitle1" fontWeight="bold" color="success.dark">
                Route Detected
              </Typography>
              <Chip 
                size="small" 
                label={`${routeDetection.confidence} confidence`}
                color={routeDetection.confidence === 'high' ? 'success' : routeDetection.confidence === 'medium' ? 'warning' : 'default'}
                variant="outlined"
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {routeDetection.detectionMethod}: <strong>{routeDetection.suggestedName}</strong>
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Route Number"
                value={routeNumber}
                onChange={(e) => setRouteNumber(e.target.value)}
                size="small"
                sx={{ minWidth: 120 }}
                placeholder="e.g., 101"
              />
              
              <Autocomplete
                options={routeNameSuggestions}
                value={routeName}
                onInputChange={(_, newValue) => setRouteName(newValue)}
                freeSolo
                size="small"
                sx={{ minWidth: 200 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Route Name"
                    placeholder="e.g., Downtown Express"
                  />
                )}
              />
              
              <TextField
                label="Direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                size="small"
                sx={{ minWidth: 140 }}
                placeholder="e.g., Clockwise"
              />
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoIcon fontSize="small" color="primary" />
              <Typography variant="caption" color="text.secondary">
                Route information was automatically detected from your data. You can modify it above.
              </Typography>
            </Box>
          </Box>
        )}

        {!isEditContext && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              What would you like to do?
            </Typography>
            <RadioGroup
              value={action}
              onChange={(e) => handleActionChange(e.target.value as 'create' | 'replace')}
            >
              <FormControlLabel
                value="create"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon fontSize="small" />
                    <span>Create a new draft</span>
                  </Box>
                }
              />
              <FormControlLabel
                value="replace"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ReplaceIcon fontSize="small" />
                    <span>Replace an existing draft</span>
                  </Box>
                }
                disabled={existingDrafts.length === 0}
              />
            </RadioGroup>
          </Box>
        )}

        {supportsQuickAdjust && !isEditContext && (
          <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: '1px solid rgba(25, 118, 210, 0.15)', backgroundColor: 'rgba(25, 118, 210, 0.04)' }}>
            <Typography variant="subtitle2" gutterBottom>
              Workflow Mode
            </Typography>
            <RadioGroup
              value={workflowMode}
              onChange={(e) => setWorkflowMode(e.target.value as 'full' | 'quick-adjust')}
            >
              <FormControlLabel
                value="full"
                control={<Radio />}
                label="Use the full optimization workflow (upload → timepoints → blocks → summary)"
              />
              <FormControlLabel
                value="quick-adjust"
                control={<Radio />}
                label="Skip optimization and tweak the uploaded schedule directly in the summary view"
              />
            </RadioGroup>
            {workflowMode === 'quick-adjust' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                We will import your schedule times as-is so you can make quick minute-level adjustments and re-export immediately.
              </Alert>
            )}
          </Box>
        )}

        {supportsQuickAdjust && isEditContext && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Imported schedules are opened directly in quick adjust mode so you can edit and export without running optimization steps.
          </Alert>
        )}

        {(action === 'create' || isEditContext) && (
          <Box>
            <TextField
              label="Draft Name"
              value={draftName}
              onChange={(e) => handleNameChange(e.target.value)}
              fullWidth
              error={!!nameError}
              helperText={nameError || 'Choose a descriptive name for your schedule draft'}
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 50 }}
            />
            
            {nameError === 'A draft with this name already exists' && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Alert severity="warning" sx={{ flexGrow: 1, mr: 2 }}>
                  A draft with this name already exists
                </Alert>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={generateUniqueName}
                  startIcon={<RenameIcon />}
                >
                  Make Unique
                </Button>
              </Box>
            )}
          </Box>
        )}

        {!isEditContext && action === 'replace' && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Select a draft to replace:
            </Typography>
            
            {existingDrafts.length === 0 ? (
              <Alert severity="info">
                No existing drafts found. Create a new draft instead.
              </Alert>
            ) : (
              <Paper 
                variant="outlined" 
                sx={{ 
                  maxHeight: 300, 
                  overflow: 'auto',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid rgba(25, 118, 210, 0.2)'
                }}
              >
                <List>
                  {existingDrafts.map((draft, index) => (
                    <React.Fragment key={draft.draftId}>
                      <ListItem
                        component="div"
                        sx={{
                          borderRadius: 1,
                          mx: 1,
                          my: 0.5,
                          cursor: 'pointer',
                          backgroundColor: selectedDraftId === draft.draftId 
                            ? 'rgba(25, 118, 210, 0.15)' 
                            : 'rgba(255, 255, 255, 0.7)',
                          borderLeft: selectedDraftId === draft.draftId ? '3px solid' : '3px solid transparent',
                          borderLeftColor: 'primary.main',
                          border: selectedDraftId === draft.draftId 
                            ? '2px solid rgba(25, 118, 210, 0.3)' 
                            : '1px solid rgba(0, 0, 0, 0.1)',
                          '&:hover': {
                            backgroundColor: selectedDraftId === draft.draftId 
                              ? 'rgba(25, 118, 210, 0.2)' 
                              : 'rgba(25, 118, 210, 0.05)',
                            borderColor: 'primary.light'
                          }
                        }}
                        onClick={() => handleDraftSelect(draft.draftId)}
                      >
                        <ListItemText
                          primary={draft.originalData.fileName}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={draft.currentStep}
                                size="small"
                                color={draft.currentStep === 'ready-to-publish' ? 'success' : 'default'}
                                variant="outlined"
                              />
                              <Typography variant="caption" color="text.secondary">
                                Modified {new Date(draft.metadata.lastModifiedAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < existingDrafts.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}

            {selectedDraftId && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>Warning:</strong> This will replace the existing draft and cannot be undone.
                All current progress will be lost.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={
            !!nameError || 
            !draftName.trim() || 
            (action === 'replace' && !selectedDraftId)
          }
          startIcon={action === 'create' ? <SaveIcon /> : <ReplaceIcon />}
          sx={{
            background: 'linear-gradient(45deg, #1976d2 30%, #9c27b0 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1565c0 30%, #8e24aa 90%)',
            }
          }}
        >
          {action === 'create' ? 'Create Draft' : 'Replace Draft'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DraftNamingDialog;

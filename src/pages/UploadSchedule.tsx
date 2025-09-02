import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Grid,
  Button,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Timeline as TimelineIcon,
  PlayArrow as ProcessIcon,
  GetApp as ExportIcon,
  Save as SaveIcon,
  CheckCircleOutline as SavedIcon,
  Today as DayTypeIcon,
  Drafts as DraftIcon,
  AutoMode as AutoSaveIcon,
  Person as ManualSaveIcon,
} from '@mui/icons-material';
import { FileUpload } from '../components/FileUpload';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData, CsvParser } from '../utils/csvParser';
import { ValidationResult } from '../utils/validator';
import { scheduleService, ScheduleGenerationOptions } from '../services/scheduleService';
import { SummarySchedule } from '../types/schedule';
import { CalculationResults, TimeBand } from '../utils/calculator';
import SummaryDisplay from '../components/SummaryDisplay';
import { scheduleStorage, DraftSchedule, startAutoSave, stopAutoSave } from '../services/scheduleStorage';
import DraftScheduleList from '../components/DraftScheduleList';
import DraftNamingDialog, { DraftNamingResult } from '../components/DraftNamingDialog';
import { workflowStateService } from '../services/workflowStateService';
import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import { draftWorkflowService } from '../services/draftWorkflowService';

const UploadSchedule: React.FC = () => {
  const navigate = useNavigate();
  const { 
    createDraftFromUpload, 
    draft, 
    loading: draftLoading, 
    error: draftError,
    isSaving: isDraftSaving 
  } = useWorkflowDraft();
  const [extractedData, setExtractedData] = useState<ParsedExcelData | null>(null);
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'csv' | null>(null);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [summarySchedule, setSummarySchedule] = useState<SummarySchedule | null>(null);
  const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
  
  // UI states
  const [activeStep, setActiveStep] = useState(0);
  const [selectedDayType, setSelectedDayType] = useState<'weekday' | 'saturday' | 'sunday' | ''>('');
  
  // Save states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedScheduleId, setSavedScheduleId] = useState<string | null>(null);
  
  // Draft states
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Draft naming dialog states
  const [showDraftNamingDialog, setShowDraftNamingDialog] = useState(false);
  const [pendingUploadData, setPendingUploadData] = useState<{
    data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; fileType: 'excel' | 'csv' };
    fileName: string;
    validation: ValidationResult;
    report: string;
  } | null>(null);

  const steps = ['Create Draft', 'Configure Schedule', 'Review & Save'];
  
  // Initialize workflow when component mounts
  useEffect(() => {
    const currentWorkflow = workflowStateService.getCurrentWorkflow();
    if (!currentWorkflow || currentWorkflow.workflowType !== 'schedule-creation') {
      workflowStateService.startWorkflow('schedule-creation');
    }
  }, []);

  // Default time bands for demonstration - in real app this would be configurable
  const defaultTimeBands: { weekday: TimeBand[]; saturday: TimeBand[]; sunday: TimeBand[] } = {
    weekday: [
      { startTime: '06:00', endTime: '09:00', frequency: 15 },
      { startTime: '09:00', endTime: '15:00', frequency: 30 },
      { startTime: '15:00', endTime: '18:00', frequency: 15 },
      { startTime: '18:00', endTime: '22:00', frequency: 30 },
    ],
    saturday: [
      { startTime: '07:00', endTime: '22:00', frequency: 30 },
    ],
    sunday: [
      { startTime: '08:00', endTime: '21:00', frequency: 45 },
    ],
  };

  const excelRequirements = [
    'Excel file format (.xlsx or .xls)',
    'First row should contain time point names',
    'Each subsequent row represents a trip schedule',
    'Time format should be HH:MM (24-hour format)',
    'Empty cells are allowed for non-stop time points',
  ];

  const csvRequirements = [
    'CSV file format (.csv)',
    'Transify Segment Travel time export with percentile travel times',
    'Title rows defining route segments (e.g., "Downtown Terminal to Johnson")', 
    'Half-Hour rows with time slots (e.g., "07:00 - 07:29")',
    '50th and 80th percentile runtime data rows',
  ];

  // Auto-save current progress as draft
  const autoSaveDraft = useCallback(() => {
    if (!autoSaveEnabled || !uploadedFileName || (!extractedData && !csvData)) {
      return;
    }

    const uploadedData = extractedData || csvData;
    if (!uploadedData || !fileType) {
      return;
    }

    const processingStep = summarySchedule ? 'completed' : 
                          validation ? 'validated' : 'uploaded';

    const result = scheduleStorage.saveDraftSchedule(
      uploadedFileName,
      fileType,
      uploadedData,
      {
        validation: validation || undefined,
        summarySchedule: summarySchedule || undefined,
        processingStep,
        autoSaved: true,
        existingId: currentDraftId || undefined
      }
    );

    if (result.success && result.draftId) {
      setCurrentDraftId(result.draftId);
      setLastAutoSave(new Date());
      
      // Save session data
      scheduleStorage.saveCurrentSession({
        fileName: uploadedFileName,
        fileType,
        step: activeStep,
        uploadedData,
        validation: validation || undefined,
        summarySchedule: summarySchedule || undefined,
        draftId: result.draftId
      });
    } else if (!result.success) {
      console.error('Auto-save failed:', result.error);
    }
  }, [autoSaveEnabled, uploadedFileName, extractedData, csvData, fileType, validation, summarySchedule, activeStep, currentDraftId]);

  // Manual save as draft
  const saveDraft = useCallback(async () => {
    if (!uploadedFileName || (!extractedData && !csvData) || !fileType) {
      setSaveError('No data to save as draft');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const uploadedData = extractedData || csvData;
      if (!uploadedData) {
        setSaveError('No data available to save as draft');
        return;
      }

      const processingStep = summarySchedule ? 'completed' : 
                            validation ? 'validated' : 'uploaded';

      const result = await scheduleStorage.saveDraftSchedule(
        uploadedFileName,
        fileType,
        uploadedData,
        {
          validation: validation || undefined,
          summarySchedule: summarySchedule || undefined,
          processingStep,
          autoSaved: false,
          existingId: currentDraftId || undefined
        }
      );

      if (result.success && result.draftId) {
        setCurrentDraftId(result.draftId);
        setLastAutoSave(new Date());
        // Show success notification here if desired
      } else {
        setSaveError(result.error || 'Failed to save draft');
      }
    } catch (error) {
      setSaveError('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [uploadedFileName, extractedData, csvData, fileType, validation, summarySchedule, currentDraftId]);

  // Restore from draft
  const restoreFromDraft = useCallback((draft: DraftSchedule) => {
    try {
      // Reset current state
      setExtractedData(null);
      setCsvData(null);
      setValidation(null);
      setSummarySchedule(null);
      setCalculationResults(null);
      
      // Restore from draft
      setUploadedFileName(draft.fileName);
      setFileType(draft.fileType);
      setCurrentDraftId(draft.id);
      
      if (draft.fileType === 'excel') {
        setExtractedData(draft.uploadedData as ParsedExcelData);
      } else {
        setCsvData(draft.uploadedData as ParsedCsvData);
      }
      
      if (draft.validation) {
        setValidation(draft.validation);
      }
      
      if (draft.summarySchedule) {
        setSummarySchedule(draft.summarySchedule);
      }
      
      // Set appropriate step
      switch (draft.processingStep) {
        case 'uploaded':
          setActiveStep(0);
          break;
        case 'validated':
        case 'processed':
          setActiveStep(1);
          break;
        case 'completed':
          setActiveStep(2);
          break;
        default:
          setActiveStep(0);
      }
      
      setShowDrafts(false);
    } catch (error) {
      console.error('Error restoring draft:', error);
      setUploadError('Failed to restore draft');
    }
  }, []);

  // Check for session recovery on mount
  useEffect(() => {
    const session = scheduleStorage.getCurrentSession();
    if (session && session.draftId) {
      const draft = scheduleStorage.getDraftScheduleById(session.draftId);
      if (draft) {
        // Auto-restore the last session
        restoreFromDraft(draft);
      }
    }
  }, [restoreFromDraft]);

  // Set up auto-save
  useEffect(() => {
    if (autoSaveEnabled) {
      startAutoSave(autoSaveDraft);
    } else {
      stopAutoSave();
    }

    return () => {
      stopAutoSave();
    };
  }, [autoSaveEnabled, autoSaveDraft]);

  // Trigger auto-save when relevant data changes
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Debounce auto-save to avoid too frequent saves
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveDraft();
    }, 5000); // 5 second delay

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [extractedData, csvData, validation, summarySchedule, autoSaveDraft]);

  const handleFileUploaded = useCallback(async (
    data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; fileType: 'excel' | 'csv' }, 
    fileName: string, 
    validation: ValidationResult, 
    report: string
  ) => {
    // Store the upload data and show the draft naming dialog
    setPendingUploadData({ data, fileName, validation, report });
    setShowDraftNamingDialog(true);
    
    // Clear any previous errors
    setUploadError(null);
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
  }, []);

  // Handle draft naming dialog confirmation
  const handleDraftNamingConfirm = useCallback(async (result: DraftNamingResult) => {
    if (!pendingUploadData) return;
    
    const { data, fileName, validation, report } = pendingUploadData;
    
    try {
      // Set up the data in state
      if (data.fileType === 'excel' && data.extractedData) {
        setExtractedData(data.extractedData);
        setCsvData(null);
      } else if (data.fileType === 'csv' && data.csvData) {
        setCsvData(data.csvData);
        setExtractedData(null);
      }
      
      setFileType(data.fileType);
      setValidation(validation);
      setUploadedFileName(fileName);
      setQualityReport(report);

      // Handle replacement if needed
      if (result.action === 'replace' && result.existingDraftId) {
        // Delete existing draft workflow
        draftWorkflowService.deleteWorkflow(result.existingDraftId);
      }

      // Create or replace the draft with chosen name
      const uploadedData = data.extractedData || data.csvData;
      if (uploadedData) {
        const draftResult = await createDraftFromUpload(result.draftName, data.fileType, uploadedData);
        if (draftResult.success && draftResult.draftId) {
          setCurrentDraftId(draftResult.draftId);
          
          // Create or update workflow with custom name
          const workflow = draftWorkflowService.getOrCreateWorkflow(draftResult.draftId, result.draftName);
          draftWorkflowService.updateStepStatus(draftResult.draftId, 'upload', 'completed');
          
          console.log('✅ Created workflow draft with custom name:', result.draftName, draftResult.draftId);
          
          // For CSV files, redirect to TimePoints page
          if (data.fileType === 'csv') {
            setTimeout(() => {
              navigate('/timepoints', {
                state: {
                  draftId: draftResult.draftId,
                  draftName: result.draftName,
                  csvData: data.csvData,
                  fileName: result.draftName,
                  fromUpload: true
                }
              });
            }, 1000);
          } else {
            // For Excel files, continue with normal flow
            setActiveStep(1);
          }
        } else {
          console.error('❌ Failed to create workflow draft:', draftResult.error);
          setUploadError(draftResult.error || 'Failed to create draft');
        }
      }

      // Mark the upload step as complete in old workflow system
      workflowStateService.completeStep('upload', {
        fileName: result.draftName,
        fileType: data.fileType,
        uploadedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error handling draft creation:', error);
      setUploadError('Failed to create draft schedule');
    } finally {
      setShowDraftNamingDialog(false);
      setPendingUploadData(null);
    }
  }, [pendingUploadData, createDraftFromUpload, navigate]);

  // Handle draft naming dialog cancellation
  const handleDraftNamingCancel = useCallback(() => {
    setShowDraftNamingDialog(false);
    setPendingUploadData(null);
  }, []);

  const handleUploadError = useCallback((error: string) => {
    setUploadError(error);
    setExtractedData(null);
    setCsvData(null);
    setValidation(null);
    setUploadedFileName(null);
    setQualityReport(null);
    setFileType(null);
    setActiveStep(0); // Reset to upload step
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
  }, []);

  const handleProcessSchedule = useCallback(async () => {
    if (!validation?.isValid) return;
    if (!extractedData && !csvData) return;

    setIsProcessing(true);
    setProcessError(null);

    try {
      const generationOptions: ScheduleGenerationOptions = {
        routeId: 'ROUTE001',
        routeName: uploadedFileName || 'Unnamed Route',
        direction: 'Inbound',
        effectiveDate: new Date(),
        timeBands: defaultTimeBands,
      };

      let timePoints, travelTimes;

      if (fileType === 'csv' && csvData) {
        // Convert CSV data to expected format
        const converted = CsvParser.convertToScheduleFormat(csvData);
        timePoints = converted.timePoints;
        travelTimes = converted.travelTimes;
      } else if (fileType === 'excel' && extractedData) {
        timePoints = extractedData.timePoints;
        travelTimes = extractedData.travelTimes;
      } else {
        throw new Error('No valid data to process');
      }

      const summary = await scheduleService.generateSummarySchedule(
        timePoints,
        travelTimes,
        generationOptions
      );

      const calculations = scheduleService.getLastCalculationResults();
      
      if (!calculations) {
        throw new Error('Failed to retrieve calculation results');
      }

      setSummarySchedule(summary);
      setCalculationResults(calculations);
      setActiveStep(2); // Move to results step

    } catch (error) {
      setProcessError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [extractedData, csvData, validation, uploadedFileName, defaultTimeBands, fileType, navigate]);

  const handleExportSchedule = useCallback((data: string, filename: string) => {
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const handleSaveSchedule = useCallback(async () => {
    if (!summarySchedule) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = scheduleStorage.saveSchedule(
        summarySchedule, 
        fileType || 'excel',
        uploadedFileName || undefined,
        fileType === 'csv' ? csvData : extractedData
      );
      
      if (result.success) {
        setSavedScheduleId(result.scheduleId!);
        // Automatically redirect to edit page after save
        setTimeout(() => {
          navigate(`/generate/edit/${result.scheduleId}`);
        }, 1500); // Give user time to see success message
      } else {
        setSaveError(result.error || 'Failed to save schedule');
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  }, [summarySchedule, fileType, navigate]);

  const handleReset = useCallback(() => {
    setExtractedData(null);
    setCsvData(null);
    setValidation(null);
    setUploadedFileName(null);
    setUploadError(null);
    setQualityReport(null);
    setFileType(null);
    setSelectedDayType('');
    setIsProcessing(false);
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
    setActiveStep(0);
    // Reset save states
    setIsSaving(false);
    setSaveError(null);
    setSavedScheduleId(null);
  }, []);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Draft Working Schedule
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Upload your raw schedule data to create a draft working schedule that you can configure, refine, and save as a final schedule
      </Typography>
      {/* Draft Management */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid
          size={{
            xs: 12,
            md: 8
          }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">
                  Current Session
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    variant={showDrafts ? 'contained' : 'outlined'}
                    onClick={() => setShowDrafts(!showDrafts)}
                    startIcon={<DraftIcon />}
                  >
                    {showDrafts ? 'Hide' : 'Show'} Drafts
                  </Button>
                  {(extractedData || csvData) && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={saveDraft}
                      disabled={isSaving}
                      startIcon={<SaveIcon />}
                    >
                      {isSaving ? 'Saving...' : 'Save Draft'}
                    </Button>
                  )}
                </Box>
              </Box>
              
              {currentDraftId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Current draft working schedule: {uploadedFileName}
                    {lastAutoSave && (
                      <Box component="span" sx={{ ml: 1, fontStyle: 'italic' }}>
                        (Auto-saved {lastAutoSave.toLocaleTimeString()})
                      </Box>
                    )}
                  </Typography>
                </Alert>
              )}
              
              {saveError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {saveError}
                </Alert>
              )}
              
              {!uploadedFileName && !currentDraftId && (
                <Typography variant="body2" color="text.secondary">
                  Upload a file to create a new draft working schedule, or select an existing draft to continue working.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            md: 4
          }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Auto-Save Settings
              </Typography>
              <FormControl fullWidth size="small">
                <Box display="flex" alignItems="center" gap={2}>
                  <Button
                    variant={autoSaveEnabled ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                    startIcon={autoSaveEnabled ? <AutoSaveIcon /> : <ManualSaveIcon />}
                  >
                    {autoSaveEnabled ? 'Auto-Save ON' : 'Auto-Save OFF'}
                  </Button>
                </Box>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {autoSaveEnabled 
                  ? 'Your work is automatically saved every 30 seconds'
                  : 'Click "Save Draft" to manually save your progress'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {/* Draft Schedule List */}
      {showDrafts && (
        <Box sx={{ mb: 4 }}>
          <DraftScheduleList 
            onRestoreDraft={restoreFromDraft}
            onDraftDeleted={() => {
              // Refresh or handle draft deletion
              if (showDrafts) {
                // Component will refresh automatically
              }
            }}
            maxHeight={400}
          />
        </Box>
      )}
      {/* Progress Stepper */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {summarySchedule && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ProcessIcon />}
                onClick={handleReset}
                sx={{ mr: 1 }}
              >
                Process New File
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
      {/* Step 1: File Upload */}
      {activeStep === 0 && (
        <>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Requirements
              </Typography>
              <Typography variant="body1">
                Upload raw schedule data to begin creating your draft working schedule. Supported formats:
                • CSV files with Transify segment travel time data
                • Excel files with time point schedules
              </Typography>
            </CardContent>
          </Card>

          <FileUpload
            onFileUploaded={handleFileUploaded}
            onError={handleUploadError}
          />
        </>
      )}
      {/* Day Type Selection for CSV files */}
      {activeStep === 1 && fileType === 'csv' && csvData && validation && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <DayTypeIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Day Type Selection</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select the day type for this travel time data. This determines which service pattern to use for schedule generation.
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="day-type-label">Day Type</InputLabel>
              <Select
                labelId="day-type-label"
                id="day-type-select"
                value={selectedDayType}
                label="Day Type"
                onChange={(e) => setSelectedDayType(e.target.value as 'weekday' | 'saturday' | 'sunday')}
              >
                <MenuItem value="weekday">Weekday</MenuItem>
                <MenuItem value="saturday">Saturday</MenuItem>
                <MenuItem value="sunday">Sunday</MenuItem>
              </Select>
              <FormHelperText>
                Choose the day type that matches your travel time data
              </FormHelperText>
            </FormControl>
          </CardContent>
        </Card>
      )}
      {/* Step 2: Process Data */}
      {activeStep === 1 && (extractedData || csvData) && validation && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TimelineIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Time Points</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {fileType === 'csv' && csvData ? csvData.timePoints.length : extractedData?.timePoints.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Detected locations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CheckIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      {fileType === 'csv' ? 'Data Segments' : 'Connections'}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="success.main">
                    {fileType === 'csv' && csvData ? 
                      csvData.validationSummary.totalSegments : 
                      extractedData?.travelTimes.length || 0
                    }
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fileType === 'csv' ? 
                      `Valid: ${csvData?.validationSummary.validSegments || 0}` : 
                      'Travel time segments'
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {validation.isValid ? (
                      <CheckIcon color="success" sx={{ mr: 1 }} />
                    ) : (
                      <ErrorIcon color="error" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="h6">Validation</Typography>
                  </Box>
                  <Chip 
                    label={validation.isValid ? 'PASSED' : 'FAILED'}
                    color={validation.isValid ? 'success' : 'error'}
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {validation.errors.length} errors, {validation.warnings.length} warnings
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Process Draft Working Schedule
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {fileType === 'csv' ? 
                  'Process your draft working schedule data to generate formatted summaries with configurable travel times.' :
                  'Process your draft working schedule to generate formatted summaries for weekday, Saturday, and Sunday service.'
                }
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={isProcessing ? <CircularProgress size={16} /> : <ProcessIcon />}
                  onClick={handleProcessSchedule}
                  disabled={!validation.isValid || isProcessing || (fileType === 'csv' && !selectedDayType)}
                  size="large"
                >
                  {isProcessing ? 'Processing...' : 'Process Draft Schedule'}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  Start New Draft
                </Button>
              </Box>
              
              {!validation.isValid && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Please resolve validation errors before processing.
                </Alert>
              )}
              
              {fileType === 'csv' && !selectedDayType && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Please select a day type for the travel time data above before processing.
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {/* Step 3: View Results */}
      {activeStep === 2 && summarySchedule && calculationResults && (
        <>
          {/* Save Schedule Section */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Save Schedule
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Finalize your draft working schedule and save it to your schedules collection.
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {!savedScheduleId ? (
                  <Button
                    variant="contained"
                    startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
                    onClick={handleSaveSchedule}
                    disabled={isSaving}
                    size="large"
                    color="success"
                  >
                    {isSaving ? 'Saving...' : 'Save Schedule'}
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SavedIcon color="success" />
                    <Typography variant="body2" color="success.main">
                      Schedule saved successfully!
                    </Typography>
                    <Button
                      variant="outlined"
                      href="/view"
                      size="small"
                    >
                      View All Schedules
                    </Button>
                  </Box>
                )}
                
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  Create New Draft
                </Button>
              </Box>
              
              {saveError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Save Error:</strong> {saveError}
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>

          <SummaryDisplay
            summarySchedule={summarySchedule}
            calculationResults={calculationResults}
            onExport={handleExportSchedule}
            showAdvancedStats={true}
            csvData={csvData || undefined}
          />
        </>
      )}
      {/* Error Displays */}
      {uploadError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Upload Error:</strong> {uploadError}
          </Typography>
        </Alert>
      )}
      {processError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Processing Error:</strong> {processError}
          </Typography>
        </Alert>
      )}
      {/* Detailed Information Accordion - Available when data is uploaded */}
      {(extractedData || csvData) && validation && activeStep >= 1 && (
        <Box sx={{ mt: 4 }}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Detailed Information</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Time Points ({fileType === 'csv' && csvData ? csvData.timePoints.length : extractedData?.timePoints.length || 0})
                </Typography>
                <List dense>
                  {fileType === 'csv' && csvData ? (
                    csvData.timePoints.map((name, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Typography variant="body2" color="primary" sx={{ minWidth: 30 }}>
                            {index + 1}
                          </Typography>
                        </ListItemIcon>
                        <ListItemText primary={name} />
                      </ListItem>
                    ))
                  ) : (
                    extractedData?.timePoints.map((tp, index) => (
                      <ListItem key={tp.id}>
                        <ListItemIcon>
                          <Typography variant="body2" color="primary" sx={{ minWidth: 30 }}>
                            {index + 1}
                          </Typography>
                        </ListItemIcon>
                        <ListItemText primary={tp.name} />
                      </ListItem>
                    ))
                  )}
                </List>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Validation Results
                  {validation.errors.length > 0 && (
                    <Chip label={`${validation.errors.length} errors`} color="error" size="small" sx={{ ml: 2 }} />
                  )}
                  {validation.warnings.length > 0 && (
                    <Chip label={`${validation.warnings.length} warnings`} color="warning" size="small" sx={{ ml: 1 }} />
                  )}
                </Typography>

                {validation.errors.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="error" gutterBottom>
                      Errors:
                    </Typography>
                    {validation.errors.map((error, index) => (
                      <Alert key={index} severity="error" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>[{error.code}]</strong> {error.message}
                        </Typography>
                      </Alert>
                    ))}
                  </Box>
                )}

                {validation.warnings.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="warning.main" gutterBottom>
                      Warnings:
                    </Typography>
                    {validation.warnings.map((warning, index) => (
                      <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>[{warning.code}]</strong> {warning.message}
                        </Typography>
                      </Alert>
                    ))}
                  </Box>
                )}

                {validation.errors.length === 0 && validation.warnings.length === 0 && (
                  <Alert severity="success">
                    <Typography variant="body2">
                      No validation issues found. Data quality looks good!
                    </Typography>
                  </Alert>
                )}
              </Box>

              {qualityReport && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Quality Report
                    </Typography>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <pre style={{ 
                        fontSize: '12px', 
                        lineHeight: '1.4', 
                        margin: 0, 
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                      }}>
                        {qualityReport}
                      </pre>
                    </Paper>
                  </Box>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Draft Naming Dialog */}
      <DraftNamingDialog
        open={showDraftNamingDialog}
        onClose={handleDraftNamingCancel}
        onConfirm={handleDraftNamingConfirm}
        fileName={pendingUploadData?.fileName || ''}
      />
    </Box>
  );
};

export default UploadSchedule;
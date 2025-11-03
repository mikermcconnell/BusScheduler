/**
 * Upload Panel Component
 * Converts the UploadSchedule page functionality into a panel-based component
 * Preserves all existing functionality while adapting for the Schedule Command Center workspace
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Timeline as TimelineIcon,
  PlayArrow as ProcessIcon,
  Save as SaveIcon,
  CheckCircleOutline as SavedIcon,
  Today as DayTypeIcon,
  AutoMode as AutoSaveIcon,
  Person as ManualSaveIcon,
} from '@mui/icons-material';

import { FileUpload } from '../FileUpload';
import { ParsedExcelData } from '../../utils/excelParser';
import { ParsedCsvData, CsvParser } from '../../utils/csvParser';
import { ValidationResult } from '../../utils/validator';
import { scheduleService, ScheduleGenerationOptions } from '../../services/scheduleService';
import { SummarySchedule, Trip } from '../../types/schedule';
import { CalculationResults, TimeBand } from '../../utils/calculator';
import { useWorkflowDraft } from '../../hooks/useWorkflowDraft';
import { AUTO_SAVE_CONFIG } from '../../config/autoSave';
import { draftService } from '../../services/draftService';
import DraftNamingDialog, { DraftNamingResult } from '../DraftNamingDialog';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { emit } from '../../services/workspaceEventBus';
import parseQuickAdjustSchedule, { parseQuickAdjustCsv } from '../../utils/quickAdjustImporter';
import quickAdjustStorage from '../../services/quickAdjustStorage';
import { normalizeSummaryScheduleTrips } from '../../utils/blockAssignment';

/**
 * Panel Props Interface
 */
interface PanelProps {
  panelId: string;
  data?: any;
  onClose?: () => void;
  onMinimize?: () => void;
}

/**
 * Upload Panel Component
 */
export const UploadPanel: React.FC<PanelProps> = ({ panelId, data, onClose, onMinimize }) => {
  const { state: workspaceState, setScheduleData, setCurrentDraft } = useWorkspace();
  const { 
    createDraftFromUpload, 
    draft, 
    loading: draftLoading, 
    error: draftError,
    isSaving: isDraftSaving 
  } = useWorkflowDraft();

  // Data states - same as original
  const [extractedData, setExtractedData] = useState<ParsedExcelData | null>(null);
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'csv' | null>(null);
  
  // Processing states - same as original
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [summarySchedule, setSummarySchedule] = useState<SummarySchedule | null>(null);
  const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
  
  // UI states - adapted for panel
  const [selectedDayType, setSelectedDayType] = useState<'weekday' | 'saturday' | 'sunday' | ''>('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Draft naming dialog states - same as original
  const [showDraftNamingDialog, setShowDraftNamingDialog] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
const [pendingUploadData, setPendingUploadData] = useState<{
    data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; tripsByDay?: Record<'weekday' | 'saturday' | 'sunday', Trip[]>; fileType: 'excel' | 'csv' };
    fileName: string;
    validation: ValidationResult;
    report: string;
    file: File;
  } | null>(null);

  const workflowContext = (data?.workflowContext as 'new' | 'edit') ?? 'new';
  const isEditContext = workflowContext === 'edit';
  const panelCopy = useMemo(() => {
    if (isEditContext) {
      return {
        intro: 'Import a published CSV schedule to make quick adjustments before export.',
        uploadTitle: 'Import Schedule CSV',
        uploadSubtitle: 'Upload a schedule export to open it in quick adjust mode.',
        uploadButton: 'Import CSV Schedule'
      };
    }

    return {
      intro: 'Upload CSV or Excel files to create a new draft schedule.',
      uploadTitle: 'Create Draft Working Schedule',
      uploadSubtitle: 'Upload raw schedule data to create a new draft working schedule.',
      uploadButton: 'Upload Schedule File'
    };
  }, [isEditContext]);

  // Default time bands - same as original
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

  // Initialize workflow when component mounts
  useEffect(() => {
    const currentWorkflow = draftService.getCurrentWorkflow();
    if (!currentWorkflow || currentWorkflow.workflowType !== 'schedule-creation') {
      draftService.startWorkflow('schedule-creation');
    }
  }, []);

  // Auto-save functionality using workspace context
  const autoSaveDraft = useCallback(() => {
    if (!workspaceState.scheduleData.autoSaveEnabled || !uploadedFileName || (!extractedData && !csvData)) {
      return;
    }

    const uploadedData = extractedData || csvData;
    if (!uploadedData || !fileType) {
      return;
    }

    // Use workspace context for auto-save state
    setScheduleData({
      isDirty: false,
      lastSaved: new Date().toISOString()
    });

    setLastAutoSave(new Date());
  }, [workspaceState.scheduleData.autoSaveEnabled, uploadedFileName, extractedData, csvData, fileType, setScheduleData]);

  // Auto-save trigger with debouncing
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveDraft();
    }, AUTO_SAVE_CONFIG.NAVIGATION_AUTO_SAVE); // 3s optimal auto-save delay

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [extractedData, csvData, validation, summarySchedule, autoSaveDraft]);

  /**
   * Handle file upload - adapted for panel with event emission
   */
  const handleFileUploaded = useCallback(async (
    data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; fileType: 'excel' | 'csv' }, 
    fileName: string, 
    validation: ValidationResult, 
    report: string,
    file: File
  ) => {
    if (isEditContext && data.fileType !== 'csv') {
      setUploadError('Editing an existing schedule requires uploading a CSV schedule export.');
      return;
    }

    // Store the upload data and show the draft naming dialog
    setPendingUploadData({ data, fileName, validation, report, file });
    setShowDraftNamingDialog(true);
    
    // Clear any previous errors
    setUploadError(null);
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);

    // Emit event for workspace coordination
    emit({
      type: 'user-interaction',
      source: 'upload-panel',
      priority: 1,
      payload: {
        action: 'click',
        element: 'file-upload',
        elementType: 'input',
        metadata: { 
          panelId,
          fileName, 
          fileType: data.fileType,
          validationStatus: validation.isValid ? 'valid' : 'invalid'
        }
      }
    });
  }, [panelId]);

  /**
   * Handle draft naming confirmation - adapted for event emission
   */
  const handleDraftNamingConfirm = useCallback(async (result: DraftNamingResult) => {
    if (!pendingUploadData) return;
    
    const { data, fileName, validation, report, file } = pendingUploadData;
    const isQuickAdjust = result.workflowMode === 'quick-adjust';

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
        draftService.deleteWorkflow(result.existingDraftId);
      }

      // Create or replace the draft with chosen name
      const uploadedData = data.extractedData || data.csvData;
      if (!uploadedData) {
        setUploadError('Unable to process uploaded data. Please try again or upload a different file.');
        return;
      }

      const draftResult = await createDraftFromUpload(result.draftName, data.fileType, uploadedData);
      if (!draftResult.success || !draftResult.draftId) {
        console.error('❌ Failed to create workflow draft:', draftResult.error);
        setUploadError(draftResult.error || 'Failed to create draft');
        return;
      }

      const draftId = draftResult.draftId;
      setCurrentDraftId(draftId);
      setCurrentDraft(draftResult as any); // Update workspace context
      
      draftService.getOrCreateWorkflow(draftId, result.draftName);
      draftService.updateStepStatus(draftId, 'upload', 'completed');
      draftService.completeStep('upload', {
        fileName: result.draftName,
        fileType: data.fileType,
        uploadedAt: new Date().toISOString()
      });

      if (isQuickAdjust) {
        if (data.fileType !== 'csv') {
          setUploadError('Quick adjust is currently supported for CSV schedule exports only.');
          return;
        }

        try {
          const rawContent = await file.text();
          const rows = parseQuickAdjustCsv(rawContent).filter(row => row.some(cell => cell.trim() !== ''));
          const parseResult = parseQuickAdjustSchedule(rows, { routeId: draftId });
          const normalizedSummaryData = normalizeSummaryScheduleTrips(parseResult.summarySchedule);
          parseResult.summarySchedule = normalizedSummaryData.summary;

          quickAdjustStorage.save(draftId, {
            rows,
            fileName,
            savedAt: new Date().toISOString()
          });

          await draftService.applyQuickAdjustImport(draftId, parseResult, {
            fileName,
            validation,
            warnings: parseResult.warnings
          });

          const primaryDay: 'weekday' | 'saturday' | 'sunday' =
            parseResult.trips.weekday.length > 0
              ? 'weekday'
              : parseResult.trips.saturday.length > 0
                ? 'saturday'
                : 'sunday';

          setSummarySchedule(parseResult.summarySchedule);
          setCalculationResults(null);
          setSelectedDayType(primaryDay);

          emit({
            type: 'schedule-data',
            source: 'upload-panel',
            priority: 1,
            payload: {
              dataType: 'summary-schedule',
              action: 'create',
              data: {
                draftId,
                draftName: result.draftName,
                summarySchedule: parseResult.summarySchedule,
                timePoints: parseResult.timePoints,
                trips: parseResult.trips,
                tripsByDay: normalizedSummaryData.tripsByDay,
                warnings: parseResult.warnings,
                fromQuickAdjust: true,
                rawCsvRows: rows
              }
            }
          });

          emit({
            type: 'workflow-progress',
            source: 'upload-panel',
            priority: 1,
            payload: {
              currentStep: 'summary',
              progress: 80,
              canProceed: true
            }
          });

          return;
        } catch (error) {
          console.error('Quick adjust import failed:', error);
          const message = error instanceof Error ? error.message : 'Failed to import schedule for quick adjustment';
          setUploadError(message);
          return;
        }
      }

      console.log('✅ Created workflow draft with custom name:', result.draftName, draftId);

      emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: {
          dataType: 'upload',
          action: 'create',
          data: {
            draftId,
            draftName: result.draftName,
            fileName: result.draftName,
            fileType: data.fileType,
            scheduleData: uploadedData,
            validationResults: validation,
            fromUpload: true
          }
        }
      });

      if (data.fileType === 'csv') {
        emit({
          type: 'workflow-progress',
          source: 'upload-panel',
          priority: 1,
          payload: {
            currentStep: 'timepoints',
            progress: 25,
            canProceed: true,
          }
        });
      }
      
    } catch (error) {
      console.error('Error handling draft creation:', error);
      setUploadError('Failed to create draft schedule');
    } finally {
      setShowDraftNamingDialog(false);
      setPendingUploadData(null);
    }
  }, [pendingUploadData, createDraftFromUpload, panelId, setCurrentDraft]);

  /**
   * Handle processing schedule - adapted for event emission
   */
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
      const normalized = normalizeSummaryScheduleTrips(summary);

      const calculations = scheduleService.getLastCalculationResults();
      
      if (!calculations) {
        throw new Error('Failed to retrieve calculation results');
      }

      setSummarySchedule(normalized.summary);
      setCalculationResults(calculations);

      // Emit processing complete event
      emit({
        type: 'schedule-data',
        source: 'upload-panel',
        priority: 1,
        payload: {
          dataType: 'upload',
          action: 'update',
          data: {
            summarySchedule: normalized.summary,
            calculationResults: calculations,
            draftId: currentDraftId,
            tripDetails: normalized.summary.tripDetails,
            tripsByDay: normalized.tripsByDay
          }
        }
      });

    } catch (error) {
      setProcessError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [extractedData, csvData, validation, uploadedFileName, defaultTimeBands, fileType, currentDraftId]);

  // Handle upload error
  const handleUploadError = useCallback((error: string) => {
    setUploadError(error);
    setExtractedData(null);
    setCsvData(null);
    setValidation(null);
    setUploadedFileName(null);
    setQualityReport(null);
    setFileType(null);
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
  }, []);

  // Handle draft naming dialog cancellation
  const handleDraftNamingCancel = useCallback(() => {
    setShowCancelConfirmation(true);
  }, []);

  // Handle confirmation to discard the upload
  const handleConfirmDiscard = useCallback(() => {
    setShowCancelConfirmation(false);
    setShowDraftNamingDialog(false);
    setPendingUploadData(null);
  }, []);

  // Handle cancellation of the discard
  const handleCancelDiscard = useCallback(() => {
    setShowCancelConfirmation(false);
  }, []);

  /**
   * Render the Upload Panel UI - adapted for constrained panel width
   */
  return (
    <Box sx={{ 
      height: '100%', 
      overflow: 'auto', 
      display: 'flex', 
      flexDirection: 'column',
      p: 2,
      gap: 2
    }}>
      {/* Panel Header */}
      <Box>
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Schedule Data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {panelCopy.intro}
        </Typography>
      </Box>

      {/* Auto-save Status - compact for panel */}
      {workspaceState.scheduleData.autoSaveEnabled && lastAutoSave && (
        <Alert severity="info" sx={{ py: 1 }}>
          <Typography variant="caption">
            Auto-saved: {lastAutoSave.toLocaleTimeString()}
          </Typography>
        </Alert>
      )}

      {/* File Upload Component - adapted for panel width */}
      <Card elevation={1}>
        <CardContent sx={{ p: 2 }}>
          <FileUpload
            onFileUploaded={handleFileUploaded}
            onError={handleUploadError}
            title={panelCopy.uploadTitle}
            subtitle={panelCopy.uploadSubtitle}
            buttonText={panelCopy.uploadButton}
          />
        </CardContent>
      </Card>

      {/* Day Type Selection for CSV files - compact layout */}
      {fileType === 'csv' && csvData && validation && (
        <Card elevation={1}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DayTypeIcon color="primary" sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle2">Day Type</Typography>
            </Box>
            
            <FormControl fullWidth size="small">
              <InputLabel>Service Day</InputLabel>
              <Select
                value={selectedDayType}
                label="Service Day"
                onChange={(e) => setSelectedDayType(e.target.value as 'weekday' | 'saturday' | 'sunday')}
              >
                <MenuItem value="weekday">Weekday</MenuItem>
                <MenuItem value="saturday">Saturday</MenuItem>
                <MenuItem value="sunday">Sunday</MenuItem>
              </Select>
              <FormHelperText>
                Choose the service pattern for this data
              </FormHelperText>
            </FormControl>
          </CardContent>
        </Card>
      )}

      {/* Data Summary - compact cards for panel */}
      {(extractedData || csvData) && validation && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 120px', minWidth: 120 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimelineIcon sx={{ mr: 0.5, fontSize: 16 }} color="primary" />
                <Typography variant="caption">Points</Typography>
              </Box>
              <Typography variant="h6" color="primary">
                {fileType === 'csv' && csvData ? csvData.timePoints.length : extractedData?.timePoints.length || 0}
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: '1 1 120px', minWidth: 120 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckIcon sx={{ mr: 0.5, fontSize: 16 }} color="success" />
                <Typography variant="caption">Segments</Typography>
              </Box>
              <Typography variant="h6" color="success.main">
                {fileType === 'csv' && csvData ? 
                  csvData.validationSummary.totalSegments : 
                  extractedData?.travelTimes.length || 0
                }
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: '1 1 120px', minWidth: 120 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {validation.isValid ? (
                  <CheckIcon sx={{ mr: 0.5, fontSize: 16 }} color="success" />
                ) : (
                  <ErrorIcon sx={{ mr: 0.5, fontSize: 16 }} color="error" />
                )}
                <Typography variant="caption">Status</Typography>
              </Box>
              <Chip 
                label={validation.isValid ? 'VALID' : 'INVALID'}
                color={validation.isValid ? 'success' : 'error'}
                size="small"
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Process Button - compact for panel */}
      {(extractedData || csvData) && validation && (
        <Card elevation={1}>
          <CardContent sx={{ p: 2 }}>
            <Button
              variant="contained"
              startIcon={isProcessing ? <CircularProgress size={16} /> : <ProcessIcon />}
              onClick={handleProcessSchedule}
              disabled={!validation.isValid || isProcessing || (fileType === 'csv' && !selectedDayType)}
              fullWidth
              size="medium"
            >
              {isProcessing ? 'Processing...' : 'Process Schedule'}
            </Button>
            
            {!validation.isValid && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="caption">
                  Resolve validation errors before processing
                </Typography>
              </Alert>
            )}
            
            {fileType === 'csv' && !selectedDayType && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="caption">
                  Select a day type above before processing
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Displays - compact alerts */}
      {uploadError && (
        <Alert severity="error" sx={{ py: 1 }}>
          <Typography variant="caption">
            <strong>Upload Error:</strong> {uploadError}
          </Typography>
        </Alert>
      )}

      {processError && (
        <Alert severity="error" sx={{ py: 1 }}>
          <Typography variant="caption">
            <strong>Processing Error:</strong> {processError}
          </Typography>
        </Alert>
      )}

      {/* Success Message */}
      {summarySchedule && (
        <Alert severity="success" sx={{ py: 1 }}>
          <Typography variant="caption">
            Schedule processed successfully! Data is ready for configuration.
          </Typography>
        </Alert>
      )}

      {/* Detailed Information Accordion - collapsed by default for panel space */}
      {(extractedData || csvData) && validation && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Detailed Information</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Time Points ({fileType === 'csv' && csvData ? csvData.timePoints.length : extractedData?.timePoints.length || 0})
              </Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {fileType === 'csv' && csvData ? (
                  csvData.timePoints.map((name, index) => (
                    <ListItem key={index} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Typography variant="caption" color="primary">
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText 
                        primary={<Typography variant="body2">{name}</Typography>} 
                      />
                    </ListItem>
                  ))
                ) : (
                  extractedData?.timePoints.map((tp, index) => (
                    <ListItem key={tp.id} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Typography variant="caption" color="primary">
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText 
                        primary={<Typography variant="body2">{tp.name}</Typography>} 
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Validation Results
                {validation.errors.length > 0 && (
                  <Chip label={`${validation.errors.length} errors`} color="error" size="small" sx={{ ml: 1 }} />
                )}
                {validation.warnings.length > 0 && (
                  <Chip label={`${validation.warnings.length} warnings`} color="warning" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>

              {validation.errors.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  {validation.errors.slice(0, 3).map((error, index) => (
                    <Alert key={index} severity="error" sx={{ mb: 0.5, py: 0.5 }}>
                      <Typography variant="caption">
                        <strong>[{error.code}]</strong> {error.message}
                      </Typography>
                    </Alert>
                  ))}
                  {validation.errors.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {validation.errors.length - 3} more errors
                    </Typography>
                  )}
                </Box>
              )}

              {validation.warnings.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  {validation.warnings.slice(0, 2).map((warning, index) => (
                    <Alert key={index} severity="warning" sx={{ mb: 0.5, py: 0.5 }}>
                      <Typography variant="caption">
                        <strong>[{warning.code}]</strong> {warning.message}
                      </Typography>
                    </Alert>
                  ))}
                  {validation.warnings.length > 2 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {validation.warnings.length - 2} more warnings
                    </Typography>
                  )}
                </Box>
              )}

              {validation.errors.length === 0 && validation.warnings.length === 0 && (
                <Alert severity="success" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    No validation issues found
                  </Typography>
                </Alert>
              )}
            </Box>

            {qualityReport && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Quality Report
                  </Typography>
                  <Paper sx={{ p: 1, backgroundColor: 'grey.50' }}>
                    <pre style={{ 
                      fontSize: '11px', 
                      lineHeight: '1.3', 
                      margin: 0, 
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      maxHeight: 150,
                      overflow: 'auto'
                    }}>
                      {qualityReport}
                    </pre>
                  </Paper>
                </Box>
              </>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Draft Naming Dialog */}
      <DraftNamingDialog
        open={showDraftNamingDialog}
        onClose={handleDraftNamingCancel}
        onConfirm={handleDraftNamingConfirm}
        fileName={pendingUploadData?.fileName || ''}
        suggestedName={pendingUploadData?.fileName || ''}
        uploadedData={pendingUploadData?.data.extractedData || pendingUploadData?.data.csvData}
        fileType={pendingUploadData?.data.fileType || 'csv'}
        workflowContext={workflowContext}
      />

      {/* Confirmation Dialog for Discarding Upload */}
      <Dialog
        open={showCancelConfirmation}
        onClose={handleCancelDiscard}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            Discard Upload?
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to discard this upload? 
            The file "{pendingUploadData?.fileName || 'your file'}" has been processed and validated successfully. 
            If you discard it now, you'll need to upload it again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDiscard} color="primary">
            Keep Draft
          </Button>
          <Button onClick={handleConfirmDiscard} color="error" variant="contained">
            Discard Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UploadPanel;

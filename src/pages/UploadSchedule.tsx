import React, { useState, useCallback } from 'react';
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
} from '@mui/icons-material';
import { FileUpload } from '../components/FileUpload';
import { ParsedExcelData } from '../utils/excelParser';
import { ValidationResult } from '../utils/validator';
import { scheduleService, ScheduleGenerationOptions } from '../services/scheduleService';
import { SummarySchedule } from '../types/schedule';
import { CalculationResults, TimeBand } from '../utils/calculator';
import SummaryDisplay from '../components/SummaryDisplay';

const UploadSchedule: React.FC = () => {
  const [extractedData, setExtractedData] = useState<ParsedExcelData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<string | null>(null);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [summarySchedule, setSummarySchedule] = useState<SummarySchedule | null>(null);
  const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
  
  // UI states
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Upload File', 'Process Data', 'View Results'];

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

  const requirements = [
    'Excel file format (.xlsx or .xls)',
    'First row should contain time point names',
    'Each subsequent row represents a trip schedule',
    'Time format should be HH:MM (24-hour format)',
    'Empty cells are allowed for non-stop time points',
  ];

  const handleFileUploaded = useCallback((extractedData: ParsedExcelData, fileName: string, validation: ValidationResult, report: string) => {
    setExtractedData(extractedData);
    setValidation(validation);
    setUploadedFileName(fileName);
    setQualityReport(report);
    setUploadError(null);
    setActiveStep(1); // Move to processing step
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
  }, []);

  const handleUploadError = useCallback((error: string) => {
    setUploadError(error);
    setExtractedData(null);
    setValidation(null);
    setUploadedFileName(null);
    setQualityReport(null);
    setActiveStep(0); // Reset to upload step
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
  }, []);

  const handleProcessSchedule = useCallback(async () => {
    if (!extractedData || !validation?.isValid) return;

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

      const summary = await scheduleService.generateSummarySchedule(
        extractedData.timePoints,
        extractedData.travelTimes,
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
  }, [extractedData, validation, uploadedFileName, defaultTimeBands]);

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

  const handleReset = useCallback(() => {
    setExtractedData(null);
    setValidation(null);
    setUploadedFileName(null);
    setUploadError(null);
    setQualityReport(null);
    setIsProcessing(false);
    setProcessError(null);
    setSummarySchedule(null);
    setCalculationResults(null);
    setActiveStep(0);
  }, []);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Upload Schedule
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Import your bus schedule data from Excel files and generate formatted summaries
      </Typography>

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
              <List dense>
                {requirements.map((requirement, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <InfoIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={requirement} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          <FileUpload
            onFileUploaded={handleFileUploaded}
            onError={handleUploadError}
          />
        </>
      )}

      {/* Step 2: Process Data */}
      {activeStep === 1 && extractedData && validation && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TimelineIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Time Points</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {extractedData.timePoints.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Detected locations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CheckIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="h6">Connections</Typography>
                  </Box>
                  <Typography variant="h4" color="success.main">
                    {extractedData.travelTimes.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Travel time segments
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
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
                Generate Schedule Summary
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Process the uploaded data to generate formatted schedule summaries for weekday, Saturday, and Sunday service.
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={isProcessing ? <CircularProgress size={16} /> : <ProcessIcon />}
                  onClick={handleProcessSchedule}
                  disabled={!validation.isValid || isProcessing}
                  size="large"
                >
                  {isProcessing ? 'Processing...' : 'Generate Schedule'}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  Start Over
                </Button>
              </Box>
              
              {!validation.isValid && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Please resolve validation errors before processing.
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: View Results */}
      {activeStep === 2 && summarySchedule && calculationResults && (
        <SummaryDisplay
          summarySchedule={summarySchedule}
          calculationResults={calculationResults}
          onExport={handleExportSchedule}
          showAdvancedStats={true}
        />
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
      {extractedData && validation && activeStep >= 1 && (
        <Box sx={{ mt: 4 }}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Detailed Information</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Time Points ({extractedData.timePoints.length})
                </Typography>
                <List dense>
                  {extractedData.timePoints.map((tp, index) => (
                    <ListItem key={tp.id}>
                      <ListItemIcon>
                        <Typography variant="body2" color="primary" sx={{ minWidth: 30 }}>
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText primary={tp.name} />
                    </ListItem>
                  ))}
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
    </Box>
  );
};

export default UploadSchedule;
/**
 * Export Panel Component
 * Unified export panel for the Schedule Command Center workspace
 * Consolidates all export functionality with professional UI and comprehensive features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  ButtonGroup,
  Chip,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Slider,
  FormHelperText
} from '@mui/material';

import {
  GetApp as ExportIcon,
  Preview as PreviewIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Archive as BatchIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CloudDownload as DownloadIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as ProcessIcon,
  Pause as PauseIcon,
  Schedule as ScheduleIcon,
  Assessment as AnalysisIcon,
  Business as ManagementIcon,
  Build as TechnicalIcon,
  Public as PublicIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  FileCopy as DuplicateIcon
} from '@mui/icons-material';

import { PanelProps } from './index';
import { subscribe, unsubscribe, emit } from '../../services/workspaceEventBus';
import { exportService } from '../../services/exportService';
import {
  ExportOptions,
  ExportTemplate,
  ExportFormat,
  ExportScope,
  ExportDataBundle,
  ExportResult,
  ExportPreview,
  ExportProgress,
  BatchExportConfig,
  BatchExportResult
} from '../../types/export';
import { sanitizeText } from '../../utils/inputSanitizer';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      style={{ display: value === index ? 'block' : 'none', paddingTop: 16 }}
    >
      {value === index && children}
    </div>
  );
}

interface ExportPanelProps extends PanelProps {
  // Panel-specific props can be added here
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  panelId,
  data,
  onClose,
  onMinimize
}) => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope>({
    includeRawData: false,
    includeAnalysis: true,
    includeConfiguration: true,
    includeGeneratedSchedule: true,
    includeMetadata: true
  });
  
  const [exportData, setExportData] = useState<ExportDataBundle>({
    tripsByDay: {},
    context: {
      exportedAt: new Date(),
      exportVersion: '1.0.0',
      sourceApplication: 'Scheduler2'
    }
  });

  const [availableTemplates, setAvailableTemplates] = useState<ExportTemplate[]>([]);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportResult[]>([]);
  
  const [showPreview, setShowPreview] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('24h');
  const [qualityLevel, setQualityLevel] = useState<'basic' | 'standard' | 'detailed' | 'comprehensive'>('standard');
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [batchExports, setBatchExports] = useState<ExportOptions[]>([]);

  // Refs
  const subscriptionRef = useRef<string[]>([]);
  const exportAbortController = useRef<AbortController | null>(null);

  // Initialize component
  useEffect(() => {
    initializePanel();
    setupEventSubscriptions();

    return () => {
      cleanup();
    };
  }, []);

  // Update templates when format changes
  useEffect(() => {
    const templates = exportService.getTemplatesByFormat(selectedFormat);
    setAvailableTemplates(templates);
    
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
      setExportScope(templates[0].defaultScope);
    } else if (selectedTemplate && !templates.find(t => t.id === selectedTemplate.id)) {
      setSelectedTemplate(templates[0] || null);
      setExportScope(templates[0]?.defaultScope || exportScope);
    }
  }, [selectedFormat]);

  // Initialize panel
  const initializePanel = useCallback(() => {
    // Load templates
    const allTemplates = exportService.getTemplates();
    setAvailableTemplates(allTemplates.filter(t => t.format === selectedFormat));
    
    // Set default template
    const defaultTemplate = allTemplates.find(t => t.format === selectedFormat);
    if (defaultTemplate) {
      setSelectedTemplate(defaultTemplate);
      setExportScope(defaultTemplate.defaultScope);
    }

    // Emit panel ready event
    emit({
      type: 'panel-state',
      source: panelId,
      priority: 1,
      payload: {
        panelId,
        action: 'open'
      }
    });
  }, [panelId, selectedFormat]);

  // Setup event subscriptions
  const setupEventSubscriptions = useCallback(() => {
    // Subscribe to data updates from other panels
    const dataSubscription = subscribe(
      ['schedule-data', 'workflow-progress'],
      handleDataUpdate,
      { priority: 1 }
    );

    subscriptionRef.current.push(dataSubscription);
  }, []);

  // Handle data updates from other panels
  const handleDataUpdate = useCallback((event: any) => {
    switch (event.type) {
      case 'schedule-data':
        updateExportData(event.payload);
        break;
      case 'workflow-progress':
        updateWorkflowData(event.payload);
        break;
    }
  }, []);

  // Update export data from events
  const updateExportData = useCallback((payload: any) => {
    const { dataType, data } = payload;

    setExportData(prevData => {
      const newData = { ...prevData };
      const ensureTripsByDay = () => {
        if (!newData.tripsByDay) {
          newData.tripsByDay = {};
        }
      };

      switch (dataType) {
        case 'uploaded-schedule':
          newData.rawData = {
            fileName: data.fileName || 'unknown',
            fileType: data.fileType || 'csv',
            data: data.uploadedData,
            uploadedAt: new Date()
          };
          break;
        case 'timepoints-analysis':
          newData.timepointsAnalysis = data;
          break;
        case 'block-configuration':
          newData.blockConfiguration = data;
          break;
        case 'summary-schedule':
          const incomingSchedule = data?.summarySchedule || data;
          newData.summarySchedule = incomingSchedule;

          const incomingTrips =
            data?.trips ||
            incomingSchedule?.tripDetails ||
            newData.summarySchedule?.tripDetails;

          if (incomingTrips) {
            ensureTripsByDay();
            newData.tripsByDay = {
              ...newData.tripsByDay,
              weekday: incomingTrips.weekday || newData.tripsByDay?.weekday,
              saturday: incomingTrips.saturday || newData.tripsByDay?.saturday,
              sunday: incomingTrips.sunday || newData.tripsByDay?.sunday
            };
          }

          if (data?.tripsByDay) {
            ensureTripsByDay();
            newData.tripsByDay = {
              ...newData.tripsByDay,
              weekday: data.tripsByDay.weekday || newData.tripsByDay?.weekday,
              saturday: data.tripsByDay.saturday || newData.tripsByDay?.saturday,
              sunday: data.tripsByDay.sunday || newData.tripsByDay?.sunday
            };
          }
          break;
        case 'metadata':
          newData.metadata = data;
          break;
      }

      return newData;
    });
  }, []);

  // Update workflow data
  const updateWorkflowData = useCallback((payload: any) => {
    // Handle workflow progress updates if needed
    console.log('Workflow update:', payload);
  }, []);

  // Handle format change
  const handleFormatChange = (format: ExportFormat) => {
    setSelectedFormat(format);
    setExportPreview(null); // Clear preview when format changes
    setExportError(null);
  };

  // Handle template change
  const handleTemplateChange = (template: ExportTemplate) => {
    setSelectedTemplate(template);
    setExportScope(template.defaultScope);
    setExportPreview(null);
    setExportError(null);
  };

  // Handle scope change
  const handleScopeChange = (field: keyof ExportScope, value: boolean | string[]) => {
    setExportScope(prev => ({
      ...prev,
      [field]: value
    }));
    setExportPreview(null); // Clear preview when scope changes
  };

  // Generate export preview
  const generatePreview = useCallback(async () => {
    if (!selectedTemplate) return;

    try {
      const options: ExportOptions = {
        format: selectedFormat,
        template: selectedTemplate,
        scope: exportScope,
        filename: customFilename,
        timeFormat,
        includeHeaders: true,
        qualityLevel
      };

      const preview = await exportService.generatePreview(options, exportData);
      setExportPreview(preview);
      setShowPreview(true);
      setExportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate preview';
      setExportError(sanitizeText(message));
    }
  }, [selectedTemplate, selectedFormat, exportScope, customFilename, timeFormat, qualityLevel, exportData]);

  // Execute single export
  const executeExport = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsExporting(true);
    setExportError(null);
    setExportProgress(null);

    try {
      exportAbortController.current = new AbortController();

      const options: ExportOptions = {
        format: selectedFormat,
        template: selectedTemplate,
        scope: exportScope,
        filename: customFilename,
        timeFormat,
        includeHeaders: true,
        qualityLevel
      };

      const result = await exportService.executeExport(
        options,
        exportData,
        (progress) => setExportProgress(progress)
      );

      if (result.success) {
        // Download the file
        exportService.downloadExport(result);
        
        // Add to history
        setExportHistory(prev => [result, ...prev].slice(0, 10));
        
        // Emit success event
        emit({
          type: 'panel-state',
          source: panelId,
          priority: 1,
          payload: {
            panelId,
            action: 'close'
          }
        });
      } else {
        setExportError(result.error || 'Export failed');
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      setExportError(sanitizeText(message));
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      exportAbortController.current = null;
    }
  }, [selectedTemplate, selectedFormat, exportScope, customFilename, timeFormat, qualityLevel, exportData, panelId]);

  // Execute batch export
  const executeBatchExport = useCallback(async () => {
    if (batchExports.length === 0) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const config: BatchExportConfig = {
        exports: batchExports,
        createArchive: true,
        parallel: false,
        onProgress: (completed, total, current) => {
          setExportProgress({
            stage: 'processing',
            progress: (completed / total) * 100,
            currentOperation: `Exporting ${current} (${completed}/${total})`,
            startedAt: new Date(),
            completedRecords: completed,
            totalRecords: total
          });
        }
      };

      const result = await exportService.executeBatchExport(config, exportData);

      if (result.success && result.successCount > 0) {
        exportService.downloadBatchExport(result);
        
        // Add successful exports to history
        setExportHistory(prev => [
          ...result.results.filter(r => r.success),
          ...prev
        ].slice(0, 10));

        setShowBatchDialog(false);
      } else {
        setExportError(result.error || `${result.failureCount} exports failed`);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch export failed';
      setExportError(sanitizeText(message));
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [batchExports, exportData]);

  // Add export to batch
  const addToBatch = useCallback(() => {
    if (!selectedTemplate) return;

    const options: ExportOptions = {
      format: selectedFormat,
      template: selectedTemplate,
      scope: exportScope,
      filename: customFilename || `${selectedTemplate.name}_batch`,
      timeFormat,
      includeHeaders: true,
      qualityLevel
    };

    setBatchExports(prev => [...prev, options]);
  }, [selectedTemplate, selectedFormat, exportScope, customFilename, timeFormat, qualityLevel]);

  // Remove from batch
  const removeFromBatch = useCallback((index: number) => {
    setBatchExports(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    subscriptionRef.current.forEach(id => unsubscribe(id));
    subscriptionRef.current = [];

    if (exportAbortController.current) {
      exportAbortController.current.abort();
    }
  }, []);

  // Get format icon
  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv': return '📊';
      case 'excel': return '📈';
      case 'json': return '📄';
      case 'pdf': return '📕';
      default: return '📁';
    }
  };

  // Get template category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'operational': return <ScheduleIcon />;
      case 'analytical': return <AnalysisIcon />;
      case 'management': return <ManagementIcon />;
      case 'technical': return <TechnicalIcon />;
      case 'public': return <PublicIcon />;
      default: return <ExportIcon />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        maxHeight: '100%',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ExportIcon />
            Export Panel
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Export History">
              <IconButton size="small" onClick={() => setActiveTab(3)}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Advanced Settings">
              <IconButton 
                size="small" 
                color={showAdvancedSettings ? 'primary' : 'default'}
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Export Progress */}
        {exportProgress && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
            icon={isExporting ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {exportProgress.currentOperation}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={exportProgress.progress} 
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(exportProgress.progress)}% complete
                {exportProgress.completedRecords > 0 && (
                  ` • ${exportProgress.completedRecords}/${exportProgress.totalRecords} records`
                )}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Error Display */}
        {exportError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
            <Typography variant="body2">{exportError}</Typography>
          </Alert>
        )}

        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Export" />
            <Tab label="Batch" />
            <Tab label="Preview" />
            <Tab label="History" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {/* Single Export Tab */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              {/* Format Selection */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Export Format
                  </Typography>
                  <ButtonGroup fullWidth variant="outlined" sx={{ mb: 2 }}>
                    {(['csv', 'excel', 'json'] as ExportFormat[]).map(format => (
                      <Button
                        key={format}
                        variant={selectedFormat === format ? 'contained' : 'outlined'}
                        onClick={() => handleFormatChange(format)}
                        startIcon={<span style={{ fontSize: '1.2em' }}>{getFormatIcon(format)}</span>}
                      >
                        {format.toUpperCase()}
                      </Button>
                    ))}
                  </ButtonGroup>
                </Paper>
              </Grid>

              {/* Template Selection */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Export Template
                  </Typography>
                  <FormControl fullWidth>
                    <Select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const template = availableTemplates.find(t => t.id === e.target.value);
                        if (template) handleTemplateChange(template);
                      }}
                      displayEmpty
                    >
                      {availableTemplates.map(template => (
                        <MenuItem key={template.id} value={template.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getCategoryIcon(template.category)}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {template.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {template.description}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  {selectedTemplate && (
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        size="small" 
                        label={selectedTemplate.category}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Export Scope */}
              <Grid size={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Data to Include
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportScope.includeRawData}
                            onChange={(e) => handleScopeChange('includeRawData', e.target.checked)}
                          />
                        }
                        label="Raw Upload Data"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportScope.includeAnalysis}
                            onChange={(e) => handleScopeChange('includeAnalysis', e.target.checked)}
                          />
                        }
                        label="Timepoints Analysis"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportScope.includeConfiguration}
                            onChange={(e) => handleScopeChange('includeConfiguration', e.target.checked)}
                          />
                        }
                        label="Block Configuration"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportScope.includeGeneratedSchedule}
                            onChange={(e) => handleScopeChange('includeGeneratedSchedule', e.target.checked)}
                          />
                        }
                        label="Generated Schedule"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportScope.includeMetadata}
                            onChange={(e) => handleScopeChange('includeMetadata', e.target.checked)}
                          />
                        }
                        label="Metadata"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Advanced Settings */}
              {showAdvancedSettings && (
                <Grid size={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1">Advanced Settings</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            fullWidth
                            label="Custom Filename"
                            value={customFilename}
                            onChange={(e) => setCustomFilename(sanitizeText(e.target.value))}
                            placeholder="Leave empty for auto-generated name"
                            helperText="Do not include file extension"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth>
                            <InputLabel>Time Format</InputLabel>
                            <Select
                              value={timeFormat}
                              label="Time Format"
                              onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
                            >
                              <MenuItem value="24h">24-Hour (14:30)</MenuItem>
                              <MenuItem value="12h">12-Hour (2:30 PM)</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth>
                            <InputLabel>Quality Level</InputLabel>
                            <Select
                              value={qualityLevel}
                              label="Quality Level"
                              onChange={(e) => setQualityLevel(e.target.value as any)}
                            >
                              <MenuItem value="basic">Basic</MenuItem>
                              <MenuItem value="standard">Standard</MenuItem>
                              <MenuItem value="detailed">Detailed</MenuItem>
                              <MenuItem value="comprehensive">Comprehensive</MenuItem>
                            </Select>
                            <FormHelperText>
                              Higher quality includes more detailed data
                            </FormHelperText>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid size={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<PreviewIcon />}
                    onClick={generatePreview}
                    disabled={!selectedTemplate || isExporting}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<BatchIcon />}
                    onClick={addToBatch}
                    disabled={!selectedTemplate || isExporting}
                  >
                    Add to Batch
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
                    onClick={executeExport}
                    disabled={!selectedTemplate || isExporting}
                  >
                    {isExporting ? 'Exporting...' : 'Export Now'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Batch Export Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Batch Export Queue ({batchExports.length})
                </Typography>
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={() => setBatchExports([])}
                    disabled={batchExports.length === 0}
                    sx={{ mr: 1 }}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={isExporting ? <CircularProgress size={16} /> : <BatchIcon />}
                    onClick={executeBatchExport}
                    disabled={batchExports.length === 0 || isExporting}
                  >
                    {isExporting ? 'Processing...' : `Export All (${batchExports.length})`}
                  </Button>
                </Box>
              </Box>

              {batchExports.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <BatchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" color="text.secondary">
                    No exports in queue
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Use the Export tab to add exports to the batch queue
                  </Typography>
                </Paper>
              ) : (
                <List>
                  {batchExports.map((exportOption, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        {getCategoryIcon(exportOption.template.category)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {exportOption.template.name}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={exportOption.format.toUpperCase()}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {exportOption.filename || 'Auto-generated filename'} •{' '}
                            {exportOption.timeFormat === '12h' ? '12-hour' : '24-hour'} •{' '}
                            {exportOption.qualityLevel} quality
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => removeFromBatch(index)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </TabPanel>

          {/* Preview Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box>
              {exportPreview ? (
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Export Preview</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip 
                        label={exportPreview.format.toUpperCase()}
                        color="primary"
                        size="small"
                      />
                      <Typography variant="body2" color="text.secondary">
                        Est. size: {formatFileSize(exportPreview.estimatedSize)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {exportPreview.recordCount} records • Generated {exportPreview.previewedAt.toLocaleTimeString()}
                      {exportPreview.isTruncated && ' • Preview truncated'}
                    </Typography>
                  </Box>

                  {exportPreview.headers && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Columns ({exportPreview.headers.length}):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {exportPreview.headers.slice(0, 10).map((header, index) => (
                          <Chip key={index} label={header} size="small" variant="outlined" />
                        ))}
                        {exportPreview.headers.length > 10 && (
                          <Chip label={`+${exportPreview.headers.length - 10} more`} size="small" />
                        )}
                      </Box>
                    </Box>
                  )}

                  {exportPreview.fullContent ? (
                    <Paper sx={{ p: 1, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                      <pre style={{ 
                        fontSize: '0.75rem', 
                        margin: 0, 
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                      }}>
                        {exportPreview.fullContent}
                      </pre>
                    </Paper>
                  ) : exportPreview.sampleData && (
                    <Box sx={{ overflow: 'auto', maxHeight: 400 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {exportPreview.headers?.map((header, index) => (
                              <th key={index} style={{ 
                                border: '1px solid #e0e0e0', 
                                padding: '8px',
                                background: '#f5f5f5',
                                textAlign: 'left',
                                fontSize: '0.875rem'
                              }}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {exportPreview.sampleData.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} style={{ 
                                  border: '1px solid #e0e0e0', 
                                  padding: '8px',
                                  fontSize: '0.875rem'
                                }}>
                                  {String(cell || '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  )}
                </Paper>
              ) : (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <PreviewIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" color="text.secondary">
                    No preview available
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Generate a preview to see how your export will look
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<PreviewIcon />}
                    onClick={generatePreview}
                    disabled={!selectedTemplate}
                  >
                    Generate Preview
                  </Button>
                </Paper>
              )}
            </Box>
          </TabPanel>

          {/* History Tab */}
          <TabPanel value={activeTab} index={3}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Export History ({exportHistory.length})
              </Typography>

              {exportHistory.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" color="text.secondary">
                    No export history
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your completed exports will appear here
                  </Typography>
                </Paper>
              ) : (
                <List>
                  {exportHistory.map((result, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        {result.success ? (
                          <CheckIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {result.filename}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={result.format.toUpperCase()}
                              variant="outlined"
                            />
                            {result.fileSize && (
                              <Typography variant="caption" color="text.secondary">
                                {formatFileSize(result.fileSize)}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {result.exportedAt.toLocaleString()} •{' '}
                            Processing: {result.processingTime}ms
                            {result.error && ` • Error: ${result.error}`}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        {result.success && result.blob && (
                          <IconButton
                            edge="end"
                            onClick={() => exportService.downloadExport(result)}
                            size="small"
                          >
                            <DownloadIcon />
                          </IconButton>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </TabPanel>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ExportPanel;

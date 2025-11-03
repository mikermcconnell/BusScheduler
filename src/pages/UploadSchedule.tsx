import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Container,
  Alert,
  Button
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { FileUpload } from '../components/FileUpload';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { ValidationResult } from '../utils/validator';
import DraftNamingDialog, { DraftNamingResult } from '../components/DraftNamingDialog';
import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import { draftService } from '../services/draftService';
import parseQuickAdjustSchedule, { parseQuickAdjustCsv } from '../utils/quickAdjustImporter';
import quickAdjustStorage from '../services/quickAdjustStorage';

interface PendingUploadData {
  data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; fileType: 'excel' | 'csv' };
  fileName: string;
  validation: ValidationResult;
  report: string;
  file: File;
}

export interface UploadScheduleProps {
  mode: 'new' | 'edit';
}

const UploadSchedule: React.FC<UploadScheduleProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { createDraftFromUpload } = useWorkflowDraft();
  const isEditMode = mode === 'edit';

  const pageCopy = useMemo(() => {
    if (isEditMode) {
      return {
        headerTitle: 'Edit an Existing Schedule',
        headerSubtitle: 'Import a published CSV schedule to tweak service times and export without rerunning optimization.',
        stepLabel: 'Step 1 of 2',
        stepName: 'Import Schedule Data',
        uploadTitle: 'Import Schedule CSV',
        uploadSubtitle: 'Upload a schedule export to open it directly in quick adjust mode.',
        uploadButton: 'Import CSV Schedule',
        requirements: [
          'Only Scheduler2 CSV exports are supported for editing.',
          'Ensure the file includes all timepoints and trips you want to adjust.',
          'Maximum file size: 10MB'
        ]
      };
    }

    return {
      headerTitle: 'Create a New Schedule',
      headerSubtitle: 'Upload raw schedule inputs to run the full optimization workflow.',
      stepLabel: 'Step 1 of 5',
      stepName: 'Upload Schedule Data',
      uploadTitle: 'Create Draft Working Schedule',
      uploadSubtitle: 'Upload raw schedule data to create a new draft working schedule.',
      uploadButton: 'Upload Schedule File',
      requirements: [
        'CSV files: Travel time segments with percentile data.',
        'Excel files: Timepoint schedules containing route timings.',
        'File size limit: 10MB'
      ]
    };
  }, [isEditMode]);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDraftNamingDialog, setShowDraftNamingDialog] = useState(false);
  const [pendingUploadData, setPendingUploadData] = useState<PendingUploadData | null>(null);

  const handleFileUploaded = useCallback(async (
    data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; fileType: 'excel' | 'csv' },
    fileName: string,
    validation: ValidationResult,
    report: string,
    file: File
  ) => {
    if (isEditMode && data.fileType !== 'csv') {
      setUploadError('Editing an existing schedule requires uploading a CSV schedule export.');
      return;
    }

    setPendingUploadData({ data, fileName, validation, report, file });
    setShowDraftNamingDialog(true);
    setUploadError(null);
  }, [isEditMode]);

  const handleDraftNamingConfirm = useCallback(async (result: DraftNamingResult) => {
    if (!pendingUploadData) {
      return;
    }

    const { data, fileName, validation, file } = pendingUploadData;
    const isQuickAdjust = result.workflowMode === 'quick-adjust';

    try {
      if (result.action === 'replace' && result.existingDraftId) {
        draftService.deleteWorkflow(result.existingDraftId);
      }

      const uploadedData = data.extractedData || data.csvData;
      if (!uploadedData) {
        setUploadError('Unable to process uploaded data. Please try again with a different file.');
        return;
      }

      const draftResult = await createDraftFromUpload(result.draftName, data.fileType, uploadedData);
      if (!draftResult.success || !draftResult.draftId) {
        setUploadError(draftResult.error || 'Failed to create draft');
        return;
      }

      const draftId = draftResult.draftId;
      draftService.getOrCreateWorkflow(draftId, result.draftName);
      draftService.updateStepStatus(draftId, 'upload', 'completed');

      if (isQuickAdjust) {
        if (data.fileType !== 'csv') {
          setUploadError('Quick adjust is currently supported for CSV schedule exports only.');
          return;
        }

        try {
          const rawContent = await file.text();
          const rows = parseQuickAdjustCsv(rawContent).filter(row => row.some(cell => cell.trim() !== ''));
          const parseResult = parseQuickAdjustSchedule(rows, { routeId: draftId });

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

          navigate('/block-summary-schedule', {
            state: {
              draftId,
              draftName: result.draftName,
              fromUpload: true,
              fromQuickAdjust: true,
              summarySchedule: parseResult.summarySchedule,
              timePoints: parseResult.timePoints,
              trips: parseResult.trips.weekday,
              quickAdjustTrips: parseResult.trips,
              quickAdjustWarnings: parseResult.warnings,
              rawCsvRows: rows
            }
          });
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to import schedule for quick adjustment';
          setUploadError(message);
          return;
        }
      }

      setTimeout(() => {
        navigate('/timepoints', {
          state: {
            draftId,
            draftName: result.draftName,
            csvData: data.csvData,
            fileName: result.draftName,
            fromUpload: true
          }
        });
      }, 1000);
    } catch (error) {
      setUploadError('Failed to create draft schedule');
    } finally {
      setShowDraftNamingDialog(false);
      setPendingUploadData(null);
    }
  }, [pendingUploadData, createDraftFromUpload, navigate]);

  const handleDraftNamingCancel = useCallback(() => {
    setShowDraftNamingDialog(false);
    setPendingUploadData(null);
  }, []);

  const handleUploadError = useCallback((error: string) => {
    setUploadError(error);
  }, []);

  const handleGoForward = useCallback(() => {
    navigate('/timepoints');
  }, [navigate]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4} textAlign="center">
        <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
          {pageCopy.headerTitle}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {pageCopy.headerSubtitle}
        </Typography>
      </Box>

      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          p: 2,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
          <Typography variant="body2" color="text.secondary">
            {pageCopy.stepLabel}
          </Typography>
          <Typography variant="body1" color="primary" fontWeight="bold">
            {pageCopy.stepName}
          </Typography>
        </Box>

        {!isEditMode && (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={handleGoForward}
            size="large"
            sx={{ minWidth: 180 }}
          >
            Continue to TimePoints
          </Button>
        )}
      </Box>

      {uploadError && (
        <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mb: 3 }}>
          {uploadError}
        </Alert>
      )}

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            File Requirements
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {pageCopy.uploadSubtitle}
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 2 }}>
            {pageCopy.requirements.map((requirement, index) => (
              <Typography key={index} component="li" variant="body2" color="text.secondary">
                {requirement}
              </Typography>
            ))}
          </Box>
        </CardContent>
      </Card>

      <FileUpload
        onFileUploaded={handleFileUploaded}
        onError={handleUploadError}
        title={pageCopy.uploadTitle}
        subtitle={pageCopy.uploadSubtitle}
        buttonText={pageCopy.uploadButton}
      />

      {showDraftNamingDialog && pendingUploadData && (
        <DraftNamingDialog
          open={showDraftNamingDialog}
          onClose={handleDraftNamingCancel}
          onConfirm={handleDraftNamingConfirm}
          fileName={pendingUploadData.fileName}
          suggestedName={pendingUploadData.fileName}
          uploadedData={pendingUploadData.data.extractedData || pendingUploadData.data.csvData}
          fileType={pendingUploadData.data.fileType}
          workflowContext={mode}
        />
      )}
    </Container>
  );
};

export default UploadSchedule;

import React, { useState, useCallback } from 'react';
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

interface PendingUploadData {
  data: { extractedData?: ParsedExcelData; csvData?: ParsedCsvData; fileType: 'excel' | 'csv' };
  fileName: string;
  validation: ValidationResult;
  report: string;
}

const UploadSchedule: React.FC = () => {
  const navigate = useNavigate();
  const { createDraftFromUpload } = useWorkflowDraft();
  
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDraftNamingDialog, setShowDraftNamingDialog] = useState(false);
  const [pendingUploadData, setPendingUploadData] = useState<PendingUploadData | null>(null);

  // Handle file upload
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
  }, []);

  // Handle draft naming dialog confirmation
  const handleDraftNamingConfirm = useCallback(async (result: DraftNamingResult) => {
    if (!pendingUploadData) return;
    
    const { data, fileName, validation, report } = pendingUploadData;
    
    try {
      // Handle replacement if needed
      if (result.action === 'replace' && result.existingDraftId) {
        draftService.deleteWorkflow(result.existingDraftId);
      }

      // Create the draft with chosen name
      const uploadedData = data.extractedData || data.csvData;
      if (uploadedData) {
        const draftResult = await createDraftFromUpload(result.draftName, data.fileType, uploadedData);
        if (draftResult.success && draftResult.draftId) {
          // Create workflow
          const workflow = draftService.getOrCreateWorkflow(draftResult.draftId, result.draftName);
          draftService.updateStepStatus(draftResult.draftId, 'upload', 'completed');
          
          console.log('✅ Created workflow draft:', result.draftName, draftResult.draftId);
          
          // Navigate to TimePoints page for CSV files
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
          console.error('❌ Failed to create workflow draft:', draftResult.error);
          setUploadError(draftResult.error || 'Failed to create draft');
        }
      }
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

  // Handle upload errors
  const handleUploadError = useCallback((error: string) => {
    setUploadError(error);
  }, []);

  // Handle forward navigation to TimePoints
  const handleGoForward = useCallback(() => {
    // Navigate to TimePoints page - this will show the upload requirement if no data exists
    navigate('/timepoints');
  }, [navigate]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4} textAlign="center">
        <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
          Upload Schedule Data
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload your CSV file to begin creating a bus route schedule
        </Typography>
      </Box>

      {/* Workflow Navigation Buttons */}
      <Box sx={{ 
        mb: 3, 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center',
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
          <Typography variant="body2" color="text.secondary">
            Step 1 of 5
          </Typography>
          <Typography variant="body1" color="primary" fontWeight="bold">
            Upload Schedule Data
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleGoForward}
          size="large"
          sx={{ minWidth: 180 }}
        >
          Continue to TimePoints
        </Button>
      </Box>

      {/* Error Display */}
      {uploadError && (
        <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mb: 3 }}>
          {uploadError}
        </Alert>
      )}

      {/* File Requirements */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            File Requirements
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Upload raw schedule data to begin creating your draft working schedule.
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>CSV files:</strong> Transify segment travel time data with time periods and percentiles
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Excel files:</strong> Time point schedules with route and timing information
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>File size:</strong> Maximum 5MB
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Format:</strong> Well-structured data with proper headers and time formats
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* File Upload */}
      <FileUpload
        onFileUploaded={handleFileUploaded}
        onError={handleUploadError}
      />

      {/* Draft Naming Dialog */}
      {showDraftNamingDialog && pendingUploadData && (
        <DraftNamingDialog
          open={showDraftNamingDialog}
          fileName={pendingUploadData.fileName}
          suggestedName={pendingUploadData.fileName}
          uploadedData={pendingUploadData.data.extractedData || pendingUploadData.data.csvData}
          onConfirm={handleDraftNamingConfirm}
          onClose={handleDraftNamingCancel}
        />
      )}
    </Container>
  );
};

export default UploadSchedule;
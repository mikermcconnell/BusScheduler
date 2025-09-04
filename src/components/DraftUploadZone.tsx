import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Alert,
  LinearProgress,
  Collapse
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useFileUpload } from '../hooks/useFileUpload';
import { draftService } from '../services/draftService';
import { ParsedCsvData } from '../utils/csvParser';
import { ParsedExcelData } from '../utils/excelParser';

interface DraftUploadZoneProps {
  onUploadComplete: () => void;
  onCancel: () => void;
}

const DraftUploadZone: React.FC<DraftUploadZoneProps> = ({
  onUploadComplete,
  onCancel
}) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile, isLoading, error: uploadError } = useFileUpload();

  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      setUploadStatus('error');
      setStatusMessage('Please upload a CSV or Excel file');
      return;
    }
    
    setUploadStatus('uploading');
    setStatusMessage('Processing file...');
    setUploadProgress(25);

    try {
      // Process the file using existing validation
      const result = await uploadFile(file);
      
      if (!result) {
        throw new Error('Failed to process file');
      }

      setUploadProgress(50);
      setStatusMessage('Creating draft...');

      // Determine file type and get the appropriate data
      const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'excel';
      const uploadData = fileType === 'csv' ? result.csvData : result.extractedData;
      
      if (!uploadData) {
        throw new Error('No data extracted from file');
      }
      
      // Create draft in Firebase
      const draftResult = await draftService.createDraftFromUpload(
        file.name,
        fileType,
        uploadData as ParsedExcelData | ParsedCsvData
      );

      setUploadProgress(75);

      if (draftResult.success) {
        setUploadStatus('success');
        setStatusMessage(`Draft "${file.name}" created successfully!`);
        setUploadProgress(100);
        
        // Auto-close after success
        setTimeout(() => {
          onUploadComplete();
        }, 2000);
      } else {
        throw new Error(draftResult.error || 'Failed to create draft');
      }
    } catch (error: any) {
      setUploadStatus('error');
      setStatusMessage(error.message || 'Upload failed');
      setUploadProgress(0);
    }
  }, [uploadFile, onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'success':
        return <SuccessIcon color="success" sx={{ fontSize: 48 }} />;
      case 'error':
        return <ErrorIcon color="error" sx={{ fontSize: 48 }} />;
      default:
        return <UploadIcon color="primary" sx={{ fontSize: 48 }} />;
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus) {
      case 'success':
        return 'success.main';
      case 'error':
        return 'error.main';
      default:
        return isDragOver ? 'primary.main' : 'text.secondary';
    }
  };

  return (
    <Collapse in={true}>
      <Paper
        elevation={2}
        sx={{
          p: 3,
          position: 'relative',
          border: '2px dashed',
          borderColor: getStatusColor(),
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          transition: 'all 0.3s ease',
          cursor: uploadStatus === 'uploading' ? 'wait' : 'pointer'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => uploadStatus === 'idle' && fileInputRef.current?.click()}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".csv,.xls,.xlsx"
          onChange={handleFileSelect}
          disabled={uploadStatus === 'uploading'}
        />
        
        {/* Close Button */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8
          }}
          disabled={uploadStatus === 'uploading'}
        >
          <CloseIcon />
        </IconButton>

        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            pointerEvents: uploadStatus === 'uploading' ? 'none' : 'auto'
          }}
        >
          {/* Icon */}
          <Box mb={2}>
            {getStatusIcon()}
          </Box>

          {/* Main Message */}
          <Typography variant="h6" gutterBottom color={getStatusColor()}>
            {uploadStatus === 'uploading' 
              ? 'Uploading...'
              : uploadStatus === 'success'
              ? 'Upload Complete!'
              : uploadStatus === 'error'
              ? 'Upload Failed'
              : isDragOver
              ? 'Drop your file here'
              : 'Drag & drop a CSV or Excel file here'
            }
          </Typography>

          {/* Status Message */}
          {statusMessage && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {statusMessage}
            </Typography>
          )}

          {/* Upload Button */}
          {uploadStatus === 'idle' && !isDragOver && (
            <Box mt={2}>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose File
              </Button>
              <Typography variant="caption" display="block" mt={1} color="text.secondary">
                Supported formats: CSV, XLS, XLSX (Max 5MB)
              </Typography>
            </Box>
          )}

          {/* Progress Bar */}
          {uploadStatus === 'uploading' && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" color="text.secondary" mt={1}>
                {uploadProgress}% Complete
              </Typography>
            </Box>
          )}

          {/* Error Display */}
          {uploadStatus === 'error' && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              {statusMessage}
              <Box mt={1}>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadStatus('idle');
                    setStatusMessage('');
                    setUploadProgress(0);
                  }}
                >
                  Try Again
                </Button>
              </Box>
            </Alert>
          )}
        </Box>
      </Paper>
    </Collapse>
  );
};

export default DraftUploadZone;
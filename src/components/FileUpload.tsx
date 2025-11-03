import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Chip,
  IconButton
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Clear,
  CheckCircle
} from '@mui/icons-material';
import { useFileUpload } from '../hooks/useFileUpload';
import { LoadingOverlay } from './loading';

interface FileUploadProps {
  onFileUploaded?: (
    data: { extractedData?: any; csvData?: any; tripsByDay?: Record<'weekday' | 'saturday' | 'sunday', any[]>; fileType: 'excel' | 'csv' }, 
    fileName: string, 
    validation: any, 
    report: string,
    file: File
  ) => void;
  onError?: (error: string) => void;
  title?: string;
  subtitle?: string;
  buttonText?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onError,
  title,
  subtitle,
  buttonText
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { isLoading, error, extractedData, fileName, uploadFile, clearFile } = useFileUpload();
  const headingTitle = title ?? 'Create Draft Working Schedule';
  const headingSubtitle = subtitle ?? 'Upload raw schedule data to create a new draft working schedule';
  const primaryButtonText = buttonText ?? 'Choose File';

  const handleFileSelect = async (file: File) => {
    const result = await uploadFile(file);
    
    if (result.success && result.validation && result.qualityReport && result.fileType) {
      const data = {
        extractedData: result.extractedData,
        csvData: result.csvData,
        tripsByDay: result.tripsByDay,
        fileType: result.fileType
      };
      onFileUploaded?.(data, result.fileName, result.validation, result.qualityReport, file);
    } else if (result.error) {
      onError?.(result.error);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    clearFile();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  return (
    <Box>
      <Paper
        elevation={2}
        sx={{
          p: 4,
          textAlign: 'center',
          border: dragActive ? '2px dashed rgb(0, 75, 128)' : '2px dashed #ccc',
          backgroundColor: dragActive ? 'rgba(0, 75, 128, 0.1)' : 'inherit',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        <LoadingOverlay 
          open={isLoading}
          message="Creating draft working schedule..."
          showProgress
          transparent
        />

        {!fileName && !isLoading && (
          <>
            <CloudUpload sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {headingTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {headingSubtitle}
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={handleBrowseClick}
              disabled={isLoading}
            >
              {primaryButtonText}
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
              Supported formats: .xlsx, .xls, .csv (max 10MB)
            </Typography>
          </>
        )}

        {fileName && !error && extractedData && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            <Chip
              icon={<Description />}
              label={fileName}
              color="success"
              variant="outlined"
            />
            <IconButton size="small" onClick={handleClear} color="default">
              <Clear />
            </IconButton>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Upload Failed:</strong> {error}
          </Typography>
        </Alert>
      )}

      {extractedData && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Successfully uploaded <strong>{fileName}</strong> with {extractedData.timePoints.length} time points and {extractedData.travelTimes.length} travel time connections
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

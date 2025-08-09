import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  LinearProgress,
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

interface FileUploadProps {
  onFileUploaded?: (extractedData: any, fileName: string, validation: any, report: string) => void;
  onError?: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onError
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { isLoading, error, extractedData, validation, fileName, qualityReport, uploadFile, clearFile } = useFileUpload();

  const handleFileSelect = async (file: File) => {
    const result = await uploadFile(file);
    
    if (result.success && result.extractedData && result.validation && result.qualityReport) {
      onFileUploaded?.(result.extractedData, result.fileName, result.validation, result.qualityReport);
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

  const getFileSize = (size: number): string => {
    return size > 1024 * 1024 
      ? `${(size / (1024 * 1024)).toFixed(1)} MB`
      : `${(size / 1024).toFixed(1)} KB`;
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
          accept=".xlsx,.xls"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {isLoading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Processing Excel file...
            </Typography>
          </Box>
        )}

        {!fileName && !isLoading && (
          <>
            <CloudUpload sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Upload Excel Schedule File
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Drag and drop your Excel file here, or click to browse
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={handleBrowseClick}
              disabled={isLoading}
            >
              Choose File
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
              Supported formats: .xlsx, .xls (max 10MB)
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
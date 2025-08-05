import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

const UploadSchedule: React.FC = () => {
  const requirements = [
    'Excel file format (.xlsx or .xls)',
    'First row should contain time point names',
    'Each subsequent row represents a trip schedule',
    'Time format should be HH:MM (24-hour format)',
    'Empty cells are allowed for non-stop time points',
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Upload Schedule
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Import your bus schedule data from Excel files
      </Typography>

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

      <Paper
        sx={{
          p: 6,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'primary.main',
          backgroundColor: 'primary.50',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: 'primary.100',
            borderColor: 'primary.dark',
          },
        }}
      >
        <UploadIcon
          sx={{
            fontSize: 64,
            color: 'primary.main',
            mb: 2,
          }}
        />
        <Typography variant="h6" gutterBottom>
          Drag & Drop Files Here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          or click to browse files
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<UploadIcon />}
        >
          Select Files
        </Button>
      </Paper>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Processing Status
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <CheckIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">
              No files uploaded yet
            </Typography>
            <Typography variant="body2">
              Upload a file to see processing status
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default UploadSchedule;
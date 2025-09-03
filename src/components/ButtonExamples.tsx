import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { 
  Upload as UploadIcon, 
  Download as DownloadIcon, 
  Save as SaveIcon,
  Delete as DeleteIcon 
} from '@mui/icons-material';
import CustomButton from './CustomButton';

const ButtonExamples: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Custom Button Examples
      </Typography>
      
      <Stack spacing={3}>
        {/* Primary Buttons */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Primary Buttons
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <CustomButton variant="contained" color="primary">
              Default Primary
            </CustomButton>
            <CustomButton 
              variant="contained" 
              color="primary" 
              startIcon={<UploadIcon />}
            >
              Upload Schedule
            </CustomButton>
            <CustomButton 
              variant="contained" 
              color="primary" 
              endIcon={<SaveIcon />}
            >
              Save Draft
            </CustomButton>
          </Stack>
        </Box>

        {/* Secondary Buttons */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Secondary Buttons
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <CustomButton variant="contained" color="secondary">
              Secondary Action
            </CustomButton>
            <CustomButton 
              variant="contained" 
              color="secondary" 
              startIcon={<DownloadIcon />}
            >
              Export Schedule
            </CustomButton>
          </Stack>
        </Box>

        {/* Outlined Buttons */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Outlined Buttons
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <CustomButton variant="outlined" color="primary">
              Outlined Primary
            </CustomButton>
            <CustomButton variant="outlined" color="secondary">
              Outlined Secondary
            </CustomButton>
            <CustomButton 
              variant="outlined" 
              color="error"
              startIcon={<DeleteIcon />}
            >
              Delete Draft
            </CustomButton>
          </Stack>
        </Box>

        {/* Text Buttons */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Text Buttons
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <CustomButton variant="text" color="primary">
              Text Primary
            </CustomButton>
            <CustomButton variant="text" color="secondary">
              Text Secondary
            </CustomButton>
            <CustomButton variant="text">
              Default Text
            </CustomButton>
          </Stack>
        </Box>

        {/* Custom Hover Colors */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Custom Hover Effects
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <CustomButton 
              variant="contained" 
              hoverColor="#ffffff"
              hoverBackground="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              sx={{ backgroundColor: '#4CAF50' }}
            >
              Custom Hover
            </CustomButton>
            <CustomButton 
              variant="outlined"
              hoverColor="#ffffff"
              hoverBackground="#FF6B6B"
              sx={{ borderColor: '#FF6B6B', color: '#FF6B6B' }}
            >
              Hover Transform
            </CustomButton>
          </Stack>
        </Box>

        {/* Size Variants */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Size Variants
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
            <CustomButton variant="contained" size="small">
              Small
            </CustomButton>
            <CustomButton variant="contained" size="medium">
              Medium
            </CustomButton>
            <CustomButton variant="contained" size="large">
              Large
            </CustomButton>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default ButtonExamples;
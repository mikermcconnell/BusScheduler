import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  DirectionsBus as BusIcon,
} from '@mui/icons-material';

interface SummaryScheduleGeneratorProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (scheduleData: GeneratedScheduleData) => void;
}

export interface GeneratedScheduleData {
  routeName: string;
  direction: string;
  serviceType: string;
  effectiveDate: string;
  tripCount: number;
  timePoints: string[];
}

const SummaryScheduleGenerator: React.FC<SummaryScheduleGeneratorProps> = ({
  open,
  onClose,
  onGenerate,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    routeName: '',
    direction: 'Clockwise',
    serviceType: 'Weekday',
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  const steps = ['Route Details', 'Service Configuration', 'Generate Schedule'];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate schedule generation
    setTimeout(() => {
      const scheduleData: GeneratedScheduleData = {
        ...formData,
        tripCount: Math.floor(Math.random() * 20) + 10,
        timePoints: [
          'Downtown Terminal',
          'Johnson at Napier',
          'RVH Main Entrance',
          'Georgian College',
          'Georgian Mall',
          'Bayfield Mall',
        ],
      };
      
      setIsGenerating(false);
      onGenerate(scheduleData);
      setActiveStep(0);
      setFormData({
        routeName: '',
        direction: 'Clockwise',
        serviceType: 'Weekday',
        effectiveDate: new Date().toISOString().split('T')[0],
      });
    }, 3000);
  };

  const handleClose = () => {
    if (!isGenerating) {
      setActiveStep(0);
      onClose();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Route Name"
              value={formData.routeName}
              onChange={(e) => handleInputChange('routeName', e.target.value)}
              placeholder="e.g., Route 2"
              sx={{ mb: 3 }}
              required
            />
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Direction</InputLabel>
              <Select
                value={formData.direction}
                label="Direction"
                onChange={(e) => handleInputChange('direction', e.target.value)}
              >
                <MenuItem value="Clockwise">Clockwise</MenuItem>
                <MenuItem value="Counter-Clockwise">Counter-Clockwise</MenuItem>
                <MenuItem value="Inbound">Inbound</MenuItem>
                <MenuItem value="Outbound">Outbound</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info">
              Enter the basic route information to get started.
            </Alert>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Service Type</InputLabel>
              <Select
                value={formData.serviceType}
                label="Service Type"
                onChange={(e) => handleInputChange('serviceType', e.target.value)}
              >
                <MenuItem value="Weekday">Weekday</MenuItem>
                <MenuItem value="Saturday">Saturday</MenuItem>
                <MenuItem value="Sunday">Sunday</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="date"
              label="Effective Date"
              value={formData.effectiveDate}
              onChange={(e) => handleInputChange('effectiveDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 3 }}
            />

            <Alert severity="info">
              Configure the service parameters for your schedule.
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ pt: 2, textAlign: 'center' }}>
            {isGenerating ? (
              <>
                <ScheduleIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Generating Schedule...
                </Typography>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Processing travel time data and creating optimized schedule
                </Typography>
              </>
            ) : (
              <>
                <BusIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Ready to Generate
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Review your settings and generate the schedule
                </Typography>
                
                <Box sx={{ textAlign: 'left', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Schedule Summary:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Route: ${formData.routeName || 'Not specified'}`} size="small" />
                    <Chip label={`Direction: ${formData.direction}`} size="small" />
                    <Chip label={`Service: ${formData.serviceType}`} size="small" />
                    <Chip label={`Date: ${formData.effectiveDate}`} size="small" />
                  </Box>
                </Box>
              </>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return formData.routeName.trim() !== '';
      case 1:
        return formData.serviceType !== '' && formData.effectiveDate !== '';
      default:
        return true;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isGenerating}
    >
      <DialogTitle>
        <Typography variant="h6">
          Continue to Trip Details
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {getStepContent(activeStep)}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClose}
          disabled={isGenerating}
        >
          Cancel
        </Button>
        
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || isGenerating}
        >
          Back
        </Button>
        
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!isStepValid(activeStep) || isGenerating}
        >
          {activeStep === steps.length - 1 ? 'Generate' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SummaryScheduleGenerator;
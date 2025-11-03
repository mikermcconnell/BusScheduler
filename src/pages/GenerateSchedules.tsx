import React, { useState } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Paper,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Add as AddIcon,
  PlayArrow as GenerateIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const GenerateSchedules: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const steps = [
    {
      label: 'Upload Travel Data',
      description: 'Upload CSV file with travel time data by time periods',
    },
    {
      label: 'Configure Route',
      description: 'Define route parameters and time points',
    },
    {
      label: 'Generate Schedule',
      description: 'Create draft schedule with calculated trip times',
    },
    {
      label: 'Review & Export',
      description: 'Review generated schedule and export to Excel',
    },
  ];

  const handleNext = () => {
    const nextStep = activeStep + 1;
    if (nextStep >= 3) {
      // After generating schedule, navigate to Block Configuration page
      navigate('/block-configuration');
    } else {
      setActiveStep(nextStep);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate schedule generation
    setTimeout(() => {
      setIsGenerating(false);
      handleNext();
    }, 3000);
  };

  const handleUploadData = () => {
    navigate('/new-schedule');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Generate Schedules
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Create professional bus schedules from travel time data
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="large"
          onClick={handleUploadData}
        >
          New Schedule
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Follow the steps below to generate a complete bus schedule from your travel time data.
      </Alert>

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>

                  {index === 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <ScheduleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Upload Travel Time Data
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Upload a CSV file with travel time percentiles by time period
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={handleUploadData}
                          startIcon={<AddIcon />}
                        >
                          Upload Data
                        </Button>
                      </Paper>
                    </Box>
                  )}

                  {index === 1 && (
                    <Box sx={{ mb: 2 }}>
                      <Alert severity="warning">
                        Route configuration functionality will be implemented in this step.
                      </Alert>
                    </Box>
                  )}

                  {index === 2 && (
                    <Box sx={{ mb: 2 }}>
                      {isGenerating ? (
                        <Paper sx={{ p: 3, textAlign: 'center' }}>
                          <Typography variant="h6" gutterBottom>
                            Generating Schedule...
                          </Typography>
                          <LinearProgress sx={{ mb: 2 }} />
                          <Typography variant="body2" color="text.secondary">
                            Processing travel time data and calculating optimal trip times
                          </Typography>
                        </Paper>
                      ) : (
                        <Paper sx={{ p: 3, textAlign: 'center' }}>
                          <GenerateIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            Ready to Generate
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            All data uploaded. Click to generate your schedule.
                          </Typography>
                          <Button
                            variant="contained"
                            size="large"
                            startIcon={<GenerateIcon />}
                            onClick={handleGenerate}
                          >
                            Generate Schedule
                          </Button>
                        </Paper>
                      )}
                    </Box>
                  )}

                  {index === 3 && (
                    <Box sx={{ mb: 2 }}>
                      <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <ExportIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Schedule Generated!
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Your schedule has been generated successfully. Review and export it.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                          <Button
                            variant="outlined"
                            onClick={() => navigate('/schedules')}
                          >
                            View Schedule
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<ExportIcon />}
                            color="success"
                          >
                            Export to Excel
                          </Button>
                        </Box>
                      </Paper>
                    </Box>
                  )}

                  <Box sx={{ mb: 1 }}>
                    <div>
                      <Button
                        disabled={index === 0 || isGenerating}
                        onClick={handleBack}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Back
                      </Button>
                      {index < steps.length - 1 && (
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          sx={{ mt: 1, mr: 1 }}
                          disabled={isGenerating}
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GenerateSchedules;

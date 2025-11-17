import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Avatar
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Edit as EditIcon,
  ViewList as ViewIcon,
  Build as BuildIcon
} from '@mui/icons-material';
import UploadSchedule from './UploadSchedule';

const EditSchedule: React.FC = () => {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);

  const scrollToEditor = () => {
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const actionCards = [
    {
      title: 'Create New Schedule',
      description: 'Upload raw inputs to start a fresh optimization workflow.',
      cta: 'Start New Draft',
      icon: <UploadIcon color="primary" />,
      onClick: () => navigate('/new-schedule')
    },
    {
      title: 'Edit Existing Schedule',
      description: 'Import a published CSV to jump right into adjustments.',
      cta: 'Open Editor',
      icon: <EditIcon color="secondary" />,
      onClick: scrollToEditor
    },
    {
      title: 'Browse Schedules',
      description: 'Review and export previously published schedules.',
      cta: 'Browse Library',
      icon: <ViewIcon color="info" />,
      onClick: () => navigate('/schedules')
    },
    {
      title: 'Block Configuration',
      description: 'Update cycle times, coverage targets, and block templates.',
      cta: 'Adjust Blocks',
      icon: <BuildIcon color="warning" />,
      onClick: () => navigate('/block-configuration')
    }
  ];

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Fixed Transit
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage new builds, edit existing schedules, browse published work, and update block configurations
          from a single workspace.
        </Typography>
      </Box>

      <Grid container spacing={2} mb={4}>
        {actionCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, md: 6, lg: 3 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.primary'
                    }}
                  >
                    {card.icon}
                  </Avatar>
                  <Typography variant="h6">{card.title}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {card.description}
                </Typography>
                <Button variant="outlined" onClick={card.onClick}>
                  {card.cta}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box ref={editorRef}>
        <UploadSchedule mode="edit" />
      </Box>
    </Box>
  );
};

export default EditSchedule;

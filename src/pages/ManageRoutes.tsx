import React, { useState } from 'react';
import {
  Typography,
  Box,
  Button,
  Paper,
  Alert,
  Tabs,
  Tab,
  Card,
  CardContent,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { TripDurationChart } from '../components/TripDurationChart';
import { TripDurationTable } from '../components/TripDurationTable';
import { TripDurationAnalyzer } from '../utils/tripDurationAnalyzer';
import { TripDurationAnalysis } from '../types/schedule';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ManageRoutes: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [analysisData, setAnalysisData] = useState<TripDurationAnalysis | null>(null);

  // Sample data for demonstration - replace with real data loading
  React.useEffect(() => {
    // Create sample data to show the functionality
    const sampleData: TripDurationAnalysis = {
      routeId: "route-2",
      routeName: "Route 2",
      direction: "Clockwise",
      durationByTimeOfDay: [
        {
          timePeriod: "07:00 - 07:29",
          startTime: "07:00",
          duration: { p25: 42, p50: 45, p80: 48, p90: 52 }
        },
        {
          timePeriod: "07:30 - 07:59",
          startTime: "07:30",
          duration: { p25: 45, p50: 48, p80: 52, p90: 58 }
        },
        {
          timePeriod: "08:00 - 08:29",
          startTime: "08:00",
          duration: { p25: 48, p50: 52, p80: 58, p90: 65 }
        },
        {
          timePeriod: "08:30 - 08:59",
          startTime: "08:30",
          duration: { p25: 50, p50: 55, p80: 62, p90: 68 }
        },
        {
          timePeriod: "09:00 - 09:29",
          startTime: "09:00",
          duration: { p25: 46, p50: 50, p80: 54, p90: 58 }
        },
        {
          timePeriod: "09:30 - 09:59",
          startTime: "09:30",
          duration: { p25: 43, p50: 46, p80: 50, p90: 54 }
        },
        {
          timePeriod: "10:00 - 10:29",
          startTime: "10:00",
          duration: { p25: 40, p50: 43, p80: 46, p90: 50 }
        },
        {
          timePeriod: "10:30 - 10:59",
          startTime: "10:30",
          duration: { p25: 38, p50: 41, p80: 44, p90: 47 }
        }
      ],
      summary: {
        minDuration: 41,
        maxDuration: 55,
        avgDuration: 48,
        peakPeriod: "08:30 - 08:59",
        fastestPeriod: "10:30 - 10:59"
      }
    };
    setAnalysisData(sampleData);
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Trip Duration Analysis
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Analyze travel times by time of day for route optimization
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          size="large"
        >
          Upload Travel Data
        </Button>
      </Box>

      {!analysisData ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <AnalyticsIcon
            sx={{
              fontSize: 64,
              color: 'text.secondary',
              mb: 2,
              opacity: 0.5,
            }}
          />
          <Typography variant="h6" gutterBottom>
            No Travel Time Data Available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload travel time data to analyze trip durations by time of day
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            size="large"
          >
            Upload Travel Data
          </Button>
        </Paper>
      ) : (
        <Card>
          <CardContent>
            <Alert severity="info" sx={{ mb: 3 }}>
              Showing sample travel time data for Route 2 (Clockwise). Upload your own data to see real analysis.
            </Alert>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Chart View" />
                <Tab label="Table View" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <TripDurationChart analysis={analysisData} />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <TripDurationTable analysis={analysisData} />
            </TabPanel>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ManageRoutes;
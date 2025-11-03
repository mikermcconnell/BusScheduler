import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Box, Paper, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { TripDurationAnalysis } from '../types/schedule';
import { TripDurationAnalyzer } from '../utils/tripDurationAnalyzer';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TripDurationChartProps {
  analysis: TripDurationAnalysis;
}

type ViewMode = 'all' | 'median' | 'range';

export const TripDurationChart: React.FC<TripDurationChartProps> = ({ analysis }) => {
  const [viewMode, setViewMode] = React.useState<ViewMode>('median');
  
  const chartData = TripDurationAnalyzer.toChartData(analysis);

  // Create different datasets based on view mode
  const getDatasets = () => {
    switch (viewMode) {
      case 'all':
        return chartData.datasets;
      
      case 'median':
        return [chartData.datasets[1]]; // Just median (p50)
      
      case 'range':
        return [
          chartData.datasets[0], // p25
          chartData.datasets[1], // p50 (median)
          chartData.datasets[2]  // p80
        ];
      
      default:
        return [chartData.datasets[1]];
    }
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        display: viewMode !== 'median'
      },
      title: {
        display: true,
        text: `Trip Duration by Time of Day - ${analysis.routeName} (${analysis.direction})`
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value} minutes`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time of Day'
        },
        ticks: {
          maxRotation: 45
        }
      },
      y: {
        title: {
          display: true,
          text: 'Trip Duration (minutes)'
        },
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} min`
        }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false
    }
  };

  const data = {
    labels: chartData.labels,
    datasets: getDatasets()
  };

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Find peak and fastest times for highlighting
  const peakTime = analysis.durationByTimeOfDay.find(
    item => item.timePeriod === analysis.summary.peakPeriod
  )?.startTime;
  
  const fastestTime = analysis.durationByTimeOfDay.find(
    item => item.timePeriod === analysis.summary.fastestPeriod
  )?.startTime;

  return (
    <Paper elevation={2} sx={{ p: 3, height: '600px' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Trip Duration Analysis
        </Typography>
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
          color="primary"
        >
          <ToggleButton value="median">
            Median Only
          </ToggleButton>
          <ToggleButton value="range">
            Key Percentiles
          </ToggleButton>
          <ToggleButton value="all">
            All Percentiles
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Insights */}
      <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Peak Travel Time:</strong> {peakTime} ({analysis.summary.maxDuration} min) | 
          <strong> Fastest Travel Time:</strong> {fastestTime} ({analysis.summary.minDuration} min) | 
          <strong> Average:</strong> {analysis.summary.avgDuration} min
        </Typography>
      </Box>

      <Box sx={{ height: '450px' }}>
        <Bar data={data} options={options} />
      </Box>

      {/* Chart Description */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {viewMode === 'median' && 'Showing median (50th percentile) travel times throughout the day.'}
          {viewMode === 'range' && 'Showing 25th, 50th, and 80th percentile travel times to indicate typical range.'}
          {viewMode === 'all' && 'Showing all percentiles (25th, 50th, 80th, 90th) for complete travel time distribution.'}
        </Typography>
      </Box>
    </Paper>
  );
};
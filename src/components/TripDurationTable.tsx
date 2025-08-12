import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip
} from '@mui/material';
import { TripDurationAnalysis } from '../types/schedule';
import { TripDurationAnalyzer } from '../utils/tripDurationAnalyzer';

interface TripDurationTableProps {
  analysis: TripDurationAnalysis;
}

export const TripDurationTable: React.FC<TripDurationTableProps> = ({ analysis }) => {
  const { headers, rows } = TripDurationAnalyzer.toTableData(analysis);

  // Find peak and fastest periods for highlighting
  const peakIndex = analysis.durationByTimeOfDay.findIndex(
    item => item.timePeriod === analysis.summary.peakPeriod
  );
  const fastestIndex = analysis.durationByTimeOfDay.findIndex(
    item => item.timePeriod === analysis.summary.fastestPeriod
  );

  const getCellColor = (rowIndex: number) => {
    if (rowIndex === peakIndex) return '#ffebee'; // Light red for peak
    if (rowIndex === fastestIndex) return '#e8f5e8'; // Light green for fastest
    return 'transparent';
  };

  const renderCell = (value: string, colIndex: number, rowIndex: number) => {
    if (colIndex === 0) {
      // Time period column with special styling
      return (
        <TableCell 
          sx={{ 
            fontWeight: 'medium',
            backgroundColor: getCellColor(rowIndex),
            position: 'relative'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {value}
            {rowIndex === peakIndex && (
              <Chip 
                label="Peak" 
                size="small" 
                color="error" 
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
            {rowIndex === fastestIndex && (
              <Chip 
                label="Fastest" 
                size="small" 
                color="success" 
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
          </Box>
        </TableCell>
      );
    }

    // Duration columns with numeric formatting
    const numValue = parseFloat(value);
    const formattedValue = numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(2);

    return (
      <TableCell 
        align="right" 
        sx={{ 
          backgroundColor: getCellColor(rowIndex),
          fontFamily: 'monospace'
        }}
      >
        {formattedValue}
      </TableCell>
    );
  };

  return (
    <Box>
      {/* Summary Statistics */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Trip Duration Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`Avg: ${analysis.summary.avgDuration} min`}
            variant="outlined" 
            color="primary"
          />
          <Chip 
            label={`Range: ${analysis.summary.minDuration} - ${analysis.summary.maxDuration} min`}
            variant="outlined" 
            color="info"
          />
          <Chip 
            label={`Peak: ${analysis.summary.peakPeriod}`}
            variant="outlined" 
            color="error"
          />
          <Chip 
            label={`Fastest: ${analysis.summary.fastestPeriod}`}
            variant="outlined" 
            color="success"
          />
        </Box>
      </Box>

      {/* Duration Table */}
      <TableContainer 
        component={Paper} 
        elevation={2}
        sx={{ maxHeight: '400px', overflow: 'auto' }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {headers.map((header, index) => (
                <TableCell 
                  key={index}
                  align={index === 0 ? 'left' : 'right'}
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText'
                  }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow 
                key={rowIndex}
                hover
                sx={{
                  '&:nth-of-type(odd)': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                {row.map((cell, colIndex) => 
                  renderCell(cell, colIndex, rowIndex)
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">
          Legend:
        </Typography>
        <Box sx={{ 
          width: 16, 
          height: 16, 
          backgroundColor: '#ffebee', 
          border: '1px solid #e0e0e0',
          borderRadius: '2px'
        }} />
        <Typography variant="caption" color="text.secondary">
          Peak Period
        </Typography>
        <Box sx={{ 
          width: 16, 
          height: 16, 
          backgroundColor: '#e8f5e8', 
          border: '1px solid #e0e0e0',
          borderRadius: '2px'
        }} />
        <Typography variant="caption" color="text.secondary">
          Fastest Period
        </Typography>
      </Box>
    </Box>
  );
};
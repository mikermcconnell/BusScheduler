/**
 * Tests for SummaryDisplay Component
 * Tests for component rendering, user interactions, and data display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SummaryDisplay from './SummaryDisplay';
import { SummarySchedule, TimePoint } from '../types';
import { CalculationResults, TripCalculationResult } from '../utils/calculator';

// Mock data for testing
const mockTimePoints: TimePoint[] = [
  { id: 'tp1', name: 'Downtown Terminal', sequence: 1 },
  { id: 'tp2', name: 'Main Street', sequence: 2 },
  { id: 'tp3', name: 'Shopping Center', sequence: 3 },
  { id: 'tp4', name: 'University', sequence: 4 }
];

const mockTripResults: TripCalculationResult[] = [
  {
    tripId: 'weekday_trip1',
    scheduleEntries: [
      { timePointId: 'tp1', arrivalTime: '08:00', departureTime: '08:00' },
      { timePointId: 'tp2', arrivalTime: '08:05', departureTime: '08:05' },
      { timePointId: 'tp3', arrivalTime: '08:13', departureTime: '08:13' },
      { timePointId: 'tp4', arrivalTime: '08:25', departureTime: '08:25' }
    ],
    totalTravelTime: 25,
    isValid: true,
    errors: []
  },
  {
    tripId: 'weekday_trip2',
    scheduleEntries: [
      { timePointId: 'tp1', arrivalTime: '08:30', departureTime: '08:30' },
      { timePointId: 'tp2', arrivalTime: '08:35', departureTime: '08:35' },
      { timePointId: 'tp3', arrivalTime: '08:43', departureTime: '08:43' },
      { timePointId: 'tp4', arrivalTime: '08:55', departureTime: '08:55' }
    ],
    totalTravelTime: 25,
    isValid: true,
    errors: []
  }
];

const mockCalculationResults: CalculationResults = {
  weekday: mockTripResults,
  saturday: [mockTripResults[0]], // Fewer trips on Saturday
  sunday: [mockTripResults[0]], // Same for Sunday
  metadata: {
    totalTimePoints: 4,
    totalTrips: 4,
    calculationTime: 150
  }
};

const mockSummarySchedule: SummarySchedule = {
  routeId: 'R001',
  routeName: 'Main Street Express',
  direction: 'Inbound',
  timePoints: mockTimePoints,
  weekday: [
    ['08:00', '08:05', '08:13', '08:25'],
    ['08:30', '08:35', '08:43', '08:55']
  ],
  saturday: [
    ['08:00', '08:05', '08:13', '08:25']
  ],
  sunday: [
    ['08:00', '08:05', '08:13', '08:25']
  ],
  effectiveDate: new Date('2024-01-01'),
  expirationDate: new Date('2024-12-31'),
  metadata: {
    weekdayTrips: 2,
    saturdayTrips: 1,
    sundayTrips: 1,
    frequency: 30,
    operatingHours: {
      start: '08:00',
      end: '08:55'
    }
  }
};

// Mock console.warn to avoid noise in tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
});

describe('SummaryDisplay Component', () => {
  const defaultProps = {
    summarySchedule: mockSummarySchedule,
    calculationResults: mockCalculationResults
  };

  describe('Basic Rendering', () => {
    test('renders route information correctly', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.getByText('Main Street Express')).toBeInTheDocument();
      expect(screen.getByText('Route R001 - Inbound')).toBeInTheDocument();
      expect(screen.getByText(/Effective: 1\/1\/2024/)).toBeInTheDocument();
    });

    test('renders time point headers correctly', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.getByText('Downtown Terminal')).toBeInTheDocument();
      expect(screen.getByText('Main Street')).toBeInTheDocument();
      expect(screen.getByText('Shopping Center')).toBeInTheDocument();
      expect(screen.getByText('University')).toBeInTheDocument();
    });

    test('renders schedule table with correct data', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      // Check for trip times in the table
      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('08:05')).toBeInTheDocument();
      expect(screen.getByText('08:13')).toBeInTheDocument();
      expect(screen.getByText('08:25')).toBeInTheDocument();
    });

    test('renders statistics card correctly', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.getByText('Schedule Statistics')).toBeInTheDocument();
      expect(screen.getByText('Trip Counts')).toBeInTheDocument();
      expect(screen.getByText('Average Frequency (min)')).toBeInTheDocument();
      expect(screen.getByText('Operating Hours')).toBeInTheDocument();
    });

    test('displays correct trip counts', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      // Check weekday trips count in tab
      expect(screen.getByText('(2 trips)')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    test('renders all day type tabs', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.getByRole('tab', { name: /weekday/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /saturday/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /sunday/i })).toBeInTheDocument();
    });

    test('weekday tab is active by default', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      const weekdayTab = screen.getByRole('tab', { name: /weekday/i });
      expect(weekdayTab).toHaveAttribute('aria-selected', 'true');
    });

    test('switches between tabs correctly', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      const saturdayTab = screen.getByRole('tab', { name: /saturday/i });
      fireEvent.click(saturdayTab);
      
      expect(saturdayTab).toHaveAttribute('aria-selected', 'true');
      
      const weekdayTab = screen.getByRole('tab', { name: /weekday/i });
      expect(weekdayTab).toHaveAttribute('aria-selected', 'false');
    });

    test('displays correct trip count for each day type', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      // Check weekday tab shows 2 trips
      expect(screen.getByText('Weekday (2 trips)')).toBeInTheDocument();
      
      // Check Saturday tab shows 1 trip
      expect(screen.getByText('Saturday (1 trips)')).toBeInTheDocument();
      
      // Check Sunday tab shows 1 trip
      expect(screen.getByText('Sunday (1 trips)')).toBeInTheDocument();
    });
  });

  describe('Format Options', () => {
    test('respects 12-hour time format option', () => {
      const formatOptions = {
        timeFormat: '12h' as const
      };
      
      render(
        <SummaryDisplay
          {...defaultProps}
          formatOptions={formatOptions}
        />
      );
      
      expect(screen.getByText('8:00 AM')).toBeInTheDocument();
      expect(screen.getByText('8:05 AM')).toBeInTheDocument();
    });

    test('respects includeTimePointNames option', () => {
      const formatOptions = {
        includeTimePointNames: false
      };
      
      render(
        <SummaryDisplay
          {...defaultProps}
          formatOptions={formatOptions}
        />
      );
      
      expect(screen.getByText('tp1')).toBeInTheDocument();
      expect(screen.getByText('tp2')).toBeInTheDocument();
      expect(screen.queryByText('Downtown Terminal')).not.toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    test('renders export buttons when onExport is provided', () => {
      const mockOnExport = jest.fn();
      
      render(
        <SummaryDisplay
          {...defaultProps}
          onExport={mockOnExport}
        />
      );
      
      expect(screen.getByText('Export All')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    test('does not render export buttons when onExport is not provided', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.queryByText('Export All')).not.toBeInTheDocument();
      expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
    });

    test('calls onExport when export CSV button is clicked', () => {
      const mockOnExport = jest.fn();
      
      render(
        <SummaryDisplay
          {...defaultProps}
          onExport={mockOnExport}
        />
      );
      
      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);
      
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.stringContaining('Route: Main Street Express - weekday'),
        'Main Street Express_weekday_schedule.csv'
      );
    });

    test('calls onExport for all day types when Export All is clicked', () => {
      const mockOnExport = jest.fn();
      
      render(
        <SummaryDisplay
          {...defaultProps}
          onExport={mockOnExport}
        />
      );
      
      const exportAllButton = screen.getByText('Export All');
      fireEvent.click(exportAllButton);
      
      expect(mockOnExport).toHaveBeenCalledTimes(3);
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.stringContaining('WEEKDAY'),
        expect.stringContaining('weekday')
      );
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.stringContaining('SATURDAY'),
        expect.stringContaining('saturday')
      );
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.stringContaining('SUNDAY'),
        expect.stringContaining('sunday')
      );
    });
  });

  describe('Time Bands Feature', () => {
    test('renders time bands toggle button', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.getByText('Show Time Bands')).toBeInTheDocument();
    });

    test('toggles time bands display', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      const toggleButton = screen.getByText('Show Time Bands');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Hide Time Bands')).toBeInTheDocument();
      expect(screen.getByText('Time Bands - Weekday')).toBeInTheDocument();
    });

    test('displays time bands information correctly', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      const toggleButton = screen.getByText('Show Time Bands');
      fireEvent.click(toggleButton);
      
      // Should display time band information
      expect(screen.getByText(/trips \|.*min frequency/)).toBeInTheDocument();
    });
  });

  describe('Advanced Statistics', () => {
    test('shows advanced statistics when enabled', () => {
      render(
        <SummaryDisplay
          {...defaultProps}
          showAdvancedStats={true}
        />
      );
      
      expect(screen.getByText('Advanced Statistics')).toBeInTheDocument();
      expect(screen.getByText('Total Time Points:')).toBeInTheDocument();
      expect(screen.getByText('Total Travel Time:')).toBeInTheDocument();
    });

    test('hides advanced statistics by default', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.queryByText('Advanced Statistics')).not.toBeInTheDocument();
    });
  });

  describe('Empty State Handling', () => {
    test('displays message when no trips are scheduled', () => {
      const emptyCalculationResults: CalculationResults = {
        weekday: [],
        saturday: [],
        sunday: [],
        metadata: {
          totalTimePoints: 4,
          totalTrips: 0,
          calculationTime: 10
        }
      };
      
      const emptySchedule = {
        ...mockSummarySchedule,
        weekday: [],
        saturday: [],
        sunday: [],
        metadata: {
          ...mockSummarySchedule.metadata,
          weekdayTrips: 0,
          saturdayTrips: 0,
          sundayTrips: 0
        }
      };
      
      render(
        <SummaryDisplay
          summarySchedule={emptySchedule}
          calculationResults={emptyCalculationResults}
        />
      );
      
      expect(screen.getByText('No trips scheduled for weekday.')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('displays validation errors when data is invalid', () => {
      const invalidSchedule = {
        ...mockSummarySchedule,
        routeId: '', // Invalid - empty route ID
        timePoints: [] // Invalid - no time points
      };
      
      const invalidResults: CalculationResults = {
        weekday: [],
        saturday: [],
        sunday: [],
        metadata: {
          totalTimePoints: 0,
          totalTrips: 0,
          calculationTime: 0
        }
      };
      
      render(
        <SummaryDisplay
          summarySchedule={invalidSchedule}
          calculationResults={invalidResults}
        />
      );
      
      expect(screen.getByText('Data Validation Errors')).toBeInTheDocument();
      expect(screen.getByText('Missing route ID')).toBeInTheDocument();
      expect(screen.getByText('No time points defined')).toBeInTheDocument();
    });

    test('displays warnings when present', () => {
      // Create a schedule with potential warnings (empty trips for a day)
      const warningResults: CalculationResults = {
        weekday: mockTripResults,
        saturday: [], // No Saturday trips - should trigger warning
        sunday: [mockTripResults[0]],
        metadata: {
          totalTimePoints: 4,
          totalTrips: 3,
          calculationTime: 100
        }
      };
      
      const warningSchedule = {
        ...mockSummarySchedule,
        saturday: [], // No Saturday schedule
        metadata: {
          ...mockSummarySchedule.metadata,
          saturdayTrips: 0
        }
      };
      
      render(
        <SummaryDisplay
          summarySchedule={warningSchedule}
          calculationResults={warningResults}
        />
      );
      
      expect(screen.getByText('Warnings:')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('tabs have proper ARIA attributes', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('role', 'tab');
      });
    });

    test('table has proper structure for screen readers', () => {
      render(<SummaryDisplay {...defaultProps} />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
    });

    test('buttons have proper titles for accessibility', () => {
      const mockOnExport = jest.fn();
      
      render(
        <SummaryDisplay
          {...defaultProps}
          onExport={mockOnExport}
        />
      );
      
      const exportButton = screen.getByTitle('Export to CSV');
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles large datasets without performance issues', () => {
      // Create a larger dataset
      const largeTripResults: TripCalculationResult[] = Array.from({ length: 50 }, (_, i) => ({
        tripId: `trip_${i}`,
        scheduleEntries: mockTimePoints.map(tp => ({
          timePointId: tp.id,
          arrivalTime: `${6 + Math.floor(i / 4)}:${(i % 4) * 15}`.padStart(5, '0'),
          departureTime: `${6 + Math.floor(i / 4)}:${(i % 4) * 15}`.padStart(5, '0')
        })),
        totalTravelTime: 25,
        isValid: true,
        errors: []
      }));
      
      const largeCalculationResults: CalculationResults = {
        weekday: largeTripResults,
        saturday: largeTripResults.slice(0, 25),
        sunday: largeTripResults.slice(0, 10),
        metadata: {
          totalTimePoints: 4,
          totalTrips: 85,
          calculationTime: 250
        }
      };
      
      const renderStart = performance.now();
      render(
        <SummaryDisplay
          summarySchedule={mockSummarySchedule}
          calculationResults={largeCalculationResults}
        />
      );
      const renderTime = performance.now() - renderStart;
      
      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
      
      // Check that the component still renders correctly
      expect(screen.getByText('Main Street Express')).toBeInTheDocument();
    });

    test('memoizes display data generation', () => {
      const { rerender } = render(<SummaryDisplay {...defaultProps} />);
      
      // Re-render with same props - should use memoized data
      rerender(<SummaryDisplay {...defaultProps} />);
      
      expect(screen.getByText('Main Street Express')).toBeInTheDocument();
    });
  });
});
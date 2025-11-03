import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import '@testing-library/jest-dom';
import Dashboard from './Dashboard';

const theme = createTheme();

const renderWithProviders = () => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Dashboard Component', () => {
  test('renders dashboard title and subtitle', () => {
    renderWithProviders();
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to the Bus Route Scheduler/)).toBeInTheDocument();
  });

  test('renders statistics cards', () => {
    renderWithProviders();
    
    expect(screen.getByText('Total Routes')).toBeInTheDocument();
    expect(screen.getByText('Active Schedules')).toBeInTheDocument();
    expect(screen.getByText('Time Points')).toBeInTheDocument();
    expect(screen.getByText('Files Processed')).toBeInTheDocument();
  });

  test('renders quick action cards', () => {
    renderWithProviders();
    
    expect(screen.getByText('Upload Schedule')).toBeInTheDocument();
    expect(screen.getByText('View Schedules')).toBeInTheDocument();
    expect(screen.getByText('Manage Routes')).toBeInTheDocument();
  });

  test('renders recent activity section', () => {
    renderWithProviders();
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity to display')).toBeInTheDocument();
  });

  test('all statistic values show 0 initially', () => {
    renderWithProviders();
    
    const zeroValues = screen.getAllByText('0');
    expect(zeroValues).toHaveLength(4); // Four statistics showing 0
  });
});
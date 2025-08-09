import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import '@testing-library/jest-dom';
import Navigation from './Navigation';
import useMediaQuery from '@mui/material/useMediaQuery';

// Mock useMediaQuery
jest.mock('@mui/material/useMediaQuery');
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<typeof useMediaQuery>;

const theme = createTheme();

const renderWithProviders = (initialEntries: string[] = ['/']) => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        <Navigation />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Navigation Component', () => {
  beforeEach(() => {
    // Default to desktop view
    mockUseMediaQuery.mockReturnValue(false);
  });

  test('renders application title', () => {
    renderWithProviders();
    expect(screen.getByText('Bus Route Scheduler')).toBeInTheDocument();
  });

  test('renders all navigation items on desktop', () => {
    renderWithProviders();
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Upload Schedule')).toBeInTheDocument();
    expect(screen.getByText('View Schedules')).toBeInTheDocument();
    expect(screen.getByText('Manage Routes')).toBeInTheDocument();
  });

  test('highlights active navigation item', () => {
    renderWithProviders(['/upload']);
    
    const uploadButton = screen.getByText('Upload Schedule').closest('button');
    expect(uploadButton).toHaveStyle({
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    });
  });

  test('shows mobile menu button on small screens', () => {
    // Mock mobile viewport
    mockUseMediaQuery.mockReturnValue(true);

    renderWithProviders();
    
    const menuButton = screen.getByLabelText('menu');
    expect(menuButton).toBeInTheDocument();
  });
});
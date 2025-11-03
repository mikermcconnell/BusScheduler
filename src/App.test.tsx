import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App from './App';

// Mock the pages to avoid complex component testing at this stage
jest.mock('./pages/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard">Dashboard Page</div>;
  };
});

jest.mock('./pages/UploadSchedule', () => {
  return function MockUploadSchedule() {
    return <div data-testid="upload">Upload Schedule Page</div>;
  };
});

jest.mock('./pages/ViewSchedules', () => {
  return function MockViewSchedules() {
    return <div data-testid="schedules">View Schedules Page</div>;
  };
});

jest.mock('./pages/ManageRoutes', () => {
  return function MockManageRoutes() {
    return <div data-testid="routes">Manage Routes Page</div>;
  };
});

jest.mock('./pages/NotFound', () => {
  return function MockNotFound() {
    return <div data-testid="not-found">Not Found Page</div>;
  };
});

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
  });

  test('displays application title in navigation', () => {
    render(<App />);
    expect(screen.getByText('Bus Route Scheduler')).toBeInTheDocument();
  });

  test('renders dashboard by default', () => {
    render(<App />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  test('renders footer', () => {
    render(<App />);
    expect(screen.getByText(/Bus Route Scheduler © 2024/)).toBeInTheDocument();
  });
});
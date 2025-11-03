import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Layout from './Layout';

// Mock the pages
jest.mock('../pages/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard">Dashboard Page</div>;
  };
});

jest.mock('../pages/NewSchedule', () => {
  return function MockNewSchedule() {
    return <div data-testid="new-schedule">New Schedule Page</div>;
  };
});

jest.mock('../pages/EditSchedule', () => {
  return function MockEditSchedule() {
    return <div data-testid="edit-schedule">Edit Schedule Page</div>;
  };
});

jest.mock('../pages/ViewSchedules', () => {
  return function MockViewSchedules() {
    return <div data-testid="schedules">View Schedules Page</div>;
  };
});

jest.mock('../pages/ManageRoutes', () => {
  return function MockManageRoutes() {
    return <div data-testid="routes">Manage Routes Page</div>;
  };
});

jest.mock('../pages/NotFound', () => {
  return function MockNotFound() {
    return <div data-testid="not-found">Not Found Page</div>;
  };
});

describe('Layout Component', () => {
  test('renders navigation and footer', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByText('Bus Route Scheduler')).toBeInTheDocument();
    expect(screen.getByText(/Bus Route Scheduler © 2024/)).toBeInTheDocument();
  });

  test('renders dashboard on root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  test('renders new schedule page on /new-schedule path', () => {
    render(
      <MemoryRouter initialEntries={['/new-schedule']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('new-schedule')).toBeInTheDocument();
  });

  test('renders edit schedule page on /edit-schedule path', () => {
    render(
      <MemoryRouter initialEntries={['/edit-schedule']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('edit-schedule')).toBeInTheDocument();
  });

  test('renders schedules page on /schedules path', () => {
    render(
      <MemoryRouter initialEntries={['/schedules']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('schedules')).toBeInTheDocument();
  });

  test('renders routes page on /routes path', () => {
    render(
      <MemoryRouter initialEntries={['/routes']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('routes')).toBeInTheDocument();
  });

  test('renders not found page on unknown path', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-path']}>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });
});

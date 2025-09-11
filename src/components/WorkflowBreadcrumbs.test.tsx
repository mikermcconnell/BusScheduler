/**
 * TDD Tests for Enhanced WorkflowBreadcrumbs Component
 * Tests progress tracking integration with StoryboardProgress patterns
 * RED PHASE: These tests should fail until implementation is complete
 */

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/timepoints',
  state: null
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock draftService
jest.mock('../services/draftService', () => ({
  draftService: {
    getCurrentWorkflow: jest.fn(),
    startWorkflow: jest.fn(),
    getStoryboardProgressMessage: jest.fn(),
    getStepTip: jest.fn(),
    getCurrentSessionDraftId: jest.fn(),
  }
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs';
import { draftService } from '../services/draftService';

const mockedDraftService = draftService as jest.Mocked<typeof draftService>;
const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

// Mock workflow with progress data
const createMockWorkflowWithProgress = (overallProgress: number) => ({
  draftId: 'test-draft-123',
  currentStep: 'timepoints',
  overallProgress,
  steps: [
    {
      key: 'upload',
      label: 'Load Data', 
      status: overallProgress >= 20 ? 'completed' : 'not-started',
      progress: overallProgress >= 20 ? 100 : 0,
    },
    {
      key: 'timepoints',
      label: 'Review Times',
      status: overallProgress >= 60 ? 'completed' : overallProgress >= 40 ? 'in-progress' : 'not-started',  
      progress: overallProgress >= 60 ? 100 : overallProgress >= 40 ? 75 : 0,
    },
    {
      key: 'block-config',
      label: 'Plan Blocks',
      status: overallProgress >= 80 ? 'completed' : overallProgress >= 60 ? 'in-progress' : 'not-started',
      progress: overallProgress >= 80 ? 100 : overallProgress >= 60 ? 60 : 0,
    }
  ]
});

describe('WorkflowBreadcrumbs TDD Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDraftService.getCurrentWorkflow.mockReturnValue(null);
    mockedDraftService.getStoryboardProgressMessage.mockReturnValue('Making great progress!');
    mockedDraftService.getStepTip.mockReturnValue('');
  });

  describe('Existing Functionality (Should Pass)', () => {
    test('renders standard breadcrumbs', () => {
      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={false} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Review Times')).toBeInTheDocument();
    });

    test('displays workflow context when detected', () => {
      render(
        <TestWrapper>
          <WorkflowBreadcrumbs />
        </TestWrapper>
      );

      expect(screen.getByText('Schedule Creation')).toBeInTheDocument();
    });

    test('shows workflow stepper when showWorkflow is true', () => {
      const mockWorkflow = createMockWorkflowWithProgress(50);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Load Data')).toBeInTheDocument();
      expect(screen.getByText('Review Times')).toBeInTheDocument();
    });
  });

  describe('New Progress Features (RED PHASE - Should Fail)', () => {
    test('RED: displays overall progress percentage', () => {
      const mockWorkflow = createMockWorkflowWithProgress(65);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - progress percentage display not implemented yet
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    test('RED: renders progress bar with correct value', () => {
      const mockWorkflow = createMockWorkflowWithProgress(75);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - progress bar not implemented yet
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });

    test('RED: shows progress message from draftService', () => {
      const mockWorkflow = createMockWorkflowWithProgress(40);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);
      mockedDraftService.getStoryboardProgressMessage.mockReturnValue('Keep it up! 40% complete');

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - progress message display not implemented yet
      expect(screen.getByText('Keep it up! 40% complete')).toBeInTheDocument();
    });

    test('RED: replaces old stepper with progress-focused design', () => {
      const mockWorkflow = createMockWorkflowWithProgress(55);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - new progress design not implemented yet
      expect(screen.getByText('Schedule Builder Progress')).toBeInTheDocument();
      expect(screen.queryByText('Workflow Progress')).not.toBeInTheDocument();
    });

    test('RED: displays progress bar with proper accessibility', () => {
      const mockWorkflow = createMockWorkflowWithProgress(80);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - accessible progress bar not implemented yet
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Schedule creation progress');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    test('RED: calls draftService.getStoryboardProgressMessage with correct progress', () => {
      const mockWorkflow = createMockWorkflowWithProgress(60);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - integration with getStoryboardProgressMessage not implemented yet
      expect(mockedDraftService.getStoryboardProgressMessage).toHaveBeenCalledWith(60);
    });

    test('RED: handles progress edge cases correctly', () => {
      const workflowZero = createMockWorkflowWithProgress(0);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(workflowZero);

      const { rerender } = render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - progress display not implemented yet
      expect(screen.getByText('0%')).toBeInTheDocument();

      const workflowComplete = createMockWorkflowWithProgress(100);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(workflowComplete);

      rerender(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('RED: displays step tips from draftService', () => {
      const mockWorkflow = createMockWorkflowWithProgress(45);
      mockedDraftService.getCurrentWorkflow.mockReturnValue(mockWorkflow);
      mockedDraftService.getStepTip.mockReturnValue('Try adjusting your time bands for better accuracy');

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      // This SHOULD FAIL - step tip display not implemented yet
      expect(screen.getByText(/Try adjusting your time bands/)).toBeInTheDocument();
    });
  });

  describe('Error Handling (Should Pass)', () => {
    test('handles missing workflow gracefully', () => {
      mockedDraftService.getCurrentWorkflow.mockReturnValue(null);

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    test('handles draftService errors gracefully', () => {
      mockedDraftService.getCurrentWorkflow.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      render(
        <TestWrapper>
          <WorkflowBreadcrumbs showWorkflow={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
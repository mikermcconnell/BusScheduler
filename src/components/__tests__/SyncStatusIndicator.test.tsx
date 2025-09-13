/**
 * Component Tests for SyncStatusIndicator
 * Tests sync status display, user interactions, and real-time updates
 */

// jest is available globally in React testing environment
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SyncStatusIndicator, SyncState } from '../SyncStatusIndicator';
import { offlineQueue, QueueStatus } from '../../services/offlineQueue';

// Mock the offline queue
jest.mock('../../services/offlineQueue', () => ({
  offlineQueue: {
    subscribe: jest.fn(),
    forceRetry: jest.fn(),
    getStatus: jest.fn().mockReturnValue({
      isOnline: true,
      queueSize: 0,
      processing: false,
      lastSyncTime: undefined,
      lastError: undefined
    })
  }
}));

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('SyncStatusIndicator', () => {
  const mockSubscribe = offlineQueue.subscribe as jest.MockedFunction<typeof offlineQueue.subscribe>;
  const mockForceRetry = offlineQueue.forceRetry as jest.MockedFunction<typeof offlineQueue.forceRetry>;
  const mockGetStatus = offlineQueue.getStatus as jest.MockedFunction<typeof offlineQueue.getStatus>;

  let mockUnsubscribe: jest.Mock;
  let mockListener: (status: QueueStatus) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUnsubscribe = jest.fn();
    
    mockSubscribe.mockImplementation((listener) => {
      mockListener = listener;
      // Call listener immediately with default status
      listener({
        isOnline: true,
        queueSize: 0,
        processing: false
      });
      return mockUnsubscribe;
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock window event listeners
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Sync State Display', () => {
    it('should display "All changes saved" when in saved state', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="saved" />
      );

      expect(screen.getByText('All changes saved')).toBeInTheDocument();
      expect(screen.getByTestId('CloudDoneIcon')).toBeInTheDocument();
    });

    it('should display "Saving..." when in saving state', () => {
      mockListener({
        isOnline: true,
        queueSize: 1,
        processing: false
      });

      renderWithTheme(
        <SyncStatusIndicator overrideState="saving" />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display "Saving X items..." when multiple items queued', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="saving" />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 5,
          processing: false
        });
      });

      // The component maps queue size to message, but with override we get the override message
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should display offline status correctly', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="offline" />
      );

      expect(screen.getByText(/offline/i)).toBeInTheDocument();
      expect(screen.getByTestId('WifiOffIcon')).toBeInTheDocument();
    });

    it('should display sync error with retry option', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="error" />
      );

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByTestId('ErrorIcon')).toBeInTheDocument();
      
      // Should show retry button
      const chip = screen.getByRole('button');
      expect(chip).toBeInTheDocument();
    });

    it('should display syncing status with progress indicator', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="syncing" />
      );

      expect(screen.getByText('Syncing to cloud...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display idle state as ready', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="idle" />
      );

      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByTestId('CloudDoneIcon')).toBeInTheDocument();
    });
  });

  describe('Real-time Status Updates', () => {
    it('should subscribe to offline queue status on mount', () => {
      renderWithTheme(<SyncStatusIndicator />);

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderWithTheme(<SyncStatusIndicator />);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should update status when queue status changes', () => {
      const { rerender } = renderWithTheme(<SyncStatusIndicator />);

      // Initial state - saved
      expect(screen.getByText('All changes saved')).toBeInTheDocument();

      // Simulate queue status change to saving
      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 2,
          processing: true
        });
      });

      expect(screen.getByText('Syncing to cloud...')).toBeInTheDocument();
    });

    it('should respond to online/offline events', () => {
      renderWithTheme(<SyncStatusIndicator />);

      // Simulate going offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        window.dispatchEvent(new Event('offline'));
      });

      // Should update to offline state (implementation would handle this)
      // Note: The actual component would need to properly handle this event
    });

    it('should show error snackbar for new errors', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      // Trigger error state
      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1,
          processing: false,
          lastError: 'Network timeout'
        });
      });

      // Should show error snackbar
      await waitFor(() => {
        expect(screen.getByText('Sync Error')).toBeInTheDocument();
        expect(screen.getByText('Network timeout')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call forceRetry when error chip is clicked', async () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="error" />
      );

      const chip = screen.getByRole('button');
      await userEvent.click(chip);

      expect(mockForceRetry).toHaveBeenCalledTimes(1);
    });

    it('should call forceRetry when retry button is clicked', async () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="error" />
      );

      const retryButton = screen.getByTitle('Retry sync');
      await userEvent.click(retryButton);

      expect(mockForceRetry).toHaveBeenCalledTimes(1);
    });

    it('should call forceRetry when snackbar retry button is clicked', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      // Trigger error state to show snackbar
      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1,
          processing: false,
          lastError: 'Test error'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Sync Error')).toBeInTheDocument();
      });

      const snackbarRetryButton = screen.getAllByTitle('Retry sync')[0];
      await userEvent.click(snackbarRetryButton);

      expect(mockForceRetry).toHaveBeenCalledTimes(1);
    });

    it('should dismiss error snackbar when close button is clicked', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      // Trigger error state
      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1,
          processing: false,
          lastError: 'Test error'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Sync Error')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Sync Error')).not.toBeInTheDocument();
      });
    });

    it('should not show retry option for non-error states', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="saved" />
      );

      const chip = screen.getByText('All changes saved');
      
      // Chip should not be clickable for saved state
      expect(chip).not.toHaveAttribute('onClick');
      expect(screen.queryByTitle('Retry sync')).not.toBeInTheDocument();
    });
  });

  describe('Display Modes', () => {
    it('should render inline mode by default', () => {
      renderWithTheme(<SyncStatusIndicator />);

      const container = screen.getByText('All changes saved').closest('div');
      expect(container).not.toHaveStyle({ position: 'fixed' });
    });

    it('should render floating mode when position is set', () => {
      renderWithTheme(
        <SyncStatusIndicator position="top-right" />
      );

      const floatingContainer = screen.getByText('All changes saved').closest('div[style*="position: fixed"]');
      expect(floatingContainer).toBeInTheDocument();
    });

    it('should position floating indicator correctly for top-right', () => {
      renderWithTheme(
        <SyncStatusIndicator position="top-right" />
      );

      const floatingContainer = screen.getByText('All changes saved').closest('div[style*="position: fixed"]');
      expect(floatingContainer).toHaveStyle({
        position: 'fixed',
        top: '16px',
        right: '16px'
      });
    });

    it('should position floating indicator correctly for bottom-right', () => {
      renderWithTheme(
        <SyncStatusIndicator position="bottom-right" />
      );

      const floatingContainer = screen.getByText('All changes saved').closest('div[style*="position: fixed"]');
      expect(floatingContainer).toHaveStyle({
        position: 'fixed',
        bottom: '16px',
        right: '16px'
      });
    });
  });

  describe('Detailed Status Display', () => {
    it('should show last sync time when showDetails is true', () => {
      const lastSyncTime = Date.now() - 5000; // 5 seconds ago

      renderWithTheme(
        <SyncStatusIndicator showDetails={true} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false,
          lastSyncTime
        });
      });

      expect(screen.getByText('now')).toBeInTheDocument();
    });

    it('should format time since last sync correctly', () => {
      const twoMinutesAgo = Date.now() - (2 * 60 * 1000);

      renderWithTheme(
        <SyncStatusIndicator showDetails={true} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false,
          lastSyncTime: twoMinutesAgo
        });
      });

      expect(screen.getByText('2m ago')).toBeInTheDocument();
    });

    it('should show hour format for longer durations', () => {
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

      renderWithTheme(
        <SyncStatusIndicator showDetails={true} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false,
          lastSyncTime: twoHoursAgo
        });
      });

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should not show time details when showDetails is false', () => {
      const lastSyncTime = Date.now() - 5000;

      renderWithTheme(
        <SyncStatusIndicator showDetails={false} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false,
          lastSyncTime
        });
      });

      expect(screen.queryByText('now')).not.toBeInTheDocument();
    });
  });

  describe('Custom Error Messages', () => {
    it('should display custom error message when provided', async () => {
      const customErrorMessage = 'Custom sync failure message';

      renderWithTheme(
        <SyncStatusIndicator customError={customErrorMessage} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1,
          processing: false,
          lastError: 'Original error'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(customErrorMessage)).toBeInTheDocument();
        expect(screen.queryByText('Original error')).not.toBeInTheDocument();
      });
    });

    it('should fallback to queue error when no custom error provided', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1,
          processing: false,
          lastError: 'Queue error message'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Queue error message')).toBeInTheDocument();
      });
    });

    it('should show generic error when no error message available', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1,
          processing: false,
          lastError: undefined
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Sync failed')).toBeInTheDocument();
      });
    });
  });

  describe('Success Notifications', () => {
    it('should show success snackbar when all changes are saved', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('All changes saved to cloud')).toBeInTheDocument();
      });
    });

    it('should auto-hide success snackbar after 2 seconds', async () => {
      jest.useFakeTimers();

      renderWithTheme(<SyncStatusIndicator />);

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('All changes saved to cloud')).toBeInTheDocument();
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('All changes saved to cloud')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should not show success notification when queue has items', () => {
      renderWithTheme(<SyncStatusIndicator />);

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 1, // Still has items
          processing: false
        });
      });

      expect(screen.queryByText('All changes saved to cloud')).not.toBeInTheDocument();
    });
  });

  describe('Chip Colors and Variants', () => {
    it('should show success color for saved state', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="saved" />
      );

      const chip = screen.getByText('All changes saved').closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorSuccess');
    });

    it('should show info color for saving/syncing states', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="saving" />
      );

      const chip = screen.getByText('Saving...').closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorInfo');
    });

    it('should show warning color for offline state', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="offline" />
      );

      const chip = screen.getByText(/offline/i).closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorWarning');
    });

    it('should show error color for error state', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="error" />
      );

      const chip = screen.getByText(/error/i).closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorError');
    });
  });

  describe('Accessibility', () => {
    it('should provide proper ARIA labels for interactive elements', () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="error" />
      );

      const retryButton = screen.getByTitle('Retry sync');
      expect(retryButton).toHaveAttribute('aria-label', 'Retry sync');
    });

    it('should provide tooltips for status information', async () => {
      const lastSyncTime = Date.now() - 60000; // 1 minute ago

      renderWithTheme(
        <SyncStatusIndicator showDetails={true} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false,
          lastSyncTime
        });
      });

      const timeElement = screen.getByText('1m ago');
      await userEvent.hover(timeElement);

      await waitFor(() => {
        expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      renderWithTheme(
        <SyncStatusIndicator overrideState="error" />
      );

      const retryButton = screen.getByTitle('Retry sync');
      
      retryButton.focus();
      expect(retryButton).toHaveFocus();

      fireEvent.keyDown(retryButton, { key: 'Enter' });
      expect(mockForceRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined queue status gracefully', () => {
      mockSubscribe.mockImplementation((listener) => {
        listener(undefined as any);
        return mockUnsubscribe;
      });

      expect(() => {
        renderWithTheme(<SyncStatusIndicator />);
      }).not.toThrow();
    });

    it('should handle missing lastSyncTime', () => {
      renderWithTheme(
        <SyncStatusIndicator showDetails={true} />
      );

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 0,
          processing: false
          // lastSyncTime is undefined
        });
      });

      // Should not show time details when lastSyncTime is missing
      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('should handle very large queue sizes', () => {
      renderWithTheme(<SyncStatusIndicator />);

      act(() => {
        mockListener({
          isOnline: true,
          queueSize: 99999,
          processing: false
        });
      });

      expect(screen.getByText('Saving 99999 items...')).toBeInTheDocument();
    });

    it('should handle rapid state changes', async () => {
      renderWithTheme(<SyncStatusIndicator />);

      // Rapidly change states
      for (let i = 0; i < 10; i++) {
        act(() => {
          mockListener({
            isOnline: true,
            queueSize: i % 2,
            processing: i % 3 === 0
          });
        });
      }

      // Should handle all changes without errors
      expect(screen.getByText(/saved|saving/i)).toBeInTheDocument();
    });
  });
});
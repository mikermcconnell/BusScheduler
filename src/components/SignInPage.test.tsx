/**
 * SignInPage Component Tests - Magic Link Functionality
 * Test coverage for passwordless email authentication
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SignInPage from './SignInPage';
import { useAuth } from '../contexts/AuthContext';
import { magicLinkAuth } from '../services/magicLinkAuth';

// Mock dependencies
jest.mock('../contexts/AuthContext');
jest.mock('../services/magicLinkAuth');

// Mock CheckEmailPage component
jest.mock('./CheckEmailPage', () => ({
  __esModule: true,
  default: ({ email, onBack, onResend }: any) => (
    <div data-testid="check-email-page">
      <p>Check your email: {email}</p>
      <button onClick={onBack}>Back</button>
      <button onClick={onResend}>Resend</button>
    </div>
  )
}));

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('SignInPage - Magic Link Authentication', () => {
  const mockSignIn = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      isSignedIn: false,
      isLoading: false
    });
    
    (magicLinkAuth.isValidEmail as jest.Mock).mockImplementation(
      (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
  });

  describe('UI Layout and Elements', () => {
    test('should render sign in page with correct elements', () => {
      renderWithRouter(<SignInPage />);
      
      expect(screen.getByText('Scheduler2')).toBeInTheDocument();
      expect(screen.getByText('Professional Bus Route Scheduling')).toBeInTheDocument();
      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByText('Sign in to access your schedules')).toBeInTheDocument();
    });

    test('should display authentication method toggle buttons', () => {
      renderWithRouter(<SignInPage />);
      
      expect(screen.getByRole('button', { name: /email sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /google sign in/i })).toBeInTheDocument();
    });

    test('should show email sign-in form by default', () => {
      renderWithRouter(<SignInPage />);
      
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Magic Link/i })).toBeInTheDocument();
      expect(screen.getByText(/No password needed!/i)).toBeInTheDocument();
    });

    test('should switch between email and Google sign-in methods', () => {
      renderWithRouter(<SignInPage />);
      
      // Initially shows email sign-in
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      
      // Click Google toggle
      const googleToggle = screen.getByRole('button', { name: /google sign in/i });
      fireEvent.click(googleToggle);
      
      // Should show Google sign-in button
      expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Email Address/i)).not.toBeInTheDocument();
      
      // Click Email toggle to go back
      const emailToggle = screen.getByRole('button', { name: /email sign in/i });
      fireEvent.click(emailToggle);
      
      // Should show email form again
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    });
  });

  describe('Email Validation', () => {
    test('should show error for empty email', async () => {
      renderWithRouter(<SignInPage />);
      
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
      });
      
      expect(magicLinkAuth.sendMagicLink).not.toHaveBeenCalled();
    });

    test('should show error for invalid email format', async () => {
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
      
      expect(magicLinkAuth.sendMagicLink).not.toHaveBeenCalled();
    });

    test('should accept valid email formats', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent!'
      });
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(magicLinkAuth.sendMagicLink).toHaveBeenCalledWith('test@example.com');
      });
    });
  });

  describe('Magic Link Sending', () => {
    test('should send magic link successfully', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent!'
      });
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(magicLinkAuth.sendMagicLink).toHaveBeenCalledWith('test@example.com');
        expect(screen.getByTestId('check-email-page')).toBeInTheDocument();
        expect(screen.getByText('Check your email: test@example.com')).toBeInTheDocument();
      });
    });

    test('should show loading state while sending', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(sendButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByTestId('check-email-page')).toBeInTheDocument();
      });
    });

    test('should handle send errors', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to send magic link. Network error.'
      });
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to send magic link. Network error.')).toBeInTheDocument();
      });
      
      expect(screen.queryByTestId('check-email-page')).not.toBeInTheDocument();
    });

    test('should handle rate limiting errors', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Too many attempts. Please try again in 5 minutes.'
      });
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again in 5 minutes.')).toBeInTheDocument();
      });
    });

    test('should handle unexpected errors gracefully', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockRejectedValue(new Error('Unexpected error'));
      
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Keyboard Interactions', () => {
    test('should submit form on Enter key press', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent!'
      });
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.keyPress(emailInput, { key: 'Enter', code: 13, charCode: 13 });
      
      await waitFor(() => {
        expect(magicLinkAuth.sendMagicLink).toHaveBeenCalledWith('test@example.com');
      });
    });

    test('should not submit when Enter pressed and already sending', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      // Try to press Enter while sending
      fireEvent.keyPress(emailInput, { key: 'Enter', code: 13, charCode: 13 });
      
      // Should only be called once
      expect(magicLinkAuth.sendMagicLink).toHaveBeenCalledTimes(1);
    });
  });

  describe('CheckEmailPage Integration', () => {
    test('should navigate back from CheckEmailPage', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent!'
      });
      
      renderWithRouter(<SignInPage />);
      
      // Send magic link
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('check-email-page')).toBeInTheDocument();
      });
      
      // Click back button
      const backButton = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backButton);
      
      // Should return to sign in form with cleared email
      expect(screen.queryByTestId('check-email-page')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toHaveValue('');
    });

    test('should handle resend from CheckEmailPage', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock)
        .mockResolvedValueOnce({ success: true, message: 'First send' })
        .mockResolvedValueOnce({ success: true, message: 'Resent' });
      
      renderWithRouter(<SignInPage />);
      
      // Send initial magic link
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('check-email-page')).toBeInTheDocument();
      });
      
      // Click resend button
      const resendButton = screen.getByRole('button', { name: /Resend/i });
      fireEvent.click(resendButton);
      
      await waitFor(() => {
        expect(magicLinkAuth.sendMagicLink).toHaveBeenCalledTimes(2);
        expect(magicLinkAuth.sendMagicLink).toHaveBeenLastCalledWith('test@example.com');
      });
    });
  });

  describe('Error State Management', () => {
    test('should clear error when switching auth methods', async () => {
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Test error'
      });
      
      renderWithRouter(<SignInPage />);
      
      // Trigger error
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });
      
      // Switch to Google auth
      const googleToggle = screen.getByRole('button', { name: /google sign in/i });
      fireEvent.click(googleToggle);
      
      // Error should be cleared
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });

    test('should clear error when typing in email field', async () => {
      renderWithRouter(<SignInPage />);
      
      // Trigger validation error
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
      });
      
      // Start typing in email field
      const emailInput = screen.getByLabelText(/Email Address/i);
      await userEvent.type(emailInput, 't');
      
      // Error should be cleared
      expect(screen.queryByText('Please enter your email address')).not.toBeInTheDocument();
    });
  });

  describe('Production Environment', () => {
    test('should work correctly in production environment', async () => {
      // Set production environment
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = 'https://bus-scheduler-teal.vercel.app';
      
      (magicLinkAuth.sendMagicLink as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent!'
      });
      
      renderWithRouter(<SignInPage />);
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const sendButton = screen.getByRole('button', { name: /Send Magic Link/i });
      
      await userEvent.type(emailInput, 'user@example.com');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(magicLinkAuth.sendMagicLink).toHaveBeenCalledWith('user@example.com');
        expect(screen.getByTestId('check-email-page')).toBeInTheDocument();
      });
    });
  });
});
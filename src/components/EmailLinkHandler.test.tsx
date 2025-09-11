/**
 * EmailLinkHandler Component Tests
 * Test coverage for magic link authentication handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import EmailLinkHandler from './EmailLinkHandler';
import { magicLinkAuth } from '../services/magicLinkAuth';

// Mock React Router
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/auth/email-link',
  search: '?mode=signIn&oobCode=test123',
  state: null
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation
}));

// Mock MagicLinkAuth service
jest.mock('../services/magicLinkAuth', () => ({
  magicLinkAuth: {
    isEmailLink: jest.fn(),
    completeMagicLinkSignIn: jest.fn(),
    setEmailForSignIn: jest.fn(),
    isValidEmail: jest.fn()
  }
}));

// Helper function to render component with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('EmailLinkHandler Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    (magicLinkAuth.isEmailLink as jest.Mock).mockReturnValue(true);
    (magicLinkAuth.isValidEmail as jest.Mock).mockImplementation(
      (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
  });

  describe('Initial Processing', () => {
    test('should show processing state initially', () => {
      renderWithRouter(<EmailLinkHandler />);
      
      expect(screen.getByText('Completing Sign In...')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we verify your sign-in link')).toBeInTheDocument();
    });

    test('should check if URL is valid email link', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Successfully signed in'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(magicLinkAuth.isEmailLink).toHaveBeenCalledWith(
          expect.stringContaining('/auth/email-link')
        );
      });
    });
  });

  describe('Successful Sign In', () => {
    test('should show success message and redirect to dashboard', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Successfully signed in as test@example.com'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Successful!')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/successfully signed in/i)).toBeInTheDocument();
      expect(screen.getByText(/Redirecting to your dashboard/i)).toBeInTheDocument();
      
      // Wait for redirect timeout
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      }, { timeout: 3000 });
    });
  });

  describe('Invalid Link Handling', () => {
    test('should show error for invalid sign-in link', async () => {
      (magicLinkAuth.isEmailLink as jest.Mock).mockReturnValue(false);
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/not a valid sign-in link/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Back to Sign In/i })).toBeInTheDocument();
    });

    test('should navigate back to home when clicking back button', async () => {
      (magicLinkAuth.isEmailLink as jest.Mock).mockReturnValue(false);
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      });
      
      const backButton = screen.getByRole('button', { name: /Back to Sign In/i });
      fireEvent.click(backButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  describe('Email Required Flow', () => {
    test('should prompt for email when not in localStorage', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'email_required',
        message: 'Please enter your email to complete sign-in.'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Confirm Your Email')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/enter the email address you used/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Complete Sign In/i })).toBeInTheDocument();
    });

    test('should validate email format before submission', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'email_required',
        message: 'Please enter your email to complete sign-in.'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Confirm Your Email')).toBeInTheDocument();
      });
      
      const submitButton = screen.getByRole('button', { name: /Complete Sign In/i });
      
      // Test empty email
      fireEvent.click(submitButton);
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
      
      // Test invalid email
      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);
      
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    test('should complete sign-in with provided email', async () => {
      // First call returns email_required
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock)
        .mockResolvedValueOnce({
          success: false,
          error: 'email_required',
          message: 'Please enter your email to complete sign-in.'
        })
        // Second call after email provided succeeds
        .mockResolvedValueOnce({
          success: true,
          message: 'Successfully signed in as test@example.com'
        });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Confirm Your Email')).toBeInTheDocument();
      });
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      const submitButton = screen.getByRole('button', { name: /Complete Sign In/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(magicLinkAuth.setEmailForSignIn).toHaveBeenCalledWith('test@example.com');
        expect(magicLinkAuth.completeMagicLinkSignIn).toHaveBeenCalledTimes(2);
      });
      
      // Should show success message
      expect(screen.getByText('Sign In Successful!')).toBeInTheDocument();
      
      // Should redirect to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      }, { timeout: 3000 });
    });

    test('should handle Enter key press in email input', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock)
        .mockResolvedValueOnce({
          success: false,
          error: 'email_required',
          message: 'Please enter your email to complete sign-in.'
        })
        .mockResolvedValueOnce({
          success: true,
          message: 'Successfully signed in'
        });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Confirm Your Email')).toBeInTheDocument();
      });
      
      const emailInput = screen.getByLabelText(/Email Address/i);
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.keyPress(emailInput, { key: 'Enter', code: 13, charCode: 13 });
      
      await waitFor(() => {
        expect(magicLinkAuth.setEmailForSignIn).toHaveBeenCalledWith('test@example.com');
      });
    });
  });

  describe('Error Handling', () => {
    test('should display expired link error', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'This sign-in link has expired. Please request a new one.'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/This sign-in link has expired/i)).toBeInTheDocument();
      expect(screen.getByText(/links are valid for 24 hours/i)).toBeInTheDocument();
    });

    test('should display already used link error', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'This sign-in link is invalid or has already been used.'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/invalid or has already been used/i)).toBeInTheDocument();
      expect(screen.getByText(/link may have already been used/i)).toBeInTheDocument();
    });

    test('should display common issues list', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Generic error'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Common issues:')).toBeInTheDocument();
      expect(screen.getByText(/link may have expired/i)).toBeInTheDocument();
      expect(screen.getByText(/different browser or device/i)).toBeInTheDocument();
    });

    test('should handle network errors gracefully', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      
      // Prevent console.error from cluttering test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Failed')).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Production Domain Testing', () => {
    beforeEach(() => {
      // Simulate production environment
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://bus-scheduler-teal.vercel.app/auth/email-link?mode=signIn&oobCode=prod123',
          origin: 'https://bus-scheduler-teal.vercel.app',
          pathname: '/auth/email-link'
        },
        writable: true
      });
    });

    test('should handle production domain correctly', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Successfully signed in'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(magicLinkAuth.isEmailLink).toHaveBeenCalledWith(
          'https://bus-scheduler-teal.vercel.app/auth/email-link?mode=signIn&oobCode=prod123'
        );
      });
      
      expect(magicLinkAuth.completeMagicLinkSignIn).toHaveBeenCalledWith(
        'https://bus-scheduler-teal.vercel.app/auth/email-link?mode=signIn&oobCode=prod123'
      );
    });

    test('should complete sign-in flow on production domain', async () => {
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Successfully signed in as user@example.com'
      });
      
      renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign In Successful!')).toBeInTheDocument();
      });
      
      // Should redirect to dashboard on production
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      }, { timeout: 3000 });
    });
  });

  describe('UI Elements and Styling', () => {
    test('should display correct icons for different states', async () => {
      // Test success icon
      (magicLinkAuth.completeMagicLinkSignIn as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Success'
      });
      
      const { rerender } = renderWithRouter(<EmailLinkHandler />);
      
      await waitFor(() => {
        const successIcon = document.querySelector('[data-testid="CheckCircleIcon"]');
        expect(successIcon).toBeInTheDocument();
      });
      
      // Test error icon
      jest.clearAllMocks();
      (magicLinkAuth.isEmailLink as jest.Mock).mockReturnValue(false);
      
      rerender(<EmailLinkHandler />);
      
      await waitFor(() => {
        const errorIcon = document.querySelector('[data-testid="ErrorIcon"]');
        expect(errorIcon).toBeInTheDocument();
      });
    });

    test('should have gradient background', () => {
      renderWithRouter(<EmailLinkHandler />);
      
      const container = screen.getByText('Completing Sign In...').closest('div');
      // Check for gradient background style class
      expect(container?.parentElement?.parentElement).toHaveStyle({
        background: expect.stringContaining('gradient')
      });
    });
  });
});
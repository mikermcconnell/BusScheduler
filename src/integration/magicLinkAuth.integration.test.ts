/**
 * Magic Link Authentication Integration Tests
 * End-to-end testing of the complete authentication flow
 */

import MagicLinkAuthService from '../services/magicLinkAuth';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  Auth,
  User,
  UserCredential
} from 'firebase/auth';

// Mock Firebase app first
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({}))
}));

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  connectFirestoreEmulator: jest.fn()
}));

// Mock Firebase Functions
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  connectFunctionsEmulator: jest.fn()
}));

// Mock Firebase Analytics
jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(() => null)
}));

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: jest.fn(),
  isSignInWithEmailLink: jest.fn(),
  signInWithEmailLink: jest.fn(),
  getAuth: jest.fn(() => ({
    config: {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com'
    }
  })),
  connectAuthEmulator: jest.fn()
}));

// Mock Firebase config
jest.mock('../config/firebase', () => ({
  auth: {
    config: {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com'
    }
  },
  db: {},
  functions: {},
  analytics: null,
  default: {}
}));

// Test environment configurations
const ENVIRONMENTS = {
  localhost: {
    domain: 'http://localhost:3000',
    expectedUrl: 'http://localhost:3000/auth/email-link'
  },
  production: {
    domain: 'https://bus-scheduler-teal.vercel.app',
    expectedUrl: 'https://bus-scheduler-teal.vercel.app/auth/email-link'
  }
};

describe('Magic Link Authentication - Integration Tests', () => {
  let service: MagicLinkAuthService;
  let mockAuth: Auth;
  const testEmail = 'integration-test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Create mock auth object
    mockAuth = {
      config: {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com'
      }
    } as Auth;
    
    service = new MagicLinkAuthService(mockAuth);
  });

  describe('Complete Authentication Flow', () => {
    test('should complete full authentication cycle', async () => {
      const mockUser: User = {
        email: testEmail,
        uid: 'test-uid-123',
        emailVerified: true
      } as User;
      
      const mockUserCredential: UserCredential = {
        user: mockUser,
        providerId: 'email',
        operationType: 'signIn'
      } as UserCredential;

      // Step 1: Send magic link
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const sendResult = await service.sendMagicLink(testEmail);
      
      expect(sendResult.success).toBe(true);
      expect(sendResult.message).toContain('Magic link sent');
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBe(testEmail);
      
      // Verify action code settings
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        testEmail,
        expect.objectContaining({
          url: expect.stringContaining('/auth/email-link'),
          handleCodeInApp: true
        })
      );

      // Step 2: Simulate clicking the email link
      const emailLinkUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test123&apiKey=test';
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      (signInWithEmailLink as jest.Mock).mockResolvedValue(mockUserCredential);
      
      // Step 3: Complete sign-in
      const completeResult = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.message).toBe(`Successfully signed in as ${testEmail}`);
      
      // Verify email was cleared from localStorage
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
      expect(localStorage.getItem('scheduler2_signInTimestamp')).toBeNull();
      
      // Verify Firebase sign-in was called correctly
      expect(signInWithEmailLink).toHaveBeenCalledWith(
        mockAuth,
        testEmail,
        emailLinkUrl
      );
    });

    test('should handle flow when email not in localStorage', async () => {
      const emailLinkUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test123';
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      
      // Step 1: Try to complete sign-in without stored email
      const result1 = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('email_required');
      expect(result1.message).toBe('Please enter your email to complete sign-in.');
      
      // Step 2: Set email and retry
      service.setEmailForSignIn(testEmail);
      
      const mockUserCredential: UserCredential = {
        user: { email: testEmail, uid: 'test-uid' } as User,
        providerId: 'email',
        operationType: 'signIn'
      } as UserCredential;
      
      (signInWithEmailLink as jest.Mock).mockResolvedValue(mockUserCredential);
      
      const result2 = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(result2.success).toBe(true);
      expect(result2.message).toBe(`Successfully signed in as ${testEmail}`);
    });
  });

  describe('Production Domain Configuration', () => {
    test('should use production domain for Vercel deployment', async () => {
      // Set production environment
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = ENVIRONMENTS.production.domain;
      
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.sendMagicLink(testEmail);
      
      expect(result.success).toBe(true);
      
      // Verify production URL was used
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        testEmail,
        expect.objectContaining({
          url: ENVIRONMENTS.production.expectedUrl,
          handleCodeInApp: true
        })
      );
    });

    test('should handle production email link correctly', async () => {
      const productionEmailLink = 'https://bus-scheduler-teal.vercel.app/auth/email-link?mode=signIn&oobCode=prod123';
      
      localStorage.setItem('scheduler2_emailForSignIn', testEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      (signInWithEmailLink as jest.Mock).mockResolvedValue({
        user: { email: testEmail, uid: 'prod-user-123' } as User,
        providerId: 'email',
        operationType: 'signIn'
      } as UserCredential);
      
      const result = await service.completeMagicLinkSignIn(productionEmailLink);
      
      expect(result.success).toBe(true);
      expect(signInWithEmailLink).toHaveBeenCalledWith(
        mockAuth,
        testEmail,
        productionEmailLink
      );
    });

    test('should fallback to window.location.origin in production', async () => {
      // Clear environment variable
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = '';
      
      // Mock window.location for production
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'https://bus-scheduler-teal.vercel.app',
          href: 'https://bus-scheduler-teal.vercel.app'
        },
        writable: true
      });
      
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.sendMagicLink(testEmail);
      
      expect(result.success).toBe(true);
      
      // Should use window.location.origin as fallback
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        testEmail,
        expect.objectContaining({
          url: 'https://bus-scheduler-teal.vercel.app/auth/email-link',
          handleCodeInApp: true
        })
      );
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle expired link gracefully', async () => {
      const emailLinkUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=expired';
      
      // Set email with old timestamp (25 hours ago)
      localStorage.setItem('scheduler2_emailForSignIn', testEmail);
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000);
      localStorage.setItem('scheduler2_signInTimestamp', oldTimestamp.toString());
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      
      const result = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This sign-in link has expired. Please request a new one.');
      
      // Should clear stored data
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
    });

    test('should handle already used link', async () => {
      const emailLinkUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=used';
      
      localStorage.setItem('scheduler2_emailForSignIn', testEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      (signInWithEmailLink as jest.Mock).mockRejectedValue({
        code: 'auth/invalid-action-code',
        message: 'The action code is invalid.'
      });
      
      const result = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This sign-in link is invalid or has already been used.');
    });

    test('should handle network failures during send', async () => {
      (sendSignInLinkToEmail as jest.Mock).mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Network error'
      });
      
      const result = await service.sendMagicLink(testEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should handle network failures during completion', async () => {
      const emailLinkUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test';
      
      localStorage.setItem('scheduler2_emailForSignIn', testEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      (signInWithEmailLink as jest.Mock).mockRejectedValue(new Error('Network timeout'));
      
      const result = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to complete sign-in. Please try again.');
      
      // Should still clear stored email on error
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
    });
  });

  describe('Rate Limiting Integration', () => {
    test('should enforce rate limiting across multiple requests', async () => {
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      // First request should succeed
      const result1 = await service.sendMagicLink(testEmail);
      expect(result1.success).toBe(true);
      
      // Immediate second request should be rate limited
      const result2 = await service.sendMagicLink(testEmail);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Please wait');
      
      // Clear rate limit
      service.clearRateLimit(testEmail);
      
      // Should be able to send again after clearing
      const result3 = await service.sendMagicLink(testEmail);
      expect(result3.success).toBe(true);
    });

    test('should track attempts across different emails independently', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      // Send to first email
      const result1 = await service.sendMagicLink(email1);
      expect(result1.success).toBe(true);
      
      // Send to second email should work (different email)
      const result2 = await service.sendMagicLink(email2);
      expect(result2.success).toBe(true);
      
      // Second attempt to first email should be rate limited
      const result3 = await service.sendMagicLink(email1);
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Please wait');
      
      // Second email should still be rate limited for itself
      const result4 = await service.sendMagicLink(email2);
      expect(result4.success).toBe(false);
      expect(result4.error).toContain('Please wait');
    });
  });

  describe('Security Validations', () => {
    test('should reject malformed email links', async () => {
      const malformedLink = 'http://evil-site.com/fake-auth';
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(false);
      
      const result = await service.completeMagicLinkSignIn(malformedLink);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired sign-in link.');
      expect(signInWithEmailLink).not.toHaveBeenCalled();
    });

    test('should validate email format strictly', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example'
      ];
      
      let invalidCount = 0;
      for (const email of invalidEmails) {
        const result = await service.sendMagicLink(email);
        if (!result.success && result.error === 'Please enter a valid email address') {
          invalidCount++;
        }
      }
      
      // All invalid emails should be rejected
      expect(invalidCount).toBe(invalidEmails.length);
      
      // Firebase sendSignInLinkToEmail should not have been called for invalid emails
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    test('should handle disabled user accounts', async () => {
      const emailLinkUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test';
      
      localStorage.setItem('scheduler2_emailForSignIn', testEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      (signInWithEmailLink as jest.Mock).mockRejectedValue({
        code: 'auth/user-disabled',
        message: 'User account is disabled'
      });
      
      const result = await service.completeMagicLinkSignIn(emailLinkUrl);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This account has been disabled. Please contact support.');
    });
  });

  describe('Firebase Configuration Validation', () => {
    test('should detect missing Firebase configuration', async () => {
      // Create service with incomplete auth config
      const incompleteAuth = {
        config: {
          apiKey: '',
          authDomain: ''
        }
      } as Auth;
      
      const serviceWithBadConfig = new MagicLinkAuthService(incompleteAuth);
      
      (sendSignInLinkToEmail as jest.Mock).mockRejectedValue({
        code: 'auth/invalid-api-key',
        message: 'Invalid API key'
      });
      
      const result = await serviceWithBadConfig.sendMagicLink(testEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send magic link. Please try again.');
    });

    test('should handle unauthorized domain error for production', async () => {
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = 'https://unauthorized-domain.com';
      
      (sendSignInLinkToEmail as jest.Mock).mockRejectedValue({
        code: 'auth/unauthorized-domain',
        message: 'Domain not authorized'
      });
      
      const result = await service.sendMagicLink(testEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This domain is not authorized for email sign-in.');
    });
  });
});
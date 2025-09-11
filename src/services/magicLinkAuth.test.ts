/**
 * Magic Link Authentication Service Tests
 * Comprehensive test coverage for passwordless authentication
 */

import MagicLinkAuthService, { MagicLinkResult, RateLimitData } from './magicLinkAuth';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  Auth,
  AuthError,
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

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test123',
  origin: 'http://localhost:3000',
  pathname: '/auth/email-link'
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Mock window.history
const mockHistory = {
  replaceState: jest.fn()
};

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true
});

describe('MagicLinkAuthService', () => {
  let service: MagicLinkAuthService;
  let mockAuth: Auth;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    localStorage.clear();
    
    // Reset window.location
    window.location.href = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test123';
    
    // Create mock auth object
    mockAuth = {
      config: {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com'
      }
    } as Auth;
    
    // Create service instance
    service = new MagicLinkAuthService(mockAuth);
    
    // Reset environment variables
    process.env.REACT_APP_MAGIC_LINK_DOMAIN = '';
  });

  describe('Email Validation', () => {
    test('should validate correct email formats', () => {
      expect(service.isValidEmail('test@example.com')).toBe(true);
      expect(service.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(service.isValidEmail('user+tag@example.org')).toBe(true);
    });

    test('should reject invalid email formats', () => {
      expect(service.isValidEmail('invalid')).toBe(false);
      expect(service.isValidEmail('no@domain')).toBe(false);
      expect(service.isValidEmail('@domain.com')).toBe(false);
      expect(service.isValidEmail('user@')).toBe(false);
      expect(service.isValidEmail('user @domain.com')).toBe(false);
      expect(service.isValidEmail('')).toBe(false);
    });
  });

  describe('Send Magic Link', () => {
    const validEmail = 'test@example.com';

    test('should send magic link successfully', async () => {
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Magic link sent! Check your email to sign in.');
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        validEmail,
        expect.objectContaining({
          url: 'http://localhost:3000/auth/email-link',
          handleCodeInApp: true
        })
      );
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBe(validEmail);
    });

    test('should use production domain when environment variable is set', async () => {
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = 'https://bus-scheduler-teal.vercel.app';
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(true);
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        validEmail,
        expect.objectContaining({
          url: 'https://bus-scheduler-teal.vercel.app/auth/email-link',
          handleCodeInApp: true
        })
      );
    });

    test('should reject invalid email format', async () => {
      const result = await service.sendMagicLink('invalid-email');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    test('should handle rate limiting - too soon', async () => {
      // Set up rate limit data
      const rateLimitData: RateLimitData = {
        attempts: 1,
        timestamps: [Date.now() - 30000] // 30 seconds ago
      };
      localStorage.setItem(
        `scheduler2_rateLimit_${validEmail}`,
        JSON.stringify(rateLimitData)
      );
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Please wait');
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    test('should handle rate limiting - too many attempts', async () => {
      // Set up rate limit data with max attempts
      const now = Date.now();
      const rateLimitData: RateLimitData = {
        attempts: 5,
        timestamps: [
          now - 3000000, // 50 minutes ago
          now - 2400000, // 40 minutes ago
          now - 1800000, // 30 minutes ago
          now - 1200000, // 20 minutes ago
          now - 600000   // 10 minutes ago
        ]
      };
      localStorage.setItem(
        `scheduler2_rateLimit_${validEmail}`,
        JSON.stringify(rateLimitData)
      );
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many attempts');
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    test('should handle Firebase auth errors', async () => {
      const authError: AuthError = {
        code: 'auth/invalid-email',
        message: 'Invalid email',
        name: 'FirebaseError',
        customData: {}
      };
      (sendSignInLinkToEmail as jest.Mock).mockRejectedValue(authError);
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address format.');
    });

    test('should handle network errors with proper message', async () => {
      const authError: AuthError = {
        code: 'auth/network-request-failed',
        message: 'Network error',
        name: 'FirebaseError',
        customData: {}
      };
      (sendSignInLinkToEmail as jest.Mock).mockRejectedValue(authError);
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error. Please check your internet connection and Firebase configuration.');
    });

    test('should handle unauthorized domain error', async () => {
      const authError: AuthError = {
        code: 'auth/unauthorized-domain',
        message: 'Unauthorized domain',
        name: 'FirebaseError',
        customData: {}
      };
      (sendSignInLinkToEmail as jest.Mock).mockRejectedValue(authError);
      
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This domain is not authorized for email sign-in.');
    });
  });

  describe('Email Link Verification', () => {
    test('should identify valid email links', () => {
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      
      const result = service.isEmailLink('http://localhost:3000/auth/email-link?mode=signIn&oobCode=test');
      
      expect(result).toBe(true);
      expect(isSignInWithEmailLink).toHaveBeenCalledWith(
        mockAuth,
        'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test'
      );
    });

    test('should reject invalid email links', () => {
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(false);
      
      const result = service.isEmailLink('http://localhost:3000/regular-page');
      
      expect(result).toBe(false);
    });

    test('should use current URL if none provided', () => {
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
      
      const result = service.isEmailLink();
      
      expect(isSignInWithEmailLink).toHaveBeenCalledWith(
        mockAuth,
        'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test123'
      );
    });
  });

  describe('Complete Magic Link Sign In', () => {
    const validEmail = 'test@example.com';
    const mockUser: User = {
      email: validEmail,
      uid: 'test-uid'
    } as User;
    const mockUserCredential: UserCredential = {
      user: mockUser,
      providerId: 'email',
      operationType: 'signIn'
    } as UserCredential;

    beforeEach(() => {
      // Set up valid email link
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(true);
    });

    test('should complete sign-in successfully with stored email', async () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      (signInWithEmailLink as jest.Mock).mockResolvedValue(mockUserCredential);
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe(`Successfully signed in as ${validEmail}`);
      expect(signInWithEmailLink).toHaveBeenCalledWith(
        mockAuth,
        validEmail,
        'http://localhost:3000/auth/email-link?mode=signIn&oobCode=test123'
      );
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    test('should reject invalid sign-in links', async () => {
      (isSignInWithEmailLink as jest.Mock).mockReturnValue(false);
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired sign-in link.');
      expect(signInWithEmailLink).not.toHaveBeenCalled();
    });

    test('should require email if not in localStorage', async () => {
      localStorage.removeItem('scheduler2_emailForSignIn');
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('email_required');
      expect(result.message).toBe('Please enter your email to complete sign-in.');
      expect(signInWithEmailLink).not.toHaveBeenCalled();
    });

    test('should reject expired links (older than 24 hours)', async () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000);
      localStorage.setItem('scheduler2_signInTimestamp', twentyFiveHoursAgo.toString());
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This sign-in link has expired. Please request a new one.');
      expect(signInWithEmailLink).not.toHaveBeenCalled();
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
    });

    test('should handle Firebase auth errors during sign-in', async () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      const authError: AuthError = {
        code: 'auth/invalid-action-code',
        message: 'Invalid action code',
        name: 'FirebaseError',
        customData: {}
      };
      (signInWithEmailLink as jest.Mock).mockRejectedValue(authError);
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This sign-in link is invalid or has already been used.');
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
    });

    test('should handle expired action code error', async () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      const authError: AuthError = {
        code: 'auth/expired-action-code',
        message: 'Expired action code',
        name: 'FirebaseError',
        customData: {}
      };
      (signInWithEmailLink as jest.Mock).mockRejectedValue(authError);
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This sign-in link has expired. Please request a new one.');
    });

    test('should handle disabled user error', async () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      const authError: AuthError = {
        code: 'auth/user-disabled',
        message: 'User disabled',
        name: 'FirebaseError',
        customData: {}
      };
      (signInWithEmailLink as jest.Mock).mockRejectedValue(authError);
      
      const result = await service.completeMagicLinkSignIn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('This account has been disabled. Please contact support.');
    });

    test('should use custom URL if provided', async () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      (signInWithEmailLink as jest.Mock).mockResolvedValue(mockUserCredential);
      
      const customUrl = 'http://localhost:3000/auth/email-link?mode=signIn&oobCode=custom123';
      const result = await service.completeMagicLinkSignIn(customUrl);
      
      expect(result.success).toBe(true);
      expect(signInWithEmailLink).toHaveBeenCalledWith(
        mockAuth,
        validEmail,
        customUrl
      );
    });
  });

  describe('Email Storage Management', () => {
    const validEmail = 'test@example.com';

    test('should store email for sign-in', () => {
      service.setEmailForSignIn(validEmail);
      
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBe(validEmail);
      expect(localStorage.getItem('scheduler2_signInTimestamp')).toBeTruthy();
    });

    test('should not store invalid email', () => {
      service.setEmailForSignIn('invalid-email');
      
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
      expect(localStorage.getItem('scheduler2_signInTimestamp')).toBeNull();
    });

    test('should retrieve stored email', () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      
      const email = service.getStoredEmail();
      
      expect(email).toBe(validEmail);
    });

    test('should clear stored email and timestamp', () => {
      localStorage.setItem('scheduler2_emailForSignIn', validEmail);
      localStorage.setItem('scheduler2_signInTimestamp', Date.now().toString());
      
      service.clearStoredEmail();
      
      expect(localStorage.getItem('scheduler2_emailForSignIn')).toBeNull();
      expect(localStorage.getItem('scheduler2_signInTimestamp')).toBeNull();
    });
  });

  describe('Rate Limiting Management', () => {
    const validEmail = 'test@example.com';

    test('should clear rate limit data for an email', () => {
      const rateLimitKey = `scheduler2_rateLimit_${validEmail}`;
      localStorage.setItem(rateLimitKey, JSON.stringify({
        attempts: 3,
        timestamps: [Date.now()]
      }));
      
      service.clearRateLimit(validEmail);
      
      expect(localStorage.getItem(rateLimitKey)).toBeNull();
    });

    test('should update rate limit data correctly', async () => {
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      // Send first email
      await service.sendMagicLink(validEmail);
      
      const rateLimitKey = `scheduler2_rateLimit_${validEmail}`;
      const data = JSON.parse(localStorage.getItem(rateLimitKey) || '{}');
      
      expect(data.attempts).toBe(1);
      expect(data.timestamps).toHaveLength(1);
      
      // Wait a bit and send another (should be blocked)
      jest.advanceTimersByTime(30000); // 30 seconds
      const result = await service.sendMagicLink(validEmail);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Please wait');
    });

    test('should clean up old timestamps beyond window', async () => {
      const now = Date.now();
      const rateLimitData: RateLimitData = {
        attempts: 3,
        timestamps: [
          now - 7200000, // 2 hours ago (should be removed)
          now - 1800000, // 30 minutes ago (should be kept)
          now - 900000   // 15 minutes ago (should be kept)
        ]
      };
      
      const rateLimitKey = `scheduler2_rateLimit_${validEmail}`;
      localStorage.setItem(rateLimitKey, JSON.stringify(rateLimitData));
      
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      await service.sendMagicLink(validEmail);
      
      const updatedData = JSON.parse(localStorage.getItem(rateLimitKey) || '{}');
      
      // Should have 3 timestamps: the 2 recent ones + the new one
      expect(updatedData.timestamps).toHaveLength(3);
      expect(updatedData.timestamps).not.toContain(now - 7200000);
    });
  });

  describe('Production Domain Configuration', () => {
    test('should use correct domain for production deployment', async () => {
      // Simulate production environment
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = 'https://bus-scheduler-teal.vercel.app';
      window.location.origin = 'https://bus-scheduler-teal.vercel.app';
      
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.sendMagicLink('test@example.com');
      
      expect(result.success).toBe(true);
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        expect.objectContaining({
          url: 'https://bus-scheduler-teal.vercel.app/auth/email-link',
          handleCodeInApp: true
        })
      );
    });

    test('should fallback to window.location.origin if env var not set', async () => {
      process.env.REACT_APP_MAGIC_LINK_DOMAIN = '';
      window.location.origin = 'https://custom-domain.com';
      
      (sendSignInLinkToEmail as jest.Mock).mockResolvedValue(undefined);
      
      const result = await service.sendMagicLink('test@example.com');
      
      expect(result.success).toBe(true);
      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        expect.objectContaining({
          url: 'https://custom-domain.com/auth/email-link',
          handleCodeInApp: true
        })
      );
    });
  });

  describe('Error Message Handling', () => {
    const testCases = [
      { code: 'auth/missing-email', expected: 'Email address is required.' },
      { code: 'auth/quota-exceeded', expected: 'Too many requests. Please try again later.' },
      { code: 'auth/operation-not-allowed', expected: 'Email sign-in is not enabled. Please contact support.' },
      { code: 'unknown-error', expected: 'Failed to send magic link. Please try again.' }
    ];

    testCases.forEach(({ code, expected }) => {
      test(`should handle ${code} error correctly`, async () => {
        const authError: AuthError = {
          code,
          message: 'Error message',
          name: 'FirebaseError',
          customData: {}
        };
        (sendSignInLinkToEmail as jest.Mock).mockRejectedValue(authError);
        
        const result = await service.sendMagicLink('test@example.com');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe(expected);
      });
    });
  });
});
/**
 * Magic Link Authentication Service
 * Handles passwordless email authentication using Firebase Auth
 */

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  ActionCodeSettings,
  Auth,
  AuthError
} from 'firebase/auth';
import { auth } from '../config/firebase';

// Storage keys for magic link flow
const EMAIL_FOR_SIGN_IN_KEY = 'scheduler2_emailForSignIn';
const SIGN_IN_TIMESTAMP_KEY = 'scheduler2_signInTimestamp';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting constants
const MIN_TIME_BETWEEN_EMAILS = 60000; // 1 minute in milliseconds
const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_ATTEMPTS_WINDOW = 3600000; // 1 hour in milliseconds

export interface MagicLinkResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface RateLimitData {
  attempts: number;
  timestamps: number[];
}

class MagicLinkAuthService {
  private auth: Auth;

  constructor(firebaseAuth: Auth) {
    this.auth = firebaseAuth;
  }

  /**
   * Validates email format
   */
  isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  /**
   * Gets action code settings for magic link
   */
  private getActionCodeSettings(): ActionCodeSettings {
    const baseUrl = process.env.REACT_APP_MAGIC_LINK_DOMAIN || window.location.origin;
    
    return {
      // URL to redirect back to after email verification
      url: `${baseUrl}/auth/email-link`,
      // This must be true for email link sign-in
      handleCodeInApp: true,
      // Optional: for mobile apps
      iOS: {
        bundleId: 'com.scheduler2.app'
      },
      android: {
        packageName: 'com.scheduler2.app',
        installApp: false,
        minimumVersion: '12'
      },
      // Optional: to prevent abuse
      dynamicLinkDomain: process.env.REACT_APP_DYNAMIC_LINK_DOMAIN
    };
  }

  /**
   * Checks rate limiting for email sending
   */
  private checkRateLimit(email: string): { allowed: boolean; message?: string } {
    const rateLimitKey = `scheduler2_rateLimit_${email}`;
    const storedData = localStorage.getItem(rateLimitKey);
    
    if (!storedData) {
      return { allowed: true };
    }

    try {
      const data: RateLimitData = JSON.parse(storedData);
      const now = Date.now();
      
      // Filter out timestamps older than the window
      data.timestamps = data.timestamps.filter(
        timestamp => now - timestamp < EMAIL_ATTEMPTS_WINDOW
      );

      // Check if too many attempts
      if (data.timestamps.length >= MAX_EMAIL_ATTEMPTS) {
        const oldestTimestamp = Math.min(...data.timestamps);
        const timeRemaining = Math.ceil((EMAIL_ATTEMPTS_WINDOW - (now - oldestTimestamp)) / 60000);
        return {
          allowed: false,
          message: `Too many attempts. Please try again in ${timeRemaining} minutes.`
        };
      }

      // Check if too soon since last attempt
      if (data.timestamps.length > 0) {
        const lastTimestamp = Math.max(...data.timestamps);
        if (now - lastTimestamp < MIN_TIME_BETWEEN_EMAILS) {
          const timeRemaining = Math.ceil((MIN_TIME_BETWEEN_EMAILS - (now - lastTimestamp)) / 1000);
          return {
            allowed: false,
            message: `Please wait ${timeRemaining} seconds before requesting another email.`
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true };
    }
  }

  /**
   * Updates rate limit data
   */
  private updateRateLimit(email: string): void {
    const rateLimitKey = `scheduler2_rateLimit_${email}`;
    const storedData = localStorage.getItem(rateLimitKey);
    const now = Date.now();

    let data: RateLimitData;
    
    if (storedData) {
      try {
        data = JSON.parse(storedData);
        data.timestamps = data.timestamps.filter(
          timestamp => now - timestamp < EMAIL_ATTEMPTS_WINDOW
        );
        data.timestamps.push(now);
        data.attempts = data.timestamps.length;
      } catch {
        data = { attempts: 1, timestamps: [now] };
      }
    } else {
      data = { attempts: 1, timestamps: [now] };
    }

    localStorage.setItem(rateLimitKey, JSON.stringify(data));
  }

  /**
   * Sends a magic link to the user's email
   */
  async sendMagicLink(email: string): Promise<MagicLinkResult> {
    try {
      // Validate email format
      if (!this.isValidEmail(email)) {
        return {
          success: false,
          error: 'Please enter a valid email address'
        };
      }

      // Check rate limiting
      const rateLimitCheck = this.checkRateLimit(email);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: rateLimitCheck.message || 'Too many attempts. Please try again later.'
        };
      }

      // Get action code settings
      const actionCodeSettings = this.getActionCodeSettings();

      // Send the magic link
      await sendSignInLinkToEmail(this.auth, email, actionCodeSettings);

      // Store email locally for completion (encrypted would be better in production)
      localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
      localStorage.setItem(SIGN_IN_TIMESTAMP_KEY, Date.now().toString());

      // Update rate limit
      this.updateRateLimit(email);

      return {
        success: true,
        message: 'Magic link sent! Check your email to sign in.'
      };
    } catch (error) {
      console.error('Error sending magic link:', error);
      
      const authError = error as AuthError;
      let errorMessage = 'Failed to send magic link. Please try again.';

      // Handle specific Firebase Auth errors
      switch (authError.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/missing-email':
          errorMessage = 'Email address is required.';
          break;
        case 'auth/quota-exceeded':
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'This domain is not authorized for email sign-in.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email sign-in is not enabled. Please contact support.';
          break;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Checks if the current URL is a sign-in link
   */
  isEmailLink(url?: string): boolean {
    const checkUrl = url || window.location.href;
    return isSignInWithEmailLink(this.auth, checkUrl);
  }

  /**
   * Completes the sign-in process with the email link
   */
  async completeMagicLinkSignIn(url?: string): Promise<MagicLinkResult> {
    try {
      const signInUrl = url || window.location.href;

      // Check if this is a valid sign-in link
      if (!this.isEmailLink(signInUrl)) {
        return {
          success: false,
          error: 'Invalid or expired sign-in link.'
        };
      }

      // Get the email from localStorage
      let email = localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      
      // If no email stored, prompt user to enter it
      if (!email) {
        return {
          success: false,
          error: 'email_required',
          message: 'Please enter your email to complete sign-in.'
        };
      }

      // Check if the link is expired (24 hours)
      const timestamp = localStorage.getItem(SIGN_IN_TIMESTAMP_KEY);
      if (timestamp) {
        const elapsed = Date.now() - parseInt(timestamp, 10);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (elapsed > twentyFourHours) {
          this.clearStoredEmail();
          return {
            success: false,
            error: 'This sign-in link has expired. Please request a new one.'
          };
        }
      }

      // Complete the sign-in
      const result = await signInWithEmailLink(this.auth, email, signInUrl);

      // Clear stored email after successful sign-in
      this.clearStoredEmail();

      // Clear the URL to remove the sign-in link
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      return {
        success: true,
        message: `Successfully signed in as ${result.user.email}`
      };
    } catch (error) {
      console.error('Error completing magic link sign-in:', error);
      
      const authError = error as AuthError;
      let errorMessage = 'Failed to complete sign-in. Please try again.';

      // Handle specific Firebase Auth errors
      switch (authError.code) {
        case 'auth/expired-action-code':
          errorMessage = 'This sign-in link has expired. Please request a new one.';
          break;
        case 'auth/invalid-action-code':
          errorMessage = 'This sign-in link is invalid or has already been used.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'The email address is invalid.';
          break;
      }

      // Clear stored email on error
      this.clearStoredEmail();

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sets the email for sign-in completion (used when email is not in localStorage)
   */
  setEmailForSignIn(email: string): void {
    if (this.isValidEmail(email)) {
      localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
      localStorage.setItem(SIGN_IN_TIMESTAMP_KEY, Date.now().toString());
    }
  }

  /**
   * Gets the stored email for sign-in
   */
  getStoredEmail(): string | null {
    return localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  }

  /**
   * Clears stored email and timestamp
   */
  clearStoredEmail(): void {
    localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    localStorage.removeItem(SIGN_IN_TIMESTAMP_KEY);
  }

  /**
   * Clears rate limit data for an email (useful for testing)
   */
  clearRateLimit(email: string): void {
    const rateLimitKey = `scheduler2_rateLimit_${email}`;
    localStorage.removeItem(rateLimitKey);
  }
}

// Export singleton instance
export const magicLinkAuth = new MagicLinkAuthService(auth);

// Export class for testing
export default MagicLinkAuthService;
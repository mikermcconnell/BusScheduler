/**
 * CSRF Protection Utilities
 * Implements token-based CSRF protection for state-changing operations
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CSRFToken {
  token: string;
  timestamp: number;
  sessionId: string;
}

class CSRFProtection {
  private currentToken: CSRFToken | null = null;

  /**
   * Initialize CSRF protection
   */
  initialize(): void {
    // Load existing token or create new one
    const storedToken = this.loadToken();
    if (storedToken && this.isTokenValid(storedToken)) {
      this.currentToken = storedToken;
    } else {
      this.generateNewToken();
    }

    // Add token to all fetch requests
    this.interceptFetchRequests();
  }

  /**
   * Generate a new CSRF token
   */
  generateNewToken(): string {
    const token: CSRFToken = {
      token: this.generateSecureToken(),
      timestamp: Date.now(),
      sessionId: this.getOrCreateSessionId()
    };

    this.currentToken = token;
    this.saveToken(token);

    return token.token;
  }

  /**
   * Get current CSRF token
   */
  getToken(): string | null {
    if (!this.currentToken || !this.isTokenValid(this.currentToken)) {
      return this.generateNewToken();
    }
    return this.currentToken.token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(token: string): boolean {
    if (!this.currentToken || !this.isTokenValid(this.currentToken)) {
      return false;
    }

    return token === this.currentToken.token;
  }

  /**
   * Add CSRF token to request headers
   */
  addTokenToHeaders(headers: HeadersInit = {}): HeadersInit {
    const token = this.getToken();
    if (token) {
      return {
        ...headers,
        [CSRF_TOKEN_HEADER]: token
      };
    }
    return headers;
  }

  /**
   * Intercept fetch requests to add CSRF token
   */
  private interceptFetchRequests(): void {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Only add CSRF token to state-changing requests
      if (init?.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(init.method.toUpperCase())) {
        // Check if this is a same-origin request
        const url = typeof input === 'string' ? input : input.toString();
        if (this.isSameOrigin(url)) {
          init.headers = this.addTokenToHeaders(init.headers);
        }
      }

      return originalFetch(input, init);
    };
  }

  /**
   * Check if URL is same origin
   */
  private isSameOrigin(url: string): boolean {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return parsedUrl.origin === window.location.origin;
    } catch {
      // Relative URL - same origin
      return true;
    }
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    // Use UUID v4 for cryptographically secure random token
    const token = uuidv4().replace(/-/g, '');
    
    // Add additional entropy from crypto API if available
    if (window.crypto && window.crypto.getRandomValues) {
      const randomBytes = new Uint8Array(16);
      window.crypto.getRandomValues(randomBytes);
      const hexString = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return token + hexString;
    }

    return token;
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    const sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      const newSessionId = uuidv4();
      sessionStorage.setItem('session_id', newSessionId);
      return newSessionId;
    }
    return sessionId;
  }

  /**
   * Check if token is valid (not expired)
   */
  private isTokenValid(token: CSRFToken): boolean {
    const now = Date.now();
    const age = now - token.timestamp;
    
    // Check expiry
    if (age > TOKEN_EXPIRY_MS) {
      return false;
    }

    // Check session ID
    const currentSessionId = this.getOrCreateSessionId();
    if (token.sessionId !== currentSessionId) {
      return false;
    }

    return true;
  }

  /**
   * Save token to storage
   */
  private saveToken(token: CSRFToken): void {
    try {
      // Use sessionStorage for CSRF tokens (cleared on tab close)
      sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify(token));
    } catch (error) {
      console.error('Failed to save CSRF token:', error);
    }
  }

  /**
   * Load token from storage
   */
  private loadToken(): CSRFToken | null {
    try {
      const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load CSRF token:', error);
    }
    return null;
  }

  /**
   * Clear CSRF token (for logout)
   */
  clearToken(): void {
    this.currentToken = null;
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  }

  /**
   * Rotate token (generate new token, invalidate old one)
   */
  rotateToken(): string {
    this.clearToken();
    return this.generateNewToken();
  }
}

// Export singleton instance
export const csrfProtection = new CSRFProtection();

// React hook for CSRF token
export function useCSRFToken(): string | null {
  return csrfProtection.getToken();
}

// HOC for CSRF-protected forms
export function withCSRFProtection<P extends object>(
  Component: React.ComponentType<P & { csrfToken: string }>
): React.ComponentType<P> {
  return (props: P) => {
    const token = useCSRFToken();
    if (!token) {
      console.warn('CSRF token not available');
      return null;
    }
    return React.createElement(Component, { ...props, csrfToken: token });
  };
}
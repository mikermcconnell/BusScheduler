/**
 * Security Initializer
 * Centralizes initialization of all security features
 */

import React from 'react';
import { csrfProtection } from './csrfProtection';
import { rateLimiter } from './rateLimiter';
import { csp } from './contentSecurityPolicy';
import { auditLogger, AuditEventType } from '../services/auditLogger';

export interface SecurityConfig {
  enableCSRF?: boolean;
  enableRateLimiting?: boolean;
  enableCSP?: boolean;
  enableAuditLogging?: boolean;
  environment?: 'development' | 'staging' | 'production';
  cspReportEndpoint?: string | null;
  auditEndpoint?: string | null;
}

type ResolvedSecurityConfig = {
  enableCSRF: boolean;
  enableRateLimiting: boolean;
  enableCSP: boolean;
  enableAuditLogging: boolean;
  environment: 'development' | 'staging' | 'production';
  cspReportEndpoint: string | null;
  auditEndpoint: string | null;
};

class SecurityInitializer {
  private initialized = false;
  private config: ResolvedSecurityConfig = {
    enableCSRF: true,
    enableRateLimiting: true,
    enableCSP: true,
    enableAuditLogging: true,
    environment: 'production',
    cspReportEndpoint: null,
    auditEndpoint: null
  };

  /**
   * Initialize all security features
   */
  initialize(config?: SecurityConfig): void {
    if (this.initialized) {
      console.warn('Security already initialized');
      return;
    }

    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Detect environment
    this.detectEnvironment();

    // Apply environment-specific endpoint defaults if not provided
    if (!config || config.cspReportEndpoint === undefined) {
      this.config.cspReportEndpoint =
        this.config.environment === 'production' ? '/api/csp-report' : null;
    }

    if (!config || config.auditEndpoint === undefined) {
      this.config.auditEndpoint =
        this.config.environment === 'production' ? '/api/audit' : null;
    }

    // Initialize CSRF Protection
    if (this.config.enableCSRF) {
      this.initializeCSRF();
    }

    // Initialize Rate Limiting
    if (this.config.enableRateLimiting) {
      this.initializeRateLimiting();
    }

    // Initialize Content Security Policy
    if (this.config.enableCSP) {
      this.initializeCSP();
    }

    // Initialize Audit Logging
    if (this.config.enableAuditLogging) {
      this.initializeAuditLogging();
    }

    // Set up global error handler
    this.setupGlobalErrorHandler();

    // Monitor security events
    this.monitorSecurityEvents();

    this.initialized = true;

    // Log initialization
    auditLogger.log(
      AuditEventType.CONFIG_UPDATED,
      'Security features initialized',
      this.config
    );

    console.log('🔒 Security features initialized:', {
      csrf: this.config.enableCSRF,
      rateLimiting: this.config.enableRateLimiting,
      csp: this.config.enableCSP,
      auditLogging: this.config.enableAuditLogging,
      environment: this.config.environment
    });
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): void {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      this.config.environment = 'development';
    } else if (hostname.includes('staging') || hostname.includes('test')) {
      this.config.environment = 'staging';
    } else {
      this.config.environment = 'production';
    }
  }

  /**
   * Initialize CSRF Protection
   */
  private initializeCSRF(): void {
    csrfProtection.initialize();

    // Rotate token periodically in production
    if (this.config.environment === 'production') {
      setInterval(() => {
        csrfProtection.rotateToken();
      }, 60 * 60 * 1000); // Every hour
    }
  }

  /**
   * Initialize Rate Limiting
   */
  private initializeRateLimiting(): void {
    // Override fetch to apply rate limiting
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = (() => {
        if (typeof input === 'string') {
          return input;
        }
        if (input instanceof URL) {
          return input.toString();
        }
        if (typeof Request !== 'undefined' && input instanceof Request) {
          return input.url;
        }
        return String(input);
      })();
      
      // Check rate limit
      const check = await rateLimiter.checkLimit(url);
      
      if (!check.allowed) {
        // Log rate limit violation
        auditLogger.logSecurity(
          AuditEventType.RATE_LIMIT_EXCEEDED,
          { url, retryAfter: check.retryAfter }
        );

        // Return rate limit error response
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            retryAfter: check.retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(check.retryAfter || 60)
            }
          }
        );
      }

      // Add rate limit headers to request for same-origin calls only
      if (init && check.remaining !== undefined) {
        try {
          const requestUrl = new URL(url, window.location.origin);
          if (requestUrl.origin === window.location.origin) {
            const headers = new Headers(init.headers || {});
            headers.set('X-RateLimit-Remaining', String(check.remaining));
            init.headers = headers;
          }
        } catch (error) {
          // Skip header injection when URL parsing fails (non-HTTP requests, etc.)
        }
      }

      return originalFetch(input, init);
    };
  }

  /**
   * Initialize Content Security Policy
   */
  private initializeCSP(): void {
    // Set report endpoint
    if (this.config.cspReportEndpoint) {
      csp.setReportEndpoint(this.config.cspReportEndpoint);
    } else {
      csp.clearReportEndpoint();
    }

    // Apply environment-specific config
    const envConfig = csp.getEnvironmentConfig(this.config.environment);
    Object.entries(envConfig).forEach(([directive, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => csp.addTrustedDomain(directive as any, v));
      }
    });

    // Generate nonce for inline scripts
    csp.generateNonce();

    // Apply CSP
    csp.applyAsMetaTag();

    // Monitor violations
    csp.monitorViolations((violation) => {
      auditLogger.logSecurity(
        AuditEventType.XSS_BLOCKED,
        {
          blockedURI: violation.blockedURI,
          violatedDirective: violation.violatedDirective,
          sourceFile: violation.sourceFile
        }
      );
    });

    // Validate policy
    const validation = csp.validatePolicy();
    if (!validation.valid) {
      console.error('CSP validation errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('CSP validation warnings:', validation.warnings);
    }
  }

  /**
   * Initialize Audit Logging
   */
  private initializeAuditLogging(): void {
    // Clear old logs periodically
    setInterval(() => {
      auditLogger.clearOldLogs(30); // Keep 30 days
    }, 24 * 60 * 60 * 1000); // Daily

    // Set up performance monitoring
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) {
          auditLogger.logPerformance(
            entry.name,
            entry.duration,
            1000,
            { entryType: entry.entryType }
          );
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
    } catch (error) {
      console.warn('Performance observer not supported:', error);
    }
  }

  /**
   * Set up global error handler
   */
  private setupGlobalErrorHandler(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      auditLogger.logError('Unhandled error', event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      auditLogger.logError('Unhandled promise rejection', new Error(String(event.reason)), {
        promise: event.promise
      });
    });
  }

  /**
   * Monitor security events
   */
  private monitorSecurityEvents(): void {
    // Monitor storage events for potential XSS
    window.addEventListener('storage', (event) => {
      if (event.key && event.newValue) {
        // Check for potential XSS patterns
        const xssPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+=/i,
          /<iframe/i
        ];

        const newValue = event.newValue;
        if (newValue && xssPatterns.some(pattern => pattern.test(newValue))) {
          auditLogger.logSecurity(
            AuditEventType.XSS_BLOCKED,
            {
              key: event.key,
              value: newValue.substring(0, 100) // Truncate for safety
            }
          );

          // Remove suspicious value
          if (event.key) {
            localStorage.removeItem(event.key);
          }
        }
      }
    });

    // Monitor network errors
    window.addEventListener('online', () => {
      auditLogger.log(AuditEventType.CONFIG_UPDATED, 'Network status: online');
    });

    window.addEventListener('offline', () => {
      auditLogger.log(AuditEventType.WARNING_RAISED, 'Network status: offline');
    });
  }

  /**
   * Get security status
   */
  getStatus(): {
    initialized: boolean;
    config: SecurityConfig;
    csrf: { enabled: boolean; token: string | null };
    rateLimiting: { enabled: boolean; stats: any };
    csp: { enabled: boolean; valid: boolean };
    audit: { enabled: boolean; logCount: number };
  } {
    return {
      initialized: this.initialized,
      config: this.config,
      csrf: {
        enabled: this.config.enableCSRF,
        token: csrfProtection.getToken()
      },
      rateLimiting: {
        enabled: this.config.enableRateLimiting,
        stats: rateLimiter.getUsageStats()
      },
      csp: {
        enabled: this.config.enableCSP,
        valid: csp.validatePolicy().valid
      },
      audit: {
        enabled: this.config.enableAuditLogging,
        logCount: auditLogger.getLogs().length
      }
    };
  }
}

// Export singleton instance
export const securityInitializer = new SecurityInitializer();

// React hook for security status
export function useSecurityStatus() {
  const [status, setStatus] = React.useState(securityInitializer.getStatus());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStatus(securityInitializer.getStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

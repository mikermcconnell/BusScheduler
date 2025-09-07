/**
 * Content Security Policy (CSP) Configuration
 * Provides XSS protection through strict content policies
 */

import React from 'react';

interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'frame-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'worker-src'?: string[];
  'child-src'?: string[];
  'navigate-to'?: string[];
  'report-uri'?: string[];
  'report-to'?: string[];
  'require-trusted-types-for'?: string[];
  'trusted-types'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

class ContentSecurityPolicy {
  private nonce: string | null = null;
  private directives: CSPDirectives = {};
  private reportEndpoint: string | null = null;

  constructor() {
    this.initializeDefaultPolicy();
  }

  /**
   * Initialize default CSP directives
   */
  private initializeDefaultPolicy(): void {
    this.directives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'strict-dynamic'"],
      'style-src': ["'self'", "'unsafe-inline'"], // Required for MUI
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': [
        "'self'", 
        'https://api.anthropic.com', 
        'https://api.openai.com',
        // Firebase domains
        'https://*.googleapis.com',
        'https://*.firebaseapp.com',
        'https://*.firebasestorage.app',
        'https://*.firebaseio.com',
        'https://firebase.googleapis.com',
        'https://firestore.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        // WebSocket connections for Firebase Realtime features
        'wss://*.firebaseio.com',
        'wss://*.firebaseapp.com'
      ],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
      'worker-src': ["'self'", 'blob:'],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true
    };
  }

  /**
   * Generate a nonce for inline scripts
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    this.nonce = btoa(String.fromCharCode.apply(null, Array.from(array)));
    
    // Add nonce to script-src
    if (this.directives['script-src']) {
      const nonceDirective = `'nonce-${this.nonce}'`;
      if (!this.directives['script-src'].includes(nonceDirective)) {
        this.directives['script-src'].push(nonceDirective);
      }
    }
    
    return this.nonce;
  }

  /**
   * Get current nonce
   */
  getNonce(): string | null {
    return this.nonce;
  }

  /**
   * Add trusted domain to specific directive
   */
  addTrustedDomain(directive: keyof CSPDirectives, domain: string): void {
    // Only allow string array directives
    if (directive === 'upgrade-insecure-requests' || directive === 'block-all-mixed-content') {
      console.warn(`Cannot add domain to boolean directive: ${directive}`);
      return;
    }
    
    if (!this.directives[directive]) {
      (this.directives as any)[directive] = [];
    }
    
    const dirArray = this.directives[directive] as string[];
    if (!dirArray.includes(domain)) {
      dirArray.push(domain);
    }
  }

  /**
   * Set report endpoint for CSP violations
   */
  setReportEndpoint(endpoint: string): void {
    this.reportEndpoint = endpoint;
    this.directives['report-uri'] = [endpoint];
    
    // Also set report-to for newer browsers
    this.directives['report-to'] = ['csp-endpoint'];
  }

  /**
   * Build CSP header string
   */
  buildPolicy(): string {
    const policyParts: string[] = [];

    Object.entries(this.directives).forEach(([directive, value]) => {
      if (typeof value === 'boolean' && value) {
        policyParts.push(directive);
      } else if (Array.isArray(value) && value.length > 0) {
        policyParts.push(`${directive} ${value.join(' ')}`);
      }
    });

    return policyParts.join('; ');
  }

  /**
   * Build CSP policy string for meta tag (excludes unsupported directives)
   */
  buildPolicyForMeta(): string {
    const policyParts: string[] = [];
    
    // Directives that are ignored when delivered via meta element
    const unsupportedInMeta = new Set([
      'frame-ancestors',
      'report-uri',
      'report-to'
    ]);

    Object.entries(this.directives).forEach(([directive, value]) => {
      // Skip directives not supported in meta tags
      if (unsupportedInMeta.has(directive)) {
        return;
      }

      if (typeof value === 'boolean' && value) {
        policyParts.push(directive);
      } else if (Array.isArray(value) && value.length > 0) {
        policyParts.push(`${directive} ${value.join(' ')}`);
      }
    });

    return policyParts.join('; ');
  }

  /**
   * Apply CSP as meta tag (for SPAs without server control)
   */
  applyAsMetaTag(): void {
    // Remove existing CSP meta tag if present
    const existingTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingTag) {
      existingTag.remove();
    }

    // Create new CSP meta tag
    const metaTag = document.createElement('meta');
    metaTag.httpEquiv = 'Content-Security-Policy';
    metaTag.content = this.buildPolicyForMeta();
    document.head.appendChild(metaTag);
  }

  /**
   * Monitor CSP violations
   */
  monitorViolations(callback?: (violation: SecurityPolicyViolationEvent) => void): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = {
        blockedURI: event.blockedURI,
        columnNumber: event.columnNumber,
        disposition: event.disposition,
        documentURI: event.documentURI,
        effectiveDirective: event.effectiveDirective,
        lineNumber: event.lineNumber,
        originalPolicy: event.originalPolicy,
        referrer: event.referrer,
        sample: event.sample,
        sourceFile: event.sourceFile,
        statusCode: event.statusCode,
        violatedDirective: event.violatedDirective,
        timestamp: new Date().toISOString()
      };

      // Log violation
      console.warn('CSP Violation:', violation);

      // Send to report endpoint if configured
      if (this.reportEndpoint) {
        this.reportViolation(violation);
      }

      // Call custom callback if provided
      if (callback) {
        callback(event);
      }
    });
  }

  /**
   * Report CSP violation to server
   */
  private async reportViolation(violation: any): Promise<void> {
    if (!this.reportEndpoint) return;

    // TODO(human) - Implement client-side violation logging
    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/csp-report'
        },
        body: JSON.stringify({
          'csp-report': violation
        })
      });
    } catch (error) {
      console.error('Failed to report CSP violation:', error);
    }
  }

  /**
   * Create Report-To header value
   */
  getReportToHeader(): string {
    if (!this.reportEndpoint) return '';

    return JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{
        url: this.reportEndpoint
      }]
    });
  }

  /**
   * Validate current policy
   */
  validatePolicy(): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for unsafe-eval
    if (this.directives['script-src']?.includes("'unsafe-eval'")) {
      errors.push("'unsafe-eval' in script-src is dangerous and should be avoided");
    }

    // Check for wildcard sources
    Object.entries(this.directives).forEach(([directive, values]) => {
      if (Array.isArray(values) && values.includes('*')) {
        warnings.push(`Wildcard (*) in ${directive} may be too permissive`);
      }
    });

    // Check for missing directives
    if (!this.directives['default-src']) {
      errors.push("Missing 'default-src' directive");
    }

    // Check for frame-ancestors
    if (!this.directives['frame-ancestors']) {
      warnings.push("Consider setting 'frame-ancestors' to prevent clickjacking");
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Get CSP configuration for specific environment
   */
  getEnvironmentConfig(env: 'development' | 'staging' | 'production'): CSPDirectives {
    const baseConfig = { ...this.directives };

    switch (env) {
      case 'development':
        // More permissive for development
        baseConfig['script-src'] = ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*'];
        baseConfig['connect-src'] = [
          "'self'", 
          'localhost:*', 
          'ws://localhost:*',
          // Firebase domains for development
          'https://*.googleapis.com',
          'https://*.firebaseapp.com',
          'https://*.firebasestorage.app',
          'https://*.firebaseio.com',
          'wss://*.firebaseio.com',
          'wss://*.firebaseapp.com'
        ];
        break;

      case 'staging':
        // Moderate restrictions for staging
        baseConfig['script-src'] = ["'self'", "'strict-dynamic'", this.nonce ? `'nonce-${this.nonce}'` : ''].filter(Boolean);
        break;

      case 'production':
        // Strictest for production
        baseConfig['script-src'] = ["'self'", "'strict-dynamic'", this.nonce ? `'nonce-${this.nonce}'` : ''].filter(Boolean);
        baseConfig['upgrade-insecure-requests'] = true;
        break;
    }

    return baseConfig;
  }
}

// Export singleton instance
export const csp = new ContentSecurityPolicy();

// React hook for CSP nonce
export function useCSPNonce(): string | null {
  const [nonce, setNonce] = React.useState<string | null>(csp.getNonce());

  React.useEffect(() => {
    if (!nonce) {
      const newNonce = csp.generateNonce();
      setNonce(newNonce);
    }
  }, [nonce]);

  return nonce;
}

// HOC for CSP-protected components
export function withCSP<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return (props: P) => {
    React.useEffect(() => {
      // Apply CSP on mount
      csp.applyAsMetaTag();
      
      // Monitor violations
      csp.monitorViolations();
    }, []);

    return React.createElement(Component, props);
  };
}
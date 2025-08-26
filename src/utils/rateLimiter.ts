/**
 * Rate Limiter Utility
 * Client-side rate limiting to prevent API abuse
 */

import React from 'react';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

interface RequestRecord {
  timestamp: number;
  endpoint: string;
}

interface RateLimitState {
  requests: RequestRecord[];
  blockedUntil?: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private globalLimit: RateLimitState = { requests: [] };
  
  // Default configurations
  private readonly DEFAULT_GLOBAL_LIMIT = { maxRequests: 100, windowMs: 60000 }; // 100 req/min
  private readonly DEFAULT_ENDPOINT_LIMIT = { maxRequests: 20, windowMs: 60000 }; // 20 req/min per endpoint
  private readonly DEFAULT_USER_LIMIT = { maxRequests: 50, windowMs: 60000 }; // 50 req/min per user

  /**
   * Check if request is allowed
   */
  async checkLimit(
    endpoint: string,
    config?: RateLimitConfig
  ): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
    const now = Date.now();
    
    // Check global limit
    const globalCheck = this.checkRateLimit(this.globalLimit, this.DEFAULT_GLOBAL_LIMIT, now);
    if (!globalCheck.allowed) {
      return globalCheck;
    }

    // Check endpoint-specific limit
    const endpointKey = this.getEndpointKey(endpoint);
    const endpointState = this.limits.get(endpointKey) || { requests: [] };
    const endpointConfig = config || this.DEFAULT_ENDPOINT_LIMIT;
    
    const endpointCheck = this.checkRateLimit(endpointState, endpointConfig, now);
    if (!endpointCheck.allowed) {
      this.limits.set(endpointKey, endpointState);
      return endpointCheck;
    }

    // Check user-specific limit if identifier provided
    if (config?.identifier) {
      const userKey = `user:${config.identifier}`;
      const userState = this.limits.get(userKey) || { requests: [] };
      const userCheck = this.checkRateLimit(userState, this.DEFAULT_USER_LIMIT, now);
      
      if (!userCheck.allowed) {
        this.limits.set(userKey, userState);
        return userCheck;
      }

      // Record user request
      userState.requests.push({ timestamp: now, endpoint });
      this.limits.set(userKey, userState);
    }

    // Record requests
    this.globalLimit.requests.push({ timestamp: now, endpoint });
    endpointState.requests.push({ timestamp: now, endpoint });
    this.limits.set(endpointKey, endpointState);

    // Calculate remaining requests (use most restrictive)
    const globalRemaining = this.DEFAULT_GLOBAL_LIMIT.maxRequests - this.globalLimit.requests.length;
    const endpointRemaining = endpointConfig.maxRequests - endpointState.requests.length;
    
    return {
      allowed: true,
      remaining: Math.min(globalRemaining, endpointRemaining)
    };
  }

  /**
   * Check rate limit for a specific state
   */
  private checkRateLimit(
    state: RateLimitState,
    config: RateLimitConfig,
    now: number
  ): { allowed: boolean; retryAfter?: number; remaining?: number } {
    // Check if currently blocked
    if (state.blockedUntil && now < state.blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((state.blockedUntil - now) / 1000)
      };
    }

    // Clean old requests outside window
    const windowStart = now - config.windowMs;
    state.requests = state.requests.filter(req => req.timestamp > windowStart);

    // Check if limit exceeded
    if (state.requests.length >= config.maxRequests) {
      // Calculate when oldest request will expire
      const oldestRequest = state.requests[0];
      const retryAfter = Math.ceil((oldestRequest.timestamp + config.windowMs - now) / 1000);
      
      // Set temporary block for severe violations
      if (state.requests.length > config.maxRequests * 1.5) {
        state.blockedUntil = now + (config.windowMs * 2); // Double the window as penalty
      }

      return {
        allowed: false,
        retryAfter,
        remaining: 0
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - state.requests.length
    };
  }

  /**
   * Get endpoint key for rate limiting
   */
  private getEndpointKey(endpoint: string): string {
    // Normalize endpoint (remove query params, trailing slashes)
    try {
      const url = new URL(endpoint, window.location.origin);
      return `endpoint:${url.pathname.replace(/\/$/, '')}`;
    } catch {
      // For relative URLs
      return `endpoint:${endpoint.split('?')[0].replace(/\/$/, '')}`;
    }
  }

  /**
   * Reset limits for an identifier
   */
  resetLimits(identifier?: string): void {
    if (identifier) {
      this.limits.delete(`user:${identifier}`);
    } else {
      this.limits.clear();
      this.globalLimit = { requests: [] };
    }
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(identifier?: string): {
    global: { used: number; limit: number; resetIn: number };
    endpoint?: { [key: string]: { used: number; limit: number } };
    user?: { used: number; limit: number };
  } {
    const now = Date.now();
    
    // Global stats
    const globalWindowStart = now - this.DEFAULT_GLOBAL_LIMIT.windowMs;
    const activeGlobalRequests = this.globalLimit.requests.filter(
      req => req.timestamp > globalWindowStart
    );

    const stats: any = {
      global: {
        used: activeGlobalRequests.length,
        limit: this.DEFAULT_GLOBAL_LIMIT.maxRequests,
        resetIn: Math.ceil(this.DEFAULT_GLOBAL_LIMIT.windowMs / 1000)
      }
    };

    // User stats if identifier provided
    if (identifier) {
      const userKey = `user:${identifier}`;
      const userState = this.limits.get(userKey);
      if (userState) {
        const userWindowStart = now - this.DEFAULT_USER_LIMIT.windowMs;
        const activeUserRequests = userState.requests.filter(
          req => req.timestamp > userWindowStart
        );
        stats.user = {
          used: activeUserRequests.length,
          limit: this.DEFAULT_USER_LIMIT.maxRequests
        };
      }
    }

    return stats;
  }

  /**
   * Middleware for automatic rate limiting
   */
  createMiddleware() {
    return async (request: Request): Promise<Response | null> => {
      const check = await this.checkLimit(request.url);
      
      if (!check.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            retryAfter: check.retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(check.retryAfter || 60),
              'X-RateLimit-Limit': String(this.DEFAULT_ENDPOINT_LIMIT.maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Date.now() + (check.retryAfter || 60) * 1000)
            }
          }
        );
      }

      // Add rate limit headers to response
      if (check.remaining !== undefined) {
        request.headers.set('X-RateLimit-Remaining', String(check.remaining));
      }

      return null; // Continue with request
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// React hook for rate limit status
export function useRateLimit(endpoint?: string): {
  checkLimit: () => Promise<boolean>;
  remaining: number | null;
  resetIn: number | null;
} {
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [resetIn, setResetIn] = React.useState<number | null>(null);

  const checkLimit = React.useCallback(async () => {
    const result = await rateLimiter.checkLimit(endpoint || window.location.pathname);
    setRemaining(result.remaining || 0);
    setResetIn(result.retryAfter || null);
    return result.allowed;
  }, [endpoint]);

  React.useEffect(() => {
    // Update stats periodically
    const interval = setInterval(() => {
      const stats = rateLimiter.getUsageStats();
      setRemaining(stats.global.limit - stats.global.used);
      setResetIn(stats.global.resetIn);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { checkLimit, remaining, resetIn };
}

// Decorator for rate-limited functions
export function rateLimited(
  maxRequests: number = 10,
  windowMs: number = 60000
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const config = { maxRequests, windowMs };
      const check = await rateLimiter.checkLimit(String(propertyKey), config);

      if (!check.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${check.retryAfter} seconds`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
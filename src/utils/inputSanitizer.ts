/**
 * Input Sanitization Utilities
 * Provides comprehensive input sanitization to prevent XSS and other injection attacks
 */

// HTML entities for encoding
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

// Dangerous patterns to remove or encode
const DANGEROUS_PATTERNS = [
  // Script tags
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  // Event handlers
  /on\w+\s*=\s*["']?[^"']*["']?/gi,
  // JavaScript URLs
  /javascript:/gi,
  // Data URLs with scripts
  /data:(?:text\/html|application\/javascript)/gi,
  // Style tags
  /<style[^>]*>[\s\S]*?<\/style>/gi,
  // Meta tags
  /<meta[^>]*>/gi,
  // Link tags
  /<link[^>]*>/gi,
  // Object and embed tags
  /<(?:object|embed|iframe)[^>]*>[\s\S]*?<\/(?:object|embed|iframe)>/gi,
  // Form elements
  /<(?:form|input|textarea|button|select|option)[^>]*>/gi,
  // Expression() CSS
  /expression\s*\(/gi,
  // URL() CSS
  /url\s*\(/gi
];

// Character limits for different input types
const INPUT_LIMITS = {
  timePointName: 100,
  fileName: 255,
  errorMessage: 500,
  generalText: 1000
} as const;

export interface SanitizationOptions {
  maxLength?: number;
  allowHtml?: boolean;
  preserveNewlines?: boolean;
  strict?: boolean;
  removeNumbers?: boolean;
  allowedCharacters?: RegExp;
}

/**
 * Comprehensive input sanitizer class
 */
export class InputSanitizer {
  /**
   * Sanitizes text input to prevent XSS and other attacks
   */
  static sanitizeText(
    input: unknown, 
    options: SanitizationOptions = {}
  ): string {
    // Handle non-string inputs
    if (input === null || input === undefined) {
      return '';
    }

    let text = String(input);
    
    // Apply length limit early to prevent DoS
    const maxLength = options.maxLength || INPUT_LIMITS.generalText;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
    }

    // Remove dangerous patterns first
    if (!options.allowHtml) {
      text = InputSanitizer.removeDangerousPatterns(text);
    }

    // HTML entity encoding
    text = InputSanitizer.htmlEntityEncode(text);

    // Apply character filtering if specified
    if (options.allowedCharacters) {
      text = text.replace(options.allowedCharacters, '');
    }

    // Remove numbers if requested
    if (options.removeNumbers) {
      text = text.replace(/\d/g, '');
    }

    // Handle newlines
    if (!options.preserveNewlines) {
      text = text.replace(/[\r\n]+/g, ' ');
    }

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Apply strict filtering if requested
    if (options.strict) {
      text = InputSanitizer.applyStrictFiltering(text);
    }

    return text;
  }

  /**
   * Sanitizes time point names specifically
   */
  static sanitizeTimePointName(name: unknown): string {
    return InputSanitizer.sanitizeText(name, {
      maxLength: INPUT_LIMITS.timePointName,
      allowHtml: false,
      strict: true,
      allowedCharacters: /[^\w\s&-]/g // Only allow word chars, spaces, ampersands, hyphens
    });
  }

  /**
   * Sanitizes file names for safe display
   */
  static sanitizeFileName(fileName: unknown): string {
    return InputSanitizer.sanitizeText(fileName, {
      maxLength: INPUT_LIMITS.fileName,
      allowHtml: false,
      strict: true,
      allowedCharacters: /[<>:"|?*]/g // Remove dangerous filename characters
    }).replace(/\.\./g, ''); // Remove directory traversal
  }

  /**
   * Sanitizes error messages to prevent information disclosure
   */
  static sanitizeErrorMessage(message: unknown): string {
    let sanitized = InputSanitizer.sanitizeText(message, {
      maxLength: INPUT_LIMITS.errorMessage,
      allowHtml: false,
      strict: false
    });

    // Remove sensitive information patterns
    sanitized = sanitized
      // Remove file paths
      .replace(/[C-Z]:\\[^\s]*/gi, '[PATH]')
      .replace(/\/[^\s]*/g, '[PATH]')
      // Remove IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
      // Remove email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      // Remove database connection strings
      .replace(/(?:server|host|database|user|password|uid|pwd)\s*=\s*[^;\s]+/gi, '[DB_INFO]')
      // Remove stack traces
      .replace(/\s+at\s+[^\r\n]+/g, '')
      // Remove specific system paths
      .replace(/node_modules[^\s]*/g, '[NODE_MODULE]')
      .replace(/Users\/[^\s\/]+/g, '[USER]');

    return sanitized;
  }

  /**
   * Validates and sanitizes time values
   */
  static sanitizeTimeValue(timeValue: unknown): string | null {
    if (timeValue === null || timeValue === undefined || timeValue === '') {
      return null;
    }

    // Convert to string and limit length
    const timeStr = String(timeValue).trim().substring(0, 8);
    
    // Strict time format validation
    const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/;
    
    if (!timePattern.test(timeStr)) {
      return null;
    }

    const match = timeStr.match(timePattern);
    if (!match) {
      return null;
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    // Additional validation
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) {
      return null;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Sanitizes numeric input
   */
  static sanitizeNumericInput(
    input: unknown,
    options: { min?: number; max?: number; allowDecimal?: boolean } = {}
  ): number | null {
    if (input === null || input === undefined || input === '') {
      return null;
    }

    const numStr = String(input).trim();
    
    // Check for valid numeric format
    const numPattern = options.allowDecimal ? /^-?\d*\.?\d+$/ : /^-?\d+$/;
    
    if (!numPattern.test(numStr)) {
      return null;
    }

    const num = options.allowDecimal ? parseFloat(numStr) : parseInt(numStr, 10);
    
    if (isNaN(num)) {
      return null;
    }

    // Apply bounds checking
    if (options.min !== undefined && num < options.min) {
      return null;
    }
    
    if (options.max !== undefined && num > options.max) {
      return null;
    }

    return num;
  }

  /**
   * Removes dangerous patterns from text
   */
  private static removeDangerousPatterns(text: string): string {
    let cleaned = text;
    
    for (const pattern of DANGEROUS_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    return cleaned;
  }

  /**
   * Encodes HTML entities
   */
  private static htmlEntityEncode(text: string): string {
    return text.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
  }

  /**
   * Applies strict character filtering
   */
  private static applyStrictFiltering(text: string): string {
    // Only allow alphanumeric, spaces, and basic punctuation
    return text.replace(/[^\w\s\-&.,]/g, '');
  }

  /**
   * Validates input against common attack patterns
   */
  static containsAttackPatterns(input: string): boolean {
    const attackPatterns = [
      // SQL injection patterns
      /('|\\')|(;|%3B)|(\-\-|%2D%2D)/i,
      // XSS patterns
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      // Command injection patterns
      /(\||%7C|;|%3B|&|%26)/i,
      // Path traversal
      /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i,
      // LDAP injection
      /(\)|%29)|(\(|%28)|(\*|%2A)/i
    ];

    return attackPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Rate limiting helper for input processing
   */
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, number[]>();

    return (identifier: string): boolean => {
      const now = Date.now();
      const userRequests = requests.get(identifier) || [];
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => now - time < windowMs);
      
      if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
      }

      // Add current request
      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      return true; // Request allowed
    };
  }
}

// Export convenience functions
export const sanitizeText = InputSanitizer.sanitizeText;
export const sanitizeTimePointName = InputSanitizer.sanitizeTimePointName;
export const sanitizeFileName = InputSanitizer.sanitizeFileName;
export const sanitizeErrorMessage = InputSanitizer.sanitizeErrorMessage;
export const sanitizeTimeValue = InputSanitizer.sanitizeTimeValue;
export const sanitizeNumericInput = InputSanitizer.sanitizeNumericInput;
export const containsAttackPatterns = InputSanitizer.containsAttackPatterns;
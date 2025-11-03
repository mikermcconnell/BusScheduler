/**
 * Tests for Input Sanitizer Security Features
 */
import { InputSanitizer, sanitizeText, sanitizeTimePointName, sanitizeFileName, sanitizeErrorMessage } from './inputSanitizer';

describe('InputSanitizer Security Tests', () => {
  
  describe('XSS Prevention', () => {
    test('should remove script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>Normal Text';
      const result = sanitizeText(maliciousInput);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Normal Text');
    });

    test('should encode HTML entities', () => {
      const htmlInput = '<div>Test & "quoted" content</div>';
      const result = sanitizeText(htmlInput);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    test('should remove event handlers', () => {
      const maliciousInput = '<img src="x" onerror="alert(1)">';
      const result = sanitizeText(maliciousInput);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });
  });

  describe('Time Point Name Sanitization', () => {
    test('should sanitize normal time point names', () => {
      const result = sanitizeTimePointName('Main Street & 1st Avenue');
      expect(result).toBe('Main Street & 1st Avenue');
    });

    test('should remove dangerous characters', () => {
      const maliciousName = 'Station<script>alert("xss")</script>';
      const result = sanitizeTimePointName(maliciousName);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    test('should handle length limits', () => {
      const longName = 'A'.repeat(200);
      const result = sanitizeTimePointName(longName);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('File Name Sanitization', () => {
    test('should sanitize normal file names', () => {
      const result = sanitizeFileName('schedule_data.xlsx');
      expect(result).toBe('schedule_data.xlsx');
    });

    test('should remove dangerous characters', () => {
      const dangerousName = 'file<>"|?.exe';
      const result = sanitizeFileName(dangerousName);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('|');
      expect(result).not.toContain('?');
    });

    test('should prevent directory traversal', () => {
      const traversalName = '../../../etc/passwd';
      const result = sanitizeFileName(traversalName);
      expect(result).not.toContain('..');
    });
  });

  describe('Error Message Sanitization', () => {
    test('should remove file paths', () => {
      const errorWithPath = 'Error in C:\\Users\\John\\Documents\\file.txt';
      const result = sanitizeErrorMessage(errorWithPath);
      expect(result).toContain('[PATH]');
      expect(result).not.toContain('C:\\Users\\John');
    });

    test('should remove IP addresses', () => {
      const errorWithIP = 'Connection failed to 192.168.1.100';
      const result = sanitizeErrorMessage(errorWithIP);
      expect(result).toContain('[IP]');
      expect(result).not.toContain('192.168.1.100');
    });

    test('should remove email addresses', () => {
      const errorWithEmail = 'Failed to send to user@example.com';
      const result = sanitizeErrorMessage(errorWithEmail);
      expect(result).toContain('[EMAIL]');
      expect(result).not.toContain('user@example.com');
    });
  });

  describe('Attack Pattern Detection', () => {
    test('should detect SQL injection patterns', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = InputSanitizer.containsAttackPatterns(sqlInjection);
      expect(result).toBe(true);
    });

    test('should detect XSS patterns', () => {
      const xssPattern = 'javascript:alert(1)';
      const result = InputSanitizer.containsAttackPatterns(xssPattern);
      expect(result).toBe(true);
    });

    test('should detect command injection', () => {
      const cmdInjection = 'test | rm -rf /';
      const result = InputSanitizer.containsAttackPatterns(cmdInjection);
      expect(result).toBe(true);
    });

    test('should not flag normal text', () => {
      const normalText = 'Main Street Station';
      const result = InputSanitizer.containsAttackPatterns(normalText);
      expect(result).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within limit', () => {
      const rateLimiter = InputSanitizer.createRateLimiter(3, 60000);
      
      expect(rateLimiter('user1')).toBe(true);
      expect(rateLimiter('user1')).toBe(true);
      expect(rateLimiter('user1')).toBe(true);
    });

    test('should block requests exceeding limit', () => {
      const rateLimiter = InputSanitizer.createRateLimiter(2, 60000);
      
      expect(rateLimiter('user2')).toBe(true);
      expect(rateLimiter('user2')).toBe(true);
      expect(rateLimiter('user2')).toBe(false); // Should be blocked
    });
  });

  describe('Input Validation Edge Cases', () => {
    test('should handle null and undefined inputs', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeTimePointName(null)).toBe('Invalid_TimePoint');
    });

    test('should handle empty strings', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeTimePointName('')).toBe('Empty_TimePoint');
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeText(123)).toBe('123');
      expect(sanitizeText(true)).toBe('true');
      expect(sanitizeText({})).toBe('[object Object]');
    });
  });
});
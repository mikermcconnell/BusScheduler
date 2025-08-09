#!/usr/bin/env ts-node

/**
 * Security Validation Script
 * Tests the security implementations to ensure they're working correctly
 */

import { InputSanitizer, sanitizeText, sanitizeTimePointName, sanitizeFileName, sanitizeErrorMessage } from './src/utils/inputSanitizer';

interface TestCase {
  name: string;
  input: any;
  expectedToContain?: string[];
  expectedNotToContain?: string[];
  test: (input: any) => string | boolean;
}

const securityTests: TestCase[] = [
  {
    name: 'XSS Prevention - Script Tag Removal',
    input: '<script>alert("XSS")</script>Normal Text',
    expectedNotToContain: ['<script>', 'alert'],
    expectedToContain: ['Normal Text'],
    test: sanitizeText
  },
  {
    name: 'HTML Entity Encoding',
    input: '<div>Test & "quoted" content</div>',
    expectedToContain: ['&lt;', '&gt;', '&amp;', '&quot;'],
    test: sanitizeText
  },
  {
    name: 'Time Point Name Sanitization',
    input: 'Station<script>alert("xss")</script>',
    expectedNotToContain: ['<script>', 'alert'],
    test: sanitizeTimePointName
  },
  {
    name: 'File Name Directory Traversal Prevention',
    input: '../../../etc/passwd',
    expectedNotToContain: ['..'],
    test: sanitizeFileName
  },
  {
    name: 'Error Message Path Sanitization',
    input: 'Error in C:\\Users\\John\\Documents\\file.txt',
    expectedToContain: ['[PATH]'],
    expectedNotToContain: ['C:\\Users\\John'],
    test: sanitizeErrorMessage
  },
  {
    name: 'SQL Injection Pattern Detection',
    input: "'; DROP TABLE users; --",
    expectedToContain: [true],
    test: (input: string) => InputSanitizer.containsAttackPatterns(input)
  },
  {
    name: 'XSS Pattern Detection',
    input: 'javascript:alert(1)',
    expectedToContain: [true],
    test: (input: string) => InputSanitizer.containsAttackPatterns(input)
  },
  {
    name: 'Normal Text Should Not Trigger Attack Detection',
    input: 'Main Street Station',
    expectedToContain: [false],
    test: (input: string) => InputSanitizer.containsAttackPatterns(input)
  }
];

function runSecurityValidation() {
  console.log('🔒 Starting Security Validation Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  securityTests.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    
    try {
      const result = testCase.test(testCase.input);
      const resultStr = typeof result === 'boolean' ? result.toString() : result;
      
      console.log(`Output: "${resultStr}"`);
      
      let testPassed = true;
      
      // Check expected to contain
      if (testCase.expectedToContain) {
        for (const expected of testCase.expectedToContain) {
          if (!resultStr.includes(expected.toString())) {
            console.log(`❌ Expected to contain: "${expected}"`);
            testPassed = false;
          }
        }
      }
      
      // Check expected not to contain
      if (testCase.expectedNotToContain) {
        for (const notExpected of testCase.expectedNotToContain) {
          if (resultStr.includes(notExpected)) {
            console.log(`❌ Expected NOT to contain: "${notExpected}"`);
            testPassed = false;
          }
        }
      }
      
      if (testPassed) {
        console.log('✅ PASSED\n');
        passed++;
      } else {
        console.log('❌ FAILED\n');
        failed++;
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error}\n`);
      failed++;
    }
  });
  
  // Rate limiting test
  console.log('Test: Rate Limiting');
  const rateLimiter = InputSanitizer.createRateLimiter(2, 60000);
  const result1 = rateLimiter('test-user');
  const result2 = rateLimiter('test-user');
  const result3 = rateLimiter('test-user'); // Should be blocked
  
  if (result1 && result2 && !result3) {
    console.log('✅ Rate limiting working correctly\n');
    passed++;
  } else {
    console.log('❌ Rate limiting failed\n');
    failed++;
  }
  
  // Summary
  console.log('🔒 Security Validation Summary');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All security tests passed! The implementation is secure.');
  } else {
    console.log('\n⚠️  Some security tests failed. Please review the implementation.');
  }
}

// Check if we're running this directly
if (require.main === module) {
  runSecurityValidation();
}

export default runSecurityValidation;
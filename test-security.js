// Quick security test script
const { InputSanitizer } = require('./src/utils/inputSanitizer.ts');

console.log('Testing security implementations...');

// Test XSS prevention
const xssInput = '<script>alert("XSS")</script>Normal Text';
console.log('XSS Input:', xssInput);
console.log('Sanitized:', InputSanitizer.sanitizeText(xssInput));

// Test SQL injection detection
const sqlInject = "'; DROP TABLE users; --";
console.log('SQL Injection detected:', InputSanitizer.containsAttackPatterns(sqlInject));

// Test file name sanitization
const dangerousFile = '../../../etc/passwd<script>alert(1)</script>';
console.log('Dangerous filename:', dangerousFile);
console.log('Sanitized filename:', InputSanitizer.sanitizeFileName(dangerousFile));

console.log('Security tests completed!');
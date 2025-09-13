#!/usr/bin/env node

/**
 * Test Runner for Workflow Persistence System
 * Comprehensive test execution with reporting and performance metrics
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function executeTest(testType, configPath, description) {
  log(`\n${colors.bright}🧪 Running ${testType} Tests${colors.reset}`);
  log(`${colors.cyan}${description}${colors.reset}`);
  
  const startTime = Date.now();
  
  try {
    const command = `npx jest --config ${configPath} --verbose --coverage`;
    log(`\n${colors.yellow}Executing: ${command}${colors.reset}`);
    
    const result = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      timeout: 300000 // 5 minutes timeout
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n${colors.green}✅ ${testType} tests completed in ${elapsed}s${colors.reset}`);
    
    return { success: true, elapsed: parseFloat(elapsed) };
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n${colors.red}❌ ${testType} tests failed after ${elapsed}s${colors.reset}`);
    log(`${colors.red}Error: ${error.message}${colors.reset}`);
    
    return { success: false, elapsed: parseFloat(elapsed), error: error.message };
  }
}

function generateSummaryReport(results) {
  log(`\n${colors.bright}📊 Test Execution Summary${colors.reset}`);
  log('═'.repeat(80));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);
  
  log(`\n${colors.cyan}Overall Results:${colors.reset}`);
  log(`  Total Test Suites: ${totalTests}`);
  log(`  ${colors.green}Passed: ${passedTests}${colors.reset}`);
  log(`  ${colors.red}Failed: ${failedTests}${colors.reset}`);
  log(`  Total Time: ${totalTime.toFixed(2)}s`);
  
  log(`\n${colors.cyan}Individual Results:${colors.reset}`);
  
  results.forEach((result, index) => {
    const status = result.success ? 
      `${colors.green}✅ PASS${colors.reset}` : 
      `${colors.red}❌ FAIL${colors.reset}`;
    
    log(`  ${index + 1}. ${result.name}: ${status} (${result.elapsed.toFixed(2)}s)`);
    
    if (!result.success && result.error) {
      log(`     ${colors.red}Error: ${result.error}${colors.reset}`);
    }
  });
  
  // Performance insights
  const slowestTest = results.reduce((prev, current) => 
    current.elapsed > prev.elapsed ? current : prev
  );
  
  if (slowestTest.elapsed > 30) {
    log(`\n${colors.yellow}⚠️  Performance Warning:${colors.reset}`);
    log(`  Slowest test suite: ${slowestTest.name} (${slowestTest.elapsed.toFixed(2)}s)`);
    log(`  Consider optimizing if this exceeds expected performance thresholds.`);
  }
  
  return {
    totalTests,
    passedTests,
    failedTests,
    totalTime,
    allPassed: failedTests === 0
  };
}

function createTestReport(summary) {
  const reportPath = path.join(__dirname, '../test-reports/workflow-persistence-summary.json');
  const reportDir = path.dirname(reportPath);
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    summary,
    recommendations: []
  };
  
  // Add recommendations based on results
  if (summary.totalTime > 120) {
    report.recommendations.push({
      type: 'performance',
      message: 'Total test execution time exceeds 2 minutes. Consider parallel execution or test optimization.'
    });
  }
  
  if (summary.failedTests > 0) {
    report.recommendations.push({
      type: 'reliability',
      message: 'Some tests failed. Review failure logs and fix issues before deployment.'
    });
  }
  
  if (summary.passedTests === summary.totalTests) {
    report.recommendations.push({
      type: 'success',
      message: 'All workflow persistence tests passed! System is ready for production.'
    });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n${colors.blue}📄 Detailed report saved to: ${reportPath}${colors.reset}`);
}

async function main() {
  log(`${colors.bright}${colors.magenta}`);
  log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  log('║                    WORKFLOW PERSISTENCE TEST SUITE                           ║');
  log('║                         Phase 5: Testing & Optimization                      ║');
  log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  log(`${colors.reset}`);
  
  const testSuites = [
    {
      name: 'Unit Tests - DraftService',
      config: 'jest.config.workflow.js',
      pattern: 'src/services/__tests__/draftService.test.ts',
      description: 'Testing Firebase sync, conflict resolution, version control, and retry mechanisms'
    },
    {
      name: 'Unit Tests - OfflineQueue',
      config: 'jest.config.workflow.js',
      pattern: 'src/services/__tests__/offlineQueue.test.ts',
      description: 'Testing queue operations, exponential backoff, and duplicate prevention'
    },
    {
      name: 'Component Tests - SyncStatusIndicator',
      config: 'jest.config.workflow.js',
      pattern: 'src/components/__tests__/SyncStatusIndicator.test.tsx',
      description: 'Testing sync status display, user interactions, and real-time updates'
    },
    {
      name: 'Integration Tests - Workflow Persistence',
      config: 'jest.config.workflow.js',
      pattern: 'src/integration/__tests__/workflowPersistence.test.ts',
      description: 'Testing complete workflow state restoration and cross-refresh persistence'
    },
    {
      name: 'Performance Tests - System Optimization',
      config: 'jest.config.workflow.js',
      pattern: 'src/performance/__tests__/workflowPersistence.performance.test.ts',
      description: 'Testing save latency, memory usage, and scalability under load'
    }
  ];
  
  const results = [];
  
  // Execute each test suite
  for (let i = 0; i < testSuites.length; i++) {
    const suite = testSuites[i];
    log(`\n${colors.yellow}[${i + 1}/${testSuites.length}] Starting ${suite.name}...${colors.reset}`);
    
    // Create temporary Jest config that targets specific test
    const tempConfig = `
      const baseConfig = require('./jest.config.workflow.js');
      module.exports = {
        ...baseConfig,
        testMatch: ['<rootDir>/${suite.pattern}'],
        collectCoverage: ${i === testSuites.length - 1}, // Only collect coverage on last run
        verbose: true
      };
    `;
    
    const tempConfigPath = path.join(__dirname, `../jest.config.temp.${i}.js`);
    fs.writeFileSync(tempConfigPath, tempConfig);
    
    try {
      const result = executeTest(suite.name, tempConfigPath, suite.description);
      results.push({ ...result, name: suite.name });
    } finally {
      // Clean up temp config
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }
    }
  }
  
  // Generate summary
  const summary = generateSummaryReport(results);
  createTestReport(summary);
  
  // Final status
  log(`\n${colors.bright}`);
  if (summary.allPassed) {
    log(`${colors.green}🎉 ALL WORKFLOW PERSISTENCE TESTS PASSED!${colors.reset}`);
    log(`${colors.green}The workflow persistence system is ready for production.${colors.reset}`);
    process.exit(0);
  } else {
    log(`${colors.red}💥 SOME TESTS FAILED${colors.reset}`);
    log(`${colors.red}Please review the failures and fix issues before deploying.${colors.reset}`);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  log(`${colors.cyan}Workflow Persistence Test Runner${colors.reset}`);
  log('\nUsage: node test-workflow-persistence.js [options]');
  log('\nOptions:');
  log('  --help, -h     Show this help message');
  log('  --quiet, -q    Reduce output verbosity');
  log('  --fast         Skip performance tests for faster execution');
  log('\nThis script runs comprehensive tests for the workflow persistence system,');
  log('including unit tests, integration tests, component tests, and performance tests.');
  process.exit(0);
}

// Run the test suite
main().catch((error) => {
  log(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
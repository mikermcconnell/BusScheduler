/**
 * Integration Test Reporter
 * Generates comprehensive test reports with metrics, performance data, and recommendations
 */

export interface TestResult {
  suiteName: string;
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  metadata?: {
    category: 'event-bus' | 'panel-state' | 'data-integrity' | 'ui-responsive' | 'error-handling' | 'security' | 'performance' | 'browser-compat';
    priority: 'critical' | 'high' | 'medium' | 'low';
    tags: string[];
  };
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'pass' | 'warn' | 'fail';
  context?: string;
}

export interface BrowserCompatResult {
  browser: string;
  version?: string;
  testsPassed: number;
  testsFailed: number;
  issues: string[];
}

export interface SecurityTestResult {
  testName: string;
  vulnerability: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pass' | 'fail';
  details: string;
}

export interface TestReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    passRate: number;
    startTime: string;
    endTime: string;
  };
  suites: {
    name: string;
    tests: TestResult[];
    duration: number;
    passRate: number;
  }[];
  performance: {
    metrics: PerformanceMetric[];
    benchmarks: {
      panelOpenTime: number[];
      eventPropagationTime: number[];
      dataProcessingTime: number[];
      memoryUsage: number[];
    };
    summary: {
      avgPanelOpenTime: number;
      avgEventPropagationTime: number;
      avgDataProcessingTime: number;
      peakMemoryUsage: number;
    };
  };
  security: SecurityTestResult[];
  browserCompatibility: BrowserCompatResult[];
  coverage: {
    eventTypes: string[];
    panelInteractions: string[];
    dataFlows: string[];
    errorScenarios: string[];
  };
  recommendations: {
    critical: string[];
    performance: string[];
    security: string[];
    usability: string[];
  };
  artifacts: {
    eventLogs: string;
    performanceLogs: string;
    screenshots: string[];
    networkLogs?: string;
  };
}

export class IntegrationTestReporter {
  private results: TestResult[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private securityResults: SecurityTestResult[] = [];
  private browserResults: BrowserCompatResult[] = [];
  private startTime: Date;
  private endTime?: Date;
  private artifacts: TestReport['artifacts'] = {
    eventLogs: '',
    performanceLogs: '',
    screenshots: []
  };

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Record test result
   */
  recordTest(result: TestResult): void {
    this.results.push({
      ...result,
      metadata: {
        category: 'panel-state',
        priority: 'medium',
        tags: [],
        ...result.metadata
      }
    });
  }

  /**
   * Record performance metric
   */
  recordPerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
  }

  /**
   * Record security test result
   */
  recordSecurity(result: SecurityTestResult): void {
    this.securityResults.push(result);
  }

  /**
   * Record browser compatibility result
   */
  recordBrowserCompat(result: BrowserCompatResult): void {
    this.browserResults.push(result);
  }

  /**
   * Add artifact
   */
  addArtifact(type: keyof TestReport['artifacts'], content: string): void {
    if (type === 'screenshots') {
      this.artifacts.screenshots.push(content);
    } else {
      this.artifacts[type] = content;
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport(): TestReport {
    this.endTime = new Date();
    
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    const totalDuration = this.endTime.getTime() - this.startTime.getTime();

    // Group tests by suite
    const suiteMap = new Map<string, TestResult[]>();
    this.results.forEach(result => {
      if (!suiteMap.has(result.suiteName)) {
        suiteMap.set(result.suiteName, []);
      }
      suiteMap.get(result.suiteName)!.push(result);
    });

    const suites = Array.from(suiteMap.entries()).map(([name, tests]) => ({
      name,
      tests,
      duration: tests.reduce((sum, t) => sum + t.duration, 0),
      passRate: tests.filter(t => t.status === 'pass').length / tests.length * 100
    }));

    // Performance analysis
    const performanceBenchmarks = this.analyzePerformance();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();

    // Coverage analysis
    const coverage = this.analyzeCoverage();

    return {
      summary: {
        totalTests,
        passed,
        failed,
        skipped,
        duration: totalDuration,
        passRate: totalTests > 0 ? (passed / totalTests) * 100 : 0,
        startTime: this.startTime.toISOString(),
        endTime: this.endTime.toISOString()
      },
      suites,
      performance: {
        metrics: this.performanceMetrics,
        benchmarks: performanceBenchmarks,
        summary: {
          avgPanelOpenTime: this.average(performanceBenchmarks.panelOpenTime),
          avgEventPropagationTime: this.average(performanceBenchmarks.eventPropagationTime),
          avgDataProcessingTime: this.average(performanceBenchmarks.dataProcessingTime),
          peakMemoryUsage: Math.max(...performanceBenchmarks.memoryUsage, 0)
        }
      },
      security: this.securityResults,
      browserCompatibility: this.browserResults,
      coverage,
      recommendations,
      artifacts: this.artifacts
    };
  }

  /**
   * Analyze performance metrics
   */
  private analyzePerformance() {
    const panelOpenMetrics = this.performanceMetrics.filter(m => m.name.includes('panel-open'));
    const eventPropagationMetrics = this.performanceMetrics.filter(m => m.name.includes('event-propagation'));
    const dataProcessingMetrics = this.performanceMetrics.filter(m => m.name.includes('data-processing'));
    const memoryMetrics = this.performanceMetrics.filter(m => m.name.includes('memory'));

    return {
      panelOpenTime: panelOpenMetrics.map(m => m.value),
      eventPropagationTime: eventPropagationMetrics.map(m => m.value),
      dataProcessingTime: dataProcessingMetrics.map(m => m.value),
      memoryUsage: memoryMetrics.map(m => m.value)
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(): TestReport['recommendations'] {
    const recommendations: TestReport['recommendations'] = {
      critical: [],
      performance: [],
      security: [],
      usability: []
    };

    // Critical issues
    const criticalFailures = this.results.filter(r => 
      r.status === 'fail' && r.metadata?.priority === 'critical'
    );
    
    if (criticalFailures.length > 0) {
      recommendations.critical.push(
        `${criticalFailures.length} critical test(s) failed. These must be resolved before production deployment.`
      );
    }

    // Performance recommendations
    const slowPanelOpenMetrics = this.performanceMetrics.filter(m => 
      m.name.includes('panel-open') && m.threshold && m.value > m.threshold
    );
    
    if (slowPanelOpenMetrics.length > 0) {
      recommendations.performance.push(
        `Panel opening times exceed thresholds. Consider implementing virtualization or lazy loading for ${slowPanelOpenMetrics.length} panel(s).`
      );
    }

    const highMemoryMetrics = this.performanceMetrics.filter(m => 
      m.name.includes('memory') && m.value > 50 * 1024 * 1024 // 50MB
    );
    
    if (highMemoryMetrics.length > 0) {
      recommendations.performance.push(
        'Memory usage is high. Consider implementing data pagination and cleanup strategies.'
      );
    }

    // Security recommendations
    const securityFailures = this.securityResults.filter(r => r.status === 'fail');
    if (securityFailures.length > 0) {
      recommendations.security.push(
        `${securityFailures.length} security vulnerability(ies) detected. Review input sanitization and validation.`
      );
    }

    const criticalSecurityIssues = securityFailures.filter(r => r.severity === 'critical');
    if (criticalSecurityIssues.length > 0) {
      recommendations.critical.push(
        `Critical security vulnerabilities found: ${criticalSecurityIssues.map(s => s.vulnerability).join(', ')}`
      );
    }

    // Browser compatibility recommendations
    const browserIssues = this.browserResults.filter(r => r.testsFailed > 0);
    if (browserIssues.length > 0) {
      recommendations.usability.push(
        `Browser compatibility issues found in: ${browserIssues.map(b => b.browser).join(', ')}. Consider polyfills or fallback implementations.`
      );
    }

    // Event bus recommendations
    const eventBusFailures = this.results.filter(r => 
      r.status === 'fail' && r.metadata?.category === 'event-bus'
    );
    
    if (eventBusFailures.length > 0) {
      recommendations.critical.push(
        'Event bus communication failures detected. This will break panel coordination.'
      );
    }

    return recommendations;
  }

  /**
   * Analyze test coverage
   */
  private analyzeCoverage(): TestReport['coverage'] {
    const eventTypes = new Set<string>();
    const panelInteractions = new Set<string>();
    const dataFlows = new Set<string>();
    const errorScenarios = new Set<string>();

    this.results.forEach(result => {
      if (result.metadata?.tags) {
        result.metadata.tags.forEach(tag => {
          if (tag.startsWith('event:')) {
            eventTypes.add(tag.substring(6));
          } else if (tag.startsWith('panel:')) {
            panelInteractions.add(tag.substring(6));
          } else if (tag.startsWith('data:')) {
            dataFlows.add(tag.substring(5));
          } else if (tag.startsWith('error:')) {
            errorScenarios.add(tag.substring(6));
          }
        });
      }
    });

    return {
      eventTypes: Array.from(eventTypes),
      panelInteractions: Array.from(panelInteractions),
      dataFlows: Array.from(dataFlows),
      errorScenarios: Array.from(errorScenarios)
    };
  }

  /**
   * Calculate average of array
   */
  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  /**
   * Export report as JSON
   */
  exportJSON(report: TestReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as HTML
   */
  exportHTML(report: TestReport): string {
    const { summary, suites, performance, security, browserCompatibility, recommendations } = report;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schedule Command Center Integration Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1976d2; margin: 0 0 10px 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric .value { font-size: 24px; font-weight: bold; color: #1976d2; }
        .metric .label { font-size: 14px; color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px; }
        .test-suite { margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 6px; }
        .test-suite h3 { margin: 0 0 10px 0; color: #1976d2; }
        .test-result { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
        .test-result:last-child { border-bottom: none; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.pass { background: #e8f5e8; color: #2e7d32; }
        .status.fail { background: #ffebee; color: #c62828; }
        .status.skip { background: #f3e5f5; color: #7b1fa2; }
        .performance-chart { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
        .recommendation { margin-bottom: 10px; padding: 10px; border-radius: 4px; }
        .recommendation.critical { background: #ffebee; border-left: 4px solid #f44336; }
        .recommendation.performance { background: #fff3e0; border-left: 4px solid #ff9800; }
        .recommendation.security { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .recommendation.usability { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .pass-rate { font-weight: bold; }
        .pass-rate.excellent { color: #4caf50; }
        .pass-rate.good { color: #8bc34a; }
        .pass-rate.warning { color: #ff9800; }
        .pass-rate.poor { color: #f44336; }
        .browser-compat { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .browser-result { background: #f8f9fa; padding: 15px; border-radius: 6px; }
        .security-results { margin-bottom: 20px; }
        .security-result { display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; border-radius: 4px; }
        .security-result.pass { background: #e8f5e8; }
        .security-result.fail { background: #ffebee; }
        .severity { padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .severity.critical { background: #f44336; color: white; }
        .severity.high { background: #ff5722; color: white; }
        .severity.medium { background: #ff9800; color: white; }
        .severity.low { background: #4caf50; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Schedule Command Center Integration Test Report</h1>
            <p>Generated on ${new Date(report.summary.endTime).toLocaleString()}</p>
            <p>Test Duration: ${Math.round(report.summary.duration / 1000)}s</p>
        </div>

        <div class="section">
            <h2>Executive Summary</h2>
            <div class="summary">
                <div class="metric">
                    <div class="value">${summary.totalTests}</div>
                    <div class="label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="value">${summary.passed}</div>
                    <div class="label">Passed</div>
                </div>
                <div class="metric">
                    <div class="value">${summary.failed}</div>
                    <div class="label">Failed</div>
                </div>
                <div class="metric">
                    <div class="value">${summary.skipped}</div>
                    <div class="label">Skipped</div>
                </div>
                <div class="metric">
                    <div class="value pass-rate ${this.getPassRateClass(summary.passRate)}">${summary.passRate.toFixed(1)}%</div>
                    <div class="label">Pass Rate</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Test Suites</h2>
            ${suites.map(suite => `
                <div class="test-suite">
                    <h3>${suite.name}</h3>
                    <p>Pass Rate: <span class="pass-rate ${this.getPassRateClass(suite.passRate)}">${suite.passRate.toFixed(1)}%</span> | Duration: ${Math.round(suite.duration)}ms</p>
                    ${suite.tests.map(test => `
                        <div class="test-result">
                            <span>${test.testName}</span>
                            <div>
                                <span class="status ${test.status}">${test.status.toUpperCase()}</span>
                                <span style="margin-left: 10px; color: #666;">${test.duration.toFixed(1)}ms</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="performance-chart">
                <h4>Key Performance Indicators</h4>
                <p><strong>Average Panel Open Time:</strong> ${performance.summary.avgPanelOpenTime.toFixed(1)}ms</p>
                <p><strong>Average Event Propagation Time:</strong> ${performance.summary.avgEventPropagationTime.toFixed(1)}ms</p>
                <p><strong>Average Data Processing Time:</strong> ${performance.summary.avgDataProcessingTime.toFixed(1)}ms</p>
                <p><strong>Peak Memory Usage:</strong> ${(performance.summary.peakMemoryUsage / (1024*1024)).toFixed(1)}MB</p>
            </div>
            
            <h4>Detailed Metrics</h4>
            ${performance.metrics.map(metric => `
                <div class="metric" style="text-align: left; margin-bottom: 10px;">
                    <strong>${metric.name}:</strong> ${metric.value.toFixed(2)}${metric.unit}
                    ${metric.threshold ? `(Threshold: ${metric.threshold}${metric.unit})` : ''}
                    <span class="status ${metric.status}" style="margin-left: 10px;">${metric.status.toUpperCase()}</span>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Security Test Results</h2>
            <div class="security-results">
                ${security.map(result => `
                    <div class="security-result ${result.status}">
                        <div>
                            <strong>${result.testName}</strong>
                            <br>
                            <span style="font-size: 14px; color: #666;">${result.vulnerability}</span>
                        </div>
                        <div>
                            <span class="severity ${result.severity}">${result.severity}</span>
                            <span class="status ${result.status}" style="margin-left: 8px;">${result.status.toUpperCase()}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <h2>Browser Compatibility</h2>
            <div class="browser-compat">
                ${browserCompatibility.map(browser => `
                    <div class="browser-result">
                        <h4>${browser.browser} ${browser.version || ''}</h4>
                        <p><strong>Passed:</strong> ${browser.testsPassed}</p>
                        <p><strong>Failed:</strong> ${browser.testsFailed}</p>
                        ${browser.issues.length > 0 ? `
                            <p><strong>Issues:</strong></p>
                            <ul>
                                ${browser.issues.map(issue => `<li>${issue}</li>`).join('')}
                            </ul>
                        ` : '<p style="color: #4caf50;"><strong>No issues found</strong></p>'}
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            ${Object.entries(recommendations).map(([category, items]) => 
                items.length > 0 ? `
                    <h4>${category.charAt(0).toUpperCase() + category.slice(1)} Recommendations</h4>
                    ${items.map(item => `
                        <div class="recommendation ${category}">
                            ${item}
                        </div>
                    `).join('')}
                ` : ''
            ).join('')}
        </div>

        <div class="section">
            <h2>Test Coverage</h2>
            <p><strong>Event Types Tested:</strong> ${report.coverage.eventTypes.join(', ') || 'None'}</p>
            <p><strong>Panel Interactions:</strong> ${report.coverage.panelInteractions.join(', ') || 'None'}</p>
            <p><strong>Data Flows:</strong> ${report.coverage.dataFlows.join(', ') || 'None'}</p>
            <p><strong>Error Scenarios:</strong> ${report.coverage.errorScenarios.join(', ') || 'None'}</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get CSS class for pass rate visualization
   */
  private getPassRateClass(passRate: number): string {
    if (passRate >= 95) return 'excellent';
    if (passRate >= 85) return 'good';
    if (passRate >= 70) return 'warning';
    return 'poor';
  }

  /**
   * Export report as CSV for data analysis
   */
  exportCSV(report: TestReport): string {
    const headers = ['Suite', 'Test', 'Status', 'Duration (ms)', 'Category', 'Priority', 'Error'];
    const rows = [headers.join(',')];

    report.suites.forEach(suite => {
      suite.tests.forEach(test => {
        const row = [
          `"${suite.name}"`,
          `"${test.testName}"`,
          test.status,
          test.duration.toString(),
          test.metadata?.category || '',
          test.metadata?.priority || '',
          `"${test.error || ''}"`
        ];
        rows.push(row.join(','));
      });
    });

    return rows.join('\n');
  }

  /**
   * Reset reporter for new test run
   */
  reset(): void {
    this.results = [];
    this.performanceMetrics = [];
    this.securityResults = [];
    this.browserResults = [];
    this.startTime = new Date();
    this.endTime = undefined;
    this.artifacts = {
      eventLogs: '',
      performanceLogs: '',
      screenshots: []
    };
  }
}

export default IntegrationTestReporter;
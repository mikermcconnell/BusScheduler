/**
 * Audit Logger Service
 * Comprehensive logging for compliance and debugging
 */

import React from 'react';

const SECURITY_API_BASE =
  (process.env.REACT_APP_SECURITY_API_BASE_URL || '').replace(/\/$/, '');
const DEFAULT_REMOTE_ENDPOINT = SECURITY_API_BASE
  ? `${SECURITY_API_BASE}/audit`
  : '/api/audit';

export enum AuditEventType {
  // Authentication events
  LOGIN = 'AUTH_LOGIN',
  LOGOUT = 'AUTH_LOGOUT',
  LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  
  // Schedule operations
  SCHEDULE_CREATED = 'SCHEDULE_CREATED',
  SCHEDULE_UPDATED = 'SCHEDULE_UPDATED',
  SCHEDULE_DELETED = 'SCHEDULE_DELETED',
  SCHEDULE_PUBLISHED = 'SCHEDULE_PUBLISHED',
  SCHEDULE_EXPORTED = 'SCHEDULE_EXPORTED',
  
  // Data operations
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_DELETED = 'FILE_DELETED',
  DATA_IMPORTED = 'DATA_IMPORTED',
  DATA_EXPORTED = 'DATA_EXPORTED',
  
  // Configuration changes
  CONFIG_UPDATED = 'CONFIG_UPDATED',
  TEMPLATE_CREATED = 'TEMPLATE_CREATED',
  TEMPLATE_UPDATED = 'TEMPLATE_UPDATED',
  TEMPLATE_DELETED = 'TEMPLATE_DELETED',
  
  // Security events
  PERMISSION_DENIED = 'SECURITY_PERMISSION_DENIED',
  CSRF_VIOLATION = 'SECURITY_CSRF_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'SECURITY_RATE_LIMIT_EXCEEDED',
  XSS_BLOCKED = 'SECURITY_XSS_BLOCKED',
  
  // System events
  ERROR_OCCURRED = 'SYSTEM_ERROR',
  WARNING_RAISED = 'SYSTEM_WARNING',
  PERFORMANCE_ISSUE = 'SYSTEM_PERFORMANCE'
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userName?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action: string;
  result: 'success' | 'failure';
  details?: any;
  errorMessage?: string;
  stackTrace?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

interface AuditLogOptions {
  maxLocalLogs?: number;
  remoteEndpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  enableConsoleLog?: boolean;
  enableLocalStorage?: boolean;
  enableRemoteLogging?: boolean;
}

class AuditLogger {
  private logs: AuditLog[] = [];
  private options: Required<AuditLogOptions>;
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;

  constructor(options: AuditLogOptions = {}) {
    this.options = {
      maxLocalLogs: 1000,
      remoteEndpoint: DEFAULT_REMOTE_ENDPOINT,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      enableConsoleLog: true,
      enableLocalStorage: true,
      enableRemoteLogging: false,
      ...options
    };

    this.sessionId = this.generateSessionId();
    this.loadStoredLogs();
    this.startBatchTimer();
  }

  /**
   * Log an audit event
   */
  log(
    eventType: AuditEventType,
    action: string,
    details?: any,
    options: Partial<AuditLog> = {}
  ): void {
    const log: AuditLog = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      eventType,
      severity: this.determineSeverity(eventType),
      sessionId: this.sessionId,
      action,
      result: options.result || 'success',
      details,
      userId: this.getCurrentUserId(),
      userName: this.getCurrentUserName(),
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      ...options
    };

    // Add to local logs
    this.addLog(log);

    // Console logging
    if (this.options.enableConsoleLog) {
      this.consoleLog(log);
    }

    // Check if batch should be sent
    if (this.logs.length >= this.options.batchSize) {
      this.flushLogs();
    }
  }

  /**
   * Log a security event
   */
  logSecurity(
    eventType: AuditEventType,
    details: any,
    severity: AuditSeverity = AuditSeverity.WARNING
  ): void {
    this.log(eventType, 'Security Event', details, {
      severity,
      result: 'failure'
    });
  }

  /**
   * Log an error
   */
  logError(
    action: string,
    error: Error,
    details?: any
  ): void {
    this.log(AuditEventType.ERROR_OCCURRED, action, details, {
      severity: AuditSeverity.ERROR,
      result: 'failure',
      errorMessage: error.message,
      stackTrace: error.stack
    });
  }

  /**
   * Log a performance issue
   */
  logPerformance(
    action: string,
    duration: number,
    threshold: number,
    details?: any
  ): void {
    if (duration > threshold) {
      this.log(AuditEventType.PERFORMANCE_ISSUE, action, details, {
        severity: AuditSeverity.WARNING,
        duration,
        metadata: {
          threshold,
          exceeded: duration - threshold
        }
      });
    }
  }

  /**
   * Create audit trail for an operation
   */
  createAuditTrail(operation: string): {
    start: () => void;
    end: (result: 'success' | 'failure', details?: any) => void;
    error: (error: Error) => void;
  } {
    const startTime = Date.now();
    let operationId = this.generateLogId();

    return {
      start: () => {
        this.log(AuditEventType.SCHEDULE_UPDATED, `${operation} started`, null, {
          metadata: { operationId, phase: 'start' }
        });
      },
      end: (result: 'success' | 'failure', details?: any) => {
        const duration = Date.now() - startTime;
        this.log(AuditEventType.SCHEDULE_UPDATED, `${operation} completed`, details, {
          result,
          duration,
          metadata: { operationId, phase: 'end' }
        });
      },
      error: (error: Error) => {
        const duration = Date.now() - startTime;
        this.logError(`${operation} failed`, error, {
          duration,
          operationId
        });
      }
    };
  }

  /**
   * Get audit logs with filtering
   */
  getLogs(filters?: {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLog[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.eventType) {
        filteredLogs = filteredLogs.filter(log => log.eventType === filters.eventType);
      }
      if (filters.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
      }
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(
          log => new Date(log.timestamp) >= filters.startDate!
        );
      }
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(
          log => new Date(log.timestamp) <= filters.endDate!
        );
      }
      if (filters.limit) {
        filteredLogs = filteredLogs.slice(0, filters.limit);
      }
    }

    return filteredLogs;
  }

  /**
   * Export logs to CSV
   */
  exportToCSV(): string {
    const headers = [
      'ID', 'Timestamp', 'Event Type', 'Severity', 'User ID', 
      'User Name', 'Action', 'Result', 'Details', 'Duration'
    ];

    const rows = this.logs.map(log => [
      log.id,
      log.timestamp,
      log.eventType,
      log.severity,
      log.userId || '',
      log.userName || '',
      log.action,
      log.result,
      JSON.stringify(log.details || {}),
      log.duration || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Clear old logs
   */
  clearOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.logs = this.logs.filter(
      log => new Date(log.timestamp) > cutoffDate
    );

    this.saveToLocalStorage();
  }

  // Private methods

  private addLog(log: AuditLog): void {
    this.logs.unshift(log);

    // Trim logs if exceeding max
    if (this.logs.length > this.options.maxLocalLogs) {
      this.logs = this.logs.slice(0, this.options.maxLocalLogs);
    }

    // Save to local storage
    if (this.options.enableLocalStorage) {
      this.saveToLocalStorage();
    }
  }

  private determineSeverity(eventType: AuditEventType): AuditSeverity {
    if (eventType.startsWith('SECURITY_')) {
      return AuditSeverity.WARNING;
    }
    if (eventType.includes('ERROR')) {
      return AuditSeverity.ERROR;
    }
    if (eventType.includes('FAILED')) {
      return AuditSeverity.WARNING;
    }
    return AuditSeverity.INFO;
  }

  private consoleLog(log: AuditLog): void {
    const style = this.getConsoleStyle(log.severity);
    const message = `[AUDIT] ${log.timestamp} | ${log.eventType} | ${log.action}`;
    
    console.log(`%c${message}`, style, log.details || '');
  }

  private getConsoleStyle(severity: AuditSeverity): string {
    switch (severity) {
      case AuditSeverity.ERROR:
        return 'color: red; font-weight: bold';
      case AuditSeverity.WARNING:
        return 'color: orange; font-weight: bold';
      case AuditSeverity.CRITICAL:
        return 'color: red; background: yellow; font-weight: bold';
      default:
        return 'color: blue';
    }
  }

  private async flushLogs(): Promise<void> {
    if (!this.options.enableRemoteLogging || this.logs.length === 0) {
      return;
    }

    const logsToSend = this.logs.splice(0, this.options.batchSize);

    try {
      await fetch(this.options.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: logsToSend })
      });
    } catch (error) {
      console.error('Failed to send audit logs:', error);
      // Re-add logs to queue
      this.logs.unshift(...logsToSend);
    }
  }

  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      this.flushLogs();
    }, this.options.flushInterval);
  }

  private saveToLocalStorage(): void {
    try {
      const key = 'audit_logs';
      const data = JSON.stringify(this.logs.slice(0, 100)); // Only store recent 100
      localStorage.setItem(key, data);
    } catch (error) {
      console.warn('Failed to save audit logs to localStorage:', error);
    }
  }

  private loadStoredLogs(): void {
    if (!this.options.enableLocalStorage) return;

    try {
      const key = 'audit_logs';
      const stored = localStorage.getItem(key);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load audit logs from localStorage:', error);
    }
  }

  private generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string | undefined {
    // This should be integrated with your auth system
    return sessionStorage.getItem('userId') || undefined;
  }

  private getCurrentUserName(): string | undefined {
    // This should be integrated with your auth system
    return sessionStorage.getItem('userName') || undefined;
  }

  private getClientIP(): string | undefined {
    // This would typically come from server headers
    return undefined;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger({
  enableConsoleLog: process.env.NODE_ENV === 'development',
  enableLocalStorage: true,
  enableRemoteLogging: process.env.NODE_ENV === 'production'
});

// React hook for audit logging
export function useAuditLog() {
  return {
    log: auditLogger.log.bind(auditLogger),
    logError: auditLogger.logError.bind(auditLogger),
    logSecurity: auditLogger.logSecurity.bind(auditLogger),
    createAuditTrail: auditLogger.createAuditTrail.bind(auditLogger)
  };
}

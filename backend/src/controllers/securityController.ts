import { Request, Response } from 'express';
import { logger } from '../utils/logger';

interface IncomingAuditLog {
  timestamp?: string;
  eventType?: string;
  severity?: string;
  action?: string;
  result?: string;
  userId?: string;
  userName?: string;
  sessionId?: string;
  details?: unknown;
  metadata?: Record<string, unknown>;
}

const ALLOWED_SEVERITIES = new Set(['info', 'warning', 'error', 'critical']);
const MAX_LOGS_PER_REQUEST = 200;

export const handleAuditLogs = (req: Request, res: Response): Response => {
  const { logs } = req.body || {};

  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ message: 'Payload must include non-empty "logs" array.' });
  }

  const limitedLogs = logs.slice(0, MAX_LOGS_PER_REQUEST) as IncomingAuditLog[];
  const receivedAt = new Date().toISOString();

  limitedLogs.forEach((log, index) => {
    const severity = ALLOWED_SEVERITIES.has((log.severity || '').toLowerCase())
      ? log.severity?.toLowerCase()
      : 'info';

    logger.info(
      `[AUDIT][${severity}] ${log.eventType || 'UNKNOWN_EVENT'} | action=${
        log.action || 'unspecified'
      } | userId=${log.userId || 'anonymous'} | session=${log.sessionId || 'unknown'} | idx=${
        index + 1
      }/${limitedLogs.length} | received=${receivedAt}`,
      {
        result: log.result,
        userName: log.userName,
        metadata: log.metadata,
        details: log.details,
      }
    );
  });

  return res.status(200).json({ status: 'ok', received: limitedLogs.length });
};

export const handleCspReport = (req: Request, res: Response): Response => {
  const report = req.body?.['csp-report'] || req.body;

  if (!report || typeof report !== 'object') {
    return res.status(400).json({ message: 'Invalid CSP report payload.' });
  }

  logger.warn('[CSP] Violation reported', {
    documentUri: report['document-uri'],
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    originalPolicy: report['original-policy'],
    sourceFile: report['source-file'],
    statusCode: report['status-code'],
    scriptSample: report['script-sample']
  });

  return res.status(204).send();
};

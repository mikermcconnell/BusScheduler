import express from 'express';
import { handleAuditLogs, handleCspReport } from '../controllers/securityController';

const router = express.Router();

const standardJsonParser = express.json();
const cspJsonParser = express.json({ type: ['application/json', 'application/csp-report'] });

router.post('/audit', standardJsonParser, handleAuditLogs);
router.post('/csp-report', cspJsonParser, handleCspReport);

export default router;

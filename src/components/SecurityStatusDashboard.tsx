/**
 * Security Status Dashboard Component
 * Real-time monitoring of all security features
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
  Policy as PolicyIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  VpnKey as KeyIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { securityInitializer, useSecurityStatus } from '../utils/securityInitializer';
import { auditLogger, AuditEventType, AuditSeverity } from '../services/auditLogger';
import { rateLimiter } from '../utils/rateLimiter';
import { csp } from '../utils/contentSecurityPolicy';
import { csrfProtection } from '../utils/csrfProtection';

interface SecurityMetrics {
  csrf: {
    enabled: boolean;
    tokenPresent: boolean;
    tokenAge: number;
  };
  rateLimit: {
    enabled: boolean;
    globalUsage: number;
    globalLimit: number;
    recentViolations: number;
  };
  csp: {
    enabled: boolean;
    policyValid: boolean;
    violations: number;
    warnings: string[];
  };
  audit: {
    enabled: boolean;
    totalLogs: number;
    recentErrors: number;
    recentWarnings: number;
  };
}

const SecurityStatusDashboard: React.FC = () => {
  const securityStatus = useSecurityStatus();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const updateMetrics = () => {
      // Get CSRF status
      const token = csrfProtection.getToken();
      const tokenAge = token ? Date.now() - JSON.parse(sessionStorage.getItem('csrf_token') || '{}').timestamp : 0;

      // Get rate limit stats
      const rateLimitStats = rateLimiter.getUsageStats();
      
      // Get recent audit logs
      const logs = auditLogger.getLogs({ limit: 100 });
      const recentErrors = logs.filter(l => l.severity === AuditSeverity.ERROR).length;
      const recentWarnings = logs.filter(l => l.severity === AuditSeverity.WARNING).length;
      const violations = logs.filter(l => 
        l.eventType === AuditEventType.RATE_LIMIT_EXCEEDED ||
        l.eventType === AuditEventType.XSS_BLOCKED ||
        l.eventType === AuditEventType.CSRF_VIOLATION
      ).length;

      // Get CSP validation
      const cspValidation = csp.validatePolicy();

      setMetrics({
        csrf: {
          enabled: securityStatus.csrf.enabled,
          tokenPresent: !!token,
          tokenAge: tokenAge
        },
        rateLimit: {
          enabled: securityStatus.rateLimiting.enabled,
          globalUsage: rateLimitStats.global.used,
          globalLimit: rateLimitStats.global.limit,
          recentViolations: violations
        },
        csp: {
          enabled: securityStatus.csp.enabled,
          policyValid: cspValidation.valid,
          violations: 0, // Would come from CSP violation events
          warnings: cspValidation.warnings
        },
        audit: {
          enabled: securityStatus.audit.enabled,
          totalLogs: securityStatus.audit.logCount,
          recentErrors,
          recentWarnings
        }
      });

      setLastRefresh(new Date());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, [securityStatus]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleViewAuditLogs = () => {
    const logs = auditLogger.getLogs({ limit: 50 });
    setRecentAuditLogs(logs);
    setAuditDialogOpen(true);
  };

  const getStatusIcon = (enabled: boolean, hasIssues: boolean = false) => {
    if (!enabled) return <BlockIcon color="disabled" />;
    if (hasIssues) return <WarningIcon color="warning" />;
    return <CheckIcon color="success" />;
  };

  const getStatusColor = (enabled: boolean, hasIssues: boolean = false): 'success' | 'warning' | 'error' | 'default' => {
    if (!enabled) return 'default';
    if (hasIssues) return 'warning';
    return 'success';
  };

  const getSeverityColor = (severity: AuditSeverity) => {
    switch (severity) {
      case AuditSeverity.ERROR:
      case AuditSeverity.CRITICAL:
        return 'error';
      case AuditSeverity.WARNING:
        return 'warning';
      default:
        return 'info';
    }
  };

  if (!metrics) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SecurityIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Security Status Dashboard
        </Typography>
        <Tooltip title="Last refreshed">
          <Typography variant="caption" sx={{ mr: 2, color: 'text.secondary' }}>
            {lastRefresh.toLocaleTimeString()}
          </Typography>
        </Tooltip>
        <IconButton onClick={handleRefresh} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Overall Status Alert */}
      {securityStatus.initialized ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Security Features Active</AlertTitle>
          All security systems are initialized and running in {securityStatus.config.environment} mode
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Security Not Fully Initialized</AlertTitle>
          Some security features may not be active
        </Alert>
      )}

      {/* Security Features Grid */}
      <Grid container spacing={3}>
        {/* CSRF Protection */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <KeyIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  CSRF Protection
                </Typography>
                <Chip
                  label={metrics.csrf.enabled ? 'Active' : 'Disabled'}
                  color={getStatusColor(metrics.csrf.enabled)}
                  size="small"
                />
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(metrics.csrf.tokenPresent)}
                  </ListItemIcon>
                  <ListItemText
                    primary="Token Status"
                    secondary={metrics.csrf.tokenPresent ? 'Token present and valid' : 'No token'}
                  />
                </ListItem>
                {metrics.csrf.tokenPresent && (
                  <ListItem>
                    <ListItemIcon>
                      <InfoIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Token Age"
                      secondary={`${Math.floor(metrics.csrf.tokenAge / 1000 / 60)} minutes`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Rate Limiting */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Rate Limiting
                </Typography>
                <Chip
                  label={metrics.rateLimit.enabled ? 'Active' : 'Disabled'}
                  color={getStatusColor(metrics.rateLimit.enabled, metrics.rateLimit.recentViolations > 0)}
                  size="small"
                />
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(
                      metrics.rateLimit.globalUsage < metrics.rateLimit.globalLimit * 0.8,
                      metrics.rateLimit.globalUsage > metrics.rateLimit.globalLimit * 0.5
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Global Usage"
                    secondary={`${metrics.rateLimit.globalUsage} / ${metrics.rateLimit.globalLimit} requests`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText inset>
                    <LinearProgress
                      variant="determinate"
                      value={(metrics.rateLimit.globalUsage / metrics.rateLimit.globalLimit) * 100}
                      color={
                        metrics.rateLimit.globalUsage > metrics.rateLimit.globalLimit * 0.8
                          ? 'error'
                          : metrics.rateLimit.globalUsage > metrics.rateLimit.globalLimit * 0.5
                          ? 'warning'
                          : 'success'
                      }
                    />
                  </ListItemText>
                </ListItem>
                {metrics.rateLimit.recentViolations > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Recent Violations"
                      secondary={`${metrics.rateLimit.recentViolations} rate limit violations`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Content Security Policy */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PolicyIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Content Security Policy
                </Typography>
                <Chip
                  label={metrics.csp.enabled ? 'Active' : 'Disabled'}
                  color={getStatusColor(metrics.csp.enabled, !metrics.csp.policyValid || metrics.csp.warnings.length > 0)}
                  size="small"
                />
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(metrics.csp.policyValid, metrics.csp.warnings.length > 0)}
                  </ListItemIcon>
                  <ListItemText
                    primary="Policy Validation"
                    secondary={metrics.csp.policyValid ? 'Policy is valid' : 'Policy has errors'}
                  />
                </ListItem>
                {metrics.csp.warnings.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Warnings"
                      secondary={`${metrics.csp.warnings.length} policy warnings`}
                    />
                  </ListItem>
                )}
                {metrics.csp.violations > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Violations"
                      secondary={`${metrics.csp.violations} CSP violations detected`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Audit Logging */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HistoryIcon sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Audit Logging
                </Typography>
                <Chip
                  label={metrics.audit.enabled ? 'Active' : 'Disabled'}
                  color={getStatusColor(metrics.audit.enabled, metrics.audit.recentErrors > 0)}
                  size="small"
                />
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Total Logs"
                    secondary={`${metrics.audit.totalLogs} audit entries`}
                  />
                </ListItem>
                {metrics.audit.recentErrors > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Recent Errors"
                      secondary={`${metrics.audit.recentErrors} errors logged`}
                    />
                  </ListItem>
                )}
                {metrics.audit.recentWarnings > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Recent Warnings"
                      secondary={`${metrics.audit.recentWarnings} warnings logged`}
                    />
                  </ListItem>
                )}
                <ListItem>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<HistoryIcon />}
                    onClick={handleViewAuditLogs}
                    fullWidth
                  >
                    View Audit Logs
                  </Button>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Environment Info */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Security Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Environment
            </Typography>
            <Typography variant="body2">
              {securityStatus.config.environment}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              CSP Report Endpoint
            </Typography>
            <Typography variant="body2">
              {securityStatus.config.cspReportEndpoint || 'Not configured'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Audit Endpoint
            </Typography>
            <Typography variant="body2">
              {securityStatus.config.auditEndpoint || 'Not configured'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Session ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {sessionStorage.getItem('session_id')?.slice(0, 8)}...
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Audit Logs Dialog */}
      <Dialog
        open={auditDialogOpen}
        onClose={() => setAuditDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Recent Audit Logs</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentAuditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>{log.eventType}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.severity}
                        color={getSeverityColor(log.severity)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.result}
                        color={log.result === 'success' ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecurityStatusDashboard;
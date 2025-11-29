/**
 * Audit Module
 * Re-exports all audit-related functionality
 */

export {
  initAuditLogger,
  logEvent,
  logOrderEvent,
  logPositionEvent,
  logBalanceChange,
  logSettingChange,
  logSignalEvent,
  logRiskAlert,
  logCircuitBreaker,
  logSystemError,
  logDataExport,
  getRecentEvents,
  getEventsByType,
  getEventsInRange,
  searchEvents,
  exportAuditLogs,
  verifyEventSignature,
  getAuditStats,
  cleanupAuditLogger,
  type AuditEventType,
  type AuditEvent
} from './auditLogger';

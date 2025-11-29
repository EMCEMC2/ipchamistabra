/**
 * Comprehensive Audit Logging Service
 * Tracks all trading activities for regulatory compliance
 */

import { LogBuffer } from '../../utils/ringBuffer';
import * as storage from '../storage';

// Event types for audit trail
export type AuditEventType =
  | 'ORDER_PLACED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FILLED'
  | 'ORDER_REJECTED'
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'POSITION_MODIFIED'
  | 'BALANCE_CHANGED'
  | 'SETTING_CHANGED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'API_CALL'
  | 'SIGNAL_GENERATED'
  | 'SIGNAL_EXECUTED'
  | 'RISK_ALERT'
  | 'CIRCUIT_BREAKER_TRIGGERED'
  | 'SYSTEM_ERROR'
  | 'DATA_EXPORT';

export interface AuditEvent {
  id: string;
  timestamp: number;
  message: string;
  eventType: AuditEventType;
  actor: string;
  sessionId: string;
  details: Record<string, unknown>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    source: 'UI' | 'API' | 'SYSTEM' | 'SCHEDULED';
  };
  signature: string;
  [key: string]: unknown;
}

interface AuditConfig {
  bufferSize: number;
  persistInterval: number;
  enableConsoleLog: boolean;
}

const DEFAULT_CONFIG: AuditConfig = {
  bufferSize: 1000,
  persistInterval: 30000, // 30 seconds
  enableConsoleLog: false
};

// In-memory buffer for recent events
let auditBuffer: LogBuffer<AuditEvent>;
let config: AuditConfig;
let persistInterval: number | null = null;
let sessionId: string;

/**
 * Initialize audit logger
 */
export function initAuditLogger(customConfig?: Partial<AuditConfig>): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };
  auditBuffer = new LogBuffer<AuditEvent>(config.bufferSize);
  sessionId = generateSessionId();

  // Start periodic persistence
  if (persistInterval) {
    clearInterval(persistInterval);
  }
  persistInterval = window.setInterval(() => {
    persistAuditLogs();
  }, config.persistInterval);

  // Log initialization
  logEvent('LOGIN', 'SYSTEM', { action: 'AUDIT_LOGGER_INITIALIZED' }, 'SYSTEM');

  console.log('[AuditLogger] Initialized with session:', sessionId);
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create HMAC signature for tamper detection
 */
function createSignature(event: Omit<AuditEvent, 'signature'>): string {
  // Simple hash for demo - in production use proper HMAC
  const data = JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    eventType: event.eventType,
    actor: event.actor,
    details: event.details
  });

  // Simple hash using built-in methods
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sig-${Math.abs(hash).toString(16)}`;
}

/**
 * Log an audit event
 */
export function logEvent(
  eventType: AuditEventType,
  actor: string,
  details: Record<string, unknown>,
  source: AuditEvent['metadata']['source'] = 'UI'
): string {
  if (!auditBuffer) {
    initAuditLogger();
  }

  const eventId = generateEventId();

  const event: Omit<AuditEvent, 'signature'> = {
    id: eventId,
    timestamp: Date.now(),
    message: `${eventType} by ${actor}`,
    eventType,
    actor,
    sessionId,
    details,
    metadata: {
      source,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    }
  };

  const signature = createSignature(event);
  const signedEvent = { ...event, signature } as AuditEvent;

  auditBuffer.push(signedEvent);

  if (config.enableConsoleLog) {
    console.log(`[Audit] ${eventType}:`, details);
  }

  return eventId;
}

/**
 * Log order event
 */
export function logOrderEvent(
  action: 'PLACED' | 'CANCELLED' | 'FILLED' | 'REJECTED',
  orderData: {
    orderId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    quantity: number;
    price?: number;
    reason?: string;
  }
): string {
  const eventType: AuditEventType = `ORDER_${action}` as AuditEventType;
  return logEvent(eventType, 'TRADER', orderData, 'UI');
}

/**
 * Log position event
 */
export function logPositionEvent(
  action: 'OPENED' | 'CLOSED' | 'MODIFIED',
  positionData: {
    positionId: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    pnl?: number;
    reason?: string;
  }
): string {
  const eventType: AuditEventType = `POSITION_${action}` as AuditEventType;
  return logEvent(eventType, 'TRADER', positionData, 'UI');
}

/**
 * Log balance change
 */
export function logBalanceChange(
  previousBalance: number,
  newBalance: number,
  reason: string,
  relatedId?: string
): string {
  return logEvent('BALANCE_CHANGED', 'SYSTEM', {
    previousBalance,
    newBalance,
    change: newBalance - previousBalance,
    reason,
    relatedId
  }, 'SYSTEM');
}

/**
 * Log setting change
 */
export function logSettingChange(
  setting: string,
  previousValue: unknown,
  newValue: unknown
): string {
  return logEvent('SETTING_CHANGED', 'TRADER', {
    setting,
    previousValue,
    newValue
  }, 'UI');
}

/**
 * Log signal event
 */
export function logSignalEvent(
  action: 'GENERATED' | 'EXECUTED',
  signalData: {
    signalId: string;
    type: 'LONG' | 'SHORT';
    confidence: number;
    symbol: string;
    entryPrice: number;
    reasoning?: string;
  }
): string {
  const eventType: AuditEventType = action === 'GENERATED' ? 'SIGNAL_GENERATED' : 'SIGNAL_EXECUTED';
  return logEvent(eventType, 'SYSTEM', signalData, 'SYSTEM');
}

/**
 * Log risk alert
 */
export function logRiskAlert(
  alertType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  details: Record<string, unknown>
): string {
  return logEvent('RISK_ALERT', 'RISK_OFFICER', {
    alertType,
    severity,
    ...details
  }, 'SYSTEM');
}

/**
 * Log circuit breaker trigger
 */
export function logCircuitBreaker(
  reason: string,
  dailyPnL: number,
  limit: number
): string {
  return logEvent('CIRCUIT_BREAKER_TRIGGERED', 'SYSTEM', {
    reason,
    dailyPnL,
    limit,
    tradingHalted: true
  }, 'SYSTEM');
}

/**
 * Log system error
 */
export function logSystemError(
  error: Error | string,
  context?: Record<string, unknown>
): string {
  const errorDetails = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { message: error };

  return logEvent('SYSTEM_ERROR', 'SYSTEM', {
    error: errorDetails,
    context
  }, 'SYSTEM');
}

/**
 * Log data export
 */
export function logDataExport(
  exportType: string,
  recordCount: number,
  format: string
): string {
  return logEvent('DATA_EXPORT', 'TRADER', {
    exportType,
    recordCount,
    format
  }, 'UI');
}

/**
 * Get recent audit events
 */
export function getRecentEvents(limit: number = 100): AuditEvent[] {
  if (!auditBuffer) return [];
  return auditBuffer.getLast(limit);
}

/**
 * Get events by type
 */
export function getEventsByType(eventType: AuditEventType, limit: number = 50): AuditEvent[] {
  if (!auditBuffer) return [];
  return auditBuffer.filter(e => e.eventType === eventType).slice(-limit);
}

/**
 * Get events in time range
 */
export function getEventsInRange(startTime: number, endTime: number): AuditEvent[] {
  if (!auditBuffer) return [];
  return auditBuffer.getByTimeRange(startTime, endTime);
}

/**
 * Search events
 */
export function searchEvents(query: string): AuditEvent[] {
  if (!auditBuffer) return [];
  return auditBuffer.search(query);
}

/**
 * Persist audit logs to storage
 */
async function persistAuditLogs(): Promise<void> {
  if (!auditBuffer || auditBuffer.isEmpty) return;

  try {
    const events = auditBuffer.toArray();
    const key = `audit-log-${sessionId}`;

    await storage.set(key, events);
  } catch (error) {
    console.error('[AuditLogger] Failed to persist logs:', error);
  }
}

/**
 * Export audit logs for compliance
 */
export async function exportAuditLogs(
  startDate: Date,
  endDate: Date,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  const events = getEventsInRange(startTime, endTime);

  logDataExport('AUDIT_LOGS', events.length, format);

  if (format === 'csv') {
    return convertToCSV(events);
  }

  return JSON.stringify(events, null, 2);
}

/**
 * Convert events to CSV format
 */
function convertToCSV(events: AuditEvent[]): string {
  if (events.length === 0) return '';

  const headers = ['id', 'timestamp', 'eventType', 'actor', 'sessionId', 'details', 'signature'];
  const rows = events.map(e => [
    e.id,
    new Date(e.timestamp).toISOString(),
    e.eventType,
    e.actor,
    e.sessionId,
    JSON.stringify(e.details),
    e.signature
  ]);

  return [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}

/**
 * Verify event signature (tamper detection)
 */
export function verifyEventSignature(event: AuditEvent): boolean {
  const { signature, ...eventWithoutSig } = event;
  const expectedSignature = createSignature(eventWithoutSig as Omit<AuditEvent, 'signature'>);
  return signature === expectedSignature;
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  sessionId: string;
  oldestEvent: number | null;
  newestEvent: number | null;
} {
  if (!auditBuffer) {
    return {
      totalEvents: 0,
      eventsByType: {} as Record<AuditEventType, number>,
      sessionId: '',
      oldestEvent: null,
      newestEvent: null
    };
  }

  const events = auditBuffer.toArray();
  const eventsByType: Record<string, number> = {};

  for (const event of events) {
    eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
  }

  return {
    totalEvents: events.length,
    eventsByType: eventsByType as Record<AuditEventType, number>,
    sessionId,
    oldestEvent: events[0]?.timestamp || null,
    newestEvent: events[events.length - 1]?.timestamp || null
  };
}

/**
 * Cleanup audit logger
 */
export function cleanupAuditLogger(): void {
  if (persistInterval) {
    clearInterval(persistInterval);
    persistInterval = null;
  }

  // Final persist before cleanup
  persistAuditLogs();

  logEvent('LOGOUT', 'SYSTEM', { action: 'AUDIT_LOGGER_CLEANUP' }, 'SYSTEM');
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  initAuditLogger();
}

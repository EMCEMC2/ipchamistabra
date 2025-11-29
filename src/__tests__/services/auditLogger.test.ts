/**
 * Audit Logger Tests
 * Tests for compliance audit logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
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
  getRecentEvents,
  getEventsByType,
  getEventsInRange,
  searchEvents,
  verifyEventSignature,
  getAuditStats,
  cleanupAuditLogger,
  type AuditEvent
} from '../../services/audit/auditLogger';

describe('AuditLogger', () => {
  beforeEach(() => {
    initAuditLogger({ bufferSize: 100, enableConsoleLog: false });
  });

  describe('initialization', () => {
    it('should initialize with custom config', () => {
      const stats = getAuditStats();
      expect(stats.sessionId).toBeTruthy();
      expect(stats.sessionId).toMatch(/^session-/);
    });

    it('should log initialization event', () => {
      const events = getEventsByType('LOGIN');
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('logEvent', () => {
    it('should create event with correct structure', () => {
      const eventId = logEvent('API_CALL', 'SYSTEM', { endpoint: '/test' }, 'API');

      expect(eventId).toMatch(/^evt-/);

      const events = getRecentEvents(1);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('API_CALL');
      expect(events[0].actor).toBe('SYSTEM');
      expect(events[0].details.endpoint).toBe('/test');
      expect(events[0].metadata.source).toBe('API');
    });

    it('should include timestamp', () => {
      logEvent('API_CALL', 'SYSTEM', {}, 'API');
      const events = getRecentEvents(1);

      expect(events[0].timestamp).toBeDefined();
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('should include signature', () => {
      logEvent('API_CALL', 'SYSTEM', {}, 'API');
      const events = getRecentEvents(1);

      expect(events[0].signature).toBeDefined();
      expect(events[0].signature).toMatch(/^sig-/);
    });
  });

  describe('logOrderEvent', () => {
    it('should log order placed event', () => {
      logOrderEvent('PLACED', {
        orderId: 'ord-123',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0.5,
        price: 95000
      });

      const events = getEventsByType('ORDER_PLACED');
      expect(events.length).toBe(1);
      expect(events[0].details.orderId).toBe('ord-123');
      expect(events[0].details.side).toBe('BUY');
    });

    it('should log order cancelled event', () => {
      logOrderEvent('CANCELLED', {
        orderId: 'ord-456',
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'LIMIT',
        quantity: 1.0,
        reason: 'User requested'
      });

      const events = getEventsByType('ORDER_CANCELLED');
      expect(events.length).toBe(1);
      expect(events[0].details.reason).toBe('User requested');
    });
  });

  describe('logPositionEvent', () => {
    it('should log position opened', () => {
      logPositionEvent('OPENED', {
        positionId: 'pos-123',
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: 1.0,
        entryPrice: 95000
      });

      const events = getEventsByType('POSITION_OPENED');
      expect(events.length).toBe(1);
      expect(events[0].details.side).toBe('LONG');
    });

    it('should log position closed with PnL', () => {
      logPositionEvent('CLOSED', {
        positionId: 'pos-123',
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: 1.0,
        entryPrice: 95000,
        exitPrice: 96000,
        pnl: 1000
      });

      const events = getEventsByType('POSITION_CLOSED');
      expect(events.length).toBe(1);
      expect(events[0].details.pnl).toBe(1000);
    });
  });

  describe('logBalanceChange', () => {
    it('should log balance changes', () => {
      logBalanceChange(10000, 10500, 'Trade profit', 'trade-123');

      const events = getEventsByType('BALANCE_CHANGED');
      expect(events.length).toBe(1);
      expect(events[0].details.previousBalance).toBe(10000);
      expect(events[0].details.newBalance).toBe(10500);
      expect(events[0].details.change).toBe(500);
    });
  });

  describe('logSettingChange', () => {
    it('should log setting changes', () => {
      logSettingChange('riskLimit', 0.02, 0.05);

      const events = getEventsByType('SETTING_CHANGED');
      expect(events.length).toBe(1);
      expect(events[0].details.setting).toBe('riskLimit');
      expect(events[0].details.previousValue).toBe(0.02);
      expect(events[0].details.newValue).toBe(0.05);
    });
  });

  describe('logSignalEvent', () => {
    it('should log signal generated', () => {
      logSignalEvent('GENERATED', {
        signalId: 'sig-123',
        type: 'LONG',
        confidence: 0.85,
        symbol: 'BTCUSDT',
        entryPrice: 95000,
        reasoning: 'Strong momentum'
      });

      const events = getEventsByType('SIGNAL_GENERATED');
      expect(events.length).toBe(1);
      expect(events[0].details.confidence).toBe(0.85);
    });
  });

  describe('logRiskAlert', () => {
    it('should log risk alerts with severity', () => {
      logRiskAlert('DRAWDOWN_LIMIT', 'HIGH', { currentDrawdown: 0.15, limit: 0.10 });

      const events = getEventsByType('RISK_ALERT');
      expect(events.length).toBe(1);
      expect(events[0].details.severity).toBe('HIGH');
      expect(events[0].details.alertType).toBe('DRAWDOWN_LIMIT');
    });
  });

  describe('logCircuitBreaker', () => {
    it('should log circuit breaker triggers', () => {
      logCircuitBreaker('Daily loss limit reached', -1500, -1000);

      const events = getEventsByType('CIRCUIT_BREAKER_TRIGGERED');
      expect(events.length).toBe(1);
      expect(events[0].details.tradingHalted).toBe(true);
    });
  });

  describe('logSystemError', () => {
    it('should log Error objects', () => {
      const error = new Error('Connection failed');
      logSystemError(error, { service: 'websocket' });

      const events = getEventsByType('SYSTEM_ERROR');
      expect(events.length).toBe(1);
      expect(events[0].details.error).toHaveProperty('message', 'Connection failed');
      expect(events[0].details.context).toHaveProperty('service', 'websocket');
    });

    it('should log string errors', () => {
      logSystemError('Simple error message');

      const events = getEventsByType('SYSTEM_ERROR');
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('query functions', () => {
    beforeEach(() => {
      // Create some events with different timestamps
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
      logEvent('API_CALL', 'SYSTEM', { id: 1 }, 'API');

      vi.setSystemTime(new Date('2024-01-01T11:00:00Z'));
      logEvent('API_CALL', 'SYSTEM', { id: 2 }, 'API');

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      logEvent('SETTING_CHANGED', 'TRADER', { setting: 'test' }, 'UI');
    });

    it('should get events by type', () => {
      const apiEvents = getEventsByType('API_CALL');
      expect(apiEvents.length).toBe(2);
    });

    it('should get events in time range', () => {
      const start = new Date('2024-01-01T10:30:00Z').getTime();
      const end = new Date('2024-01-01T12:30:00Z').getTime();

      const events = getEventsInRange(start, end);
      expect(events.length).toBe(2); // 11:00 and 12:00 events
    });

    it('should search events', () => {
      logEvent('API_CALL', 'SYSTEM', { message: 'hello world' }, 'API');
      const results = searchEvents('hello');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('verifyEventSignature', () => {
    it('should verify valid signatures', () => {
      logEvent('API_CALL', 'SYSTEM', { test: true }, 'API');
      const events = getRecentEvents(1);

      expect(verifyEventSignature(events[0])).toBe(true);
    });

    it('should detect tampered events', () => {
      logEvent('API_CALL', 'SYSTEM', { test: true }, 'API');
      const events = getRecentEvents(1);

      // Tamper with the event
      const tampered = { ...events[0], details: { test: false } };
      expect(verifyEventSignature(tampered)).toBe(false);
    });
  });

  describe('getAuditStats', () => {
    it('should return correct statistics', () => {
      logEvent('API_CALL', 'SYSTEM', {}, 'API');
      logEvent('API_CALL', 'SYSTEM', {}, 'API');
      logEvent('SETTING_CHANGED', 'TRADER', {}, 'UI');

      const stats = getAuditStats();

      expect(stats.totalEvents).toBeGreaterThanOrEqual(3);
      expect(stats.sessionId).toBeTruthy();
      expect(stats.eventsByType.API_CALL).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cleanup', () => {
    it('should log logout event on cleanup', () => {
      cleanupAuditLogger();
      const events = getEventsByType('LOGOUT');

      expect(events.length).toBeGreaterThan(0);
    });
  });
});

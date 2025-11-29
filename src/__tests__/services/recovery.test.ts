/**
 * Recovery Service Tests
 * Tests for snapshot and health monitoring
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createSnapshot,
  restoreSnapshot,
  listSnapshots,
  deleteSnapshot,
  getLatestSnapshot,
  startAutoSnapshot,
  stopAutoSnapshot,
  createPreTradeSnapshot,
  createErrorSnapshot,
  getSnapshotStorageUsage,
  exportSnapshots,
  importSnapshots
} from '../../services/recovery/snapshotService';
import {
  registerHealthCheck,
  startHealthMonitor,
  stopHealthMonitor,
  getSystemHealth,
  getCheckResult,
  onHealthUpdate,
  triggerHealthCheck,
  formatUptime,
  type HealthStatus
} from '../../services/recovery/healthMonitor';

// Mock storage
vi.mock('../../services/storage', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve(Array.from(store.keys())))
  };
});

describe('SnapshotService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    stopAutoSnapshot();
    vi.useRealTimers();
  });

  describe('createSnapshot', () => {
    it('should create snapshot with correct structure', async () => {
      const state = { price: 95000, positions: [] };
      const snapshot = await createSnapshot(state, 'manual', 'Test snapshot');

      expect(snapshot.id).toMatch(/^snapshot-/);
      expect(snapshot.state).toEqual(state);
      expect(snapshot.metadata.trigger).toBe('manual');
      expect(snapshot.metadata.description).toBe('Test snapshot');
      expect(snapshot.checksum).toMatch(/^chk-/);
    });

    it('should calculate size correctly', async () => {
      const state = { value: 'x'.repeat(100) };
      const snapshot = await createSnapshot(state);

      expect(snapshot.size).toBeGreaterThan(100);
    });

    it('should generate unique IDs', async () => {
      const snap1 = await createSnapshot({ a: 1 });
      vi.advanceTimersByTime(10);
      const snap2 = await createSnapshot({ b: 2 });

      expect(snap1.id).not.toBe(snap2.id);
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore valid snapshot', async () => {
      const originalState = { price: 95000, volume: 1500 };
      const snapshot = await createSnapshot(originalState);

      const restored = await restoreSnapshot(snapshot.id);
      expect(restored).toEqual(originalState);
    });

    it('should return null for non-existent snapshot', async () => {
      const restored = await restoreSnapshot('snapshot-nonexistent');
      expect(restored).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('should list all snapshots sorted by timestamp', async () => {
      await createSnapshot({ v: 1 }, 'manual', 'First');
      vi.advanceTimersByTime(1000);
      await createSnapshot({ v: 2 }, 'manual', 'Second');
      vi.advanceTimersByTime(1000);
      await createSnapshot({ v: 3 }, 'manual', 'Third');

      const list = await listSnapshots();

      expect(list.length).toBe(3);
      // Should be newest first
      expect(list[0].description).toBe('Third');
      expect(list[2].description).toBe('First');
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot', async () => {
      const snapshot = await createSnapshot({ test: true });
      const id = snapshot.id;

      await deleteSnapshot(id);
      const restored = await restoreSnapshot(id);

      expect(restored).toBeNull();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return most recent snapshot', async () => {
      await createSnapshot({ v: 'old' });
      vi.advanceTimersByTime(1000);
      await createSnapshot({ v: 'new' });

      const latest = await getLatestSnapshot();

      expect(latest?.state).toEqual({ v: 'new' });
    });

    it('should return null when no snapshots exist', async () => {
      // Clear any existing snapshots
      const list = await listSnapshots();
      for (const s of list) {
        await deleteSnapshot(s.id);
      }

      const latest = await getLatestSnapshot();
      expect(latest).toBeNull();
    });
  });

  describe('autoSnapshot', () => {
    it('should create snapshots at intervals', async () => {
      const getState = vi.fn(() => ({ value: Math.random() }));
      startAutoSnapshot(getState, 5000);

      // Initial snapshot + 2 interval snapshots
      vi.advanceTimersByTime(10100);

      expect(getState).toHaveBeenCalledTimes(3);
    });

    it('should stop when requested', async () => {
      const getState = vi.fn(() => ({ value: 1 }));
      startAutoSnapshot(getState, 5000);
      stopAutoSnapshot();

      vi.advanceTimersByTime(20000);

      // Only initial snapshot should have been created
      expect(getState).toHaveBeenCalledTimes(1);
    });
  });

  describe('createPreTradeSnapshot', () => {
    it('should create pre-trade snapshot with trade details', async () => {
      const state = { balance: 10000 };
      const tradeDetails = { symbol: 'BTCUSDT', side: 'BUY', quantity: 0.5 };

      const snapshot = await createPreTradeSnapshot(state, tradeDetails);

      expect(snapshot.metadata.trigger).toBe('pre-trade');
      expect(snapshot.metadata.description).toContain('BTCUSDT');
    });
  });

  describe('createErrorSnapshot', () => {
    it('should create error snapshot with error message', async () => {
      const state = { lastAction: 'trade' };
      const error = new Error('Connection lost');

      const snapshot = await createErrorSnapshot(state, error);

      expect(snapshot.metadata.trigger).toBe('error');
      expect(snapshot.metadata.description).toContain('Connection lost');
    });

    it('should handle string errors', async () => {
      const snapshot = await createErrorSnapshot({}, 'Simple error');

      expect(snapshot.metadata.description).toContain('Simple error');
    });
  });

  describe('getSnapshotStorageUsage', () => {
    it('should calculate storage usage', async () => {
      await createSnapshot({ data: 'x'.repeat(1000) });
      await createSnapshot({ data: 'y'.repeat(500) });

      const usage = await getSnapshotStorageUsage();

      expect(usage.count).toBe(2);
      expect(usage.totalSize).toBeGreaterThan(1500);
      expect(usage.formattedSize).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);
    });
  });

  describe('export/import', () => {
    it('should export snapshots as JSON', async () => {
      await createSnapshot({ exported: true });

      const exported = await exportSnapshots();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should import valid snapshots', async () => {
      const snapshotsToImport = [
        {
          id: 'snapshot-imported-1',
          state: { imported: true },
          checksum: 'chk-abc12345',
          timestamp: Date.now(),
          isoTimestamp: new Date().toISOString(),
          version: 1,
          size: 100,
          metadata: { trigger: 'manual' }
        }
      ];

      const count = await importSnapshots(JSON.stringify(snapshotsToImport));
      expect(count).toBe(1);
    });

    it('should handle invalid import data', async () => {
      const count = await importSnapshots('invalid json');
      expect(count).toBe(0);
    });
  });
});

describe('HealthMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopHealthMonitor();
    vi.useRealTimers();
  });

  describe('registerHealthCheck', () => {
    it('should register custom health check', async () => {
      registerHealthCheck('custom', async () => ({
        status: 'HEALTHY' as HealthStatus,
        message: 'All good'
      }));

      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(100);

      const result = getCheckResult('custom');
      expect(result?.status).toBe('HEALTHY');
    });

    it('should handle failing checks', async () => {
      registerHealthCheck('failing', async () => {
        throw new Error('Check failed');
      });

      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(100);

      const result = getCheckResult('failing');
      expect(result?.status).toBe('CRITICAL');
    });
  });

  describe('getSystemHealth', () => {
    it('should return overall health status', async () => {
      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(100);

      const health = getSystemHealth();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('lastUpdate');
    });

    it('should be CRITICAL if any check is critical', async () => {
      registerHealthCheck('critical-check', async () => ({
        status: 'CRITICAL' as HealthStatus,
        message: 'Critical issue'
      }), { critical: true });

      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(100);

      const health = getSystemHealth();
      expect(health.overall).toBe('CRITICAL');
    });

    it('should be DEGRADED if any check is degraded', async () => {
      registerHealthCheck('degraded-check', async () => ({
        status: 'DEGRADED' as HealthStatus,
        message: 'Degraded performance'
      }));

      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(100);

      const health = getSystemHealth();
      expect(['DEGRADED', 'CRITICAL']).toContain(health.overall);
    });
  });

  describe('onHealthUpdate', () => {
    it('should notify listeners on health changes', async () => {
      const callback = vi.fn();
      const unsubscribe = onHealthUpdate(callback);

      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(15000);

      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow unsubscribing', async () => {
      const callback = vi.fn();
      const unsubscribe = onHealthUpdate(callback);
      unsubscribe();

      startHealthMonitor();
      await vi.advanceTimersByTimeAsync(15000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('triggerHealthCheck', () => {
    it('should manually trigger all checks', async () => {
      registerHealthCheck('manual-trigger', async () => ({
        status: 'HEALTHY' as HealthStatus,
        message: 'OK'
      }));

      const health = await triggerHealthCheck();

      expect(health.checks.length).toBeGreaterThan(0);
    });

    it('should trigger specific check by name', async () => {
      registerHealthCheck('specific', async () => ({
        status: 'HEALTHY' as HealthStatus,
        message: 'Specific check'
      }));

      await triggerHealthCheck('specific');
      const result = getCheckResult('specific');

      expect(result?.message).toBe('Specific check');
    });
  });

  describe('formatUptime', () => {
    it('should format seconds', () => {
      expect(formatUptime(5000)).toBe('5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatUptime(125000)).toBe('2m 5s');
    });

    it('should format hours', () => {
      expect(formatUptime(3725000)).toBe('1h 2m 5s');
    });

    it('should format days', () => {
      expect(formatUptime(90061000)).toBe('1d 1h 1m');
    });
  });
});

/**
 * Health Monitor Service
 * Real-time system health monitoring and alerting
 */

import { getSyncedTime } from '../compliance/timeSync';
import { logSystemError, logRiskAlert } from '../audit/auditLogger';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message: string;
  lastCheck: number;
  latency?: number;
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheck[];
  uptime: number;
  lastUpdate: number;
}

interface HealthCheckFn {
  name: string;
  check: () => Promise<HealthCheck>;
  interval: number;
  critical: boolean;
}

const healthChecks: Map<string, HealthCheckFn> = new Map();
const checkResults: Map<string, HealthCheck> = new Map();
const checkIntervals: Map<string, number> = new Map();

let startTime = Date.now();
let monitorInterval: number | null = null;
let healthListeners: ((health: SystemHealth) => void)[] = [];

/**
 * Register a health check
 */
export function registerHealthCheck(
  name: string,
  checkFn: () => Promise<{ status: HealthStatus; message: string; metadata?: Record<string, unknown> }>,
  options: { interval?: number; critical?: boolean } = {}
): void {
  const { interval = 30000, critical = false } = options;

  healthChecks.set(name, {
    name,
    check: async () => {
      const start = Date.now();
      try {
        const result = await checkFn();
        return {
          name,
          status: result.status,
          message: result.message,
          lastCheck: getSyncedTime(),
          latency: Date.now() - start,
          metadata: result.metadata
        };
      } catch (error) {
        return {
          name,
          status: 'CRITICAL',
          message: `Check failed: ${error}`,
          lastCheck: getSyncedTime(),
          latency: Date.now() - start
        };
      }
    },
    interval,
    critical
  });
}

/**
 * Start health monitoring
 */
export function startHealthMonitor(): void {
  startTime = Date.now();

  // Run initial checks
  runAllChecks();

  // Set up periodic checks
  for (const [name, check] of healthChecks) {
    const intervalId = window.setInterval(() => {
      runCheck(name);
    }, check.interval);
    checkIntervals.set(name, intervalId);
  }

  // Monitor overall health every 10 seconds
  monitorInterval = window.setInterval(() => {
    const health = getSystemHealth();
    notifyListeners(health);

    // Alert on degraded/critical status
    if (health.overall === 'CRITICAL') {
      logRiskAlert('SYSTEM_HEALTH_CRITICAL', 'CRITICAL', {
        checks: health.checks.filter(c => c.status === 'CRITICAL')
      });
    }
  }, 10000);

  console.log('[HealthMonitor] Started monitoring');
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitor(): void {
  for (const [_, intervalId] of checkIntervals) {
    clearInterval(intervalId);
  }
  checkIntervals.clear();

  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }

  console.log('[HealthMonitor] Stopped monitoring');
}

/**
 * Run a specific health check
 */
async function runCheck(name: string): Promise<HealthCheck | null> {
  const checkFn = healthChecks.get(name);
  if (!checkFn) return null;

  try {
    const result = await checkFn.check();
    checkResults.set(name, result);
    return result;
  } catch (error) {
    const errorResult: HealthCheck = {
      name,
      status: 'CRITICAL',
      message: `Check error: ${error}`,
      lastCheck: getSyncedTime()
    };
    checkResults.set(name, errorResult);
    logSystemError(error as Error, { healthCheck: name });
    return errorResult;
  }
}

/**
 * Run all health checks
 */
async function runAllChecks(): Promise<void> {
  const promises = Array.from(healthChecks.keys()).map(name => runCheck(name));
  await Promise.all(promises);
}

/**
 * Get current system health
 */
export function getSystemHealth(): SystemHealth {
  const checks = Array.from(checkResults.values());

  // Calculate overall status
  let overall: HealthStatus = 'HEALTHY';

  const hasCritical = checks.some(c => c.status === 'CRITICAL');
  const hasDegraded = checks.some(c => c.status === 'DEGRADED');
  const hasUnknown = checks.some(c => c.status === 'UNKNOWN');

  if (hasCritical) {
    overall = 'CRITICAL';
  } else if (hasDegraded) {
    overall = 'DEGRADED';
  } else if (hasUnknown && checks.length > 0) {
    overall = 'UNKNOWN';
  }

  return {
    overall,
    checks,
    uptime: Date.now() - startTime,
    lastUpdate: getSyncedTime()
  };
}

/**
 * Get specific check result
 */
export function getCheckResult(name: string): HealthCheck | undefined {
  return checkResults.get(name);
}

/**
 * Subscribe to health updates
 */
export function onHealthUpdate(callback: (health: SystemHealth) => void): () => void {
  healthListeners.push(callback);
  return () => {
    healthListeners = healthListeners.filter(cb => cb !== callback);
  };
}

/**
 * Notify all listeners
 */
function notifyListeners(health: SystemHealth): void {
  for (const listener of healthListeners) {
    try {
      listener(health);
    } catch (error) {
      console.error('[HealthMonitor] Listener error:', error);
    }
  }
}

/**
 * Manual health check trigger
 */
export async function triggerHealthCheck(name?: string): Promise<SystemHealth> {
  if (name) {
    await runCheck(name);
  } else {
    await runAllChecks();
  }
  return getSystemHealth();
}

/**
 * Format uptime for display
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Register default health checks
registerHealthCheck('memory', async () => {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory;
    const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

    if (usedPercent > 90) {
      return { status: 'CRITICAL', message: `Memory usage: ${usedPercent.toFixed(1)}%` };
    }
    if (usedPercent > 70) {
      return { status: 'DEGRADED', message: `Memory usage: ${usedPercent.toFixed(1)}%` };
    }
    return { status: 'HEALTHY', message: `Memory usage: ${usedPercent.toFixed(1)}%` };
  }
  return { status: 'UNKNOWN', message: 'Memory info unavailable' };
}, { interval: 30000, critical: true });

registerHealthCheck('storage', async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const usedPercent = ((estimate.usage || 0) / (estimate.quota || 1)) * 100;

    if (usedPercent > 90) {
      return { status: 'CRITICAL', message: `Storage usage: ${usedPercent.toFixed(1)}%` };
    }
    if (usedPercent > 70) {
      return { status: 'DEGRADED', message: `Storage usage: ${usedPercent.toFixed(1)}%` };
    }
    return { status: 'HEALTHY', message: `Storage usage: ${usedPercent.toFixed(1)}%` };
  }
  return { status: 'UNKNOWN', message: 'Storage info unavailable' };
}, { interval: 60000, critical: false });

registerHealthCheck('network', async () => {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    if (!navigator.onLine) {
      return { status: 'CRITICAL', message: 'Offline' };
    }
    return { status: 'HEALTHY', message: 'Online' };
  }
  return { status: 'UNKNOWN', message: 'Network status unavailable' };
}, { interval: 10000, critical: true });

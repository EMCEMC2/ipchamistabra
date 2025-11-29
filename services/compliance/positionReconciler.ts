/**
 * Position Reconciliation Service
 * Ensures local state matches exchange state for compliance
 */

import { Position } from '../../types';
import { logRiskAlert } from '../audit/auditLogger';
import { getSyncedTime } from './timeSync';

export interface ExchangePosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice: number;
  timestamp: number;
}

export interface ReconciliationResult {
  matched: ReconciliationMatch[];
  mismatched: ReconciliationMismatch[];
  orphanedLocal: Position[];
  orphanedRemote: ExchangePosition[];
  lastReconciled: number;
  isClean: boolean;
  summary: string;
}

interface ReconciliationMatch {
  localPosition: Position;
  remotePosition: ExchangePosition;
  quantityMatch: boolean;
  priceMatch: boolean;
}

interface ReconciliationMismatch {
  localPosition: Position;
  remotePosition: ExchangePosition;
  discrepancies: {
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
}

const PRICE_TOLERANCE = 0.001; // 0.1% price difference tolerance
const QUANTITY_TOLERANCE = 0.00001; // Tiny quantity tolerance for floating point

let lastReconciliation: ReconciliationResult | null = null;
let reconciliationInterval: number | null = null;

/**
 * Fetch positions from exchange (mock implementation)
 * In production, this would call the actual exchange API
 */
async function fetchExchangePositions(): Promise<ExchangePosition[]> {
  // Mock implementation - returns empty array
  // Real implementation would call Binance Futures API
  console.log('[PositionReconciler] Fetching exchange positions (mock)');
  return [];
}

/**
 * Reconcile local positions with exchange
 */
export async function reconcilePositions(
  localPositions: Position[]
): Promise<ReconciliationResult> {
  const timestamp = getSyncedTime();

  try {
    const remotePositions = await fetchExchangePositions();

    const matched: ReconciliationMatch[] = [];
    const mismatched: ReconciliationMismatch[] = [];
    const processedRemoteIds = new Set<string>();

    // Match local positions to remote
    for (const localPos of localPositions) {
      const remotePos = remotePositions.find(
        rp => rp.symbol === localPos.pair && rp.side === localPos.type
      );

      if (!remotePos) {
        // Orphaned local position
        continue;
      }

      processedRemoteIds.add(`${remotePos.symbol}-${remotePos.side}`);

      const quantityMatch = Math.abs(localPos.size - remotePos.quantity) < QUANTITY_TOLERANCE;
      const priceMatch = Math.abs(localPos.entryPrice - remotePos.entryPrice) / localPos.entryPrice < PRICE_TOLERANCE;

      if (quantityMatch && priceMatch) {
        matched.push({
          localPosition: localPos,
          remotePosition: remotePos,
          quantityMatch: true,
          priceMatch: true
        });
      } else {
        const discrepancies: ReconciliationMismatch['discrepancies'] = [];

        if (!quantityMatch) {
          discrepancies.push({
            field: 'size',
            localValue: localPos.size,
            remoteValue: remotePos.quantity,
            severity: 'HIGH'
          });
        }

        if (!priceMatch) {
          discrepancies.push({
            field: 'entryPrice',
            localValue: localPos.entryPrice,
            remoteValue: remotePos.entryPrice,
            severity: 'MEDIUM'
          });
        }

        mismatched.push({
          localPosition: localPos,
          remotePosition: remotePos,
          discrepancies
        });
      }
    }

    // Find orphaned positions
    const orphanedLocal = localPositions.filter(lp => {
      const remote = remotePositions.find(
        rp => rp.symbol === lp.pair && rp.side === lp.type
      );
      return !remote;
    });

    const orphanedRemote = remotePositions.filter(rp => {
      const id = `${rp.symbol}-${rp.side}`;
      return !processedRemoteIds.has(id) && !localPositions.some(
        lp => lp.pair === rp.symbol && lp.type === rp.side
      );
    });

    // Build result
    const isClean = mismatched.length === 0 &&
                    orphanedLocal.length === 0 &&
                    orphanedRemote.length === 0;

    const result: ReconciliationResult = {
      matched,
      mismatched,
      orphanedLocal,
      orphanedRemote,
      lastReconciled: timestamp,
      isClean,
      summary: buildSummary(matched, mismatched, orphanedLocal, orphanedRemote)
    };

    // Log alerts for issues
    if (!isClean) {
      logReconciliationAlerts(result);
    }

    lastReconciliation = result;
    return result;

  } catch (error) {
    console.error('[PositionReconciler] Reconciliation failed:', error);

    const errorResult: ReconciliationResult = {
      matched: [],
      mismatched: [],
      orphanedLocal: [],
      orphanedRemote: [],
      lastReconciled: timestamp,
      isClean: false,
      summary: `Reconciliation failed: ${error}`
    };

    lastReconciliation = errorResult;
    return errorResult;
  }
}

/**
 * Build summary string
 */
function buildSummary(
  matched: ReconciliationMatch[],
  mismatched: ReconciliationMismatch[],
  orphanedLocal: Position[],
  orphanedRemote: ExchangePosition[]
): string {
  const parts: string[] = [];

  if (matched.length > 0) {
    parts.push(`${matched.length} positions matched`);
  }

  if (mismatched.length > 0) {
    parts.push(`${mismatched.length} discrepancies found`);
  }

  if (orphanedLocal.length > 0) {
    parts.push(`${orphanedLocal.length} local-only positions`);
  }

  if (orphanedRemote.length > 0) {
    parts.push(`${orphanedRemote.length} remote-only positions`);
  }

  if (parts.length === 0) {
    return 'No positions to reconcile';
  }

  return parts.join(', ');
}

/**
 * Log reconciliation alerts
 */
function logReconciliationAlerts(result: ReconciliationResult): void {
  if (result.mismatched.length > 0) {
    for (const mismatch of result.mismatched) {
      logRiskAlert('POSITION_MISMATCH', 'HIGH', {
        positionId: mismatch.localPosition.id,
        symbol: mismatch.localPosition.pair,
        discrepancies: mismatch.discrepancies
      });
    }
  }

  if (result.orphanedLocal.length > 0) {
    logRiskAlert('ORPHANED_LOCAL_POSITIONS', 'MEDIUM', {
      count: result.orphanedLocal.length,
      positions: result.orphanedLocal.map(p => ({
        id: p.id,
        symbol: p.pair,
        side: p.type
      }))
    });
  }

  if (result.orphanedRemote.length > 0) {
    logRiskAlert('ORPHANED_REMOTE_POSITIONS', 'CRITICAL', {
      count: result.orphanedRemote.length,
      positions: result.orphanedRemote.map(p => ({
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity
      }))
    });
  }
}

/**
 * Get last reconciliation result
 */
export function getLastReconciliation(): ReconciliationResult | null {
  return lastReconciliation;
}

/**
 * Check if reconciliation is needed
 */
export function isReconciliationStale(maxAgeMs: number = 300000): boolean {
  if (!lastReconciliation) return true;
  const age = getSyncedTime() - lastReconciliation.lastReconciled;
  return age > maxAgeMs;
}

/**
 * Start periodic reconciliation
 */
export function startPeriodicReconciliation(
  getPositions: () => Position[],
  intervalMs: number = 60000
): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
  }

  reconciliationInterval = window.setInterval(() => {
    const positions = getPositions();
    if (positions.length > 0) {
      reconcilePositions(positions);
    }
  }, intervalMs);

  console.log('[PositionReconciler] Started periodic reconciliation');
}

/**
 * Stop periodic reconciliation
 */
export function stopPeriodicReconciliation(): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
  }
}

/**
 * Manual reconciliation trigger
 */
export async function triggerReconciliation(
  localPositions: Position[]
): Promise<ReconciliationResult> {
  return reconcilePositions(localPositions);
}

/**
 * Get reconciliation health status
 */
export function getReconciliationHealth(): {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  message: string;
  lastCheck: number | null;
} {
  if (!lastReconciliation) {
    return {
      status: 'UNKNOWN',
      message: 'No reconciliation performed yet',
      lastCheck: null
    };
  }

  if (lastReconciliation.isClean) {
    return {
      status: 'HEALTHY',
      message: lastReconciliation.summary,
      lastCheck: lastReconciliation.lastReconciled
    };
  }

  if (lastReconciliation.orphanedRemote.length > 0) {
    return {
      status: 'CRITICAL',
      message: `Critical: ${lastReconciliation.orphanedRemote.length} untracked positions on exchange`,
      lastCheck: lastReconciliation.lastReconciled
    };
  }

  return {
    status: 'WARNING',
    message: lastReconciliation.summary,
    lastCheck: lastReconciliation.lastReconciled
  };
}

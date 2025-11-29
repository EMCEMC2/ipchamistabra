/**
 * State Migration System
 *
 * Handles versioned state upgrades for localStorage persistence.
 * Each migration transforms state from version N to N+1.
 */

import { INITIAL_RISK_STATE, RiskOfficerState } from '../services/riskOfficer';
import { JournalEntry, Position, TradeSignal } from '../types';

// Current schema version - increment when adding migrations
export const CURRENT_STATE_VERSION = 2;

// Storage key for the app
export const STORAGE_KEY = 'ipcha-mistabra-storage';

/**
 * Persisted state shape (what gets saved to localStorage)
 */
export interface PersistedState {
  balance: number;
  positions: Position[];
  journal: JournalEntry[];
  signals: TradeSignal[];
  activeTradeSetup: Partial<Position> | null;
  riskOfficer: RiskOfficerState;
  dailyLossLimit: number;
  dailyPnL: number;
  lastResetDate: string;
  isCircuitBreakerTripped: boolean;
  executionSide: 'LONG' | 'SHORT';
  confluenceWeights?: {
    technical: number;
    volatility: number;
    sentiment: number;
    orderFlow: number;
    macro: number;
  };
}

/**
 * Migration function type
 */
type MigrationFn = (state: any) => any;

/**
 * Migration registry - maps version to upgrade function
 * Migration N transforms state from version N-1 to N
 */
const migrations: Record<number, MigrationFn> = {
  // v1 -> v2: Add confluence weights, normalize journal entries
  2: (state: any) => {
    return {
      ...state,
      // Add default confluence weights if missing
      confluenceWeights: state.confluenceWeights || {
        technical: 10,
        volatility: 5,
        sentiment: 7,
        orderFlow: 5,
        macro: 3
      },
      // Ensure daily loss fields exist
      dailyLossLimit: state.dailyLossLimit ?? 2500,
      dailyPnL: state.dailyPnL ?? 0,
      lastResetDate: state.lastResetDate || new Date().toISOString().split('T')[0],
      isCircuitBreakerTripped: state.isCircuitBreakerTripped ?? false,
      executionSide: state.executionSide || 'LONG',
      // Normalize arrays
      journal: normalizeJournalEntries(state.journal),
      positions: Array.isArray(state.positions) ? state.positions : [],
      signals: normalizeSignals(state.signals),
      // Ensure riskOfficer exists
      riskOfficer: state.riskOfficer || INITIAL_RISK_STATE
    };
  }
};

/**
 * Normalize journal entries to ensure all required fields
 */
function normalizeJournalEntries(entries: any[]): JournalEntry[] {
  if (!Array.isArray(entries)) return [];

  return entries.map((entry: any) => ({
    ...entry,
    id: entry.id || `journal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: entry.timestamp || Date.now(),
    pair: entry.pair || 'BTCUSDT',
    type: entry.type || 'LONG',
    entryPrice: entry.entryPrice || 0,
    exitPrice: entry.exitPrice || 0,
    pnl: entry.pnl ?? 0,
    pnlPercent: entry.pnlPercent ?? 0,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    mood: entry.mood || 'NEUTRAL',
    result: entry.result || (typeof entry.pnl === 'number'
      ? entry.pnl > 0 ? 'WIN' : entry.pnl < 0 ? 'LOSS' : 'BE'
      : 'BE'),
    notes: entry.notes || '',
    aiFeedback: entry.aiFeedback
  }));
}

/**
 * Normalize trade signals to ensure validity
 */
function normalizeSignals(signals: any[]): TradeSignal[] {
  if (!Array.isArray(signals)) return [];

  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  return signals
    .filter((s: any) => {
      // Filter out expired signals
      if (!s.timestamp) return false;
      return now - s.timestamp < maxAge;
    })
    .map((signal: any) => ({
      ...signal,
      id: signal.id || `signal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: signal.timestamp,
      pair: signal.pair || 'BTCUSDT',
      type: signal.type || 'LONG',
      entryZone: signal.entryZone || '0-0',
      stopLoss: signal.stopLoss ?? 0,
      takeProfit: signal.takeProfit ?? [],
      confidence: signal.confidence ?? 50,
      status: signal.status || 'ACTIVE'
    }));
}

/**
 * Run migrations sequentially from fromVersion to CURRENT_STATE_VERSION
 */
export function runMigrations(state: any, fromVersion: number): any {
  let migratedState = { ...state };

  for (let v = fromVersion + 1; v <= CURRENT_STATE_VERSION; v++) {
    const migrateFn = migrations[v];
    if (migrateFn) {
      console.log(`[Migration] Upgrading state from v${v - 1} to v${v}`);
      migratedState = migrateFn(migratedState);
    }
  }

  return migratedState;
}

/**
 * Validate persisted state structure
 */
export function validatePersistedState(state: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof state.balance !== 'number' || isNaN(state.balance)) {
    errors.push('Invalid balance');
  }

  if (!Array.isArray(state.positions)) {
    errors.push('Positions must be an array');
  }

  if (!Array.isArray(state.journal)) {
    errors.push('Journal must be an array');
  }

  if (!Array.isArray(state.signals)) {
    errors.push('Signals must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default persisted state
 */
export function getDefaultPersistedState(): PersistedState {
  return {
    balance: 50000,
    positions: [],
    journal: [],
    signals: [],
    activeTradeSetup: null,
    riskOfficer: INITIAL_RISK_STATE,
    dailyLossLimit: 2500,
    dailyPnL: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    isCircuitBreakerTripped: false,
    executionSide: 'LONG',
    confluenceWeights: {
      technical: 10,
      volatility: 5,
      sentiment: 7,
      orderFlow: 5,
      macro: 3
    }
  };
}

/**
 * Safe state loader with migration support
 */
export function loadAndMigrateState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const storedVersion = parsed.version ?? 1;
    let state = parsed.state;

    if (!state) return null;

    // Run migrations if needed
    if (storedVersion < CURRENT_STATE_VERSION) {
      state = runMigrations(state, storedVersion);

      // Save migrated state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: CURRENT_STATE_VERSION,
        state
      }));

      console.log(`[Migration] State upgraded from v${storedVersion} to v${CURRENT_STATE_VERSION}`);
    }

    // Validate
    const validation = validatePersistedState(state);
    if (!validation.valid) {
      console.warn('[Migration] State validation errors:', validation.errors);
    }

    return state;
  } catch (error) {
    console.error('[Migration] Failed to load state:', error);
    return null;
  }
}

/**
 * Clear all persisted state (factory reset)
 */
export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[Migration] State cleared');
}

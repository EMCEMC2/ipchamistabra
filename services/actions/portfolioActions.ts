/**
 * Portfolio Actions
 * Decouples portfolio operations from store mutations
 */

import { useStore } from '../../store/useStore';
import { Position, JournalEntry } from '../../types';

/**
 * Update balance action
 */
export function updateBalance(amount: number): void {
  useStore.getState().updateBalance(amount);
}

/**
 * Add position action
 */
export function addPosition(position: Position): void {
  useStore.getState().addPosition(position);
}

/**
 * Close position action
 */
export function closePosition(positionId: string, pnl: number): void {
  useStore.getState().closePosition(positionId, pnl);
}

/**
 * Update position P&L action
 */
export function updatePositionPnl(
  positionId: string,
  pnl: number,
  pnlPercent: number
): void {
  useStore.getState().updatePositionPnl(positionId, pnl, pnlPercent);
}

/**
 * Add journal entry action
 */
export function addJournalEntry(entry: JournalEntry): void {
  useStore.getState().addJournalEntry(entry);
}

/**
 * Set daily loss limit action
 */
export function setDailyLossLimit(limit: number): void {
  useStore.getState().setDailyLossLimit(limit);
}

/**
 * Reset daily P&L action
 */
export function resetDailyPnL(): void {
  useStore.getState().resetDailyPnL();
}

/**
 * Check circuit breaker action
 */
export function checkCircuitBreaker(): boolean {
  return useStore.getState().checkCircuitBreaker();
}

/**
 * Set active trade setup action
 */
export function setActiveTradeSetup(setup: Partial<Position> | null): void {
  useStore.getState().setActiveTradeSetup(setup);
}

/**
 * Set execution side action
 */
export function setExecutionSide(side: 'LONG' | 'SHORT'): void {
  useStore.getState().setExecutionSide(side);
}

/**
 * Set live mode action
 */
export function setLiveMode(isLive: boolean): void {
  useStore.getState().setIsLiveMode(isLive);
}

/**
 * Get current portfolio state (read-only)
 */
export function getPortfolioState() {
  const state = useStore.getState();
  return {
    balance: state.balance,
    positions: state.positions,
    journal: state.journal,
    activeTradeSetup: state.activeTradeSetup,
    executionSide: state.executionSide,
    dailyLossLimit: state.dailyLossLimit,
    dailyPnL: state.dailyPnL,
    lastResetDate: state.lastResetDate,
    isCircuitBreakerTripped: state.isCircuitBreakerTripped,
    isLiveMode: state.isLiveMode
  };
}

/**
 * Calculate total P&L from open positions
 */
export function calculateOpenPnL(): number {
  const { positions } = getPortfolioState();
  return positions.reduce((total, pos) => total + (pos.pnl || 0), 0);
}

/**
 * Calculate total exposure
 */
export function calculateTotalExposure(): number {
  const { positions } = getPortfolioState();
  return positions.reduce((total, pos) => {
    const positionValue = pos.entryPrice * pos.size;
    return total + positionValue;
  }, 0);
}

/**
 * Get position by ID
 */
export function getPosition(positionId: string): Position | undefined {
  const { positions } = getPortfolioState();
  return positions.find(p => p.id === positionId);
}

/**
 * Check if can open new position (risk limits)
 */
export function canOpenPosition(size: number, price: number): {
  allowed: boolean;
  reason?: string;
} {
  const state = getPortfolioState();

  // Circuit breaker check
  if (state.isCircuitBreakerTripped) {
    return {
      allowed: false,
      reason: 'Circuit breaker tripped - daily loss limit reached'
    };
  }

  // Balance check
  const positionValue = size * price;
  const margin = positionValue * 0.1; // Assume 10x leverage
  if (margin > state.balance * 0.5) {
    return {
      allowed: false,
      reason: 'Position size exceeds 50% of available margin'
    };
  }

  return { allowed: true };
}

/**
 * Subscribe to portfolio state changes
 */
export function subscribeToPortfolio(
  callback: (state: ReturnType<typeof getPortfolioState>) => void
): () => void {
  return useStore.subscribe((state) => {
    callback({
      balance: state.balance,
      positions: state.positions,
      journal: state.journal,
      activeTradeSetup: state.activeTradeSetup,
      executionSide: state.executionSide,
      dailyLossLimit: state.dailyLossLimit,
      dailyPnL: state.dailyPnL,
      lastResetDate: state.lastResetDate,
      isCircuitBreakerTripped: state.isCircuitBreakerTripped,
      isLiveMode: state.isLiveMode
    });
  });
}

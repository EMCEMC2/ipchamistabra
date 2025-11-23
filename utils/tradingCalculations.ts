/**
 * CORE TRADING CALCULATIONS
 * Pure functions for PnL, R:R, Regime, Liquidation, etc.
 * NO AI - Just Math. Tested. Reliable.
 */

import { Position, TradeSignal } from '../types';

/**
 * Calculate unrealized PnL for an open position
 * @param position - The open position
 * @param currentPrice - Current market price
 * @returns Object with PnL in USD and percentage
 */
export function calculatePositionPnL(
  position: Position,
  currentPrice: number
): { pnlUSD: number; pnlPercent: number } {
  const { type, entryPrice, size, leverage } = position;

  if (currentPrice <= 0 || entryPrice <= 0 || size <= 0) {
    return { pnlUSD: 0, pnlPercent: 0 };
  }

  // Price change
  const priceChange = currentPrice - entryPrice;

  // PnL calculation
  let pnlUSD: number;
  if (type === 'LONG') {
    pnlUSD = priceChange * size;
  } else {
    // SHORT: profit when price goes down
    pnlUSD = -priceChange * size;
  }

  // Apply leverage to PnL
  pnlUSD = pnlUSD * leverage;

  // Calculate percentage return
  const positionValue = entryPrice * size;
  const margin = positionValue / leverage;
  const pnlPercent = margin > 0 ? (pnlUSD / margin) * 100 : 0;

  return { pnlUSD, pnlPercent };
}

/**
 * Calculate Risk-Reward Ratio
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param takeProfit - Take profit price
 * @returns R:R ratio (e.g., 2.5 means 2.5:1)
 */
export function calculateRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): number {
  if (entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0) {
    return 0;
  }

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);

  if (risk === 0) return 0;

  return reward / risk;
}

/**
 * Parse price string (handles "$84,500" or "84500-84800" ranges)
 * @param priceStr - Price string from AI or user input
 * @returns Parsed number or null
 */
export function parsePrice(priceStr: string | number): number | null {
  if (typeof priceStr === 'number') return priceStr;

  // Remove all non-numeric except decimal and dash
  const cleaned = priceStr.replace(/[^0-9.\-]/g, '');

  // If range (e.g., "84000-84500"), take midpoint
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const low = parseFloat(parts[0]);
    const high = parseFloat(parts[1]);
    if (!isNaN(low) && !isNaN(high)) {
      return (low + high) / 2;
    }
  }

  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * Calculate liquidation price for leveraged position
 * @param entryPrice - Entry price
 * @param leverage - Leverage multiplier
 * @param type - LONG or SHORT
 * @returns Liquidation price
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  type: 'LONG' | 'SHORT'
): number {
  if (entryPrice <= 0 || leverage <= 0) return 0;

  // Simplified liquidation (assumes 100% margin used)
  // Real formula includes fees, but this is close enough for paper trading
  if (type === 'LONG') {
    return entryPrice * (1 - 0.9 / leverage); // 90% loss triggers liq
  } else {
    return entryPrice * (1 + 0.9 / leverage);
  }
}

/**
 * Determine market regime based on ATR and ADX
 * @param atr - Average True Range
 * @param atrSMA - ATR Simple Moving Average (baseline)
 * @param atrStdDev - ATR Standard Deviation
 * @param adx - Average Directional Index
 * @returns Regime classification
 */
export function classifyMarketRegime(
  atr: number,
  atrSMA: number,
  atrStdDev: number,
  adx: number
): 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'TRENDING' {
  if (atrStdDev === 0) return 'NORMAL';

  // Normalize ATR
  const normATR = (atr - atrSMA) / atrStdDev;

  // Strong trend detection
  if (adx > 25) return 'TRENDING';

  // Volatility classification
  if (normATR < -0.5) return 'LOW_VOL';
  if (normATR > 1.0) return 'HIGH_VOL';

  return 'NORMAL';
}

/**
 * Check if position should be closed (SL/TP hit)
 * @param position - The open position
 * @param currentPrice - Current market price
 * @returns Object indicating if should close and reason
 */
export function checkPositionClose(
  position: Position,
  currentPrice: number
): { shouldClose: boolean; reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIQUIDATED' | null } {
  const { type, stopLoss, takeProfit, liquidationPrice } = position;

  // Check liquidation first (most critical)
  if (type === 'LONG' && currentPrice <= liquidationPrice) {
    return { shouldClose: true, reason: 'LIQUIDATED' };
  }
  if (type === 'SHORT' && currentPrice >= liquidationPrice) {
    return { shouldClose: true, reason: 'LIQUIDATED' };
  }

  // Check stop loss
  if (type === 'LONG' && currentPrice <= stopLoss) {
    return { shouldClose: true, reason: 'STOP_LOSS' };
  }
  if (type === 'SHORT' && currentPrice >= stopLoss) {
    return { shouldClose: true, reason: 'STOP_LOSS' };
  }

  // Check take profit
  if (type === 'LONG' && currentPrice >= takeProfit) {
    return { shouldClose: true, reason: 'TAKE_PROFIT' };
  }
  if (type === 'SHORT' && currentPrice <= takeProfit) {
    return { shouldClose: true, reason: 'TAKE_PROFIT' };
  }

  return { shouldClose: false, reason: null };
}

/**
 * Validate signal data (ensure numbers are real, not hallucinated)
 * @param signal - Signal to validate
 * @returns Validated signal or null if invalid
 */
export function validateSignal(signal: Partial<TradeSignal>): TradeSignal | null {
  // Parse prices
  const entry = parsePrice(signal.entryZone || '');
  const stop = parsePrice(signal.invalidation || '');
  const target = parsePrice(signal.targets?.[0] || '');

  if (!entry || !stop || !target) {
    console.warn('[Signal Validation] Failed to parse prices:', {
      entry: signal.entryZone,
      stop: signal.invalidation,
      target: signal.targets?.[0]
    });
    return null;
  }

  // Validate logic
  if (signal.type === 'LONG') {
    if (stop >= entry) {
      console.warn('[Signal Validation] LONG stop must be below entry');
      return null;
    }
    if (target <= entry) {
      console.warn('[Signal Validation] LONG target must be above entry');
      return null;
    }
  } else if (signal.type === 'SHORT') {
    if (stop <= entry) {
      console.warn('[Signal Validation] SHORT stop must be above entry');
      return null;
    }
    if (target >= entry) {
      console.warn('[Signal Validation] SHORT target must be below entry');
      return null;
    }
  }

  // Calculate REAL R:R (don't trust AI)
  const calculatedRR = calculateRiskReward(entry, stop, target);

  // Reconstruct with validated data
  return {
    id: signal.id || Math.random().toString(36).substr(2, 9),
    pair: signal.pair || 'BTCUSDT',
    type: signal.type || 'LONG',
    entryZone: entry.toFixed(2),
    invalidation: stop.toFixed(2),
    targets: [target.toFixed(2)],
    riskRewardRatio: Number(calculatedRR.toFixed(2)), // OUR calculation
    confidence: Math.min(100, Math.max(0, signal.confidence || 50)),
    regime: signal.regime || 'NORMAL',
    reasoning: signal.reasoning || 'AI-generated signal',
    status: signal.status || 'ACTIVE',
    timestamp: signal.timestamp || Date.now()
  };
}

/**
 * Calculate position size based on risk percentage
 * @param balance - Account balance (USD)
 * @param riskPercent - Risk per trade (e.g., 1 = 1%)
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param leverage - Leverage multiplier
 * @returns Position size in BTC
 */
export function calculatePositionSize(
  balance: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  leverage: number
): number {
  if (balance <= 0 || riskPercent <= 0 || entryPrice <= 0 || leverage <= 0) {
    return 0;
  }

  const riskAmount = balance * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLoss);

  if (stopDistance === 0) return 0;

  // Position size = Risk Amount / (Stop Distance * Leverage)
  // This ensures you only lose riskAmount if SL hits
  const size = riskAmount / (stopDistance * leverage);

  return size;
}

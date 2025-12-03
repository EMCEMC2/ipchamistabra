/**
 * RISK OFFICER
 * The "Shield" of the system. Enforces safety rules and prevents emotional trading.
 */

import { Position } from '../types';

export type VetoReason =
  | 'DAILY_LOSS_LIMIT'
  | 'MAX_EXPOSURE'
  | 'INSUFFICIENT_RR'
  | 'CORRELATED_POSITION'
  | 'HIGH_VOL_OVERSIZED'
  | 'LIQUIDITY_CONCERN'
  | 'COOLDOWN_ACTIVE'
  | 'STOP_LOSS_UNDEFINED'
  | 'STOP_LOSS_INVALID'
  | 'MAX_POSITION_SIZE'
  | 'ATR_RISK_EXCEEDED';

export interface VetoRecord {
  id: string;
  timestamp: number;
  reason: VetoReason;
  details: string;
  metrics: {
    dailyPnL?: number;
    exposure?: number;
    riskReward?: number;
  };
}

export interface CooldownState {
  active: boolean;
  reason: string;
  endsAt: number;
  remainingMs: number;
}

export interface RiskOfficerState {
  lastVeto: VetoRecord | null;
  vetoHistory: VetoRecord[];
  cooldown: CooldownState | null;
}

export const INITIAL_RISK_STATE: RiskOfficerState = {
  lastVeto: null,
  vetoHistory: [],
  cooldown: null,
};

const COOLDOWN_CONFIG = {
  DAILY_LOSS_LIMIT: {
    durationMs: 10 * 60 * 1000, // 10 mins
    message: 'Daily loss limit reached. Cooldown active to prevent revenge trading.',
  },
  CONSECUTIVE_LOSSES: {
    threshold: 3,
    durationMs: 5 * 60 * 1000, // 5 mins
    message: '3 consecutive losses. Short cooldown to reassess.',
  },
};

export interface TradeProposal {
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  size: number; // In BTC
  leverage: number;
  atr?: number; // Average True Range for volatility-based risk check
}

export interface RiskCheckResult {
  blocked: boolean;
  reason?: VetoReason;
  message?: string;
}

/**
 * Checks if a trade should be blocked based on current state and risk rules.
 */
export function checkRiskVeto(
  proposal: TradeProposal,
  userState: { dailyPnL: number; dailyLossLimit: number; balance: number; positions: Position[] },
  riskState: RiskOfficerState
): RiskCheckResult {

  // 1. Check Cooldown
  if (riskState.cooldown && riskState.cooldown.active) {
    const now = Date.now();
    if (now < riskState.cooldown.endsAt) {
      return {
        blocked: true,
        reason: 'COOLDOWN_ACTIVE',
        message: riskState.cooldown.reason
      };
    }
  }

  // 2. CRITICAL: Mandatory Stop Loss - MUST be defined and valid
  if (!proposal.stopLoss || proposal.stopLoss <= 0) {
    return {
      blocked: true,
      reason: 'STOP_LOSS_UNDEFINED',
      message: 'Stop loss is required for all trades. No trade without defined risk.'
    };
  }

  // Validate stop loss direction
  if (proposal.type === 'LONG' && proposal.stopLoss >= proposal.entryPrice) {
    return {
      blocked: true,
      reason: 'STOP_LOSS_INVALID',
      message: `LONG stop loss must be below entry. SL: $${proposal.stopLoss.toFixed(2)} >= Entry: $${proposal.entryPrice.toFixed(2)}`
    };
  }
  if (proposal.type === 'SHORT' && proposal.stopLoss <= proposal.entryPrice) {
    return {
      blocked: true,
      reason: 'STOP_LOSS_INVALID',
      message: `SHORT stop loss must be above entry. SL: $${proposal.stopLoss.toFixed(2)} <= Entry: $${proposal.entryPrice.toFixed(2)}`
    };
  }

  // 3. Daily Loss Limit
  // Note: dailyPnL is usually negative when losing. e.g. -500. Limit is positive e.g. 2500.
  // So if dailyPnL <= -dailyLossLimit, we are done.
  if (userState.dailyPnL <= -userState.dailyLossLimit) {
    return {
      blocked: true,
      reason: 'DAILY_LOSS_LIMIT',
      message: `Daily loss limit reached ($${userState.dailyPnL.toFixed(2)} / -$${userState.dailyLossLimit})`
    };
  }

  // 4. CRITICAL: Max Position Size (5% of balance per trade)
  const MAX_POSITION_PERCENT = 5;
  const positionValueUSD = proposal.entryPrice * proposal.size;
  const maxPositionValue = userState.balance * (MAX_POSITION_PERCENT / 100);

  if (positionValueUSD > maxPositionValue) {
    return {
      blocked: true,
      reason: 'MAX_POSITION_SIZE',
      message: `Position too large. Value: $${positionValueUSD.toFixed(2)} > Max ${MAX_POSITION_PERCENT}% ($${maxPositionValue.toFixed(2)})`
    };
  }

  // 5. Max Exposure (Simple check: don't use more than 100% of balance as margin)
  const marginUsed = userState.positions.reduce((sum, p) => sum + (p.entryPrice * p.size / p.leverage), 0);
  const newMargin = (proposal.entryPrice * proposal.size / proposal.leverage);

  if (marginUsed + newMargin > userState.balance) {
      return {
          blocked: true,
          reason: 'MAX_EXPOSURE',
          message: `Insufficient balance for margin. Used: $${marginUsed.toFixed(2)}, Req: $${newMargin.toFixed(2)}, Bal: $${userState.balance.toFixed(2)}`
      };
  }

  // 6. Risk/Reward
  const risk = Math.abs(proposal.entryPrice - proposal.stopLoss);
  const reward = Math.abs(proposal.takeProfit - proposal.entryPrice);
  if (risk > 0 && (reward / risk) < 1.0) {
      return {
          blocked: true,
          reason: 'INSUFFICIENT_RR',
          message: `Risk/Reward ${ (reward/risk).toFixed(2) } is below 1.0 minimum.`
      };
  }

  // 7. ATR-Based Risk Check
  // Stop loss should not exceed 2x ATR to avoid excessive volatility exposure
  if (proposal.atr && proposal.atr > 0) {
    const stopDistance = Math.abs(proposal.entryPrice - proposal.stopLoss);
    const maxStopDistance = proposal.atr * 2; // 2x ATR is the max safe stop distance

    if (stopDistance > maxStopDistance) {
      return {
        blocked: true,
        reason: 'ATR_RISK_EXCEEDED',
        message: `Stop loss too wide for current volatility. Distance: $${stopDistance.toFixed(2)} > 2x ATR ($${maxStopDistance.toFixed(2)}). Consider tighter stop or wait for lower volatility.`
      };
    }
  }

  return { blocked: false };
}

export function createVetoRecord(reason: VetoReason, message: string, metrics: any): VetoRecord {
    return {
        id: Date.now().toString(),
        timestamp: Date.now(),
        reason,
        details: message,
        metrics
    };
}

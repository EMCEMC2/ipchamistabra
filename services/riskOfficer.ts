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
  | 'COOLDOWN_ACTIVE';

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

  // 2. Daily Loss Limit
  // Note: dailyPnL is usually negative when losing. e.g. -500. Limit is positive e.g. 2500.
  // So if dailyPnL <= -dailyLossLimit, we are done.
  if (userState.dailyPnL <= -userState.dailyLossLimit) {
    return {
      blocked: true,
      reason: 'DAILY_LOSS_LIMIT',
      message: `Daily loss limit reached ($${userState.dailyPnL.toFixed(2)} / -$${userState.dailyLossLimit})`
    };
  }

  // 3. Max Exposure (Simple check: don't use more than 100% of balance as margin)
  const marginUsed = userState.positions.reduce((sum, p) => sum + (p.entryPrice * p.size / p.leverage), 0);
  const newMargin = (proposal.entryPrice * proposal.size / proposal.leverage);
  
  if (marginUsed + newMargin > userState.balance) {
      return {
          blocked: true,
          reason: 'MAX_EXPOSURE',
          message: `Insufficient balance for margin. Used: $${marginUsed.toFixed(2)}, Req: $${newMargin.toFixed(2)}, Bal: $${userState.balance.toFixed(2)}`
      };
  }

  // 4. Risk/Reward
  const risk = Math.abs(proposal.entryPrice - proposal.stopLoss);
  const reward = Math.abs(proposal.takeProfit - proposal.entryPrice);
  if (risk > 0 && (reward / risk) < 1.0) {
      // Soft veto? Or hard? Let's make it hard for "Safe Trading"
      return {
          blocked: true,
          reason: 'INSUFFICIENT_RR',
          message: `Risk/Reward ${ (reward/risk).toFixed(2) } is below 1.0 minimum.`
      };
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

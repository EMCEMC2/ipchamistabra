import { AppState } from '../store/useStore';
import { AgentVote, ConfidenceAdjustment, TradeSignal } from '../types';
import { TacticalSignalResult } from './tacticalSignals';

/**
 * CONFLUENCE FACTOR WEIGHTS
 * Configurable weights for each factor in the consensus calculation.
 * Values represent the max boost/penalty each factor can contribute.
 */
export interface ConfluenceWeights {
  technical: number;     // VANGUARD - Technical signals
  volatility: number;    // DATAMIND - Volume/volatility regime
  sentiment: number;     // OVERMIND - Market sentiment
  orderFlow: number;     // WATCHDOG - Funding/order flow
  macro: number;         // VIX/DXY/BTCD macro factors
}

export const DEFAULT_CONFLUENCE_WEIGHTS: ConfluenceWeights = {
  technical: 10,   // Max 10 points boost/penalty
  volatility: 5,   // Max 5 points
  sentiment: 7,    // Max 7 points
  orderFlow: 5,    // Max 5 points
  macro: 3         // Max 3 points
};

// Current active weights (can be modified at runtime)
let activeWeights: ConfluenceWeights = { ...DEFAULT_CONFLUENCE_WEIGHTS };

/**
 * Update confluence weights at runtime
 */
export const setConfluenceWeights = (weights: Partial<ConfluenceWeights>) => {
  activeWeights = { ...activeWeights, ...weights };
};

/**
 * Get current confluence weights
 */
export const getConfluenceWeights = (): ConfluenceWeights => ({ ...activeWeights });

/**
 * Reset weights to defaults
 */
export const resetConfluenceWeights = () => {
  activeWeights = { ...DEFAULT_CONFLUENCE_WEIGHTS };
};

/**
 * VIRTUAL AGENT DEFINITIONS
 * These are pure functions that analyze state and return a vote.
 */

// 1. VANGUARD (Strategist) - Technical Analysis
const getTechnicalVote = (signalResult: TacticalSignalResult): AgentVote => {
  const score = Math.max(signalResult.bullScore, signalResult.bearScore);
  const type = signalResult.bullScore > signalResult.bearScore ? 'BULLISH' : 'BEARISH';
  
  return {
    agentName: 'VANGUARD',
    vote: type,
    confidence: Math.min(score * 10, 100), // Scale 0-10 to 0-100
    reason: `Technical confluence score: ${score.toFixed(1)}/10`
  };
};

// 2. DATAMIND (Quant) - Volatility & Regime
const getVolatilityVote = (state: AppState): AgentVote => {
  const { enhancedMetrics, technicals } = state;
  const volTag = enhancedMetrics.volumeTag;
  
  let vote: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'Volatility is normal';
  let confidence = 50;

  if (volTag === 'SPIKE' || volTag === 'HIGH') {
    // High vol usually means continuation or climax. 
    // Without directional context, it's cautious.
    reason = 'High volatility detected (Caution)';
    confidence = 40; 
  } else if (volTag === 'QUIET') {
    reason = 'Low volatility (Squeeze likely)';
    confidence = 60;
  }

  return {
    agentName: 'DATAMIND',
    vote,
    confidence,
    reason
  };
};

// 3. OVERMIND (Orchestrator) - Sentiment & Macro
const getSentimentVote = (state: AppState): AgentVote => {
  const { sentimentLabel, sentimentScore } = state;
  
  const vote = sentimentLabel === 'Bullish' ? 'BULLISH' : 
               sentimentLabel === 'Bearish' ? 'BEARISH' : 'NEUTRAL';
               
  return {
    agentName: 'OVERMIND',
    vote,
    confidence: sentimentScore,
    reason: `Market sentiment is ${sentimentLabel} (${sentimentScore}%)`
  };
};

// 4. WATCHDOG (Inspector) - Order Flow (Simplified for now)
const getOrderFlowVote = (state: AppState): AgentVote => {
  const { derivatives } = state;
  const funding = parseFloat(derivatives.fundingRate);

  // Guard against NaN from malformed funding rate strings
  if (isNaN(funding)) {
    return {
      agentName: 'WATCHDOG',
      vote: 'NEUTRAL',
      confidence: 0,
      reason: 'Funding data unavailable'
    };
  }

  let vote: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let reason = 'Funding is neutral';

  if (funding > 0.01) {
    vote = 'BEARISH'; // Contrarian: High funding = crowded longs
    reason = 'High funding (Crowded Longs)';
  } else if (funding < 0) {
    vote = 'BULLISH'; // Contrarian: Negative funding = crowded shorts
    reason = 'Negative funding (Crowded Shorts)';
  }

  return {
    agentName: 'WATCHDOG',
    vote,
    confidence: Math.min(Math.abs(funding) * 1000, 100), // Clamp to 0-100
    reason
  };
};

// 5. MACRO SENTINEL - VIX/DXY/BTCD Analysis
const getMacroVote = (state: AppState): AgentVote => {
  const { vix, dxy, enhancedMetrics } = state;
  const btcDominance = enhancedMetrics?.btcDominance || state.btcd || 50;

  let vote: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let reasons: string[] = [];
  let bullPoints = 0;
  let bearPoints = 0;

  // VIX Analysis (Fear Index)
  if (vix < 15) {
    bullPoints += 1;
    reasons.push('Low VIX (Risk-on)');
  } else if (vix > 25) {
    bearPoints += 1;
    reasons.push('High VIX (Risk-off)');
  }

  // DXY Analysis (Dollar Strength)
  if (dxy < 100) {
    bullPoints += 1;
    reasons.push('Weak DXY (Crypto favorable)');
  } else if (dxy > 105) {
    bearPoints += 1;
    reasons.push('Strong DXY (Crypto headwind)');
  }

  // BTC Dominance Analysis
  if (btcDominance > 55) {
    // High BTC dominance = risk-off in crypto, money flowing to BTC
    reasons.push('High BTC.D (Flight to safety)');
  } else if (btcDominance < 45) {
    bullPoints += 1;
    reasons.push('Low BTC.D (Alt season potential)');
  }

  if (bullPoints > bearPoints) {
    vote = 'BULLISH';
  } else if (bearPoints > bullPoints) {
    vote = 'BEARISH';
  }

  const confidence = Math.min(50 + Math.abs(bullPoints - bearPoints) * 15, 85);

  return {
    agentName: 'MACRO',
    vote,
    confidence,
    reason: reasons.length > 0 ? reasons.join(', ') : 'Macro neutral'
  };
};

/**
 * Map agent names to weight keys
 */
const agentToWeightKey: Record<string, keyof ConfluenceWeights> = {
  'VANGUARD': 'technical',
  'DATAMIND': 'volatility',
  'OVERMIND': 'sentiment',
  'WATCHDOG': 'orderFlow',
  'MACRO': 'macro'
};

/**
 * Calculate weighted adjustment based on agent vote and confidence
 */
const calculateWeightedAdjustment = (
  agentName: string,
  vote: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  confidence: number,
  baseSignalType: 'LONG' | 'SHORT'
): { value: number; type: 'boost' | 'penalty' } | null => {
  const weightKey = agentToWeightKey[agentName];
  if (!weightKey) return null;

  const maxWeight = activeWeights[weightKey];
  const isAligned = (baseSignalType === 'LONG' && vote === 'BULLISH') ||
                    (baseSignalType === 'SHORT' && vote === 'BEARISH');
  const isOpposed = (baseSignalType === 'LONG' && vote === 'BEARISH') ||
                    (baseSignalType === 'SHORT' && vote === 'BULLISH');

  if (vote === 'NEUTRAL') return null;

  // Scale weight by confidence (0-100 -> 0-1)
  const confidenceMultiplier = Math.min(confidence, 100) / 100;
  const adjustedWeight = Math.round(maxWeight * confidenceMultiplier);

  if (isAligned) {
    return { value: adjustedWeight, type: 'boost' };
  } else if (isOpposed) {
    return { value: -adjustedWeight, type: 'penalty' };
  }

  return null;
};

/**
 * Main Consensus Engine
 */
export const generateConsensus = (
  signalResult: TacticalSignalResult,
  state: AppState
): { votes: AgentVote[]; breakdown: ConfidenceAdjustment[]; totalAdjustment: number } => {

  const votes = [
    getTechnicalVote(signalResult),
    getVolatilityVote(state),
    getSentimentVote(state),
    getOrderFlowVote(state),
    getMacroVote(state)
  ];

  // Calculate Breakdown with configurable weights
  const breakdown: ConfidenceAdjustment[] = [];
  const baseSignalType = signalResult.signal?.type || 'LONG';

  votes.forEach(v => {
    if (v.agentName === 'VANGUARD') return; // Base score, handled separately

    const adjustment = calculateWeightedAdjustment(
      v.agentName,
      v.vote,
      v.confidence,
      baseSignalType
    );

    if (adjustment) {
      breakdown.push({
        label: v.agentName,
        value: adjustment.value,
        type: adjustment.type
      });
    }
  });

  // Calculate total adjustment
  const totalAdjustment = breakdown.reduce((sum, adj) => sum + adj.value, 0);

  return { votes, breakdown, totalAdjustment };
};

import { AppState } from '../store/useStore';
import { AgentVote, ConfidenceAdjustment, TradeSignal } from '../types';
import { TacticalSignalResult } from './tacticalSignals';

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
    confidence: Math.abs(funding) * 1000, // Rough scaling
    reason
  };
};

/**
 * Main Consensus Engine
 */
export const generateConsensus = (
  signalResult: TacticalSignalResult, 
  state: AppState
): { votes: AgentVote[]; breakdown: ConfidenceAdjustment[] } => {
  
  const votes = [
    getTechnicalVote(signalResult),
    getVolatilityVote(state),
    getSentimentVote(state),
    getOrderFlowVote(state)
  ];

  // Calculate Breakdown
  const breakdown: ConfidenceAdjustment[] = [];
  const baseSignalType = signalResult.signal?.type || 'LONG';

  votes.forEach(v => {
    if (v.agentName === 'VANGUARD') return; // Base score, handled separately

    const isAligned = (baseSignalType === 'LONG' && v.vote === 'BULLISH') ||
                      (baseSignalType === 'SHORT' && v.vote === 'BEARISH');
    
    const isOpposed = (baseSignalType === 'LONG' && v.vote === 'BEARISH') ||
                      (baseSignalType === 'SHORT' && v.vote === 'BULLISH');

    if (isAligned) {
      breakdown.push({ label: v.agentName, value: 5, type: 'boost' });
    } else if (isOpposed) {
      breakdown.push({ label: v.agentName, value: -5, type: 'penalty' });
    }
  });

  return { votes, breakdown };
};

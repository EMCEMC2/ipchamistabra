/**
 * TACTICAL V3.3 - AI-ENHANCED SIGNAL SYSTEM WITH PATTERN LEARNING
 * 
 * New in V3.3:
 * - MULTI-TARGET TPs: TP1 (1.0R), TP2 (2.0R), TP3 (3.0R+), TP4 (runner)
 * - HISTORICAL PATTERN LEARNING: Scores setups based on past trade outcomes
 * - PATTERN FINGERPRINTING: Identifies similar historical setups
 * - ADAPTIVE CONFIDENCE: Adjusts based on pattern win rate
 * - S/R LEVEL INTEGRATION: Targets aligned with structure
 * - PARTIAL POSITION MANAGEMENT: Suggested position sizing per TP
 * 
 * @version 3.3.0
 */

import { ChartDataPoint, TradeSignal, AgentVote } from '../types';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateADX,
  calculateSMA,
  calculateRMA,
  calculateStdev,
  calculateTR
} from '../utils/technicalAnalysis';
import { AggrStats } from './aggrService';
import { AppState } from '../store/useStore';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TacticalConfigV33 {
  // Score thresholds by regime
  minScoreLowVol: number;
  minScoreNormal: number;
  minScoreHighVol: number;
  
  // Edge requirements by regime  
  minEdgeLowVol: number;
  minEdgeNormal: number;
  minEdgeHighVol: number;
  
  // Time-based cooldowns (seconds)
  cooldownSecondsLowVol: number;
  cooldownSecondsNormal: number;
  cooldownSecondsHighVol: number;
  
  // Chop detection
  chopWindowSeconds: number;
  chopMaxSignalsInWindow: number;
  
  // Order flow
  useOrderFlow: boolean;
  orderFlowWeight: number;
  orderFlowVetoThreshold: number;
  
  // R:R settings
  minRiskReward: number;
  
  // ADX modulation
  adxChopThreshold: number;
  adxWeakThreshold: number;
  adxChopMultiplier: number;
  adxWeakMultiplier: number;
  
  // Signal decay
  signalDecayPerMinute: number;
  signalDecayPerPctDrift: number;
  signalMaxAgeSeconds: number;
  
  // === NEW V3.3: Multi-Target Config ===
  tp1Multiplier: number;          // 1.0R - Conservative
  tp2Multiplier: number;          // 2.0R - Standard
  tp3Multiplier: number;          // 3.0R - Extended
  tp4Multiplier: number;          // 4.0R+ - Runner
  
  tp1PositionPct: number;         // % to close at TP1
  tp2PositionPct: number;         // % to close at TP2
  tp3PositionPct: number;         // % to close at TP3
  tp4PositionPct: number;         // % to leave as runner
  
  moveStopToBreakevenAtTp: number; // Move SL to entry after this TP (1, 2, or 3)
  
  // === NEW V3.3: Pattern Learning Config ===
  patternLearningEnabled: boolean;
  minPatternsForLearning: number; // Min historical patterns before adjusting
  patternSimilarityThreshold: number; // 0-1, how similar pattern must be
  maxConfidenceBoost: number;     // Max % boost from pattern learning
  maxConfidencePenalty: number;   // Max % penalty from pattern learning
  
  // === NEW V3.3: S/R Integration ===
  useStructureLevels: boolean;    // Align TPs with S/R levels
  srProximityThreshold: number;   // % distance to consider "near" S/R
}

export const DEFAULT_CONFIG_V33: TacticalConfigV33 = {
  // Inherited from V3.2
  minScoreLowVol: 5.5,
  minScoreNormal: 4.5,
  minScoreHighVol: 4.0,
  
  minEdgeLowVol: 2.0,
  minEdgeNormal: 2.2,
  minEdgeHighVol: 2.5,
  
  cooldownSecondsLowVol: 900,
  cooldownSecondsNormal: 480,
  cooldownSecondsHighVol: 180,
  
  chopWindowSeconds: 1800,
  chopMaxSignalsInWindow: 3,
  
  useOrderFlow: true,
  orderFlowWeight: 0.3,
  orderFlowVetoThreshold: 2.0,
  
  minRiskReward: 2.0,
  
  adxChopThreshold: 15,
  adxWeakThreshold: 20,
  adxChopMultiplier: 1.5,
  adxWeakMultiplier: 1.2,
  
  signalDecayPerMinute: 0.8,
  signalDecayPerPctDrift: 5.0,
  signalMaxAgeSeconds: 3600,
  
  // NEW V3.3: Multi-Target
  tp1Multiplier: 1.0,    // 1:1 R:R
  tp2Multiplier: 2.0,    // 2:1 R:R
  tp3Multiplier: 3.0,    // 3:1 R:R
  tp4Multiplier: 5.0,    // 5:1 R:R (runner)
  
  tp1PositionPct: 25,    // Close 25% at TP1
  tp2PositionPct: 35,    // Close 35% at TP2
  tp3PositionPct: 25,    // Close 25% at TP3
  tp4PositionPct: 15,    // Leave 15% as runner
  
  moveStopToBreakevenAtTp: 1, // Move to breakeven after TP1
  
  // NEW V3.3: Pattern Learning
  patternLearningEnabled: true,
  minPatternsForLearning: 20,
  patternSimilarityThreshold: 0.7,
  maxConfidenceBoost: 15,
  maxConfidencePenalty: 20,
  
  // NEW V3.3: S/R
  useStructureLevels: true,
  srProximityThreshold: 0.3  // 0.3% proximity to S/R
};

// ============================================================================
// MULTI-TARGET TYPES
// ============================================================================

export interface TargetLevel {
  price: number;
  rMultiple: number;        // How many R (risk units)
  positionPct: number;      // % of position to close here
  status: 'PENDING' | 'HIT' | 'MISSED' | 'CANCELLED';
  hitTime?: number;
  hitPrice?: number;
}

export interface EnhancedTradeSignal extends TradeSignal {
  // Multi-target system
  targetLevels: TargetLevel[];
  
  // Position management
  suggestedPositionSize: number;  // Based on risk %
  breakEvenPrice: number | null;  // Price where SL moves to
  trailingStopActive: boolean;
  currentStopPrice: number;       // May differ from invalidation after moves
  
  // Pattern learning metadata
  patternFingerprint: PatternFingerprint;
  patternConfidenceAdjustment: number;  // +/- from pattern learning
  similarPatterns: PatternMatch[];
  
  // Structure levels used
  nearestResistance: number | null;
  nearestSupport: number | null;
  
  // Partial fill tracking
  positionRemaining: number;  // % still open
  realizedPnL: number;        // From partial closes
  unrealizedPnL: number;      // Current open position
}

// ============================================================================
// PATTERN LEARNING TYPES
// ============================================================================

export interface PatternFingerprint {
  // Technical context (normalized 0-1)
  trendStrength: number;      // ADX normalized
  trendDirection: number;     // -1 (down) to +1 (up)
  volatilityPercentile: number;
  rsiNormalized: number;      // 0-1
  
  // Structure
  regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL';
  trendType: 'STRONG_TREND' | 'WEAK_TREND' | 'RANGING';
  nearSupport: boolean;
  nearResistance: boolean;
  trendExhaustion: boolean;
  
  // Scores
  techBullScore: number;
  techBearScore: number;
  techEdge: number;
  ofEdge: number;
  consensusAgreement: number;
  
  // Order flow
  cvdTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  cvdDivergence: 'BULLISH_DIV' | 'BEARISH_DIV' | 'NONE';
  absorptionSide: 'BUY' | 'SELL' | null;
  
  // Signal
  signalType: 'LONG' | 'SHORT';
  confidenceAtEntry: number;
}

export interface TradeOutcome {
  signalId: string;
  fingerprint: PatternFingerprint;
  
  // Entry
  entryPrice: number;
  entryTime: number;
  
  // Exit
  exitPrice: number;
  exitTime: number;
  exitReason: 'TP1' | 'TP2' | 'TP3' | 'TP4' | 'STOP' | 'MANUAL' | 'EXPIRED';
  
  // Results
  pnlPercent: number;
  rMultipleAchieved: number;
  maxFavorableExcursion: number;  // Best price during trade
  maxAdverseExcursion: number;    // Worst price during trade
  durationSeconds: number;
  
  // Target tracking
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  tp4Hit: boolean;
  
  // Metadata
  regime: string;
  timestamp: number;
}

export interface PatternMatch {
  outcome: TradeOutcome;
  similarity: number;  // 0-1
  wasWinner: boolean;
  rMultiple: number;
}

export interface PatternLearningState {
  outcomes: TradeOutcome[];
  
  // Aggregated stats
  totalTrades: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  profitFactor: number;
  expectancy: number;
  
  // By pattern type
  statsByRegime: Record<string, PatternStats>;
  statsByTrendType: Record<string, PatternStats>;
  statsBySignalType: Record<string, PatternStats>;
  statsByCvdDivergence: Record<string, PatternStats>;
  
  // Recent performance (last 20)
  recentWinRate: number;
  recentExpectancy: number;
  
  lastUpdated: number;
}

export interface PatternStats {
  count: number;
  winRate: number;
  avgR: number;
  profitFactor: number;
}

// ============================================================================
// S/R LEVEL DETECTION
// ============================================================================

export interface StructureLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  strength: number;  // 1-5 based on touches
  lastTouchTime: number;
  source: 'SWING' | 'VOLUME_PROFILE' | 'ROUND_NUMBER' | 'PREVIOUS_TP_SL';
}

function detectStructureLevels(
  chartData: ChartDataPoint[],
  currentPrice: number
): StructureLevel[] {
  const levels: StructureLevel[] = [];
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);
  const closes = chartData.map(d => d.close);
  const volumes = chartData.map(d => d.volume || 0);
  
  // 1. Swing highs/lows (last 100 bars)
  const swingLookback = Math.min(100, chartData.length - 4);
  
  for (let i = 2; i < swingLookback - 2; i++) {
    const idx = chartData.length - 1 - i;
    if (idx < 2 || idx >= highs.length - 2) continue;
    
    // Swing high
    if (highs[idx] > highs[idx-1] && highs[idx] > highs[idx-2] &&
        highs[idx] > highs[idx+1] && highs[idx] > highs[idx+2]) {
      levels.push({
        price: highs[idx],
        type: 'RESISTANCE',
        strength: 1,
        lastTouchTime: chartData[idx].time * 1000,
        source: 'SWING'
      });
    }
    
    // Swing low
    if (lows[idx] < lows[idx-1] && lows[idx] < lows[idx-2] &&
        lows[idx] < lows[idx+1] && lows[idx] < lows[idx+2]) {
      levels.push({
        price: lows[idx],
        type: 'SUPPORT',
        strength: 1,
        lastTouchTime: chartData[idx].time * 1000,
        source: 'SWING'
      });
    }
  }
  
  // 2. Round numbers (psychological levels)
  const priceRange = Math.max(...highs.slice(-50)) - Math.min(...lows.slice(-50));
  const roundInterval = priceRange > 5000 ? 1000 : 
                        priceRange > 1000 ? 500 : 
                        priceRange > 100 ? 100 : 50;
  
  const nearestRound = Math.round(currentPrice / roundInterval) * roundInterval;
  for (let offset = -3; offset <= 3; offset++) {
    const roundPrice = nearestRound + (offset * roundInterval);
    if (roundPrice > 0) {
      levels.push({
        price: roundPrice,
        type: roundPrice > currentPrice ? 'RESISTANCE' : 'SUPPORT',
        strength: 2,
        lastTouchTime: Date.now(),
        source: 'ROUND_NUMBER'
      });
    }
  }
  
  // 3. Cluster nearby levels and increase strength
  const clusteredLevels: StructureLevel[] = [];
  const clusterThreshold = currentPrice * 0.002; // 0.2%
  
  const sortedLevels = levels.sort((a, b) => a.price - b.price);
  
  for (const level of sortedLevels) {
    const existing = clusteredLevels.find(
      l => Math.abs(l.price - level.price) < clusterThreshold && l.type === level.type
    );
    
    if (existing) {
      existing.strength = Math.min(5, existing.strength + 1);
      existing.price = (existing.price + level.price) / 2; // Average
    } else {
      clusteredLevels.push({ ...level });
    }
  }
  
  return clusteredLevels.sort((a, b) => b.strength - a.strength);
}

function findNearestLevels(
  levels: StructureLevel[],
  currentPrice: number,
  direction: 'LONG' | 'SHORT'
): { support: number | null; resistance: number | null } {
  const supports = levels
    .filter(l => l.type === 'SUPPORT' && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);
    
  const resistances = levels
    .filter(l => l.type === 'RESISTANCE' && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  
  return {
    support: supports[0]?.price ?? null,
    resistance: resistances[0]?.price ?? null
  };
}

// ============================================================================
// SIGNAL HISTORY (from V3.2)
// ============================================================================

export interface SignalHistoryEntry {
  timestamp: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  confidence: number;
}

export interface SignalHistoryState {
  entries: SignalHistoryEntry[];
  lastSignalTimestamp: number;
}

export const EMPTY_SIGNAL_HISTORY: SignalHistoryState = {
  entries: [],
  lastSignalTimestamp: 0
};

export function addToSignalHistory(
  history: SignalHistoryState,
  signal: TradeSignal,
  maxAgeSeconds: number = 3600
): SignalHistoryState {
  const now = signal.timestamp;
  const cutoff = now - (maxAgeSeconds * 1000);
  const prunedEntries = history.entries.filter(e => e.timestamp > cutoff);
  
  const newEntry: SignalHistoryEntry = {
    timestamp: now,
    type: signal.type,
    entryPrice: parseFloat(signal.entryZone),
    confidence: signal.confidence
  };
  
  return {
    entries: [...prunedEntries, newEntry],
    lastSignalTimestamp: now
  };
}

export function countSignalsInWindow(
  history: SignalHistoryState,
  windowSeconds: number,
  referenceTime: number
): number {
  const cutoff = referenceTime - (windowSeconds * 1000);
  return history.entries.filter(e => e.timestamp > cutoff).length;
}

// ============================================================================
// PATTERN LEARNING ENGINE
// ============================================================================

export const EMPTY_PATTERN_LEARNING: PatternLearningState = {
  outcomes: [],
  totalTrades: 0,
  winRate: 0,
  avgWinR: 0,
  avgLossR: 0,
  profitFactor: 0,
  expectancy: 0,
  statsByRegime: {},
  statsByTrendType: {},
  statsBySignalType: {},
  statsByCvdDivergence: {},
  recentWinRate: 0,
  recentExpectancy: 0,
  lastUpdated: 0
};

/**
 * Calculate similarity between two pattern fingerprints (0-1)
 */
function calculatePatternSimilarity(
  a: PatternFingerprint,
  b: PatternFingerprint
): number {
  let score = 0;
  let weights = 0;
  
  // Categorical matches (high weight)
  if (a.regime === b.regime) { score += 3; } weights += 3;
  if (a.trendType === b.trendType) { score += 3; } weights += 3;
  if (a.signalType === b.signalType) { score += 4; } weights += 4;
  if (a.cvdTrend === b.cvdTrend) { score += 2; } weights += 2;
  if (a.cvdDivergence === b.cvdDivergence) { score += 3; } weights += 3;
  if (a.nearSupport === b.nearSupport) { score += 1; } weights += 1;
  if (a.nearResistance === b.nearResistance) { score += 1; } weights += 1;
  if (a.trendExhaustion === b.trendExhaustion) { score += 2; } weights += 2;
  
  // Continuous similarities (lower weight)
  const trendStrengthSim = 1 - Math.abs(a.trendStrength - b.trendStrength);
  const volatilitySim = 1 - Math.abs(a.volatilityPercentile - b.volatilityPercentile);
  const rsiSim = 1 - Math.abs(a.rsiNormalized - b.rsiNormalized);
  const techEdgeSim = 1 - Math.min(1, Math.abs(a.techEdge - b.techEdge) / 3);
  const consensusSim = 1 - Math.abs(a.consensusAgreement - b.consensusAgreement);
  
  score += trendStrengthSim * 1.5;
  score += volatilitySim * 1;
  score += rsiSim * 0.5;
  score += techEdgeSim * 2;
  score += consensusSim * 1;
  
  weights += 6; // Sum of continuous weights
  
  return score / weights;
}

/**
 * Find similar historical patterns
 */
function findSimilarPatterns(
  currentFingerprint: PatternFingerprint,
  learningState: PatternLearningState,
  config: TacticalConfigV33,
  maxMatches: number = 10
): PatternMatch[] {
  if (!config.patternLearningEnabled) return [];
  if (learningState.outcomes.length < config.minPatternsForLearning) return [];
  
  const matches: PatternMatch[] = [];
  
  for (const outcome of learningState.outcomes) {
    const similarity = calculatePatternSimilarity(currentFingerprint, outcome.fingerprint);
    
    if (similarity >= config.patternSimilarityThreshold) {
      matches.push({
        outcome,
        similarity,
        wasWinner: outcome.rMultipleAchieved > 0,
        rMultiple: outcome.rMultipleAchieved
      });
    }
  }
  
  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);
  
  return matches.slice(0, maxMatches);
}

/**
 * Calculate confidence adjustment from pattern learning
 */
function calculatePatternConfidenceAdjustment(
  matches: PatternMatch[],
  config: TacticalConfigV33
): number {
  if (matches.length === 0) return 0;
  
  // Weight by similarity
  let totalWeight = 0;
  let weightedWinRate = 0;
  let weightedAvgR = 0;
  
  for (const match of matches) {
    const weight = match.similarity * match.similarity; // Square for emphasis
    totalWeight += weight;
    weightedWinRate += (match.wasWinner ? 1 : 0) * weight;
    weightedAvgR += match.rMultiple * weight;
  }
  
  if (totalWeight === 0) return 0;
  
  const patternWinRate = weightedWinRate / totalWeight;
  const patternAvgR = weightedAvgR / totalWeight;
  
  // Compare to baseline (50% win rate, 0R avg)
  const winRateDelta = patternWinRate - 0.5;
  const avgRDelta = patternAvgR;
  
  // Combined score
  let adjustment = (winRateDelta * 20) + (avgRDelta * 5);
  
  // Clamp to config limits
  adjustment = Math.max(-config.maxConfidencePenalty, 
                       Math.min(config.maxConfidenceBoost, adjustment));
  
  return adjustment;
}

/**
 * Add completed trade outcome to learning state
 */
export function addTradeOutcome(
  state: PatternLearningState,
  outcome: TradeOutcome,
  maxOutcomes: number = 500
): PatternLearningState {
  // Add new outcome
  const outcomes = [...state.outcomes, outcome];
  
  // Prune if too many (keep recent)
  if (outcomes.length > maxOutcomes) {
    outcomes.splice(0, outcomes.length - maxOutcomes);
  }
  
  // Recalculate stats
  const wins = outcomes.filter(o => o.rMultipleAchieved > 0);
  const losses = outcomes.filter(o => o.rMultipleAchieved <= 0);
  
  const totalTrades = outcomes.length;
  const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
  
  const avgWinR = wins.length > 0 
    ? wins.reduce((s, o) => s + o.rMultipleAchieved, 0) / wins.length 
    : 0;
  const avgLossR = losses.length > 0 
    ? Math.abs(losses.reduce((s, o) => s + o.rMultipleAchieved, 0) / losses.length)
    : 0;
  
  const grossProfit = wins.reduce((s, o) => s + o.rMultipleAchieved, 0);
  const grossLoss = Math.abs(losses.reduce((s, o) => s + o.rMultipleAchieved, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  const expectancy = totalTrades > 0
    ? outcomes.reduce((s, o) => s + o.rMultipleAchieved, 0) / totalTrades
    : 0;
  
  // Recent stats (last 20)
  const recent = outcomes.slice(-20);
  const recentWins = recent.filter(o => o.rMultipleAchieved > 0).length;
  const recentWinRate = recent.length > 0 ? recentWins / recent.length : 0;
  const recentExpectancy = recent.length > 0
    ? recent.reduce((s, o) => s + o.rMultipleAchieved, 0) / recent.length
    : 0;
  
  // Stats by category
  const statsByRegime = calculateStatsByCategory(outcomes, o => o.regime);
  const statsByTrendType = calculateStatsByCategory(outcomes, o => o.fingerprint.trendType);
  const statsBySignalType = calculateStatsByCategory(outcomes, o => o.fingerprint.signalType);
  const statsByCvdDivergence = calculateStatsByCategory(outcomes, o => o.fingerprint.cvdDivergence);
  
  return {
    outcomes,
    totalTrades,
    winRate,
    avgWinR,
    avgLossR,
    profitFactor,
    expectancy,
    statsByRegime,
    statsByTrendType,
    statsBySignalType,
    statsByCvdDivergence,
    recentWinRate,
    recentExpectancy,
    lastUpdated: Date.now()
  };
}

function calculateStatsByCategory(
  outcomes: TradeOutcome[],
  categoryFn: (o: TradeOutcome) => string
): Record<string, PatternStats> {
  const groups: Record<string, TradeOutcome[]> = {};
  
  for (const outcome of outcomes) {
    const category = categoryFn(outcome);
    if (!groups[category]) groups[category] = [];
    groups[category].push(outcome);
  }
  
  const stats: Record<string, PatternStats> = {};
  
  for (const [category, trades] of Object.entries(groups)) {
    const wins = trades.filter(t => t.rMultipleAchieved > 0);
    const losses = trades.filter(t => t.rMultipleAchieved <= 0);
    
    const grossProfit = wins.reduce((s, t) => s + t.rMultipleAchieved, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.rMultipleAchieved, 0));
    
    stats[category] = {
      count: trades.length,
      winRate: trades.length > 0 ? wins.length / trades.length : 0,
      avgR: trades.length > 0 
        ? trades.reduce((s, t) => s + t.rMultipleAchieved, 0) / trades.length 
        : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0
    };
  }
  
  return stats;
}

// ============================================================================
// MARKET STRUCTURE (from V3.2)
// ============================================================================

export interface MarketStructure {
  regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'EXPANSION' | 'CONTRACTION';
  volatilityPercentile: number;
  trendType: 'STRONG_TREND' | 'WEAK_TREND' | 'RANGING' | 'BREAKOUT';
  trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';
  trendExhaustion: boolean;
  nearSupport: boolean;
  nearResistance: boolean;
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
  structureScore: number;
  tradabilityScore: number;
  adx: number;
  normATR: number;
  
  // NEW V3.3: S/R levels
  structureLevels: StructureLevel[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

function safeNumber(val: any, fallback: number = 0): number {
  if (typeof val !== 'number') return fallback;
  if (!Number.isFinite(val)) return fallback;
  return val;
}

function safeDivide(a: number, b: number, fallback: number = 0): number {
  if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return fallback;
  return a / b;
}

function analyzeMarketStructure(
  chartData: ChartDataPoint[],
  atr: number[],
  atrSMA: number[],
  atrStd: number[],
  adxValue: number,
  config: TacticalConfigV33
): MarketStructure {
  const i = chartData.length - 1;
  const closes = chartData.map(d => d.close);
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);
  const currentPrice = closes[i];

  // Normalized ATR for regime
  const normATR = safeNumber(atrStd[i]) > 0 
    ? (safeNumber(atr[i]) - safeNumber(atrSMA[i])) / atrStd[i] 
    : 0;

  // Volatility percentile
  const atrValues = atr.slice(-200).filter(v => Number.isFinite(v));
  const sortedATR = [...atrValues].sort((a, b) => a - b);
  const currentATR = safeNumber(atr[i]);
  const percentileIdx = sortedATR.findIndex(v => v >= currentATR);
  const volatilityPercentile = sortedATR.length > 0 
    ? (Math.max(0, percentileIdx) / sortedATR.length) * 100 
    : 50;

  // Swing point analysis
  const swingLookback = Math.min(25, i - 4);
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let j = Math.max(2, i - swingLookback); j <= i - 2; j++) {
    if (j < 2 || j >= highs.length - 2) continue;
    
    if (highs[j] > highs[j-1] && highs[j] > highs[j-2] &&
        highs[j] > highs[j+1] && highs[j] > highs[j+2]) {
      swingHighs.push(highs[j]);
    }
    if (lows[j] < lows[j-1] && lows[j] < lows[j-2] &&
        lows[j] < lows[j+1] && lows[j] < lows[j+2]) {
      swingLows.push(lows[j]);
    }
  }

  let higherHighs = 0, higherLows = 0, lowerHighs = 0, lowerLows = 0;
  for (let j = 1; j < swingHighs.length; j++) {
    if (swingHighs[j] > swingHighs[j-1]) higherHighs++;
    else lowerHighs++;
  }
  for (let j = 1; j < swingLows.length; j++) {
    if (swingLows[j] > swingLows[j-1]) higherLows++;
    else lowerLows++;
  }

  // Trend determination
  let trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
  let trendType: 'STRONG_TREND' | 'WEAK_TREND' | 'RANGING' | 'BREAKOUT' = 'RANGING';
  const safeAdx = safeNumber(adxValue);

  if (higherHighs >= 2 && higherLows >= 2) {
    trendDirection = 'UP';
    trendType = safeAdx >= 25 ? 'STRONG_TREND' : 'WEAK_TREND';
  } else if (lowerHighs >= 2 && lowerLows >= 2) {
    trendDirection = 'DOWN';
    trendType = safeAdx >= 25 ? 'STRONG_TREND' : 'WEAK_TREND';
  } else if (safeAdx < 20) {
    trendType = 'RANGING';
  }

  // Trend exhaustion
  const recentRanges = chartData.slice(-5).map(d => d.high - d.low);
  const prevRanges = chartData.slice(-10, -5).map(d => d.high - d.low);
  const avgRecentRange = recentRanges.reduce((a, b) => a + b, 0) / Math.max(1, recentRanges.length);
  const avgPrevRange = prevRanges.reduce((a, b) => a + b, 0) / Math.max(1, prevRanges.length);
  const trendExhaustion = avgPrevRange > 0 && avgRecentRange < avgPrevRange * 0.55;

  // S/R proximity
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const priceRange = recentHigh - recentLow;
  
  const nearResistance = priceRange > 0 && (recentHigh - currentPrice) / priceRange < 0.08;
  const nearSupport = priceRange > 0 && (currentPrice - recentLow) / priceRange < 0.08;

  // Regime
  let regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'EXPANSION' | 'CONTRACTION';
  if (volatilityPercentile < 20) {
    regime = trendExhaustion ? 'CONTRACTION' : 'LOW_VOL';
  } else if (volatilityPercentile > 80) {
    regime = 'HIGH_VOL';
  } else if (volatilityPercentile > 60 && avgPrevRange > 0 && avgRecentRange > avgPrevRange * 1.5) {
    regime = 'EXPANSION';
  } else {
    regime = 'NORMAL';
  }

  // Tradability score
  let tradabilityScore = 50;
  if (trendType === 'STRONG_TREND') tradabilityScore += 25;
  else if (trendType === 'WEAK_TREND') tradabilityScore += 10;
  else if (trendType === 'RANGING') tradabilityScore -= 20;
  
  if (trendExhaustion) tradabilityScore -= 20;
  if (volatilityPercentile >= 25 && volatilityPercentile <= 75) tradabilityScore += 15;
  if (nearSupport || nearResistance) tradabilityScore += 8;
  if (regime === 'CONTRACTION') tradabilityScore -= 15;
  if (safeAdx >= 25) tradabilityScore += 10;

  tradabilityScore = Math.max(0, Math.min(100, tradabilityScore));

  // NEW V3.3: S/R levels
  const structureLevels = config.useStructureLevels 
    ? detectStructureLevels(chartData, currentPrice)
    : [];
  
  const { support: nearestSupport, resistance: nearestResistance } = 
    findNearestLevels(structureLevels, currentPrice, 'LONG');

  return {
    regime,
    volatilityPercentile,
    trendType,
    trendDirection,
    trendExhaustion,
    nearSupport,
    nearResistance,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    structureScore: trendType === 'STRONG_TREND' ? 85 : 
                   trendType === 'WEAK_TREND' ? 60 : 35,
    tradabilityScore,
    adx: safeAdx,
    normATR,
    structureLevels,
    nearestSupport,
    nearestResistance
  };
}

// ============================================================================
// TECHNICAL SCORE (FROZEN - from V3.2)
// ============================================================================

export interface TechnicalScore {
  bullScore: number;
  bearScore: number;
  direction: 'LONG' | 'SHORT';
  edge: number;
  components: {
    trend: number;
    alignment: number;
    rsi: number;
    crossover: number;
  };
}

function calculateTechnicalScore(
  chartData: ChartDataPoint[],
  structure: MarketStructure,
  ema200: number[],
  valFast: number,
  valSlow: number,
  prevFast: number,
  prevSlow: number,
  rsiVal: number
): TechnicalScore {
  const i = chartData.length - 1;
  const currentPrice = chartData[i].close;

  let bullScore = 0;
  let bearScore = 0;
  const components = { trend: 0, alignment: 0, rsi: 0, crossover: 0 };

  const safeEma200 = safeNumber(ema200[i], currentPrice);

  // 1. Trend (1.0 point)
  if (currentPrice > safeEma200) {
    bullScore += 1.0;
    components.trend = 1.0;
  } else {
    bearScore += 1.0;
    components.trend = -1.0;
  }

  // 2. Alignment (1.5 points)
  const safeFast = safeNumber(valFast);
  const safeSlow = safeNumber(valSlow);
  if (safeFast > safeSlow) {
    bullScore += 1.5;
    components.alignment = 1.5;
  } else {
    bearScore += 1.5;
    components.alignment = -1.5;
  }

  // 3. RSI (0.5-1.0 points)
  const safeRsi = safeNumber(rsiVal, 50);
  if (safeRsi > 55) { bullScore += 0.5; components.rsi += 0.5; }
  if (safeRsi < 45) { bearScore += 0.5; components.rsi -= 0.5; }
  if (safeRsi > 65) { bullScore += 0.5; components.rsi += 0.5; }
  if (safeRsi < 35) { bearScore += 0.5; components.rsi -= 0.5; }

  // 4. Crossover (2.5 points)
  const safePrevFast = safeNumber(prevFast);
  const safePrevSlow = safeNumber(prevSlow);
  if (safePrevFast <= safePrevSlow && safeFast > safeSlow) {
    bullScore += 2.5;
    components.crossover = 2.5;
  }
  if (safePrevFast >= safePrevSlow && safeFast < safeSlow) {
    bearScore += 2.5;
    components.crossover = -2.5;
  }

  const direction = bullScore > bearScore ? 'LONG' : 'SHORT';
  const edge = Math.abs(bullScore - bearScore);

  return { bullScore, bearScore, direction, edge, components };
}

// ============================================================================
// ORDER FLOW SCORE (SEPARATE - from V3.2)
// ============================================================================

export interface OrderFlowScore {
  bullScore: number;
  bearScore: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  edge: number;
  cvdTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  cvdDivergence: 'BULLISH_DIV' | 'BEARISH_DIV' | 'NONE';
  absorptionDetected: boolean;
  absorptionSide: 'BUY' | 'SELL' | null;
  liquidationCascade: boolean;
  cascadeSide: 'LONG_LIQS' | 'SHORT_LIQS' | null;
  signalStrength: number;
}

function calculateOrderFlowScore(
  stats: AggrStats | null,
  priceData: { price: number; prevPrice: number; prevPrevPrice: number },
  config: TacticalConfigV33
): OrderFlowScore {
  const defaultScore: OrderFlowScore = {
    bullScore: 0, bearScore: 0, direction: 'NEUTRAL', edge: 0,
    cvdTrend: 'NEUTRAL', cvdDivergence: 'NONE',
    absorptionDetected: false, absorptionSide: null,
    liquidationCascade: false, cascadeSide: null, signalStrength: 0
  };

  if (!stats || !config.useOrderFlow) return defaultScore;
  if (!stats.cvd || !stats.pressure) return defaultScore;
  if (stats.banned?.isBanned) return defaultScore;
  if (stats.lastUpdate && (Date.now() - stats.lastUpdate) > 30000) return defaultScore;

  const { cvd, pressure, recentLiquidations = [], liquidationVolume = 0 } = stats;
  const { price, prevPrice, prevPrevPrice } = priceData;

  let bullScore = 0;
  let bearScore = 0;

  // CVD Trend
  const cvdTrend = cvd.trend === 'BULLISH' ? 'BULLISH' : 
                   cvd.trend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
  if (cvdTrend === 'BULLISH') bullScore += 1.2;
  else if (cvdTrend === 'BEARISH') bearScore += 1.2;

  // CVD Divergence
  const priceUp = price > prevPrice && prevPrice > prevPrevPrice;
  const priceDown = price < prevPrice && prevPrice < prevPrevPrice;
  const shortTermDelta = safeNumber(cvd.shortTermDelta);
  const cvdUp = shortTermDelta > 0;
  const cvdDown = shortTermDelta < 0;

  let cvdDivergence: 'BULLISH_DIV' | 'BEARISH_DIV' | 'NONE' = 'NONE';
  if (priceDown && cvdUp) {
    cvdDivergence = 'BULLISH_DIV';
    bullScore += 2.0;
  } else if (priceUp && cvdDown) {
    cvdDivergence = 'BEARISH_DIV';
    bearScore += 2.0;
  }

  // Absorption
  const priceMove = prevPrice > 0 ? Math.abs(price - prevPrice) / prevPrice : 0;
  const avgVol = safeNumber(stats.avgVolume, 1);
  const vol24h = safeNumber(stats.volume24h, avgVol);
  const hasHighVolume = vol24h > avgVol * 1.8;
  const absorptionDetected = hasHighVolume && priceMove < 0.0015;
  const absorptionSide = absorptionDetected 
    ? (shortTermDelta > 0 ? 'BUY' : 'SELL')
    : null;

  if (absorptionSide === 'BUY') bullScore += 1.5;
  else if (absorptionSide === 'SELL') bearScore += 1.5;

  // Liquidation Cascade
  const longLiqs = recentLiquidations.filter(l => l.side === 'long');
  const shortLiqs = recentLiquidations.filter(l => l.side === 'short');
  const cascadeThreshold = 5;
  const volumeThreshold = 15_000_000;
  
  const safeLiqVol = safeNumber(liquidationVolume);
  const liquidationCascade = safeLiqVol > volumeThreshold &&
    (longLiqs.length > cascadeThreshold || shortLiqs.length > cascadeThreshold);
  
  let cascadeSide: 'LONG_LIQS' | 'SHORT_LIQS' | null = null;
  if (liquidationCascade) {
    if (longLiqs.length > shortLiqs.length * 2) {
      cascadeSide = 'LONG_LIQS';
      bearScore += 2.5;
    } else if (shortLiqs.length > longLiqs.length * 2) {
      cascadeSide = 'SHORT_LIQS';
      bullScore += 2.5;
    }
  }

  // Extreme Pressure
  if (pressure.strength === 'extreme') {
    if (pressure.dominantSide === 'buy') bullScore += 1.0;
    else if (pressure.dominantSide === 'sell') bearScore += 1.0;
  }

  const edge = Math.abs(bullScore - bearScore);
  const direction = bullScore > bearScore ? 'LONG' : 
                   bearScore > bullScore ? 'SHORT' : 'NEUTRAL';
  const signalStrength = Math.min(100, Math.max(bullScore, bearScore) * 15);

  return {
    bullScore, bearScore, direction, edge, cvdTrend, cvdDivergence,
    absorptionDetected, absorptionSide, liquidationCascade, cascadeSide, signalStrength
  };
}

// ============================================================================
// QUALITY GATES (from V3.2)
// ============================================================================

interface GateContext {
  adx: number;
  volumeRatio: number;
  volatilityPercentile: number;
  tradabilityScore: number;
  priceVsEma200: number;
  timeOfDay: number;
  dayOfWeek: number;
  signalsInChopWindow: number;
  chopThreshold: number;
  secondsSinceLastSignal: number;
  requiredCooldownSeconds: number;
}

export interface QualityGateResult {
  passed: boolean;
  hardFailures: string[];
  softPenalties: string[];
  penaltyMultiplier: number;
}

function runQualityGates(ctx: GateContext): QualityGateResult {
  const hardFailures: string[] = [];
  const softPenalties: string[] = [];

  // HARD GATES
  if (ctx.adx < 15) hardFailures.push(`[ADX] ${ctx.adx.toFixed(1)} < 15`);
  if (ctx.volumeRatio < 0.6) hardFailures.push(`[VOL] ${ctx.volumeRatio.toFixed(2)} < 0.6`);
  if (ctx.signalsInChopWindow >= ctx.chopThreshold) {
    hardFailures.push(`[CHOP] ${ctx.signalsInChopWindow} >= ${ctx.chopThreshold}`);
  }
  if (ctx.volatilityPercentile < 10 || ctx.volatilityPercentile > 92) {
    hardFailures.push(`[VOL%] ${ctx.volatilityPercentile.toFixed(0)}% out of range`);
  }
  if (ctx.tradabilityScore < 30) hardFailures.push(`[TRAD] ${ctx.tradabilityScore} < 30`);
  if (ctx.secondsSinceLastSignal < ctx.requiredCooldownSeconds) {
    hardFailures.push(`[COOL] ${ctx.secondsSinceLastSignal.toFixed(0)}s < ${ctx.requiredCooldownSeconds}s`);
  }

  // SOFT GATES
  const hour = ctx.timeOfDay;
  const isGoodSession = (hour >= 7 && hour <= 18) || (hour >= 0 && hour <= 4);
  if (!isGoodSession) softPenalties.push(`[SESSION] Hour ${hour} UTC`);
  
  if (ctx.dayOfWeek < 1 || ctx.dayOfWeek > 5) softPenalties.push('[WEEKEND]');
  
  if (Math.abs(ctx.priceVsEma200) > 12) {
    softPenalties.push(`[OVEREXT] ${ctx.priceVsEma200.toFixed(1)}%`);
  }

  const penaltyMultiplier = Math.pow(0.88, softPenalties.length);

  return { passed: hardFailures.length === 0, hardFailures, softPenalties, penaltyMultiplier };
}

// ============================================================================
// CONSENSUS ENGINE (from V3.2)
// ============================================================================

export interface ConsensusResult {
  votes: AgentVote[];
  supportWeight: number;
  opposeWeight: number;
  agreementScore: number;
  conflictPairs: string[][];
  decision: 'APPROVED' | 'WEAK_CONSENSUS' | 'VETO';
  vetoReason: string | null;
  finalConfidence: number;
  boundedAdjustment: number;
}

function generateConsensus(
  technical: TechnicalScore,
  orderFlow: OrderFlowScore | null,
  structure: MarketStructure,
  state: Partial<AppState>,
  config: TacticalConfigV33
): ConsensusResult {
  const baseDir = technical.direction === 'LONG' ? 'BULLISH' : 'BEARISH';
  const votes: AgentVote[] = [];

  const weights: Record<string, number> = {
    'VANGUARD': 10, 'DATAMIND': 5, 'OVERMIND': 7, 
    'WATCHDOG': 8, 'MACRO': 3, 'STRUCTURE': 6
  };

  // VANGUARD
  const techConfidence = Math.min(100, technical.edge * 18);
  votes.push({
    agentName: 'VANGUARD',
    vote: technical.direction === 'LONG' ? 'BULLISH' : 'BEARISH',
    confidence: techConfidence,
    reason: `Tech edge: ${technical.edge.toFixed(2)}`
  });

  // DATAMIND
  let datamindVote: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (structure.trendType === 'STRONG_TREND') {
    datamindVote = structure.trendDirection === 'UP' ? 'BULLISH' : 'BEARISH';
  }
  votes.push({
    agentName: 'DATAMIND',
    vote: datamindVote,
    confidence: structure.tradabilityScore,
    reason: `${structure.regime} / ${structure.trendType}`
  });

  // OVERMIND
  const sentimentLabel = (state as any)?.sentimentLabel || 'Neutral';
  const sentimentScore = safeNumber((state as any)?.sentimentScore, 50);
  const sentimentVote = sentimentLabel === 'Bullish' ? 'BULLISH' : 
                       sentimentLabel === 'Bearish' ? 'BEARISH' : 'NEUTRAL';
  votes.push({
    agentName: 'OVERMIND',
    vote: sentimentVote,
    confidence: sentimentScore,
    reason: `Sentiment: ${sentimentLabel}`
  });

  // WATCHDOG
  if (orderFlow && orderFlow.direction !== 'NEUTRAL') {
    votes.push({
      agentName: 'WATCHDOG',
      vote: orderFlow.direction === 'LONG' ? 'BULLISH' : 'BEARISH',
      confidence: orderFlow.signalStrength,
      reason: orderFlow.cvdDivergence !== 'NONE' ? orderFlow.cvdDivergence : `CVD: ${orderFlow.cvdTrend}`
    });
  } else {
    votes.push({ agentName: 'WATCHDOG', vote: 'NEUTRAL', confidence: 50, reason: 'No OF data' });
  }

  // MACRO
  const vix = safeNumber((state as any)?.vix, 20);
  const dxy = safeNumber((state as any)?.dxy, 100);
  let macroVote: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let macroConfidence = 50;
  if (vix < 18 && dxy < 103) { macroVote = 'BULLISH'; macroConfidence = 70; }
  else if (vix > 25 || dxy > 107) { macroVote = 'BEARISH'; macroConfidence = 70; }
  votes.push({ agentName: 'MACRO', vote: macroVote, confidence: macroConfidence, reason: `VIX:${vix.toFixed(1)} DXY:${dxy.toFixed(1)}` });

  // STRUCTURE
  let structVote: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (structure.trendExhaustion) {
    structVote = structure.trendDirection === 'UP' ? 'BEARISH' : 'BULLISH';
  } else if (structure.trendType !== 'RANGING') {
    structVote = structure.trendDirection === 'UP' ? 'BULLISH' : 'BEARISH';
  }
  votes.push({
    agentName: 'STRUCTURE',
    vote: structVote,
    confidence: structure.structureScore,
    reason: `${structure.higherHighs}HH/${structure.lowerLows}LL ${structure.trendExhaustion ? '(exh)' : ''}`
  });

  // Calculate support vs opposition
  let supportWeight = 0, opposeWeight = 0;
  for (const vote of votes) {
    const weight = weights[vote.agentName] || 1;
    const effectiveWeight = weight * (vote.confidence / 100);
    if (vote.vote === baseDir) supportWeight += effectiveWeight;
    else if (vote.vote !== 'NEUTRAL') opposeWeight += effectiveWeight;
  }

  const totalWeight = supportWeight + opposeWeight;
  const agreementScore = totalWeight > 0 ? (supportWeight / totalWeight) * 100 : 50;

  // Conflicts
  const conflictPairs: string[][] = [];
  for (let i = 0; i < votes.length; i++) {
    for (let j = i + 1; j < votes.length; j++) {
      const v1 = votes[i], v2 = votes[j];
      if ((v1.vote === 'BULLISH' && v2.vote === 'BEARISH') ||
          (v1.vote === 'BEARISH' && v2.vote === 'BULLISH')) {
        conflictPairs.push([v1.agentName, v2.agentName]);
      }
    }
  }

  // Decision
  let decision: 'APPROVED' | 'WEAK_CONSENSUS' | 'VETO' = 'APPROVED';
  let vetoReason: string | null = null;

  const macroVoteObj = votes.find(v => v.agentName === 'MACRO');
  if (macroVoteObj && macroVoteObj.vote !== baseDir && macroVoteObj.vote !== 'NEUTRAL' && macroVoteObj.confidence >= 70) {
    decision = 'VETO';
    vetoReason = `MACRO opposes (${macroVoteObj.reason})`;
  }
  if (supportWeight < 8 && decision !== 'VETO') {
    decision = 'WEAK_CONSENSUS';
    vetoReason = `Support ${supportWeight.toFixed(1)} < 8`;
  }
  if (agreementScore < 45 && decision !== 'VETO') {
    decision = 'WEAK_CONSENSUS';
    vetoReason = `Agreement ${agreementScore.toFixed(0)}% < 45%`;
  }

  const rawAdjustment = supportWeight - opposeWeight;
  const boundedAdjustment = Math.max(-15, Math.min(15, rawAdjustment));
  const baseConfidence = Math.min(95, technical.edge * 15 + 40);
  const finalConfidence = decision === 'VETO' ? 0 : Math.max(0, Math.min(99, baseConfidence + boundedAdjustment));

  return {
    votes, supportWeight, opposeWeight, agreementScore, conflictPairs,
    decision, vetoReason, finalConfidence, boundedAdjustment
  };
}

// ============================================================================
// MULTI-TARGET TP CALCULATION
// ============================================================================

function calculateMultiTargets(
  entryPrice: number,
  stopPrice: number,
  direction: 'LONG' | 'SHORT',
  structure: MarketStructure,
  config: TacticalConfigV33
): TargetLevel[] {
  const risk = Math.abs(entryPrice - stopPrice);
  const isLong = direction === 'LONG';
  
  const targets: TargetLevel[] = [];
  
  // Base targets from R multiples
  const multipliers = [
    { mult: config.tp1Multiplier, pct: config.tp1PositionPct },
    { mult: config.tp2Multiplier, pct: config.tp2PositionPct },
    { mult: config.tp3Multiplier, pct: config.tp3PositionPct },
    { mult: config.tp4Multiplier, pct: config.tp4PositionPct }
  ];
  
  for (let i = 0; i < multipliers.length; i++) {
    const { mult, pct } = multipliers[i];
    const targetDistance = risk * mult;
    const price = isLong 
      ? entryPrice + targetDistance 
      : entryPrice - targetDistance;
    
    targets.push({
      price,
      rMultiple: mult,
      positionPct: pct,
      status: 'PENDING',
      hitTime: undefined,
      hitPrice: undefined
    });
  }
  
  // Adjust targets to S/R levels if enabled
  if (config.useStructureLevels && structure.structureLevels.length > 0) {
    for (const target of targets) {
      const nearbyLevels = structure.structureLevels.filter(level => {
        const distance = Math.abs(level.price - target.price) / target.price;
        return distance < config.srProximityThreshold / 100;
      });
      
      if (nearbyLevels.length > 0) {
        // Snap to strongest nearby level
        const strongest = nearbyLevels.sort((a, b) => b.strength - a.strength)[0];
        
        // Only adjust if it improves the target (further from entry for profit)
        const wouldImprove = isLong 
          ? strongest.price > target.price * 0.99  // Allow slight reduction for strong S/R
          : strongest.price < target.price * 1.01;
        
        if (wouldImprove) {
          target.price = strongest.price;
        }
      }
    }
  }
  
  return targets;
}

// ============================================================================
// SLIPPAGE MODEL
// ============================================================================

function applySlippage(
  price: number,
  side: 'BUY' | 'SELL',
  orderType: 'MARKET' | 'STOP' | 'LIMIT',
  atr: number,
  avgPrice: number
): number {
  const baseBps = orderType === 'STOP' ? 5 : orderType === 'LIMIT' ? 2 : 3;
  const safeAtr = safeNumber(atr);
  const safeAvgPrice = safeNumber(avgPrice, price);
  const volRatio = safeAvgPrice > 0 ? safeAtr / (safeAvgPrice * 0.02) : 1;
  const adjustedBps = baseBps * Math.min(volRatio * 2.0, 3.0);
  const slippage = price * (adjustedBps / 10000);
  return side === 'BUY' ? price + slippage : price - slippage;
}

// ============================================================================
// PATTERN FINGERPRINT BUILDER
// ============================================================================

function buildPatternFingerprint(
  technical: TechnicalScore,
  orderFlow: OrderFlowScore | null,
  structure: MarketStructure,
  consensus: ConsensusResult,
  rsiVal: number,
  confidence: number
): PatternFingerprint {
  return {
    trendStrength: Math.min(1, structure.adx / 50),
    trendDirection: structure.trendDirection === 'UP' ? 1 : 
                    structure.trendDirection === 'DOWN' ? -1 : 0,
    volatilityPercentile: structure.volatilityPercentile / 100,
    rsiNormalized: rsiVal / 100,
    
    regime: structure.regime as any,
    trendType: structure.trendType as any,
    nearSupport: structure.nearSupport,
    nearResistance: structure.nearResistance,
    trendExhaustion: structure.trendExhaustion,
    
    techBullScore: technical.bullScore,
    techBearScore: technical.bearScore,
    techEdge: technical.edge,
    ofEdge: orderFlow?.edge ?? 0,
    consensusAgreement: consensus.agreementScore / 100,
    
    cvdTrend: orderFlow?.cvdTrend ?? 'NEUTRAL',
    cvdDivergence: orderFlow?.cvdDivergence ?? 'NONE',
    absorptionSide: orderFlow?.absorptionSide ?? null,
    
    signalType: technical.direction,
    confidenceAtEntry: confidence
  };
}

// ============================================================================
// MAIN SIGNAL GENERATOR V3.3
// ============================================================================

export interface TacticalResultV33 {
  signal: EnhancedTradeSignal | null;
  
  technical: TechnicalScore;
  orderFlow: OrderFlowScore | null;
  structure: MarketStructure;
  qualityGates: QualityGateResult;
  consensus: ConsensusResult | null;
  
  effectiveMinScore: number;
  effectiveMinEdge: number;
  calculatedRR: number;
  
  chopAnalysis: {
    signalsInWindow: number;
    windowSeconds: number;
    threshold: number;
    isChoppy: boolean;
  };
  
  cooldownAnalysis: {
    secondsSinceLastSignal: number;
    requiredCooldownSeconds: number;
    cooldownMet: boolean;
  };
  
  // NEW V3.3: Pattern learning results
  patternAnalysis: {
    fingerprint: PatternFingerprint | null;
    similarPatterns: PatternMatch[];
    confidenceAdjustment: number;
    patternWinRate: number | null;
  };
  
  regime: string;
  reasoning: string[];
  updatedHistory: SignalHistoryState;
  rejectionStage: string;
  rejectionReason: string | null;
}

export function generateTacticalSignalV33(
  chartData: ChartDataPoint[],
  state: Partial<AppState>,
  orderFlowStats: AggrStats | null,
  signalHistory: SignalHistoryState,
  patternLearning: PatternLearningState,
  config: TacticalConfigV33 = DEFAULT_CONFIG_V33,
  referenceTime?: number
): TacticalResultV33 {
  
  const now = referenceTime ?? Date.now();
  
  // Defaults for early returns
  const emptyStructure: MarketStructure = {
    regime: 'NORMAL', volatilityPercentile: 50, trendType: 'RANGING',
    trendDirection: 'SIDEWAYS', trendExhaustion: false, nearSupport: false,
    nearResistance: false, higherHighs: 0, higherLows: 0, lowerHighs: 0,
    lowerLows: 0, structureScore: 50, tradabilityScore: 50, adx: 0, normATR: 0,
    structureLevels: [], nearestSupport: null, nearestResistance: null
  };
  const emptyTech: TechnicalScore = {
    bullScore: 0, bearScore: 0, direction: 'LONG', edge: 0,
    components: { trend: 0, alignment: 0, rsi: 0, crossover: 0 }
  };
  const emptyChop = { signalsInWindow: 0, windowSeconds: config.chopWindowSeconds, threshold: config.chopMaxSignalsInWindow, isChoppy: false };
  const emptyCooldown = { secondsSinceLastSignal: Infinity, requiredCooldownSeconds: 0, cooldownMet: true };
  const emptyPattern = { fingerprint: null, similarPatterns: [], confidenceAdjustment: 0, patternWinRate: null };

  const noSignal = (stage: string, reason: string, tech: TechnicalScore, of: OrderFlowScore | null, struct: MarketStructure, gates: QualityGateResult, cons: ConsensusResult | null, minScore: number, minEdge: number, chop: any, cool: any, pattern: any, reasoning: string[]): TacticalResultV33 => ({
    signal: null, technical: tech, orderFlow: of, structure: struct, qualityGates: gates,
    consensus: cons, effectiveMinScore: minScore, effectiveMinEdge: minEdge, calculatedRR: 0,
    chopAnalysis: chop, cooldownAnalysis: cool, patternAnalysis: pattern,
    regime: struct.regime, reasoning: [...reasoning, `❌ ${reason}`],
    updatedHistory: signalHistory, rejectionStage: stage, rejectionReason: reason
  });

  // Validation
  if (!chartData || chartData.length < 200) {
    const emptyGates: QualityGateResult = { passed: false, hardFailures: ['Need 200+ candles'], softPenalties: [], penaltyMultiplier: 1 };
    return noSignal('QUALITY_GATE', 'Need 200+ candles', emptyTech, null, emptyStructure, emptyGates, null, 0, 0, emptyChop, emptyCooldown, emptyPattern, []);
  }

  const i = chartData.length - 1;
  const closes = chartData.map(d => d.close);
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);
  const reasoning: string[] = [];

  // Indicators
  const emaFast_Low = calculateEMA(closes, 27);
  const emaFast_Norm = calculateEMA(closes, 21);
  const emaFast_High = calculateEMA(closes, 15);
  const emaSlow_Low = calculateEMA(closes, 72);
  const emaSlow_Norm = calculateEMA(closes, 55);
  const emaSlow_High = calculateEMA(closes, 39);
  const ema200 = calculateEMA(closes, 200);
  
  const rsiRaw = calculateRSI(closes, 14);
  const rsi = new Array(14).fill(NaN).concat(rsiRaw);
  const rsiVal = safeNumber(rsi[i], 50);

  const tr = calculateTR(chartData);
  const atr = calculateRMA(tr, 14);
  const atrSMA = calculateSMA(atr, 100);
  const atrStd = calculateStdev(atr, 100);
  
  const adxResult = calculateADX(highs, lows, closes, 14);
  const adxValue = safeNumber(adxResult.adx[adxResult.adx.length - 1], 0);

  // Structure
  const structure = analyzeMarketStructure(chartData, atr, atrSMA, atrStd, adxValue, config);
  reasoning.push(`Structure: ${structure.regime} | ${structure.trendType} ${structure.trendDirection} | ADX: ${adxValue.toFixed(1)}`);

  // Chop
  const signalsInWindow = countSignalsInWindow(signalHistory, config.chopWindowSeconds, now);
  const isChoppy = signalsInWindow >= config.chopMaxSignalsInWindow;
  const chopAnalysis = { signalsInWindow, windowSeconds: config.chopWindowSeconds, threshold: config.chopMaxSignalsInWindow, isChoppy };

  // Cooldown
  const lastSignalTs = signalHistory.lastSignalTimestamp || 0;
  const secondsSinceLastSignal = lastSignalTs > 0 ? (now - lastSignalTs) / 1000 : Infinity;
  const requiredCooldownSeconds = structure.regime === 'LOW_VOL' ? config.cooldownSecondsLowVol :
                                  structure.regime === 'HIGH_VOL' ? config.cooldownSecondsHighVol :
                                  config.cooldownSecondsNormal;
  const cooldownMet = secondsSinceLastSignal >= requiredCooldownSeconds;
  const cooldownAnalysis = { secondsSinceLastSignal: Number.isFinite(secondsSinceLastSignal) ? secondsSinceLastSignal : -1, requiredCooldownSeconds, cooldownMet };

  // Volume
  const volumes = chartData.map(d => safeNumber(d.volume, 0));
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVol = volumes[i] || avgVol20;
  const volumeRatio = avgVol20 > 0 ? currentVol / avgVol20 : 1;
  const priceVsEma200 = safeNumber(ema200[i]) > 0 ? ((closes[i] - ema200[i]) / ema200[i]) * 100 : 0;

  // Quality Gates
  const currentDate = new Date(now);
  const gateContext: GateContext = {
    adx: adxValue, volumeRatio, volatilityPercentile: structure.volatilityPercentile,
    tradabilityScore: structure.tradabilityScore, priceVsEma200,
    timeOfDay: currentDate.getUTCHours(), dayOfWeek: currentDate.getUTCDay(),
    signalsInChopWindow: signalsInWindow, chopThreshold: config.chopMaxSignalsInWindow,
    secondsSinceLastSignal, requiredCooldownSeconds
  };

  const qualityGates = runQualityGates(gateContext);

  if (!qualityGates.passed) {
    const firstFailure = qualityGates.hardFailures[0] || '';
    let stage = 'QUALITY_GATE';
    if (firstFailure.includes('CHOP')) stage = 'CHOP_DETECTED';
    else if (firstFailure.includes('COOL')) stage = 'COOLDOWN';
    return noSignal(stage, firstFailure, emptyTech, null, structure, qualityGates, null, 0, 0, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
  }

  // ADX Modulation
  const adxFactor = adxValue < config.adxChopThreshold ? config.adxChopMultiplier :
                    adxValue < config.adxWeakThreshold ? config.adxWeakMultiplier : 1.0;
  const baseMinScore = structure.regime === 'LOW_VOL' ? config.minScoreLowVol :
                       structure.regime === 'HIGH_VOL' ? config.minScoreHighVol : config.minScoreNormal;
  const baseMinEdge = structure.regime === 'LOW_VOL' ? config.minEdgeLowVol :
                      structure.regime === 'HIGH_VOL' ? config.minEdgeHighVol : config.minEdgeNormal;
  const effectiveMinScore = baseMinScore * adxFactor;
  const effectiveMinEdge = baseMinEdge * adxFactor;

  // EMAs
  const valFast = structure.regime === 'LOW_VOL' ? emaFast_Low[i] :
                  structure.regime === 'HIGH_VOL' ? emaFast_High[i] : emaFast_Norm[i];
  const valSlow = structure.regime === 'LOW_VOL' ? emaSlow_Low[i] :
                  structure.regime === 'HIGH_VOL' ? emaSlow_High[i] : emaSlow_Norm[i];
  const prevFast = structure.regime === 'LOW_VOL' ? emaFast_Low[i-1] :
                   structure.regime === 'HIGH_VOL' ? emaFast_High[i-1] : emaFast_Norm[i-1];
  const prevSlow = structure.regime === 'LOW_VOL' ? emaSlow_Low[i-1] :
                   structure.regime === 'HIGH_VOL' ? emaSlow_High[i-1] : emaSlow_Norm[i-1];

  // Technical Score
  const technical = calculateTechnicalScore(chartData, structure, ema200, valFast, valSlow, prevFast, prevSlow, rsiVal);
  reasoning.push(`Tech: Bull=${technical.bullScore.toFixed(2)}, Bear=${technical.bearScore.toFixed(2)}, Edge=${technical.edge.toFixed(2)}`);

  // Order Flow Score
  const orderFlow = calculateOrderFlowScore(orderFlowStats, { price: closes[i], prevPrice: closes[i-1], prevPrevPrice: closes[i-2] }, config);
  if (orderFlow.direction !== 'NEUTRAL') {
    reasoning.push(`OF: ${orderFlow.direction}, Edge=${orderFlow.edge.toFixed(2)}, ${orderFlow.cvdDivergence}`);
  }

  // OF Veto
  if (config.useOrderFlow && orderFlow.direction !== 'NEUTRAL') {
    if (orderFlow.direction !== technical.direction && orderFlow.edge >= config.orderFlowVetoThreshold) {
      return noSignal('OF_VETO', `OF opposes tech`, technical, orderFlow, structure, qualityGates, null, effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
    }
  }

  // Merge scores if aligned
  let finalBull = technical.bullScore;
  let finalBear = technical.bearScore;
  if (config.useOrderFlow && orderFlow.direction !== 'NEUTRAL' && orderFlow.direction === technical.direction) {
    const ofBoost = config.orderFlowWeight * 6.0;
    finalBull += orderFlow.bullScore * (ofBoost / 6);
    finalBear += orderFlow.bearScore * (ofBoost / 6);
  }

  const finalEdge = Math.abs(finalBull - finalBear);
  const finalDirection = finalBull > finalBear ? 'LONG' : 'SHORT';

  // Edge Check
  if (finalEdge < effectiveMinEdge) {
    return noSignal('EDGE_INSUFFICIENT', `Edge ${finalEdge.toFixed(2)} < ${effectiveMinEdge.toFixed(2)}`, technical, orderFlow, structure, qualityGates, null, effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
  }

  // Score Check
  const dominantScore = Math.max(finalBull, finalBear);
  const oppositeScore = Math.min(finalBull, finalBear);
  if (dominantScore < effectiveMinScore) {
    return noSignal('SCORE_INSUFFICIENT', `Score ${dominantScore.toFixed(2)} < ${effectiveMinScore.toFixed(2)}`, technical, orderFlow, structure, qualityGates, null, effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
  }
  if (oppositeScore >= 2.5) {
    return noSignal('EDGE_INSUFFICIENT', `Opposite too strong (${oppositeScore.toFixed(2)})`, technical, orderFlow, structure, qualityGates, null, effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
  }

  // Consensus
  const consensus = generateConsensus(technical, orderFlow, structure, state, config);
  reasoning.push(`Consensus: ${consensus.decision} | Support=${consensus.supportWeight.toFixed(1)} | Agree=${consensus.agreementScore.toFixed(0)}%`);

  if (consensus.decision === 'VETO') {
    return noSignal('CONSENSUS_VETO', consensus.vetoReason || 'Veto', technical, orderFlow, structure, qualityGates, consensus, effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
  }

  // Calculate Entry/Stop
  const currentPrice = closes[i];
  const currentATR = safeNumber(atr[i]);
  const stopMult = structure.regime === 'HIGH_VOL' ? 2.0 : structure.regime === 'LOW_VOL' ? 1.2 : 1.5;
  const stopDistance = currentATR * stopMult;

  let entryPrice: number, stopPrice: number;
  if (finalDirection === 'LONG') {
    entryPrice = applySlippage(currentPrice, 'BUY', 'MARKET', currentATR, currentPrice);
    stopPrice = applySlippage(currentPrice - stopDistance, 'SELL', 'STOP', currentATR, currentPrice);
  } else {
    entryPrice = applySlippage(currentPrice, 'SELL', 'MARKET', currentATR, currentPrice);
    stopPrice = applySlippage(currentPrice + stopDistance, 'BUY', 'STOP', currentATR, currentPrice);
  }

  // Multi-Target TPs (NEW V3.3)
  const targetLevels = calculateMultiTargets(entryPrice, stopPrice, finalDirection, structure, config);

  // R:R Check (using TP2 as main target for 2:1 minimum)
  const tp2 = targetLevels[1];
  const actualRisk = Math.abs(entryPrice - stopPrice);
  const actualReward = Math.abs(tp2.price - entryPrice);
  const calculatedRR = safeDivide(actualReward, actualRisk, 0);

  if (!Number.isFinite(calculatedRR) || calculatedRR < config.minRiskReward) {
    return noSignal('RR_TOO_LOW', `R:R ${calculatedRR.toFixed(2)} < ${config.minRiskReward}`, technical, orderFlow, structure, qualityGates, consensus, effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
  }

  // Pattern Learning (NEW V3.3)
  const fingerprint = buildPatternFingerprint(technical, orderFlow, structure, consensus, rsiVal, consensus.finalConfidence);
  const similarPatterns = findSimilarPatterns(fingerprint, patternLearning, config);
  const patternConfidenceAdjustment = calculatePatternConfidenceAdjustment(similarPatterns, config);
  
  const patternAnalysis = {
    fingerprint,
    similarPatterns,
    confidenceAdjustment: patternConfidenceAdjustment,
    patternWinRate: similarPatterns.length > 0 
      ? similarPatterns.filter(p => p.wasWinner).length / similarPatterns.length 
      : null
  };

  if (similarPatterns.length >= 5) {
    reasoning.push(`Pattern: ${similarPatterns.length} matches, ${(patternAnalysis.patternWinRate! * 100).toFixed(0)}% win, adj=${patternConfidenceAdjustment.toFixed(1)}`);
  }

  // Apply penalties and pattern learning
  const baseConfidence = consensus.finalConfidence * qualityGates.penaltyMultiplier;
  const adjustedConfidence = Math.round(Math.max(25, Math.min(95, baseConfidence + patternConfidenceAdjustment)));

  // Build Enhanced Signal
  const signal: EnhancedTradeSignal = {
    id: `tactical-v33-${now}-${Math.random().toString(36).substring(2, 9)}`,
    pair: 'BTCUSDT',
    type: finalDirection,
    entryZone: entryPrice.toFixed(2),
    invalidation: stopPrice.toFixed(2),
    targets: targetLevels.map(t => t.price.toFixed(2)),
    riskRewardRatio: parseFloat(calculatedRR.toFixed(2)),
    confidence: adjustedConfidence,
    regime: structure.regime,
    reasoning: reasoning.slice(-5).join(' | '),
    status: 'ACTIVE',
    timestamp: now,
    source: 'tactical',
    approvalStatus: consensus.decision === 'WEAK_CONSENSUS' ? 'pending_review' : 'active',
    
    // Enhanced fields
    targetLevels,
    suggestedPositionSize: 100,  // Full position initially
    breakEvenPrice: null,
    trailingStopActive: false,
    currentStopPrice: stopPrice,
    
    patternFingerprint: fingerprint,
    patternConfidenceAdjustment,
    similarPatterns,
    
    nearestResistance: structure.nearestResistance,
    nearestSupport: structure.nearestSupport,
    
    positionRemaining: 100,
    realizedPnL: 0,
    unrealizedPnL: 0
  };

  reasoning.push(`✅ ${signal.type} @ ${signal.entryZone} | SL: ${signal.invalidation} | TPs: ${targetLevels.map(t => `${t.rMultiple}R`).join('/')} | Conf: ${signal.confidence}%`);

  const updatedHistory = addToSignalHistory(signalHistory, signal, config.signalMaxAgeSeconds);

  return {
    signal,
    technical,
    orderFlow,
    structure,
    qualityGates,
    consensus,
    effectiveMinScore,
    effectiveMinEdge,
    calculatedRR,
    chopAnalysis,
    cooldownAnalysis,
    patternAnalysis,
    regime: structure.regime,
    reasoning,
    updatedHistory,
    rejectionStage: 'NONE',
    rejectionReason: null
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  calculatePatternSimilarity,
  findSimilarPatterns,
  calculatePatternConfidenceAdjustment,
  calculateMultiTargets,
  detectStructureLevels,
  buildPatternFingerprint
};

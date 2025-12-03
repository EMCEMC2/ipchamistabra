import { z } from 'zod';
import { AggrStats } from './types/aggrTypes';

export const ChartDataPointSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number()
});

export enum Timeframe {
  H1 = '1H',
  H4 = '4H',
  D1 = '1D',
  W1 = '1W',
}

export interface MarketMetrics {
  price: string;
  change24h: string;
  vix: string;
  btcd: string;
  rsi: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  volume: string;
}

export interface AgentVote {
  agentName: string;
  vote: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reason: string;
}

export interface ConfidenceAdjustment {
  label: string;
  value: number;
  type: 'boost' | 'penalty';
}

export interface TradeSignal {
  id: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  entryZone: string;
  invalidation: string; // Stop Loss
  targets: string[];
  riskRewardRatio: number; // New field for R:R
  confidence: number; // 0-100
  regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'TRENDING'; // New Field: Aligns with Pine Script
  reasoning: string;
  status: 'SCANNING' | 'ACTIVE' | 'FILLED' | 'COMPLETED' | 'STOPPED' | 'CLOSED' | 'INVALIDATED' | 'EXPIRED';
  timestamp: number;
  // Signal origin and approval status (AI Safety Gate)
  source: 'tactical' | 'ai' | 'hybrid'; // Where signal originated
  approvalStatus: 'active' | 'pending_review'; // Human approval status
  approvedAt?: number; // Timestamp of human approval
  // Stage 2: Transparent AI
  consensus?: {
    votes: AgentVote[];
    totalScore: number;
  };
  confidenceBreakdown?: ConfidenceAdjustment[];
}

export const TradeSignalSchema = z.object({
  id: z.string().optional(),
  pair: z.string(),
  type: z.enum(['LONG', 'SHORT']),
  entryZone: z.string(),
  invalidation: z.string(),
  targets: z.array(z.string()),
  riskRewardRatio: z.number(),
  confidence: z.number(),
  regime: z.enum(['LOW_VOL', 'NORMAL', 'HIGH_VOL', 'TRENDING']),
  reasoning: z.string(),
  timestamp: z.number().optional(),
  status: z.enum(['SCANNING', 'ACTIVE', 'FILLED', 'COMPLETED', 'STOPPED', 'CLOSED', 'INVALIDATED', 'EXPIRED']),
  // AI Safety Gate fields
  source: z.enum(['tactical', 'ai', 'hybrid']).optional(),
  approvalStatus: z.enum(['active', 'pending_review']).optional(),
  approvedAt: z.number().optional()
});

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: GroundingSource[];
  timestamp: number;
}

export interface ChartDataPoint {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// --- NEW TRADING ENGINE TYPES ---

export interface Position {
  id: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  size: number; // In BTC
  leverage: number;
  liquidationPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number; // Unrealized PnL USD
  pnlPercent: number;
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  date: number; // Added date
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size?: number;
  leverage?: number;
  pnl: number; // Realized
  pnlPercent: number;
  entryTime: number;
  exitTime: number;
  notes: string;
  tags: string[]; // Added tags
  mood?: string; // Added mood
  result?: 'WIN' | 'LOSS' | 'BE'; // Added result
  aiFeedback?: string;
}

export interface MLModelMetrics {
  iteration: number;
  reward: number; // For PPO
  loss: number;
  accuracy: number;
}

export interface HyperParam {
  name: string;
  value: number | string;
  range: string;
}

// --- NEW: INTEL FEED TYPES ---
export interface IntelItem {
  id: string;
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'NEWS' | 'ONCHAIN' | 'MACRO' | 'WHALE' | 'ORDERFLOW' | 'LIQUIDATION';
  timestamp: number; // Unix ms
  source: string;
  summary: string;
  btcSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // New field for BTC impact
}

export const IntelItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW', 'CRITICAL']).or(z.string()),
  category: z.enum(['NEWS', 'ONCHAIN', 'MACRO', 'WHALE', 'SOCIAL']).or(z.string()),
  timestamp: z.number(),
  source: z.string(),
  summary: z.string(),
  btcSentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL'])
});

// --- NEW: AGENT SWARM TYPES ---

export type AgentRole = 'ORCHESTRATOR' | 'INSPECTOR' | 'STRATEGIST' | 'QUANT_RESEARCHER' | 'MODEL_OPTIMIZER' | 'RISK_OFFICER' | 'ENGINEER';

export type AgentStatus = 'IDLE' | 'WORKING' | 'SUCCESS' | 'FAILURE' | 'WAITING' | 'TIMEOUT';

// Agent SLA configuration (in milliseconds)
export const AGENT_SLA: Record<AgentRole, number> = {
  ORCHESTRATOR: 5000,
  INSPECTOR: 10000,
  STRATEGIST: 30000,
  QUANT_RESEARCHER: 20000,
  MODEL_OPTIMIZER: 15000,
  RISK_OFFICER: 10000,
  ENGINEER: 15000
};

export interface AgentState {
  role: AgentRole;
  name: string;
  description: string;
  status: AgentStatus;
  lastLog: string;
  startedAt?: number;    // Timestamp when agent started working
  completedAt?: number;  // Timestamp when agent finished
  duration?: number;     // How long the agent took (ms)
}

export interface AgentTaskResult {
  success: boolean;
  message: string;
  data?: any;
}

// --- AI TACTICAL BOT TYPES ---

/**
 * Represents a single message in the tactical chat conversation.
 * Supports user queries, AI assistant responses, and system messages.
 * Assistant messages may include grounded sources and contextual market data.
 */
export interface TacticalChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** The sender of the message */
  role: 'user' | 'assistant' | 'system';
  /** Message text content, supports markdown for assistant responses */
  content: string;
  /** Unix timestamp in milliseconds when message was created */
  timestamp: number;
  /** Optional metadata providing additional context for the message */
  metadata?: {
    /** Citations and sources from Gemini API grounding */
    sources?: GroundingSource[];
    /** IDs of trade signals referenced in this message */
    relatedSignals?: string[];
    /** Market context snapshot at time of message */
    marketContext?: {
      price: number;
      sentiment: number;
      regime: string;
    };
  };
}

/**
 * Represents a query to the AI tactical intelligence system.
 * Contains the user's question along with relevant contextual data
 * to enable grounded, context-aware responses.
 */
export interface IntelligenceQuery {
  /** The user's question or request */
  query: string;
  /** Contextual data to inform the AI response */
  context: {
    /** Currently active trade signals */
    activeSignals?: TradeSignal[];
    /** Recent intelligence items and news */
    recentNews?: IntelItem[];
    /** Current market metrics and indicators */
    marketMetrics?: MarketMetrics;
    /** Order flow statistics and data */
    orderFlowStats?: AggrStats | null;
    /** Current agent swarm consensus opinion */
    swarmConsensus?: string;
  };
}

// ============================================================================
// V3.3.1 TACTICAL SIGNAL SYSTEM TYPES
// ============================================================================

/**
 * Configuration for V3.3.1 Tactical Signal Generator
 * Includes regime-adaptive thresholds, multi-target TPs, and pattern learning
 */
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

  // V3.3.1: OF Veto refinement
  techEdgeMinForVeto: number;

  // ADX modulation
  adxChopThreshold: number;
  adxWeakThreshold: number;
  adxChopMultiplier: number;
  adxWeakMultiplier: number;

  // Signal decay
  signalDecayPerMinute: number;
  signalDecayPerPctDrift: number;
  signalMaxAgeSeconds: number;

  // V3.3: Multi-Target Config
  tp1Multiplier: number;
  tp2Multiplier: number;
  tp3Multiplier: number;
  tp4Multiplier: number;

  tp1PositionPct: number;
  tp2PositionPct: number;
  tp3PositionPct: number;
  tp4PositionPct: number;

  moveStopToBreakevenAtTp: number;

  // V3.3: Pattern Learning Config
  patternLearningEnabled: boolean;
  minPatternsForLearning: number;
  patternSimilarityThreshold: number;
  maxConfidenceBoost: number;
  maxConfidencePenalty: number;

  // V3.3: S/R Integration
  useStructureLevels: boolean;
  srProximityThreshold: number;

  // V3.3.1: Asset-specific session handling
  assetType: 'CRYPTO' | 'FX' | 'STOCKS';
  disableWeekendPenalty: boolean;
  disableSessionPenalty: boolean;
}

/**
 * Default configuration optimized for crypto (BTC)
 */
export const DEFAULT_CONFIG_V33: TacticalConfigV33 = {
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
  techEdgeMinForVeto: 0.5,

  adxChopThreshold: 15,
  adxWeakThreshold: 20,
  adxChopMultiplier: 1.5,
  adxWeakMultiplier: 1.2,

  signalDecayPerMinute: 0.8,
  signalDecayPerPctDrift: 5.0,
  signalMaxAgeSeconds: 3600,

  tp1Multiplier: 1.0,
  tp2Multiplier: 2.0,
  tp3Multiplier: 3.0,
  tp4Multiplier: 5.0,

  tp1PositionPct: 25,
  tp2PositionPct: 35,
  tp3PositionPct: 25,
  tp4PositionPct: 15,

  moveStopToBreakevenAtTp: 1,

  patternLearningEnabled: true,
  minPatternsForLearning: 20,
  patternSimilarityThreshold: 0.7,
  maxConfidenceBoost: 15,
  maxConfidencePenalty: 20,

  useStructureLevels: true,
  srProximityThreshold: 0.3,

  assetType: 'CRYPTO',
  disableWeekendPenalty: true,
  disableSessionPenalty: true
};

// ============================================================================
// MULTI-TARGET TYPES
// ============================================================================

/**
 * Individual take-profit level with status tracking
 */
export interface TargetLevel {
  price: number;
  rMultiple: number;
  positionPct: number;
  status: 'PENDING' | 'HIT' | 'MISSED' | 'CANCELLED';
  hitTime?: number;
  hitPrice?: number;
}

/**
 * Enhanced trade signal with multi-target TPs and pattern learning
 * Extends base TradeSignal with V3.3.1 features
 */
export interface EnhancedTradeSignal extends TradeSignal {
  // Multi-target system
  targetLevels: TargetLevel[];

  // Position management
  suggestedPositionSize: number;
  breakEvenPrice: number | null;
  trailingStopActive: boolean;
  currentStopPrice: number;

  // Pattern learning metadata
  patternFingerprint: PatternFingerprint;
  patternConfidenceAdjustment: number;
  similarPatterns: PatternMatch[];

  // Structure levels used
  nearestResistance: number | null;
  nearestSupport: number | null;

  // Partial fill tracking
  positionRemaining: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

// ============================================================================
// PATTERN LEARNING TYPES
// ============================================================================

/**
 * 15-feature fingerprint for pattern similarity matching
 */
export interface PatternFingerprint {
  // Technical context (normalized 0-1)
  trendStrength: number;
  trendDirection: number;
  volatilityPercentile: number;
  rsiNormalized: number;

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

/**
 * Completed trade outcome for pattern learning
 */
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
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
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

/**
 * Historical pattern match result
 */
export interface PatternMatch {
  outcome: TradeOutcome;
  similarity: number;
  wasWinner: boolean;
  rMultiple: number;
}

/**
 * Aggregated statistics for a pattern category
 */
export interface PatternStats {
  count: number;
  winRate: number;
  avgR: number;
  profitFactor: number;
}

/**
 * Complete pattern learning state
 * Stored in Supabase for persistence across sessions
 */
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

/**
 * Empty pattern learning state for initialization
 */
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

// ============================================================================
// S/R LEVEL DETECTION TYPES
// ============================================================================

/**
 * Support/Resistance level with strength and source info
 */
export interface StructureLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  strength: number;
  lastTouchTime: number;
  source: 'SWING' | 'VOLUME_PROFILE' | 'ROUND_NUMBER' | 'PREVIOUS_TP_SL';
}

// ============================================================================
// SIGNAL HISTORY TYPES
// ============================================================================

/**
 * Individual signal history entry for chop detection
 */
export interface SignalHistoryEntry {
  timestamp: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  confidence: number;
}

/**
 * Signal history state for cooldown and chop tracking
 */
export interface SignalHistoryState {
  entries: SignalHistoryEntry[];
  lastSignalTimestamp: number;
}

/**
 * Empty signal history for initialization
 */
export const EMPTY_SIGNAL_HISTORY: SignalHistoryState = {
  entries: [],
  lastSignalTimestamp: 0
};

// ============================================================================
// MARKET STRUCTURE TYPES
// ============================================================================

/**
 * Extended market structure analysis with S/R levels
 */
export interface MarketStructureV33 {
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

  // V3.3: S/R levels
  structureLevels: StructureLevel[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

// ============================================================================
// TECHNICAL SCORE TYPES
// ============================================================================

/**
 * Technical analysis score breakdown
 */
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

// ============================================================================
// ORDER FLOW SCORE TYPES
// ============================================================================

/**
 * Order flow analysis score with CVD and liquidation data
 */
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

// ============================================================================
// QUALITY GATES TYPES
// ============================================================================

/**
 * Quality gate evaluation result
 */
export interface QualityGateResult {
  passed: boolean;
  hardFailures: string[];
  softPenalties: string[];
  penaltyMultiplier: number;
}

// ============================================================================
// CONSENSUS TYPES
// ============================================================================

/**
 * Multi-agent consensus voting result
 */
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

// ============================================================================
// TACTICAL RESULT V3.3
// ============================================================================

/**
 * Complete result from V3.3.1 signal generator
 * Includes all analysis components for transparency
 */
export interface TacticalResultV33 {
  signal: EnhancedTradeSignal | null;

  technical: TechnicalScore;
  orderFlow: OrderFlowScore | null;
  structure: MarketStructureV33;
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

// ============================================================================
// BACKTEST TYPES (V3.3)
// ============================================================================

/**
 * Configuration for backtesting engine
 */
export interface BacktestConfig {
  startDate: number;
  endDate: number;
  initialCapital: number;
  riskPerTrade: number;
  maxConcurrentTrades: number;
  slippageBps: number;
  commissionBps: number;
  tacticalConfig: TacticalConfigV33;
}

/**
 * Open position during backtest
 */
export interface BacktestOpenPosition {
  signalId: string;
  entryPrice: number;
  entryTime: number;
  direction: 'LONG' | 'SHORT';
  size: number;
  stopPrice: number;
  targetLevels: TargetLevel[];
  positionRemaining: number;
  fingerprint: PatternFingerprint;
}

/**
 * Closed trade from backtest
 */
export interface BacktestClosedTrade {
  signalId: string;
  entryPrice: number;
  entryTime: number;
  exitPrice: number;
  exitTime: number;
  direction: 'LONG' | 'SHORT';
  size: number;
  pnl: number;
  pnlPercent: number;
  rMultiple: number;
  exitReason: 'TP1' | 'TP2' | 'TP3' | 'TP4' | 'STOP' | 'MANUAL' | 'EXPIRED';
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  tp4Hit: boolean;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  fingerprint: PatternFingerprint;
}

/**
 * Backtest state during execution
 */
export interface BacktestState {
  currentTime: number;
  equity: number;
  cash: number;
  openPositions: BacktestOpenPosition[];
  closedTrades: BacktestClosedTrade[];
  signalHistory: SignalHistoryState;
  patternLearning: PatternLearningState;
  equityCurve: { time: number; equity: number; drawdown: number }[];
  peakEquity: number;
  maxDrawdown: number;
}

/**
 * Complete backtest results with statistics
 */
export interface BacktestResults {
  // Overview
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;

  // Returns
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;

  // Risk metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  // Target analysis
  tp1HitRate: number;
  tp2HitRate: number;
  tp3HitRate: number;
  tp4HitRate: number;

  // Trade quality
  avgWinR: number;
  avgLossR: number;
  avgMFE: number;
  avgMAE: number;
  avgTradeDuration: number;

  // Pattern analysis
  winRateByRegime: Record<string, { count: number; winRate: number; avgR: number }>;
  winRateByCvdDivergence: Record<string, { count: number; winRate: number; avgR: number }>;

  // Time analysis
  bestHour: number;
  worstHour: number;
  bestDay: number;
  worstDay: number;

  // Equity curve
  equityCurve: { time: number; equity: number; drawdown: number }[];

  // Trade list
  trades: BacktestClosedTrade[];

  // Config used
  config: BacktestConfig;
}
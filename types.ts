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
  status: 'SCANNING' | 'ACTIVE' | 'FILLED' | 'COMPLETED' | 'STOPPED' | 'CLOSED';
  timestamp: number;
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
  status: z.enum(['SCANNING', 'ACTIVE', 'FILLED', 'COMPLETED', 'STOPPED', 'CLOSED'])
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
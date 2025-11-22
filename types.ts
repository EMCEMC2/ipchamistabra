import { z } from 'zod';

export const ChartDataPointSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number()
});

export const IntelItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW', 'CRITICAL']).or(z.string()),
  category: z.enum(['NEWS', 'ONCHAIN', 'MACRO', 'WHALE', 'SOCIAL']).or(z.string()),
  timestamp: z.number(),
  source: z.string(),
  summary: z.string()
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
  status: 'SCANNING' | 'ACTIVE' | 'COMPLETED' | 'STOPPED';
  timestamp: number;
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
  status: z.enum(['SCANNING', 'ACTIVE', 'COMPLETED', 'STOPPED'])
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
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number; // Realized
  pnlPercent: number;
  entryTime: number;
  exitTime: number;
  notes: string;
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
  category: 'NEWS' | 'ONCHAIN' | 'MACRO' | 'WHALE';
  timestamp: number; // Unix ms
  source: string;
  summary: string;
}

// --- NEW: AGENT SWARM TYPES ---

export type AgentRole = 'ORCHESTRATOR' | 'INSPECTOR' | 'STRATEGIST' | 'QUANT_RESEARCHER' | 'MODEL_OPTIMIZER' | 'RISK_OFFICER' | 'ENGINEER';

export type AgentStatus = 'IDLE' | 'WORKING' | 'SUCCESS' | 'FAILURE' | 'WAITING';

export interface AgentState {
  role: AgentRole;
  name: string;
  description: string;
  status: AgentStatus;
  lastLog: string;
}

export interface AgentTaskResult {
  success: boolean;
  message: string;
  data?: any;
}
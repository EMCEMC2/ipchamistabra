import { AggrStats, AggrLiquidation, AggrTrade, CascadeEvent } from '../../types/aggrTypes';

export type WorkerMessageType =
  | 'INIT'
  | 'CONNECT'
  | 'DISCONNECT'
  | 'STATS_UPDATE'
  | 'LIQUIDATION_EVENT'
  | 'LARGE_TRADE_EVENT'
  | 'CASCADE_EVENT'
  | 'CONNECTION_FAILED'
  | 'DEBUG_LOG';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: any;
}

export interface InitPayload {
  config: {
    maxTradeHistory: number;
    maxLiquidationHistory: number;
  };
}

export interface StatsUpdatePayload {
  stats: AggrStats;
}

export interface LiquidationEventPayload {
  liquidation: AggrLiquidation;
}

export interface LargeTradeEventPayload {
  trade: AggrTrade;
}

export interface CascadeEventPayload {
  cascade: CascadeEvent;
}

export interface ConnectionFailedPayload {
  exchange: string;
  maxAttempts: number;
}

export interface AggrTrade {
  exchange: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  isLiquidation: boolean;
  usdValue: number;
}

export interface AggrLiquidation {
  exchange: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'long' | 'short';
  usdValue: number;
}

export interface CVDData {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  delta: number; // buyVolume - sellVolume
  cumulativeDelta: number; // Running sum
}

export interface MarketPressure {
  buyPressure: number; // 0-100 (% buys in last 60s)
  sellPressure: number; // 0-100 (% sells in last 60s)
  netPressure: number; // buyPressure - sellPressure
  dominantSide: 'buy' | 'sell' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong' | 'extreme';
}

export interface ExchangeFlow {
  exchange: string;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  dominance: number; // % of total volume
}

export interface OpenInterestData {
  openInterest: number; // In BTC
  openInterestUsd: number; // In USD
  change1h: number; // % change
  timestamp: number;
}

export interface LongShortRatio {
  longRatio: number; // 0-100
  shortRatio: number; // 0-100
  longShortRatio: number; // Long accounts / Short accounts
  topTraderRatio: number; // Top traders long/short
  timestamp: number;
}

export interface FundingData {
  rate: number; // Current funding rate
  predictedRate: number; // Next funding rate
  nextFundingTime: number; // Unix timestamp
  annualizedRate: number; // Annualized %
}

export interface AggrStats {
  // Last 60 seconds
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  largeTradeCount: number; // >$100K (lowered threshold)
  liquidationCount: number;
  liquidationVolume: number;

  // Cumulative Volume Delta
  cvd: CVDData;

  // Market Pressure
  pressure: MarketPressure;

  // Exchange Breakdown
  exchanges: ExchangeFlow[];

  // Recent Events
  recentLiquidations: AggrLiquidation[];
  recentLargeTrades: AggrTrade[];

  // Enhanced Intelligence (from REST API)
  openInterest?: OpenInterestData;
  longShortRatio?: LongShortRatio;
  funding?: FundingData;

  // IP Ban Status (Binance API Rate Limiting)
  banned?: {
    isBanned: boolean;
    expiryTime: number;
    remainingMinutes: number;
  };

  // Data Freshness Timestamp
  lastUpdate?: number; // Unix timestamp of last data update
}

export interface CascadeEvent {
  startTime: number;
  endTime: number;
  totalLiquidated: number;
  side: 'long' | 'short';
  exchanges: string[];
  priceImpact: number; // % price moved
  severity: 'minor' | 'moderate' | 'major' | 'extreme';
}

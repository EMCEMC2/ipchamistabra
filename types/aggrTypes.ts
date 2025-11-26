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

export interface AggrStats {
  // Last 60 seconds
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  largeTradeCount: number; // >$500K
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

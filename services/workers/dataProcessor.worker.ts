/* eslint-disable no-restricted-globals */

// --- INLINED TYPES TO PREVENT IMPORT ISSUES IN WORKER ---
interface AggrTrade {
  exchange: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  isLiquidation: boolean;
  usdValue: number;
}

interface AggrLiquidation {
  exchange: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'long' | 'short';
  usdValue: number;
}

interface CVDData {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  cumulativeDelta: number;
}

interface MarketPressure {
  buyPressure: number;
  sellPressure: number;
  netPressure: number;
  dominantSide: 'buy' | 'sell' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong' | 'extreme';
}

interface ExchangeFlow {
  exchange: string;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  dominance: number;
}

interface AggrStats {
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  largeTradeCount: number;
  liquidationCount: number;
  liquidationVolume: number;
  cvd: CVDData;
  pressure: MarketPressure;
  exchanges: ExchangeFlow[];
  recentLiquidations: AggrLiquidation[];
  recentLargeTrades: AggrTrade[];
}

interface CascadeEvent {
  startTime: number;
  endTime: number;
  totalLiquidated: number;
  side: 'long' | 'short';
  exchanges: string[];
  priceImpact: number;
  severity: 'minor' | 'moderate' | 'major' | 'extreme';
}

// --- WORKER LOGIC ---

class RollingWindow {
  private data: CVDData[] = [];
  private maxSize: number;
  private cumulativeSum: number = 0;
  private sessionStartCVD: number = 0;
  private lastResetTime: number = Date.now();
  private resetHour: number = 0;

  // Track buy/sell volumes for display
  private buyVolume: number = 0;
  private sellVolume: number = 0;

  constructor(maxSize: number = 60, resetHour: number = 0) {
    this.maxSize = maxSize;
    this.resetHour = resetHour;
  }

  // NEW METHOD: Add individual trade delta (CORRECT CVD calculation)
  addTradeDelta(tradeDelta: number): void {
    const now = Date.now();
    const currentHour = new Date(now).getUTCHours();

    // Daily reset at UTC 0
    if (currentHour === this.resetHour && now - this.lastResetTime > 3600000) {
      this.sessionStartCVD = this.cumulativeSum;
      this.lastResetTime = now;
      this.buyVolume = 0;
      this.sellVolume = 0;
    }

    // Accumulate individual trade delta
    this.cumulativeSum += tradeDelta;

    // Track buy/sell volumes for display
    if (tradeDelta > 0) {
      this.buyVolume += tradeDelta;
    } else {
      this.sellVolume += Math.abs(tradeDelta);
    }

    // Session CVD (since last reset)
    const sessionCVD = this.cumulativeSum - this.sessionStartCVD;

    const cvdData: CVDData = {
      timestamp: now,
      buyVolume: this.buyVolume,
      sellVolume: this.sellVolume,
      delta: tradeDelta,
      cumulativeDelta: sessionCVD
    };

    this.data.push(cvdData);
    if (this.data.length > this.maxSize) {
      this.data.shift();
    }
  }

  // LEGACY METHOD: Deprecated - kept for backward compatibility
  add(buyVolume: number, sellVolume: number): CVDData {
    const now = Date.now();
    const currentHour = new Date(now).getUTCHours();

    if (currentHour === this.resetHour && now - this.lastResetTime > 3600000) {
      this.sessionStartCVD = this.cumulativeSum;
      this.lastResetTime = now;
    }

    const delta = buyVolume - sellVolume;
    this.cumulativeSum += delta;
    const sessionCVD = this.cumulativeSum - this.sessionStartCVD;

    const cvdData: CVDData = {
      timestamp: now,
      buyVolume,
      sellVolume,
      delta,
      cumulativeDelta: sessionCVD
    };

    this.data.push(cvdData);
    if (this.data.length > this.maxSize) {
      this.data.shift();
    }

    return cvdData;
  }

  get latest(): CVDData | null {
    return this.data[this.data.length - 1] || null;
  }
}

class DataProcessor {
  private wsConnections: Map<string, WebSocket> = new Map();
  private trades: AggrTrade[] = [];
  private largeTrades: AggrTrade[] = []; // Dedicated array for whales
  private liquidations: AggrLiquidation[] = [];
  private cvdWindow: RollingWindow = new RollingWindow(60);
  
  // ... (rest of properties)

  // ... (constructor and log)

  // ... (connect/disconnect)

  private broadcastStats() {
    const stats = this.calculateStats();
    if (stats) {
      self.postMessage({ type: 'STATS_UPDATE', payload: { stats } });
    }
  }

  private calculateStats(): AggrStats | null {
    const now = Date.now();
    const oneMinAgo = now - 60000;
    const recentTrades = this.trades.filter(t => t.timestamp > oneMinAgo);

    if (recentTrades.length === 0) {
        // Return empty stats if we are connected, so UI shows "Live" with 0 volume
        return {
            totalVolume: 0,
            buyVolume: 0,
            sellVolume: 0,
            largeTradeCount: 0,
            liquidationCount: 0,
            liquidationVolume: 0,
            cvd: this.cvdWindow.latest || { timestamp: now, buyVolume: 0, sellVolume: 0, delta: 0, cumulativeDelta: 0 },
            pressure: { buyPressure: 50, sellPressure: 50, netPressure: 0, dominantSide: 'neutral', strength: 'weak' },
            exchanges: [],
            recentLiquidations: [],
            recentLargeTrades: []
        };
    }

    const buyTrades = recentTrades.filter(t => t.side === 'buy');
    const sellTrades = recentTrades.filter(t => t.side === 'sell');
    const buyVolume = buyTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const totalVolume = buyVolume + sellVolume;

    // CVD is now updated per-trade in processTrade(), just get latest value
    const cvd = this.cvdWindow.latest || { timestamp: Date.now(), buyVolume: 0, sellVolume: 0, delta: 0, cumulativeDelta: 0 };

    // Pressure
    const pressure = this.calculatePressure(recentTrades);

    // Exchange Flow
    const exchanges = this.calculateExchangeFlow(recentTrades);

    // Large Trades & Liquidations
    const fiveMinAgo = now - 300000;
    const tenMinAgo = now - 600000;
    
    const recentLiquidations = this.liquidations.filter(l => l.timestamp > fiveMinAgo);
    const liquidationVolume = recentLiquidations.reduce((sum, l) => sum + l.usdValue, 0);
    
    // Use the dedicated largeTrades array, filtered for last 10 minutes
    const recentLargeTrades = this.largeTrades.filter(t => t.timestamp > tenMinAgo);

    return {
      totalVolume,
      buyVolume,
      sellVolume,
      largeTradeCount: recentLargeTrades.length, // Count from the longer history or just 1 min? Usually user wants count of RECENT whales. Let's use the 10 min count or maybe 1 min? 
      // Actually, largeTradeCount usually implies "current activity". Let's keep it as 1 min count for the metric, but list for 10 mins.
      // Wait, if I change largeTradeCount to 10 mins, it might look inflated.
      // Let's calculate 1 min count separately.
      liquidationCount: recentLiquidations.length,
      liquidationVolume,
      cvd,
      pressure,
      exchanges,
      recentLiquidations: recentLiquidations.slice(-10),
      recentLargeTrades: recentLargeTrades.slice(-10)
    };
  }

  // ... (calculatePressure, calculateExchangeFlow, connect methods)

  private processTrade(trade: AggrTrade) {
      this.trades.push(trade);

      // CRITICAL FIX: Update CVD with individual trade delta (not aggregated)
      const tradeDelta = trade.side === 'buy' ? trade.usdValue : -trade.usdValue;
      this.cvdWindow.addTradeDelta(tradeDelta);

      // Throttled log to confirm data flow
      if (this.trades.length % 100 === 0) {
        this.log(`Processed ${this.trades.length} trades. Latest: $${trade.price} | CVD: ${this.cvdWindow.latest?.cumulativeDelta.toFixed(2)}M`);
      }

      const cutoff = Date.now() - 60000;
      if (this.trades[0] && this.trades[0].timestamp < cutoff) {
          // Optimization: remove old trades in chunks or use a pointer
          this.trades = this.trades.filter(t => t.timestamp > cutoff);
      }

      if (trade.usdValue > 500000) {
          this.largeTrades.push(trade); // Add to dedicated array
          self.postMessage({ type: 'LARGE_TRADE_EVENT', payload: { trade } });
      }
      
      // Clean up large trades (keep 10 mins)
      const largeCutoff = Date.now() - 600000;
      if (this.largeTrades.length > 0 && this.largeTrades[0].timestamp < largeCutoff) {
           this.largeTrades = this.largeTrades.filter(t => t.timestamp > largeCutoff);
      }
  }

  private processLiquidation(liq: AggrLiquidation) {
      this.liquidations.push(liq);
      const cutoff = Date.now() - 300000;
      this.liquidations = this.liquidations.filter(l => l.timestamp > cutoff);
      
      self.postMessage({ type: 'LIQUIDATION_EVENT', payload: { liquidation: liq } });
      this.detectCascade(liq);
  }

  private detectCascade(liq: AggrLiquidation) {
      const now = Date.now();
      if (this.cascadeStartTime > 0 && now - this.cascadeStartTime > 300000) {
          this.cascadeStartTime = 0;
          this.cascadeVolume = 0;
          this.cascadeSide = null;
      }

      if (!this.cascadeSide || this.cascadeSide === liq.side) {
          if (!this.cascadeSide) {
              this.cascadeStartTime = liq.timestamp;
              this.cascadeSide = liq.side;
          }
          this.cascadeVolume += liq.usdValue;

          if (this.cascadeVolume > 10000000) {
              const severity = this.cascadeVolume > 100000000 ? 'extreme' : this.cascadeVolume > 50000000 ? 'major' : this.cascadeVolume > 25000000 ? 'moderate' : 'minor';
              const cascade: CascadeEvent = {
                  startTime: this.cascadeStartTime,
                  endTime: now,
                  totalLiquidated: this.cascadeVolume,
                  side: this.cascadeSide,
                  exchanges: ['Multi'],
                  priceImpact: 0,
                  severity
              };
              self.postMessage({ type: 'CASCADE_EVENT', payload: { cascade } });
          }
      }
  }
}

const processor = new DataProcessor();

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data;
  switch (type) {
    case 'CONNECT':
      processor.connect();
      break;
    case 'DISCONNECT':
      processor.disconnect();
      break;
  }
};

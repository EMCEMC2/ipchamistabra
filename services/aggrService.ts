/**
 * AGGR.TRADE COMPREHENSIVE SERVICE
 * Real-time order flow intelligence from multiple exchanges
 * FREE - No API key required
 *
 * Features:
 * - Real-time liquidations
 * - CVD (Cumulative Volume Delta) tracking
 * - Buy/Sell pressure analysis
 * - Large trade detection
 * - Exchange flow comparison
 * - Cascade event detection
 */

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

// Rolling window for CVD calculation with session-based reset
class RollingWindow {
  private data: CVDData[] = [];
  private maxSize: number;
  private cumulativeSum: number = 0;
  private sessionStartCVD: number = 0;
  private lastResetTime: number = Date.now();
  private resetHour: number = 0; // Reset at midnight UTC

  constructor(maxSize: number = 60, resetHour: number = 0) {
    this.maxSize = maxSize;
    this.resetHour = resetHour;
  }

  add(buyVolume: number, sellVolume: number): CVDData {
    const now = Date.now();
    const currentHour = new Date(now).getUTCHours();

    // FIX #3: Reset CVD at session start (daily at resetHour UTC)
    if (currentHour === this.resetHour && now - this.lastResetTime > 3600000) {
      console.log('[CVD] Session reset at', new Date(now).toISOString());
      this.sessionStartCVD = this.cumulativeSum;
      this.lastResetTime = now;
    }

    const delta = buyVolume - sellVolume;
    this.cumulativeSum += delta;

    // Session CVD (resets daily)
    const sessionCVD = this.cumulativeSum - this.sessionStartCVD;

    const cvdData: CVDData = {
      timestamp: now,
      buyVolume,
      sellVolume,
      delta,
      cumulativeDelta: sessionCVD  // FIX #3: Use session-relative CVD instead of unbounded
    };

    this.data.push(cvdData);

    // Keep only maxSize elements
    if (this.data.length > this.maxSize) {
      this.data.shift();
    }

    return cvdData;
  }

  get latest(): CVDData | null {
    return this.data[this.data.length - 1] || null;
  }

  get all(): CVDData[] {
    return [...this.data];
  }

  get avgDelta(): number {
    if (this.data.length === 0) return 0;
    const sum = this.data.reduce((acc, d) => acc + d.delta, 0);
    return sum / this.data.length;
  }

  /**
   * Manual reset (useful for testing or session changes)
   */
  resetSession(): void {
    console.log('[CVD] Manual session reset');
    this.sessionStartCVD = this.cumulativeSum;
    this.lastResetTime = Date.now();
  }
}

// Main Aggr Service with FIX #5: Auto-reconnection support
export class AggrTradeService {
  private wsConnections: Map<string, WebSocket> = new Map();
  private isConnected: boolean = false;

  // Data storage
  private trades: AggrTrade[] = [];
  private liquidations: AggrLiquidation[] = [];
  private cvdWindow: RollingWindow = new RollingWindow(60);

  // Cascade detection
  private cascadeStartTime: number = 0;
  private cascadeVolume: number = 0;
  private cascadeSide: 'long' | 'short' | null = null;

  // FIX #5: Reconnection tracking
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private maxReconnectAttempts: number = 10;

  // Event handlers
  private onStatsUpdate?: (stats: AggrStats) => void;
  private onLiquidation?: (liq: AggrLiquidation) => void;
  private onLargeTrade?: (trade: AggrTrade) => void;
  private onCascade?: (cascade: CascadeEvent) => void;

  constructor() {
    console.log('[Aggr] Service initialized with auto-reconnection');
  }

  /**
   * Connect to multiple exchange WebSocket feeds
   * Connects directly to Binance, OKX, and Bybit for real-time BTC data
   */
  connect(onStatsUpdate?: (stats: AggrStats) => void): void {
    console.log('[Aggr] Connecting to exchange WebSocket feeds...');

    this.onStatsUpdate = onStatsUpdate;

    // Connect to Binance Futures (Trades + Liquidations)
    this.connectBinance();

    // Connect to OKX (Trades)
    this.connectOKX();

    // Connect to Bybit (Trades + Liquidations)
    this.connectBybit();

    // Update stats every second
    setInterval(() => {
      this.updateStats();
    }, 1000);

    this.isConnected = true;
    console.log('[Aggr] Connected to exchange feeds (Binance, OKX, Bybit)');
  }

  /**
   * FIX #5: Connect to Binance Futures WebSocket with auto-reconnection
   */
  private connectBinance(): void {
    const connectTrades = () => {
      try {
        const key = 'binance-trades';
        const tradesWs = new WebSocket('wss://fstream.binance.com/ws/btcusdt@aggTrade');

        tradesWs.onopen = () => {
          console.log('[Aggr/Binance] Trades connected');
          this.reconnectAttempts.set(key, 0); // Reset counter on success
        };

        tradesWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const trade: AggrTrade = {
              exchange: 'Binance',
              timestamp: data.T || Date.now(),
              price: parseFloat(data.p) || 0,
              amount: parseFloat(data.q) || 0,
              side: data.m ? 'sell' : 'buy',
              isLiquidation: false,
              usdValue: 0
            };
            trade.usdValue = trade.price * trade.amount;
            this.processTrade(trade);
          } catch (error) {
            console.error('[Aggr/Binance] Trade parse error:', error);
          }
        };

        tradesWs.onerror = (err) => console.error('[Aggr/Binance] Trades error:', err);

        tradesWs.onclose = (event) => {
          console.warn('[Aggr/Binance] Trades connection closed:', event.code, event.reason);
          this.reconnectWithBackoff(key, connectTrades);
        };

        this.wsConnections.set(key, tradesWs);
      } catch (error) {
        console.error('[Aggr/Binance] Trades connection failed:', error);
        this.reconnectWithBackoff('binance-trades', connectTrades);
      }
    };

    const connectLiquidations = () => {
      try {
        const key = 'binance-liquidations';
        const liquidationsWs = new WebSocket('wss://fstream.binance.com/ws/btcusdt@forceOrder');

        liquidationsWs.onopen = () => {
          console.log('[Aggr/Binance] Liquidations connected');
          this.reconnectAttempts.set(key, 0);
        };

        liquidationsWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const order = data.o;
            if (!order) return;

            const liquidation: AggrLiquidation = {
              exchange: 'Binance',
              timestamp: data.E || Date.now(),
              price: parseFloat(order.p) || 0,
              amount: parseFloat(order.q) || 0,
              side: order.S === 'SELL' ? 'long' : 'short',
              usdValue: 0
            };
            liquidation.usdValue = liquidation.price * liquidation.amount;
            this.processLiquidation(liquidation);
          } catch (error) {
            console.error('[Aggr/Binance] Liquidation parse error:', error);
          }
        };

        liquidationsWs.onerror = (err) => console.error('[Aggr/Binance] Liquidations error:', err);

        liquidationsWs.onclose = (event) => {
          console.warn('[Aggr/Binance] Liquidations connection closed:', event.code, event.reason);
          this.reconnectWithBackoff(key, connectLiquidations);
        };

        this.wsConnections.set(key, liquidationsWs);
      } catch (error) {
        console.error('[Aggr/Binance] Liquidations connection failed:', error);
        this.reconnectWithBackoff('binance-liquidations', connectLiquidations);
      }
    };

    connectTrades();
    connectLiquidations();
  }

  /**
   * FIX #5: Reconnect with exponential backoff
   */
  private reconnectWithBackoff(key: string, connectFn: () => void): void {
    const attempts = (this.reconnectAttempts.get(key) || 0) + 1;
    this.reconnectAttempts.set(key, attempts);

    if (attempts > this.maxReconnectAttempts) {
      console.error(`[Aggr/${key}] Max reconnection attempts reached (${this.maxReconnectAttempts}). Giving up.`);
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
    console.log(`[Aggr/${key}] Reconnecting in ${delay}ms (attempt ${attempts}/${this.maxReconnectAttempts})`);

    const timeout = setTimeout(() => {
      console.log(`[Aggr/${key}] Attempting reconnection...`);
      connectFn();
    }, delay);

    this.reconnectTimeouts.set(key, timeout);
  }

  /**
   * Connect to OKX WebSocket
   */
  private connectOKX(): void {
    try {
      const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

      ws.onopen = () => {
        console.log('[Aggr/OKX] Connected');

        // Subscribe to BTC-USDT-SWAP trades
        ws.send(JSON.stringify({
          op: 'subscribe',
          args: [{
            channel: 'trades',
            instId: 'BTC-USDT-SWAP'
          }]
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.arg && data.arg.channel === 'trades' && data.data) {
            for (const tradeData of data.data) {
              const trade: AggrTrade = {
                exchange: 'OKX',
                timestamp: parseInt(tradeData.ts) || Date.now(),
                price: parseFloat(tradeData.px) || 0,
                amount: parseFloat(tradeData.sz) || 0,
                side: tradeData.side === 'sell' ? 'sell' : 'buy',
                isLiquidation: false,
                usdValue: 0
              };

              trade.usdValue = trade.price * trade.amount;
              this.processTrade(trade);
            }
          }
        } catch (error) {
          console.error('[Aggr/OKX] Parse error:', error);
        }
      };

      ws.onerror = (err) => console.error('[Aggr/OKX] Error:', err);

      this.wsConnections.set('okx', ws);
    } catch (error) {
      console.error('[Aggr/OKX] Connection failed:', error);
    }
  }

  /**
   * Connect to Bybit WebSocket
   */
  private connectBybit(): void {
    try {
      const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

      ws.onopen = () => {
        console.log('[Aggr/Bybit] Connected');

        // Subscribe to BTC publicTrade + liquidation
        ws.send(JSON.stringify({
          op: 'subscribe',
          args: ['publicTrade.BTCUSDT', 'liquidation.BTCUSDT']
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle trades
          if (data.topic === 'publicTrade.BTCUSDT' && data.data) {
            for (const tradeData of data.data) {
              const trade: AggrTrade = {
                exchange: 'Bybit',
                timestamp: parseInt(tradeData.T) || Date.now(),
                price: parseFloat(tradeData.p) || 0,
                amount: parseFloat(tradeData.v) || 0,
                side: tradeData.S === 'Sell' ? 'sell' : 'buy',
                isLiquidation: false,
                usdValue: 0
              };

              trade.usdValue = trade.price * trade.amount;
              this.processTrade(trade);
            }
          }

          // Handle liquidations
          if (data.topic === 'liquidation.BTCUSDT' && data.data) {
            const liqData = data.data;
            const liquidation: AggrLiquidation = {
              exchange: 'Bybit',
              timestamp: parseInt(liqData.updatedTime) || Date.now(),
              price: parseFloat(liqData.price) || 0,
              amount: parseFloat(liqData.size) || 0,
              side: liqData.side === 'Sell' ? 'long' : 'short',
              usdValue: 0
            };

            liquidation.usdValue = liquidation.price * liquidation.amount;
            this.processLiquidation(liquidation);
          }
        } catch (error) {
          console.error('[Aggr/Bybit] Parse error:', error);
        }
      };

      ws.onerror = (err) => console.error('[Aggr/Bybit] Error:', err);

      this.wsConnections.set('bybit', ws);
    } catch (error) {
      console.error('[Aggr/Bybit] Connection failed:', error);
    }
  }

  /**
   * Process incoming trade
   */
  private processTrade(trade: AggrTrade): void {
    this.trades.push(trade);

    // Keep only last 60 seconds
    const cutoff = Date.now() - 60000;
    this.trades = this.trades.filter(t => t.timestamp > cutoff);

    // Check if large trade (>$500K)
    if (trade.usdValue > 500000 && this.onLargeTrade) {
      this.onLargeTrade(trade);
    }
  }

  /**
   * Process liquidation event
   */
  private processLiquidation(liq: AggrLiquidation): void {
    this.liquidations.push(liq);

    // Keep only last 5 minutes
    const cutoff = Date.now() - 300000;
    this.liquidations = this.liquidations.filter(l => l.timestamp > cutoff);

    if (this.onLiquidation) {
      this.onLiquidation(liq);
    }

    // Check for cascade
    this.detectCascade(liq);
  }

  /**
   * Detect liquidation cascade
   */
  private detectCascade(liq: AggrLiquidation): void {
    const now = Date.now();
    const fiveMinAgo = now - 300000;

    // Reset cascade if it's been more than 5 minutes
    if (this.cascadeStartTime > 0 && now - this.cascadeStartTime > 300000) {
      this.cascadeStartTime = 0;
      this.cascadeVolume = 0;
      this.cascadeSide = null;
    }

    // Start new cascade or add to existing
    if (!this.cascadeSide || this.cascadeSide === liq.side) {
      if (!this.cascadeSide) {
        this.cascadeStartTime = liq.timestamp;
        this.cascadeSide = liq.side;
      }

      this.cascadeVolume += liq.usdValue;

      // Trigger cascade event based on severity
      if (this.cascadeVolume > 10000000) { // >$10M
        const severity: 'minor' | 'moderate' | 'major' | 'extreme' =
          this.cascadeVolume > 100000000 ? 'extreme' :
          this.cascadeVolume > 50000000 ? 'major' :
          this.cascadeVolume > 25000000 ? 'moderate' : 'minor';

        if (this.onCascade) {
          const recentLiqs = this.liquidations.filter(l =>
            l.timestamp >= this.cascadeStartTime && l.side === this.cascadeSide
          );

          const exchanges = [...new Set(recentLiqs.map(l => l.exchange))];

          this.onCascade({
            startTime: this.cascadeStartTime,
            endTime: now,
            totalLiquidated: this.cascadeVolume,
            side: this.cascadeSide,
            exchanges,
            priceImpact: 0, // Would need price history to calculate
            severity
          });
        }
      }
    }
  }

  /**
   * Calculate and broadcast statistics
   */
  private updateStats(): void {
    const now = Date.now();
    const oneMinAgo = now - 60000;

    // Filter to last 60 seconds
    const recentTrades = this.trades.filter(t => t.timestamp > oneMinAgo);

    if (recentTrades.length === 0) {
      // No data yet
      return;
    }

    // Calculate volumes
    const buyTrades = recentTrades.filter(t => t.side === 'buy');
    const sellTrades = recentTrades.filter(t => t.side === 'sell');

    const buyVolume = buyTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const totalVolume = buyVolume + sellVolume;

    // Update CVD
    const cvd = this.cvdWindow.add(buyVolume, sellVolume);

    // Calculate market pressure
    const pressure = this.calculatePressure();

    // Exchange breakdown
    const exchanges = this.calculateExchangeFlow(recentTrades);

    // Large trades
    const largeTrades = recentTrades.filter(t => t.usdValue > 500000);

    // Recent liquidations
    const fiveMinAgo = now - 300000;
    const recentLiquidations = this.liquidations.filter(l => l.timestamp > fiveMinAgo);
    const liquidationVolume = recentLiquidations.reduce((sum, l) => sum + l.usdValue, 0);

    // Build stats object
    const stats: AggrStats = {
      totalVolume,
      buyVolume,
      sellVolume,
      largeTradeCount: largeTrades.length,
      liquidationCount: recentLiquidations.length,
      liquidationVolume,
      cvd,
      pressure,
      exchanges,
      recentLiquidations: recentLiquidations.slice(-10),
      recentLargeTrades: largeTrades.slice(-10)
    };

    // Broadcast to subscribers
    if (this.onStatsUpdate) {
      this.onStatsUpdate(stats);
    }
  }

  /**
   * Calculate market pressure metrics
   */
  private calculatePressure(): MarketPressure {
    const now = Date.now();
    const oneMinAgo = now - 60000;

    const recentTrades = this.trades.filter(t => t.timestamp > oneMinAgo);
    const buyTrades = recentTrades.filter(t => t.side === 'buy');
    const sellTrades = recentTrades.filter(t => t.side === 'sell');

    const buyVolume = buyTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const totalVolume = buyVolume + sellVolume;

    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
    const sellPressure = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;
    const netPressure = buyPressure - sellPressure;

    // Determine dominant side
    let dominantSide: 'buy' | 'sell' | 'neutral' = 'neutral';
    if (Math.abs(netPressure) > 10) {
      dominantSide = netPressure > 0 ? 'buy' : 'sell';
    }

    // Determine strength
    const absNetPressure = Math.abs(netPressure);
    const strength: 'weak' | 'moderate' | 'strong' | 'extreme' =
      absNetPressure > 40 ? 'extreme' :
      absNetPressure > 25 ? 'strong' :
      absNetPressure > 10 ? 'moderate' : 'weak';

    return {
      buyPressure,
      sellPressure,
      netPressure,
      dominantSide,
      strength
    };
  }

  /**
   * Calculate exchange flow breakdown
   */
  private calculateExchangeFlow(trades: AggrTrade[]): ExchangeFlow[] {
    const exchangeMap = new Map<string, { buy: number, sell: number }>();

    for (const trade of trades) {
      if (!exchangeMap.has(trade.exchange)) {
        exchangeMap.set(trade.exchange, { buy: 0, sell: 0 });
      }

      const flow = exchangeMap.get(trade.exchange)!;
      if (trade.side === 'buy') {
        flow.buy += trade.usdValue;
      } else {
        flow.sell += trade.usdValue;
      }
    }

    const totalVolume = trades.reduce((sum, t) => sum + t.usdValue, 0);

    const flows: ExchangeFlow[] = [];
    for (const [exchange, flow] of exchangeMap) {
      const exchangeVolume = flow.buy + flow.sell;
      flows.push({
        exchange,
        buyVolume: flow.buy,
        sellVolume: flow.sell,
        netFlow: flow.buy - flow.sell,
        dominance: totalVolume > 0 ? (exchangeVolume / totalVolume) * 100 : 0
      });
    }

    // Sort by dominance
    flows.sort((a, b) => b.dominance - a.dominance);

    return flows;
  }

  /**
   * FIX #5: Disconnect from all exchanges and clear reconnection timers
   */
  disconnect(): void {
    console.log('[Aggr] Disconnecting from all exchanges...');

    // Clear all reconnection timeouts
    for (const [key, timeout] of this.reconnectTimeouts) {
      clearTimeout(timeout);
      console.log(`[Aggr] Cleared reconnection timeout for ${key}`);
    }
    this.reconnectTimeouts.clear();
    this.reconnectAttempts.clear();

    // Close all WebSocket connections
    for (const [name, ws] of this.wsConnections) {
      ws.close();
      console.log(`[Aggr] Disconnected from ${name}`);
    }

    this.wsConnections.clear();
    this.isConnected = false;
  }

  /**
   * Get current stats
   */
  getStats(): AggrStats | null {
    // Return latest stats (would be updated by updateStats interval)
    const now = Date.now();
    const oneMinAgo = now - 60000;
    const recentTrades = this.trades.filter(t => t.timestamp > oneMinAgo);

    if (recentTrades.length === 0) return null;

    const buyTrades = recentTrades.filter(t => t.side === 'buy');
    const sellTrades = recentTrades.filter(t => t.side === 'sell');
    const buyVolume = buyTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.usdValue, 0);

    return {
      totalVolume: buyVolume + sellVolume,
      buyVolume,
      sellVolume,
      largeTradeCount: recentTrades.filter(t => t.usdValue > 500000).length,
      liquidationCount: this.liquidations.length,
      liquidationVolume: this.liquidations.reduce((sum, l) => sum + l.usdValue, 0),
      cvd: this.cvdWindow.latest || {
        timestamp: now,
        buyVolume: 0,
        sellVolume: 0,
        delta: 0,
        cumulativeDelta: 0
      },
      pressure: this.calculatePressure(),
      exchanges: this.calculateExchangeFlow(recentTrades),
      recentLiquidations: this.liquidations.slice(-10),
      recentLargeTrades: recentTrades.filter(t => t.usdValue > 500000).slice(-10)
    };
  }

  /**
   * Set event handlers
   */
  onLiquidationEvent(handler: (liq: AggrLiquidation) => void): void {
    this.onLiquidation = handler;
  }

  onLargeTradeEvent(handler: (trade: AggrTrade) => void): void {
    this.onLargeTrade = handler;
  }

  onCascadeEvent(handler: (cascade: CascadeEvent) => void): void {
    this.onCascade = handler;
  }
}

// Export singleton instance
export const aggrService = new AggrTradeService();

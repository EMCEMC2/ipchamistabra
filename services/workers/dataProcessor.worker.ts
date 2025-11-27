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

  constructor(maxSize: number = 60, resetHour: number = 0) {
    this.maxSize = maxSize;
    this.resetHour = resetHour;
  }

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
  private liquidations: AggrLiquidation[] = [];
  private cvdWindow: RollingWindow = new RollingWindow(60);
  
  // Cascade detection
  private cascadeStartTime: number = 0;
  private cascadeVolume: number = 0;
  private cascadeSide: 'long' | 'short' | null = null;

  // Reconnection
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private maxReconnectAttempts: number = 10;

  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.log('DataProcessor initialized');
  }

  private log(message: string) {
    self.postMessage({ type: 'DEBUG_LOG', payload: { message } });
  }

  public connect() {
    this.log('Starting connections...');
    this.connectBinance();
    this.connectOKX();
    this.connectBybit();

    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(() => this.broadcastStats(), 1000);
  }

  public disconnect() {
    this.log('Disconnecting...');
    // Clear timeouts
    for (const [_, timeout] of this.reconnectTimeouts) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();
    this.reconnectAttempts.clear();

    // Close WS
    for (const [_, ws] of this.wsConnections) {
      ws.close();
    }
    this.wsConnections.clear();

    if (this.updateInterval) clearInterval(this.updateInterval);
  }

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

    // Update CVD
    const cvd = this.cvdWindow.add(buyVolume, sellVolume);

    // Pressure
    const pressure = this.calculatePressure(recentTrades);

    // Exchange Flow
    const exchanges = this.calculateExchangeFlow(recentTrades);

    // Large Trades & Liquidations
    const largeTrades = recentTrades.filter(t => t.usdValue > 500000);
    const fiveMinAgo = now - 300000;
    const recentLiquidations = this.liquidations.filter(l => l.timestamp > fiveMinAgo);
    const liquidationVolume = recentLiquidations.reduce((sum, l) => sum + l.usdValue, 0);

    return {
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
  }

  private calculatePressure(recentTrades: AggrTrade[]): MarketPressure {
    const buyTrades = recentTrades.filter(t => t.side === 'buy');
    const sellTrades = recentTrades.filter(t => t.side === 'sell');
    const buyVolume = buyTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.usdValue, 0);
    const totalVolume = buyVolume + sellVolume;

    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
    const sellPressure = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;
    const netPressure = buyPressure - sellPressure;

    let dominantSide: 'buy' | 'sell' | 'neutral' = 'neutral';
    if (Math.abs(netPressure) > 10) dominantSide = netPressure > 0 ? 'buy' : 'sell';

    const absNetPressure = Math.abs(netPressure);
    const strength = absNetPressure > 40 ? 'extreme' : absNetPressure > 25 ? 'strong' : absNetPressure > 10 ? 'moderate' : 'weak';

    return { buyPressure, sellPressure, netPressure, dominantSide, strength };
  }

  private calculateExchangeFlow(trades: AggrTrade[]): ExchangeFlow[] {
    const exchangeMap = new Map<string, { buy: number, sell: number }>();
    for (const trade of trades) {
      if (!exchangeMap.has(trade.exchange)) exchangeMap.set(trade.exchange, { buy: 0, sell: 0 });
      const flow = exchangeMap.get(trade.exchange)!;
      if (trade.side === 'buy') flow.buy += trade.usdValue;
      else flow.sell += trade.usdValue;
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
    return flows.sort((a, b) => b.dominance - a.dominance);
  }

  // --- WebSocket Connection Logic ---

  private connectBinance() {
    const connectTrades = () => {
        this.log('Connecting to Binance Trades...');
        const ws = new WebSocket('wss://fstream.binance.com/ws/btcusdt@aggTrade');
        ws.onopen = () => this.log('Binance Trades Connected');
        ws.onmessage = (e) => {
            // this.log('Binance Message Received'); // Too noisy
            try {
                const data = JSON.parse(e.data);
                const trade: AggrTrade = {
                    exchange: 'Binance',
                    timestamp: data.T,
                    price: parseFloat(data.p),
                    amount: parseFloat(data.q),
                    side: data.m ? 'sell' : 'buy',
                    isLiquidation: false,
                    usdValue: parseFloat(data.p) * parseFloat(data.q)
                };
                this.processTrade(trade);
            } catch (err) {
                this.log(`Binance Parse Error: ${err}`);
            }
        };
        ws.onclose = () => {
            this.log('Binance Trades Closed');
            this.reconnectWithBackoff('binance-trades', connectTrades);
        };
        ws.onerror = (e) => this.log('Binance Trades Error');
        this.wsConnections.set('binance-trades', ws);
    };

    const connectLiq = () => {
        this.log('Connecting to Binance Liquidations...');
        const ws = new WebSocket('wss://fstream.binance.com/ws/btcusdt@forceOrder');
        ws.onopen = () => this.log('Binance Liq Connected');
        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                const o = data.o;
                const liq: AggrLiquidation = {
                    exchange: 'Binance',
                    timestamp: data.E,
                    price: parseFloat(o.p),
                    amount: parseFloat(o.q),
                    side: o.S === 'SELL' ? 'long' : 'short',
                    usdValue: parseFloat(o.p) * parseFloat(o.q)
                };
                this.processLiquidation(liq);
            } catch (err) {}
        };
        ws.onclose = () => this.reconnectWithBackoff('binance-liq', connectLiq);
        this.wsConnections.set('binance-liq', ws);
    };

    connectTrades();
    connectLiq();
  }

  private connectOKX() {
      const connect = () => {
          this.log('Connecting to OKX...');
          const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
          ws.onopen = () => {
              this.log('OKX Connected');
              ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'trades', instId: 'BTC-USDT-SWAP' }] }));
          };
          ws.onmessage = (e) => {
              try {
                  const data = JSON.parse(e.data);
                  if (data.data) {
                      data.data.forEach((d: any) => {
                          const trade: AggrTrade = {
                              exchange: 'OKX',
                              timestamp: parseInt(d.ts),
                              price: parseFloat(d.px),
                              amount: parseFloat(d.sz),
                              side: d.side === 'sell' ? 'sell' : 'buy',
                              isLiquidation: false,
                              usdValue: parseFloat(d.px) * parseFloat(d.sz) // Note: OKX size might need conversion depending on contract
                          };
                          this.processTrade(trade);
                      });
                  }
              } catch (err) {}
          };
          ws.onclose = () => {
              this.log('OKX Closed');
              this.reconnectWithBackoff('okx', connect);
          };
          this.wsConnections.set('okx', ws);
      };
      connect();
  }

  private connectBybit() {
      const connect = () => {
          this.log('Connecting to Bybit...');
          const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
          ws.onopen = () => {
              this.log('Bybit Connected');
              ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT', 'liquidation.BTCUSDT'] }));
          };
          ws.onmessage = (e) => {
              try {
                  const data = JSON.parse(e.data);
                  if (data.topic === 'publicTrade.BTCUSDT' && data.data) {
                      data.data.forEach((d: any) => {
                          const trade: AggrTrade = {
                              exchange: 'Bybit',
                              timestamp: parseInt(d.T),
                              price: parseFloat(d.p),
                              amount: parseFloat(d.v),
                              side: d.S === 'Sell' ? 'sell' : 'buy',
                              isLiquidation: false,
                              usdValue: parseFloat(d.p) * parseFloat(d.v)
                          };
                          this.processTrade(trade);
                      });
                  }
                  if (data.topic === 'liquidation.BTCUSDT' && data.data) {
                      const d = data.data;
                      const liq: AggrLiquidation = {
                          exchange: 'Bybit',
                          timestamp: parseInt(d.updatedTime),
                          price: parseFloat(d.price),
                          amount: parseFloat(d.size),
                          side: d.side === 'Sell' ? 'long' : 'short',
                          usdValue: parseFloat(d.price) * parseFloat(d.size)
                          // usdValue: parseFloat(d.price) * parseFloat(d.size)
                      };
                      this.processLiquidation(liq);
                  }
              } catch (err) {}
          };
          ws.onclose = () => {
              this.log('Bybit Closed');
              this.reconnectWithBackoff('bybit', connect);
          };
          this.wsConnections.set('bybit', ws);
      };
      connect();
  }

  private reconnectWithBackoff(key: string, connectFn: () => void) {
      const attempts = (this.reconnectAttempts.get(key) || 0) + 1;
      this.reconnectAttempts.set(key, attempts);
      if (attempts > this.maxReconnectAttempts) return;
      const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
      const timeout = setTimeout(connectFn, delay);
      this.reconnectTimeouts.set(key, timeout);
  }

  private processTrade(trade: AggrTrade) {
      this.trades.push(trade);
      
      // Throttled log to confirm data flow
      if (this.trades.length % 100 === 0) {
        this.log(`Processed ${this.trades.length} trades. Latest: $${trade.price}`);
      }

      const cutoff = Date.now() - 60000;
      if (this.trades[0] && this.trades[0].timestamp < cutoff) {
          // Optimization: remove old trades in chunks or use a pointer
          this.trades = this.trades.filter(t => t.timestamp > cutoff);
      }

      if (trade.usdValue > 500000) {
          self.postMessage({ type: 'LARGE_TRADE_EVENT', payload: { trade } });
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

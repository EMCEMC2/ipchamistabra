/**
 * ORDER FLOW INTELLIGENCE SERVICE
 * Fetches enhanced market data via REST API endpoints
 * - Open Interest
 * - Long/Short Ratio
 * - Funding Rate
 * - Aggregated Trades for CVD calculation
 * - Liquidations
 */

import {
  AggrStats,
  AggrTrade,
  AggrLiquidation,
  CVDData,
  MarketPressure,
  ExchangeFlow,
  OpenInterestData,
  LongShortRatio,
  FundingData
} from '../types/aggrTypes';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Whale threshold lowered to $100K for more activity
const WHALE_THRESHOLD = 100000;

class OrderFlowIntelService {
  private lastStats: AggrStats | null = null;
  private lastOpenInterest: OpenInterestData | null = null;
  private updateCallbacks: Array<(stats: AggrStats) => void> = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private oiPollInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor() {
    console.log('[OrderFlowIntel] Service initialized');
  }

  async connect(onStatsUpdate?: (stats: AggrStats) => void): Promise<void> {
    if (onStatsUpdate) {
      this.updateCallbacks.push(onStatsUpdate);
    }

    if (this.isConnected) return;
    this.isConnected = true;

    console.log('[OrderFlowIntel] Connecting...');

    // Initial fetch
    await this.fetchAllData();

    // Poll aggregated trades every 2 seconds
    this.pollInterval = setInterval(() => this.fetchTradeData(), 2000);

    // Poll OI/LS ratio/funding every 30 seconds
    this.oiPollInterval = setInterval(() => this.fetchEnhancedData(), 30000);
  }

  disconnect(): void {
    console.log('[OrderFlowIntel] Disconnecting...');
    this.isConnected = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.oiPollInterval) {
      clearInterval(this.oiPollInterval);
      this.oiPollInterval = null;
    }

    this.updateCallbacks = [];
  }

  private async fetchAllData(): Promise<void> {
    await Promise.all([
      this.fetchTradeData(),
      this.fetchEnhancedData()
    ]);
  }

  private async fetchTradeData(): Promise<void> {
    try {
      const [tradesRes, liqsRes] = await Promise.all([
        fetch(`${API_BASE}/api/orderflow/agg-trades`),
        fetch(`${API_BASE}/api/orderflow/liquidations`)
      ]);

      const trades = await tradesRes.json();
      const liquidations = await liqsRes.json();

      if (Array.isArray(trades)) {
        const stats = this.processTradeData(trades, Array.isArray(liquidations) ? liquidations : []);
        this.broadcastStats(stats);
      }
    } catch (error) {
      console.error('[OrderFlowIntel] Failed to fetch trade data:', error);
    }
  }

  private async fetchEnhancedData(): Promise<void> {
    try {
      const [oiRes, lsRes, topRes, fundingRes, takerRes] = await Promise.all([
        fetch(`${API_BASE}/api/orderflow/open-interest`),
        fetch(`${API_BASE}/api/orderflow/long-short-ratio`),
        fetch(`${API_BASE}/api/orderflow/top-trader-ratio`),
        fetch(`${API_BASE}/api/orderflow/funding-rate`),
        fetch(`${API_BASE}/api/orderflow/taker-volume`)
      ]);

      const oi = await oiRes.json();
      const ls = await lsRes.json();
      const top = await topRes.json();
      const funding = await fundingRes.json();

      // Process Open Interest
      if (oi && oi.openInterest) {
        const newOI: OpenInterestData = {
          openInterest: parseFloat(oi.openInterest),
          openInterestUsd: parseFloat(oi.openInterest) * (this.lastStats?.cvd?.buyVolume || 0) / 1000000 || 0,
          change1h: this.calculateOIChange(parseFloat(oi.openInterest)),
          timestamp: Date.now()
        };

        // Get current price for USD calculation
        if (this.lastStats) {
          this.lastStats.openInterest = newOI;
        }
        this.lastOpenInterest = newOI;
      }

      // Process Long/Short Ratio
      if (Array.isArray(ls) && ls.length > 0) {
        const lsData = ls[0];
        const topData = Array.isArray(top) && top.length > 0 ? top[0] : null;

        const ratio: LongShortRatio = {
          longRatio: parseFloat(lsData.longAccount) * 100,
          shortRatio: parseFloat(lsData.shortAccount) * 100,
          longShortRatio: parseFloat(lsData.longShortRatio),
          topTraderRatio: topData ? parseFloat(topData.longShortRatio) : 1,
          timestamp: parseInt(lsData.timestamp)
        };

        if (this.lastStats) {
          this.lastStats.longShortRatio = ratio;
        }
      }

      // Process Funding Rate
      if (Array.isArray(funding) && funding.length > 0) {
        const fr = funding[0];
        const rate = parseFloat(fr.fundingRate);

        const fundingData: FundingData = {
          rate: rate,
          predictedRate: rate, // API doesn't provide predicted
          nextFundingTime: parseInt(fr.fundingTime),
          annualizedRate: rate * 3 * 365 * 100 // 3 fundings per day
        };

        if (this.lastStats) {
          this.lastStats.funding = fundingData;
        }
      }

      // Broadcast updated stats with enhanced data
      if (this.lastStats) {
        this.broadcastStats(this.lastStats);
      }
    } catch (error) {
      console.error('[OrderFlowIntel] Failed to fetch enhanced data:', error);
    }
  }

  private calculateOIChange(currentOI: number): number {
    if (!this.lastOpenInterest) return 0;
    const change = ((currentOI - this.lastOpenInterest.openInterest) / this.lastOpenInterest.openInterest) * 100;
    return change;
  }

  private processTradeData(trades: any[], liquidations: any[]): AggrStats {
    const now = Date.now();
    const oneMinAgo = now - 60000;

    // Process trades
    let buyVolume = 0;
    let sellVolume = 0;
    const largeTrades: AggrTrade[] = [];
    const exchangeMap = new Map<string, { buy: number; sell: number }>();

    for (const trade of trades) {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.q);
      const usdValue = price * qty;
      const isBuy = !trade.m; // m=true means maker is buy, so taker is sell

      if (isBuy) {
        buyVolume += usdValue;
      } else {
        sellVolume += usdValue;
      }

      // Track exchange flow (all from Binance Futures via API)
      if (!exchangeMap.has('Binance')) {
        exchangeMap.set('Binance', { buy: 0, sell: 0 });
      }
      const flow = exchangeMap.get('Binance')!;
      if (isBuy) flow.buy += usdValue;
      else flow.sell += usdValue;

      // Whale detection (lowered to $100K)
      if (usdValue >= WHALE_THRESHOLD) {
        largeTrades.push({
          exchange: 'Binance',
          timestamp: trade.T,
          price,
          amount: qty,
          side: isBuy ? 'buy' : 'sell',
          isLiquidation: false,
          usdValue
        });
      }
    }

    const totalVolume = buyVolume + sellVolume;

    // Calculate CVD
    const cvd: CVDData = {
      timestamp: now,
      buyVolume,
      sellVolume,
      delta: buyVolume - sellVolume,
      cumulativeDelta: (this.lastStats?.cvd?.cumulativeDelta || 0) + (buyVolume - sellVolume)
    };

    // Calculate pressure
    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
    const sellPressure = 100 - buyPressure;
    const netPressure = buyPressure - sellPressure;
    const absNet = Math.abs(netPressure);

    const pressure: MarketPressure = {
      buyPressure,
      sellPressure,
      netPressure,
      dominantSide: absNet > 10 ? (netPressure > 0 ? 'buy' : 'sell') : 'neutral',
      strength: absNet > 40 ? 'extreme' : absNet > 25 ? 'strong' : absNet > 10 ? 'moderate' : 'weak'
    };

    // Exchange flow
    const exchanges: ExchangeFlow[] = [];
    for (const [exchange, flow] of exchangeMap) {
      const vol = flow.buy + flow.sell;
      exchanges.push({
        exchange,
        buyVolume: flow.buy,
        sellVolume: flow.sell,
        netFlow: flow.buy - flow.sell,
        dominance: totalVolume > 0 ? (vol / totalVolume) * 100 : 0
      });
    }

    // Process liquidations
    const recentLiquidations: AggrLiquidation[] = [];
    let liquidationVolume = 0;

    if (Array.isArray(liquidations)) {
      for (const liq of liquidations) {
        const price = parseFloat(liq.price);
        const qty = parseFloat(liq.origQty || liq.executedQty || liq.qty || '0');
        const usdValue = price * qty;

        if (usdValue > 0) {
          liquidationVolume += usdValue;
          recentLiquidations.push({
            exchange: 'Binance',
            timestamp: liq.time || Date.now(),
            price,
            amount: qty,
            side: liq.side === 'SELL' ? 'long' : 'short',
            usdValue
          });
        }
      }
    }

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
      recentLargeTrades: largeTrades.slice(-10),
      // Preserve enhanced data
      openInterest: this.lastStats?.openInterest,
      longShortRatio: this.lastStats?.longShortRatio,
      funding: this.lastStats?.funding
    };

    this.lastStats = stats;
    return stats;
  }

  private broadcastStats(stats: AggrStats): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(stats);
      } catch (error) {
        console.error('[OrderFlowIntel] Callback error:', error);
      }
    }
  }

  getStats(): AggrStats | null {
    return this.lastStats;
  }
}

export const orderFlowIntel = new OrderFlowIntelService();

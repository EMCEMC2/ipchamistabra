/**
 * ORDER FLOW INTELLIGENCE SERVICE
 * Fetches enhanced market data directly from Binance public API
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

// Direct Binance API (public endpoints work from browser)
const BINANCE_FUTURES = 'https://fapi.binance.com';

// Whale threshold set to $500K for significant trades only
const WHALE_THRESHOLD = 500000;

// Liquidation history retention (10 minutes)
const LIQUIDATION_HISTORY_MS = 10 * 60 * 1000;

class OrderFlowIntelService {
  private lastStats: AggrStats | null = null;
  private lastOpenInterest: OpenInterestData | null = null;
  private updateCallbacks: Array<(stats: AggrStats) => void> = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private oiPollInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private isBanned: boolean = false;
  private banExpiryTime: number = 0;

  // Liquidation history cache (persists across polls for 10 mins)
  private liquidationHistory: AggrLiquidation[] = [];
  // Whale trade history cache (persists across polls for 10 mins)
  private whaleHistory: AggrTrade[] = [];

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

    // Poll aggregated trades every 10 seconds (was 2s - caused IP ban)
    this.pollInterval = setInterval(() => this.fetchTradeData(), 10000);

    // Poll OI/LS ratio/funding every 60 seconds (was 30s)
    this.oiPollInterval = setInterval(() => this.fetchEnhancedData(), 60000);
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
      // Check if we're still banned
      if (this.isBanned && Date.now() < this.banExpiryTime) {
        const remainingMinutes = Math.ceil((this.banExpiryTime - Date.now()) / 60000);
        console.log(`[OrderFlowIntel] Still banned. ${remainingMinutes} minutes remaining.`);
        this.broadcastEmptyStats();
        return;
      }

      // Reset ban status if time has passed
      if (this.isBanned && Date.now() >= this.banExpiryTime) {
        console.log('[OrderFlowIntel] Ban expired. Resuming data fetch...');
        this.isBanned = false;
        this.banExpiryTime = 0;
      }

      const endTime = Date.now();
      const startTime = endTime - 60000; // 1 minute of trades

      const [tradesRes, liqsRes] = await Promise.all([
        fetch(`${BINANCE_FUTURES}/fapi/v1/aggTrades?symbol=BTCUSDT&startTime=${startTime}&endTime=${endTime}&limit=1000`),
        fetch(`${BINANCE_FUTURES}/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=50`)
      ]);

      const trades = await tradesRes.json();
      const liquidations = await liqsRes.json();

      // Check for API ban
      if (trades.code === -1003) {
        // Validate timestamp extraction from error message
        const timestampMatch = trades.msg.match(/\d{13}/);

        if (!timestampMatch) {
          console.error('[OrderFlowIntel] Unable to parse ban expiry time from message:', trades.msg);
          const defaultBanEnd = Date.now() + 3600000; // 1 hour default
          const banUntil = new Date(defaultBanEnd);
          this.isBanned = true;
          this.banExpiryTime = defaultBanEnd;
          const remainingMinutes = Math.ceil((defaultBanEnd - Date.now()) / 60000);
          console.error(`[OrderFlowIntel] IP BANNED until ${banUntil.toLocaleString()} (default 1 hour). ${remainingMinutes} minutes remaining.`);
          this.broadcastEmptyStats(defaultBanEnd);
          return;
        }

        const banUntilMs = parseInt(timestampMatch[0]);
        const banUntil = new Date(banUntilMs);
        this.isBanned = true;
        this.banExpiryTime = banUntilMs;
        const remainingMinutes = Math.ceil((banUntilMs - Date.now()) / 60000);
        console.error(`[OrderFlowIntel] IP BANNED until ${banUntil.toLocaleString()}. ${remainingMinutes} minutes remaining.`);
        // Broadcast stats with ban information to notify UI
        this.broadcastEmptyStats(banUntilMs);
        return;
      }

      if (Array.isArray(trades)) {
        const stats = this.processTradeData(trades, Array.isArray(liquidations) ? liquidations : []);
        this.broadcastStats(stats);
      }
    } catch (error) {
      console.error('[OrderFlowIntel] Failed to fetch trade data:', error);
      // Broadcast empty stats to unblock UI
      this.broadcastEmptyStats();
    }
  }

  private broadcastEmptyStats(bannedUntil?: number): void {
    const emptyStats: AggrStats = {
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
      largeTradeCount: 0,
      liquidationCount: 0,
      liquidationVolume: 0,
      cvd: { timestamp: Date.now(), buyVolume: 0, sellVolume: 0, delta: 0, cumulativeDelta: 0 },
      pressure: { buyPressure: 50, sellPressure: 50, netPressure: 0, dominantSide: 'neutral', strength: 'weak' },
      exchanges: [],
      recentLiquidations: [],
      recentLargeTrades: [],
      banned: bannedUntil ? {
        isBanned: true,
        expiryTime: bannedUntil,
        remainingMinutes: Math.ceil((bannedUntil - Date.now()) / 60000)
      } : undefined
    };
    this.lastStats = emptyStats;
    this.broadcastStats(emptyStats);
  }

  private async fetchEnhancedData(): Promise<void> {
    try {
      const [oiRes, lsRes, topRes, fundingRes] = await Promise.all([
        fetch(`${BINANCE_FUTURES}/fapi/v1/openInterest?symbol=BTCUSDT`),
        fetch(`${BINANCE_FUTURES}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1`),
        fetch(`${BINANCE_FUTURES}/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=5m&limit=1`),
        fetch(`${BINANCE_FUTURES}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1`)
      ]);

      const oi = await oiRes.json();
      const ls = await lsRes.json();
      const top = await topRes.json();
      const funding = await fundingRes.json();

      // Process Open Interest
      if (oi && oi.openInterest) {
        const currentOI = parseFloat(oi.openInterest);

        // Guard against NaN from malformed API response
        if (isNaN(currentOI) || currentOI < 0) {
          console.warn('[OrderFlowIntel] Invalid OI data, skipping update:', oi.openInterest);
        } else {
          // Get current BTC price from recent trades/liquidations
          const btcPrice = this.lastStats?.recentLargeTrades?.[0]?.price
            || this.lastStats?.recentLiquidations?.[0]?.price
            || 95000; // Fallback to approximate price if no trades yet

          const newOI: OpenInterestData = {
            openInterest: currentOI,
            openInterestUsd: currentOI * btcPrice,
            change1h: this.calculateOIChange(currentOI),
            timestamp: Date.now()
          };

          // Get current price for USD calculation
          if (this.lastStats) {
            this.lastStats.openInterest = newOI;
          }
          this.lastOpenInterest = newOI;
        }
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

        // Guard against NaN from malformed API response
        if (isNaN(rate)) {
          console.warn('[OrderFlowIntel] Invalid funding rate, skipping update:', fr.fundingRate);
        } else {
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
    const cutoffTime = now - LIQUIDATION_HISTORY_MS;

    // Prune old entries from history caches
    this.liquidationHistory = this.liquidationHistory.filter(l => l.timestamp > cutoffTime);
    this.whaleHistory = this.whaleHistory.filter(t => t.timestamp > cutoffTime);

    // Process trades
    let buyVolume = 0;
    let sellVolume = 0;
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

      // Whale detection ($500K+) - add to history if not already present
      if (usdValue >= WHALE_THRESHOLD) {
        const exists = this.whaleHistory.some(t =>
          t.timestamp === trade.T && Math.abs(t.usdValue - usdValue) < 1
        );

        if (!exists) {
          this.whaleHistory.push({
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

    // Process liquidations - add new ones to history
    let liquidationVolume = 0;

    if (Array.isArray(liquidations) && liquidations.length > 0) {
      for (const liq of liquidations) {
        const price = parseFloat(liq.price || liq.p || '0');
        const qty = parseFloat(liq.origQty || liq.executedQty || liq.qty || liq.q || '0');
        const usdValue = price * qty;
        const liqTime = liq.time || liq.T || Date.now();

        if (usdValue > 0) {
          // Check if this liquidation already exists in history
          const exists = this.liquidationHistory.some(l =>
            l.timestamp === liqTime && Math.abs(l.usdValue - usdValue) < 1
          );

          if (!exists) {
            this.liquidationHistory.push({
              exchange: 'Binance',
              timestamp: liqTime,
              price,
              amount: qty,
              side: liq.side === 'SELL' ? 'long' : 'short',
              usdValue
            });
          }
        }
      }
    }

    // Calculate total liquidation volume from history
    liquidationVolume = this.liquidationHistory.reduce((sum, l) => sum + l.usdValue, 0);

    // Sort by timestamp descending (most recent first)
    const sortedLiquidations = [...this.liquidationHistory].sort((a, b) => b.timestamp - a.timestamp);
    const sortedWhales = [...this.whaleHistory].sort((a, b) => b.timestamp - a.timestamp);

    const stats: AggrStats = {
      totalVolume,
      buyVolume,
      sellVolume,
      largeTradeCount: this.whaleHistory.length,
      liquidationCount: this.liquidationHistory.length,
      liquidationVolume,
      cvd,
      pressure,
      exchanges,
      recentLiquidations: sortedLiquidations.slice(0, 10),
      recentLargeTrades: sortedWhales.slice(0, 10),
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

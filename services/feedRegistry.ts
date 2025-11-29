import { z } from 'zod';

export type FeedType = 'raw' | 'derived' | 'composite';
export type FeedStatus = 'fresh' | 'stale' | 'error' | 'connecting';

export interface FeedSourceInfo {
  id: string;
  name: string;
  source: string;
  method: string;
  description: string;
  url: string | null;
  dataType: FeedType;
  derivedFrom?: string[];
  refreshInterval: string; // Human readable
  critical: boolean;
  maxStalenessMs: number;
}

export interface FeedState {
  id: string;
  status: FeedStatus;
  lastUpdated: number;
  lastGoodData: number | null;
  error?: string;
  value?: any; // Current value if applicable (e.g. sentiment score)
}

export const FEED_SOURCES: Record<string, FeedSourceInfo> = {
  binancePrice: {
    id: 'binancePrice',
    name: 'Binance Price',
    source: 'Binance',
    method: 'WebSocket',
    description: 'Real-time BTC/USDT price',
    url: 'https://www.binance.com/en/trade/BTC_USDT',
    dataType: 'raw',
    refreshInterval: 'Real-time',
    critical: true,
    maxStalenessMs: 5000,
  },
  orderFlow: {
    id: 'orderFlow',
    name: 'Order Flow',
    source: 'Aggr.trade',
    method: 'WebSocket',
    description: 'Real-time CVD, liquidations, whale trades',
    url: 'https://aggr.trade',
    dataType: 'raw',
    refreshInterval: 'Real-time',
    critical: true,
    maxStalenessMs: 5000,
  },
  funding: {
    id: 'funding',
    name: 'Funding Rate',
    source: 'Binance',
    method: 'REST API',
    description: 'Perpetual futures funding rate',
    url: 'https://www.binance.com/en/futures/funding-history/1',
    dataType: 'raw',
    refreshInterval: 'Every 60s',
    critical: false,
    maxStalenessMs: 120000, // 2 mins
  },
  sentiment: {
    id: 'sentiment',
    name: 'Sentiment Score',
    source: 'Computed',
    method: 'Weighted Average',
    description: 'Combined sentiment from multiple sources',
    url: null,
    dataType: 'composite',
    derivedFrom: ['fearGreed', 'funding', 'longShort'],
    refreshInterval: 'On component update',
    critical: false,
    maxStalenessMs: 300000, // 5 mins
  },
  regime: {
    id: 'regime',
    name: 'Market Regime',
    source: 'Local Analysis',
    method: 'Vol/Trend Logic',
    description: 'Volatility and trend regime classification',
    url: null,
    dataType: 'derived',
    derivedFrom: ['price', 'volume'],
    refreshInterval: 'Every candle close',
    critical: true,
    maxStalenessMs: 60000, // 1 min (approx candle time)
  },
};

export const getInitialFeedState = (): Record<string, FeedState> => {
  const state: Record<string, FeedState> = {};
  Object.values(FEED_SOURCES).forEach(source => {
    state[source.id] = {
      id: source.id,
      status: 'connecting',
      lastUpdated: 0,
      lastGoodData: null,
    };
  });
  return state;
};

export const checkFeedHealth = (feed: FeedState, now: number = Date.now()): FeedStatus => {
  const config = FEED_SOURCES[feed.id];
  if (!config) return 'error';

  if (feed.error) return 'error';
  if (feed.lastUpdated === 0) return 'connecting';
  
  if (now - feed.lastUpdated > config.maxStalenessMs) {
    return 'stale';
  }
  
  return 'fresh';
};

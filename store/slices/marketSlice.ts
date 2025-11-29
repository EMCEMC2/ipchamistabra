/**
 * Market Slice
 * Handles price, chart data, technicals, and market metrics
 */

import { StateCreator } from 'zustand';
import { ChartDataPoint, TradeSignal, IntelItem } from '../../types';
import { EnhancedBTCMetrics } from '../../services/macroDataService';
import { FeedState, getInitialFeedState } from '../../services/feedRegistry';

// Default enhanced metrics
export const defaultEnhancedMetrics: EnhancedBTCMetrics = {
  dvol: 0,
  atr14d: 0,
  todayRange: 0,
  rangeVsAtr: 0,
  volume24h: 0,
  volumeAvg30d: 0,
  volumeRatio: 1,
  volumeTag: 'NORMAL',
  fundingRate: 0,
  fundingTrend: 'STABLE',
  openInterest: 0,
  oiChange24h: 0,
  distanceToHigh24h: 0,
  distanceToLow24h: 0,
  above200dMA: false,
  ma200: 0,
  fearGreedIndex: 0,
  fearGreedLabel: 'N/A',
  btcDominance: 0
};

export interface MarketState {
  // Price data
  price: number;
  priceChange: number;
  lastPriceUpdate: number;

  // Macro indicators
  vix: number;
  dxy: number;
  btcd: number;

  // Sentiment
  sentimentScore: number;
  sentimentLabel: string;

  // Derivatives
  derivatives: {
    openInterest: string;
    fundingRate: string;
    longShortRatio: number;
  };

  // Intel feed
  intel: IntelItem[];

  // Trends
  trends: {
    price: 'up' | 'down' | 'neutral';
    vix: 'up' | 'down' | 'neutral';
    btcd: 'up' | 'down' | 'neutral';
    sentiment: 'up' | 'down' | 'neutral';
  };

  // Chart
  chartData: ChartDataPoint[];
  timeframe: string;

  // Signals
  signals: TradeSignal[];
  isScanning: boolean;

  // Technicals
  technicals: {
    rsi: number;
    macd: { histogram: number; signal: number; macd: number };
    adx: number;
    atr: number;
    trend: string;
  };

  // Analysis
  latestAnalysis: string;
  lastMacroUpdate: number;

  // Enhanced metrics
  enhancedMetrics: EnhancedBTCMetrics;

  // Feed status
  feeds: Record<string, FeedState>;
}

export interface MarketActions {
  setMarketMetrics: (metrics: Partial<MarketState>) => void;
  setPrice: (price: number) => void;
  setPriceChange: (change: number) => void;
  setChartData: (data: ChartDataPoint[]) => void;
  setSignals: (signals: TradeSignal[]) => void;
  setIsScanning: (isScanning: boolean) => void;
  setTimeframe: (timeframe: string) => void;
  setTechnicals: (technicals: MarketState['technicals']) => void;
  setLatestAnalysis: (analysis: string) => void;
  setEnhancedMetrics: (metrics: EnhancedBTCMetrics) => void;
  updateFeedStatus: (id: string, updates: Partial<FeedState>) => void;
}

export type MarketSlice = MarketState & MarketActions;

export const createMarketSlice: StateCreator<
  MarketSlice,
  [],
  [],
  MarketSlice
> = (set) => ({
  // Initial state
  price: 0,
  priceChange: 0,
  lastPriceUpdate: 0,
  vix: 0,
  dxy: 0,
  btcd: 0,
  sentimentScore: 0,
  sentimentLabel: 'No Data',
  derivatives: { openInterest: '-', fundingRate: '-', longShortRatio: 1.0 },
  intel: [],
  trends: { price: 'neutral', vix: 'neutral', btcd: 'neutral', sentiment: 'neutral' },
  chartData: [],
  timeframe: '15m',
  signals: [],
  isScanning: false,
  technicals: { rsi: 0, macd: { histogram: 0, signal: 0, macd: 0 }, adx: 0, atr: 0, trend: 'NEUTRAL' },
  latestAnalysis: '',
  lastMacroUpdate: 0,
  enhancedMetrics: defaultEnhancedMetrics,
  feeds: getInitialFeedState(),

  // Actions
  setMarketMetrics: (metrics) => set((state) => ({
    ...state,
    ...metrics,
    lastMacroUpdate: Date.now()
  })),

  setPrice: (price) => set({ price, lastPriceUpdate: Date.now() }),

  setPriceChange: (priceChange) => set({ priceChange }),

  setChartData: (chartData) => set({ chartData }),

  setSignals: (signals) => set({ signals }),

  setIsScanning: (isScanning) => set({ isScanning }),

  setTimeframe: (timeframe) => set({ timeframe }),

  setTechnicals: (technicals) => set({ technicals }),

  setLatestAnalysis: (latestAnalysis) => set({ latestAnalysis }),

  setEnhancedMetrics: (enhancedMetrics) => set({ enhancedMetrics }),

  updateFeedStatus: (id, updates) => set((state) => ({
    feeds: {
      ...state.feeds,
      [id]: { ...state.feeds[id], ...updates }
    }
  }))
});

// Selectors
export const selectPrice = (state: MarketSlice) => state.price;
export const selectPriceChange = (state: MarketSlice) => state.priceChange;
export const selectChartData = (state: MarketSlice) => state.chartData;
export const selectSignals = (state: MarketSlice) => state.signals;
export const selectTechnicals = (state: MarketSlice) => state.technicals;
export const selectEnhancedMetrics = (state: MarketSlice) => state.enhancedMetrics;
export const selectIsScanning = (state: MarketSlice) => state.isScanning;

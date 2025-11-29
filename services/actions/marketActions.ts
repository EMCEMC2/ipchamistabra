/**
 * Market Actions
 * Decouples service data fetching from store mutations
 * Services return data, actions commit to store
 */

import { useStore } from '../../store/useStore';
import { ChartDataPoint, TradeSignal } from '../../types';
import { EnhancedBTCMetrics } from '../macroDataService';
import { FeedStatus } from '../feedRegistry';

/**
 * Market price update action
 */
export function updatePrice(price: number): void {
  useStore.getState().setPrice(price);
}

/**
 * Price change update action
 */
export function updatePriceChange(change: number): void {
  useStore.getState().setPriceChange(change);
}

/**
 * Chart data update action
 */
export function updateChartData(data: ChartDataPoint[]): void {
  useStore.getState().setChartData(data);
}

/**
 * Signals update action
 */
export function updateSignals(signals: TradeSignal[]): void {
  useStore.getState().setSignals(signals);
}

/**
 * Scanning state action
 */
export function setScanning(isScanning: boolean): void {
  useStore.getState().setIsScanning(isScanning);
}

/**
 * Timeframe update action
 */
export function setTimeframe(timeframe: string): void {
  useStore.getState().setTimeframe(timeframe);
}

/**
 * Technicals update action
 */
export function updateTechnicals(technicals: {
  rsi: number;
  macd: { histogram: number; signal: number; macd: number };
  adx: number;
  atr: number;
  trend: string;
}): void {
  useStore.getState().setTechnicals(technicals);
}

/**
 * Analysis update action
 */
export function updateAnalysis(analysis: string): void {
  useStore.getState().setLatestAnalysis(analysis);
}

/**
 * Enhanced metrics update action
 */
export function updateEnhancedMetrics(metrics: EnhancedBTCMetrics): void {
  useStore.getState().setEnhancedMetrics(metrics);
}

/**
 * Market metrics batch update action
 */
export function updateMarketMetrics(metrics: {
  price?: number;
  priceChange?: number;
  vix?: number;
  dxy?: number;
  btcd?: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  derivatives?: {
    openInterest: string;
    fundingRate: string;
    longShortRatio: number;
  };
}): void {
  useStore.getState().setMarketMetrics(metrics);
}

/**
 * Feed status update action
 */
export function updateFeedStatus(
  feedId: string,
  updates: { status?: FeedStatus; lastUpdate?: number; error?: string }
): void {
  useStore.getState().updateFeedStatus(feedId, updates);
}

/**
 * Get current market state (read-only)
 */
export function getMarketState() {
  const state = useStore.getState();
  return {
    price: state.price,
    priceChange: state.priceChange,
    vix: state.vix,
    dxy: state.dxy,
    btcd: state.btcd,
    sentimentScore: state.sentimentScore,
    sentimentLabel: state.sentimentLabel,
    derivatives: state.derivatives,
    technicals: state.technicals,
    enhancedMetrics: state.enhancedMetrics,
    timeframe: state.timeframe,
    chartData: state.chartData,
    signals: state.signals,
    isScanning: state.isScanning
  };
}

/**
 * Subscribe to market state changes
 */
export function subscribeToMarket(
  selector: (state: ReturnType<typeof getMarketState>) => unknown,
  callback: (value: unknown) => void
): () => void {
  return useStore.subscribe((state) => {
    const marketState = {
      price: state.price,
      priceChange: state.priceChange,
      vix: state.vix,
      dxy: state.dxy,
      btcd: state.btcd,
      sentimentScore: state.sentimentScore,
      sentimentLabel: state.sentimentLabel,
      derivatives: state.derivatives,
      technicals: state.technicals,
      enhancedMetrics: state.enhancedMetrics,
      timeframe: state.timeframe,
      chartData: state.chartData,
      signals: state.signals,
      isScanning: state.isScanning
    };
    callback(selector(marketState));
  });
}

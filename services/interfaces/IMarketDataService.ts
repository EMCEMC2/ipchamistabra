/**
 * Market Data Service Interface
 * Abstracts market data fetching operations
 */

import { ChartDataPoint, TradeSignal } from '../../types';

export interface MarketTicker {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DerivativesData {
  openInterest: number;
  fundingRate: number;
  nextFundingTime: number;
  longShortRatio: number;
}

export interface FetchKlinesOptions {
  symbol: string;
  interval: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface FetchTickerOptions {
  symbol: string;
}

/**
 * Market Data Service Interface
 * All market data services must implement this interface
 */
export interface IMarketDataService {
  /**
   * Service identifier
   */
  readonly name: string;

  /**
   * Check if service is available/connected
   */
  isAvailable(): boolean;

  /**
   * Get current ticker for a symbol
   */
  getTicker(options: FetchTickerOptions): Promise<MarketTicker>;

  /**
   * Get historical klines/candles
   */
  getKlines(options: FetchKlinesOptions): Promise<Candle[]>;

  /**
   * Get order book snapshot
   */
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;

  /**
   * Get derivatives data (funding, OI)
   */
  getDerivatives(symbol: string): Promise<DerivativesData>;

  /**
   * Subscribe to real-time price updates
   */
  subscribeTicker(symbol: string, callback: (ticker: MarketTicker) => void): () => void;

  /**
   * Subscribe to real-time kline updates
   */
  subscribeKlines(
    symbol: string,
    interval: string,
    callback: (candle: Candle) => void
  ): () => void;

  /**
   * Disconnect all subscriptions
   */
  disconnect(): void;
}

/**
 * Signal Generator Interface
 * Services that generate trading signals
 */
export interface ISignalGenerator {
  /**
   * Generate signals from market data
   */
  generateSignals(
    candles: Candle[],
    currentPrice: number
  ): Promise<TradeSignal[]>;

  /**
   * Get active signals
   */
  getActiveSignals(): TradeSignal[];

  /**
   * Clear expired signals
   */
  clearExpiredSignals(): void;
}

/**
 * Chart Data Provider Interface
 */
export interface IChartDataProvider {
  /**
   * Get formatted chart data
   */
  getChartData(
    symbol: string,
    interval: string,
    limit?: number
  ): Promise<ChartDataPoint[]>;

  /**
   * Convert raw candles to chart format
   */
  formatCandles(candles: Candle[]): ChartDataPoint[];
}

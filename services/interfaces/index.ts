/**
 * Service Interfaces
 * Re-exports all service interfaces for dependency injection
 */

export type {
  MarketTicker,
  OrderBookLevel,
  OrderBook,
  Candle,
  DerivativesData,
  FetchKlinesOptions,
  FetchTickerOptions,
  IMarketDataService,
  ISignalGenerator,
  IChartDataProvider
} from './IMarketDataService';

export type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  SentimentAnalysisResult,
  MarketAnalysisResult,
  TradeReviewResult,
  IAIService,
  IAIAgent
} from './IAIService';

export type {
  StorageOptions,
  StorageMetadata,
  IStorageService,
  ISyncStorageService,
  ICacheService,
  IStatePersistence
} from './IStorageService';

export type {
  ConnectionState,
  WebSocketMessage,
  ConnectionStats,
  SubscriptionOptions,
  WebSocketConfig,
  IWebSocketService,
  IWebSocketPool,
  IDataStream,
  IMarketDataStream
} from './IWebSocketService';

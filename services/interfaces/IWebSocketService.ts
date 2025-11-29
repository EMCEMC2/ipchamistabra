/**
 * WebSocket Service Interface
 * Abstracts real-time data connections
 */

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

export interface ConnectionStats {
  state: ConnectionState;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  latency?: number;
}

export interface SubscriptionOptions {
  channel: string;
  params?: Record<string, unknown>;
  onMessage: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pongTimeout?: number;
  messageTimeout?: number;
}

/**
 * WebSocket Service Interface
 * All WebSocket services must implement this interface
 */
export interface IWebSocketService {
  /**
   * Service identifier
   */
  readonly name: string;

  /**
   * Get current connection state
   */
  getState(): ConnectionState;

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from server
   */
  disconnect(): void;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Subscribe to a channel/topic
   * Returns unsubscribe function
   */
  subscribe(options: SubscriptionOptions): () => void;

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void;

  /**
   * Send message to server
   */
  send<T>(message: WebSocketMessage<T>): void;

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats;

  /**
   * Add connection state listener
   */
  onStateChange(callback: (state: ConnectionState) => void): () => void;

  /**
   * Force reconnection
   */
  reconnect(): Promise<void>;
}

/**
 * WebSocket Pool Interface
 * Manages multiple WebSocket connections
 */
export interface IWebSocketPool {
  /**
   * Get or create connection for URL
   */
  getConnection(url: string, config?: Partial<WebSocketConfig>): IWebSocketService;

  /**
   * Close specific connection
   */
  closeConnection(url: string): void;

  /**
   * Close all connections
   */
  closeAll(): void;

  /**
   * Get all active connections
   */
  getActiveConnections(): string[];

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    activeConnections: number;
    totalMessagesReceived: number;
    totalMessagesSent: number;
  };
}

/**
 * Real-time Data Stream Interface
 * Higher-level abstraction for streaming data
 */
export interface IDataStream<T> {
  /**
   * Stream identifier
   */
  readonly id: string;

  /**
   * Start streaming
   */
  start(): void;

  /**
   * Stop streaming
   */
  stop(): void;

  /**
   * Check if streaming
   */
  isStreaming(): boolean;

  /**
   * Add data listener
   */
  onData(callback: (data: T) => void): () => void;

  /**
   * Add error listener
   */
  onError(callback: (error: Error) => void): () => void;

  /**
   * Get latest data point
   */
  getLatest(): T | null;

  /**
   * Get buffered data
   */
  getBuffer(limit?: number): T[];
}

/**
 * Market Data Stream Interface
 * Specialized stream for market data
 */
export interface IMarketDataStream {
  /**
   * Subscribe to ticker updates
   */
  subscribeTicker(
    symbol: string,
    callback: (price: number, change: number) => void
  ): () => void;

  /**
   * Subscribe to trade updates
   */
  subscribeTrades(
    symbol: string,
    callback: (trade: { price: number; quantity: number; side: 'buy' | 'sell' }) => void
  ): () => void;

  /**
   * Subscribe to order book updates
   */
  subscribeOrderBook(
    symbol: string,
    callback: (bids: [number, number][], asks: [number, number][]) => void
  ): () => void;

  /**
   * Subscribe to kline/candle updates
   */
  subscribeKlines(
    symbol: string,
    interval: string,
    callback: (candle: { time: number; open: number; high: number; low: number; close: number; volume: number }) => void
  ): () => void;

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): { type: string; symbol: string }[];
}

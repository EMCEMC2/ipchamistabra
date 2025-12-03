/**
 * ORDER FLOW MANAGER (Facade)
 *
 * Single entry point for all order flow operations.
 * Unifies two data sources:
 * - orderFlowIntel: REST-based polling (Binance Futures API)
 * - aggrService: WebSocket worker (multi-exchange via aggr.trade)
 *
 * ARCHITECTURE:
 * - Only ONE source is active at a time to prevent data conflicts
 * - All data flows to Zustand store (Single Source of Truth)
 * - Components read from store, never from services directly
 *
 * USAGE:
 * import { orderFlowManager } from './orderFlowManager';
 * orderFlowManager.start(); // Uses default source (REST)
 * const stats = useOrderFlowStats(); // Read from store
 */

import { AggrStats, AggrLiquidation, AggrTrade, CascadeEvent } from '../types/aggrTypes';
import { orderFlowIntel } from './orderFlowIntel';
import { aggrService } from './aggrService';
import { useStore } from '../store/useStore';
import { dataSyncAgent } from './dataSyncAgent';

export type OrderFlowSource = 'REST' | 'WEBSOCKET';

interface OrderFlowManagerConfig {
  /** Which data source to use. Default: 'REST' */
  source: OrderFlowSource;
  /** Auto-reconnect on disconnect. Default: true */
  autoReconnect: boolean;
  /** Reconnect delay in ms. Default: 5000 */
  reconnectDelay: number;
}

const DEFAULT_CONFIG: OrderFlowManagerConfig = {
  source: 'REST',
  autoReconnect: true,
  reconnectDelay: 5000
};

class OrderFlowManager {
  private config: OrderFlowManagerConfig = DEFAULT_CONFIG;
  private isRunning: boolean = false;
  private activeSource: OrderFlowSource | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // Event handlers
  private onLiquidationHandlers: Array<(liq: AggrLiquidation) => void> = [];
  private onLargeTradeHandlers: Array<(trade: AggrTrade) => void> = [];
  private onCascadeHandlers: Array<(cascade: CascadeEvent) => void> = [];

  constructor() {
    console.log('[OrderFlowManager] Initialized');
  }

  /**
   * Start order flow data collection.
   * Only one source will be active at a time.
   */
  async start(config?: Partial<OrderFlowManagerConfig>): Promise<void> {
    if (this.isRunning) {
      console.log('[OrderFlowManager] Already running');
      return;
    }

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isRunning = true;
    this.activeSource = this.config.source;

    console.log(`[OrderFlowManager] Starting with source: ${this.activeSource}`);

    try {
      if (this.activeSource === 'REST') {
        await this.startRestSource();
      } else {
        await this.startWebSocketSource();
      }
    } catch (error) {
      console.error('[OrderFlowManager] Failed to start:', error);
      this.handleDisconnect();
    }
  }

  /**
   * Stop order flow data collection.
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[OrderFlowManager] Stopping...');
    this.isRunning = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Disconnect both sources to ensure clean state
    try {
      orderFlowIntel.disconnect();
    } catch (e) {
      console.warn('[OrderFlowManager] Error disconnecting REST:', e);
    }

    try {
      aggrService.disconnect();
    } catch (e) {
      console.warn('[OrderFlowManager] Error disconnecting WebSocket:', e);
    }

    this.activeSource = null;
    console.log('[OrderFlowManager] Stopped');
  }

  /**
   * Switch between data sources.
   * Will stop current source and start the new one.
   */
  async switchSource(newSource: OrderFlowSource): Promise<void> {
    if (newSource === this.activeSource) {
      console.log(`[OrderFlowManager] Already using ${newSource}`);
      return;
    }

    console.log(`[OrderFlowManager] Switching from ${this.activeSource} to ${newSource}`);

    // Stop current source
    if (this.activeSource === 'REST') {
      orderFlowIntel.disconnect();
    } else if (this.activeSource === 'WEBSOCKET') {
      aggrService.disconnect();
    }

    this.activeSource = newSource;
    this.config.source = newSource;

    // Start new source
    if (newSource === 'REST') {
      await this.startRestSource();
    } else {
      await this.startWebSocketSource();
    }
  }

  /**
   * Get current stats from store (Single Source of Truth).
   * Prefer using useOrderFlowStats() selector in React components.
   */
  getStats(): AggrStats | null {
    return useStore.getState().orderFlowStats;
  }

  /**
   * Get current active source.
   */
  getActiveSource(): OrderFlowSource | null {
    return this.activeSource;
  }

  /**
   * Check if manager is running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * Register handler for liquidation events.
   */
  onLiquidation(handler: (liq: AggrLiquidation) => void): () => void {
    this.onLiquidationHandlers.push(handler);
    return () => {
      this.onLiquidationHandlers = this.onLiquidationHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Register handler for large trade events.
   */
  onLargeTrade(handler: (trade: AggrTrade) => void): () => void {
    this.onLargeTradeHandlers.push(handler);
    return () => {
      this.onLargeTradeHandlers = this.onLargeTradeHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Register handler for cascade events.
   */
  onCascade(handler: (cascade: CascadeEvent) => void): () => void {
    this.onCascadeHandlers.push(handler);
    return () => {
      this.onCascadeHandlers = this.onCascadeHandlers.filter(h => h !== handler);
    };
  }

  // ==================== PRIVATE METHODS ====================

  private async startRestSource(): Promise<void> {
    console.log('[OrderFlowManager] Starting REST source (orderFlowIntel)');

    // orderFlowIntel now broadcasts to store automatically
    // We just need to start it
    await orderFlowIntel.connect();
  }

  private async startWebSocketSource(): Promise<void> {
    console.log('[OrderFlowManager] Starting WebSocket source (aggrService)');

    // Connect with callback to forward stats to store
    // Note: aggrService already syncs with dataSyncAgent
    aggrService.connect((stats) => {
      // Forward to store (Single Source of Truth)
      useStore.getState().setOrderFlowStats({
        ...stats,
        lastUpdate: Date.now()
      });
    });

    // Wire up event handlers
    aggrService.onLiquidationEvent((liq) => {
      this.onLiquidationHandlers.forEach(h => {
        try { h(liq); } catch (e) { console.error('[OrderFlowManager] Liquidation handler error:', e); }
      });
    });

    aggrService.onLargeTradeEvent((trade) => {
      this.onLargeTradeHandlers.forEach(h => {
        try { h(trade); } catch (e) { console.error('[OrderFlowManager] Large trade handler error:', e); }
      });
    });

    aggrService.onCascadeEvent((cascade) => {
      this.onCascadeHandlers.forEach(h => {
        try { h(cascade); } catch (e) { console.error('[OrderFlowManager] Cascade handler error:', e); }
      });
    });
  }

  private handleDisconnect(): void {
    if (!this.isRunning || !this.config.autoReconnect) return;

    console.log(`[OrderFlowManager] Disconnected, reconnecting in ${this.config.reconnectDelay}ms...`);

    this.reconnectTimeout = setTimeout(async () => {
      if (!this.isRunning) return;

      try {
        if (this.activeSource === 'REST') {
          await this.startRestSource();
        } else {
          await this.startWebSocketSource();
        }
      } catch (error) {
        console.error('[OrderFlowManager] Reconnect failed:', error);
        this.handleDisconnect(); // Retry
      }
    }, this.config.reconnectDelay);
  }
}

// ==================== SINGLETON EXPORT ====================

export const orderFlowManager = new OrderFlowManager();

// ==================== BACKWARD COMPATIBLE EXPORTS ====================

/**
 * @deprecated Use orderFlowManager.start() instead
 */
export const connectOrderFlow = (source: OrderFlowSource = 'REST') => {
  return orderFlowManager.start({ source });
};

/**
 * @deprecated Use orderFlowManager.stop() instead
 */
export const disconnectOrderFlow = () => {
  orderFlowManager.stop();
};

/**
 * @deprecated Use useOrderFlowStats() selector or orderFlowManager.getStats()
 */
export const getOrderFlowStats = () => {
  return orderFlowManager.getStats();
};

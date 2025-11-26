import { AggrStats, AggrLiquidation, AggrTrade, CascadeEvent } from '../types/aggrTypes';
import { workerManager } from './workers/WorkerManager';
import { soundEngine } from './audio/SoundEngine';

// Re-export types for compatibility
export * from '../types/aggrTypes';

export class AggrTradeService {
  private latestStats: AggrStats | null = null;
  
  // External Handlers
  private onLiquidation?: (liq: AggrLiquidation) => void;
  private onLargeTrade?: (trade: AggrTrade) => void;
  private onCascade?: (cascade: CascadeEvent) => void;

  constructor() {
    console.log('[Aggr] Service initialized (Worker Mode)');
    
    // Subscribe to worker updates
    workerManager.connect((stats) => {
      this.latestStats = stats;
    });

    // Setup Event Listeners with Sound
    workerManager.onLargeTradeEvent((trade) => {
      soundEngine.playTradeSound(trade);
      if (this.onLargeTrade) this.onLargeTrade(trade);
    });

    workerManager.onLiquidationEvent((liq) => {
      soundEngine.playLiquidationSound(liq);
      if (this.onLiquidation) this.onLiquidation(liq);
    });

    workerManager.onCascadeEvent((cascade) => {
      // Maybe add cascade sound later
      if (this.onCascade) this.onCascade(cascade);
    });
  }

  /**
   * Connect to multiple exchange WebSocket feeds via Worker
   */
  connect(onStatsUpdate?: (stats: AggrStats) => void): void {
    console.log('[Aggr] Connecting via Worker...');
    // We already connected in constructor listeners, but here we might want to ensure worker is "connected" to WS
    workerManager.connect((stats) => {
      this.latestStats = stats;
      if (onStatsUpdate) onStatsUpdate(stats);
    });
  }

  /**
   * Disconnect via Worker
   */
  disconnect(): void {
    console.log('[Aggr] Disconnecting via Worker...');
    workerManager.disconnect();
  }

  /**
   * Get current stats (from local cache)
   */
  getStats(): AggrStats | null {
    return this.latestStats;
  }

  /**
   * Set event handlers
   */
  onLiquidationEvent(handler: (liq: AggrLiquidation) => void): void {
    this.onLiquidation = handler;
  }

  onLargeTradeEvent(handler: (trade: AggrTrade) => void): void {
    this.onLargeTrade = handler;
  }

  onCascadeEvent(handler: (cascade: CascadeEvent) => void): void {
    this.onCascade = handler;
  }
}

// Export singleton instance
export const aggrService = new AggrTradeService();

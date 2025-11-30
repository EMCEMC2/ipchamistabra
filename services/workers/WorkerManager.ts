import { AggrStats, AggrLiquidation, AggrTrade, CascadeEvent } from '../../types/aggrTypes';
import { WorkerMessage, WorkerMessageType } from './types';

type EventHandler<T> = (data: T) => void;

export class WorkerManager {
  private worker: Worker | null = null;
  private isConnected: boolean = false;

  // Event Handlers
  private onStatsUpdate?: EventHandler<AggrStats>;
  private onLiquidation?: EventHandler<AggrLiquidation>;
  private onLargeTrade?: EventHandler<AggrTrade>;
  private onCascade?: EventHandler<CascadeEvent>;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (this.worker) return;

    // Vite handles this import syntax for workers
    this.worker = new Worker(new URL('./dataProcessor.worker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      this.handleMessage(type, payload);
    };

    this.worker.onerror = (error) => {
      console.error('[WorkerManager] Worker Error:', error);
    };

    console.log('[WorkerManager] Worker initialized');
  }

  public connect(onStatsUpdate?: EventHandler<AggrStats>) {
    if (onStatsUpdate) this.onStatsUpdate = onStatsUpdate;
    this.sendMessage('CONNECT');
    this.isConnected = true;
  }

  public disconnect() {
    this.sendMessage('DISCONNECT');
    this.isConnected = false;
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private sendMessage(type: WorkerMessageType, payload?: any) {
    if (this.worker) {
      this.worker.postMessage({ type, payload });
    }
  }

  private handleMessage(type: WorkerMessageType, payload: any) {
    switch (type) {
      case 'STATS_UPDATE':
        if (this.onStatsUpdate && payload.stats) {
          this.onStatsUpdate(payload.stats);
        }
        break;
      case 'LIQUIDATION_EVENT':
        if (this.onLiquidation && payload.liquidation) {
          this.onLiquidation(payload.liquidation);
        }
        break;
      case 'LARGE_TRADE_EVENT':
        if (this.onLargeTrade && payload.trade) {
          this.onLargeTrade(payload.trade);
        }
        break;
      case 'CASCADE_EVENT':
        if (this.onCascade && payload.cascade) {
          this.onCascade(payload.cascade);
        }
        break;
      case 'DEBUG_LOG':
        console.log(`[Worker Debug] ${payload.message}`);
        break;
    }
  }

  // Event Subscription Methods
  public onLiquidationEvent(handler: EventHandler<AggrLiquidation>) {
    this.onLiquidation = handler;
  }

  public onLargeTradeEvent(handler: EventHandler<AggrTrade>) {
    this.onLargeTrade = handler;
  }

  public onCascadeEvent(handler: EventHandler<CascadeEvent>) {
    this.onCascade = handler;
  }
}

// Export singleton
export const workerManager = new WorkerManager();

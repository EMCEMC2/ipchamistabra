import { generateTacticalSignal } from './tacticalSignals';
import { generateConsensus } from './agentConsensus';
import { ChartDataPoint } from '../types';
import { AppState } from '../store/useStore';
import { AggrStats } from './aggrService';

// Define message types
export type WorkerMessage = 
  | { type: 'GENERATE_SIGNALS'; payload: { chartData: ChartDataPoint[]; orderFlowStats: AggrStats | null; state: AppState }; requestId?: string }
  | { type: 'PING'; requestId?: string };

export type WorkerResponse = 
  | { type: 'SIGNALS_GENERATED'; payload: { tacticalResult: any; consensusData: any }; requestId?: string }
  | { type: 'PONG'; requestId?: string }
  | { type: 'ERROR'; payload: string; requestId?: string };

// Worker context
const ctx: Worker = self as any;

// State for signal generation
let lastSignalBar = -999;

ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'GENERATE_SIGNALS':
        const start = performance.now();
        const { chartData, orderFlowStats, state } = message.payload;
        
        // Run heavy calculations
        const tacticalResult = generateTacticalSignal(chartData, undefined, orderFlowStats, lastSignalBar);
        
        // Update state
        lastSignalBar = tacticalResult.lastSignalBar;

        const consensusData = generateConsensus(tacticalResult, state);

        const duration = performance.now() - start;
        if (duration > 100) {
             console.warn(`[Worker] Calculation took ${duration.toFixed(2)}ms`);
        }

        ctx.postMessage({
          type: 'SIGNALS_GENERATED',
          payload: { tacticalResult, consensusData },
          requestId: message.requestId
        });
        break;

      case 'PING':
        ctx.postMessage({ type: 'PONG', requestId: message.requestId });
        break;
    }
  } catch (error: any) {
    ctx.postMessage({ type: 'ERROR', payload: error.message, requestId: message.requestId });
  }
});

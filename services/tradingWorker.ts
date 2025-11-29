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

ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'GENERATE_SIGNALS':
        const { chartData, orderFlowStats, state } = message.payload;
        
        // Run heavy calculations
        const tacticalResult = generateTacticalSignal(chartData, undefined, orderFlowStats);
        const consensusData = generateConsensus(tacticalResult, state);

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

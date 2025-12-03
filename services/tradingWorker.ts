import { generateTacticalSignalV33, generateTacticalSignal } from './tacticalSignalsV33';
import { generateConsensus } from './agentConsensus';
import {
  ChartDataPoint,
  SignalHistoryState,
  PatternLearningState,
  TacticalConfigV33,
  TacticalResultV33,
  EMPTY_SIGNAL_HISTORY,
  EMPTY_PATTERN_LEARNING,
  DEFAULT_CONFIG_V33
} from '../types';
import { AppState } from '../store/useStore';
import { AggrStats } from './aggrService';

// Define message types
export type WorkerMessage =
  | {
      type: 'GENERATE_SIGNALS';
      payload: {
        chartData: ChartDataPoint[];
        orderFlowStats: AggrStats | null;
        state: AppState;
        lastSignalBar: number; // Legacy - kept for backward compat
        // V3.3.1 additions
        signalHistory?: SignalHistoryState;
        patternLearning?: PatternLearningState;
        config?: Partial<TacticalConfigV33>;
        useV33?: boolean; // Flag to use V3.3.1 generator
      };
      requestId?: string
    }
  | { type: 'PING'; requestId?: string };

export type WorkerResponse =
  | {
      type: 'SIGNALS_GENERATED';
      payload: {
        tacticalResult: any;
        consensusData: any;
        lastSignalBar: number; // Legacy - kept for backward compat
        // V3.3.1 additions
        signalHistory?: SignalHistoryState;
        patternAnalysis?: TacticalResultV33['patternAnalysis'];
      };
      requestId?: string
    }
  | { type: 'PONG'; requestId?: string }
  | { type: 'ERROR'; payload: string; requestId?: string };

// Worker context
const ctx: Worker = self as any;

// CRITICAL: Worker is now STATELESS - no global mutable state
// State (lastSignalBar) is passed IN via message and returned OUT via response
// This ensures signal generation is deterministic given the same input

ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'GENERATE_SIGNALS': {
        const start = performance.now();
        const {
          chartData,
          orderFlowStats,
          state,
          lastSignalBar,
          signalHistory,
          patternLearning,
          config,
          useV33 = true // Default to V3.3.1
        } = message.payload;

        // V3.3.1 signal generation (default)
        if (useV33) {
          // Use provided state or defaults
          const history = signalHistory ?? EMPTY_SIGNAL_HISTORY;
          const patterns = patternLearning ?? EMPTY_PATTERN_LEARNING;
          const v33Config: TacticalConfigV33 = { ...DEFAULT_CONFIG_V33, ...config };

          // Run V3.3.1 signal generator
          const tacticalResult = generateTacticalSignalV33(
            chartData,
            state,
            orderFlowStats,
            history,
            patterns,
            v33Config
          );

          // Generate consensus from V3.3.1 result
          // Convert to format expected by agentConsensus
          const legacyResult = {
            signal: tacticalResult.signal,
            bullScore: tacticalResult.technical.bullScore,
            bearScore: tacticalResult.technical.bearScore,
            regime: tacticalResult.structure.regime as 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL',
            reasoning: tacticalResult.reasoning,
            lastSignalBar: tacticalResult.signal ? chartData.length - 1 : lastSignalBar
          };

          const consensusData = generateConsensus(legacyResult, state);

          const duration = performance.now() - start;
          if (duration > 100) {
            console.warn(`[Worker V3.3.1] Calculation took ${duration.toFixed(2)}ms`);
          }

          // Return V3.3.1 result with updated history
          ctx.postMessage({
            type: 'SIGNALS_GENERATED',
            payload: {
              tacticalResult,
              consensusData,
              lastSignalBar: legacyResult.lastSignalBar,
              signalHistory: tacticalResult.updatedHistory,
              patternAnalysis: tacticalResult.patternAnalysis
            },
            requestId: message.requestId
          });
        } else {
          // Legacy V2 mode for backward compatibility
          const incomingLastSignalBar = typeof lastSignalBar === 'number' && Number.isFinite(lastSignalBar)
            ? lastSignalBar
            : -999;

          const tacticalResult = generateTacticalSignal(
            chartData,
            config,
            orderFlowStats,
            incomingLastSignalBar
          );

          const newLastSignalBar = typeof tacticalResult.lastSignalBar === 'number'
            ? tacticalResult.lastSignalBar
            : incomingLastSignalBar;

          const consensusData = generateConsensus(tacticalResult, state);

          const duration = performance.now() - start;
          if (duration > 100) {
            console.warn(`[Worker V2] Calculation took ${duration.toFixed(2)}ms`);
          }

          ctx.postMessage({
            type: 'SIGNALS_GENERATED',
            payload: {
              tacticalResult,
              consensusData,
              lastSignalBar: newLastSignalBar
            },
            requestId: message.requestId
          });
        }
        break;
      }

      case 'PING':
        ctx.postMessage({ type: 'PONG', requestId: message.requestId });
        break;
    }
  } catch (error: any) {
    console.error('[Worker] Error:', error);
    ctx.postMessage({ type: 'ERROR', payload: error.message, requestId: message.requestId });
  }
});

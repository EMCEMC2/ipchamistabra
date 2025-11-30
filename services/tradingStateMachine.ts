/**
 * TRADING STATE MACHINE
 * Explicit state transitions for trade execution.
 * Prevents double-execution, race conditions, and invalid states.
 */

export type TradingState =
  | 'IDLE'                    // No trade in progress
  | 'VALIDATING'              // Risk checks running
  | 'AWAITING_CONFIRMATION'   // User must confirm
  | 'EXECUTING'               // Order being placed
  | 'CONFIRMING_FILL'         // Waiting for exchange confirmation
  | 'COMPLETED'               // Trade done
  | 'FAILED'                  // Trade failed
  | 'CANCELLED';              // User cancelled

export type TradingEvent =
  | { type: 'START_TRADE'; orderId: string }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED'; reason: string }
  | { type: 'USER_CONFIRMED' }
  | { type: 'USER_CANCELLED' }
  | { type: 'EXECUTION_STARTED' }
  | { type: 'ORDER_FILLED'; exchangeOrderId?: string }
  | { type: 'ORDER_REJECTED'; reason: string }
  | { type: 'TIMEOUT' }
  | { type: 'RESET' };

export interface TradingContext {
  orderId: string | null;
  exchangeOrderId: string | null;
  startedAt: number | null;
  error: string | null;
  attempts: number;
}

export interface TradingMachineState {
  state: TradingState;
  context: TradingContext;
  history: Array<{ state: TradingState; timestamp: number; event?: string }>;
}

const INITIAL_CONTEXT: TradingContext = {
  orderId: null,
  exchangeOrderId: null,
  startedAt: null,
  error: null,
  attempts: 0
};

export const INITIAL_MACHINE_STATE: TradingMachineState = {
  state: 'IDLE',
  context: { ...INITIAL_CONTEXT },
  history: []
};

// Max time in any non-terminal state before auto-timeout (30s)
const STATE_TIMEOUT_MS = 30000;

/**
 * State transition function (pure)
 * Returns new state given current state and event
 */
export function transition(
  current: TradingMachineState,
  event: TradingEvent
): TradingMachineState {
  const { state, context, history } = current;
  const timestamp = Date.now();

  // Helper to create new state with history
  const newState = (
    nextState: TradingState,
    contextUpdates: Partial<TradingContext> = {}
  ): TradingMachineState => ({
    state: nextState,
    context: { ...context, ...contextUpdates },
    history: [...history.slice(-99), { state: nextState, timestamp, event: event.type }]
  });

  // RESET always works from any state
  if (event.type === 'RESET') {
    return {
      state: 'IDLE',
      context: { ...INITIAL_CONTEXT },
      history: [...history.slice(-99), { state: 'IDLE', timestamp, event: 'RESET' }]
    };
  }

  // State machine transitions
  switch (state) {
    case 'IDLE':
      if (event.type === 'START_TRADE') {
        return newState('VALIDATING', {
          orderId: event.orderId,
          startedAt: timestamp,
          error: null,
          attempts: context.attempts + 1
        });
      }
      break;

    case 'VALIDATING':
      if (event.type === 'VALIDATION_PASSED') {
        return newState('AWAITING_CONFIRMATION');
      }
      if (event.type === 'VALIDATION_FAILED') {
        return newState('FAILED', { error: event.reason });
      }
      if (event.type === 'TIMEOUT') {
        return newState('FAILED', { error: 'Validation timeout' });
      }
      break;

    case 'AWAITING_CONFIRMATION':
      if (event.type === 'USER_CONFIRMED') {
        return newState('EXECUTING');
      }
      if (event.type === 'USER_CANCELLED') {
        return newState('CANCELLED');
      }
      if (event.type === 'TIMEOUT') {
        return newState('CANCELLED', { error: 'Confirmation timeout' });
      }
      break;

    case 'EXECUTING':
      if (event.type === 'EXECUTION_STARTED') {
        return newState('CONFIRMING_FILL');
      }
      if (event.type === 'ORDER_REJECTED') {
        return newState('FAILED', { error: event.reason });
      }
      if (event.type === 'TIMEOUT') {
        return newState('FAILED', { error: 'Execution timeout' });
      }
      break;

    case 'CONFIRMING_FILL':
      if (event.type === 'ORDER_FILLED') {
        return newState('COMPLETED', { exchangeOrderId: event.exchangeOrderId || null });
      }
      if (event.type === 'ORDER_REJECTED') {
        return newState('FAILED', { error: event.reason });
      }
      if (event.type === 'TIMEOUT') {
        // This is dangerous - order might have filled. Mark as failed but log warning.
        console.error('[TradingStateMachine] TIMEOUT in CONFIRMING_FILL - order status unknown!');
        return newState('FAILED', { error: 'Fill confirmation timeout - CHECK EXCHANGE MANUALLY' });
      }
      break;

    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
      // Terminal states - only RESET can exit
      break;
  }

  // Invalid transition - log and return unchanged
  console.warn(`[TradingStateMachine] Invalid transition: ${state} + ${event.type}`);
  return current;
}

/**
 * Check if current state has timed out
 */
export function checkTimeout(machineState: TradingMachineState): boolean {
  const { state, context } = machineState;

  // Only check non-terminal, non-idle states
  if (state === 'IDLE' || state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED') {
    return false;
  }

  if (!context.startedAt) return false;

  return Date.now() - context.startedAt > STATE_TIMEOUT_MS;
}

/**
 * Check if state allows starting a new trade
 */
export function canStartTrade(machineState: TradingMachineState): boolean {
  return machineState.state === 'IDLE';
}

/**
 * Check if trade is in a terminal state
 */
export function isTerminal(state: TradingState): boolean {
  return state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED';
}

/**
 * Get human-readable status for UI
 */
export function getStatusMessage(machineState: TradingMachineState): string {
  const { state, context } = machineState;

  switch (state) {
    case 'IDLE':
      return 'Ready to trade';
    case 'VALIDATING':
      return 'Running risk checks...';
    case 'AWAITING_CONFIRMATION':
      return 'Waiting for confirmation';
    case 'EXECUTING':
      return 'Placing order...';
    case 'CONFIRMING_FILL':
      return 'Confirming fill...';
    case 'COMPLETED':
      return `Order completed${context.exchangeOrderId ? ` (ID: ${context.exchangeOrderId})` : ''}`;
    case 'FAILED':
      return `Failed: ${context.error || 'Unknown error'}`;
    case 'CANCELLED':
      return 'Trade cancelled';
    default:
      return 'Unknown state';
  }
}

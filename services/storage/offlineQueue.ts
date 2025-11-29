/**
 * Offline Queue Service
 * Queues operations when offline, replays on reconnection
 */

import * as db from './indexedDB';

const QUEUE_KEY = 'offline-queue';
const MAX_QUEUE_SIZE = 1000;
const MAX_RETRY_COUNT = 3;

interface QueuedOperation {
  id: string;
  type: 'API_CALL' | 'STATE_SYNC' | 'AUDIT_LOG';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'normal' | 'low';
}

interface QueueState {
  operations: QueuedOperation[];
  lastProcessed: number;
}

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let processingQueue = false;
let queueState: QueueState = {
  operations: [],
  lastProcessed: 0
};

type OperationHandler = (operation: QueuedOperation) => Promise<boolean>;
const handlers: Map<string, OperationHandler> = new Map();

/**
 * Initialize offline queue
 */
export async function initOfflineQueue(): Promise<void> {
  // Load persisted queue
  const persisted = await db.get<QueueState>(QUEUE_KEY);
  if (persisted) {
    queueState = persisted;
    console.log(`[OfflineQueue] Loaded ${queueState.operations.length} pending operations`);
  }

  // Set up connectivity listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    isOnline = navigator.onLine;
  }

  // Process any pending operations if online
  if (isOnline && queueState.operations.length > 0) {
    processQueue();
  }
}

/**
 * Handle coming online
 */
function handleOnline(): void {
  console.log('[OfflineQueue] Connection restored');
  isOnline = true;
  processQueue();
}

/**
 * Handle going offline
 */
function handleOffline(): void {
  console.log('[OfflineQueue] Connection lost');
  isOnline = false;
}

/**
 * Add operation to queue
 */
export async function enqueue(
  type: QueuedOperation['type'],
  payload: unknown,
  priority: QueuedOperation['priority'] = 'normal'
): Promise<string> {
  const operation: QueuedOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    priority
  };

  // Enforce queue size limit (remove oldest low-priority items)
  while (queueState.operations.length >= MAX_QUEUE_SIZE) {
    const lowPriorityIdx = queueState.operations.findIndex(op => op.priority === 'low');
    if (lowPriorityIdx >= 0) {
      queueState.operations.splice(lowPriorityIdx, 1);
    } else {
      // Remove oldest normal priority
      const normalIdx = queueState.operations.findIndex(op => op.priority === 'normal');
      if (normalIdx >= 0) {
        queueState.operations.splice(normalIdx, 1);
      } else {
        // Queue is full of high priority - remove oldest anyway
        queueState.operations.shift();
      }
    }
  }

  // Insert based on priority
  if (priority === 'high') {
    const insertIdx = queueState.operations.findIndex(op => op.priority !== 'high');
    if (insertIdx >= 0) {
      queueState.operations.splice(insertIdx, 0, operation);
    } else {
      queueState.operations.push(operation);
    }
  } else {
    queueState.operations.push(operation);
  }

  await persistQueue();

  // Try to process immediately if online
  if (isOnline && !processingQueue) {
    processQueue();
  }

  return operation.id;
}

/**
 * Register handler for operation type
 */
export function registerHandler(type: string, handler: OperationHandler): void {
  handlers.set(type, handler);
}

/**
 * Process queued operations
 */
async function processQueue(): Promise<void> {
  if (processingQueue || !isOnline || queueState.operations.length === 0) {
    return;
  }

  processingQueue = true;
  console.log(`[OfflineQueue] Processing ${queueState.operations.length} operations`);

  const toRemove: string[] = [];
  const toRetry: QueuedOperation[] = [];

  for (const operation of [...queueState.operations]) {
    if (!isOnline) break;

    const handler = handlers.get(operation.type);
    if (!handler) {
      console.warn(`[OfflineQueue] No handler for operation type: ${operation.type}`);
      toRemove.push(operation.id);
      continue;
    }

    try {
      const success = await handler(operation);

      if (success) {
        toRemove.push(operation.id);
        console.log(`[OfflineQueue] Processed: ${operation.id}`);
      } else {
        operation.retryCount++;
        if (operation.retryCount >= MAX_RETRY_COUNT) {
          console.error(`[OfflineQueue] Max retries reached for: ${operation.id}`);
          toRemove.push(operation.id);
        } else {
          toRetry.push(operation);
        }
      }
    } catch (error) {
      console.error(`[OfflineQueue] Error processing ${operation.id}:`, error);
      operation.retryCount++;

      if (operation.retryCount >= MAX_RETRY_COUNT) {
        toRemove.push(operation.id);
      } else {
        toRetry.push(operation);
      }
    }
  }

  // Update queue state
  queueState.operations = queueState.operations.filter(op => !toRemove.includes(op.id));
  queueState.lastProcessed = Date.now();

  await persistQueue();
  processingQueue = false;

  // Schedule retry for failed operations
  if (toRetry.length > 0 && isOnline) {
    setTimeout(() => processQueue(), 5000);
  }
}

/**
 * Persist queue to IndexedDB
 */
async function persistQueue(): Promise<void> {
  try {
    await db.set(QUEUE_KEY, queueState);
  } catch (error) {
    console.error('[OfflineQueue] Failed to persist queue:', error);
  }
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  pending: number;
  isOnline: boolean;
  isProcessing: boolean;
  lastProcessed: number;
} {
  return {
    pending: queueState.operations.length,
    isOnline,
    isProcessing: processingQueue,
    lastProcessed: queueState.lastProcessed
  };
}

/**
 * Check if currently online
 */
export function isCurrentlyOnline(): boolean {
  return isOnline;
}

/**
 * Clear queue (for testing/reset)
 */
export async function clearQueue(): Promise<void> {
  queueState = {
    operations: [],
    lastProcessed: Date.now()
  };
  await persistQueue();
}

/**
 * Force process queue (manual trigger)
 */
export function forceProcessQueue(): void {
  if (!processingQueue) {
    processQueue();
  }
}

/**
 * Get pending operations (for debugging)
 */
export function getPendingOperations(): QueuedOperation[] {
  return [...queueState.operations];
}

/**
 * Remove specific operation
 */
export async function removeOperation(id: string): Promise<boolean> {
  const idx = queueState.operations.findIndex(op => op.id === id);
  if (idx >= 0) {
    queueState.operations.splice(idx, 1);
    await persistQueue();
    return true;
  }
  return false;
}

/**
 * Cleanup (for unmount)
 */
export function cleanupOfflineQueue(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }
}

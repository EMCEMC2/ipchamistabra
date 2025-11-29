/**
 * Multi-Tab Synchronization via BroadcastChannel
 * Keeps state synchronized across browser tabs
 */

const CHANNEL_NAME = 'ipcha-mistabra-sync';

type SyncMessageType = 'STATE_UPDATE' | 'REQUEST_STATE' | 'STATE_RESPONSE' | 'LEADER_ELECTION';

interface SyncMessage {
  type: SyncMessageType;
  tabId: string;
  timestamp: number;
  payload?: unknown;
}

interface StateUpdatePayload {
  key: string;
  value: unknown;
}

type MessageHandler = (message: SyncMessage) => void;

let channel: BroadcastChannel | null = null;
const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const messageHandlers: Set<MessageHandler> = new Set();
let isLeader = false;
let leaderTabId: string | null = null;
let leaderHeartbeatInterval: number | null = null;

/**
 * Initialize broadcast channel
 */
export function initBroadcastSync(): void {
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('[BroadcastSync] BroadcastChannel not supported');
    return;
  }

  if (channel) return;

  channel = new BroadcastChannel(CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    handleMessage(event.data);
  };

  channel.onmessageerror = (event) => {
    console.error('[BroadcastSync] Message error:', event);
  };

  // Start leader election
  startLeaderElection();

  console.log('[BroadcastSync] Initialized with tabId:', tabId);
}

/**
 * Handle incoming messages
 */
function handleMessage(message: SyncMessage): void {
  // Ignore own messages
  if (message.tabId === tabId) return;

  switch (message.type) {
    case 'STATE_UPDATE':
      notifyHandlers(message);
      break;

    case 'REQUEST_STATE':
      if (isLeader) {
        sendStateResponse();
      }
      break;

    case 'STATE_RESPONSE':
      notifyHandlers(message);
      break;

    case 'LEADER_ELECTION':
      handleLeaderElection(message);
      break;
  }
}

/**
 * Notify all registered handlers
 */
function notifyHandlers(message: SyncMessage): void {
  messageHandlers.forEach(handler => {
    try {
      handler(message);
    } catch (error) {
      console.error('[BroadcastSync] Handler error:', error);
    }
  });
}

/**
 * Broadcast a state update to other tabs
 */
export function broadcastStateUpdate(key: string, value: unknown): void {
  if (!channel) return;

  const message: SyncMessage = {
    type: 'STATE_UPDATE',
    tabId,
    timestamp: Date.now(),
    payload: { key, value } as StateUpdatePayload
  };

  try {
    channel.postMessage(message);
  } catch (error) {
    console.error('[BroadcastSync] Failed to broadcast:', error);
  }
}

/**
 * Request current state from leader tab
 */
export function requestState(): void {
  if (!channel) return;

  const message: SyncMessage = {
    type: 'REQUEST_STATE',
    tabId,
    timestamp: Date.now()
  };

  channel.postMessage(message);
}

/**
 * Send state response (leader only)
 */
function sendStateResponse(): void {
  if (!channel || !isLeader) return;

  // Get current state from storage
  const stateKey = 'ipcha-mistabra-storage';
  const state = localStorage.getItem(stateKey);

  if (state) {
    const message: SyncMessage = {
      type: 'STATE_RESPONSE',
      tabId,
      timestamp: Date.now(),
      payload: { key: stateKey, value: state }
    };

    channel.postMessage(message);
  }
}

/**
 * Leader Election Protocol
 * Uses timestamp-based election - oldest tab becomes leader
 */
function startLeaderElection(): void {
  if (!channel) return;

  // Announce candidacy
  const message: SyncMessage = {
    type: 'LEADER_ELECTION',
    tabId,
    timestamp: Date.now(),
    payload: { candidateStart: Date.now() }
  };

  channel.postMessage(message);

  // Wait for other tabs to respond
  setTimeout(() => {
    if (!leaderTabId || leaderTabId === tabId) {
      becomeLeader();
    }
  }, 500);
}

/**
 * Handle leader election messages
 */
function handleLeaderElection(message: SyncMessage): void {
  const candidateStart = (message.payload as { candidateStart: number })?.candidateStart || message.timestamp;
  const myStart = parseInt(tabId.split('-')[1], 10);

  // Lower timestamp wins (older tab)
  if (candidateStart < myStart) {
    leaderTabId = message.tabId;
    isLeader = false;
    console.log('[BroadcastSync] New leader:', message.tabId);
  }
}

/**
 * Become the leader tab
 */
function becomeLeader(): void {
  isLeader = true;
  leaderTabId = tabId;
  console.log('[BroadcastSync] This tab is now the leader');

  // Start heartbeat
  if (leaderHeartbeatInterval) {
    clearInterval(leaderHeartbeatInterval);
  }

  leaderHeartbeatInterval = window.setInterval(() => {
    if (channel && isLeader) {
      channel.postMessage({
        type: 'LEADER_ELECTION',
        tabId,
        timestamp: Date.now(),
        payload: { heartbeat: true }
      } as SyncMessage);
    }
  }, 5000);
}

/**
 * Register a message handler
 */
export function onSync(handler: MessageHandler): () => void {
  messageHandlers.add(handler);

  return () => {
    messageHandlers.delete(handler);
  };
}

/**
 * Check if this tab is the leader
 */
export function isLeaderTab(): boolean {
  return isLeader;
}

/**
 * Get current tab ID
 */
export function getTabId(): string {
  return tabId;
}

/**
 * Close channel (cleanup)
 */
export function closeBroadcastSync(): void {
  if (leaderHeartbeatInterval) {
    clearInterval(leaderHeartbeatInterval);
    leaderHeartbeatInterval = null;
  }

  if (channel) {
    channel.close();
    channel = null;
  }

  isLeader = false;
  leaderTabId = null;
  messageHandlers.clear();
}

/**
 * Create Zustand middleware for broadcast sync
 */
export function createBroadcastMiddleware<T>(
  storeKey: string,
  onExternalUpdate: (state: Partial<T>) => void
): void {
  initBroadcastSync();

  onSync((message) => {
    if (message.type === 'STATE_UPDATE' || message.type === 'STATE_RESPONSE') {
      const payload = message.payload as StateUpdatePayload;
      if (payload?.key === storeKey && payload?.value) {
        try {
          const parsed = typeof payload.value === 'string'
            ? JSON.parse(payload.value)
            : payload.value;

          if (parsed?.state) {
            onExternalUpdate(parsed.state);
          }
        } catch (error) {
          console.error('[BroadcastSync] Failed to parse state update:', error);
        }
      }
    }
  });
}

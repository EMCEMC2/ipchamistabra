/**
 * Time Synchronization Service
 * Ensures accurate timestamps for regulatory compliance
 */

interface TimeSyncStatus {
  lastSync: number;
  offset: number;
  drift: number;
  syncSource: string;
  isValid: boolean;
}

let syncStatus: TimeSyncStatus = {
  lastSync: 0,
  offset: 0,
  drift: 0,
  syncSource: 'local',
  isValid: false
};

const SYNC_INTERVAL = 60000; // 1 minute
const MAX_DRIFT_MS = 1000; // 1 second max drift
const TIME_SERVERS = [
  'https://api.binance.com/api/v3/time',
  'https://api.coingecko.com/api/v3/ping'
];

let syncInterval: number | null = null;

/**
 * Get server time from Binance
 */
async function fetchServerTime(): Promise<{ serverTime: number; source: string } | null> {
  for (const server of TIME_SERVERS) {
    try {
      const startTime = Date.now();
      const response = await fetch(server, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) continue;

      const roundTripTime = Date.now() - startTime;
      const data = await response.json();

      // Binance returns serverTime directly
      if (data.serverTime) {
        return {
          serverTime: data.serverTime + (roundTripTime / 2),
          source: server
        };
      }

      // Other servers - use local time as fallback
      return {
        serverTime: Date.now(),
        source: 'local'
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Synchronize with server time
 */
export async function syncTime(): Promise<TimeSyncStatus> {
  const localBefore = Date.now();

  try {
    const result = await fetchServerTime();

    if (result) {
      const localAfter = Date.now();
      const localMidpoint = (localBefore + localAfter) / 2;

      const newOffset = result.serverTime - localMidpoint;
      const drift = syncStatus.lastSync > 0
        ? Math.abs(newOffset - syncStatus.offset)
        : 0;

      syncStatus = {
        lastSync: Date.now(),
        offset: newOffset,
        drift,
        syncSource: result.source,
        isValid: Math.abs(newOffset) < MAX_DRIFT_MS * 10
      };

      if (drift > MAX_DRIFT_MS) {
        console.warn(`[TimeSync] Clock drift detected: ${drift}ms`);
      }
    }
  } catch (error) {
    console.error('[TimeSync] Sync failed:', error);
  }

  return syncStatus;
}

/**
 * Get synchronized timestamp
 */
export function getSyncedTime(): number {
  return Date.now() + syncStatus.offset;
}

/**
 * Get synchronized date
 */
export function getSyncedDate(): Date {
  return new Date(getSyncedTime());
}

/**
 * Get ISO timestamp (synchronized)
 */
export function getSyncedISOString(): string {
  return getSyncedDate().toISOString();
}

/**
 * Get sync status
 */
export function getSyncStatus(): TimeSyncStatus {
  return { ...syncStatus };
}

/**
 * Check if time is synchronized
 */
export function isTimeSynced(): boolean {
  const age = Date.now() - syncStatus.lastSync;
  return syncStatus.isValid && age < SYNC_INTERVAL * 5;
}

/**
 * Get clock offset
 */
export function getClockOffset(): number {
  return syncStatus.offset;
}

/**
 * Validate timestamp is within acceptable range
 */
export function isTimestampValid(timestamp: number, maxAgeMs: number = 300000): boolean {
  const syncedNow = getSyncedTime();
  const age = Math.abs(syncedNow - timestamp);
  return age < maxAgeMs;
}

/**
 * Start periodic time sync
 */
export function startTimeSync(intervalMs: number = SYNC_INTERVAL): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Initial sync
  syncTime();

  // Periodic sync
  syncInterval = window.setInterval(() => {
    syncTime();
  }, intervalMs);

  console.log('[TimeSync] Started periodic sync');
}

/**
 * Stop periodic time sync
 */
export function stopTimeSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 23);
}

/**
 * Get time until next sync
 */
export function getTimeUntilNextSync(): number {
  if (!syncInterval) return -1;
  const elapsed = Date.now() - syncStatus.lastSync;
  return Math.max(0, SYNC_INTERVAL - elapsed);
}

// Auto-start time sync
if (typeof window !== 'undefined') {
  startTimeSync();
}

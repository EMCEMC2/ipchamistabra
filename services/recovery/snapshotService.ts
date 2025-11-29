/**
 * State Snapshot Service
 * Creates and restores state snapshots for disaster recovery
 */

import * as storage from '../storage';
import { getSyncedTime, getSyncedISOString } from '../compliance/timeSync';

const SNAPSHOT_PREFIX = 'snapshot-';
const MAX_SNAPSHOTS = 10;
const AUTO_SNAPSHOT_INTERVAL = 300000; // 5 minutes

export interface StateSnapshot {
  id: string;
  timestamp: number;
  isoTimestamp: string;
  version: number;
  size: number;
  checksum: string;
  state: Record<string, unknown>;
  metadata: {
    trigger: 'auto' | 'manual' | 'pre-trade' | 'error';
    description?: string;
  };
}

export interface SnapshotSummary {
  id: string;
  timestamp: number;
  isoTimestamp: string;
  size: number;
  trigger: string;
  description?: string;
}

let autoSnapshotInterval: number | null = null;
let stateProvider: (() => Record<string, unknown>) | null = null;

/**
 * Generate simple checksum for integrity verification
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `chk-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Generate snapshot ID
 */
function generateSnapshotId(): string {
  return `${SNAPSHOT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a state snapshot
 */
export async function createSnapshot(
  state: Record<string, unknown>,
  trigger: StateSnapshot['metadata']['trigger'] = 'manual',
  description?: string
): Promise<StateSnapshot> {
  const timestamp = getSyncedTime();
  const id = generateSnapshotId();

  const stateJson = JSON.stringify(state);
  const checksum = generateChecksum(stateJson);

  const snapshot: StateSnapshot = {
    id,
    timestamp,
    isoTimestamp: getSyncedISOString(),
    version: 1,
    size: stateJson.length,
    checksum,
    state,
    metadata: {
      trigger,
      description
    }
  };

  // Save to storage
  await storage.set(id, snapshot);

  // Cleanup old snapshots
  await cleanupOldSnapshots();

  console.log(`[SnapshotService] Created snapshot: ${id} (${formatSize(snapshot.size)})`);

  return snapshot;
}

/**
 * Restore state from snapshot
 */
export async function restoreSnapshot(snapshotId: string): Promise<Record<string, unknown> | null> {
  const snapshot = await storage.get<StateSnapshot>(snapshotId);

  if (!snapshot) {
    console.error(`[SnapshotService] Snapshot not found: ${snapshotId}`);
    return null;
  }

  // Verify checksum
  const stateJson = JSON.stringify(snapshot.state);
  const expectedChecksum = generateChecksum(stateJson);

  if (expectedChecksum !== snapshot.checksum) {
    console.error(`[SnapshotService] Checksum mismatch for ${snapshotId}`);
    return null;
  }

  console.log(`[SnapshotService] Restored snapshot: ${snapshotId}`);
  return snapshot.state;
}

/**
 * List all available snapshots
 */
export async function listSnapshots(): Promise<SnapshotSummary[]> {
  const keys = await storage.getAllKeys();
  const snapshotKeys = keys.filter(k => k.startsWith(SNAPSHOT_PREFIX));

  const summaries: SnapshotSummary[] = [];

  for (const key of snapshotKeys) {
    const snapshot = await storage.get<StateSnapshot>(key);
    if (snapshot) {
      summaries.push({
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        isoTimestamp: snapshot.isoTimestamp,
        size: snapshot.size,
        trigger: snapshot.metadata.trigger,
        description: snapshot.metadata.description
      });
    }
  }

  // Sort by timestamp descending (newest first)
  return summaries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Delete a specific snapshot
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  await storage.remove(snapshotId);
  console.log(`[SnapshotService] Deleted snapshot: ${snapshotId}`);
  return true;
}

/**
 * Cleanup old snapshots (keep only MAX_SNAPSHOTS)
 */
async function cleanupOldSnapshots(): Promise<void> {
  const snapshots = await listSnapshots();

  if (snapshots.length > MAX_SNAPSHOTS) {
    const toDelete = snapshots.slice(MAX_SNAPSHOTS);
    for (const snapshot of toDelete) {
      await deleteSnapshot(snapshot.id);
    }
    console.log(`[SnapshotService] Cleaned up ${toDelete.length} old snapshots`);
  }
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(): Promise<StateSnapshot | null> {
  const snapshots = await listSnapshots();
  if (snapshots.length === 0) return null;

  const latest = snapshots[0];
  return storage.get<StateSnapshot>(latest.id);
}

/**
 * Start automatic snapshots
 */
export function startAutoSnapshot(
  getState: () => Record<string, unknown>,
  intervalMs: number = AUTO_SNAPSHOT_INTERVAL
): void {
  stateProvider = getState;

  if (autoSnapshotInterval) {
    clearInterval(autoSnapshotInterval);
  }

  autoSnapshotInterval = window.setInterval(async () => {
    if (stateProvider) {
      try {
        await createSnapshot(stateProvider(), 'auto', 'Automatic periodic snapshot');
      } catch (error) {
        console.error('[SnapshotService] Auto snapshot failed:', error);
      }
    }
  }, intervalMs);

  // Create initial snapshot
  createSnapshot(getState(), 'auto', 'Initial auto snapshot');

  console.log(`[SnapshotService] Auto snapshot started (every ${intervalMs / 1000}s)`);
}

/**
 * Stop automatic snapshots
 */
export function stopAutoSnapshot(): void {
  if (autoSnapshotInterval) {
    clearInterval(autoSnapshotInterval);
    autoSnapshotInterval = null;
  }
  stateProvider = null;
  console.log('[SnapshotService] Auto snapshot stopped');
}

/**
 * Create pre-trade snapshot
 */
export async function createPreTradeSnapshot(
  state: Record<string, unknown>,
  tradeDetails: Record<string, unknown>
): Promise<StateSnapshot> {
  return createSnapshot(
    state,
    'pre-trade',
    `Pre-trade: ${JSON.stringify(tradeDetails).slice(0, 100)}`
  );
}

/**
 * Create error recovery snapshot
 */
export async function createErrorSnapshot(
  state: Record<string, unknown>,
  error: Error | string
): Promise<StateSnapshot> {
  const errorMsg = error instanceof Error ? error.message : error;
  return createSnapshot(state, 'error', `Error: ${errorMsg.slice(0, 100)}`);
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get snapshot storage usage
 */
export async function getSnapshotStorageUsage(): Promise<{
  count: number;
  totalSize: number;
  formattedSize: string;
}> {
  const snapshots = await listSnapshots();
  const totalSize = snapshots.reduce((sum, s) => sum + s.size, 0);

  return {
    count: snapshots.length,
    totalSize,
    formattedSize: formatSize(totalSize)
  };
}

/**
 * Export snapshots for backup
 */
export async function exportSnapshots(): Promise<string> {
  const snapshots = await listSnapshots();
  const fullSnapshots: StateSnapshot[] = [];

  for (const summary of snapshots) {
    const snapshot = await storage.get<StateSnapshot>(summary.id);
    if (snapshot) {
      fullSnapshots.push(snapshot);
    }
  }

  return JSON.stringify(fullSnapshots, null, 2);
}

/**
 * Import snapshots from backup
 */
export async function importSnapshots(data: string): Promise<number> {
  try {
    const snapshots: StateSnapshot[] = JSON.parse(data);
    let imported = 0;

    for (const snapshot of snapshots) {
      // Verify it's a valid snapshot
      if (snapshot.id && snapshot.state && snapshot.checksum) {
        await storage.set(snapshot.id, snapshot);
        imported++;
      }
    }

    console.log(`[SnapshotService] Imported ${imported} snapshots`);
    return imported;
  } catch (error) {
    console.error('[SnapshotService] Import failed:', error);
    return 0;
  }
}

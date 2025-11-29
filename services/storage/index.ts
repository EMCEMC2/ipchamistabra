/**
 * Storage Module
 * Re-exports all storage-related functionality
 */

export {
  get,
  set,
  remove,
  getAllKeys,
  clear,
  isAvailable,
  getStorageEstimate,
  requestPersistence,
  indexedDBStorage,
  migrateFromLocalStorage,
  close
} from './indexedDB';

export {
  initBroadcastSync,
  broadcastStateUpdate,
  requestState,
  onSync,
  isLeaderTab,
  getTabId,
  closeBroadcastSync,
  createBroadcastMiddleware
} from './broadcastSync';

export {
  initOfflineQueue,
  enqueue,
  registerHandler,
  getQueueStatus,
  isCurrentlyOnline,
  clearQueue,
  forceProcessQueue,
  getPendingOperations,
  removeOperation,
  cleanupOfflineQueue
} from './offlineQueue';

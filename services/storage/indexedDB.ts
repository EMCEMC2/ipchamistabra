/**
 * IndexedDB Storage Service
 * Robust persistence layer replacing localStorage
 * Supports larger data sets, async operations, and better reliability
 */

const DB_NAME = 'ipcha-mistabra';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';

interface DBSchema {
  key: string;
  value: unknown;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or get existing database connection
 */
async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database:', request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle connection loss
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      dbInstance.onerror = (event) => {
        console.error('[IndexedDB] Database error:', (event.target as IDBRequest).error);
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create main store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        console.log('[IndexedDB] Created object store:', STORE_NAME);
      }
    };
  });

  return dbPromise;
}

/**
 * Execute a transaction with error handling
 */
async function withTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get a value by key
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const result = await withTransaction<DBSchema | undefined>(
      'readonly',
      (store) => store.get(key)
    );
    return result ? (result.value as T) : null;
  } catch (error) {
    console.error(`[IndexedDB] Get error for key "${key}":`, error);
    return null;
  }
}

/**
 * Set a value by key
 */
export async function set<T>(key: string, value: T): Promise<void> {
  try {
    await withTransaction<IDBValidKey>(
      'readwrite',
      (store) => store.put({
        key,
        value,
        updatedAt: Date.now()
      })
    );
  } catch (error) {
    console.error(`[IndexedDB] Set error for key "${key}":`, error);
    throw error;
  }
}

/**
 * Delete a value by key
 */
export async function remove(key: string): Promise<void> {
  try {
    await withTransaction<undefined>(
      'readwrite',
      (store) => store.delete(key)
    );
  } catch (error) {
    console.error(`[IndexedDB] Delete error for key "${key}":`, error);
    throw error;
  }
}

/**
 * Get all keys in the store
 */
export async function getAllKeys(): Promise<string[]> {
  try {
    const result = await withTransaction<IDBValidKey[]>(
      'readonly',
      (store) => store.getAllKeys()
    );
    return result as string[];
  } catch (error) {
    console.error('[IndexedDB] getAllKeys error:', error);
    return [];
  }
}

/**
 * Clear all data
 */
export async function clear(): Promise<void> {
  try {
    await withTransaction<undefined>(
      'readwrite',
      (store) => store.clear()
    );
    console.log('[IndexedDB] Store cleared');
  } catch (error) {
    console.error('[IndexedDB] Clear error:', error);
    throw error;
  }
}

/**
 * Check if IndexedDB is available
 */
export function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Get storage usage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  } catch {
    return null;
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Zustand persist storage adapter for IndexedDB
 */
export const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get<string>(name);
    return value;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },

  removeItem: async (name: string): Promise<void> => {
    await remove(name);
  }
};

/**
 * Migration helper: Import from localStorage
 */
export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        await set(key, value);
        console.log(`[IndexedDB] Migrated key "${key}" from localStorage`);
      }
    } catch (error) {
      console.error(`[IndexedDB] Migration error for key "${key}":`, error);
    }
  }
}

/**
 * Close database connection (for cleanup)
 */
export function close(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

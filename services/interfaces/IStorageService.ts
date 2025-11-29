/**
 * Storage Service Interface
 * Abstracts persistence operations
 */

export interface StorageOptions {
  ttl?: number; // Time to live in ms
  encrypt?: boolean;
  compress?: boolean;
}

export interface StorageMetadata {
  key: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

/**
 * Storage Service Interface
 * All storage services must implement this interface
 */
export interface IStorageService {
  /**
   * Service identifier
   */
  readonly name: string;

  /**
   * Check if storage is available
   */
  isAvailable(): boolean;

  /**
   * Get value by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value with optional options
   */
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;

  /**
   * Delete value by key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Get all keys
   */
  keys(): Promise<string[]>;

  /**
   * Get all keys matching pattern
   */
  keysMatching(pattern: string): Promise<string[]>;

  /**
   * Clear all data
   */
  clear(): Promise<void>;

  /**
   * Get storage usage stats
   */
  getUsage(): Promise<{
    used: number;
    quota: number;
    itemCount: number;
  }>;

  /**
   * Get metadata for a key
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;

  /**
   * Clean up expired items
   */
  cleanup(): Promise<number>;
}

/**
 * Sync Storage Interface
 * For synchronous storage operations (localStorage-like)
 */
export interface ISyncStorageService {
  /**
   * Get value synchronously
   */
  getSync<T>(key: string): T | null;

  /**
   * Set value synchronously
   */
  setSync<T>(key: string, value: T): void;

  /**
   * Delete value synchronously
   */
  deleteSync(key: string): boolean;

  /**
   * Check if key exists synchronously
   */
  hasSync(key: string): boolean;
}

/**
 * Cache Service Interface
 * Specialized caching with TTL support
 */
export interface ICacheService extends IStorageService {
  /**
   * Get or compute value (cache-aside pattern)
   */
  getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T>;

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string): Promise<number>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }>;
}

/**
 * State Persistence Interface
 * For application state persistence
 */
export interface IStatePersistence<T> {
  /**
   * Load persisted state
   */
  load(): Promise<T | null>;

  /**
   * Save current state
   */
  save(state: T): Promise<void>;

  /**
   * Create state snapshot
   */
  snapshot(): Promise<string>;

  /**
   * Restore from snapshot
   */
  restore(snapshotId: string): Promise<T>;

  /**
   * List available snapshots
   */
  listSnapshots(): Promise<{
    id: string;
    timestamp: number;
    size: number;
  }[]>;

  /**
   * Delete snapshot
   */
  deleteSnapshot(snapshotId: string): Promise<boolean>;
}

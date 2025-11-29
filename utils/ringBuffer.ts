/**
 * Ring Buffer Implementation
 * O(1) append operations for bounded collections
 * Useful for logs, history, and any fixed-size collection
 */

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('RingBuffer capacity must be at least 1');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add item to the buffer - O(1)
   * If buffer is full, oldest item is overwritten
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer is full, move head forward (oldest item lost)
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Add multiple items - O(n) where n = items.length
   */
  pushMany(items: T[]): void {
    for (const item of items) {
      this.push(item);
    }
  }

  /**
   * Get item at index (0 = oldest) - O(1)
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined;
    }
    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  /**
   * Get the most recent item - O(1)
   */
  peek(): T | undefined {
    if (this.count === 0) return undefined;
    const lastIndex = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
  }

  /**
   * Get the oldest item - O(1)
   */
  peekFirst(): T | undefined {
    if (this.count === 0) return undefined;
    return this.buffer[this.head];
  }

  /**
   * Remove and return the oldest item - O(1)
   */
  shift(): T | undefined {
    if (this.count === 0) return undefined;

    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }

  /**
   * Convert to array (oldest first) - O(n)
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Convert to array (newest first) - O(n)
   */
  toArrayReversed(): T[] {
    const result: T[] = [];
    for (let i = this.count - 1; i >= 0; i--) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get last N items (newest first) - O(n)
   */
  getLast(n: number): T[] {
    const count = Math.min(n, this.count);
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      const index = (this.tail - 1 - i + this.capacity) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Find items matching predicate - O(n)
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this.toArray().filter(predicate);
  }

  /**
   * Find first item matching predicate - O(n)
   */
  find(predicate: (item: T) => boolean): T | undefined {
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined && predicate(item)) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Iterate over items (oldest first)
   */
  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  /**
   * Map items to new array - O(n)
   */
  map<U>(mapper: (item: T, index: number) => U): U[] {
    const result: U[] = [];
    this.forEach((item, index) => {
      result.push(mapper(item, index));
    });
    return result;
  }

  /**
   * Clear all items - O(1)
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Current number of items
   */
  get size(): number {
    return this.count;
  }

  /**
   * Maximum capacity
   */
  get maxSize(): number {
    return this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Create from existing array
   */
  static from<T>(items: T[], capacity?: number): RingBuffer<T> {
    const cap = capacity || items.length;
    const buffer = new RingBuffer<T>(cap);
    buffer.pushMany(items);
    return buffer;
  }

  /**
   * Create iterator
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined) {
        yield item;
      }
    }
  }
}

/**
 * Specialized log buffer with timestamp support
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  [key: string]: unknown;
}

export class LogBuffer<T extends LogEntry> extends RingBuffer<T> {
  constructor(capacity: number = 500) {
    super(capacity);
  }

  /**
   * Get entries within time range
   */
  getByTimeRange(startMs: number, endMs: number): T[] {
    return this.filter(
      entry => entry.timestamp >= startMs && entry.timestamp <= endMs
    );
  }

  /**
   * Get entries from last N milliseconds
   */
  getRecent(durationMs: number): T[] {
    const cutoff = Date.now() - durationMs;
    return this.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Search entries by message content
   */
  search(query: string): T[] {
    const lowerQuery = query.toLowerCase();
    return this.filter(
      entry => entry.message.toLowerCase().includes(lowerQuery)
    );
  }
}

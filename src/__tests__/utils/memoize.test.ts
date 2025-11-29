/**
 * Memoization Tests
 * Tests for caching utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { memoizeWithLRU, memoizeWithTTL, debounce, throttle } from '../../utils/memoize';

describe('memoizeWithLRU', () => {
  it('should cache function results', () => {
    const expensiveFn = vi.fn((x: number) => x * 2);
    const memoized = memoizeWithLRU(expensiveFn, 10);

    expect(memoized(5)).toBe(10);
    expect(memoized(5)).toBe(10);
    expect(expensiveFn).toHaveBeenCalledTimes(1);
  });

  it('should evict oldest entries when capacity exceeded', () => {
    const fn = vi.fn((x: number) => x * 2);
    const memoized = memoizeWithLRU(fn, 3);

    memoized(1);
    memoized(2);
    memoized(3);
    memoized(4); // Should evict 1

    expect(fn).toHaveBeenCalledTimes(4);

    // 1 should be evicted, so it will be recomputed
    memoized(1);
    expect(fn).toHaveBeenCalledTimes(5);

    // 4 should still be cached
    memoized(4);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('should use custom key generator', () => {
    interface Obj { id: number; name: string }
    const fn = vi.fn((obj: Obj) => obj.name.toUpperCase());
    const memoized = memoizeWithLRU(fn, 10, (obj: Obj) => obj.id.toString());

    memoized({ id: 1, name: 'alice' });
    memoized({ id: 1, name: 'different' }); // Same id, should use cache

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple arguments', () => {
    const fn = vi.fn((a: number, b: number) => a + b);
    const memoized = memoizeWithLRU(fn, 10);

    memoized(1, 2);
    memoized(1, 2);
    memoized(1, 3); // Different args

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('memoizeWithTTL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should cache results within TTL', () => {
    const fn = vi.fn((x: number) => x * 2);
    const memoized = memoizeWithTTL(fn, 5000); // 5 second TTL

    expect(memoized(5)).toBe(10);
    vi.advanceTimersByTime(3000);
    expect(memoized(5)).toBe(10);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should expire cache after TTL', () => {
    const fn = vi.fn((x: number) => x * 2);
    const memoized = memoizeWithTTL(fn, 5000);

    memoized(5);
    vi.advanceTimersByTime(6000);
    memoized(5);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle different keys independently', () => {
    const fn = vi.fn((x: number) => x * 2);
    const memoized = memoizeWithTTL(fn, 5000);

    memoized(1);
    vi.advanceTimersByTime(3000);
    memoized(2);
    vi.advanceTimersByTime(3000);

    // Key 1 should be expired, key 2 should still be cached
    memoized(1); // Recomputed
    memoized(2); // From cache

    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);

    debounced();
    vi.advanceTimersByTime(500);
    debounced();
    vi.advanceTimersByTime(500);
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments correctly', () => {
    const fn = vi.fn((a: number, b: string) => {});
    const debounced = debounce(fn, 1000);

    debounced(42, 'test');
    vi.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledWith(42, 'test');
  });

  it('should use latest arguments', () => {
    const fn = vi.fn((x: number) => {});
    const debounced = debounce(fn, 1000);

    debounced(1);
    debounced(2);
    debounced(3);
    vi.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledWith(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throttle subsequent calls', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after throttle period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled();
    vi.advanceTimersByTime(1001);
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments correctly', () => {
    const fn = vi.fn((x: number) => {});
    const throttled = throttle(fn, 1000);

    throttled(42);
    expect(fn).toHaveBeenCalledWith(42);
  });

  it('should handle rapid calls with timer advancing', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 1000);

    throttled(); // Executes
    vi.advanceTimersByTime(500);
    throttled(); // Ignored
    vi.advanceTimersByTime(600);
    throttled(); // Executes (1100ms total)

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

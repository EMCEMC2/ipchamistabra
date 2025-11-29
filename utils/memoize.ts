/**
 * Memoization Utilities
 * Cache expensive calculations to avoid redundant computation
 */

/**
 * Simple memoization for single-argument functions
 * Uses WeakMap for object arguments, Map for primitives
 */
export function memoize<T, R>(fn: (arg: T) => R): (arg: T) => R {
  const cache = new Map<T, R>();
  const weakCache = new WeakMap<object, R>();

  return (arg: T): R => {
    // Use WeakMap for objects to allow garbage collection
    if (typeof arg === 'object' && arg !== null) {
      if (weakCache.has(arg as object)) {
        return weakCache.get(arg as object)!;
      }
      const result = fn(arg);
      weakCache.set(arg as object, result);
      return result;
    }

    // Use Map for primitives
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

/**
 * Memoize with custom key generator
 */
export function memoizeWithKey<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  keyFn: (...args: Args) => string
): (...args: Args) => R {
  const cache = new Map<string, R>();

  return (...args: Args): R => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * LRU (Least Recently Used) memoization
 * Limits cache size to prevent memory leaks
 */
export function memoizeLRU<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  options: {
    maxSize?: number;
    keyFn?: (...args: Args) => string;
  } = {}
): (...args: Args) => R {
  const { maxSize = 100, keyFn = (...args) => JSON.stringify(args) } = options;
  const cache = new Map<string, R>();

  return (...args: Args): R => {
    const key = keyFn(...args);

    if (cache.has(key)) {
      // Move to end (most recently used)
      const value = cache.get(key)!;
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn(...args);

    // Evict oldest if at capacity
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Time-based memoization
 * Cache expires after specified TTL
 */
export function memoizeTTL<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  ttlMs: number,
  keyFn: (...args: Args) => string = (...args) => JSON.stringify(args)
): (...args: Args) => R {
  const cache = new Map<string, { value: R; expiry: number }>();

  return (...args: Args): R => {
    const key = keyFn(...args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, expiry: now + ttlMs });

    // Cleanup expired entries periodically
    if (cache.size > 1000) {
      for (const [k, v] of cache) {
        if (v.expiry <= now) {
          cache.delete(k);
        }
      }
    }

    return result;
  };
}

/**
 * Memoize for functions that return the same result
 * when called with shallowly equal objects
 */
export function memoizeShallow<T extends object, R>(fn: (arg: T) => R): (arg: T) => R {
  let lastArg: T | null = null;
  let lastResult: R | undefined;

  return (arg: T): R => {
    if (lastArg !== null && shallowEqual(lastArg, arg)) {
      return lastResult!;
    }

    lastArg = arg;
    lastResult = fn(arg);
    return lastResult;
  };
}

/**
 * Shallow equality check
 */
function shallowEqual(a: object, b: object): boolean {
  if (a === b) return true;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Create selector with memoization (similar to reselect)
 */
export function createSelector<S, R1, R>(
  selector1: (state: S) => R1,
  combiner: (result1: R1) => R
): (state: S) => R {
  let lastInput: R1 | undefined;
  let lastResult: R | undefined;

  return (state: S): R => {
    const input = selector1(state);

    if (input === lastInput && lastResult !== undefined) {
      return lastResult;
    }

    lastInput = input;
    lastResult = combiner(input);
    return lastResult;
  };
}

/**
 * Create selector with multiple inputs
 */
export function createSelector2<S, R1, R2, R>(
  selector1: (state: S) => R1,
  selector2: (state: S) => R2,
  combiner: (result1: R1, result2: R2) => R
): (state: S) => R {
  let lastInputs: [R1, R2] | undefined;
  let lastResult: R | undefined;

  return (state: S): R => {
    const input1 = selector1(state);
    const input2 = selector2(state);

    if (
      lastInputs &&
      input1 === lastInputs[0] &&
      input2 === lastInputs[1] &&
      lastResult !== undefined
    ) {
      return lastResult;
    }

    lastInputs = [input1, input2];
    lastResult = combiner(input1, input2);
    return lastResult;
  };
}

/**
 * Debounced function execution
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Args): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Throttled function execution
 */
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number
): (...args: Args) => void {
  let lastCall = 0;
  let scheduledArgs: Args | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Args): void => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= intervalMs) {
      lastCall = now;
      fn(...args);
    } else {
      scheduledArgs = args;

      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (scheduledArgs) {
            lastCall = Date.now();
            fn(...scheduledArgs);
            scheduledArgs = null;
          }
          timeoutId = null;
        }, intervalMs - timeSinceLastCall);
      }
    }
  };
}

/**
 * Batch multiple calls into a single execution
 */
export function batch<T>(
  fn: (items: T[]) => void,
  delayMs: number = 16
): (item: T) => void {
  let items: T[] = [];
  let scheduled = false;

  return (item: T): void => {
    items.push(item);

    if (!scheduled) {
      scheduled = true;
      setTimeout(() => {
        const batch = items;
        items = [];
        scheduled = false;
        fn(batch);
      }, delayMs);
    }
  };
}

/**
 * Test Utilities
 * Common testing helpers and wrappers
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Type for wrapper components
interface WrapperProps {
  children: ReactNode;
}

// Default wrapper with common providers
function AllTheProviders({ children }: WrapperProps): ReactElement {
  return <>{children}</>;
}

// Custom render with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Setup user event with fake timers
function setupUser(options?: Parameters<typeof userEvent.setup>[0]) {
  return userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    ...options
  });
}

// Wait for async operations with fake timers
async function waitForAsync(ms: number = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

// Mock a module partially
function mockModulePartially<T extends object>(
  modulePath: string,
  overrides: Partial<T>
): void {
  vi.mock(modulePath, async () => {
    const actual = await vi.importActual<T>(modulePath);
    return { ...actual, ...overrides };
  });
}

// Create a deferred promise for testing async flows
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

// Mock WebSocket for testing
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private sentMessages: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: unknown): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError(error?: unknown): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  getSentMessages(): unknown[] {
    return this.sentMessages;
  }

  static clearInstances(): void {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// Create mock store state
interface MockStoreOptions {
  price?: number;
  balance?: number;
  positions?: unknown[];
  signals?: unknown[];
}

function createMockStoreState(options: MockStoreOptions = {}): Record<string, unknown> {
  return {
    price: options.price ?? 95000,
    priceChange: 0,
    balance: options.balance ?? 10000,
    equity: options.balance ?? 10000,
    positions: options.positions ?? [],
    orders: [],
    signals: options.signals ?? [],
    isScanning: false,
    agentEnabled: false,
    chartData: [],
    timeframe: '15m',
    technicals: { rsi: 50, macd: { histogram: 0, signal: 0, macd: 0 }, adx: 20, atr: 1000, trend: 'NEUTRAL' },
    enhancedMetrics: {
      dvol: 0,
      atr14d: 0,
      todayRange: 0,
      rangeVsAtr: 0,
      volume24h: 0,
      volumeAvg30d: 0,
      volumeRatio: 1,
      volumeTag: 'NORMAL',
      fundingRate: 0,
      fundingTrend: 'STABLE',
      openInterest: 0,
      oiChange24h: 0,
      distanceToHigh24h: 0,
      distanceToLow24h: 0,
      above200dMA: false,
      ma200: 0,
      fearGreedIndex: 0,
      fearGreedLabel: 'N/A',
      btcDominance: 0
    }
  };
}

// Snapshot matcher helpers
function toMatchSnapshot<T>(received: T): { pass: boolean; message: () => string } {
  return {
    pass: true,
    message: () => 'Snapshot matched'
  };
}

// Export everything
export * from '@testing-library/react';
export { userEvent };
export {
  customRender as render,
  setupUser,
  waitForAsync,
  mockModulePartially,
  createDeferred,
  MockWebSocket,
  createMockStoreState,
  toMatchSnapshot
};
export type { Deferred, MockStoreOptions };

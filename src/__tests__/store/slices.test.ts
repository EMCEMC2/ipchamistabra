/**
 * Store Slices Tests
 * Tests for Zustand store slices
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketSlice, defaultEnhancedMetrics, type MarketSlice } from '../../store/slices/marketSlice';
import { createPortfolioSlice, type PortfolioSlice } from '../../store/slices/portfolioSlice';
import { createAgentSlice, type AgentSlice } from '../../store/slices/agentSlice';

// Helper to create a minimal store-like set function
function createMockStore<T>(initialState: T) {
  let state = initialState;
  const set = (updater: Partial<T> | ((state: T) => Partial<T>)) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
  };
  const get = () => state;
  return { set, get, getState: () => state };
}

describe('MarketSlice', () => {
  let slice: MarketSlice;

  beforeEach(() => {
    const mockStore = createMockStore({});
    slice = createMarketSlice(
      mockStore.set as Parameters<typeof createMarketSlice>[0],
      mockStore.get as never,
      {} as never
    );
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(slice.price).toBe(0);
      expect(slice.priceChange).toBe(0);
      expect(slice.chartData).toEqual([]);
      expect(slice.signals).toEqual([]);
      expect(slice.isScanning).toBe(false);
    });

    it('should have default enhanced metrics', () => {
      expect(slice.enhancedMetrics).toEqual(defaultEnhancedMetrics);
    });

    it('should have neutral trends', () => {
      expect(slice.trends.price).toBe('neutral');
      expect(slice.trends.vix).toBe('neutral');
      expect(slice.trends.btcd).toBe('neutral');
    });
  });

  describe('actions', () => {
    it('setPrice should update price and timestamp', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.setPrice(95000);
      const state = mockStore.getState();

      expect(state.price).toBe(95000);
      expect(state.lastPriceUpdate).toBeGreaterThan(0);
    });

    it('setPriceChange should update price change', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.setPriceChange(2.5);
      expect(mockStore.getState().priceChange).toBe(2.5);
    });

    it('setChartData should update chart data', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const chartData = [
        { time: 1000, open: 94000, high: 95000, low: 93500, close: 94500, volume: 100 }
      ];

      sliceWithStore.setChartData(chartData as never);
      expect(mockStore.getState().chartData).toEqual(chartData);
    });

    it('setSignals should update signals', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const signals = [
        { id: '1', type: 'LONG', confidence: 0.8, entryPrice: 95000 }
      ];

      sliceWithStore.setSignals(signals as never);
      expect(mockStore.getState().signals).toEqual(signals);
    });

    it('setTechnicals should update technicals', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const technicals = {
        rsi: 65,
        macd: { histogram: 50, signal: 45, macd: 55 },
        adx: 25,
        atr: 1500,
        trend: 'BULLISH'
      };

      sliceWithStore.setTechnicals(technicals);
      expect(mockStore.getState().technicals).toEqual(technicals);
    });

    it('setEnhancedMetrics should update enhanced metrics', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const metrics = { ...defaultEnhancedMetrics, dvol: 45, atr14d: 2500 };
      sliceWithStore.setEnhancedMetrics(metrics);

      expect(mockStore.getState().enhancedMetrics).toEqual(metrics);
    });

    it('setMarketMetrics should update multiple fields and timestamp', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createMarketSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.setMarketMetrics({
        vix: 18.5,
        dxy: 104.2,
        btcd: 52.3
      });

      const state = mockStore.getState();
      expect(state.vix).toBe(18.5);
      expect(state.dxy).toBe(104.2);
      expect(state.btcd).toBe(52.3);
      expect(state.lastMacroUpdate).toBeGreaterThan(0);
    });
  });
});

describe('PortfolioSlice', () => {
  let slice: PortfolioSlice;

  beforeEach(() => {
    const mockStore = createMockStore({});
    slice = createPortfolioSlice(
      mockStore.set as never,
      mockStore.get as never,
      {} as never
    );
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(slice.balance).toBe(10000);
      expect(slice.equity).toBe(10000);
      expect(slice.positions).toEqual([]);
      expect(slice.orders).toEqual([]);
      expect(slice.trades).toEqual([]);
      expect(slice.dailyPnL).toBe(0);
    });

    it('should have correct risk settings', () => {
      expect(slice.riskSettings.maxPositionSize).toBe(0.1);
      expect(slice.riskSettings.maxDailyLoss).toBe(0.05);
      expect(slice.riskSettings.maxOpenPositions).toBe(5);
    });
  });

  describe('actions', () => {
    it('setBalance should update balance', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.setBalance(15000);
      expect(mockStore.getState().balance).toBe(15000);
    });

    it('updateRiskSettings should merge settings', () => {
      const mockStore = createMockStore({ riskSettings: { maxPositionSize: 0.1 } });
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.updateRiskSettings({ maxPositionSize: 0.15 });

      const state = mockStore.getState();
      expect(state.riskSettings.maxPositionSize).toBe(0.15);
    });

    it('addPosition should add new position', () => {
      const mockStore = createMockStore({ positions: [] });
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const position = {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: 95000,
        quantity: 0.5,
        openTime: Date.now()
      };

      sliceWithStore.addPosition(position as never);
      expect(mockStore.getState().positions).toContainEqual(position);
    });

    it('updatePosition should update existing position', () => {
      const position = {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 95000,
        quantity: 0.5,
        openTime: Date.now()
      };

      const mockStore = createMockStore({ positions: [position] });
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.updatePosition('pos-1', { quantity: 0.75 });

      const updated = mockStore.getState().positions.find((p: { id: string }) => p.id === 'pos-1');
      expect(updated?.quantity).toBe(0.75);
    });

    it('removePosition should remove position by id', () => {
      const position = {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 95000,
        quantity: 0.5
      };

      const mockStore = createMockStore({ positions: [position] });
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.removePosition('pos-1');
      expect(mockStore.getState().positions).toEqual([]);
    });

    it('addOrder should add new order', () => {
      const mockStore = createMockStore({ orders: [] });
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const order = {
        id: 'ord-1',
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        price: 94000,
        quantity: 0.5,
        status: 'OPEN' as const
      };

      sliceWithStore.addOrder(order as never);
      expect(mockStore.getState().orders).toContainEqual(order);
    });

    it('recordTrade should add trade to history', () => {
      const mockStore = createMockStore({ trades: [] });
      const sliceWithStore = createPortfolioSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const trade = {
        id: 'trade-1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        price: 95000,
        quantity: 0.5,
        timestamp: Date.now(),
        pnl: 500
      };

      sliceWithStore.recordTrade(trade as never);
      expect(mockStore.getState().trades).toContainEqual(trade);
    });
  });
});

describe('AgentSlice', () => {
  let slice: AgentSlice;

  beforeEach(() => {
    const mockStore = createMockStore({});
    slice = createAgentSlice(
      mockStore.set as never,
      mockStore.get as never,
      {} as never
    );
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(slice.agentEnabled).toBe(false);
      expect(slice.isAnalyzing).toBe(false);
      expect(slice.agents).toEqual([]);
      expect(slice.consensus).toBeNull();
    });
  });

  describe('actions', () => {
    it('setAgentEnabled should toggle agent state', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createAgentSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.setAgentEnabled(true);
      expect(mockStore.getState().agentEnabled).toBe(true);

      sliceWithStore.setAgentEnabled(false);
      expect(mockStore.getState().agentEnabled).toBe(false);
    });

    it('setIsAnalyzing should update analyzing state', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createAgentSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.setIsAnalyzing(true);
      expect(mockStore.getState().isAnalyzing).toBe(true);
    });

    it('updateAgentStatus should update specific agent', () => {
      const agents = [
        { id: 'agent-1', name: 'Analyst', status: 'idle', opinion: null }
      ];

      const mockStore = createMockStore({ agents });
      const sliceWithStore = createAgentSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.updateAgentStatus('agent-1', 'active');

      const updated = mockStore.getState().agents.find((a: { id: string }) => a.id === 'agent-1');
      expect(updated?.status).toBe('active');
    });

    it('setAgentOpinion should set agent opinion', () => {
      const agents = [
        { id: 'agent-1', name: 'Analyst', status: 'idle', opinion: null }
      ];

      const mockStore = createMockStore({ agents });
      const sliceWithStore = createAgentSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const opinion = {
        direction: 'LONG' as const,
        confidence: 0.85,
        reasoning: 'Bullish momentum'
      };

      sliceWithStore.setAgentOpinion('agent-1', opinion);

      const updated = mockStore.getState().agents.find((a: { id: string }) => a.id === 'agent-1');
      expect(updated?.opinion).toEqual(opinion);
    });

    it('setConsensus should update consensus', () => {
      const mockStore = createMockStore({});
      const sliceWithStore = createAgentSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      const consensus = {
        direction: 'LONG' as const,
        confidence: 0.78,
        agreeingAgents: 4,
        totalAgents: 5
      };

      sliceWithStore.setConsensus(consensus);
      expect(mockStore.getState().consensus).toEqual(consensus);
    });

    it('clearAgentOpinions should reset all opinions', () => {
      const agents = [
        { id: 'agent-1', name: 'A', status: 'idle', opinion: { direction: 'LONG' } },
        { id: 'agent-2', name: 'B', status: 'idle', opinion: { direction: 'SHORT' } }
      ];

      const mockStore = createMockStore({ agents, consensus: { direction: 'LONG' } });
      const sliceWithStore = createAgentSlice(
        mockStore.set as never,
        mockStore.get as never,
        {} as never
      );

      sliceWithStore.clearAgentOpinions();

      const state = mockStore.getState();
      expect(state.agents.every((a: { opinion: null }) => a.opinion === null)).toBe(true);
      expect(state.consensus).toBeNull();
    });
  });
});

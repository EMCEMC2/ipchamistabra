import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChartDataPoint, TradeSignal, Position, JournalEntry, AgentState, AgentRole, IntelItem } from '../types';
import { EnhancedBTCMetrics } from '../services/macroDataService';

// Normalize journal entries loaded from storage or new additions so UI doesn't break on missing fields.
const normalizeJournalEntry = (entry: any): JournalEntry => ({
  ...entry,
  tags: Array.isArray(entry?.tags) ? entry.tags : [],
  mood: entry?.mood || 'NEUTRAL',
  result: entry?.result || (typeof entry?.pnl === 'number'
    ? entry.pnl > 0 ? 'WIN' : entry.pnl < 0 ? 'LOSS' : 'BE'
    : 'BE'),
  notes: entry?.notes || '',
  aiFeedback: entry?.aiFeedback
});

// Default enhanced metrics
const defaultEnhancedMetrics: EnhancedBTCMetrics = {
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
};

interface MarketState {
  price: number;
  priceChange: number;
  vix: number;
  dxy: number;
  btcd: number;
  sentimentScore: number;
  sentimentLabel: string;
  derivatives: {
    openInterest: string;
    fundingRate: string;
    longShortRatio: number;
  };
  intel: IntelItem[];
  trends: {
    price: 'up' | 'down' | 'neutral';
    vix: 'up' | 'down' | 'neutral';
    btcd: 'up' | 'down' | 'neutral';
    sentiment: 'up' | 'down' | 'neutral';
  };
  chartData: ChartDataPoint[];
  signals: TradeSignal[];
  isScanning: boolean;
  timeframe: string;
  technicals: {
    rsi: number;
    macd: { histogram: number; signal: number; macd: number };
    adx: number;
    atr: number;
    trend: string;
  };
  latestAnalysis: string;
  lastMacroUpdate: number;
  lastPriceUpdate: number;
  // Enhanced BTC Metrics
  enhancedMetrics: EnhancedBTCMetrics;
}

interface UserState {
  balance: number;
  positions: Position[];
  journal: JournalEntry[];
  activeTradeSetup: Partial<Position> | null;
  executionSide: 'LONG' | 'SHORT';
  dailyLossLimit: number; // Max daily loss in USD
  dailyPnL: number; // Current day's P&L
  lastResetDate: string; // ISO date string for daily reset
  isCircuitBreakerTripped: boolean; // Trading halted if true
}

interface AgentSwarmState {
  agents: AgentState[];
  isSwarmActive: boolean;
  councilLogs: { id: string; agentName: string; message: string; timestamp: number }[];
}

export interface AppState extends MarketState, UserState, AgentSwarmState {
  // Actions
  setMarketMetrics: (metrics: Partial<MarketState>) => void;
  setPrice: (price: number) => void;
  setPriceChange: (change: number) => void;
  setChartData: (data: ChartDataPoint[]) => void;
  setSignals: (signals: TradeSignal[]) => void;
  setIsScanning: (isScanning: boolean) => void;
  setTimeframe: (timeframe: string) => void;
  setTechnicals: (technicals: AppState['technicals']) => void;
  setLatestAnalysis: (analysis: string) => void;
  setActiveTradeSetup: (setup: Partial<Position> | null) => void;
  setExecutionSide: (side: 'LONG' | 'SHORT') => void;
  setEnhancedMetrics: (metrics: EnhancedBTCMetrics) => void;

  // Phase 2: Live Trading (Testnet)
  isLiveMode: boolean;
  setIsLiveMode: (mode: boolean) => void;

  updateBalance: (amount: number) => void;
  addPosition: (position: Position) => void;
  closePosition: (id: string, pnl: number) => void;
  updatePositionPnl: (id: string, pnl: number, pnlPercent: number) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  setDailyLossLimit: (limit: number) => void;
  resetDailyPnL: () => void;
  checkCircuitBreaker: () => boolean;

  updateAgentStatus: (role: AgentRole, status: AgentState['status'], log?: string) => void;
  addCouncilLog: (agentName: string, message: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Market State (NOT PERSISTED - always fresh from API)
      price: 0,
      priceChange: 0,
      vix: 0,
      dxy: 0,
      btcd: 0,
      sentimentScore: 0,
      sentimentLabel: 'No Data',
      derivatives: { openInterest: '-', fundingRate: '-', longShortRatio: 1.0 },
      intel: [],
      trends: { price: 'neutral', vix: 'neutral', btcd: 'neutral', sentiment: 'neutral' },
      chartData: [],
      isScanning: false,
      timeframe: '15m',
      technicals: { rsi: 0, macd: { histogram: 0, signal: 0, macd: 0 }, adx: 0, atr: 0, trend: 'NEUTRAL' },
      latestAnalysis: "",
      lastMacroUpdate: 0,
      lastPriceUpdate: 0,
      enhancedMetrics: defaultEnhancedMetrics,

      // User State (PERSISTED - survives refresh)
      balance: 50000,
      positions: [],
      journal: [],
      signals: [],
      activeTradeSetup: null,
      executionSide: 'LONG', // Default side
      dailyLossLimit: 2500, // Default: 5% of starting balance (50000 * 0.05)
      dailyPnL: 0,
      lastResetDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      isCircuitBreakerTripped: false,

      // Phase 2: Live Trading (Testnet)
      isLiveMode: false,

      // Agent Swarm State (PERSISTED - council logs survive)
      agents: [
        { role: 'ORCHESTRATOR', name: 'OVERMIND', description: 'System Coordinator', status: 'IDLE', lastLog: 'Standby' },
        { role: 'STRATEGIST', name: 'VANGUARD', description: 'Lead Strategist', status: 'IDLE', lastLog: 'Standby' },
        { role: 'QUANT_RESEARCHER', name: 'DATAMIND', description: 'Data Analysis', status: 'IDLE', lastLog: 'Standby' },
        { role: 'RISK_OFFICER', name: 'IRONCLAD', description: 'Risk Management', status: 'IDLE', lastLog: 'Standby' },
        { role: 'INSPECTOR', name: 'WATCHDOG', description: 'System Integrity', status: 'IDLE', lastLog: 'Standby' }
      ],
      isSwarmActive: false,
      councilLogs: [],

      // Actions
      setMarketMetrics: (metrics) => set((state) => ({ ...state, ...metrics, lastMacroUpdate: Date.now() })),
      setPrice: (price) => set({ price, lastPriceUpdate: Date.now() }),
      setPriceChange: (priceChange) => set({ priceChange }),
      setChartData: (data) => set({ chartData: data }),
      setSignals: (signals) => set({ signals }),
      setIsScanning: (isScanning) => set({ isScanning }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setTechnicals: (technicals) => set({ technicals }),
      setLatestAnalysis: (latestAnalysis) => set({ latestAnalysis }),
      setActiveTradeSetup: (setup) => set({ activeTradeSetup: setup }),
      setExecutionSide: (side) => set({ executionSide: side }),
      setEnhancedMetrics: (enhancedMetrics) => set({ enhancedMetrics }),

      setIsLiveMode: (isLiveMode) => set({ isLiveMode }),

      updateBalance: (amount) => set((state) => ({ balance: state.balance + amount })),
      addPosition: (position) => set((state) => ({ positions: [position, ...state.positions] })),
      closePosition: (id, pnl) => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        const newDailyPnL = state.dailyPnL + pnl;
        const isTripped = newDailyPnL <= -state.dailyLossLimit;

        return {
          positions: state.positions.filter((p) => p.id !== id),
          balance: state.balance + pnl,
          dailyPnL: newDailyPnL,
          isCircuitBreakerTripped: isTripped
        };
      }),
      updatePositionPnl: (id, pnl, pnlPercent) => set((state) => ({
        positions: state.positions.map((p) =>
          p.id === id ? { ...p, pnl, pnlPercent } : p
        )
      })),
      addJournalEntry: (entry) => set((state) => ({
        journal: [normalizeJournalEntry(entry), ...state.journal.map(normalizeJournalEntry)]
      })),
      setDailyLossLimit: (limit) => set({ dailyLossLimit: limit }),
      resetDailyPnL: () => set({
        dailyPnL: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
        isCircuitBreakerTripped: false
      }),
      checkCircuitBreaker: () => {
        const state = useStore.getState();
        const today = new Date().toISOString().split('T')[0];

        // Reset if it's a new day
        if (state.lastResetDate !== today) {
          useStore.getState().resetDailyPnL();
          return false;
        }

        // Check if circuit breaker should trip
        if (state.dailyPnL <= -state.dailyLossLimit && !state.isCircuitBreakerTripped) {
          useStore.setState({ isCircuitBreakerTripped: true });
          return true;
        }

        return state.isCircuitBreakerTripped;
      },

      updateAgentStatus: (role, status, log) => set((state) => ({
        agents: state.agents.map((a) =>
          a.role === role ? { ...a, status, lastLog: log || a.lastLog } : a
        )
      })),
      addCouncilLog: (agentName, message) => set((state) => ({
        councilLogs: [...state.councilLogs, { id: Date.now().toString(), agentName, message, timestamp: Date.now() }]
      }))
    }),
    {
      name: 'ipcha-mistabra-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState: any) => {
        if (!persistedState) return persistedState;
        return {
          ...persistedState,
          journal: Array.isArray(persistedState.journal)
            ? persistedState.journal.map(normalizeJournalEntry)
            : [],
          positions: Array.isArray(persistedState.positions) ? persistedState.positions : [],
          signals: Array.isArray(persistedState.signals) ? persistedState.signals : [],
          activeTradeSetup: persistedState.activeTradeSetup || null
        };
      },
      // Only persist critical user data (not live market data)
      partialize: (state) => ({
        balance: state.balance,
        positions: state.positions,
        journal: state.journal,
        signals: state.signals,
        activeTradeSetup: state.activeTradeSetup
      })
    }
  )
);

import { create } from 'zustand';
import { persist, createJSONStorage, PersistStorage, StorageValue } from 'zustand/middleware';
import { ChartDataPoint, TradeSignal, Position, JournalEntry, AgentState, AgentRole, IntelItem } from '../types';
import { EnhancedBTCMetrics } from '../services/macroDataService';
import { FeedState, getInitialFeedState } from '../services/feedRegistry';
import { RiskOfficerState, INITIAL_RISK_STATE } from '../services/riskOfficer';
import {
  CURRENT_STATE_VERSION,
  STORAGE_KEY,
  runMigrations,
  validatePersistedState,
  getDefaultPersistedState
} from './migrations';
import {
  ConfluenceWeights,
  DEFAULT_CONFLUENCE_WEIGHTS,
  setConfluenceWeights as setGlobalConfluenceWeights
} from '../services/agentConsensus';
import {
  indexedDBStorage,
  isAvailable as isIndexedDBAvailable,
  initBroadcastSync,
  broadcastStateUpdate
} from '../services/storage';

// Initialize multi-tab sync
if (typeof window !== 'undefined') {
  initBroadcastSync();
}

/**
 * Create hybrid storage adapter
 * Uses IndexedDB when available, falls back to localStorage
 */
function createHybridStorage(): PersistStorage<unknown> {
  const useIndexedDB = isIndexedDBAvailable();

  if (useIndexedDB) {
    console.log('[Store] Using IndexedDB for persistence');
    return {
      getItem: async (name: string): Promise<StorageValue<unknown> | null> => {
        try {
          const value = await indexedDBStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        } catch (error) {
          console.warn('[Store] IndexedDB read failed, falling back to localStorage:', error);
          const fallback = localStorage.getItem(name);
          return fallback ? JSON.parse(fallback) : null;
        }
      },
      setItem: async (name: string, value: StorageValue<unknown>): Promise<void> => {
        const stringValue = JSON.stringify(value);
        try {
          await indexedDBStorage.setItem(name, stringValue);
          // Broadcast to other tabs
          broadcastStateUpdate(name, value);
        } catch (error) {
          console.warn('[Store] IndexedDB write failed, falling back to localStorage:', error);
          localStorage.setItem(name, stringValue);
        }
      },
      removeItem: async (name: string): Promise<void> => {
        try {
          await indexedDBStorage.removeItem(name);
        } catch (error) {
          console.warn('[Store] IndexedDB remove failed:', error);
          localStorage.removeItem(name);
        }
      }
    };
  }

  console.log('[Store] Using localStorage for persistence (IndexedDB unavailable)');
  return createJSONStorage(() => localStorage);
}

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
  // NEW: Feed Status Registry
  feeds: Record<string, FeedState>;
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
  // Risk Officer State
  riskOfficer: RiskOfficerState;
  // Confluence Weights (persisted user preference)
  confluenceWeights: ConfluenceWeights;
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
  
  // NEW: Feed Actions
  updateFeedStatus: (id: string, updates: Partial<FeedState>) => void;

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
  
  // Risk Officer Actions
  setRiskOfficerState: (state: Partial<RiskOfficerState>) => void;

  // Confluence Weights Actions
  setConfluenceWeights: (weights: Partial<ConfluenceWeights>) => void;

  updateAgentStatus: (role: AgentRole, status: AgentState['status'], log?: string) => void;
  addCouncilLog: (agentName: string, message: string) => void;
}

export const useStore = create<AppState>()(
  persist(

    (set, get) => ({
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
      feeds: getInitialFeedState(),

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
      riskOfficer: INITIAL_RISK_STATE,
      confluenceWeights: { ...DEFAULT_CONFLUENCE_WEIGHTS },

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
      
      updateFeedStatus: (id, updates) => set((state) => ({
        feeds: {
          ...state.feeds,
          [id]: { ...state.feeds[id], ...updates }
        }
      })),

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
        const state = get();
        const today = new Date().toISOString().split('T')[0];

        // Reset if it's a new day
        if (state.lastResetDate !== today) {
          state.resetDailyPnL();
          return false;
        }

        // Check if circuit breaker should trip
        if (state.dailyPnL <= -state.dailyLossLimit && !state.isCircuitBreakerTripped) {
          set({ isCircuitBreakerTripped: true });
          return true;
        }

        return state.isCircuitBreakerTripped;
      },

      
      setRiskOfficerState: (riskState) => set((state) => ({
        riskOfficer: { ...state.riskOfficer, ...riskState }
      })),

      setConfluenceWeights: (weights) => set((state) => {
        const newWeights = { ...state.confluenceWeights, ...weights };
        // Sync with global confluence engine
        setGlobalConfluenceWeights(newWeights);
        return { confluenceWeights: newWeights };
      }),

      updateAgentStatus: (role, status, log) => set((state) => ({
        agents: state.agents.map((a) => {
          if (a.role !== role) return a;

          const now = Date.now();
          const updates: Partial<typeof a> = {
            status,
            lastLog: log || a.lastLog
          };

          // Track timing
          if (status === 'WORKING') {
            updates.startedAt = now;
            updates.completedAt = undefined;
            updates.duration = undefined;
          } else if (status === 'SUCCESS' || status === 'FAILURE' || status === 'TIMEOUT') {
            updates.completedAt = now;
            if (a.startedAt) {
              updates.duration = now - a.startedAt;
            }
          }

          return { ...a, ...updates };
        })
      })),
      addCouncilLog: (agentName, message) => set((state) => ({
        councilLogs: [...state.councilLogs, { id: Date.now().toString(), agentName, message, timestamp: Date.now() }]
      }))
    }),
    {
      name: STORAGE_KEY,
      storage: createHybridStorage(),
      version: CURRENT_STATE_VERSION,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return getDefaultPersistedState();

        // Run sequential migrations
        const migrated = runMigrations(persistedState, version);

        // Validate migrated state
        const validation = validatePersistedState(migrated);
        if (!validation.valid) {
          console.warn('[Store] Migration validation errors:', validation.errors);
        }

        // Normalize journal entries
        if (Array.isArray(migrated.journal)) {
          migrated.journal = migrated.journal.map(normalizeJournalEntry);
        }

        return migrated;
      },
      // Persist critical user data (not live market data)
      partialize: (state) => ({
        balance: state.balance,
        positions: state.positions,
        journal: state.journal,
        signals: state.signals,
        activeTradeSetup: state.activeTradeSetup,
        riskOfficer: state.riskOfficer,
        confluenceWeights: state.confluenceWeights,
        dailyLossLimit: state.dailyLossLimit,
        dailyPnL: state.dailyPnL,
        lastResetDate: state.lastResetDate,
        isCircuitBreakerTripped: state.isCircuitBreakerTripped,
        executionSide: state.executionSide
      }),
      // Sync confluence weights on rehydrate
      onRehydrateStorage: () => (state) => {
        if (state?.confluenceWeights) {
          setGlobalConfluenceWeights(state.confluenceWeights);
        }
      }
    }
  )
);

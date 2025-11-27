import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChartDataPoint, TradeSignal, Position, JournalEntry, AgentState, AgentRole, IntelItem } from '../types';

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
}

interface UserState {
  balance: number;
  positions: Position[];
  journal: JournalEntry[];
  activeTradeSetup: Partial<Position> | null;
  executionSide: 'LONG' | 'SHORT';
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

  // Phase 2: Live Trading (Testnet)
  isLiveMode: boolean;
  setIsLiveMode: (mode: boolean) => void;

  updateBalance: (amount: number) => void;
  addPosition: (position: Position) => void;
  closePosition: (id: string, pnl: number) => void;
  updatePositionPnl: (id: string, pnl: number, pnlPercent: number) => void;
  addJournalEntry: (entry: JournalEntry) => void;

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

      // User State (PERSISTED - survives refresh)
      balance: 50000,
      positions: [],
      journal: [],
      signals: [],
      activeTradeSetup: null,
      executionSide: 'LONG', // Default side

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
      setMarketMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),
      setPrice: (price) => set({ price }),
      setPriceChange: (priceChange) => set({ priceChange }),
      setChartData: (data) => set({ chartData: data }),
      setSignals: (signals) => set({ signals }),
      setIsScanning: (isScanning) => set({ isScanning }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setTechnicals: (technicals) => set({ technicals }),
      setLatestAnalysis: (latestAnalysis) => set({ latestAnalysis }),
      setActiveTradeSetup: (setup) => set({ activeTradeSetup: setup }),
      setExecutionSide: (side) => set({ executionSide: side }),

      setIsLiveMode: (isLiveMode) => set({ isLiveMode }),

      updateBalance: (amount) => set((state) => ({ balance: state.balance + amount })),
      addPosition: (position) => set((state) => ({ positions: [position, ...state.positions] })),
      closePosition: (id, pnl) => set((state) => ({
        positions: state.positions.filter((p) => p.id !== id),
        balance: state.balance + pnl
      })),
      updatePositionPnl: (id, pnl, pnlPercent) => set((state) => ({
        positions: state.positions.map((p) =>
          p.id === id ? { ...p, pnl, pnlPercent } : p
        )
      })),
      addJournalEntry: (entry) => set((state) => ({ journal: [entry, ...state.journal] })),

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

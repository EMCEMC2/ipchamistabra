/**
 * Portfolio Slice
 * Handles balance, positions, journal, and risk management
 */

import { StateCreator } from 'zustand';
import { Position, JournalEntry } from '../../types';
import { RiskOfficerState, INITIAL_RISK_STATE } from '../../services/riskOfficer';

// Normalize journal entries
export const normalizeJournalEntry = (entry: any): JournalEntry => ({
  ...entry,
  tags: Array.isArray(entry?.tags) ? entry.tags : [],
  mood: entry?.mood || 'NEUTRAL',
  result: entry?.result || (typeof entry?.pnl === 'number'
    ? entry.pnl > 0 ? 'WIN' : entry.pnl < 0 ? 'LOSS' : 'BE'
    : 'BE'),
  notes: entry?.notes || '',
  aiFeedback: entry?.aiFeedback
});

export interface PortfolioState {
  // Balance
  balance: number;

  // Positions
  positions: Position[];
  activeTradeSetup: Partial<Position> | null;
  executionSide: 'LONG' | 'SHORT';

  // Journal
  journal: JournalEntry[];

  // Risk management
  dailyLossLimit: number;
  dailyPnL: number;
  lastResetDate: string;
  isCircuitBreakerTripped: boolean;

  // Risk officer
  riskOfficer: RiskOfficerState;

  // Live mode
  isLiveMode: boolean;
}

export interface PortfolioActions {
  updateBalance: (amount: number) => void;
  addPosition: (position: Position) => void;
  closePosition: (id: string, pnl: number) => void;
  updatePositionPnl: (id: string, pnl: number, pnlPercent: number) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  setActiveTradeSetup: (setup: Partial<Position> | null) => void;
  setExecutionSide: (side: 'LONG' | 'SHORT') => void;
  setDailyLossLimit: (limit: number) => void;
  resetDailyPnL: () => void;
  checkCircuitBreaker: () => boolean;
  setRiskOfficerState: (state: Partial<RiskOfficerState>) => void;
  setIsLiveMode: (mode: boolean) => void;
}

export type PortfolioSlice = PortfolioState & PortfolioActions;

export const createPortfolioSlice: StateCreator<
  PortfolioSlice,
  [],
  [],
  PortfolioSlice
> = (set, get) => ({
  // Initial state
  balance: 50000,
  positions: [],
  activeTradeSetup: null,
  executionSide: 'LONG',
  journal: [],
  dailyLossLimit: 2500,
  dailyPnL: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
  isCircuitBreakerTripped: false,
  riskOfficer: INITIAL_RISK_STATE,
  isLiveMode: false,

  // Actions
  updateBalance: (amount) => set((state) => ({
    balance: state.balance + amount
  })),

  addPosition: (position) => set((state) => ({
    positions: [position, ...state.positions]
  })),

  closePosition: (id, pnl) => set((state) => {
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

  setActiveTradeSetup: (setup) => set({ activeTradeSetup: setup }),

  setExecutionSide: (side) => set({ executionSide: side }),

  setDailyLossLimit: (limit) => set({ dailyLossLimit: limit }),

  resetDailyPnL: () => set({
    dailyPnL: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    isCircuitBreakerTripped: false
  }),

  checkCircuitBreaker: () => {
    const state = get();
    const today = new Date().toISOString().split('T')[0];

    if (state.lastResetDate !== today) {
      set({
        dailyPnL: 0,
        lastResetDate: today,
        isCircuitBreakerTripped: false
      });
      return false;
    }

    if (state.dailyPnL <= -state.dailyLossLimit && !state.isCircuitBreakerTripped) {
      set({ isCircuitBreakerTripped: true });
      return true;
    }

    return state.isCircuitBreakerTripped;
  },

  setRiskOfficerState: (riskState) => set((state) => ({
    riskOfficer: { ...state.riskOfficer, ...riskState }
  })),

  setIsLiveMode: (isLiveMode) => set({ isLiveMode })
});

// Selectors
export const selectBalance = (state: PortfolioSlice) => state.balance;
export const selectPositions = (state: PortfolioSlice) => state.positions;
export const selectJournal = (state: PortfolioSlice) => state.journal;
export const selectDailyPnL = (state: PortfolioSlice) => state.dailyPnL;
export const selectIsCircuitBreakerTripped = (state: PortfolioSlice) => state.isCircuitBreakerTripped;
export const selectRiskOfficer = (state: PortfolioSlice) => state.riskOfficer;
export const selectIsLiveMode = (state: PortfolioSlice) => state.isLiveMode;

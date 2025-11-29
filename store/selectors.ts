/**
 * STORE SELECTORS
 * Optimized selectors to prevent unnecessary re-renders
 * Use these instead of destructuring from useStore()
 */

import { useStore } from './useStore';
import { useShallow } from 'zustand/react/shallow';

// ============== PRICE SELECTORS ==============

export const usePrice = () => useStore(state => state.price);
export const usePriceChange = () => useStore(state => state.priceChange);

export const usePriceData = () => useStore(
  useShallow(state => ({
    price: state.price,
    priceChange: state.priceChange,
  }))
);

// ============== SIGNAL SELECTORS ==============

export const useSignals = () => useStore(state => state.signals);
export const useIsScanning = () => useStore(state => state.isScanning);

export const useSignalsData = () => useStore(
  useShallow(state => ({
    signals: state.signals,
    isScanning: state.isScanning,
  }))
);

// ============== FEED SELECTORS ==============

export const useFeeds = () => useStore(state => state.feeds);

export const useFeed = (feedId: string) => useStore(
  state => state.feeds[feedId]
);

export const useFeedsWithUpdater = () => useStore(
  useShallow(state => ({
    feeds: state.feeds,
    updateFeedStatus: state.updateFeedStatus,
  }))
);

// ============== TECHNICAL SELECTORS ==============

export const useTechnicals = () => useStore(state => state.technicals);

// ============== DERIVATIVES SELECTORS ==============

export const useDerivatives = () => useStore(state => state.derivatives);

export const useFundingRate = () => useStore(state => state.derivatives.fundingRate);
export const useOpenInterest = () => useStore(state => state.derivatives.openInterest);
export const useLongShortRatio = () => useStore(state => state.derivatives.longShortRatio);

// ============== SENTIMENT SELECTORS ==============

export const useSentiment = () => useStore(
  useShallow(state => ({
    score: state.sentimentScore,
    label: state.sentimentLabel,
  }))
);

export const useSentimentScore = () => useStore(state => state.sentimentScore);
export const useSentimentLabel = () => useStore(state => state.sentimentLabel);

// ============== MACRO SELECTORS ==============

export const useMacro = () => useStore(
  useShallow(state => ({
    vix: state.vix,
    dxy: state.dxy,
    btcd: state.btcd,
  }))
);

export const useVIX = () => useStore(state => state.vix);
export const useDXY = () => useStore(state => state.dxy);
export const useBTCD = () => useStore(state => state.btcd);

// ============== ENHANCED METRICS SELECTORS ==============

export const useEnhancedMetrics = () => useStore(state => state.enhancedMetrics);

export const useVolumeTag = () => useStore(state => state.enhancedMetrics.volumeTag);

// ============== POSITION SELECTORS ==============

export const usePositions = () => useStore(state => state.positions);
export const useBalance = () => useStore(state => state.balance);

export const usePositionsWithActions = () => useStore(
  useShallow(state => ({
    positions: state.positions,
    price: state.price,
    closePosition: state.closePosition,
    addJournalEntry: state.addJournalEntry,
  }))
);

// ============== RISK OFFICER SELECTORS ==============

export const useRiskOfficer = () => useStore(state => state.riskOfficer);

export const useIsBlocked = () => useStore(
  state => state.riskOfficer?.cooldown?.active || false
);

export const useLastVeto = () => useStore(state => state.riskOfficer?.lastVeto);

// ============== AGENT SELECTORS ==============

export const useAgents = () => useStore(state => state.agents);

export const useAgent = (role: string) => useStore(
  state => state.agents.find(a => a.role === role)
);

// ============== CHART DATA SELECTORS ==============

export const useChartData = () => useStore(state => state.chartData);
export const useTimeframe = () => useStore(state => state.timeframe);

export const useChartState = () => useStore(
  useShallow(state => ({
    chartData: state.chartData,
    timeframe: state.timeframe,
    setTimeframe: state.setTimeframe,
    signals: state.signals,
  }))
);

export const useChartWithVix = () => useStore(
  useShallow(state => ({
    chartData: state.chartData,
    vix: state.vix,
  }))
);

// ============== JOURNAL SELECTORS ==============

export const useJournal = () => useStore(state => state.journal);

export const useJournalWithActions = () => useStore(
  useShallow(state => ({
    journal: state.journal,
    addJournalEntry: state.addJournalEntry,
  }))
);

// ============== ANALYSIS SELECTORS ==============

export const useLatestAnalysis = () => useStore(state => state.latestAnalysis);

export const useAnalysisData = () => useStore(
  useShallow(state => ({
    latestAnalysis: state.latestAnalysis,
    technicals: state.technicals,
  }))
);

// ============== ACTION SELECTORS ==============
// These return stable function references

export const useSetPrice = () => useStore(state => state.setPrice);
export const useSetSignals = () => useStore(state => state.setSignals);
export const useSetTechnicals = () => useStore(state => state.setTechnicals);
export const useSetChartData = () => useStore(state => state.setChartData);
export const useSetTimeframe = () => useStore(state => state.setTimeframe);
export const useUpdateFeedStatus = () => useStore(state => state.updateFeedStatus);

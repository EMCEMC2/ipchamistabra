/**
 * Store Slices
 * Re-exports all slice modules for composing the store
 */

// Market Slice
export {
  createMarketSlice,
  defaultEnhancedMetrics,
  selectPrice,
  selectPriceChange,
  selectChartData,
  selectSignals,
  selectTechnicals,
  selectEnhancedMetrics,
  selectIsScanning,
  type MarketState,
  type MarketActions,
  type MarketSlice
} from './marketSlice';

// Portfolio Slice
export {
  createPortfolioSlice,
  normalizeJournalEntry,
  selectBalance,
  selectPositions,
  selectJournal,
  selectDailyPnL,
  selectIsCircuitBreakerTripped,
  selectRiskOfficer,
  selectIsLiveMode,
  type PortfolioState,
  type PortfolioActions,
  type PortfolioSlice
} from './portfolioSlice';

// Agent Slice
export {
  createAgentSlice,
  selectAgents,
  selectCouncilLogs,
  selectConfluenceWeights,
  selectIsSwarmActive,
  selectAgentByRole,
  selectAgentByName,
  type AgentSwarmState,
  type AgentActions,
  type AgentSlice,
  type CouncilLog
} from './agentSlice';

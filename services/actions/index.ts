/**
 * Service Actions
 * Re-exports all action modules
 *
 * Actions are the only way services should mutate store state.
 * This provides a clean separation between data fetching and state management.
 */

// Market Actions
export {
  updatePrice,
  updatePriceChange,
  updateChartData,
  updateSignals,
  setScanning,
  setTimeframe,
  updateTechnicals,
  updateAnalysis,
  updateEnhancedMetrics,
  updateMarketMetrics,
  updateFeedStatus,
  getMarketState,
  subscribeToMarket
} from './marketActions';

// Portfolio Actions
export {
  updateBalance,
  addPosition,
  closePosition,
  updatePositionPnl,
  addJournalEntry,
  setDailyLossLimit,
  resetDailyPnL,
  checkCircuitBreaker,
  setActiveTradeSetup,
  setExecutionSide,
  setLiveMode,
  getPortfolioState,
  calculateOpenPnL,
  calculateTotalExposure,
  getPosition,
  canOpenPosition,
  subscribeToPortfolio
} from './portfolioActions';

// Agent Actions
export {
  updateAgentStatus,
  addCouncilLog,
  setRiskOfficerState,
  setConfluenceWeights,
  getAgentSwarmState,
  getAgentByRole,
  getAgentByName,
  getAgentsByStatus,
  areAllAgentsIdle,
  isAnyAgentWorking,
  getRecentCouncilLogs,
  getCouncilLogsByAgent,
  pruneCouncilLogs,
  batchUpdateAgents,
  resetAllAgents,
  subscribeToAgents,
  getAgentStats
} from './agentActions';

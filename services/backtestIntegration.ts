/**
 * BACKTEST INTEGRATION SERVICE
 *
 * Provides unified data flow between:
 * - BacktestEngine results → Store → UI components
 * - Pattern Learning → ML Cortex visualization
 * - Equity curves → Chart overlays
 * - Backtest metrics → AI Chat context
 *
 * @version 1.0.0
 */

import { BacktestResults, ClosedTrade } from './backtestEngine';
import { PatternLearningState, SignalHistoryState } from '../types';

// ============================================================================
// BACKTEST RESULTS STORE (In-Memory Cache)
// ============================================================================

interface BacktestResultsCache {
  results: BacktestResults | null;
  timestamp: number;
  config: {
    days: number;
    timeframe: string;
    riskPercent: number;
    minConfidence: number;
  } | null;
}

let backtestCache: BacktestResultsCache = {
  results: null,
  timestamp: 0,
  config: null
};

// Event listeners for backtest updates
type BacktestListener = (results: BacktestResults | null) => void;
const listeners: Set<BacktestListener> = new Set();

/**
 * Store backtest results for cross-component access
 */
export function setBacktestResults(
  results: BacktestResults,
  config: BacktestResultsCache['config']
): void {
  backtestCache = {
    results,
    timestamp: Date.now(),
    config
  };

  // Notify all listeners
  listeners.forEach(listener => {
    try {
      listener(results);
    } catch (e) {
      console.error('[BacktestIntegration] Listener error:', e);
    }
  });

  if (import.meta.env.DEV) {
    console.log('[BacktestIntegration] Results cached:', {
      totalTrades: results.totalTrades,
      winRate: (results.winRate * 100).toFixed(1) + '%',
      profitFactor: results.profitFactor.toFixed(2)
    });
  }
}

/**
 * Get cached backtest results
 */
export function getBacktestResults(): BacktestResults | null {
  return backtestCache.results;
}

/**
 * Get backtest config that produced current results
 */
export function getBacktestConfig(): BacktestResultsCache['config'] {
  return backtestCache.config;
}

/**
 * Check if results are stale (older than 1 hour)
 */
export function isBacktestStale(): boolean {
  if (!backtestCache.results) return true;
  const ONE_HOUR = 60 * 60 * 1000;
  return Date.now() - backtestCache.timestamp > ONE_HOUR;
}

/**
 * Subscribe to backtest result updates
 */
export function subscribeToBacktest(listener: BacktestListener): () => void {
  listeners.add(listener);

  // Immediately send current results if available
  if (backtestCache.results) {
    listener(backtestCache.results);
  }

  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clear cached results
 */
export function clearBacktestResults(): void {
  backtestCache = {
    results: null,
    timestamp: 0,
    config: null
  };
  listeners.forEach(listener => listener(null));
}

// ============================================================================
// EQUITY CURVE DATA FOR CHART INTEGRATION
// ============================================================================

export interface EquityCurvePoint {
  time: number;     // Unix timestamp (seconds)
  equity: number;   // Equity value
  drawdown: number; // Current drawdown %
  tradeEvent?: 'ENTRY' | 'EXIT_WIN' | 'EXIT_LOSS';
}

/**
 * Get equity curve data formatted for chart overlay
 */
export function getEquityCurveForChart(): EquityCurvePoint[] {
  const results = backtestCache.results;
  if (!results || !results.equityCurve) return [];

  return results.equityCurve.map(point => ({
    time: Math.floor(point.time / 1000), // Convert ms to seconds for charts
    equity: point.equity,
    drawdown: point.drawdown
  }));
}

/**
 * Get trade markers for chart overlay
 */
export function getTradeMarkersForChart(): Array<{
  time: number;
  price: number;
  type: 'ENTRY_LONG' | 'ENTRY_SHORT' | 'EXIT_WIN' | 'EXIT_LOSS' | 'EXIT_BE';
  pnlR?: number;
}> {
  const results = backtestCache.results;
  if (!results || !results.trades) return [];

  const markers: Array<{
    time: number;
    price: number;
    type: 'ENTRY_LONG' | 'ENTRY_SHORT' | 'EXIT_WIN' | 'EXIT_LOSS' | 'EXIT_BE';
    pnlR?: number;
  }> = [];

  results.trades.forEach((trade: ClosedTrade) => {
    // Entry marker
    markers.push({
      time: Math.floor(trade.entryTime / 1000),
      price: trade.entryPrice,
      type: trade.signal.type === 'LONG' ? 'ENTRY_LONG' : 'ENTRY_SHORT'
    });

    // Exit marker
    const exitType = trade.rMultiple > 0.1
      ? 'EXIT_WIN'
      : trade.rMultiple < -0.1
        ? 'EXIT_LOSS'
        : 'EXIT_BE';

    markers.push({
      time: Math.floor(trade.exitTime / 1000),
      price: trade.exitPrice,
      type: exitType,
      pnlR: trade.rMultiple
    });
  });

  return markers.sort((a, b) => a.time - b.time);
}

// ============================================================================
// AI CONTEXT BUILDER FOR TACTICAL AI INTEGRATION
// ============================================================================

export interface BacktestContextForAI {
  hasResults: boolean;
  summary: string;
  keyMetrics: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    expectancy: number;
    maxDrawdown: number;
    sharpeRatio: number;
  } | null;
  patternInsights: string[];
  regimePerformance: string[];
  recommendations: string[];
}

/**
 * Build AI-friendly context from backtest results
 */
export function buildBacktestContextForAI(): BacktestContextForAI {
  const results = backtestCache.results;
  const config = backtestCache.config;

  if (!results) {
    return {
      hasResults: false,
      summary: 'No backtest results available. Run a backtest to analyze strategy performance.',
      keyMetrics: null,
      patternInsights: [],
      regimePerformance: [],
      recommendations: []
    };
  }

  // Build summary
  const summary = `Backtest of ${config?.days || '?'} days on ${config?.timeframe || '?'} timeframe: ` +
    `${results.totalTrades} trades, ${(results.winRate * 100).toFixed(1)}% win rate, ` +
    `${results.profitFactor.toFixed(2)} profit factor, ` +
    `${results.expectancy.toFixed(2)}R expectancy, ` +
    `${results.maxDrawdownPercent.toFixed(1)}% max drawdown.`;

  // Key metrics
  const keyMetrics = {
    totalTrades: results.totalTrades,
    winRate: results.winRate,
    profitFactor: results.profitFactor,
    expectancy: results.expectancy,
    maxDrawdown: results.maxDrawdownPercent,
    sharpeRatio: results.sharpeRatio
  };

  // Pattern insights
  const patternInsights: string[] = [];

  // Target hit rate analysis
  if (results.tp1HitRate > 0) {
    patternInsights.push(
      `Target hit rates: TP1=${(results.tp1HitRate * 100).toFixed(0)}%, ` +
      `TP2=${(results.tp2HitRate * 100).toFixed(0)}%, ` +
      `TP3=${(results.tp3HitRate * 100).toFixed(0)}%, ` +
      `TP4=${(results.tp4HitRate * 100).toFixed(0)}%`
    );
  }

  // MFE/MAE analysis
  if (results.avgMFE > 0 || results.avgMAE > 0) {
    patternInsights.push(
      `Avg MFE: ${results.avgMFE.toFixed(1)}%, Avg MAE: ${results.avgMAE.toFixed(1)}% - ` +
      (results.avgMFE > results.avgMAE * 2
        ? 'Good risk/reward execution'
        : 'Consider tighter stops or better entries')
    );
  }

  // Pattern learning state
  if (results.patternLearningState.totalTrades > 0) {
    patternInsights.push(
      `Pattern learning active: ${results.patternLearningState.totalTrades} patterns tracked, ` +
      `${(results.patternLearningState.winRate * 100).toFixed(0)}% historical WR, ` +
      `${(results.patternLearningState.recentWinRate * 100).toFixed(0)}% recent WR`
    );
  }

  // Regime performance
  const regimePerformance: string[] = [];
  Object.entries(results.winRateByRegime).forEach(([regime, stats]) => {
    if (stats.count >= 3) {
      regimePerformance.push(
        `${regime}: ${stats.count} trades, ${(stats.winRate * 100).toFixed(0)}% WR, ${stats.avgR.toFixed(2)}R avg`
      );
    }
  });

  // Direction performance
  Object.entries(results.winRateByDirection).forEach(([direction, stats]) => {
    if (stats.count >= 3) {
      regimePerformance.push(
        `${direction}: ${stats.count} trades, ${(stats.winRate * 100).toFixed(0)}% WR, ${stats.avgR.toFixed(2)}R avg`
      );
    }
  });

  // Recommendations based on results
  const recommendations: string[] = [];

  if (results.winRate < 0.4) {
    recommendations.push('Win rate below 40% - consider increasing minimum confidence threshold');
  }
  if (results.profitFactor < 1.2) {
    recommendations.push('Low profit factor - review entry criteria or target placement');
  }
  if (results.maxDrawdownPercent > 20) {
    recommendations.push('High max drawdown - consider reducing position size');
  }
  if (results.avgMAE > results.avgMFE) {
    recommendations.push('MAE exceeds MFE - tighten stop loss or improve entry timing');
  }
  if (results.tp1HitRate < 0.5) {
    recommendations.push('Low TP1 hit rate - entries may be poorly timed or stops too tight');
  }
  if (results.expectancy > 0.5) {
    recommendations.push('Positive expectancy detected - strategy shows promise');
  }
  if (results.sharpeRatio > 1.5) {
    recommendations.push('Strong Sharpe ratio - good risk-adjusted returns');
  }

  return {
    hasResults: true,
    summary,
    keyMetrics,
    patternInsights,
    regimePerformance,
    recommendations
  };
}

// ============================================================================
// ML CORTEX INTEGRATION - PATTERN LEARNING VISUALIZATION
// ============================================================================

export interface PatternVisualizationData {
  // Regime-based clusters
  regimeClusters: Array<{
    regime: string;
    winRate: number;
    count: number;
    avgR: number;
    color: string;
  }>;

  // Recent pattern performance
  recentPatterns: Array<{
    id: string;
    timestamp: number;
    regime: string;
    direction: string;
    result: 'WIN' | 'LOSS';
    rMultiple: number;
  }>;

  // Learning curve (win rate over time)
  learningCurve: Array<{
    tradeNumber: number;
    cumulativeWinRate: number;
    rollingWinRate: number; // Last 20 trades
  }>;

  // Best/worst patterns
  bestPatterns: string[];
  worstPatterns: string[];
}

/**
 * Build visualization data for ML Cortex from backtest results
 */
export function buildPatternVisualizationData(): PatternVisualizationData | null {
  const results = backtestCache.results;
  if (!results || !results.trades || results.trades.length === 0) {
    return null;
  }

  // Regime colors
  const regimeColors: Record<string, string> = {
    'LOW_VOL': '#3b82f6',      // Blue
    'NORMAL': '#10b981',       // Green
    'HIGH_VOL': '#f59e0b',     // Amber
    'TRENDING': '#8b5cf6',     // Purple
    'UNKNOWN': '#6b7280'       // Gray
  };

  // Build regime clusters
  const regimeClusters = Object.entries(results.winRateByRegime)
    .filter(([_, stats]) => stats.count >= 2)
    .map(([regime, stats]) => ({
      regime,
      winRate: stats.winRate,
      count: stats.count,
      avgR: stats.avgR,
      color: regimeColors[regime] || regimeColors['UNKNOWN']
    }));

  // Recent patterns (last 20 trades)
  const recentPatterns = results.trades
    .slice(-20)
    .map(trade => ({
      id: trade.signal.id,
      timestamp: trade.exitTime,
      regime: trade.signal.regime,
      direction: trade.signal.type,
      result: (trade.rMultiple > 0 ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS',
      rMultiple: trade.rMultiple
    }));

  // Learning curve
  const learningCurve: PatternVisualizationData['learningCurve'] = [];
  let wins = 0;
  const recentResults: boolean[] = [];

  results.trades.forEach((trade, idx) => {
    const isWin = trade.rMultiple > 0;
    if (isWin) wins++;

    recentResults.push(isWin);
    if (recentResults.length > 20) recentResults.shift();

    const rollingWins = recentResults.filter(r => r).length;

    learningCurve.push({
      tradeNumber: idx + 1,
      cumulativeWinRate: wins / (idx + 1),
      rollingWinRate: rollingWins / recentResults.length
    });
  });

  // Best/worst patterns (by regime + direction combo)
  const patternPerformance: Record<string, { wins: number; total: number; totalR: number }> = {};

  results.trades.forEach(trade => {
    const key = `${trade.signal.regime}_${trade.signal.type}`;
    if (!patternPerformance[key]) {
      patternPerformance[key] = { wins: 0, total: 0, totalR: 0 };
    }
    patternPerformance[key].total++;
    patternPerformance[key].totalR += trade.rMultiple;
    if (trade.rMultiple > 0) patternPerformance[key].wins++;
  });

  const sortedPatterns = Object.entries(patternPerformance)
    .filter(([_, stats]) => stats.total >= 3)
    .map(([pattern, stats]) => ({
      pattern,
      winRate: stats.wins / stats.total,
      avgR: stats.totalR / stats.total
    }))
    .sort((a, b) => b.avgR - a.avgR);

  const bestPatterns = sortedPatterns
    .filter(p => p.avgR > 0)
    .slice(0, 3)
    .map(p => `${p.pattern}: ${(p.winRate * 100).toFixed(0)}% WR, ${p.avgR.toFixed(2)}R`);

  const worstPatterns = sortedPatterns
    .filter(p => p.avgR < 0)
    .slice(-3)
    .reverse()
    .map(p => `${p.pattern}: ${(p.winRate * 100).toFixed(0)}% WR, ${p.avgR.toFixed(2)}R`);

  return {
    regimeClusters,
    recentPatterns,
    learningCurve,
    bestPatterns,
    worstPatterns
  };
}

// ============================================================================
// SIGNAL QUALITY SCORING BASED ON BACKTEST DATA
// ============================================================================

/**
 * Score a potential signal based on historical backtest performance
 */
export function scoreSignalFromBacktest(
  regime: string,
  direction: 'LONG' | 'SHORT',
  currentConfidence: number
): {
  adjustedConfidence: number;
  historicalWinRate: number | null;
  recommendation: string;
} {
  const results = backtestCache.results;

  if (!results || results.totalTrades < 20) {
    return {
      adjustedConfidence: currentConfidence,
      historicalWinRate: null,
      recommendation: 'Insufficient backtest data for adjustment'
    };
  }

  // Get regime performance
  const regimeStats = results.winRateByRegime[regime];
  const directionStats = results.winRateByDirection[direction];

  let adjustment = 0;
  let recommendation = '';
  let historicalWinRate: number | null = null;

  if (regimeStats && regimeStats.count >= 5) {
    historicalWinRate = regimeStats.winRate;

    // Adjust confidence based on regime performance
    if (regimeStats.winRate > 0.6 && regimeStats.avgR > 0.5) {
      adjustment += 10;
      recommendation = `Strong ${regime} regime: +10% confidence`;
    } else if (regimeStats.winRate < 0.4 || regimeStats.avgR < 0) {
      adjustment -= 15;
      recommendation = `Weak ${regime} regime: -15% confidence`;
    }
  }

  if (directionStats && directionStats.count >= 10) {
    if (directionStats.winRate > 0.55) {
      adjustment += 5;
      recommendation += ` | ${direction} bias: +5%`;
    } else if (directionStats.winRate < 0.45) {
      adjustment -= 10;
      recommendation += ` | ${direction} weakness: -10%`;
    }
  }

  const adjustedConfidence = Math.max(20, Math.min(95, currentConfidence + adjustment));

  return {
    adjustedConfidence,
    historicalWinRate,
    recommendation: recommendation || 'Neutral historical performance'
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const backtestIntegration = {
  setResults: setBacktestResults,
  getResults: getBacktestResults,
  getConfig: getBacktestConfig,
  isStale: isBacktestStale,
  subscribe: subscribeToBacktest,
  clear: clearBacktestResults,
  getEquityCurve: getEquityCurveForChart,
  getTradeMarkers: getTradeMarkersForChart,
  buildAIContext: buildBacktestContextForAI,
  buildVisualization: buildPatternVisualizationData,
  scoreSignal: scoreSignalFromBacktest
};

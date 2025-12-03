/**
 * BACKTESTING & ANALYTICS FRAMEWORK V3.3
 *
 * Features:
 * - Walk-forward backtesting with proper state management
 * - Multi-target TP tracking (TP1, TP2, TP3, TP4)
 * - Pattern performance analytics
 * - Drawdown and equity curve analysis
 * - Setup quality grading
 * - AI learning feedback loop
 *
 * @version 3.3.0
 */

import {
  ChartDataPoint,
  TacticalConfigV33,
  DEFAULT_CONFIG_V33,
  SignalHistoryState,
  EMPTY_SIGNAL_HISTORY,
  PatternLearningState,
  EMPTY_PATTERN_LEARNING,
  TradeOutcome,
  EnhancedTradeSignal,
  TargetLevel,
  TacticalResultV33
} from '../types';
import {
  generateTacticalSignalV33,
  addTradeOutcome
} from './tacticalSignalsV33';
import { AppState } from '../store/useStore';

// ============================================================================
// BACKTEST CONFIGURATION
// ============================================================================

export interface BacktestConfig {
  // Data
  startIndex: number;           // Where to start (need 200+ prior candles)
  endIndex: number;             // Where to end (-1 for all data)

  // Position sizing
  initialCapital: number;
  riskPerTrade: number;         // % of capital risked per trade (e.g., 1%)
  maxOpenPositions: number;     // Max concurrent positions

  // Trade management
  usePartialExits: boolean;     // Use multi-TP system
  moveStopToBreakeven: boolean; // Move SL after TP1
  useTrailingStop: boolean;     // Trailing stop after TP2
  trailingStopMultiple: number; // ATR multiple for trailing

  // Fees & slippage
  takerFee: number;             // % fee per trade (e.g., 0.04%)
  slippageBps: number;          // Basis points slippage

  // Filtering
  minConfidence: number;        // Only take signals above this
  regimeFilter: string[];       // Only trade in these regimes

  // Learning
  enableLearningFeedback: boolean; // Update pattern learning during backtest
  warmupTrades: number;         // Min trades before using pattern adjustments
}

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  startIndex: 200,
  endIndex: -1,

  initialCapital: 10000,
  riskPerTrade: 1,
  maxOpenPositions: 1,

  usePartialExits: true,
  moveStopToBreakeven: true,
  useTrailingStop: true,
  trailingStopMultiple: 2.0,

  takerFee: 0.04,
  slippageBps: 5,

  minConfidence: 50,
  regimeFilter: [],  // Empty = all regimes

  enableLearningFeedback: true,
  warmupTrades: 20
};

// ============================================================================
// BACKTEST STATE
// ============================================================================

export interface OpenPosition {
  signal: EnhancedTradeSignal;
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  stopPrice: number;  // Current stop (may have moved)
  targetLevels: TargetLevel[];
  positionSize: number;   // USD value
  positionRemaining: number;  // % remaining
  realizedPnL: number;

  // Tracking
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  barsInTrade: number;
}

export interface ClosedTrade {
  signal: EnhancedTradeSignal;
  entryIndex: number;
  entryTime: number;
  entryPrice: number;

  exitIndex: number;
  exitTime: number;
  exitPrice: number;
  exitReason: 'TP1' | 'TP2' | 'TP3' | 'TP4' | 'STOP' | 'MANUAL' | 'EXPIRED' | 'END_OF_DATA';

  // Results
  pnlUsd: number;
  pnlPercent: number;
  rMultiple: number;

  // Target tracking
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  tp4Hit: boolean;

  // Performance
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  durationBars: number;
  durationSeconds: number;

  // Fees
  fees: number;
}

export interface BacktestState {
  // Capital
  equity: number;
  peakEquity: number;
  currentDrawdown: number;
  maxDrawdown: number;

  // Positions
  openPositions: OpenPosition[];
  closedTrades: ClosedTrade[];

  // Signal tracking
  signalHistory: SignalHistoryState;
  patternLearning: PatternLearningState;

  // Stats
  totalSignals: number;
  signalsSkipped: number;

  // Time series
  equityCurve: { time: number; equity: number; drawdown: number }[];

  // Current bar
  currentIndex: number;
}

// ============================================================================
// BACKTEST RESULTS
// ============================================================================

export interface BacktestResults {
  // Overview
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;

  // Profit metrics
  totalPnL: number;
  totalPnLPercent: number;
  avgWin: number;
  avgLoss: number;
  avgWinR: number;
  avgLossR: number;
  largestWin: number;
  largestLoss: number;

  // Ratios
  profitFactor: number;
  expectancy: number;     // Avg R per trade
  expectancyDollar: number;
  payoffRatio: number;    // Avg win / Avg loss

  // Risk metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgDrawdown: number;
  calmarRatio: number;    // CAGR / Max DD
  sharpeRatio: number;    // Simplified

  // Trade metrics
  avgTradeDuration: number;  // Seconds
  avgBarsInTrade: number;
  avgMFE: number;            // Max favorable excursion %
  avgMAE: number;            // Max adverse excursion %

  // Target analysis
  tp1HitRate: number;
  tp2HitRate: number;
  tp3HitRate: number;
  tp4HitRate: number;
  avgExitLevel: number;   // 1=TP1, 2=TP2, etc.

  // Pattern analysis
  winRateByRegime: Record<string, { count: number; winRate: number; avgR: number }>;
  winRateByTrend: Record<string, { count: number; winRate: number; avgR: number }>;
  winRateByDirection: Record<string, { count: number; winRate: number; avgR: number }>;
  winRateByCvdDivergence: Record<string, { count: number; winRate: number; avgR: number }>;

  // Time analysis
  bestHour: number;
  worstHour: number;
  bestDay: number;
  worstDay: number;

  // Streaks
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number;

  // Equity curve
  finalEquity: number;
  equityCurve: { time: number; equity: number; drawdown: number }[];

  // Trade list
  trades: ClosedTrade[];

  // Learning
  patternLearningState: PatternLearningState;
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

export class BacktestEngine {
  private config: BacktestConfig;
  private tacticalConfig: TacticalConfigV33;
  private state: BacktestState;
  private chartData: ChartDataPoint[];
  private appState: Partial<AppState>;

  constructor(
    chartData: ChartDataPoint[],
    appState: Partial<AppState> = {},
    config: Partial<BacktestConfig> = {},
    tacticalConfig: Partial<TacticalConfigV33> = {}
  ) {
    this.chartData = chartData;
    this.appState = appState;
    this.config = { ...DEFAULT_BACKTEST_CONFIG, ...config };
    this.tacticalConfig = { ...DEFAULT_CONFIG_V33, ...tacticalConfig };

    this.state = {
      equity: this.config.initialCapital,
      peakEquity: this.config.initialCapital,
      currentDrawdown: 0,
      maxDrawdown: 0,
      openPositions: [],
      closedTrades: [],
      signalHistory: EMPTY_SIGNAL_HISTORY,
      patternLearning: EMPTY_PATTERN_LEARNING,
      totalSignals: 0,
      signalsSkipped: 0,
      equityCurve: [],
      currentIndex: 0
    };
  }

  /**
   * Run full backtest
   */
  run(): BacktestResults {
    const startIdx = Math.max(this.config.startIndex, 200);
    const endIdx = this.config.endIndex === -1
      ? this.chartData.length - 1
      : Math.min(this.config.endIndex, this.chartData.length - 1);

    console.log(`[Backtest] Running from bar ${startIdx} to ${endIdx} (${endIdx - startIdx} bars)`);

    // Walk forward through data
    for (let i = startIdx; i <= endIdx; i++) {
      this.state.currentIndex = i;
      this.processBar(i);
    }

    // Close any remaining positions at end of data
    this.closeAllPositions('END_OF_DATA');

    return this.calculateResults();
  }

  /**
   * Process single bar
   */
  private processBar(index: number): void {
    const candle = this.chartData[index];
    const timestamp = candle.time * 1000;

    // 1. Update open positions (check SL/TP hits)
    this.updatePositions(index);

    // 2. Generate signals
    const chartSlice = this.chartData.slice(0, index + 1);
    const referenceTime = timestamp;

    const result = generateTacticalSignalV33(
      chartSlice,
      this.appState,
      null,  // No order flow in backtest
      this.state.signalHistory,
      this.state.patternLearning,
      this.tacticalConfig,
      referenceTime
    );

    // Update signal history
    this.state.signalHistory = result.updatedHistory;

    // 3. Process new signal if any
    if (result.signal) {
      this.state.totalSignals++;

      // Apply filters
      if (this.shouldTakeSignal(result)) {
        this.openPosition(result.signal, index);
      } else {
        this.state.signalsSkipped++;
      }
    }

    // 4. Update equity curve
    const openPnL = this.calculateOpenPnL(index);
    const currentEquity = this.state.equity + openPnL;

    if (currentEquity > this.state.peakEquity) {
      this.state.peakEquity = currentEquity;
    }

    this.state.currentDrawdown = (this.state.peakEquity - currentEquity) / this.state.peakEquity;
    if (this.state.currentDrawdown > this.state.maxDrawdown) {
      this.state.maxDrawdown = this.state.currentDrawdown;
    }

    this.state.equityCurve.push({
      time: timestamp,
      equity: currentEquity,
      drawdown: this.state.currentDrawdown
    });
  }

  /**
   * Check if signal passes filters
   */
  private shouldTakeSignal(result: TacticalResultV33): boolean {
    if (!result.signal) return false;

    // Max positions
    if (this.state.openPositions.length >= this.config.maxOpenPositions) return false;

    // Confidence filter
    if (result.signal.confidence < this.config.minConfidence) return false;

    // Regime filter
    if (this.config.regimeFilter.length > 0 &&
        !this.config.regimeFilter.includes(result.structure.regime)) {
      return false;
    }

    return true;
  }

  /**
   * Open new position
   */
  private openPosition(signal: EnhancedTradeSignal, index: number): void {
    const candle = this.chartData[index];
    const isLong = signal.type === 'LONG';

    // CRITICAL FIX: Safe parseFloat handling with direction-aware fallback
    const parsedEntry = parseFloat(signal.entryZone);
    const parsedStop = parseFloat(signal.invalidation);
    const entryPrice = Number.isFinite(parsedEntry) ? parsedEntry : candle.close;
    // FIX: Use correct direction for stop fallback (2% away from entry)
    const stopPrice = Number.isFinite(parsedStop)
      ? parsedStop
      : isLong ? entryPrice * 0.98 : entryPrice * 1.02;

    // Calculate position size based on risk
    const riskAmount = this.state.equity * (this.config.riskPerTrade / 100);
    const riskPerUnit = Math.abs(entryPrice - stopPrice);

    // CRITICAL FIX: Skip if stop is too close (< 0.01% of entry) to prevent Infinity position size
    if (riskPerUnit < entryPrice * 0.0001) {
      console.warn('[Backtest] Skipping trade: stop too close to entry');
      return;
    }

    const units = riskAmount / riskPerUnit;
    const positionSize = units * entryPrice;

    // Apply entry fee
    const entryFee = positionSize * (this.config.takerFee / 100);
    this.state.equity -= entryFee;

    const position: OpenPosition = {
      signal,
      entryIndex: index,
      entryTime: candle.time * 1000,
      entryPrice,
      stopPrice,
      targetLevels: signal.targetLevels.map(t => ({ ...t })),
      positionSize,
      positionRemaining: 100,
      realizedPnL: -entryFee,  // Account for entry fee
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      barsInTrade: 0
    };

    this.state.openPositions.push(position);
  }

  /**
   * Update all open positions
   */
  private updatePositions(index: number): void {
    const candle = this.chartData[index];
    const high = candle.high;
    const low = candle.low;

    const positionsToClose: { position: OpenPosition; reason: string; price: number }[] = [];

    for (const position of this.state.openPositions) {
      position.barsInTrade++;

      const isLong = position.signal.type === 'LONG';

      // Update MFE/MAE
      if (isLong) {
        const favorableMove = (high - position.entryPrice) / position.entryPrice * 100;
        const adverseMove = (position.entryPrice - low) / position.entryPrice * 100;
        position.maxFavorableExcursion = Math.max(position.maxFavorableExcursion, favorableMove);
        position.maxAdverseExcursion = Math.max(position.maxAdverseExcursion, adverseMove);
      } else {
        const favorableMove = (position.entryPrice - low) / position.entryPrice * 100;
        const adverseMove = (high - position.entryPrice) / position.entryPrice * 100;
        position.maxFavorableExcursion = Math.max(position.maxFavorableExcursion, favorableMove);
        position.maxAdverseExcursion = Math.max(position.maxAdverseExcursion, adverseMove);
      }

      // Check stop loss
      const stopHit = isLong ? low <= position.stopPrice : high >= position.stopPrice;
      if (stopHit) {
        positionsToClose.push({ position, reason: 'STOP', price: position.stopPrice });
        continue;
      }

      // Check take profits (in order)
      if (this.config.usePartialExits) {
        for (let i = 0; i < position.targetLevels.length; i++) {
          const target = position.targetLevels[i];
          if (target.status !== 'PENDING') continue;

          const tpHit = isLong ? high >= target.price : low <= target.price;

          if (tpHit) {
            target.status = 'HIT';
            target.hitTime = candle.time * 1000;
            target.hitPrice = target.price;

            // Partial exit
            const exitPct = target.positionPct;
            const exitValue = position.positionSize * (exitPct / 100);
            const pnl = isLong
              ? (target.price - position.entryPrice) / position.entryPrice * exitValue
              : (position.entryPrice - target.price) / position.entryPrice * exitValue;

            const fee = exitValue * (this.config.takerFee / 100);
            position.realizedPnL += pnl - fee;
            position.positionRemaining -= exitPct;

            // Move stop to breakeven after TP1
            if (i === 0 && this.config.moveStopToBreakeven) {
              position.stopPrice = position.entryPrice;
            }

            // Full exit if position depleted
            if (position.positionRemaining <= 0) {
              const tpLevel = i === 0 ? 'TP1' : i === 1 ? 'TP2' : i === 2 ? 'TP3' : 'TP4';
              positionsToClose.push({ position, reason: tpLevel, price: target.price });
              break;
            }
          }
        }
      } else {
        // Simple mode: just check TP2 (main target)
        const tp2 = position.targetLevels[1];
        const tpHit = isLong ? high >= tp2.price : low <= tp2.price;
        if (tpHit) {
          positionsToClose.push({ position, reason: 'TP2', price: tp2.price });
        }
      }
    }

    // Close positions
    for (const { position, reason, price } of positionsToClose) {
      this.closePosition(position, reason as any, price, index);
    }
  }

  /**
   * Close a position
   */
  private closePosition(
    position: OpenPosition,
    reason: 'TP1' | 'TP2' | 'TP3' | 'TP4' | 'STOP' | 'MANUAL' | 'EXPIRED' | 'END_OF_DATA',
    exitPrice: number,
    exitIndex: number
  ): void {
    const candle = this.chartData[exitIndex];
    const isLong = position.signal.type === 'LONG';

    // Final PnL for remaining position
    if (position.positionRemaining > 0) {
      const remainingValue = position.positionSize * (position.positionRemaining / 100);
      const pnl = isLong
        ? (exitPrice - position.entryPrice) / position.entryPrice * remainingValue
        : (position.entryPrice - exitPrice) / position.entryPrice * remainingValue;
      const fee = remainingValue * (this.config.takerFee / 100);
      position.realizedPnL += pnl - fee;
    }

    // Calculate R multiple - with safety for parseFloat
    const parsedInvalidation = parseFloat(position.signal.invalidation);
    const originalStop = Number.isFinite(parsedInvalidation) ? parsedInvalidation : position.entryPrice * 0.98;
    const risk = Math.abs(position.entryPrice - originalStop);
    const pnlPoints = isLong
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;
    const rMultiple = risk > 0 ? pnlPoints / risk : 0;

    const closedTrade: ClosedTrade = {
      signal: position.signal,
      entryIndex: position.entryIndex,
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitIndex,
      exitTime: candle.time * 1000,
      exitPrice,
      exitReason: reason,
      pnlUsd: position.realizedPnL,
      pnlPercent: position.positionSize > 0 ? (position.realizedPnL / position.positionSize) * 100 : 0,
      rMultiple,
      tp1Hit: position.targetLevels[0]?.status === 'HIT',
      tp2Hit: position.targetLevels[1]?.status === 'HIT',
      tp3Hit: position.targetLevels[2]?.status === 'HIT',
      tp4Hit: position.targetLevels[3]?.status === 'HIT',
      maxFavorableExcursion: position.maxFavorableExcursion,
      maxAdverseExcursion: position.maxAdverseExcursion,
      durationBars: position.barsInTrade,
      durationSeconds: (candle.time * 1000) - position.entryTime,
      fees: position.positionSize * (this.config.takerFee / 100) * 2  // Entry + exit
    };

    // Update equity
    this.state.equity += position.realizedPnL;

    // Remove from open, add to closed
    const idx = this.state.openPositions.indexOf(position);
    if (idx >= 0) this.state.openPositions.splice(idx, 1);
    this.state.closedTrades.push(closedTrade);

    // Update pattern learning
    if (this.config.enableLearningFeedback && position.signal.patternFingerprint) {
      const outcome: TradeOutcome = {
        signalId: position.signal.id,
        fingerprint: position.signal.patternFingerprint,
        entryPrice: position.entryPrice,
        entryTime: position.entryTime,
        exitPrice,
        exitTime: candle.time * 1000,
        exitReason: reason,
        pnlPercent: closedTrade.pnlPercent,
        rMultipleAchieved: rMultiple,
        maxFavorableExcursion: position.maxFavorableExcursion,
        maxAdverseExcursion: position.maxAdverseExcursion,
        durationSeconds: closedTrade.durationSeconds,
        tp1Hit: closedTrade.tp1Hit,
        tp2Hit: closedTrade.tp2Hit,
        tp3Hit: closedTrade.tp3Hit,
        tp4Hit: closedTrade.tp4Hit,
        regime: position.signal.regime,
        timestamp: candle.time * 1000
      };

      this.state.patternLearning = addTradeOutcome(this.state.patternLearning, outcome);
    }
  }

  /**
   * Close all positions
   */
  private closeAllPositions(reason: 'END_OF_DATA'): void {
    const candle = this.chartData[this.state.currentIndex];

    for (const position of [...this.state.openPositions]) {
      this.closePosition(position, reason, candle.close, this.state.currentIndex);
    }
  }

  /**
   * Calculate unrealized PnL of open positions
   */
  private calculateOpenPnL(index: number): number {
    const candle = this.chartData[index];
    let openPnL = 0;

    for (const position of this.state.openPositions) {
      const remainingValue = position.positionSize * (position.positionRemaining / 100);
      const isLong = position.signal.type === 'LONG';
      const pnl = isLong
        ? (candle.close - position.entryPrice) / position.entryPrice * remainingValue
        : (position.entryPrice - candle.close) / position.entryPrice * remainingValue;
      openPnL += pnl + position.realizedPnL;
    }

    return openPnL;
  }

  /**
   * Calculate final results
   */
  private calculateResults(): BacktestResults {
    const trades = this.state.closedTrades;
    const wins = trades.filter(t => t.rMultiple > 0);
    const losses = trades.filter(t => t.rMultiple <= 0);

    const totalPnL = trades.reduce((s, t) => s + t.pnlUsd, 0);
    const grossProfit = wins.reduce((s, t) => s + t.pnlUsd, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlUsd, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0) / losses.length) : 0;
    const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;

    // Target analysis
    const tp1Hits = trades.filter(t => t.tp1Hit).length;
    const tp2Hits = trades.filter(t => t.tp2Hit).length;
    const tp3Hits = trades.filter(t => t.tp3Hit).length;
    const tp4Hits = trades.filter(t => t.tp4Hit).length;

    // Calculate average exit level
    let avgExitLevel = 0;
    for (const trade of trades) {
      if (trade.exitReason === 'TP4') avgExitLevel += 4;
      else if (trade.exitReason === 'TP3') avgExitLevel += 3;
      else if (trade.exitReason === 'TP2') avgExitLevel += 2;
      else if (trade.exitReason === 'TP1') avgExitLevel += 1;
      else avgExitLevel += 0;  // Stop
    }
    avgExitLevel = trades.length > 0 ? avgExitLevel / trades.length : 0;

    // Streaks
    let maxWinStreak = 0, maxLossStreak = 0, currentStreak = 0;
    let lastWasWin: boolean | null = null;

    for (const trade of trades) {
      const isWin = trade.rMultiple > 0;
      if (lastWasWin === null || isWin === lastWasWin) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }

      if (isWin && currentStreak > maxWinStreak) maxWinStreak = currentStreak;
      if (!isWin && currentStreak > maxLossStreak) maxLossStreak = currentStreak;

      lastWasWin = isWin;
    }

    // By category analysis
    const winRateByRegime = this.calculateWinRateByCategory(trades, t => t.signal.regime);
    const winRateByTrend = this.calculateWinRateByCategory(trades, t => t.signal.patternFingerprint?.trendType || 'UNKNOWN');
    const winRateByDirection = this.calculateWinRateByCategory(trades, t => t.signal.type);
    const winRateByCvdDivergence = this.calculateWinRateByCategory(trades, t => t.signal.patternFingerprint?.cvdDivergence || 'NONE');

    // Time analysis
    const { bestHour, worstHour, bestDay, worstDay } = this.analyzeTimePerformance(trades);

    // Sharpe ratio (simplified)
    const returns = this.state.equityCurve.slice(1).map((p, i) =>
      (p.equity - this.state.equityCurve[i].equity) / this.state.equityCurve[i].equity
    );
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 1
      ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;  // Annualized

    // Calmar ratio
    const totalReturn = (this.state.equity - this.config.initialCapital) / this.config.initialCapital;
    const calmarRatio = this.state.maxDrawdown > 0 ? totalReturn / this.state.maxDrawdown : 0;

    return {
      totalTrades: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: trades.length > 0 ? wins.length / trades.length : 0,

      totalPnL,
      totalPnLPercent: (totalPnL / this.config.initialCapital) * 100,
      avgWin,
      avgLoss,
      avgWinR,
      avgLossR,
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnlUsd)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnlUsd)) : 0,

      // CRITICAL FIX: Cap profit factor to prevent Infinity breaking JSON serialization
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.99 : 0,
      expectancy: trades.length > 0 ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length : 0,
      expectancyDollar: trades.length > 0 ? totalPnL / trades.length : 0,
      payoffRatio: avgLoss > 0 ? avgWin / avgLoss : 0,

      maxDrawdown: this.state.maxDrawdown * this.config.initialCapital,
      maxDrawdownPercent: this.state.maxDrawdown * 100,
      avgDrawdown: this.state.equityCurve.length > 0
        ? (this.state.equityCurve.reduce((s, p) => s + p.drawdown, 0) / this.state.equityCurve.length) * 100
        : 0,
      calmarRatio,
      sharpeRatio,

      avgTradeDuration: trades.length > 0
        ? trades.reduce((s, t) => s + t.durationSeconds, 0) / trades.length
        : 0,
      avgBarsInTrade: trades.length > 0
        ? trades.reduce((s, t) => s + t.durationBars, 0) / trades.length
        : 0,
      avgMFE: trades.length > 0
        ? trades.reduce((s, t) => s + t.maxFavorableExcursion, 0) / trades.length
        : 0,
      avgMAE: trades.length > 0
        ? trades.reduce((s, t) => s + t.maxAdverseExcursion, 0) / trades.length
        : 0,

      tp1HitRate: trades.length > 0 ? tp1Hits / trades.length : 0,
      tp2HitRate: trades.length > 0 ? tp2Hits / trades.length : 0,
      tp3HitRate: trades.length > 0 ? tp3Hits / trades.length : 0,
      tp4HitRate: trades.length > 0 ? tp4Hits / trades.length : 0,
      avgExitLevel,

      winRateByRegime,
      winRateByTrend,
      winRateByDirection,
      winRateByCvdDivergence,

      bestHour,
      worstHour,
      bestDay,
      worstDay,

      maxWinStreak,
      maxLossStreak,
      currentStreak,

      finalEquity: this.state.equity,
      equityCurve: this.state.equityCurve,

      trades,

      patternLearningState: this.state.patternLearning
    };
  }

  private calculateWinRateByCategory(
    trades: ClosedTrade[],
    categoryFn: (t: ClosedTrade) => string
  ): Record<string, { count: number; winRate: number; avgR: number }> {
    const groups: Record<string, ClosedTrade[]> = {};

    for (const trade of trades) {
      const category = categoryFn(trade);
      if (!groups[category]) groups[category] = [];
      groups[category].push(trade);
    }

    const result: Record<string, { count: number; winRate: number; avgR: number }> = {};

    for (const [category, categoryTrades] of Object.entries(groups)) {
      const wins = categoryTrades.filter(t => t.rMultiple > 0);
      result[category] = {
        count: categoryTrades.length,
        winRate: categoryTrades.length > 0 ? wins.length / categoryTrades.length : 0,
        avgR: categoryTrades.length > 0
          ? categoryTrades.reduce((s, t) => s + t.rMultiple, 0) / categoryTrades.length
          : 0
      };
    }

    return result;
  }

  private analyzeTimePerformance(trades: ClosedTrade[]): {
    bestHour: number;
    worstHour: number;
    bestDay: number;
    worstDay: number;
  } {
    const hourPnL: Record<number, number[]> = {};
    const dayPnL: Record<number, number[]> = {};

    for (const trade of trades) {
      const date = new Date(trade.entryTime);
      const hour = date.getUTCHours();
      const day = date.getUTCDay();

      if (!hourPnL[hour]) hourPnL[hour] = [];
      if (!dayPnL[day]) dayPnL[day] = [];

      hourPnL[hour].push(trade.rMultiple);
      dayPnL[day].push(trade.rMultiple);
    }

    let bestHour = 0, worstHour = 0, bestHourAvg = -Infinity, worstHourAvg = Infinity;
    for (const [hour, pnls] of Object.entries(hourPnL)) {
      const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length;
      if (avg > bestHourAvg) { bestHourAvg = avg; bestHour = parseInt(hour); }
      if (avg < worstHourAvg) { worstHourAvg = avg; worstHour = parseInt(hour); }
    }

    let bestDay = 0, worstDay = 0, bestDayAvg = -Infinity, worstDayAvg = Infinity;
    for (const [day, pnls] of Object.entries(dayPnL)) {
      const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length;
      if (avg > bestDayAvg) { bestDayAvg = avg; bestDay = parseInt(day); }
      if (avg < worstDayAvg) { worstDayAvg = avg; worstDay = parseInt(day); }
    }

    return { bestHour, worstHour, bestDay, worstDay };
  }
}

// ============================================================================
// RESULTS FORMATTER
// ============================================================================

export function formatBacktestResults(results: BacktestResults): string {
  const lines: string[] = [];

  lines.push('='.repeat(65));
  lines.push('                    BACKTEST RESULTS V3.3                       ');
  lines.push('='.repeat(65));
  lines.push('');

  lines.push('OVERVIEW');
  lines.push(`   Total Trades: ${results.totalTrades}`);
  lines.push(`   Win Rate: ${(results.winRate * 100).toFixed(1)}% (${results.winningTrades}W / ${results.losingTrades}L)`);
  lines.push(`   Profit Factor: ${results.profitFactor.toFixed(2)}`);
  lines.push(`   Expectancy: ${results.expectancy.toFixed(2)}R ($${results.expectancyDollar.toFixed(2)})`);
  lines.push('');

  lines.push('PROFIT & LOSS');
  lines.push(`   Total P&L: $${results.totalPnL.toFixed(2)} (${results.totalPnLPercent.toFixed(1)}%)`);
  lines.push(`   Final Equity: $${results.finalEquity.toFixed(2)}`);
  lines.push(`   Avg Win: $${results.avgWin.toFixed(2)} (${results.avgWinR.toFixed(2)}R)`);
  lines.push(`   Avg Loss: -$${results.avgLoss.toFixed(2)} (${results.avgLossR.toFixed(2)}R)`);
  lines.push(`   Largest Win: $${results.largestWin.toFixed(2)}`);
  lines.push(`   Largest Loss: $${results.largestLoss.toFixed(2)}`);
  lines.push(`   Payoff Ratio: ${results.payoffRatio.toFixed(2)}`);
  lines.push('');

  lines.push('RISK METRICS');
  lines.push(`   Max Drawdown: $${results.maxDrawdown.toFixed(2)} (${results.maxDrawdownPercent.toFixed(1)}%)`);
  lines.push(`   Avg Drawdown: ${results.avgDrawdown.toFixed(1)}%`);
  lines.push(`   Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
  lines.push(`   Calmar Ratio: ${results.calmarRatio.toFixed(2)}`);
  lines.push('');

  lines.push('TARGET ANALYSIS');
  lines.push(`   TP1 Hit Rate: ${(results.tp1HitRate * 100).toFixed(1)}%`);
  lines.push(`   TP2 Hit Rate: ${(results.tp2HitRate * 100).toFixed(1)}%`);
  lines.push(`   TP3 Hit Rate: ${(results.tp3HitRate * 100).toFixed(1)}%`);
  lines.push(`   TP4 Hit Rate: ${(results.tp4HitRate * 100).toFixed(1)}%`);
  lines.push(`   Avg Exit Level: ${results.avgExitLevel.toFixed(1)} (1=TP1, 4=TP4)`);
  lines.push('');

  lines.push('TRADE METRICS');
  lines.push(`   Avg Duration: ${(results.avgTradeDuration / 3600).toFixed(1)} hours (${results.avgBarsInTrade.toFixed(1)} bars)`);
  lines.push(`   Avg MFE: ${results.avgMFE.toFixed(2)}%`);
  lines.push(`   Avg MAE: ${results.avgMAE.toFixed(2)}%`);
  lines.push(`   Max Win Streak: ${results.maxWinStreak}`);
  lines.push(`   Max Loss Streak: ${results.maxLossStreak}`);
  lines.push('');

  lines.push('PERFORMANCE BY CATEGORY');
  lines.push('   By Regime:');
  for (const [regime, stats] of Object.entries(results.winRateByRegime)) {
    lines.push(`      ${regime}: ${stats.count} trades, ${(stats.winRate * 100).toFixed(0)}% WR, ${stats.avgR.toFixed(2)}R avg`);
  }
  lines.push('   By Direction:');
  for (const [dir, stats] of Object.entries(results.winRateByDirection)) {
    lines.push(`      ${dir}: ${stats.count} trades, ${(stats.winRate * 100).toFixed(0)}% WR, ${stats.avgR.toFixed(2)}R avg`);
  }
  lines.push('   By CVD Divergence:');
  for (const [div, stats] of Object.entries(results.winRateByCvdDivergence)) {
    lines.push(`      ${div}: ${stats.count} trades, ${(stats.winRate * 100).toFixed(0)}% WR, ${stats.avgR.toFixed(2)}R avg`);
  }
  lines.push('');

  lines.push('TIME ANALYSIS');
  lines.push(`   Best Hour (UTC): ${results.bestHour}:00`);
  lines.push(`   Worst Hour (UTC): ${results.worstHour}:00`);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  lines.push(`   Best Day: ${days[results.bestDay]}`);
  lines.push(`   Worst Day: ${days[results.worstDay]}`);
  lines.push('');

  lines.push('PATTERN LEARNING');
  const pl = results.patternLearningState;
  lines.push(`   Patterns Learned: ${pl.totalTrades}`);
  lines.push(`   Overall Win Rate: ${(pl.winRate * 100).toFixed(1)}%`);
  lines.push(`   Recent Win Rate (last 20): ${(pl.recentWinRate * 100).toFixed(1)}%`);
  lines.push(`   Expectancy: ${pl.expectancy.toFixed(2)}R`);
  lines.push('');

  lines.push('='.repeat(65));

  return lines.join('\n');
}

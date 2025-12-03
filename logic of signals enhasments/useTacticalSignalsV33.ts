/**
 * useTacticalSignalsV33 - React Hook with Pattern Learning
 * 
 * Features:
 * - Pattern learning state persistence
 * - Multi-target TP management
 * - Enhanced signal analytics
 * - Trade outcome recording
 * 
 * @version 3.3.0
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  generateTacticalSignalV33,
  TacticalResultV33,
  TacticalConfigV33,
  DEFAULT_CONFIG_V33,
  SignalHistoryState,
  EMPTY_SIGNAL_HISTORY,
  PatternLearningState,
  EMPTY_PATTERN_LEARNING,
  addTradeOutcome,
  purgeOldOutcomes,
  TradeOutcome,
  EnhancedTradeSignal,
  PatternMatch,
  TargetLevel
} from '../services/tacticalSignalsV33';
import { aggrService } from '../services/aggrService';
import { TradeSignal } from '../types';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const SIGNAL_HISTORY_KEY = 'ipcha-signal-history-v33';
const PATTERN_LEARNING_KEY = 'ipcha-pattern-learning-v33';

// ============================================================================
// TYPES
// ============================================================================

interface UseTacticalSignalsV33Options {
  enabled?: boolean;
  refreshIntervalMs?: number;
  lifecycleCheckIntervalMs?: number;
  config?: Partial<TacticalConfigV33>;
  
  // Callbacks
  onSignalGenerated?: (signal: EnhancedTradeSignal, result: TacticalResultV33) => void;
  onSignalRejected?: (reason: string, stage: string, result: TacticalResultV33) => void;
  onTargetHit?: (signal: EnhancedTradeSignal, targetLevel: number, price: number) => void;
  onStopHit?: (signal: EnhancedTradeSignal, price: number) => void;
  onPatternLearned?: (outcome: TradeOutcome) => void;
}

interface UseTacticalSignalsV33Return {
  // Current result
  result: TacticalResultV33 | null;
  
  // State
  signalHistory: SignalHistoryState;
  patternLearning: PatternLearningState;
  
  // Processing
  isProcessing: boolean;
  error: string | null;
  lastUpdate: number;
  
  // Computed
  signalQuality: SignalQualityV33;
  patternInsights: PatternInsights;
  targetProgress: TargetProgress | null;
  
  // Actions
  forceRefresh: () => void;
  updateConfig: (config: Partial<TacticalConfigV33>) => void;
  recordTradeOutcome: (outcome: TradeOutcome) => void;
  clearHistory: () => void;
  clearPatternLearning: () => void;
  exportPatternLearning: () => string;
  importPatternLearning: (json: string) => boolean;
}

interface SignalQualityV33 {
  label: string;
  color: string;
  bgColor: string;
  confidence: number;
  description: string;
  patternBoost: number;
  patternWinRate: number | null;
  similarPatternCount: number;
}

interface PatternInsights {
  totalPatterns: number;
  overallWinRate: number;
  recentWinRate: number;
  bestRegime: { name: string; winRate: number } | null;
  bestPattern: { name: string; winRate: number } | null;
  worstPattern: { name: string; winRate: number } | null;
  expectancy: number;
  profitFactor: number;
}

interface TargetProgress {
  signal: EnhancedTradeSignal;
  currentPrice: number;
  tp1Progress: number;  // 0-100%
  tp2Progress: number;
  tp3Progress: number;
  tp4Progress: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  tp4Hit: boolean;
  pnlPercent: number;
  rMultiple: number;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

function loadSignalHistory(): SignalHistoryState {
  try {
    const stored = localStorage.getItem(SIGNAL_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const cutoff = Date.now() - 3600000;
      const prunedEntries = (parsed.entries || []).filter((e: any) => e.timestamp > cutoff);
      return { entries: prunedEntries, lastSignalTimestamp: parsed.lastSignalTimestamp || 0 };
    }
  } catch (e) {
    console.warn('[V33] Failed to load signal history:', e);
  }
  return EMPTY_SIGNAL_HISTORY;
}

function saveSignalHistory(history: SignalHistoryState): void {
  try {
    localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('[V33] Failed to save signal history:', e);
  }
}

function loadPatternLearning(): PatternLearningState {
  try {
    const stored = localStorage.getItem(PATTERN_LEARNING_KEY);
    if (stored) {
      const loaded: PatternLearningState = JSON.parse(stored);
      // Automatically purge outcomes older than 90 days on load
      const purged = purgeOldOutcomes(loaded, 90);
      // If purging removed any outcomes, save the cleaned state
      if (purged.totalTrades !== loaded.totalTrades) {
        savePatternLearning(purged);
      }
      return purged;
    }
  } catch (e) {
    console.warn('[V33] Failed to load pattern learning:', e);
  }
  return EMPTY_PATTERN_LEARNING;
}

function savePatternLearning(learning: PatternLearningState): void {
  try {
    localStorage.setItem(PATTERN_LEARNING_KEY, JSON.stringify(learning));
  } catch (e) {
    console.warn('[V33] Failed to save pattern learning:', e);
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useTacticalSignalsV33(
  options: UseTacticalSignalsV33Options = {}
): UseTacticalSignalsV33Return {
  const {
    enabled = true,
    refreshIntervalMs = 5000,
    lifecycleCheckIntervalMs = 10000,
    config: configOverrides,
    onSignalGenerated,
    onSignalRejected,
    onTargetHit,
    onStopHit,
    onPatternLearned
  } = options;

  // State
  const [result, setResult] = useState<TacticalResultV33 | null>(null);
  const [signalHistory, setSignalHistory] = useState<SignalHistoryState>(() => loadSignalHistory());
  const [patternLearning, setPatternLearning] = useState<PatternLearningState>(() => loadPatternLearning());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [activeConfig, setActiveConfig] = useState<TacticalConfigV33>({
    ...DEFAULT_CONFIG_V33,
    ...configOverrides
  });

  // Refs
  const prevSignalRef = useRef<EnhancedTradeSignal | null>(null);

  // Store selectors
  const chartData = useStore(state => state.chartData);
  const price = useStore(state => state.price);
  const signals = useStore(state => state.signals);
  const setSignals = useStore(state => state.setSignals);
  
  const workerState = useStore(state => ({
    sentimentLabel: state.sentimentLabel,
    sentimentScore: state.sentimentScore,
    vix: state.vix,
    dxy: state.dxy,
    btcd: state.btcd,
    enhancedMetrics: state.enhancedMetrics,
    derivatives: state.derivatives,
    technicals: state.technicals
  }));

  // Persist on change
  useEffect(() => {
    saveSignalHistory(signalHistory);
  }, [signalHistory]);

  useEffect(() => {
    savePatternLearning(patternLearning);
  }, [patternLearning]);

  // Generate signals
  const generateSignals = useCallback(() => {
    if (!chartData || chartData.length < 200) return;
    if (isProcessing) return;

    setIsProcessing(true);
    
    try {
      const orderFlowStats = aggrService.getStats();
      
      const signalResult = generateTacticalSignalV33(
        chartData,
        workerState,
        orderFlowStats,
        signalHistory,
        patternLearning,
        activeConfig
      );

      setSignalHistory(signalResult.updatedHistory);
      setResult(signalResult);
      setError(null);
      setLastUpdate(Date.now());

      if (signalResult.signal) {
        // Check if new signal
        if (!prevSignalRef.current || prevSignalRef.current.id !== signalResult.signal.id) {
          handleNewSignal(signalResult.signal, signalResult);
          prevSignalRef.current = signalResult.signal;
        }
      } else if (signalResult.rejectionStage !== 'NONE') {
        onSignalRejected?.(
          signalResult.rejectionReason || 'Unknown',
          signalResult.rejectionStage,
          signalResult
        );
      }
    } catch (err: any) {
      console.error('[V33] Signal generation error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  }, [chartData, workerState, signalHistory, patternLearning, activeConfig, isProcessing, onSignalRejected]);

  // Handle new signal
  const handleNewSignal = useCallback((signal: EnhancedTradeSignal, result: TacticalResultV33) => {
    const currentSignals = useStore.getState().signals;
    
    // Add to signals list
    setSignals([signal as TradeSignal, ...currentSignals]);
    onSignalGenerated?.(signal, result);
    
    console.log('[V33] New signal:', {
      type: signal.type,
      confidence: signal.confidence,
      patternAdjustment: signal.patternConfidenceAdjustment,
      targets: signal.targets.length
    });
  }, [setSignals, onSignalGenerated]);

  // Auto refresh
  useEffect(() => {
    if (!enabled) return;
    generateSignals();
    const interval = setInterval(generateSignals, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [enabled, refreshIntervalMs, generateSignals]);

  // Lifecycle check (SL/TP monitoring)
  useEffect(() => {
    if (!enabled) return;

    const checkLifecycles = () => {
      const currentPrice = useStore.getState().price;
      const currentSignals = useStore.getState().signals;
      
      const updated = currentSignals.map(signal => {
        const enhanced = signal as EnhancedTradeSignal;
        if (!enhanced.targetLevels || enhanced.status !== 'ACTIVE') return signal;

        const isLong = enhanced.type === 'LONG';
        const entryPrice = parseFloat(enhanced.entryZone);
        const stopPrice = enhanced.currentStopPrice || parseFloat(enhanced.invalidation);

        // Check stop
        const stopHit = isLong ? currentPrice <= stopPrice : currentPrice >= stopPrice;
        if (stopHit) {
          onStopHit?.(enhanced, currentPrice);
          return { ...signal, status: 'INVALIDATED' };
        }

        // Check targets
        let newTargetLevels = [...enhanced.targetLevels];
        let newCurrentStop = stopPrice;
        
        for (let i = 0; i < newTargetLevels.length; i++) {
          const target = newTargetLevels[i];
          if (target.status !== 'PENDING') continue;
          
          const tpHit = isLong ? currentPrice >= target.price : currentPrice <= target.price;
          if (tpHit) {
            newTargetLevels[i] = { ...target, status: 'HIT', hitTime: Date.now(), hitPrice: currentPrice };
            onTargetHit?.(enhanced, i + 1, currentPrice);
            
            // Move stop to breakeven after TP1
            if (i === 0) {
              newCurrentStop = entryPrice;
            }
          }
        }

        // Check if all targets hit
        const allHit = newTargetLevels.every(t => t.status === 'HIT');
        if (allHit) {
          return { ...signal, status: 'COMPLETED', targetLevels: newTargetLevels, currentStopPrice: newCurrentStop };
        }

        return { ...signal, targetLevels: newTargetLevels, currentStopPrice: newCurrentStop };
      });

      setSignals(updated);
    };

    checkLifecycles();
    const interval = setInterval(checkLifecycles, lifecycleCheckIntervalMs);
    return () => clearInterval(interval);
  }, [enabled, lifecycleCheckIntervalMs, setSignals, onTargetHit, onStopHit]);

  // Actions
  const forceRefresh = useCallback(() => {
    setIsProcessing(false);
    generateSignals();
  }, [generateSignals]);

  const updateConfig = useCallback((newConfig: Partial<TacticalConfigV33>) => {
    setActiveConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const recordTradeOutcome = useCallback((outcome: TradeOutcome) => {
    const updated = addTradeOutcome(patternLearning, outcome);
    setPatternLearning(updated);
    onPatternLearned?.(outcome);
    console.log('[V33] Trade outcome recorded:', outcome.rMultipleAchieved.toFixed(2), 'R');
  }, [patternLearning, onPatternLearned]);

  const clearHistory = useCallback(() => {
    setSignalHistory(EMPTY_SIGNAL_HISTORY);
    localStorage.removeItem(SIGNAL_HISTORY_KEY);
  }, []);

  const clearPatternLearning = useCallback(() => {
    setPatternLearning(EMPTY_PATTERN_LEARNING);
    localStorage.removeItem(PATTERN_LEARNING_KEY);
  }, []);

  const exportPatternLearning = useCallback(() => {
    return JSON.stringify(patternLearning, null, 2);
  }, [patternLearning]);

  const importPatternLearning = useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json);
      if (imported.outcomes && Array.isArray(imported.outcomes)) {
        setPatternLearning(imported);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Computed: Signal quality
  const signalQuality = useMemo((): SignalQualityV33 => {
    if (!result) {
      return {
        label: 'NO_DATA',
        color: 'text-gray-500',
        bgColor: 'bg-gray-500/10',
        confidence: 0,
        description: 'Waiting for data',
        patternBoost: 0,
        patternWinRate: null,
        similarPatternCount: 0
      };
    }

    if (result.signal) {
      const conf = result.signal.confidence;
      const patternWR = result.patternAnalysis.patternWinRate;
      const boost = result.patternAnalysis.confidenceAdjustment;
      const patternCount = result.patternAnalysis.similarPatterns.length;

      let label = 'MODERATE';
      let color = 'text-blue-400';
      let bgColor = 'bg-blue-500/10';
      
      if (conf >= 75) {
        label = 'STRONG';
        color = 'text-green-400';
        bgColor = 'bg-green-500/10';
      } else if (conf < 55) {
        label = 'WEAK';
        color = 'text-yellow-400';
        bgColor = 'bg-yellow-500/10';
      }

      let description = `${result.signal.type} with ${conf}% confidence`;
      if (patternCount > 0 && patternWR !== null) {
        description += ` (${patternCount} similar patterns: ${(patternWR * 100).toFixed(0)}% WR)`;
      }

      return {
        label,
        color,
        bgColor,
        confidence: conf,
        description,
        patternBoost: boost,
        patternWinRate: patternWR,
        similarPatternCount: patternCount
      };
    }

    return {
      label: result.rejectionStage,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      confidence: 0,
      description: result.rejectionReason || 'No signal',
      patternBoost: 0,
      patternWinRate: null,
      similarPatternCount: 0
    };
  }, [result]);

  // Computed: Pattern insights
  const patternInsights = useMemo((): PatternInsights => {
    const pl = patternLearning;
    
    // Find best/worst patterns
    let bestRegime: { name: string; winRate: number } | null = null;
    let bestPattern: { name: string; winRate: number } | null = null;
    let worstPattern: { name: string; winRate: number } | null = null;

    for (const [name, stats] of Object.entries(pl.statsByRegime)) {
      if (stats.count >= 5) {
        if (!bestRegime || stats.winRate > bestRegime.winRate) {
          bestRegime = { name, winRate: stats.winRate };
        }
      }
    }

    for (const [name, stats] of Object.entries(pl.statsByCvdDivergence)) {
      if (stats.count >= 5) {
        if (!bestPattern || stats.winRate > bestPattern.winRate) {
          bestPattern = { name, winRate: stats.winRate };
        }
        if (!worstPattern || stats.winRate < worstPattern.winRate) {
          worstPattern = { name, winRate: stats.winRate };
        }
      }
    }

    return {
      totalPatterns: pl.totalTrades,
      overallWinRate: pl.winRate,
      recentWinRate: pl.recentWinRate,
      bestRegime,
      bestPattern,
      worstPattern,
      expectancy: pl.expectancy,
      profitFactor: pl.profitFactor
    };
  }, [patternLearning]);

  // Computed: Target progress for active signal
  const targetProgress = useMemo((): TargetProgress | null => {
    if (!result?.signal) return null;

    const signal = result.signal;
    const currentPrice = price;
    const entryPrice = parseFloat(signal.entryZone);
    const stopPrice = parseFloat(signal.invalidation);
    const isLong = signal.type === 'LONG';

    const calculateProgress = (targetPrice: number) => {
      const totalMove = Math.abs(targetPrice - entryPrice);
      const currentMove = isLong 
        ? currentPrice - entryPrice 
        : entryPrice - currentPrice;
      return Math.max(0, Math.min(100, (currentMove / totalMove) * 100));
    };

    const risk = Math.abs(entryPrice - stopPrice);
    const pnlPoints = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
    const rMultiple = risk > 0 ? pnlPoints / risk : 0;

    return {
      signal,
      currentPrice,
      tp1Progress: signal.targetLevels[0] ? calculateProgress(signal.targetLevels[0].price) : 0,
      tp2Progress: signal.targetLevels[1] ? calculateProgress(signal.targetLevels[1].price) : 0,
      tp3Progress: signal.targetLevels[2] ? calculateProgress(signal.targetLevels[2].price) : 0,
      tp4Progress: signal.targetLevels[3] ? calculateProgress(signal.targetLevels[3].price) : 0,
      tp1Hit: signal.targetLevels[0]?.status === 'HIT',
      tp2Hit: signal.targetLevels[1]?.status === 'HIT',
      tp3Hit: signal.targetLevels[2]?.status === 'HIT',
      tp4Hit: signal.targetLevels[3]?.status === 'HIT',
      pnlPercent: (pnlPoints / entryPrice) * 100,
      rMultiple
    };
  }, [result, price]);

  return {
    result,
    signalHistory,
    patternLearning,
    isProcessing,
    error,
    lastUpdate,
    signalQuality,
    patternInsights,
    targetProgress,
    forceRefresh,
    updateConfig,
    recordTradeOutcome,
    clearHistory,
    clearPatternLearning,
    exportPatternLearning,
    importPatternLearning
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function formatTargetLevels(targets: TargetLevel[]): string[] {
  return targets.map((t, i) => {
    const status = t.status === 'HIT' ? '✅' : t.status === 'MISSED' ? '❌' : '⏳';
    return `TP${i + 1} (${t.rMultiple}R): $${t.price.toFixed(2)} ${status} [${t.positionPct}%]`;
  });
}

export function formatPatternInsights(insights: PatternInsights): string[] {
  const lines: string[] = [];
  
  lines.push(`📊 Pattern Learning: ${insights.totalPatterns} trades`);
  lines.push(`   Win Rate: ${(insights.overallWinRate * 100).toFixed(1)}%`);
  lines.push(`   Recent (20): ${(insights.recentWinRate * 100).toFixed(1)}%`);
  lines.push(`   Expectancy: ${insights.expectancy.toFixed(2)}R`);
  lines.push(`   Profit Factor: ${insights.profitFactor.toFixed(2)}`);
  
  if (insights.bestRegime) {
    lines.push(`   Best Regime: ${insights.bestRegime.name} (${(insights.bestRegime.winRate * 100).toFixed(0)}%)`);
  }
  if (insights.bestPattern) {
    lines.push(`   Best Pattern: ${insights.bestPattern.name} (${(insights.bestPattern.winRate * 100).toFixed(0)}%)`);
  }
  
  return lines;
}

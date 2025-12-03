/**
 * BACKTEST PANEL V3.3.1
 * Test Tactical V3.3.1 strategy on historical data
 * Collapsible panel with multi-target TP analysis
 */

import React, { useState } from 'react';
import {
  Activity,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Clock,
  BarChart3
} from 'lucide-react';
import { fetchHistoricalCandles } from '../services/backtestingService';
import { BacktestEngine, BacktestResults, DEFAULT_BACKTEST_CONFIG } from '../services/backtestEngine';
import { DEFAULT_CONFIG_V33 } from '../types';

export const BacktestPanel: React.FC = () => {
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Config state
  const [days, setDays] = useState(30);
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h'>('15m');
  const [riskPercent, setRiskPercent] = useState(1);
  const [minConfidence, setMinConfidence] = useState(50);
  const [usePartialExits, setUsePartialExits] = useState(true);

  const runBacktest = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      // Fetch historical data
      const candles = await fetchHistoricalCandles('BTCUSDT', timeframe, days);

      if (!candles || candles.length < 200) {
        alert('Insufficient data. Try fewer days or check your connection.');
        setIsRunning(false);
        return;
      }

      console.log(`[Backtest V3.3.1] Running with ${candles.length} candles`);

      // Create backtest engine with V3.3.1
      const engine = new BacktestEngine(
        candles,
        {},  // App state
        {
          ...DEFAULT_BACKTEST_CONFIG,
          riskPerTrade: riskPercent,
          minConfidence,
          usePartialExits,
          enableLearningFeedback: true
        },
        {
          ...DEFAULT_CONFIG_V33,
          assetType: 'CRYPTO',
          disableWeekendPenalty: true,
          disableSessionPenalty: true
        }
      );

      // Run backtest
      const btResults = engine.run();
      setResults(btResults);

      console.log(`[Backtest V3.3.1] Completed: ${btResults.totalTrades} trades, ${(btResults.winRate * 100).toFixed(1)}% win rate`);
    } catch (error) {
      console.error('[Backtest V3.3.1] Error:', error);
      alert('Backtest failed. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  // Collapsed view
  if (isCollapsed) {
    return (
      <div
        className="card-premium cursor-pointer hover:border-green-500/30 transition-all"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-green-400" />
            <span className="text-sm font-bold text-gray-300">BACKTEST V3.3.1</span>
            {results && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                results.winRate >= 0.5 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {(results.winRate * 100).toFixed(1)}% WR | {results.totalTrades} trades
              </span>
            )}
          </div>
          <ChevronDown size={16} className="text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-premium">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-md border border-green-500/20">
            <Activity className="text-green-400" size={20} />
          </div>
          <div>
            <h2 className="font-sans font-bold text-sm text-gray-100 tracking-wide">
              TACTICAL V3.3.1 BACKTESTER
            </h2>
            <div className="text-[10px] font-medium text-gray-500">
              Multi-target TPs | Pattern learning | Walk-forward
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runBacktest}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-sans font-bold text-xs transition-all ${
              isRunning
                ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                : 'bg-green-500 text-black hover:bg-green-400'
            }`}
          >
            <PlayCircle size={14} />
            {isRunning ? 'RUNNING...' : 'RUN'}
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Configuration */}
        <div className="col-span-4 space-y-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Parameters</h3>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-gray-500 block">Days</label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 30)}
              min={7}
              max={90}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-gray-500 block">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '15m' | '1h' | '4h')}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500/50"
            >
              <option value="15m">15 Minutes</option>
              <option value="1h">1 Hour</option>
              <option value="4h">4 Hours</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-gray-500 block">Risk per Trade (%)</label>
            <input
              type="number"
              value={riskPercent}
              onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
              step={0.5}
              min={0.5}
              max={5}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-gray-500 block">Min Confidence</label>
            <input
              type="number"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseInt(e.target.value, 10) || 50)}
              min={30}
              max={80}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="partialExits"
              checked={usePartialExits}
              onChange={(e) => setUsePartialExits(e.target.checked)}
              className="rounded border-white/20"
            />
            <label htmlFor="partialExits" className="text-[10px] font-medium text-gray-400">
              Multi-target TPs (partial exits)
            </label>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-8">
          {!results && !isRunning && (
            <div className="h-48 flex flex-col items-center justify-center text-gray-500 opacity-60">
              <BarChart3 size={32} className="mb-2 opacity-50" />
              <span className="text-xs font-medium">Configure and run backtest</span>
            </div>
          )}

          {isRunning && (
            <div className="h-48 flex flex-col items-center justify-center text-green-400 animate-pulse">
              <Activity size={32} className="mb-2" />
              <span className="text-xs font-bold">BACKTESTING V3.3.1...</span>
              <span className="text-[10px] text-gray-500 mt-1">
                Analyzing {days} days | {timeframe} timeframe
              </span>
            </div>
          )}

          {results && (
            <div className="space-y-3">
              {/* Primary Metrics */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <div className="text-[9px] font-medium text-gray-500 mb-0.5">WIN RATE</div>
                  <div className={`text-lg font-bold ${
                    results.winRate >= 0.5 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(results.winRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-gray-500">
                    {results.winningTrades}W / {results.losingTrades}L
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <div className="text-[9px] font-medium text-gray-500 mb-0.5">TOTAL P&L</div>
                  <div className={`text-lg font-bold ${
                    results.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${results.totalPnL.toFixed(0)}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    {results.totalPnLPercent.toFixed(1)}% ROI
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <div className="text-[9px] font-medium text-gray-500 mb-0.5">PROFIT FACTOR</div>
                  <div className={`text-lg font-bold ${
                    results.profitFactor >= 1.5 ? 'text-green-400' : results.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {results.profitFactor === Infinity ? '---' : results.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    {results.profitFactor >= 1.5 ? 'Excellent' : results.profitFactor >= 1 ? 'Okay' : 'Poor'}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <div className="text-[9px] font-medium text-gray-500 mb-0.5">EXPECTANCY</div>
                  <div className={`text-lg font-bold ${
                    results.expectancy >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {results.expectancy.toFixed(2)}R
                  </div>
                  <div className="text-[9px] text-gray-500">
                    ${results.expectancyDollar.toFixed(0)}/trade
                  </div>
                </div>
              </div>

              {/* Target Analysis */}
              <div className="bg-white/5 border border-white/10 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={12} className="text-green-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Target Hit Rates</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'TP1', rate: results.tp1HitRate, color: 'bg-green-400' },
                    { label: 'TP2', rate: results.tp2HitRate, color: 'bg-green-500' },
                    { label: 'TP3', rate: results.tp3HitRate, color: 'bg-green-600' },
                    { label: 'TP4', rate: results.tp4HitRate, color: 'bg-green-700' }
                  ].map(({ label, rate, color }) => (
                    <div key={label} className="text-center">
                      <div className="text-[9px] font-medium text-gray-500 mb-1">{label}</div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${rate * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-gray-300 mt-1">
                        {(rate * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max Drawdown:</span>
                      <span className="text-red-400 font-medium">{results.maxDrawdownPercent.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sharpe Ratio:</span>
                      <span className={`font-medium ${results.sharpeRatio >= 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {results.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Win/Loss:</span>
                      <span className="text-blue-400 font-medium">{results.payoffRatio.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Duration:</span>
                      <span className="text-gray-300 font-medium">
                        {(results.avgTradeDuration / 3600).toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Win Streak:</span>
                      <span className="text-green-400 font-medium">{results.maxWinStreak}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Loss Streak:</span>
                      <span className="text-red-400 font-medium">{results.maxLossStreak}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pattern Learning Stats */}
              {results.patternLearningState.totalTrades > 0 && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={12} className="text-purple-400" />
                    <span className="text-[10px] font-bold text-purple-400 uppercase">
                      Pattern Learning ({results.patternLearningState.totalTrades} patterns)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-gray-500">Learned WR:</span>
                      <span className="text-purple-300 font-medium ml-1">
                        {(results.patternLearningState.winRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Recent WR:</span>
                      <span className="text-purple-300 font-medium ml-1">
                        {(results.patternLearningState.recentWinRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expectancy:</span>
                      <span className="text-purple-300 font-medium ml-1">
                        {results.patternLearningState.expectancy.toFixed(2)}R
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-yellow-500/5 border border-yellow-500/10 rounded p-2 flex items-start gap-2">
                <AlertTriangle size={12} className="text-yellow-500/50 shrink-0 mt-0.5" />
                <div className="text-[9px] font-medium text-yellow-500/70 leading-relaxed">
                  Past performance does not guarantee future results. Includes simulated fees but assumes optimal execution.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

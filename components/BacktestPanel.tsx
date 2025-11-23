/**
 * BACKTEST PANEL
 * Test Tactical v2 strategy on historical data
 * Shows win rate, Sharpe ratio, equity curve
 */

import React, { useState } from 'react';
import { Activity, PlayCircle, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react';
import { fetchHistoricalCandles, backtestTacticalV2, BacktestResults } from '../services/backtestingService';

export const BacktestPanel: React.FC = () => {
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [days, setDays] = useState(30);
  const [stopLoss, setStopLoss] = useState(1.5);
  const [takeProfit, setTakeProfit] = useState(3.0);

  const runBacktest = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      // Fetch historical data
      const candles = await fetchHistoricalCandles('BTCUSDT', '15m', days);

      if (candles.length < 200) {
        alert('Insufficient data. Try fewer days or check your connection.');
        setIsRunning(false);
        return;
      }

      // Run backtest
      const btResults = backtestTacticalV2(candles, {
        stopLossPercent: stopLoss,
        takeProfitPercent: takeProfit,
        maxHoldBars: 96 // 24 hours for 15m chart
      });

      setResults(btResults);
    } catch (error) {
      console.error('[Backtest UI] Error:', error);
      alert('Backtest failed. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full grid grid-cols-12 gap-4 p-4 overflow-y-auto">
      {/* Header */}
      <div className="col-span-12 bg-terminal-card border border-terminal-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-terminal-accent/10 rounded border border-terminal-accent/20">
              <Activity className="text-terminal-accent" size={24} />
            </div>
            <div>
              <h2 className="font-mono font-bold text-lg text-terminal-text">
                TACTICAL V2 BACKTESTER
              </h2>
              <div className="text-xs font-mono text-terminal-muted mt-1">
                Test strategy on historical data • No repainting • Real signals
              </div>
            </div>
          </div>
          <button
            onClick={runBacktest}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded font-mono font-bold transition-all ${
              isRunning
                ? 'bg-terminal-border text-terminal-muted cursor-not-allowed'
                : 'bg-terminal-accent text-terminal-bg hover:brightness-110'
            }`}
          >
            <PlayCircle size={18} />
            {isRunning ? 'RUNNING...' : 'RUN BACKTEST'}
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="col-span-4 bg-terminal-card border border-terminal-border rounded-lg p-4">
        <h3 className="font-mono font-bold text-sm text-terminal-muted mb-4">BACKTEST PARAMETERS</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-terminal-muted mb-2 block">
              Days of History
            </label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              min={7}
              max={90}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-accent"
            />
            <div className="text-[10px] text-terminal-muted mt-1">
              Max 90 days (Binance limit: 1000 candles)
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-terminal-muted mb-2 block">
              Stop Loss (%)
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(parseFloat(e.target.value))}
              step={0.1}
              min={0.5}
              max={10}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-accent"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-terminal-muted mb-2 block">
              Take Profit (%)
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
              step={0.1}
              min={0.5}
              max={20}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-accent"
            />
          </div>

          <div className="pt-4 border-t border-terminal-border/50 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-terminal-muted">Timeframe:</span>
              <span className="text-terminal-text">15m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-muted">Max Hold:</span>
              <span className="text-terminal-text">24 hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-terminal-muted">Expected R:R:</span>
              <span className="text-terminal-accent font-bold">
                {(takeProfit / stopLoss).toFixed(2)}:1
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="col-span-8 bg-terminal-card border border-terminal-border rounded-lg p-4">
        {!results && !isRunning && (
          <div className="h-full flex flex-col items-center justify-center text-terminal-muted opacity-50">
            <Activity size={48} className="mb-4" />
            <span className="text-sm font-mono">Configure parameters and click RUN BACKTEST</span>
          </div>
        )}

        {isRunning && (
          <div className="h-full flex flex-col items-center justify-center text-terminal-accent animate-pulse">
            <Activity size={48} className="mb-4 animate-spin" />
            <span className="text-sm font-mono">BACKTESTING IN PROGRESS...</span>
            <span className="text-xs font-mono text-terminal-muted mt-2">
              Analyzing {days} days of historical data
            </span>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <h3 className="font-mono font-bold text-sm text-terminal-text mb-4">
              BACKTEST RESULTS
            </h3>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-terminal-bg border border-terminal-border rounded p-3">
                <div className="text-xs font-mono text-terminal-muted mb-1">WIN RATE</div>
                <div className={`text-2xl font-mono font-bold ${
                  results.winRate >= 50 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {results.winRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-terminal-muted mt-1">
                  {results.winningTrades}/{results.totalTrades} trades
                </div>
              </div>

              <div className="bg-terminal-bg border border-terminal-border rounded p-3">
                <div className="text-xs font-mono text-terminal-muted mb-1">TOTAL P&L</div>
                <div className={`text-2xl font-mono font-bold ${
                  results.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {results.totalPnL >= 0 ? '+' : ''}${results.totalPnL.toFixed(2)}
                </div>
                <div className="text-[10px] text-terminal-muted mt-1">
                  {((results.totalPnL / 10000) * 100).toFixed(2)}% ROI
                </div>
              </div>

              <div className="bg-terminal-bg border border-terminal-border rounded p-3">
                <div className="text-xs font-mono text-terminal-muted mb-1">SHARPE RATIO</div>
                <div className={`text-2xl font-mono font-bold ${
                  results.sharpeRatio >= 1 ? 'text-green-500' : results.sharpeRatio >= 0.5 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {results.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-[10px] text-terminal-muted mt-1">
                  {results.sharpeRatio >= 1 ? 'Good' : results.sharpeRatio >= 0.5 ? 'Fair' : 'Poor'}
                </div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-terminal-bg border border-terminal-border rounded p-3">
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-terminal-muted">Avg Win:</span>
                    <span className="text-green-500">+${results.avgWin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-terminal-muted">Avg Loss:</span>
                    <span className="text-red-500">-${results.avgLoss.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-terminal-border/50 pt-2">
                    <span className="text-terminal-muted">Profit Factor:</span>
                    <span className="text-terminal-accent font-bold">
                      {results.profitFactor.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-terminal-bg border border-terminal-border rounded p-3">
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-terminal-muted">Max Drawdown:</span>
                    <span className="text-red-500">{results.maxDrawdown.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-terminal-muted">Total Trades:</span>
                    <span className="text-terminal-text">{results.totalTrades}</span>
                  </div>
                  <div className="flex justify-between border-t border-terminal-border/50 pt-2">
                    <span className="text-terminal-muted">Winning Trades:</span>
                    <span className="text-green-500">{results.winningTrades}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-[10px] font-mono text-yellow-500 leading-relaxed">
                <strong>DISCLAIMER:</strong> Past performance does not guarantee future results.
                This backtest assumes perfect execution (no slippage, no fees).
                Real trading results will vary.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

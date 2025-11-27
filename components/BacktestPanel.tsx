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

      if (!candles || candles.length < 200) {
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
      <div className="col-span-12 card-premium">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-md border border-green-500/20">
              <Activity className="text-green-400" size={24} />
            </div>
            <div>
              <h2 className="font-sans font-bold text-lg text-gray-100 tracking-wide">
                TACTICAL V2 BACKTESTER
              </h2>
              <div className="text-xs font-medium text-gray-500 mt-1">
                Test strategy on historical data • No repainting • Real signals
              </div>
            </div>
          </div>
          <button
            onClick={runBacktest}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-sans font-bold transition-all shadow-lg ${
              isRunning
                ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                : 'bg-green-500 text-black hover:bg-green-400 hover:shadow-green-500/20'
            }`}
          >
            <PlayCircle size={18} />
            {isRunning ? 'RUNNING...' : 'RUN BACKTEST'}
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="col-span-4 card-premium">
        <h3 className="font-sans font-semibold text-sm text-gray-400 mb-4 uppercase tracking-wider">Parameters</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Days of History
            </label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              min={7}
              max={90}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm font-sans text-gray-200 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all"
            />
            <div className="text-[10px] text-gray-600 mt-1">
              Max 90 days (Binance limit: 1000 candles)
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Stop Loss (%)
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(parseFloat(e.target.value))}
              step={0.1}
              min={0.5}
              max={10}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm font-sans text-gray-200 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Take Profit (%)
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
              step={0.1}
              min={0.5}
              max={20}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm font-sans text-gray-200 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all"
            />
          </div>

          <div className="pt-4 border-t border-white/10 space-y-2 text-xs font-medium">
            <div className="flex justify-between">
              <span className="text-gray-500">Timeframe:</span>
              <span className="text-gray-300">15m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max Hold:</span>
              <span className="text-gray-300">24 hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expected R:R:</span>
              <span className="text-green-400 font-bold">
                {(takeProfit / stopLoss).toFixed(2)}:1
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="col-span-8 card-premium">
        {!results && !isRunning && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
            <Activity size={48} className="mb-4 opacity-50" />
            <span className="text-sm font-medium">Configure parameters and click RUN BACKTEST</span>
          </div>
        )}

        {isRunning && (
          <div className="h-full flex flex-col items-center justify-center text-green-400 animate-pulse">
            <div className="relative">
              <Activity size={48} className="mb-4" />
              <div className="absolute inset-0 blur-xl bg-green-500/20"></div>
            </div>
            <span className="text-sm font-bold tracking-wide">BACKTESTING IN PROGRESS...</span>
            <span className="text-xs font-medium text-gray-500 mt-2">
              Analyzing {days} days of historical data
            </span>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <h3 className="font-sans font-semibold text-sm text-gray-400 mb-4 uppercase tracking-wider">
              Performance Results
            </h3>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-md p-4 hover:border-white/20 transition-all">
                <div className="text-xs font-medium text-gray-500 mb-1">WIN RATE</div>
                <div className={`text-3xl font-sans font-bold ${
                  results.winRate >= 50 ? 'text-green-400 text-glow-bullish' : 'text-red-400 text-glow-bearish'
                }`}>
                  {results.winRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {results.winningTrades}/{results.totalTrades} trades
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-md p-4 hover:border-white/20 transition-all">
                <div className="text-xs font-medium text-gray-500 mb-1">TOTAL P&L</div>
                <div className={`text-3xl font-sans font-bold ${
                  results.totalPnL >= 0 ? 'text-green-400 text-glow-bullish' : 'text-red-400 text-glow-bearish'
                }`}>
                  {results.totalPnL >= 0 ? '+' : ''}${results.totalPnL.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {((results.totalPnL / 10000) * 100).toFixed(2)}% ROI
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-md p-4 hover:border-white/20 transition-all">
                <div className="text-xs font-medium text-gray-500 mb-1">SHARPE RATIO</div>
                <div className={`text-3xl font-sans font-bold ${
                  results.sharpeRatio >= 1 ? 'text-green-400 text-glow-bullish' : results.sharpeRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {results.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {results.sharpeRatio >= 1 ? 'Excellent' : results.sharpeRatio >= 0.5 ? 'Fair' : 'Poor'}
                </div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-md p-4">
                <div className="space-y-3 text-xs font-medium">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Win:</span>
                    <span className="text-green-400">+${results.avgWin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Loss:</span>
                    <span className="text-red-400">-${results.avgLoss.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2">
                    <span className="text-gray-500">Profit Factor:</span>
                    <span className="text-blue-400 font-bold">
                      {results.profitFactor.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-md p-4">
                <div className="space-y-3 text-xs font-medium">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max Drawdown:</span>
                    <span className="text-red-400">{results.maxDrawdown.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Trades:</span>
                    <span className="text-gray-200">{results.totalTrades}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2">
                    <span className="text-gray-500">Winning Trades:</span>
                    <span className="text-green-400">{results.winningTrades}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-500/50 shrink-0 mt-0.5" />
              <div className="text-[10px] font-medium text-yellow-500/70 leading-relaxed">
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

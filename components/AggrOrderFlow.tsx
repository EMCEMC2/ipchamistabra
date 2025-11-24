/**
 * AGGR ORDER FLOW PANEL
 * Real-time order flow intelligence from Aggr.trade
 * Shows: CVD, Buy/Sell Pressure, Liquidations, Large Trades, Exchange Flow
 */

import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Zap } from 'lucide-react';
import { aggrService, AggrStats } from '../services/aggrService';
import {
  analyzeCVD,
  generateTradingSignal,
  TradingSignal
} from '../services/aggrIntelligence';

export const AggrOrderFlow: React.FC = () => {
  const [stats, setStats] = useState<AggrStats | null>(null);
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to Aggr service
    aggrService.connect((newStats) => {
      setStats(newStats);
      const newSignal = generateTradingSignal(newStats);
      setSignal(newSignal);
    });

    setIsConnected(true);

    return () => {
      aggrService.disconnect();
      setIsConnected(false);
    };
  }, []);

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center text-terminal-muted">
        <div className="text-center">
          <Activity className="mx-auto mb-2 animate-pulse" size={32} />
          <div className="text-sm font-mono">Connecting to Aggr.trade...</div>
        </div>
      </div>
    );
  }

  const cvdAnalysis = analyzeCVD(stats);
  const pressure = stats.pressure;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto p-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-400" size={16} />
          <h3 className="font-sans font-semibold text-sm text-gray-200 tracking-wide">
            Order Flow Intelligence
          </h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${
          isConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      {/* Trading Signal */}
      {signal && (
        <div className={`p-3 rounded-md border ${
          signal.type === 'LONG' ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]' :
          signal.type === 'SHORT' ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]' :
          'bg-white/5 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {signal.type === 'LONG' ? (
                <TrendingUp className="text-green-400" size={16} />
              ) : signal.type === 'SHORT' ? (
                <TrendingDown className="text-red-400" size={16} />
              ) : (
                <Activity className="text-gray-400" size={16} />
              )}
              <span className={`font-sans font-bold text-sm ${
                signal.type === 'LONG' ? 'text-green-400' :
                signal.type === 'SHORT' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {signal.type} SIGNAL
              </span>
            </div>
            <span className="text-xs font-medium text-gray-400">
              {signal.confidence}% confidence
            </span>
          </div>
          <div className="space-y-1">
            {signal.triggers.map((trigger, i) => (
              <div key={i} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-gray-500" />
                {trigger}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CVD Indicator */}
      <div className="card-premium p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">CUMULATIVE VOLUME DELTA</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
            cvdAnalysis.trend === 'bullish' ? 'bg-green-500/10 text-green-400' :
            cvdAnalysis.trend === 'bearish' ? 'bg-red-500/10 text-red-400' :
            'bg-white/5 text-gray-400'
          }`}>
            {cvdAnalysis.trend.toUpperCase()}
          </span>
        </div>
        <div className="text-2xl font-sans font-bold text-gray-100 mb-1">
          {stats.cvd.delta > 0 ? '+' : ''}${(stats.cvd.delta / 1000000).toFixed(2)}M
        </div>
        <div className="text-[10px] text-gray-500">
          Cumulative: {stats.cvd.cumulativeDelta > 0 ? '+' : ''}${(stats.cvd.cumulativeDelta / 1000000).toFixed(2)}M
        </div>
        <div className="mt-2 text-[10px] text-gray-400 leading-relaxed border-t border-white/5 pt-2">
          {cvdAnalysis.reasoning}
        </div>
      </div>

      {/* Buy/Sell Pressure */}
      <div className="card-premium p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">MARKET PRESSURE (60s)</span>
          <span className={`text-xs font-bold ${
            pressure.dominantSide === 'buy' ? 'text-green-400' :
            pressure.dominantSide === 'sell' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {pressure.strength.toUpperCase()}
          </span>
        </div>

        {/* Pressure Bar */}
        <div className="relative h-6 bg-black/40 rounded-md overflow-hidden mb-2 border border-white/5">
          <div
            className="absolute left-0 top-0 h-full bg-green-500/40"
            style={{ width: `${pressure.buyPressure}%` }}
          />
          <div
            className="absolute right-0 top-0 h-full bg-red-500/40"
            style={{ width: `${pressure.sellPressure}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-xs font-bold text-white shadow-sm">
              {pressure.buyPressure.toFixed(1)}% / {pressure.sellPressure.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-medium">
          <div>
            <span className="text-gray-500">Buy Vol:</span>
            <span className="text-green-400 ml-1">${(stats.buyVolume / 1000000).toFixed(2)}M</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500">Sell Vol:</span>
            <span className="text-red-400 ml-1">${(stats.sellVolume / 1000000).toFixed(2)}M</span>
          </div>
        </div>
      </div>

      {/* Liquidations */}
      {stats.liquidationCount > 0 && (
        <div className="card-premium p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-yellow-500" size={14} />
            <span className="text-xs font-medium text-gray-500">LIQUIDATIONS (5min)</span>
          </div>
          <div className="text-xl font-sans font-bold text-yellow-500 mb-1">
            {stats.liquidationCount} events
          </div>
          <div className="text-[10px] text-gray-500">
            Total: ${(stats.liquidationVolume / 1000000).toFixed(2)}M
          </div>

          {stats.recentLiquidations.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
              {stats.recentLiquidations.slice(0, 3).map((liq, i) => (
                <div key={i} className="flex justify-between text-[9px] font-medium">
                  <span className={liq.side === 'long' ? 'text-red-400' : 'text-green-400'}>
                    {liq.side.toUpperCase()} ${(liq.usdValue / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-gray-500">{liq.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Large Trades */}
      {stats.largeTradeCount > 0 && (
        <div className="card-premium p-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-purple-400" size={14} />
            <span className="text-xs font-medium text-gray-500">WHALE TRADES (60s)</span>
          </div>
          <div className="text-xl font-sans font-bold text-purple-400 mb-1">
            {stats.largeTradeCount} whales
          </div>
          <div className="text-[10px] text-gray-500">
            Trades &gt; $500K
          </div>

          {stats.recentLargeTrades.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
              {stats.recentLargeTrades.slice(0, 3).map((trade, i) => (
                <div key={i} className="flex justify-between text-[9px] font-medium">
                  <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                    {trade.side.toUpperCase()} ${(trade.usdValue / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-gray-500">{trade.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exchange Flow */}
      {stats.exchanges.length > 0 && (
        <div className="card-premium p-3">
          <div className="text-xs font-medium text-gray-500 mb-2">
            EXCHANGE BREAKDOWN
          </div>
          <div className="space-y-2">
            {stats.exchanges.slice(0, 3).map((ex, i) => (
              <div key={i}>
                <div className="flex justify-between text-[10px] font-medium mb-1">
                  <span className="text-gray-300">{ex.exchange}</span>
                  <span className="text-gray-500">{ex.dominance.toFixed(1)}%</span>
                </div>
                <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full ${
                      ex.netFlow > 0 ? 'bg-green-500' : ex.netFlow < 0 ? 'bg-red-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${Math.min(ex.dominance, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

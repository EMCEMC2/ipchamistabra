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
    <div className="h-full flex flex-col gap-3 overflow-y-auto p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="text-terminal-accent" size={18} />
          <h3 className="font-mono font-bold text-sm text-terminal-text tracking-wider">
            ORDER FLOW INTELLIGENCE
          </h3>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-mono ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      {/* Trading Signal */}
      {signal && (
        <div className={`p-3 rounded border ${
          signal.type === 'LONG' ? 'bg-green-500/10 border-green-500/30' :
          signal.type === 'SHORT' ? 'bg-red-500/10 border-red-500/30' :
          'bg-terminal-border/10 border-terminal-border/30'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {signal.type === 'LONG' ? (
                <TrendingUp className="text-green-500" size={16} />
              ) : signal.type === 'SHORT' ? (
                <TrendingDown className="text-red-500" size={16} />
              ) : (
                <Activity className="text-terminal-muted" size={16} />
              )}
              <span className={`font-mono font-bold text-sm ${
                signal.type === 'LONG' ? 'text-green-500' :
                signal.type === 'SHORT' ? 'text-red-500' :
                'text-terminal-muted'
              }`}>
                {signal.type} SIGNAL
              </span>
            </div>
            <span className="text-xs font-mono text-terminal-muted">
              {signal.confidence}% confidence
            </span>
          </div>
          <div className="space-y-1">
            {signal.triggers.map((trigger, i) => (
              <div key={i} className="text-[10px] font-mono text-terminal-muted">
                • {trigger}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CVD Indicator */}
      <div className="bg-terminal-card border border-terminal-border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-terminal-muted">CUMULATIVE VOLUME DELTA</span>
          <span className={`text-xs font-mono font-bold ${
            cvdAnalysis.trend === 'bullish' ? 'text-green-500' :
            cvdAnalysis.trend === 'bearish' ? 'text-red-500' :
            'text-terminal-muted'
          }`}>
            {cvdAnalysis.trend.toUpperCase()}
          </span>
        </div>
        <div className="text-2xl font-mono font-bold text-terminal-text mb-1">
          {stats.cvd.delta > 0 ? '+' : ''}${(stats.cvd.delta / 1000000).toFixed(2)}M
        </div>
        <div className="text-[10px] font-mono text-terminal-muted">
          Cumulative: {stats.cvd.cumulativeDelta > 0 ? '+' : ''}${(stats.cvd.cumulativeDelta / 1000000).toFixed(2)}M
        </div>
        <div className="mt-2 text-[10px] font-mono text-terminal-muted leading-relaxed">
          {cvdAnalysis.reasoning}
        </div>
      </div>

      {/* Buy/Sell Pressure */}
      <div className="bg-terminal-card border border-terminal-border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-terminal-muted">MARKET PRESSURE (60s)</span>
          <span className={`text-xs font-mono font-bold ${
            pressure.dominantSide === 'buy' ? 'text-green-500' :
            pressure.dominantSide === 'sell' ? 'text-red-500' :
            'text-terminal-muted'
          }`}>
            {pressure.strength.toUpperCase()}
          </span>
        </div>

        {/* Pressure Bar */}
        <div className="relative h-6 bg-terminal-bg rounded overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-green-500/30"
            style={{ width: `${pressure.buyPressure}%` }}
          />
          <div
            className="absolute right-0 top-0 h-full bg-red-500/30"
            style={{ width: `${pressure.sellPressure}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono font-bold text-terminal-text">
              {pressure.buyPressure.toFixed(1)}% / {pressure.sellPressure.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <span className="text-terminal-muted">Buy Volume:</span>
            <span className="text-green-500 ml-1">${(stats.buyVolume / 1000000).toFixed(2)}M</span>
          </div>
          <div>
            <span className="text-terminal-muted">Sell Volume:</span>
            <span className="text-red-500 ml-1">${(stats.sellVolume / 1000000).toFixed(2)}M</span>
          </div>
        </div>
      </div>

      {/* Liquidations */}
      {stats.liquidationCount > 0 && (
        <div className="bg-terminal-card border border-terminal-border rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-yellow-500" size={14} />
            <span className="text-xs font-mono text-terminal-muted">LIQUIDATIONS (5min)</span>
          </div>
          <div className="text-xl font-mono font-bold text-yellow-500 mb-1">
            {stats.liquidationCount} events
          </div>
          <div className="text-[10px] font-mono text-terminal-muted">
            Total: ${(stats.liquidationVolume / 1000000).toFixed(2)}M
          </div>

          {stats.recentLiquidations.length > 0 && (
            <div className="mt-2 space-y-1">
              {stats.recentLiquidations.slice(0, 3).map((liq, i) => (
                <div key={i} className="flex justify-between text-[9px] font-mono">
                  <span className={liq.side === 'long' ? 'text-red-500' : 'text-green-500'}>
                    {liq.side.toUpperCase()} ${(liq.usdValue / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-terminal-muted">{liq.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Large Trades */}
      {stats.largeTradeCount > 0 && (
        <div className="bg-terminal-card border border-terminal-border rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-terminal-accent" size={14} />
            <span className="text-xs font-mono text-terminal-muted">WHALE TRADES (60s)</span>
          </div>
          <div className="text-xl font-mono font-bold text-terminal-accent mb-1">
            {stats.largeTradeCount} whales
          </div>
          <div className="text-[10px] font-mono text-terminal-muted">
            Trades &gt; $500K
          </div>

          {stats.recentLargeTrades.length > 0 && (
            <div className="mt-2 space-y-1">
              {stats.recentLargeTrades.slice(0, 3).map((trade, i) => (
                <div key={i} className="flex justify-between text-[9px] font-mono">
                  <span className={trade.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                    {trade.side.toUpperCase()} ${(trade.usdValue / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-terminal-muted">{trade.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exchange Flow */}
      {stats.exchanges.length > 0 && (
        <div className="bg-terminal-card border border-terminal-border rounded p-3">
          <div className="text-xs font-mono text-terminal-muted mb-2">
            EXCHANGE BREAKDOWN
          </div>
          <div className="space-y-2">
            {stats.exchanges.slice(0, 3).map((ex, i) => (
              <div key={i}>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-terminal-text">{ex.exchange}</span>
                  <span className="text-terminal-muted">{ex.dominance.toFixed(1)}%</span>
                </div>
                <div className="relative h-1 bg-terminal-bg rounded overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full ${
                      ex.netFlow > 0 ? 'bg-green-500' : ex.netFlow < 0 ? 'bg-red-500' : 'bg-terminal-muted'
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

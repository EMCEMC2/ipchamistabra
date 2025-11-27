/**
 * AGGR ORDER FLOW PANEL
 * Real-time order flow intelligence
 * Shows: CVD, Buy/Sell Pressure, Liquidations, Whale Trades, OI, L/S Ratio, Funding
 */

import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Zap, BarChart3, Users, Percent } from 'lucide-react';
import { AggrStats } from '../types/aggrTypes';
import { orderFlowIntel } from '../services/orderFlowIntel';
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
    console.log('[AggrOrderFlow] Component mounted, connecting to orderFlowIntel...');

    // Connect to REST-based intelligence service
    orderFlowIntel.connect((updatedStats) => {
      console.log('[AggrOrderFlow] Received stats update:', updatedStats);
      setStats(updatedStats);
      setIsConnected(true);

      // Generate trading signal from stats
      const newSignal = generateTradingSignal(updatedStats);
      setSignal(newSignal);
    });

    return () => {
      console.log('[AggrOrderFlow] Component unmounting, disconnecting...');
      orderFlowIntel.disconnect();
      setIsConnected(false);
    };
  }, []);

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center text-terminal-muted">
        <div className="text-center">
          <Activity className="mx-auto mb-2 animate-pulse" size={32} />
          <div className="text-sm font-mono">Connecting to Aggr.trade...</div>
          <div className="text-[10px] text-gray-600 mt-2">Initializing Worker...</div>
        </div>
      </div>
    );
  }

  const cvdAnalysis = analyzeCVD(stats);
  const pressure = stats.pressure;

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2">
          <Zap className="text-terminal-accent" size={16} />
          <h3 className="font-display font-semibold text-sm text-terminal-text tracking-wide text-glow-info">
            Order Flow
          </h3>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded border border-terminal-border bg-terminal-bg/50 backdrop-blur-sm">
          <div className={`status-indicator ${isConnected ? 'status-live' : 'status-error'}`} />
          <span className={`text-[10px] font-mono font-bold ${isConnected ? 'text-terminal-success' : 'text-terminal-danger'}`}>
            {isConnected ? 'LIVE FEED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {/* Top Row: CVD & Signal */}
        <div className="grid grid-cols-2 gap-2">
            {/* CVD Compact */}
            <div className="card-premium p-2 relative group">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-gray-500">CVD (Net)</span>
                    <span className={`text-[10px] font-bold ${cvdAnalysis.trend === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                        {cvdAnalysis.trend.toUpperCase()}
                    </span>
                </div>
                <div className="text-lg font-sans font-bold text-gray-100 truncate">
                    {stats.cvd?.cumulativeDelta > 0 ? '+' : ''}{((stats.cvd?.cumulativeDelta || 0) / 1000000).toFixed(2)}M
                </div>
                <div className="text-[9px] text-gray-500 mt-1 line-clamp-2 leading-tight">
                    {cvdAnalysis.reasoning}
                </div>
                
                {/* Retry Button (Only visible if using fallback/empty data) */}
                {stats.totalVolume === 0 && (
                  <button 
                    onClick={() => window.location.reload()}
                    className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="text-[10px] font-bold text-terminal-accent border border-terminal-accent px-2 py-1 rounded hover:bg-terminal-accent/10">
                      RETRY CONNECTION
                    </span>
                  </button>
                )}
            </div>

            {/* Signal Compact */}
            {signal ? (
                <div className={`p-2 rounded border flex flex-col justify-center ${
                    signal.type === 'LONG' ? 'bg-green-500/10 border-green-500/30' :
                    signal.type === 'SHORT' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-white/5 border-white/10'
                }`}>
                    <div className="flex items-center gap-2 mb-1">
                        {signal.type === 'LONG' ? <TrendingUp size={14} className="text-green-400"/> : <TrendingDown size={14} className="text-red-400"/>}
                        <span className={`font-bold text-xs ${signal.type === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                            {signal.type}
                        </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                        Conf: <span className="text-gray-200">{signal.confidence}%</span>
                    </div>
                </div>
            ) : (
                <div className="card-premium p-2 flex items-center justify-center text-gray-500 text-[10px]">
                    No Active Signal
                </div>
            )}
        </div>

        {/* Pressure Bar (Slim) */}
        <div className="card-premium p-2">
            <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-500">BUY PRESSURE</span>
                <span className="text-gray-500">SELL PRESSURE</span>
            </div>
            <div className="relative h-2 bg-black/40 rounded-full overflow-hidden mb-1">
                <div className="absolute left-0 top-0 h-full bg-green-500" style={{ width: `${pressure?.buyPressure || 50}%` }} />
                <div className="absolute right-0 top-0 h-full bg-red-500" style={{ width: `${pressure?.sellPressure || 50}%` }} />
            </div>
            <div className="flex justify-between text-[9px] font-mono">
                <span className="text-green-400">${((stats.buyVolume || 0) / 1000000).toFixed(1)}M</span>
                <span className="text-red-400">${((stats.sellVolume || 0) / 1000000).toFixed(1)}M</span>
            </div>
        </div>

        {/* Enhanced Intelligence Row: OI, L/S Ratio, Funding */}
        <div className="grid grid-cols-3 gap-1.5">
            {/* Open Interest */}
            <div className="card-premium p-1.5">
                <div className="flex items-center gap-1 mb-0.5">
                    <BarChart3 size={10} className="text-blue-400" />
                    <span className="text-[9px] text-gray-500">OI</span>
                </div>
                <div className="text-xs font-mono font-bold text-gray-100">
                    {stats.openInterest ? `${(stats.openInterest.openInterest / 1000).toFixed(1)}K` : '--'}
                </div>
                {stats.openInterest && stats.openInterest.change1h !== 0 && (
                    <div className={`text-[8px] ${stats.openInterest.change1h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.openInterest.change1h > 0 ? '+' : ''}{stats.openInterest.change1h.toFixed(1)}%
                    </div>
                )}
            </div>

            {/* Long/Short Ratio */}
            <div className="card-premium p-1.5">
                <div className="flex items-center gap-1 mb-0.5">
                    <Users size={10} className="text-purple-400" />
                    <span className="text-[9px] text-gray-500">L/S</span>
                </div>
                {stats.longShortRatio ? (
                    <>
                        <div className="text-xs font-mono font-bold text-gray-100">
                            {stats.longShortRatio.longShortRatio.toFixed(2)}
                        </div>
                        <div className="flex gap-1 text-[8px]">
                            <span className="text-green-400">{stats.longShortRatio.longRatio.toFixed(0)}%L</span>
                            <span className="text-red-400">{stats.longShortRatio.shortRatio.toFixed(0)}%S</span>
                        </div>
                    </>
                ) : (
                    <div className="text-xs font-mono text-gray-500">--</div>
                )}
            </div>

            {/* Funding Rate */}
            <div className="card-premium p-1.5">
                <div className="flex items-center gap-1 mb-0.5">
                    <Percent size={10} className="text-yellow-400" />
                    <span className="text-[9px] text-gray-500">FUND</span>
                </div>
                {stats.funding ? (
                    <>
                        <div className={`text-xs font-mono font-bold ${stats.funding.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(stats.funding.rate * 100).toFixed(4)}%
                        </div>
                        <div className="text-[8px] text-gray-500">
                            {stats.funding.annualizedRate.toFixed(1)}% APR
                        </div>
                    </>
                ) : (
                    <div className="text-xs font-mono text-gray-500">--</div>
                )}
            </div>
        </div>

        {/* Liquidations List */}
        {stats.recentLiquidations && stats.recentLiquidations.length > 0 && (
            <div className="card-premium p-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-yellow-500">
                        <AlertTriangle size={12} />
                        <span className="text-[10px] font-bold">LIQUIDATIONS</span>
                    </div>
                    <span className="text-[9px] text-gray-500">${(stats.liquidationVolume / 1000).toFixed(0)}K total</span>
                </div>
                <div className="space-y-1.5">
                    {(stats.recentLiquidations || []).slice(0, 5).map((liq, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b border-white/5 pb-1 last:border-0 last:pb-0">
                            <span className={`font-semibold ${liq.side === 'long' ? 'text-red-400' : 'text-green-400'}`}>
                                {liq.side.toUpperCase()} REKT
                            </span>
                            <span className="text-gray-200 font-medium">${(liq.usdValue / 1000).toFixed(1)}K</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Whale Trades List (lowered threshold to $100K) */}
        {stats.recentLargeTrades && stats.recentLargeTrades.length > 0 && (
            <div className="card-premium p-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-purple-400">
                        <DollarSign size={12} />
                        <span className="text-[10px] font-bold tracking-wide">WHALE ACTIVITY</span>
                    </div>
                    <span className="text-[9px] text-gray-500">{stats.largeTradeCount} trades</span>
                </div>
                <div className="space-y-1.5">
                    {(stats.recentLargeTrades || []).slice(0, 5).map((trade, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b border-white/5 pb-1 last:border-0 last:pb-0">
                            <div className="flex items-center gap-1.5">
                                <span className={`font-semibold ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                    {trade.side.toUpperCase()}
                                </span>
                                <span className="text-gray-500 text-[9px]">{trade.exchange}</span>
                            </div>
                            <span className="text-gray-200 font-medium">${(trade.usdValue / 1000).toFixed(1)}K</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* No Data State */}
        {!stats.recentLiquidations?.length && !stats.recentLargeTrades?.length && stats.totalVolume === 0 && (
            <div className="card-premium p-3 text-center">
                <Activity className="mx-auto mb-2 text-gray-600" size={24} />
                <div className="text-[10px] text-gray-500">Waiting for market activity...</div>
                <div className="text-[9px] text-gray-600 mt-1">Data updates every 2 seconds</div>
            </div>
        )}
      </div>
    </div>
  );
};

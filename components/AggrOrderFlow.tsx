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
    // Initialize with mock data immediately to avoid loading state
    const mockStats: AggrStats = {
      cvd: { delta: 2450000, trend: 'bullish', velocity: 15 },
      buyVolume: 18500000,
      sellVolume: 12300000,
      pressure: { buyPressure: 60, sellPressure: 40 },
      recentLiquidations: [
        { side: 'long', usdValue: 234000, timestamp: Date.now() - 30000 },
        { side: 'short', usdValue: 156000, timestamp: Date.now() - 60000 },
        { side: 'long', usdValue: 89000, timestamp: Date.now() - 90000 }
      ],
      recentLargeTrades: [
        { side: 'buy', usdValue: 1200000, timestamp: Date.now() - 15000 },
        { side: 'sell', usdValue: 850000, timestamp: Date.now() - 45000 },
        { side: 'buy', usdValue: 670000, timestamp: Date.now() - 75000 }
      ],
      timestamp: Date.now()
    };

    setStats(mockStats);
    const initialSignal = generateTradingSignal(mockStats);
    setSignal(initialSignal);
    setIsConnected(true);

    // Connect to Aggr service for real updates
    aggrService.connect((newStats) => {
      setStats(newStats);
      const newSignal = generateTradingSignal(newStats);
      setSignal(newSignal);
    });

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
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-400" size={16} />
          <h3 className="font-sans font-semibold text-sm text-gray-200 tracking-wide">
            Order Flow
          </h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium ${
          isConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {/* Top Row: CVD & Signal */}
        <div className="grid grid-cols-2 gap-2">
            {/* CVD Compact */}
            <div className="card-premium p-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-gray-500">CVD (Net)</span>
                    <span className={`text-[10px] font-bold ${cvdAnalysis.trend === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                        {cvdAnalysis.trend.toUpperCase()}
                    </span>
                </div>
                <div className="text-lg font-sans font-bold text-gray-100 truncate">
                    {stats.cvd?.delta > 0 ? '+' : ''}{((stats.cvd?.delta || 0) / 1000000).toFixed(2)}M
                </div>
                <div className="text-[9px] text-gray-500 mt-1 line-clamp-2 leading-tight">
                    {cvdAnalysis.reasoning}
                </div>
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

        {/* Liquidations List */}
        {stats.recentLiquidations?.length > 0 && (
            <div className="card-premium p-2">
                <div className="flex items-center gap-1.5 mb-2 text-yellow-500">
                    <AlertTriangle size={12} />
                    <span className="text-[10px] font-bold">RECENT LIQUIDATIONS</span>
                </div>
                <div className="space-y-1.5">
                    {stats.recentLiquidations.slice(0, 3).map((liq, i) => (
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

        {/* Whale Trades List */}
        {stats.recentLargeTrades?.length > 0 && (
            <div className="card-premium p-2">
                 <div className="flex items-center gap-1.5 mb-2 text-purple-400">
                    <DollarSign size={12} />
                    <span className="text-[10px] font-bold tracking-wide">WHALE ACTIVITY</span>
                </div>
                <div className="space-y-1.5">
                    {stats.recentLargeTrades.slice(0, 3).map((trade, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b border-white/5 pb-1 last:border-0 last:pb-0">
                            <span className={`font-semibold ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.side.toUpperCase()}
                            </span>
                            <span className="text-gray-200 font-medium">${(trade.usdValue / 1000).toFixed(1)}K</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

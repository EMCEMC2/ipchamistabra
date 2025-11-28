/**
 * BTC METRICS PANEL - Enhanced Trading Dashboard
 * Displays: Volatility, Volume, Derivatives, Risk/Levels, Sentiment
 * All data from real APIs (Binance, Deribit, CoinGecko, Alternative.me)
 */

import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { fetchEnhancedBTCMetrics } from '../services/macroDataService';
import { TrendingUp, TrendingDown, Minus, Activity, BarChart3, Wallet, Target, AlertTriangle } from 'lucide-react';

export const AiCommandCenter: React.FC = () => {
  const {
    price,
    priceChange,
    technicals,
    enhancedMetrics,
    setEnhancedMetrics,
    timeframe
  } = useStore();

  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch enhanced metrics on mount and every 60 seconds
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const metrics = await fetchEnhancedBTCMetrics();
        setEnhancedMetrics(metrics);
      } catch (error) {
        console.error('[AiCommandCenter] Failed to fetch metrics:', error);
      }
    };

    fetchMetrics();
    fetchIntervalRef.current = setInterval(fetchMetrics, 60000); // Every 60s

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [setEnhancedMetrics]);

  // Format helpers
  const formatPrice = (p: number) => p ? `$${p.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0';
  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v.toFixed(0)}`;
  };
  const formatOI = (oi: number) => oi > 0 ? `${(oi / 1000).toFixed(1)}K` : '0';

  // Color helpers
  const getTrendIcon = (trend: 'RISING' | 'FALLING' | 'STABLE') => {
    if (trend === 'RISING') return <TrendingUp size={10} className="text-green-400" />;
    if (trend === 'FALLING') return <TrendingDown size={10} className="text-red-400" />;
    return <Minus size={10} className="text-gray-500" />;
  };

  const getVolumeColor = (tag: string) => {
    if (tag === 'SPIKE') return 'text-yellow-400';
    if (tag === 'HIGH') return 'text-green-400';
    if (tag === 'QUIET') return 'text-red-400';
    return 'text-gray-300';
  };

  const getFundingColor = (rate: number) => {
    if (rate > 0.05) return 'text-green-400'; // Longs crowded
    if (rate < -0.02) return 'text-red-400';  // Shorts crowded
    return 'text-gray-300';
  };

  const getSentimentColor = (index: number) => {
    if (index >= 60) return 'text-green-400';
    if (index <= 40) return 'text-red-400';
    return 'text-yellow-400';
  };

  const getTrendStyle = () => {
    const trend = technicals?.trend || 'NEUTRAL';
    if (trend === 'BULLISH') return { color: 'text-green-400 bg-green-500/10', label: 'BULLISH' };
    if (trend === 'BEARISH') return { color: 'text-red-400 bg-red-500/10', label: 'BEARISH' };
    return { color: 'text-gray-400 bg-gray-500/10', label: 'NEUTRAL' };
  };

  const trendStyle = getTrendStyle();
  const m = enhancedMetrics;

  return (
    <div className="flex flex-col h-full bg-terminal-card border border-terminal-border rounded overflow-hidden text-[10px]">
      {/* Header: BTC Price */}
      <div className="px-2 py-1.5 border-b border-terminal-border bg-terminal-bg/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-500 uppercase">BTC</span>
            <span className="text-sm font-semibold text-white font-mono">{formatPrice(price)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-mono ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2) || '0.00'}%
            </span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${trendStyle.color}`}>
              {trendStyle.label}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: 2x2 Sections */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-terminal-border overflow-auto">

        {/* VOLATILITY Section */}
        <div className="bg-terminal-card p-2">
          <div className="flex items-center gap-1 mb-1.5 text-gray-500">
            <Activity size={10} />
            <span className="uppercase tracking-wide text-[8px]">Volatility</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">DVOL</span>
              <span className={`font-mono ${m.dvol > 60 ? 'text-red-400' : m.dvol > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                {m.dvol.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ATR (14d)</span>
              <span className="font-mono text-gray-300">{formatPrice(m.atr14d)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Range/ATR</span>
              <span className={`font-mono ${m.rangeVsAtr > 1.2 ? 'text-yellow-400' : m.rangeVsAtr < 0.5 ? 'text-gray-500' : 'text-gray-300'}`}>
                {m.rangeVsAtr.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>

        {/* VOLUME Section */}
        <div className="bg-terminal-card p-2">
          <div className="flex items-center gap-1 mb-1.5 text-gray-500">
            <BarChart3 size={10} />
            <span className="uppercase tracking-wide text-[8px]">Volume</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">24h</span>
              <span className="font-mono text-gray-300">{formatVolume(m.volume24h)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">vs 30d Avg</span>
              <span className={`font-mono ${m.volumeRatio > 1.3 ? 'text-green-400' : m.volumeRatio < 0.7 ? 'text-red-400' : 'text-gray-300'}`}>
                {(m.volumeRatio * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-mono ${getVolumeColor(m.volumeTag)}`}>{m.volumeTag}</span>
            </div>
          </div>
        </div>

        {/* DERIVATIVES Section */}
        <div className="bg-terminal-card p-2">
          <div className="flex items-center gap-1 mb-1.5 text-gray-500">
            <Wallet size={10} />
            <span className="uppercase tracking-wide text-[8px]">Derivatives</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Funding</span>
              <div className="flex items-center gap-1">
                <span className={`font-mono ${getFundingColor(m.fundingRate)}`}>
                  {m.fundingRate >= 0 ? '+' : ''}{m.fundingRate.toFixed(4)}%
                </span>
                {getTrendIcon(m.fundingTrend)}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">OI</span>
              <span className="font-mono text-gray-300">{formatOI(m.openInterest)} BTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">OI 24h</span>
              <span className={`font-mono ${m.oiChange24h > 0 ? 'text-green-400' : m.oiChange24h < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                {m.oiChange24h >= 0 ? '+' : ''}{m.oiChange24h.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* RISK / LEVELS Section */}
        <div className="bg-terminal-card p-2">
          <div className="flex items-center gap-1 mb-1.5 text-gray-500">
            <Target size={10} />
            <span className="uppercase tracking-wide text-[8px]">Risk/Levels</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">To 24h High</span>
              <span className={`font-mono ${m.distanceToHigh24h < 1 ? 'text-yellow-400' : 'text-gray-300'} ${m.distanceToHigh24h <= m.distanceToLow24h ? 'font-semibold' : ''}`}>
                +{m.distanceToHigh24h.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">To 24h Low</span>
              <span className={`font-mono ${m.distanceToLow24h < 1 ? 'text-yellow-400' : 'text-gray-300'} ${m.distanceToLow24h < m.distanceToHigh24h ? 'font-semibold' : ''}`}>
                -{m.distanceToLow24h.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">200d MA</span>
              <span className={`font-mono ${m.above200dMA ? 'text-green-400' : 'text-red-400'}`}>
                {m.above200dMA ? 'ABOVE' : 'BELOW'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Sentiment + Technicals + Dominance */}
      <div className="px-2 py-1.5 border-t border-terminal-border bg-terminal-bg/50">
        <div className="flex items-center justify-between text-[9px]">
          {/* Fear & Greed */}
          <div className="flex items-center gap-1">
            <AlertTriangle size={9} className="text-gray-500" />
            <span className="text-gray-500">F&G:</span>
            <span className={`font-mono ${getSentimentColor(m.fearGreedIndex)}`}>
              {m.fearGreedIndex} ({m.fearGreedLabel})
            </span>
          </div>

          {/* RSI + MACD with timeframe context */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">RSI(14,{timeframe})</span>
              <span className={`font-mono ${(technicals?.rsi || 0) > 70 ? 'text-red-400' : (technicals?.rsi || 0) < 30 ? 'text-green-400' : 'text-gray-300'}`}>
                {technicals?.rsi?.toFixed(0) || '0'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">MACD({timeframe})</span>
              <span className={`font-mono ${(technicals?.macd?.histogram || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(technicals?.macd?.histogram || 0) >= 0 ? '+' : ''}{technicals?.macd?.histogram?.toFixed(0) || '0'}
              </span>
            </div>
          </div>

          {/* BTC Dominance */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">DOM:</span>
            <span className="font-mono text-yellow-400">{m.btcDominance.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

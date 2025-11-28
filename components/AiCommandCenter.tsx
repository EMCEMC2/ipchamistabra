/**
 * MARKET METRICS PANEL
 * Minimalist display combining technicals and market data
 */

import React from 'react';
import { useStore } from '../store/useStore';

export const AiCommandCenter: React.FC = () => {
  const {
    price,
    priceChange,
    vix,
    btcd,
    sentimentScore,
    sentimentLabel,
    technicals
  } = useStore();

  // Format price with commas
  const formatPrice = (p: number) => {
    return p ? `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
  };

  // Get sentiment color
  const getSentimentColor = () => {
    if (sentimentScore >= 60) return 'text-green-400';
    if (sentimentScore <= 40) return 'text-red-400';
    return 'text-yellow-400';
  };

  // Get trend color and label
  const getTrendStyle = () => {
    const trend = technicals?.trend || 'NEUTRAL';
    if (trend === 'BULLISH') return { color: 'text-green-400 bg-green-500/10', label: 'BULLISH' };
    if (trend === 'BEARISH') return { color: 'text-red-400 bg-red-500/10', label: 'BEARISH' };
    return { color: 'text-gray-400 bg-gray-500/10', label: 'NEUTRAL' };
  };

  const trendStyle = getTrendStyle();

  return (
    <div className="flex flex-col h-full bg-terminal-card border border-terminal-border rounded overflow-hidden">
      {/* BTC Price - Main Display */}
      <div className="px-3 py-2 border-b border-terminal-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide">BTC Price</span>
          <span className={`text-[10px] font-mono ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(3) || '0.000'}%
          </span>
        </div>
        <div className="text-lg font-semibold text-white font-mono">
          {formatPrice(price)}
        </div>
      </div>

      {/* Sentiment */}
      <div className="px-3 py-2 border-b border-terminal-border">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide">Sentiment</span>
          <span className="text-[9px] text-gray-600 font-mono">Score: {sentimentScore || 0}</span>
        </div>
        <div className={`text-sm font-medium ${getSentimentColor()}`}>
          {sentimentLabel || 'Neutral'}
        </div>
      </div>

      {/* Technicals Grid */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-terminal-border">
        {/* RSI */}
        <div className="bg-terminal-card px-3 py-2">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide block mb-1">RSI (14)</span>
          <span className={`text-sm font-mono ${
            (technicals?.rsi || 0) > 70 ? 'text-red-400' :
            (technicals?.rsi || 0) < 30 ? 'text-green-400' : 'text-white'
          }`}>
            {technicals?.rsi?.toFixed(1) || '0.0'}
          </span>
        </div>

        {/* MACD */}
        <div className="bg-terminal-card px-3 py-2">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide block mb-1">MACD</span>
          <span className={`text-sm font-mono ${
            (technicals?.macd?.histogram || 0) >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {technicals?.macd?.histogram?.toFixed(2) || '0.00'}
          </span>
        </div>

        {/* VIX */}
        <div className="bg-terminal-card px-3 py-2">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide block mb-1">VIX</span>
          <span className={`text-sm font-mono ${vix > 20 ? 'text-red-400' : 'text-green-400'}`}>
            {vix?.toFixed(2) || '0.00'}
          </span>
        </div>

        {/* BTC Dominance */}
        <div className="bg-terminal-card px-3 py-2">
          <span className="text-[9px] text-gray-500 uppercase tracking-wide block mb-1">BTC Dom</span>
          <span className="text-sm font-mono text-yellow-400">
            {btcd?.toFixed(1) || '0.0'}%
          </span>
        </div>
      </div>

      {/* Trend Footer */}
      <div className="px-3 py-2 border-t border-terminal-border flex items-center justify-between">
        <span className="text-[9px] text-gray-500 uppercase tracking-wide">Trend</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${trendStyle.color}`}>
          {trendStyle.label}
        </span>
      </div>
    </div>
  );
};

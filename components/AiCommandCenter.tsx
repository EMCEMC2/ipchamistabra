import React from 'react';
import { Activity, BarChart2, Zap, TrendingUp, Brain, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { FeedTooltip } from './FeedTooltip';
import { checkFeedHealth } from '../services/feedRegistry';

// Helper for freshness dot
const FreshnessDot = ({ feedId }: { feedId: string }) => {
  const { feeds } = useStore();
  const feed = feeds[feedId];
  const health = feed ? checkFeedHealth(feed) : 'connecting';
  
  const color = 
    health === 'fresh' ? 'bg-green-500' :
    health === 'stale' ? 'bg-yellow-500' :
    health === 'error' ? 'bg-red-500' :
    'bg-gray-500'; // connecting

  return (
    <div className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse shadow-[0_0_5px_currentColor]`} />
  );
};

export const AiCommandCenter: React.FC = () => {
  const { 
    price, 
    priceChange, 
    sentimentScore, 
    sentimentLabel,
    derivatives,
    technicals,
    enhancedMetrics
  } = useStore();

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Top Row: Price & Volatility */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        {/* Price Card */}
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 relative overflow-hidden group hover:border-green-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={40} />
          </div>
          <div className="flex justify-between items-start mb-2">
            <FeedTooltip feedId="binancePrice">
                <div className="flex items-center gap-2 cursor-help">
                    <span className="text-[10px] font-medium text-gray-400 tracking-wider">BTC/USDT</span>
                    <FreshnessDot feedId="binancePrice" />
                </div>
            </FeedTooltip>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${priceChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-white tracking-tight">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-gray-500">Real-time Price</span>
          </div>
        </div>

        {/* Volatility / Regime Card */}
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart2 size={40} />
          </div>
          <div className="flex justify-between items-start mb-2">
            <FeedTooltip feedId="regime">
                <div className="flex items-center gap-2 cursor-help">
                    <span className="text-[10px] font-medium text-gray-400 tracking-wider">REGIME</span>
                    <FreshnessDot feedId="regime" />
                </div>
            </FeedTooltip>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              (enhancedMetrics.volumeTag === 'HIGH' || enhancedMetrics.volumeTag === 'SPIKE') ? 'bg-orange-500/20 text-orange-400' :
              enhancedMetrics.volumeTag === 'QUIET' ? 'bg-blue-500/20 text-blue-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {enhancedMetrics.volumeTag}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white">
              {technicals.atr.toFixed(0)} <span className="text-xs font-normal text-gray-500">ATR</span>
            </span>
            <span className="text-[10px] text-gray-500">Volatility Index</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Sentiment, Funding, Order Flow */}
      <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
          {/* Sentiment Card */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-2">
              <FeedTooltip feedId="sentiment">
                <div className="flex items-center gap-2 cursor-help">
                  <Brain size={14} className="text-purple-400" />
                  <span className="text-[10px] font-medium text-gray-400 tracking-wider">SENTIMENT</span>
                  <FreshnessDot feedId="sentiment" />
                </div>
              </FeedTooltip>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                sentimentLabel === 'Bullish' ? 'bg-green-500/20 text-green-400' :
                sentimentLabel === 'Bearish' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {sentimentLabel}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{sentimentScore}</span>
              <span className="text-[10px] text-gray-500">/ 100</span>
            </div>
          </div>

          {/* Funding Card */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-2">
              <FeedTooltip feedId="funding">
                <div className="flex items-center gap-2 cursor-help">
                  <Activity size={14} className="text-blue-400" />
                  <span className="text-[10px] font-medium text-gray-400 tracking-wider">FUNDING</span>
                  <FreshnessDot feedId="funding" />
                </div>
              </FeedTooltip>
            </div>
            <div className="flex flex-col">
              <span className={`text-lg font-bold ${
                parseFloat(derivatives.fundingRate) > 0.01 ? 'text-green-400' : 
                parseFloat(derivatives.fundingRate) < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {derivatives.fundingRate}%
              </span>
              <span className="text-[10px] text-gray-500">Predicted: Stable</span>
            </div>
          </div>

          {/* Order Flow / OI Card */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 relative overflow-hidden group hover:border-orange-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-2">
              <FeedTooltip feedId="orderFlow">
                <div className="flex items-center gap-2 cursor-help">
                  <Zap size={14} className="text-orange-400" />
                  <span className="text-[10px] font-medium text-gray-400 tracking-wider">ORDER FLOW</span>
                  <FreshnessDot feedId="orderFlow" />
                </div>
              </FeedTooltip>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">{derivatives.openInterest}</span>
              <span className="text-[10px] text-gray-500">Open Interest (BTC)</span>
            </div>
          </div>
      </div>
    </div>
  );
};

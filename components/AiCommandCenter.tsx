import React from 'react';
import { Activity, BarChart2, Zap, TrendingUp, Brain } from 'lucide-react';
import { FeedTooltip } from './FeedTooltip';
import { checkFeedHealth } from '../services/feedRegistry';
import {
  usePriceData,
  useSentiment,
  useDerivatives,
  useTechnicals,
  useEnhancedMetrics,
  useFeed
} from '../store/selectors';

// Helper for freshness dot - uses targeted selector
const FreshnessDot = ({ feedId }: { feedId: string }) => {
  const feed = useFeed(feedId);
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
  // Optimized selectors - only re-render when specific values change
  const { price, priceChange } = usePriceData();
  const { score: sentimentScore } = useSentiment();
  const derivatives = useDerivatives();
  const technicals = useTechnicals();
  const enhancedMetrics = useEnhancedMetrics();

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden">
      {/* Top Row: Price & Volatility */}
      <div className="grid grid-cols-2 gap-1.5 h-[46%] min-h-[75px]">
        {/* Price Card */}
        <div className="bg-white/5 rounded-lg p-2 border border-white/10 relative overflow-hidden group hover:border-green-500/30 transition-all duration-300 flex flex-col">
          <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={32} />
          </div>
          <div className="flex justify-between items-start mb-1 flex-shrink-0">
            <FeedTooltip feedId="binancePrice">
                <div className="flex items-center gap-1.5 cursor-help">
                    <span className="text-[9px] font-medium text-gray-400 tracking-wider">BTC/USDT</span>
                    <FreshnessDot feedId="binancePrice" />
                </div>
            </FeedTooltip>
            <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${priceChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col flex-1 justify-center">
            <span className="text-xl font-bold text-white tracking-tight leading-tight">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-gray-500 mt-0.5">Real-time Price</span>
          </div>
        </div>

        {/* Volatility / Regime Card */}
        <div className="bg-white/5 rounded-lg p-2 border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 flex flex-col">
          <div className="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart2 size={32} />
          </div>
          <div className="flex justify-between items-start mb-1 flex-shrink-0">
            <FeedTooltip feedId="regime">
                <div className="flex items-center gap-1.5 cursor-help">
                    <span className="text-[9px] font-medium text-gray-400 tracking-wider">REGIME</span>
                    <FreshnessDot feedId="regime" />
                </div>
            </FeedTooltip>
            <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
              (enhancedMetrics.volumeTag === 'HIGH' || enhancedMetrics.volumeTag === 'SPIKE') ? 'bg-orange-500/20 text-orange-400' :
              enhancedMetrics.volumeTag === 'QUIET' ? 'bg-blue-500/20 text-blue-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {enhancedMetrics.volumeTag}
            </span>
          </div>
          <div className="flex flex-col flex-1 justify-center">
            <span className="text-base font-bold text-white leading-tight">
              {technicals.atr.toFixed(0)} <span className="text-[10px] font-normal text-gray-500">ATR</span>
            </span>
            <span className="text-[9px] text-gray-500 mt-0.5">Volatility Index</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Sentiment, Funding, Order Flow, Technicals */}
      <div className="grid grid-cols-3 gap-1.5 h-[52%] min-h-[70px]">
          {/* Sentiment Card */}
          <div className="bg-white/5 rounded-lg p-1.5 border border-white/10 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-1.5 flex-shrink-0">
              <FeedTooltip feedId="sentiment">
                <div className="flex items-center gap-1 cursor-help">
                  <Brain size={10} className="text-purple-400" />
                  <span className="text-[8px] font-medium text-gray-400 tracking-wider">SENT</span>
                  <FreshnessDot feedId="sentiment" />
                </div>
              </FeedTooltip>
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                sentimentScore >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {sentimentScore >= 50 ? 'BULL' : 'BEAR'}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <span className="text-base font-bold text-white leading-none">{sentimentScore}</span>
              <span className="text-[8px] text-gray-500 leading-none">/ 100</span>
            </div>
          </div>

          {/* Funding Card */}
          <div className="bg-white/5 rounded-lg p-1.5 border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-1.5 flex-shrink-0">
              <FeedTooltip feedId="funding">
                <div className="flex items-center gap-1 cursor-help">
                  <Activity size={10} className="text-blue-400" />
                  <span className="text-[8px] font-medium text-gray-400 tracking-wider">FUND</span>
                  <FreshnessDot feedId="funding" />
                </div>
              </FeedTooltip>
            </div>
            <div className="flex flex-col flex-1 justify-center">
              <span className={`text-sm font-bold leading-none ${
                parseFloat(derivatives.fundingRate) > 0.01 ? 'text-green-400' :
                parseFloat(derivatives.fundingRate) < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {derivatives.fundingRate}%
              </span>
              <span className="text-[7px] text-gray-500 mt-1">Stable</span>
            </div>
          </div>

          {/* Order Flow / OI Card */}
          <div className="bg-white/5 rounded-lg p-1.5 border border-white/10 relative overflow-hidden group hover:border-orange-500/30 transition-all duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-1.5 flex-shrink-0">
              <FeedTooltip feedId="orderFlow">
                <div className="flex items-center gap-1 cursor-help">
                  <Zap size={10} className="text-orange-400" />
                  <span className="text-[8px] font-medium text-gray-400 tracking-wider">OI</span>
                  <FreshnessDot feedId="orderFlow" />
                </div>
              </FeedTooltip>
            </div>
            <div className="flex flex-col flex-1 justify-center">
              <span className="text-sm font-bold text-white leading-none">{derivatives.openInterest}</span>
              <span className="text-[7px] text-gray-500 mt-1">BTC</span>
            </div>
          </div>

          {/* Technicals Card - RSI */}
          <div className="bg-white/5 rounded-lg p-1.5 border border-white/10 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-1 flex-shrink-0">
              <div className="flex items-center gap-1">
                <TrendingUp size={9} className="text-cyan-400" />
                <span className="text-[7px] font-medium text-gray-400 tracking-wider">RSI</span>
              </div>
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                technicals.rsi >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {technicals.rsi >= 50 ? 'BULL' : 'BEAR'}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <span className="text-sm font-bold text-white leading-none">{technicals.rsi.toFixed(0)}</span>
              <span className="text-[7px] text-gray-500 leading-none">/ 100</span>
            </div>
          </div>

          {/* Technicals Card - ADX */}
          <div className="bg-white/5 rounded-lg p-1.5 border border-white/10 relative overflow-hidden group hover:border-yellow-500/30 transition-all duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-1 flex-shrink-0">
              <div className="flex items-center gap-1">
                <BarChart2 size={9} className="text-yellow-400" />
                <span className="text-[7px] font-medium text-gray-400 tracking-wider">ADX</span>
              </div>
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                technicals.adx > 25 ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {technicals.adx > 25 ? 'STR' : 'WEK'}
              </span>
            </div>
            <div className="flex flex-col flex-1 justify-center">
              <span className="text-sm font-bold text-white leading-none">{technicals.adx.toFixed(0)}</span>
              <span className="text-[7px] text-gray-500 mt-1">Strength</span>
            </div>
          </div>

          {/* Technicals Card - Trend */}
          <div className="bg-white/5 rounded-lg p-1.5 border border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-1 flex-shrink-0">
              <div className="flex items-center gap-1">
                <Activity size={9} className="text-emerald-400" />
                <span className="text-[7px] font-medium text-gray-400 tracking-wider">TREND</span>
              </div>
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                technicals.trend === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {technicals.trend === 'BULLISH' ? 'BULL' : 'BEAR'}
              </span>
            </div>
            <div className="flex flex-col flex-1 justify-center">
              <span className="text-xs font-bold text-white leading-none">{technicals.trend === 'BULLISH' ? 'BULLISH' : 'BEARISH'}</span>
            </div>
          </div>
      </div>
    </div>
  );
};

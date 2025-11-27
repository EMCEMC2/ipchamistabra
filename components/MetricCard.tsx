import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  color?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  trend,
  color = 'text-green-400',
  icon,
  loading = false
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | number>(value);

  // Animate on value change
  useEffect(() => {
    if (value !== previousValue) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
      setPreviousValue(value);
    }
  }, [value, previousValue]);

  const getTrendIcon = () => {
    if (trend === 'BULLISH') return <ArrowUpRight className="w-4 h-4" />;
    if (trend === 'BEARISH') return <ArrowDownRight className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === 'BULLISH') return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (trend === 'BEARISH') return 'text-red-400 bg-red-500/10 border-red-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  const getTrendGlow = () => {
    if (trend === 'BULLISH') return 'shadow-[0_0_15px_rgba(34,197,94,0.15)]';
    if (trend === 'BEARISH') return 'shadow-[0_0_15px_rgba(248,113,113,0.15)]';
    return '';
  };

  if (loading) {
    return (
      <div className="card-premium h-full animate-pulse">
        <div className="h-3 bg-white/10 rounded w-2/3 mb-3"></div>
        <div className="h-6 bg-white/10 rounded w-full mb-2"></div>
        <div className="h-2 bg-white/10 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div
      className={`
        card-premium h-full relative group !p-3 flex flex-col justify-center gap-1
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:border-white/20
        ${getTrendGlow()}
      `}
    >
      {/* Header Row: Title & Trend Icon */}
      <div className="flex items-center justify-between relative z-10 w-full">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate pr-2">
          {title}
        </div>
        
        {/* Trend Icon Badge */}
        <div className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 ${getTrendColor()}`}>
          {getTrendIcon()}
        </div>
      </div>

      {/* Content Row: Value & SubValue */}
      <div className="relative z-10 flex flex-col items-start w-full">
        <div className={`
          text-lg font-bold ${color} tracking-tight leading-none
          transition-all duration-300
          ${isAnimating ? 'scale-105 text-glow-bullish' : 'scale-100'}
        `}>
          {value}
        </div>
        
        {/* Sub Value */}
        {subValue && (
          <div className="text-[10px] text-gray-500 mt-0.5 font-mono leading-none">
            {subValue}
          </div>
        )}
      </div>

      {/* Bottom Accent Line */}
      <div className={`
        absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300
        ${trend === 'BULLISH' ? 'bg-gradient-to-r from-transparent via-green-500 to-transparent' :
          trend === 'BEARISH' ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent' :
          'bg-gradient-to-r from-transparent via-gray-500 to-transparent'}
      `}></div>
    </div>
  );
};

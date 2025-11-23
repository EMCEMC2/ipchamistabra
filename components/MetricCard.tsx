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
        card-premium h-full relative overflow-hidden group
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:border-white/20
        ${getTrendGlow()}
      `}
    >
      {/* Shimmer Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none"></div>

      {/* Trend Indicator Badge */}
      <div className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
        <div className={`flex items-center justify-center w-6 h-6 rounded-md border ${getTrendColor()}`}>
          {getTrendIcon()}
        </div>
      </div>

      {/* Icon (if provided) */}
      {icon && (
        <div className="absolute top-2 left-2 opacity-20 text-white text-xl">
          {icon}
        </div>
      )}

      {/* Title */}
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 relative z-10">
        {title}
      </div>

      {/* Value with Animation */}
      <div className={`
        text-2xl font-bold ${color} tracking-tight mb-1 relative z-10
        transition-all duration-300
        ${isAnimating ? 'scale-110 text-glow-bullish' : 'scale-100'}
      `}>
        {value}
      </div>

      {/* Sub Value */}
      {subValue && (
        <div className="text-xs text-gray-500 mt-1 relative z-10 font-mono">
          {subValue}
        </div>
      )}

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

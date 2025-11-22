import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subValue, trend, color = 'text-green-400' }) => {
  const getTrendIcon = () => {
    if (trend === 'BULLISH') return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    if (trend === 'BEARISH') return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="bg-black/40 border border-white/10 p-2 rounded-sm font-mono flex flex-col justify-between h-full relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-1 opacity-50 group-hover:opacity-100 transition-opacity">
        {getTrendIcon()}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{title}</div>
      <div className={`text-lg font-bold ${color} tracking-tight`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] text-gray-400 mt-1 truncate">
          {subValue}
        </div>
      )}
    </div>
  );
};
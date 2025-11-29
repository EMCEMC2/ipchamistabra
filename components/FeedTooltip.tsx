import React from 'react';
import { Info } from 'lucide-react';
import { FEED_SOURCES, FeedState } from '../services/feedRegistry';
import { useStore } from '../store/useStore';

interface FeedTooltipProps {
  feedId: string;
  children: React.ReactNode;
}

export const FeedTooltip: React.FC<FeedTooltipProps> = ({ feedId, children }) => {
  const { feeds } = useStore();
  const config = FEED_SOURCES[feedId];
  const state = feeds[feedId];

  if (!config) return <>{children}</>;

  return (
    <div className="group relative inline-block">
      {children}
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 hidden group-hover:block z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-800">
            <span className="font-bold text-gray-200 uppercase tracking-wider">{config.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                config.dataType === 'raw' ? 'bg-blue-500/20 text-blue-400' :
                config.dataType === 'derived' ? 'bg-purple-500/20 text-purple-400' :
                'bg-orange-500/20 text-orange-400'
            }`}>
                {config.dataType.toUpperCase()}
            </span>
          </div>

          {/* Body */}
          <div className="space-y-2 text-gray-400">
            <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-gray-200">{config.source}</span>
            </div>
            <div className="flex justify-between">
                <span>Method:</span>
                <span className="text-gray-200">{config.method}</span>
            </div>
            <div className="flex justify-between">
                <span>Refreshed:</span>
                <span className="text-gray-200">
                    {state?.lastUpdated ? `${Math.round((Date.now() - state.lastUpdated)/1000)}s ago` : 'Never'}
                </span>
            </div>
            
            <div className="pt-2 border-t border-gray-800 text-[10px] leading-relaxed italic text-gray-500">
                {config.description}
            </div>
          </div>
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
};

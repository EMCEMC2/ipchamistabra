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
        <div className="bg-terminal-card border border-terminal-border rounded-lg shadow-lg p-3 text-xs backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-terminal-border">
            <span className="font-bold text-terminal-text uppercase tracking-wider">{config.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                config.dataType === 'raw' ? 'bg-blue-500/20 text-blue-400' :
                config.dataType === 'derived' ? 'bg-purple-500/20 text-purple-400' :
                'bg-orange-500/20 text-orange-400'
            }`}>
                {config.dataType.toUpperCase()}
            </span>
          </div>

          {/* Body */}
          <div className="space-y-2 text-terminal-muted">
            <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-terminal-text">{config.source}</span>
            </div>
            <div className="flex justify-between">
                <span>Method:</span>
                <span className="text-terminal-text">{config.method}</span>
            </div>
            <div className="flex justify-between">
                <span>Refreshed:</span>
                <span className="text-terminal-text">
                    {state?.lastUpdated ? `${Math.round((Date.now() - state.lastUpdated)/1000)}s ago` : 'Never'}
                </span>
            </div>
            
            <div className="pt-2 border-t border-terminal-border text-[10px] leading-relaxed italic text-terminal-muted opacity-80">
                {config.description}
            </div>
          </div>
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-terminal-card"></div>
        </div>
      </div>
    </div>
  );
};

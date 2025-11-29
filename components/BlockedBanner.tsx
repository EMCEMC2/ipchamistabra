import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { FEED_SOURCES, checkFeedHealth } from '../services/feedRegistry';

export const BlockedBanner: React.FC = () => {
  const { feeds, updateFeedStatus } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [recovered, setRecovered] = useState(false);

  // Identify blocked critical feeds
  const blockedFeeds = Object.values(feeds).filter(feed => {
    const config = FEED_SOURCES[feed.id];
    if (!config?.critical) return false;
    const health = checkFeedHealth(feed);
    return health === 'stale' || health === 'error';
  });

  const isBlocked = blockedFeeds.length > 0;

  // Auto-clear recovery message
  useEffect(() => {
    if (recovered) {
      const timer = setTimeout(() => setRecovered(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [recovered]);

  const handleRetry = async () => {
    setRetrying(true);
    // Simulate retry delay (in reality, this would trigger reconnection logic)
    // For MVP, we just reset the lastUpdated timestamp to "now" if it was stale, 
    // effectively giving it a grace period to reconnect.
    // In a real app, we'd call a reconnect() method on the service.
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    blockedFeeds.forEach(feed => {
        // Optimistic update to clear error state, actual data needs to flow in to keep it fresh
        updateFeedStatus(feed.id, { status: 'connecting', error: undefined });
    });
    
    setRetrying(false);
    
    // Check if cleared (simple check)
    if (blockedFeeds.length === 0) {
        setRecovered(true);
    }
  };

  if (recovered) {
    return (
      <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
        <CheckCircle size={16} className="text-green-400" />
        <span className="text-sm font-medium text-green-400">All feeds recovered</span>
      </div>
    );
  }

  if (!isBlocked) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 animate-in fade-in slide-in-from-top-2">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-400 animate-pulse" />
          <span className="text-sm font-medium text-red-200">
            Signal blocked: {blockedFeeds.length} critical feed{blockedFeeds.length > 1 ? 's' : ''} unavailable
          </span>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={handleRetry}
                disabled={retrying}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs rounded transition-colors flex items-center gap-2"
            >
                {retrying ? <RefreshCw size={12} className="animate-spin" /> : null}
                {retrying ? 'Retrying...' : 'Retry Now'}
            </button>
            
            <button 
                onClick={() => setExpanded(!expanded)}
                className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs"
            >
                {expanded ? 'Hide Details' : 'Details'}
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-red-500/10 bg-black/20">
          <div className="space-y-2">
            {blockedFeeds.map(feed => {
                const config = FEED_SOURCES[feed.id];
                const health = checkFeedHealth(feed);
                const duration = Date.now() - feed.lastUpdated;
                
                return (
                    <div key={feed.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                            <span className="text-gray-300">{config?.name || feed.id}</span>
                        </div>
                        <span className="text-red-300/70 font-mono">
                            {health === 'stale' 
                                ? `Stale for ${Math.round(duration/1000)}s (limit: ${config?.maxStalenessMs/1000}s)`
                                : `Error: ${feed.error || 'Unknown'}`
                            }
                        </span>
                    </div>
                );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

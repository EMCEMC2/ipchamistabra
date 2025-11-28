/**
 * AI COMMAND CENTER
 * Minimalist professional display for AI analysis and market intel
 */

import React, { useEffect, useRef } from 'react';
import { Brain, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';

export const AiCommandCenter: React.FC = () => {
  const { intel, latestAnalysis } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new intel arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [intel]);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Strip markdown formatting for cleaner display
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove code
      .replace(/- /g, '') // Remove list markers
      .replace(/\n{2,}/g, '\n') // Collapse multiple newlines
      .trim();
  };

  // Get first meaningful paragraph from analysis
  const getAnalysisSummary = (text: string): string => {
    const clean = stripMarkdown(text);
    const lines = clean.split('\n').filter(l => l.trim().length > 20);
    return lines.slice(0, 2).join(' ').substring(0, 200) + (clean.length > 200 ? '...' : '');
  };

  const getSentimentStyle = (sentiment?: string) => {
    switch (sentiment) {
      case 'BULLISH': return 'text-green-400';
      case 'BEARISH': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'NEWS': return 'text-blue-400';
      case 'ONCHAIN': return 'text-purple-400';
      case 'MACRO': return 'text-yellow-400';
      case 'WHALE': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-terminal-card border border-terminal-border rounded overflow-hidden">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-terminal-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Brain size={12} className="text-blue-400" />
          <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">AI Intel</span>
        </div>
        {latestAnalysis && (
          <span className="text-[9px] text-gray-500 font-mono">ACTIVE</span>
        )}
      </div>

      {/* AI Analysis Summary */}
      {latestAnalysis && (
        <div className="px-2 py-1.5 border-b border-terminal-border bg-blue-500/5">
          <p className="text-[10px] text-gray-300 leading-relaxed">
            {getAnalysisSummary(latestAnalysis)}
          </p>
        </div>
      )}

      {/* Intel Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        {intel.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <span className="text-[9px] font-mono">No intel data</span>
          </div>
        ) : (
          <div className="divide-y divide-terminal-border">
            {intel.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="px-2 py-1.5 hover:bg-white/5 transition-colors"
              >
                {/* Top row: category + sentiment + time */}
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-medium uppercase ${getCategoryStyle(item.category)}`}>
                      {item.category}
                    </span>
                    {item.btcSentiment && item.btcSentiment !== 'NEUTRAL' && (
                      <span className={`text-[8px] font-medium ${getSentimentStyle(item.btcSentiment)}`}>
                        {item.btcSentiment}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock size={8} />
                    <span className="text-[8px] font-mono">{formatTime(item.timestamp)}</span>
                  </div>
                </div>

                {/* Title */}
                <p className="text-[10px] text-gray-300 leading-tight line-clamp-2">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

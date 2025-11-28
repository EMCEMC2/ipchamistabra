/**
 * AI COMMAND CENTER
 * Real-time intelligence feed displaying AI analysis and market intel
 */

import React, { useEffect, useRef } from 'react';
import { Cpu, Radio, Shield, Zap, Globe, Activity, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { IntelItem } from '../types';
import ReactMarkdown from 'react-markdown';

export const AiCommandCenter: React.FC = () => {
  const { intel, latestAnalysis } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new intel arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [intel]);

  const getIcon = (category: string) => {
    switch (category) {
      case 'NEWS': return <Globe size={10} />;
      case 'ONCHAIN': return <Activity size={10} />;
      case 'MACRO': return <Radio size={10} />;
      case 'WHALE': return <Shield size={10} />;
      case 'ORDERFLOW': return <Zap size={10} />;
      case 'LIQUIDATION': return <AlertTriangle size={10} />;
      default: return <Cpu size={10} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'MEDIUM': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'LOW': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'BULLISH': return 'text-green-400 bg-green-500/10';
      case 'BEARISH': return 'text-red-400 bg-red-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  return (
    <div className="flex flex-col h-full bg-terminal-card border border-terminal-border rounded-lg overflow-hidden font-sans">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-terminal-border bg-terminal-bg/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Cpu size={12} className="animate-pulse" />
          <span className="font-bold text-[10px] tracking-wider uppercase">AI Intelligence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] text-gray-500 font-mono">ACTIVE</span>
        </div>
      </div>

      {/* AI Analysis Section */}
      {latestAnalysis && (
        <div className="px-2 py-2 border-b border-terminal-border bg-blue-500/5 max-h-[120px] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={10} className="text-yellow-400" />
            <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wide">Tactical Analysis</span>
          </div>
          <div className="prose prose-invert prose-xs text-[10px] leading-relaxed text-gray-300">
            <ReactMarkdown>{latestAnalysis}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Intel Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar"
      >
        {intel.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
            <Radio size={20} className="animate-pulse text-blue-400 mb-1" />
            <span className="text-[9px] font-mono">AWAITING INTEL...</span>
          </div>
        ) : (
          intel.slice(0, 10).map((item) => (
            <div
              key={item.id}
              className="group p-1.5 rounded hover:bg-white/5 transition-colors border-l-2 border-terminal-border hover:border-blue-500"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-1 ${getSeverityColor(item.severity)}`}>
                  {getIcon(item.category)}
                  {item.category}
                </span>
                {item.btcSentiment && (
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${getSentimentColor(item.btcSentiment)}`}>
                    {item.btcSentiment}
                  </span>
                )}
                <span className="text-[8px] text-gray-600 font-mono ml-auto">
                  {new Date(item.timestamp).toLocaleTimeString('en-IL', {hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Jerusalem'})}
                </span>
              </div>

              <h4 className="text-[10px] text-gray-300 font-medium leading-tight mb-0.5 group-hover:text-white transition-colors line-clamp-2">
                {item.title}
              </h4>

              <p className="text-[9px] text-gray-500 leading-snug line-clamp-1 group-hover:text-gray-400">
                {item.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

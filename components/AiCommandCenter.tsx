import React, { useEffect, useRef } from 'react';
import { Cpu, Radio, Shield, Zap, Globe, Activity, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { IntelItem } from '../types';

export const AiCommandCenter: React.FC = () => {
  const { intel, setMarketMetrics } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new intel arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [intel]);

  // Mock Intel Generator (For Demo Purposes)
  useEffect(() => {
    const interval = setInterval(() => {
      const types: IntelItem['category'][] = ['NEWS', 'ONCHAIN', 'MACRO', 'WHALE', 'ORDERFLOW'];
      const sentiments: IntelItem['btcSentiment'][] = ['BULLISH', 'BEARISH', 'NEUTRAL'];
      const severities: IntelItem['severity'][] = ['LOW', 'MEDIUM', 'HIGH'];
      
      const mockIntel: IntelItem = {
        id: Date.now().toString(),
        title: `AI Insight: Market Structure Analysis`,
        category: types[Math.floor(Math.random() * types.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        timestamp: Date.now(),
        source: 'BitMind AI',
        summary: 'Detected increasing spot buying pressure on Coinbase. Funding rates remaining neutral suggests organic accumulation.',
        btcSentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
      };

      // In a real app, this would come from the backend via WebSocket
      // For now, we just update the store locally to show the UI
      // We need to be careful not to infinite loop or flood
      // setMarketMetrics({ intel: [...intel, mockIntel].slice(-50) }); 
    }, 15000);

    return () => clearInterval(interval);
  }, [intel, setMarketMetrics]);

  const getIcon = (category: string) => {
    switch (category) {
      case 'NEWS': return <Globe size={12} />;
      case 'ONCHAIN': return <Activity size={12} />;
      case 'MACRO': return <Radio size={12} />;
      case 'WHALE': return <Shield size={12} />;
      case 'ORDERFLOW': return <Zap size={12} />;
      case 'LIQUIDATION': return <AlertTriangle size={12} />;
      default: return <Cpu size={12} />;
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

  return (
    <div className="flex flex-col h-full bg-[#050505] border border-[#1a1a1a] rounded-sm overflow-hidden font-sans">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-purple-400">
          <Cpu size={12} className="animate-pulse" />
          <span className="font-bold text-[10px] tracking-wider uppercase">Live Intelligence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
          </span>
          <span className="text-[9px] text-gray-500 font-mono">NET_ACTIVE</span>
        </div>
      </div>

      {/* Feed Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar scroll-smooth"
      >
        {intel.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-2 opacity-50">
            <Radio size={24} className="animate-pulse" />
            <span className="text-[10px] font-mono">AWAITING INTEL STREAM...</span>
          </div>
        ) : (
          intel.map((item) => (
            <div key={item.id} className="group relative pl-3 py-1 border-l border-[#1a1a1a] hover:border-purple-500/50 transition-colors">
              {/* Timeline Dot */}
              <div className="absolute left-[-2.5px] top-2.5 w-1 h-1 rounded-full bg-[#333] group-hover:bg-purple-500 transition-colors" />
              
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-bold px-1 rounded-sm border flex items-center gap-1 ${getSeverityColor(item.severity)}`}>
                  {getIcon(item.category)}
                  {item.category}
                </span>
                <span className="text-[9px] text-gray-500 font-mono">
                  {new Date(item.timestamp).toLocaleTimeString('en-IL', {hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Jerusalem'})}
                </span>
              </div>
              
              <h4 className="text-[11px] text-gray-200 font-medium leading-tight mb-0.5 group-hover:text-purple-300 transition-colors">
                {item.title}
              </h4>
              
              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">
                {item.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
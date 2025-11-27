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
    <div className="flex flex-col h-full bg-terminal-card border border-terminal-border rounded-lg overflow-hidden font-sans shadow-lg">
      {/* Header */}
      <div className="px-3 py-2 border-b border-terminal-border bg-terminal-bg/50 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-terminal-accent">
          <Cpu size={14} className="animate-pulse" />
          <span className="font-display font-bold text-xs tracking-widest uppercase text-glow-info">Live Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="status-indicator status-live" />
          <span className="text-[10px] text-terminal-muted font-mono tracking-wider">NET_ACTIVE</span>
        </div>
      </div>

      {/* Feed Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar scroll-smooth"
      >
        {intel.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-terminal-muted space-y-3 opacity-50">
            <Radio size={32} className="animate-pulse text-terminal-accent" />
            <span className="text-xs font-mono tracking-widest">AWAITING INTEL STREAM...</span>
          </div>
        ) : (
          intel.map((item) => (
            <div key={item.id} className="group relative pl-3 py-2 border-l-2 border-terminal-border hover:border-terminal-accent transition-all duration-300 bg-terminal-bg/30 hover:bg-terminal-bg/50 rounded-r-md pr-2">
              {/* Timeline Dot */}
              <div className="absolute left-[-5px] top-3 w-2 h-2 rounded-full bg-terminal-border group-hover:bg-terminal-accent transition-colors shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_10px_var(--accent-info)]" />
              
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1.5 ${getSeverityColor(item.severity)}`}>
                  {getIcon(item.category)}
                  {item.category}
                </span>
                <span className="text-[10px] text-terminal-muted font-mono">
                  {new Date(item.timestamp).toLocaleTimeString('en-IL', {hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Jerusalem'})}
                </span>
              </div>
              
              <h4 className="text-xs text-terminal-text font-medium leading-snug mb-1 group-hover:text-terminal-accent transition-colors">
                {item.title}
              </h4>
              
              <p className="text-[10px] text-terminal-muted leading-relaxed line-clamp-2">
                {item.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
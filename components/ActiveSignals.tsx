
import React from 'react';
import { Activity, ArrowUpRight, ArrowDownRight, Clock, Target, Shield, RefreshCw, Zap, Scale, PlayCircle } from 'lucide-react';
import { TradeSignal } from '../types';
import { useStore } from '../store/useStore';
import { fetchSignals } from '../services/marketData';

interface ActiveSignalsProps {
  onTrade?: (signal: TradeSignal) => void;
}

export const ActiveSignals: React.FC<ActiveSignalsProps> = ({ onTrade }) => {
  const { signals, isScanning } = useStore();

  const getStatusBadge = (status: TradeSignal['status']) => {
    const baseClasses = "text-[10px] px-2 py-0.5 rounded font-mono border";
    switch (status) {
      case 'ACTIVE':
        return <span className={`${baseClasses} bg-emerald-500/10 text-emerald-500 border-emerald-500/20`}>ACTIVE</span>;
      case 'SCANNING':
        return <span className={`${baseClasses} bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse`}>SCANNING</span>;
      case 'FILLED':
        return <span className={`${baseClasses} bg-blue-500/10 text-blue-500 border-blue-500/20`}>FILLED</span>;
      case 'CLOSED':
        return <span className={`${baseClasses} bg-zinc-500/10 text-zinc-500 border-zinc-500/20`}>CLOSED</span>;
    }
  };

  const getRegimeBadge = (regime: TradeSignal['regime']) => {
     let color = "text-terminal-muted";
     let bg = "bg-terminal-border";
     if (regime === 'LOW_VOL') { color = "text-blue-400"; bg = "bg-blue-400/10 border-blue-400/20"; }
     if (regime === 'NORMAL') { color = "text-terminal-text"; bg = "bg-terminal-border border-terminal-border"; }
     if (regime === 'HIGH_VOL') { color = "text-terminal-warn"; bg = "bg-terminal-warn/10 border-terminal-warn/20"; }
     if (regime === 'TRENDING') { color = "text-terminal-accent"; bg = "bg-terminal-accent/10 border-terminal-accent/20"; }

     return (
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border uppercase ${bg} ${color}`}>
            {regime?.replace('_', ' ')}
        </span>
     );
  };

  const getConfidenceStyle = (score: number) => {
    if (score >= 85) return { color: 'text-terminal-accent', bg: 'bg-terminal-accent/10', border: 'border-terminal-accent/20' };
    if (score >= 70) return { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' };
    if (score >= 50) return { color: 'text-terminal-warn', bg: 'bg-terminal-warn/10', border: 'border-terminal-warn/20' };
    return { color: 'text-terminal-danger', bg: 'bg-terminal-danger/10', border: 'border-terminal-danger/20' };
  };

  return (
    <div className="bg-terminal-card border border-terminal-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Activity size={18} />
          <h3 className="font-mono font-bold text-sm tracking-wider">ACTIVE SIGNALS</h3>
        </div>
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-1">
                 <span className="relative flex h-2 w-2">
                   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 ${isScanning ? 'duration-500' : ''}`}></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                 </span>
                 <span className="text-[10px] text-terminal-muted font-mono ml-1">{isScanning ? 'SCANNING...' : 'LIVE'}</span>
            </div>
            <button 
                onClick={fetchSignals} 
                disabled={isScanning}
                className="text-xs flex items-center gap-1 bg-terminal-border hover:bg-terminal-text hover:text-terminal-bg px-2 py-1 rounded transition-colors disabled:opacity-50 ml-2"
            >
                <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                {isScanning ? "SCAN" : "SCAN"}
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {signals.map((signal) => {
          const confStyle = getConfidenceStyle(signal.confidence);
          return (
            <div 
              key={signal.id} 
              className={`p-3 rounded border border-terminal-border bg-terminal-bg/30 hover:bg-terminal-bg/50 transition-colors group relative overflow-visible`}
            >
              {/* Side Indicator */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${signal.type === 'LONG' ? 'bg-terminal-accent' : 'bg-terminal-danger'}`} />
              
              <div className="pl-2 flex flex-col gap-2">
                  {/* Header */}
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-terminal-text">{signal.pair}</span>
                          <span className={`text-xs font-bold flex items-center gap-0.5 ${signal.type === 'LONG' ? 'text-terminal-accent' : 'text-terminal-danger'}`}>
                              {signal.type === 'LONG' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              {signal.type}
                          </span>
                          {signal.regime && getRegimeBadge(signal.regime)}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Confidence Badge */}
                        <div className="group/conf relative cursor-help" title="AI Confidence Score">
                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${confStyle.bg} ${confStyle.border}`}>
                             <Zap size={10} className={confStyle.color} />
                             <span className={`text-[10px] font-bold font-mono ${confStyle.color}`}>{signal.confidence}%</span>
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono mt-1">
                      <div>
                          <div className="text-terminal-muted text-[10px] uppercase mb-0.5 flex items-center gap-1">
                              <Target size={10} /> Entry
                          </div>
                          <div className="text-terminal-text">{signal.entryZone}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-terminal-muted text-[10px] uppercase mb-0.5">Targets</div>
                          <div className="text-terminal-accent">{signal.targets[0]}</div>
                      </div>
                      <div>
                          <div className="text-terminal-muted text-[10px] uppercase mb-0.5 flex items-center gap-1">
                              <Shield size={10} /> Stop
                          </div>
                          <div className="text-terminal-danger">{signal.invalidation}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-terminal-muted text-[10px] uppercase mb-0.5 flex items-center justify-end gap-1">
                            <Scale size={10} /> R:R
                          </div>
                          <div className="text-terminal-text">{signal.riskRewardRatio ? signal.riskRewardRatio.toFixed(1) : '-'}</div>
                      </div>
                  </div>
                  
                  <div className="border-t border-terminal-border/30 pt-2 mt-1 flex justify-between items-end">
                      <div className="text-[9px] text-terminal-muted truncate max-w-[140px]" title={signal.reasoning}>
                          {signal.reasoning}
                      </div>
                      {onTrade && (
                          <button 
                            onClick={() => onTrade(signal)}
                            className="flex items-center gap-1 bg-terminal-border hover:bg-terminal-accent hover:text-terminal-bg text-terminal-muted text-[9px] font-mono uppercase px-2 py-1 rounded transition-all"
                          >
                              <PlayCircle size={10} /> Trade This
                          </button>
                      )}
                  </div>
              </div>
            </div>
          );
        })}
        {signals.length === 0 && !isScanning && (
            <div className="flex flex-col items-center justify-center h-full text-terminal-muted opacity-50">
                <Activity size={24} className="mb-2" />
                <span className="text-xs font-mono">NO SIGNALS DETECTED</span>
            </div>
        )}
        {isScanning && signals.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-terminal-accent opacity-50 animate-pulse">
                <Activity size={24} className="mb-2" />
                <span className="text-xs font-mono">ANALYZING MARKET STRUCTURE...</span>
            </div>
        )}
      </div>
    </div>
  );
};


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
    <div className="card-premium h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Activity size={16} />
          <h3 className="font-sans font-semibold text-sm tracking-wide">Active Signals</h3>
        </div>
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-md">
                 <span className="relative flex h-2 w-2">
                   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-green-400' : 'bg-blue-400'} opacity-75`}></span>
                   <span className={`relative inline-flex rounded-full h-2 w-2 ${isScanning ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                 </span>
                 <span className="text-[10px] text-gray-400 font-medium">{isScanning ? 'SCANNING' : 'LIVE'}</span>
            </div>
            <button
                onClick={fetchSignals}
                disabled={isScanning}
                className="text-xs flex items-center gap-1.5 bg-white/5 hover:bg-green-500/10 border border-white/10 hover:border-green-500/30 text-gray-400 hover:text-green-400 px-2.5 py-1.5 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                SCAN
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
        {signals.map((signal) => {
          const confStyle = getConfidenceStyle(signal.confidence);
          return (
            <div
              key={signal.id}
              className={`p-3 rounded-md border bg-white/5 hover:bg-white/10 transition-all duration-200 group relative overflow-hidden ${
                signal.type === 'LONG'
                  ? 'border-green-500/20 hover:border-green-500/40'
                  : 'border-red-500/20 hover:border-red-500/40'
              }`}
            >
              {/* Side Indicator with Glow */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${
                signal.type === 'LONG'
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                  : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
              }`} />
              
              <div className="pl-2 flex flex-col gap-2 relative z-10">
                  {/* Header */}
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <span className="font-semibold font-mono text-sm text-gray-100">{signal.pair}</span>
                          <span className={`text-xs font-semibold flex items-center gap-0.5 ${
                            signal.type === 'LONG' ? 'text-green-400' : 'text-red-400'
                          }`}>
                              {signal.type === 'LONG' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {signal.type}
                          </span>
                          {signal.regime && getRegimeBadge(signal.regime)}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Confidence Badge */}
                        <div className="group/conf relative cursor-help" title="AI Confidence Score">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${confStyle.bg} ${confStyle.border}`}>
                             <Zap size={10} className={confStyle.color} />
                             <span className={`text-[10px] font-semibold ${confStyle.color}`}>{signal.confidence}%</span>
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono mt-1">
                      <div>
                          <div className="text-gray-500 text-[10px] uppercase mb-0.5 flex items-center gap-1 font-medium">
                              <Target size={10} /> Entry
                          </div>
                          <div className="text-gray-200 font-semibold">{signal.entryZone}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-gray-500 text-[10px] uppercase mb-0.5 font-medium">Target</div>
                          <div className="text-green-400 font-semibold">{signal.targets[0]}</div>
                      </div>
                      <div>
                          <div className="text-gray-500 text-[10px] uppercase mb-0.5 flex items-center gap-1 font-medium">
                              <Shield size={10} /> Stop
                          </div>
                          <div className="text-red-400 font-semibold">{signal.invalidation}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-gray-500 text-[10px] uppercase mb-0.5 flex items-center justify-end gap-1 font-medium">
                            <Scale size={10} /> R:R
                          </div>
                          <div className="text-blue-400 font-semibold">{signal.riskRewardRatio ? signal.riskRewardRatio.toFixed(1) : '-'}</div>
                      </div>
                  </div>

                  <div className="border-t border-white/10 pt-2 mt-1 flex justify-between items-end">
                      <div className="text-[10px] text-gray-400 truncate max-w-[140px] leading-tight" title={signal.reasoning}>
                          {signal.reasoning}
                      </div>
                      {onTrade && (
                          <button
                            onClick={() => onTrade(signal)}
                            className="flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 text-[10px] font-medium uppercase px-2 py-1 rounded-md transition-all duration-200"
                          >
                              <PlayCircle size={10} /> Execute
                          </button>
                      )}
                  </div>
              </div>
            </div>
          );
        })}
        {signals.length === 0 && !isScanning && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                <Activity size={28} className="mb-3 opacity-40" />
                <span className="text-sm font-medium">No Active Signals</span>
                <span className="text-xs text-gray-600 mt-1">Click SCAN to analyze market</span>
            </div>
        )}
        {isScanning && signals.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-green-400 opacity-70 animate-pulse">
                <div className="relative">
                  <Activity size={28} className="mb-3" />
                  <div className="absolute inset-0 blur-md bg-green-500/30"></div>
                </div>
                <span className="text-sm font-medium">Analyzing Market Structure</span>
                <span className="text-xs text-gray-400 mt-1">Scanning for high-probability setups...</span>
            </div>
        )}
      </div>
    </div>
  );
};

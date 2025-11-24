
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
    <div className="h-full flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2 text-blue-400">
          <Activity size={16} />
          <h3 className="font-sans font-semibold text-sm tracking-wide text-gray-200">Active Signals</h3>
        </div>
        <div className="flex items-center gap-2">
             <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium ${
               isScanning ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
             }`}>
                 <span className="relative flex h-1.5 w-1.5">
                   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-amber-400' : 'bg-green-400'} opacity-75`}></span>
                   <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isScanning ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                 </span>
                 <span>{isScanning ? 'SCANNING' : 'LIVE'}</span>
            </div>
            <button
                onClick={fetchSignals}
                disabled={isScanning}
                className="text-[10px] flex items-center gap-1.5 bg-white/5 hover:bg-green-500/10 border border-white/10 hover:border-green-500/30 text-gray-400 hover:text-green-400 px-2 py-0.5 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <RefreshCw size={10} className={isScanning ? "animate-spin" : ""} />
                SCAN
            </button>
        </div>
      </div>

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

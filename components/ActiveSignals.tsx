import React, { useState } from 'react';
import { Activity, RefreshCw, Zap, ArrowUp, ArrowDown, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { TradeSignal } from '../types';
import { useStore } from '../store/useStore';
import { fetchSignals } from '../services/marketData';
import { ConfidenceBreakdown } from './ConfidenceBreakdown';

interface ActiveSignalsProps {
  onTrade?: (signal: TradeSignal) => void;
}

export const ActiveSignals: React.FC<ActiveSignalsProps> = ({ onTrade }) => {
  const { signals, isScanning } = useStore();
  const safeSignals = signals || [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Helper for Confidence Color
  const getConfColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  // Mock breakdown generator (since backend doesn't provide it yet)
  const getBreakdown = (signal: TradeSignal) => {
    const isLong = signal.type === 'LONG';
    return {
        baseScore: 50,
        adjustments: [
            { label: 'Trend Alignment', value: 15, type: 'boost' as const },
            { label: 'Vol. Expansion', value: 10, type: 'boost' as const },
            { label: 'Resistance Proximity', value: -5, type: 'penalty' as const },
            { label: 'Sentiment', value: isLong ? 5 : -5, type: isLong ? 'boost' as const : 'penalty' as const }
        ],
        finalScore: signal.confidence
    };
  };

  return (
    <div className="h-full flex flex-col bg-terminal-bg border border-terminal-border rounded-sm overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-terminal-border bg-terminal-card">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-blue-500" />
          <span className="text-[10px] font-bold tracking-wider text-gray-300 uppercase">Active Signals</span>
          <span className="text-[9px] text-gray-600 font-mono">({safeSignals.length})</span>
        </div>
        
        <div className="flex items-center gap-2">
          {isScanning && (
             <span className="flex items-center gap-1 text-[9px] text-amber-500 animate-pulse">
                <RefreshCw size={8} className="animate-spin" /> SCANNING
             </span>
          )}
          <button
            onClick={fetchSignals}
            disabled={isScanning}
            className="text-[9px] bg-terminal-card hover:bg-terminal-border text-gray-400 hover:text-white px-2 py-0.5 rounded-sm transition-colors border border-terminal-border"
          >
            SCAN
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-terminal-card z-10 text-[9px] text-gray-500 font-medium uppercase tracking-wider">
            <tr>
              <th className="px-2 py-1 border-b border-terminal-border">Ticker</th>
              <th className="px-2 py-1 border-b border-terminal-border">Side</th>
              <th className="px-2 py-1 border-b border-terminal-border text-right">Entry</th>
              <th className="px-2 py-1 border-b border-terminal-border text-right">Conf</th>
              <th className="px-2 py-1 border-b border-terminal-border text-right">R:R</th>
              <th className="px-2 py-1 border-b border-terminal-border"></th>
            </tr>
          </thead>
          <tbody className="text-[10px] font-mono divide-y divide-terminal-border">
            {safeSignals.map((signal) => {
                const isExpanded = expandedId === signal.id;
                const breakdown = getBreakdown(signal);
                
                return (
                  <React.Fragment key={signal.id}>
                    <tr 
                        className={`group hover:bg-terminal-card transition-colors cursor-pointer ${isExpanded ? 'bg-terminal-card/50' : ''}`}
                        onClick={() => onTrade && onTrade(signal)}
                    >
                        {/* Ticker */}
                        <td className="px-2 py-1 text-gray-300 font-bold group-hover:text-white">
                        {signal.pair.replace('USDT', '')}
                        </td>

                        {/* Side */}
                        <td className="px-2 py-1">
                        <span className={`flex items-center gap-0.5 ${signal.type === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                            {signal.type === 'LONG' ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                            {signal.type}
                        </span>
                        </td>

                        {/* Entry */}
                        <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                        {signal.entryZone.split('-')[0]}
                        </td>

                        {/* Confidence */}
                        <td className="px-2 py-1 text-right tabular-nums">
                        <span className={`${getConfColor(signal.confidence)} flex items-center justify-end gap-0.5`}>
                            <Zap size={8} className="fill-current" />
                            {signal.confidence}%
                        </span>
                        </td>

                        {/* R:R */}
                        <td className="px-2 py-1 text-right text-blue-400 tabular-nums">
                        {signal.riskRewardRatio ? signal.riskRewardRatio.toFixed(1) : '-'}
                        </td>

                        {/* Action / Expand */}
                        <td className="px-2 py-1 text-right flex justify-end gap-1">
                           <button
                              onClick={(e) => toggleExpand(signal.id, e)}
                              className="text-gray-500 hover:text-white p-0.5"
                           >
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                           </button>
                           <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-terminal-card hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-sm border border-transparent hover:border-blue-500/30 flex items-center gap-1"
                           >
                              <Play size={8} />
                           </button>
                        </td>
                    </tr>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                        <tr className="bg-black/20">
                            <td colSpan={6} className="px-3 py-2 border-b border-terminal-border">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Confidence Breakdown</div>
                                        <ConfidenceBreakdown {...breakdown} />
                                    </div>
                                    <div className="flex-1 border-l border-white/5 pl-4">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Reasoning</div>
                                        <p className="text-gray-400 italic leading-relaxed">
                                            {signal.reasoning}
                                        </p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                  </React.Fragment>
                );
            })}
            
            {/* Empty State */}
            {safeSignals.length === 0 && !isScanning && (
               <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-gray-600 italic">
                     No active signals. Click SCAN.
                  </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

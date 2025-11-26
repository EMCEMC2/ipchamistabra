import React from 'react';
import { Activity, RefreshCw, Zap, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { TradeSignal } from '../types';
import { useStore } from '../store/useStore';
import { fetchSignals } from '../services/marketData';

interface ActiveSignalsProps {
  onTrade?: (signal: TradeSignal) => void;
}

export const ActiveSignals: React.FC<ActiveSignalsProps> = ({ onTrade }) => {
  const { signals, isScanning } = useStore();
  const safeSignals = signals || [];

  // Helper for Confidence Color
  const getConfColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] border border-[#1a1a1a] rounded-sm overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1a1a1a] bg-[#0a0a0a]">
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
            className="text-[9px] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-400 hover:text-white px-2 py-0.5 rounded-sm transition-colors border border-[#333]"
          >
            SCAN
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0a0a0a] z-10 text-[9px] text-gray-500 font-medium uppercase tracking-wider">
            <tr>
              <th className="px-2 py-1 border-b border-[#1a1a1a]">Ticker</th>
              <th className="px-2 py-1 border-b border-[#1a1a1a]">Side</th>
              <th className="px-2 py-1 border-b border-[#1a1a1a] text-right">Entry</th>
              <th className="px-2 py-1 border-b border-[#1a1a1a] text-right">Conf</th>
              <th className="px-2 py-1 border-b border-[#1a1a1a] text-right">R:R</th>
              <th className="px-2 py-1 border-b border-[#1a1a1a]">Action</th>
            </tr>
          </thead>
          <tbody className="text-[10px] font-mono divide-y divide-[#1a1a1a]">
            {safeSignals.map((signal) => (
              <tr 
                key={signal.id} 
                className="group hover:bg-[#111] transition-colors cursor-pointer"
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

                {/* Action */}
                <td className="px-2 py-1 text-right">
                   <button 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-[#1a1a1a] hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-sm border border-transparent hover:border-blue-500/30 flex items-center gap-1 ml-auto"
                   >
                      <Play size={8} /> LOAD
                   </button>
                </td>
              </tr>
            ))}
            
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

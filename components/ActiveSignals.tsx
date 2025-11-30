import React, { useState, useCallback, useEffect } from 'react';
import { Activity, RefreshCw, Zap, ArrowUp, ArrowDown, Play, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { TradeSignal } from '../types';
import { useSignalsData } from '../store/selectors';
import { useStore } from '../store/useStore';
import { fetchSignals } from '../services/marketData';
import { ConfidenceBreakdown } from './ConfidenceBreakdown';
import { safeParseFloat } from '../utils/safeParseFloat';

interface ActiveSignalsProps {
  onTrade?: (signal: TradeSignal) => void;
}

export const ActiveSignals: React.FC<ActiveSignalsProps> = ({ onTrade }) => {
  const { signals, isScanning } = useSignalsData();
  const currentPrice = useStore((state) => state.price);
  const approveSignal = useStore((state) => state.approveSignal);
  // FILTER: Only show signals with Risk:Reward >= 1:1.5 and not invalidated/expired
  // Note: Tactical signals produce ~2:1 R:R by default (3x ATR target / 1.5x ATR stop)
  const safeSignals = (signals || []).filter(signal =>
    signal.riskRewardRatio &&
    signal.riskRewardRatio >= 1.5 &&
    signal.status !== 'INVALIDATED' &&
    signal.status !== 'EXPIRED'
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Clear expandedId when the referenced signal is removed/filtered out
  useEffect(() => {
    if (expandedId && !safeSignals.find(s => s.id === expandedId)) {
      setExpandedId(null);
    }
  }, [safeSignals, expandedId]);

  // Calculate signal staleness and price deviation
  const getSignalStatus = (signal: TradeSignal) => {
    const entryPrice = safeParseFloat(signal.entryZone.split('-')[0], 0);
    const ageMs = Date.now() - signal.timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);
    const isStale = ageMinutes > 30; // Stale after 30 minutes

    // Calculate price deviation
    const priceDiff = currentPrice - entryPrice;
    const pricePct = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
    const absPct = Math.abs(pricePct);

    // Determine deviation severity
    let deviationLevel: 'good' | 'warning' | 'danger' = 'good';
    if (absPct > 1) deviationLevel = 'danger';
    else if (absPct > 0.5) deviationLevel = 'warning';

    return {
      entryPrice,
      priceDiff,
      pricePct,
      ageMinutes,
      isStale,
      deviationLevel
    };
  };

  // Handler for approving AI signals
  const handleApprove = useCallback((e: React.MouseEvent, signalId: string) => {
    e.stopPropagation(); // Prevent row click from triggering trade
    approveSignal(signalId);
  }, [approveSignal]);

  // Check if signal requires approval
  const isPendingApproval = (signal: TradeSignal): boolean => {
    return signal.approvalStatus === 'pending_review';
  };

  // Get source badge styling
  const getSourceBadge = (signal: TradeSignal) => {
    if (signal.source === 'ai') {
      return isPendingApproval(signal)
        ? { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', label: 'AI' }
        : { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', label: 'AI' };
    }
    if (signal.source === 'tactical') {
      return { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400', label: 'TAC' };
    }
    return { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400', label: 'HYB' };
  };

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
              <th className="px-2 py-1 border-b border-terminal-border">Src</th>
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
                // Use real breakdown if available, otherwise empty
                const adjustments = signal.confidenceBreakdown || [];
                // Calculate base score by reversing adjustments from final confidence
                const totalAdjustment = adjustments.reduce((acc, adj) => acc + adj.value, 0);
                const baseScore = signal.confidence - totalAdjustment;
                const pending = isPendingApproval(signal);
                const sourceBadge = getSourceBadge(signal);
                const signalStatus = getSignalStatus(signal);

                return (
                  <React.Fragment key={signal.id}>
                    <tr
                        className={`group hover:bg-terminal-card transition-colors cursor-pointer ${isExpanded ? 'bg-terminal-card/50' : ''} ${pending ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : ''} ${signalStatus.isStale ? 'opacity-60' : ''} ${signalStatus.deviationLevel === 'danger' ? 'bg-red-500/5' : ''}`}
                        onClick={() => !pending && onTrade && onTrade(signal)}
                        title={pending ? 'AI signal requires approval before execution' : signalStatus.isStale ? `Signal is ${signalStatus.ageMinutes}min old` : 'Click to execute'}
                    >
                        {/* Ticker */}
                        <td className="px-2 py-1 text-gray-300 font-bold group-hover:text-white">
                        <div className="flex items-center gap-1">
                          {signal.pair.replace('USDT', '')}
                          {pending && (
                            <span title="Requires Approval">
                              <AlertTriangle size={10} className="text-amber-400" />
                            </span>
                          )}
                          {signalStatus.isStale && (
                            <span title={`${signalStatus.ageMinutes}min old`}>
                              <Clock size={10} className="text-gray-500" />
                            </span>
                          )}
                        </div>
                        </td>

                        {/* Source Badge */}
                        <td className="px-2 py-1">
                          <span className={`text-[8px] px-1 py-0.5 rounded border ${sourceBadge.bg} ${sourceBadge.border} ${sourceBadge.text}`}>
                            {sourceBadge.label}
                          </span>
                        </td>

                        {/* Side */}
                        <td className="px-2 py-1">
                        <span className={`flex items-center gap-0.5 ${signal.type === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                            {signal.type === 'LONG' ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
                            {signal.type}
                        </span>
                        </td>

                        {/* Entry with price deviation */}
                        <td className="px-2 py-1 text-right tabular-nums">
                          <div className="flex flex-col items-end">
                            <span className="text-gray-400">{signal.entryZone.split('-')[0]}</span>
                            {signalStatus.entryPrice > 0 && (
                              <span className={`text-[8px] ${
                                signalStatus.deviationLevel === 'danger' ? 'text-red-400' :
                                signalStatus.deviationLevel === 'warning' ? 'text-amber-400' : 'text-gray-600'
                              }`}>
                                {signalStatus.priceDiff >= 0 ? '+' : ''}{signalStatus.priceDiff.toFixed(0)} ({signalStatus.pricePct >= 0 ? '+' : ''}{signalStatus.pricePct.toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Confidence with mini consensus */}
                        <td className="px-2 py-1 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                            {/* Mini consensus dots */}
                            {signal.consensus && Array.isArray(signal.consensus.votes) && signal.consensus.votes.length > 0 && (
                                <div className="flex gap-px" title="Agent votes">
                                    {signal.consensus.votes.slice(0, 5).map((v, idx) => (
                                        <div
                                            key={idx}
                                            className={`w-1 h-3 rounded-sm ${
                                                v.vote === 'BULLISH' ? 'bg-green-500' :
                                                v.vote === 'BEARISH' ? 'bg-red-500' : 'bg-gray-600'
                                            }`}
                                            title={`${v.agentName}: ${v.vote}`}
                                        />
                                    ))}
                                </div>
                            )}
                            <span className={`${getConfColor(signal.confidence)} flex items-center gap-0.5`}>
                                <Zap size={8} className="fill-current" />
                                {signal.confidence}%
                            </span>
                        </div>
                        </td>

                        {/* R:R */}
                        <td className="px-2 py-1 text-right text-blue-400 tabular-nums">
                        1:{signal.riskRewardRatio ? signal.riskRewardRatio.toFixed(1) : '-'}
                        </td>

                        {/* Action / Expand */}
                        <td className="px-2 py-1 text-right flex justify-end gap-1">
                           <button
                              onClick={(e) => toggleExpand(signal.id, e)}
                              className="text-gray-500 hover:text-white p-0.5"
                           >
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                           </button>
                           {pending ? (
                              <button
                                 onClick={(e) => handleApprove(e, signal.id)}
                                 className="text-[9px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-sm border border-amber-500/30 hover:border-amber-500/50 flex items-center gap-1 transition-colors"
                                 title="Approve this AI signal for execution"
                              >
                                 <ShieldCheck size={8} />
                                 APPROVE
                              </button>
                           ) : (
                              <button
                                 className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-terminal-card hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-sm border border-transparent hover:border-blue-500/30 flex items-center gap-1"
                              >
                                 <Play size={8} />
                              </button>
                           )}
                        </td>
                    </tr>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                        <tr className="bg-black/20">
                            <td colSpan={7} className="px-3 py-2 border-b border-terminal-border">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Confidence Breakdown</div>
                                        <ConfidenceBreakdown 
                                            baseScore={baseScore} 
                                            adjustments={adjustments} 
                                            finalScore={signal.confidence} 
                                        />
                                    </div>
                                    <div className="flex-1 border-l border-white/5 pl-4">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Reasoning</div>
                                        <p className="text-gray-400 italic leading-relaxed">
                                            {signal.reasoning}
                                        </p>
                                        {/* Show Agent Consensus if available */}
                                        {signal.consensus && Array.isArray(signal.consensus.votes) && signal.consensus.votes.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-white/5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">Agent Consensus</span>
                                                    {(() => {
                                                        const votes = signal.consensus.votes;
                                                        const expectedDirection = signal.type === 'LONG' ? 'BULLISH' : 'BEARISH';
                                                        const aligned = votes.filter(v => v.vote === expectedDirection).length;
                                                        const ratio = votes.length > 0 ? Math.round((aligned / votes.length) * 100) : 0;
                                                        return (
                                                            <span className={`text-[9px] font-mono ${
                                                                ratio >= 60 ? 'text-green-400' :
                                                                ratio >= 40 ? 'text-yellow-400' : 'text-red-400'
                                                            }`}>
                                                                {aligned}/{votes.length} Aligned ({ratio}%)
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {signal.consensus.votes.map((vote, i) => (
                                                        <span
                                                            key={i}
                                                            title={vote.reason}
                                                            className={`text-[9px] px-1.5 py-0.5 rounded border cursor-help ${
                                                                vote.vote === 'BULLISH' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                                                                vote.vote === 'BEARISH' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                                                                'border-gray-500/30 text-gray-400 bg-gray-500/10'
                                                            }`}
                                                        >
                                                            {vote.agentName}: {vote.vote} ({vote.confidence}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                  <td colSpan={7} className="px-2 py-8 text-center">
                     <div className="flex flex-col items-center gap-2">
                        <Activity size={20} className="text-gray-600 opacity-50" />
                        <div className="text-gray-400 text-sm font-medium">
                           Waiting for better opportunity to enter the market
                        </div>
                        <div className="text-gray-600 text-xs">
                           Only 1:1.5+ R:R setups shown • Click SCAN to refresh
                        </div>
                     </div>
                  </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

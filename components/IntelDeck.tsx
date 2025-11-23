
import React, { useEffect, useState } from 'react';
import { Globe, Zap, AlertTriangle, TrendingUp, TrendingDown, Activity, Shield, Target, Anchor } from 'lucide-react';
import { IntelItem } from '../types';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/useStore';
import { fetchOnChainMetrics, analyzeOnChainMetrics, getOnChainRegime, OnChainMetrics } from '../services/glassnodeService';

export const IntelDeck: React.FC = () => {
    const { latestAnalysis, signals, technicals, intel } = useStore();
    const [onChainMetrics, setOnChainMetrics] = useState<OnChainMetrics | null>(null);
    const [onChainRegime, setOnChainRegime] = useState<{ regime: string; confidence: number } | null>(null);

    // Fetch on-chain metrics on mount and every 5 minutes
    useEffect(() => {
        const loadOnChainData = async () => {
            const metrics = await fetchOnChainMetrics();
            setOnChainMetrics(metrics);

            const regime = getOnChainRegime(metrics);
            setOnChainRegime(regime);
        };

        loadOnChainData();
        const interval = setInterval(loadOnChainData, 900000); // 15 minutes (to avoid rate limit)

        return () => clearInterval(interval);
    }, []);

    // Generate intel items from Glassnode + store intel
    const items: IntelItem[] = [];

    // Add on-chain intel items (if available)
    if (onChainMetrics) {
        const onChainIntel = analyzeOnChainMetrics(onChainMetrics);
        onChainIntel.forEach((intel, idx) => {
            items.push({
                id: `onchain-${idx}`,
                title: intel.metric,
                source: 'Glassnode',
                timestamp: onChainMetrics.timestamp,
                summary: intel.explanation,
                severity: intel.severity,
                category: 'ONCHAIN',
                btcSentiment: intel.signal
            });
        });
    }

    // Add intel from store (AI-generated news)
    items.push(...intel);

    return (
        <div className="h-full grid grid-cols-12 gap-4 p-4 overflow-y-auto">
            {/* Header */}
            <div className="col-span-12 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-terminal-accent">
                    <Globe size={18} />
                    <h3 className="font-mono font-bold text-sm tracking-wider">GLOBAL INTELLIGENCE & TACTICS</h3>
                </div>
                <div className="flex items-center gap-3">
                    {onChainRegime && (
                        <div className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-mono font-bold ${
                            onChainRegime.regime === 'ACCUMULATION' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            onChainRegime.regime === 'DISTRIBUTION' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            onChainRegime.regime === 'OVERHEATED' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            'bg-terminal-border text-terminal-muted border-terminal-border'
                        }`}>
                            <Anchor size={12} />
                            ON-CHAIN: {onChainRegime.regime}
                        </div>
                    )}
                    <div className="text-[10px] text-terminal-muted font-mono">
                        LIVE FEED • <span className="text-green-500">CONNECTED</span>
                    </div>
                </div>
            </div>

            {/* Left Column: Macro & News (Intel Items) */}
            <div className="col-span-4 space-y-4">
                {items.map(item => (
                    <div key={item.id} className="bg-terminal-card border border-terminal-border rounded-lg p-3 hover:border-terminal-accent/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                item.category === 'MACRO' ? 'bg-blue-500/10 text-blue-400' :
                                item.category === 'ONCHAIN' ? 'bg-green-500/10 text-green-400' :
                                'bg-purple-500/10 text-purple-400'
                                }`}>
                                {item.category}
                            </span>
                            <span className={`text-[9px] font-bold ${item.severity === 'HIGH' ? 'text-red-500' : 'text-yellow-500'
                                }`}>
                                {item.severity} IMPACT
                            </span>
                        </div>
                        <h4 className="font-mono font-bold text-xs text-terminal-text mb-1">{item.title}</h4>
                        <p className="text-[10px] text-terminal-muted leading-relaxed mb-2">
                            {item.summary}
                        </p>
                        <div className="flex justify-between items-center text-[9px] text-terminal-muted opacity-60">
                            <span>{item.source}</span>
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Middle Column: Latest AI Analysis */}
            <div className="col-span-5 bg-terminal-card border border-terminal-border rounded-lg p-4 flex flex-col">
                <div className="flex items-center gap-2 text-terminal-text mb-3 border-b border-terminal-border/50 pb-2">
                    <Zap size={16} className="text-yellow-400" />
                    <span className="font-mono font-bold text-xs">LATEST TACTICAL ANALYSIS</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                    {latestAnalysis ? (
                        <div className="prose prose-invert prose-sm font-mono text-xs leading-relaxed">
                            <ReactMarkdown>{latestAnalysis}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-terminal-muted opacity-50 gap-2">
                            <Activity size={24} />
                            <span className="text-[10px] font-mono">WAITING FOR AI ANALYSIS...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Key Levels & Technical Summary */}
            <div className="col-span-3 space-y-4">
                {/* Technical Summary Card */}
                <div className="bg-terminal-card border border-terminal-border rounded-lg p-3">
                    <h4 className="font-mono font-bold text-xs text-terminal-text mb-3 flex items-center gap-2">
                        <Activity size={12} /> TECH SUMMARY
                    </h4>
                    {technicals ? (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-terminal-muted">RSI (14)</span>
                                <span className={`font-mono ${technicals.rsi > 70 ? 'text-red-500' : technicals.rsi < 30 ? 'text-green-500' : 'text-terminal-text'}`}>
                                    {technicals.rsi.toFixed(1)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-terminal-muted">MACD</span>
                                <span className={`font-mono ${technicals.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {technicals.macd.histogram.toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-terminal-muted">ADX</span>
                                <span className="font-mono text-terminal-text">{technicals.adx.toFixed(1)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-terminal-border/50 flex justify-between items-center">
                                <span className="text-[10px] text-terminal-muted uppercase">Trend</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${technicals.trend === 'BULLISH' ? 'bg-green-500/10 text-green-500' :
                                        technicals.trend === 'BEARISH' ? 'bg-red-500/10 text-red-500' : 'bg-terminal-border text-terminal-muted'
                                    }`}>
                                    {technicals.trend}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] text-terminal-muted text-center py-4">No Data</div>
                    )}
                </div>

                {/* Active Signals Summary */}
                <div className="bg-terminal-card border border-terminal-border rounded-lg p-3">
                    <h4 className="font-mono font-bold text-xs text-terminal-text mb-3 flex items-center gap-2">
                        <Target size={12} /> ACTIVE SIGNALS ({signals.length})
                    </h4>
                    <div className="space-y-2">
                        {signals.slice(0, 3).map(signal => (
                            <div key={signal.id} className="flex justify-between items-center text-xs border-b border-terminal-border/30 pb-1 last:border-0">
                                <span className="font-mono text-terminal-muted">{signal.pair}</span>
                                <span className={`font-bold ${signal.type === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                                    {signal.type}
                                </span>
                            </div>
                        ))}
                        {signals.length === 0 && (
                            <div className="text-[10px] text-terminal-muted text-center py-2">No active signals</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

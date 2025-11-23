
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
        <div className="h-full card-premium overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-green-400">
                    <Globe size={16} />
                    <h3 className="font-sans font-semibold text-sm tracking-wide">Intelligence Feed</h3>
                </div>
                <div className="flex items-center gap-2">
                    {onChainRegime && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${
                            onChainRegime.regime === 'ACCUMULATION' ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.15)]' :
                            onChainRegime.regime === 'DISTRIBUTION' ? 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]' :
                            onChainRegime.regime === 'OVERHEATED' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(251,146,60,0.15)]' :
                            'bg-white/5 text-gray-400 border-white/10'
                        }`}>
                            <Anchor size={12} />
                            {onChainRegime.regime}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-md">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">LIVE</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
            {/* Left Column: Macro & News (Intel Items) */}
            <div className="col-span-4 space-y-2">
                {items.map(item => (
                    <div key={item.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-md p-3 transition-all duration-200 group relative overflow-hidden">
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-medium border ${
                                    item.category === 'MACRO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                    item.category === 'ONCHAIN' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                    'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                    }`}>
                                    {item.category}
                                </span>
                                <span className={`text-[9px] font-semibold ${item.severity === 'HIGH' ? 'text-red-400' : 'text-yellow-400'
                                    }`}>
                                    {item.severity}
                                </span>
                            </div>
                            <h4 className="font-sans font-semibold text-xs text-gray-100 mb-1.5 leading-tight">{item.title}</h4>
                            <p className="text-[10px] text-gray-400 leading-relaxed mb-2">
                                {item.summary}
                            </p>
                            <div className="flex justify-between items-center text-[9px] text-gray-500">
                                <span className="font-medium">{item.source}</span>
                                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Middle Column: Latest AI Analysis */}
            <div className="col-span-5 bg-white/5 border border-white/10 rounded-md p-4 flex flex-col">
                <div className="flex items-center gap-2 text-yellow-400 mb-3 border-b border-white/10 pb-2">
                    <Zap size={14} />
                    <span className="font-sans font-semibold text-xs">AI Tactical Analysis</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                    {latestAnalysis ? (
                        <div className="prose prose-invert prose-sm text-xs leading-relaxed">
                            <ReactMarkdown>{latestAnalysis}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60 gap-2">
                            <div className="relative">
                                <Activity size={24} className="animate-pulse" />
                                <div className="absolute inset-0 blur-md bg-yellow-500/20"></div>
                            </div>
                            <span className="text-sm font-medium">Waiting for AI Analysis</span>
                            <span className="text-[10px] text-gray-600">Analyzing market conditions...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Key Levels & Technical Summary */}
            <div className="col-span-3 space-y-3">
                {/* Technical Summary Card */}
                <div className="bg-white/5 border border-white/10 rounded-md p-3">
                    <h4 className="font-sans font-semibold text-xs text-gray-200 mb-3 flex items-center gap-1.5">
                        <Activity size={12} /> Technicals
                    </h4>
                    {technicals ? (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-medium">RSI (14)</span>
                                <span className={`font-mono font-semibold ${technicals.rsi > 70 ? 'text-red-400' : technicals.rsi < 30 ? 'text-green-400' : 'text-gray-300'}`}>
                                    {technicals.rsi.toFixed(1)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-medium">MACD</span>
                                <span className={`font-mono font-semibold ${technicals.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {technicals.macd.histogram.toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-medium">ADX</span>
                                <span className="font-mono font-semibold text-gray-300">{technicals.adx.toFixed(1)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 uppercase font-medium">Trend</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${technicals.trend === 'BULLISH' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                        technicals.trend === 'BEARISH' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-white/5 text-gray-400 border-white/10'
                                    }`}>
                                    {technicals.trend}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 text-center py-4">No Data</div>
                    )}
                </div>

                {/* Active Signals Summary */}
                <div className="bg-white/5 border border-white/10 rounded-md p-3">
                    <h4 className="font-sans font-semibold text-xs text-gray-200 mb-3 flex items-center gap-1.5">
                        <Target size={12} /> Signals ({signals.length})
                    </h4>
                    <div className="space-y-2">
                        {signals.slice(0, 3).map(signal => (
                            <div key={signal.id} className="flex justify-between items-center text-xs border-b border-white/10 pb-2 last:border-0 last:pb-0">
                                <span className="font-mono text-gray-400 font-medium">{signal.pair}</span>
                                <span className={`font-semibold ${signal.type === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                                    {signal.type}
                                </span>
                            </div>
                        ))}
                        {signals.length === 0 && (
                            <div className="text-xs text-gray-500 text-center py-2">No signals</div>
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

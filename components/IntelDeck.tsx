
import React from 'react';
import { Globe, Zap, AlertTriangle, Activity } from 'lucide-react';
import { IntelItem } from '../types';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/useStore';

export const IntelDeck: React.FC = () => {
    const { latestAnalysis, technicals, intel } = useStore();

    // Generate intel items from store intel only (Glassnode removed)
    const items: IntelItem[] = [...intel];

    return (
        <div className="h-full flex flex-col gap-3 overflow-hidden">
            {/* Top Section: AI & Technicals (Fixed Height) */}
            <div className="shrink-0 grid grid-cols-2 gap-3 h-[140px]">
                {/* AI Analysis */}
                <div className="card-premium p-3 flex flex-col relative overflow-hidden">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2 shrink-0">
                        <Zap size={14} />
                        <span className="font-sans font-semibold text-xs tracking-wide">AI TACTICAL</span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {latestAnalysis ? (
                            <div className="prose prose-invert prose-sm text-[10px] leading-relaxed text-gray-300">
                                <ReactMarkdown>{latestAnalysis}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
                                <Activity size={16} className="animate-pulse mb-1" />
                                <span className="text-[10px]">Analyzing...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Technicals Compact */}
                <div className="card-premium p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Activity size={14} />
                        <span className="font-sans font-semibold text-xs tracking-wide">TECHNICALS</span>
                    </div>
                    
                    {technicals ? (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500">RSI (14)</span>
                                <span className={`font-mono font-bold text-sm ${technicals.rsi > 70 ? 'text-red-400' : technicals.rsi < 30 ? 'text-green-400' : 'text-gray-300'}`}>
                                    {technicals.rsi.toFixed(1)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500">MACD</span>
                                <span className={`font-mono font-bold text-sm ${technicals.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {technicals.macd.histogram.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-white/5">
                                <span className="text-[10px] text-gray-500">TREND</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    technicals.trend === 'BULLISH' ? 'bg-green-500/10 text-green-400' :
                                    technicals.trend === 'BEARISH' ? 'bg-red-500/10 text-red-400' :
                                    'bg-gray-500/10 text-gray-400'
                                }`}>
                                    {technicals.trend.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-[10px]">
                            No Data
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section: Intelligence Feed (Scrollable) */}
            <div className="flex-1 min-h-0 card-premium flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2 text-green-400">
                        <Globe size={14} />
                        <span className="font-sans font-semibold text-xs tracking-wide">INTEL FEED</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {items.map(item => (
                        <div key={item.id} className="group p-2 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[8px] font-bold px-1 rounded ${
                                        item.category === 'MACRO' ? 'bg-blue-500/20 text-blue-300' :
                                        item.category === 'ONCHAIN' ? 'bg-green-500/20 text-green-300' :
                                        'bg-purple-500/20 text-purple-300'
                                    }`}>
                                        {item.category}
                                    </span>
                                    <span className="text-[9px] text-gray-500">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                {item.severity === 'HIGH' && (
                                    <AlertTriangle size={10} className="text-red-400" />
                                )}
                            </div>
                            <h4 className="text-[11px] font-medium text-gray-200 leading-snug mb-1 group-hover:text-white transition-colors">
                                {item.title}
                            </h4>
                            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 group-hover:text-gray-400">
                                {item.summary}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

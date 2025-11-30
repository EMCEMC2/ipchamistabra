
// VERSION: 2025-11-27-V2 - BTC News Agent Active
import React, { useEffect, useState } from 'react';
import { Globe, Zap, AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import { IntelItem } from '../types';
import ReactMarkdown from 'react-markdown';
import { useAnalysisData } from '../store/selectors';
import { btcNewsAgent } from '../services/btcNewsAgent';

export const IntelDeck: React.FC = () => {
    const { latestAnalysis } = useAnalysisData();
    const [liveNews, setLiveNews] = useState<IntelItem[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Start BTC News Agent on mount
    useEffect(() => {
        const handleNewsUpdate = (news: IntelItem[]) => {
            setLiveNews(news);
        };

        btcNewsAgent.start(handleNewsUpdate);

        return () => {
            btcNewsAgent.stop(handleNewsUpdate);
        };
    }, []);

    // Manual refresh handler
    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await btcNewsAgent.refresh();
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    // Use live news as items
    const items: IntelItem[] = liveNews;

    return (
        <div className="h-full flex flex-col gap-2 overflow-hidden">
            {/* Top Section: AI Analysis (75% height) */}
            <div className="h-[75%] min-h-0">
                {/* AI Analysis */}
                <div className="card-premium p-3 flex flex-col relative overflow-hidden h-full">
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
            </div>

            {/* Bottom Section: Intelligence Feed (25% height) */}
            <div className="h-[25%] min-h-0 card-premium flex flex-col">
                <div className="flex items-center justify-between p-2 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2 text-green-400">
                        <Globe size={14} />
                        <span className="font-sans font-semibold text-xs tracking-wide">LIVE BTC NEWS</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-50"
                            title="Refresh news"
                        >
                            <RefreshCw size={12} className={`text-gray-400 hover:text-green-400 transition-colors ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {items.length > 0 ? (
                        items.map(item => (
                            <div key={item.id} className="group p-1.5 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                <div className="flex justify-between items-start mb-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className={`text-[7px] font-bold px-1 rounded ${
                                            item.category === 'MACRO' ? 'bg-blue-500/20 text-blue-300' :
                                            item.category === 'ONCHAIN' ? 'bg-green-500/20 text-green-300' :
                                            item.category === 'WHALE' ? 'bg-purple-500/20 text-purple-300' :
                                            'bg-yellow-500/20 text-yellow-300'
                                        }`}>
                                            {item.category}
                                        </span>
                                        <span className={`text-[7px] font-bold px-1 rounded ${
                                            item.btcSentiment === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                                            item.btcSentiment === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {item.btcSentiment}
                                        </span>
                                        <span className="text-[8px] text-gray-500">{new Date(item.timestamp).toLocaleTimeString('en-IL', {hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Jerusalem'})}</span>
                                    </div>
                                    {item.severity === 'HIGH' && (
                                        <AlertTriangle size={9} className="text-red-400" />
                                    )}
                                </div>
                                <h4 className="text-[10px] font-medium text-gray-200 leading-tight mb-0.5 group-hover:text-white transition-colors line-clamp-1">
                                    {item.title}
                                </h4>
                                <p className="text-[9px] text-gray-500 leading-tight line-clamp-1 group-hover:text-gray-400">
                                    {item.summary}
                                </p>
                                <div className="mt-0.5 text-[7px] text-gray-600">
                                    {item.source}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                            <Activity size={16} className="animate-pulse mb-1" />
                            <span className="text-[10px]">Loading live BTC news...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

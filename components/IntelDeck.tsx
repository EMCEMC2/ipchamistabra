
import React, { useState, useEffect } from 'react';
import { Crosshair, AlertTriangle, RefreshCw, Globe, Radio, Zap, FileText, ShieldAlert } from 'lucide-react';
import { generateTradeSetup, scanGlobalIntel } from '../services/gemini';
import { IntelItem } from '../types';
import ReactMarkdown from 'react-markdown';

interface IntelDeckProps {
  latestAnalysis?: string;
  items?: IntelItem[];
}

export const IntelDeck: React.FC<IntelDeckProps> = ({ latestAnalysis, items = [] }) => {
  const [activeTab, setActiveTab] = useState<'TACTICAL' | 'INTEL'>('INTEL');

  // Setup State
  const [setup, setSetup] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);

  // Intel State
  const [intelItems, setIntelItems] = useState<IntelItem[]>(items);
  const [loadingIntel, setLoadingIntel] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      setIntelItems(items);
    }
  }, [items]);

  const generateSetup = async () => {
    if (!latestAnalysis) return;
    setLoadingSetup(true);
    const response = await generateTradeSetup(latestAnalysis);
    setSetup(response.text);
    setLoadingSetup(false);
  };

  const refreshIntel = async () => {
    setLoadingIntel(true);
    const newItems = await scanGlobalIntel();
    if (newItems.length > 0) {
      setIntelItems(newItems);
    }
    setLoadingIntel(false);
  };

  // Auto-fetch intel on mount ONLY if no items provided
  useEffect(() => {
    if (items.length === 0) refreshIntel();
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH': return 'text-green-500 border-green-500/30 bg-green-500/10';
      case 'BEARISH': return 'text-red-500 border-red-500/30 bg-red-500/10';
      default: return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    }
  };

  const getSentimentBorder = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH': return 'bg-green-500';
      case 'BEARISH': return 'bg-red-500';
      default: return 'bg-orange-500';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'WHALE': return <ShieldAlert size={12} />;
      case 'MACRO': return <Globe size={12} />;
      case 'ONCHAIN': return <Zap size={12} />;
      default: return <FileText size={12} />;
    }
  };

  return (
    <div className="bg-terminal-card border border-terminal-border rounded-lg p-2 h-full flex flex-col relative overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center justify-between mb-2 shrink-0 z-10">
        <div className="flex bg-terminal-bg rounded p-0.5 border border-terminal-border">
          <button
            onClick={() => setActiveTab('INTEL')}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${activeTab === 'INTEL'
              ? 'bg-terminal-card text-terminal-accent shadow-sm border border-terminal-border/50'
              : 'text-terminal-muted hover:text-terminal-text'
              }`}
          >
            <Radio size={12} className={loadingIntel ? "animate-pulse" : ""} />
            GLOBAL INTEL
          </button>
          <button
            onClick={() => setActiveTab('TACTICAL')}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${activeTab === 'TACTICAL'
              ? 'bg-terminal-card text-terminal-warn shadow-sm border border-terminal-border/50'
              : 'text-terminal-muted hover:text-terminal-text'
              }`}
          >
            <Crosshair size={12} />
            TACTICAL SETUP
          </button>
        </div>

        <div className="flex gap-1">
          {activeTab === 'TACTICAL' && (
            <button
              onClick={generateSetup}
              disabled={loadingSetup || !latestAnalysis}
              className="text-[10px] flex items-center gap-1 bg-terminal-border hover:bg-terminal-text hover:text-terminal-bg px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={loadingSetup ? "animate-spin" : ""} />
              GENERATE PLAN
            </button>
          )}
          {activeTab === 'INTEL' && (
            <button
              onClick={refreshIntel}
              disabled={loadingIntel}
              className="text-[10px] flex items-center gap-1 bg-terminal-border hover:bg-terminal-accent hover:text-terminal-bg px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={loadingIntel ? "animate-spin" : ""} />
              SCAN NET
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto border border-terminal-border/50 bg-terminal-bg/30 rounded p-1 relative scrollbar-hide min-h-0">

        {/* INTEL FEED */}
        {activeTab === 'INTEL' && (
          <div className="space-y-2 p-2">
            {loadingIntel && intelItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-terminal-accent font-mono text-xs animate-pulse gap-2">
                <Globe size={24} className="animate-spin" />
                <span>SCANNING SURFACE WEB...</span>
              </div>
            )}

            {intelItems.map((item) => (
              <div key={item.id} className="bg-terminal-bg/80 border border-terminal-border p-3 rounded hover:border-terminal-muted transition-colors group relative overflow-hidden">
                {/* Sentiment Border - Left Side */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getSentimentBorder(item.btcSentiment)}`} />

                <div className="flex justify-between items-start mb-1 pl-2">
                  <span className="font-mono font-bold text-xs text-terminal-text leading-tight">{item.title}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getSentimentColor(item.btcSentiment)}`}>
                      {item.btcSentiment}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted flex items-center gap-1">
                      {getCategoryIcon(item.category)} {item.category}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-terminal-muted font-mono pl-2 leading-relaxed mb-2">
                  {item.summary}
                </p>

                <div className="flex justify-between items-center pl-2 border-t border-terminal-border/30 pt-2 mt-1">
                  <span className="text-[9px] text-terminal-muted font-mono uppercase">{item.source}</span>
                  <span className="text-[9px] text-terminal-muted font-mono">
                    {Math.floor((Date.now() - item.timestamp) / 60000)}m ago
                  </span>
                </div>
              </div>
            ))}

            {!loadingIntel && intelItems.length === 0 && (
              <div className="text-center text-terminal-muted text-xs font-mono p-4">
                NO NEW INTELLIGENCE DETECTED.
              </div>
            )}
          </div>
        )}

        {/* TACTICAL SETUP */}
        {activeTab === 'TACTICAL' && (
          <div className="h-full p-3">
            {!setup && !loadingSetup && (
              <div className="h-full flex items-center justify-center text-terminal-muted text-xs font-mono text-center opacity-50">
                <div>
                  <Crosshair className="mx-auto mb-2" size={24} />
                  AWAITING MARKET ANALYSIS DATA...
                </div>
              </div>
            )}

            {loadingSetup && (
              <div className="h-full flex items-center justify-center text-terminal-warn text-xs font-mono animate-pulse">
                <div className="text-center">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                  CALCULATING PROBABILITIES...
                </div>
              </div>
            )}

            {setup && (
              <div className="prose prose-invert prose-sm font-mono text-xs leading-relaxed">
                <ReactMarkdown>{setup}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="mt-3 text-[10px] text-terminal-muted flex justify-between items-center border-t border-terminal-border/30 pt-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={10} className="text-terminal-accent" />
          <span>INTEL SOURCE: GEMINI SEARCH GROUNDING</span>
        </div>
        <span className="opacity-50">ENCRYPTED_STREAM_V2</span>
      </div>
    </div>
  );
};

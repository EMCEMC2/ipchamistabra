import React, { useState } from 'react';
import { Crosshair, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { generateTradeSetup } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/useStore';

export const TradeSetupPanel: React.FC = () => {
  const latestAnalysis = useStore(state => state.latestAnalysis);
  const [setup, setSetup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSetup = async () => {
    if (!latestAnalysis) return;
    setLoading(true);
    const response = await generateTradeSetup(latestAnalysis);
    setSetup(response.text);
    setLoading(false);
  };

  return (
    <div className="bg-terminal-card border border-terminal-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-terminal-warn">
          <Crosshair size={18} />
          <h3 className="font-mono font-bold text-sm tracking-wider">TACTICAL SETUP GENERATOR</h3>
        </div>
        <button 
          onClick={generateSetup} 
          disabled={loading || !latestAnalysis}
          className="text-xs flex items-center gap-1 bg-terminal-border hover:bg-terminal-text hover:text-terminal-bg px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "THINKING..." : "GENERATE"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto border border-terminal-border/50 bg-terminal-bg/30 rounded p-3 relative">
        {!setup && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-terminal-muted text-xs font-mono text-center p-4">
            <div>
              <AlertTriangle className="mx-auto mb-2 opacity-50" size={24} />
              WAITING FOR MARKET ANALYSIS DATA...
              <br/>
              (Run a scan in the Command Center first)
            </div>
          </div>
        )}
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-terminal-accent text-xs font-mono animate-pulse">
             <div className="text-center">
               <RefreshCw size={24} className="animate-spin mx-auto mb-2"/>
               DEEP THINKING ANALYSIS IN PROGRESS...
             </div>
          </div>
        )}

        {setup && (
          <div className="prose prose-invert prose-sm font-mono text-xs leading-relaxed">
            <ReactMarkdown>{setup}</ReactMarkdown>
          </div>
        )}
      </div>
      
      <div className="mt-3 text-[10px] text-terminal-muted flex items-start gap-2">
        <AlertTriangle size={12} className="text-terminal-danger shrink-0 mt-0.5" />
        <span>
          AI suggestions are for educational purposes only. 
          Executions are manual. You are responsible for your own PnL.
        </span>
      </div>
    </div>
  );
};
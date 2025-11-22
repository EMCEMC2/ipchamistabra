
import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import { BookOpen, CheckCircle, MessageSquare, Plus, X, Calendar, DollarSign, Hash, AlignLeft, TrendingUp, Save } from 'lucide-react';
import { analyzeTradeJournal } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

interface TradeJournalProps {
    entries: JournalEntry[];
    onAddEntry: (entry: JournalEntry) => void;
}

export const TradeJournal: React.FC<TradeJournalProps> = ({ entries, onAddEntry }) => {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
      pair: 'BTC/USD',
      type: 'LONG',
      entryPrice: '',
      exitPrice: '',
      size: '1.0',
      leverage: '1',
      notes: ''
  });

  const handleAnalyze = async (entry: JournalEntry) => {
      setSelectedEntry(entry);
      if (entry.aiFeedback) {
          setAiFeedback(entry.aiFeedback);
          return;
      }
      
      setLoadingFeedback(true);
      setAiFeedback("");
      const feedback = await analyzeTradeJournal(entry);
      setAiFeedback(feedback);
      setLoadingFeedback(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Real-time calc for preview
  const stats = useMemo(() => {
      const entry = parseFloat(formData.entryPrice) || 0;
      const exit = parseFloat(formData.exitPrice) || 0;
      const size = parseFloat(formData.size) || 0;
      const lev = parseFloat(formData.leverage) || 1;
      
      if (!entry || !exit || !size) return { pnl: 0, roe: 0 };

      const diff = formData.type === 'LONG' ? exit - entry : entry - exit;
      const pnl = diff * size;
      const roe = (diff / entry) * lev * 100;

      return { pnl, roe };
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.entryPrice || !formData.exitPrice) return;

      const newEntry: JournalEntry = {
          id: `manual-${Date.now()}`,
          pair: formData.pair.toUpperCase(),
          type: formData.type as 'LONG' | 'SHORT',
          entryPrice: parseFloat(formData.entryPrice),
          exitPrice: parseFloat(formData.exitPrice),
          size: parseFloat(formData.size),
          pnl: stats.pnl,
          pnlPercent: stats.roe,
          entryTime: Date.now() - 3600000, // Approx 1hr duration for manual logs
          exitTime: Date.now(),
          notes: formData.notes || "Manual Log",
      };

      onAddEntry(newEntry);
      setIsFormOpen(false);
      // Reset essential fields
      setFormData(prev => ({ ...prev, entryPrice: '', exitPrice: '', notes: '' }));
  };

  return (
    <div className="h-full grid grid-cols-12 gap-4">
        {/* List / Form Section */}
        <div className="col-span-7 bg-terminal-card border border-terminal-border rounded-lg flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="p-3 border-b border-terminal-border flex items-center justify-between bg-terminal-bg/50">
                <div className="flex items-center gap-2 text-terminal-muted">
                    <BookOpen size={16} />
                    <span className="font-mono font-bold text-sm">TRADE HISTORY LOG</span>
                </div>
                <button 
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-1 bg-terminal-accent/10 hover:bg-terminal-accent text-terminal-accent hover:text-terminal-bg border border-terminal-accent/20 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all"
                >
                    <Plus size={12} /> LOG TRADE
                </button>
            </div>

            {/* Manual Entry Form Overlay */}
            {isFormOpen && (
                <div className="absolute inset-0 z-20 bg-terminal-card flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="p-3 border-b border-terminal-border flex items-center justify-between bg-terminal-bg/50">
                        <span className="font-mono font-bold text-sm text-terminal-text">LOG MANUAL TRADE</span>
                        <button onClick={() => setIsFormOpen(false)} className="text-terminal-muted hover:text-terminal-text">
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex-1 p-4 overflow-y-auto space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-terminal-muted font-mono uppercase">Pair</label>
                                <div className="relative">
                                    <Hash size={12} className="absolute left-2.5 top-2.5 text-terminal-muted"/>
                                    <input 
                                        name="pair" 
                                        value={formData.pair} 
                                        onChange={handleInputChange}
                                        className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-8 text-xs font-mono focus:border-terminal-accent outline-none uppercase" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-terminal-muted font-mono uppercase">Type</label>
                                <select 
                                    name="type" 
                                    value={formData.type} 
                                    onChange={handleInputChange}
                                    className="w-full bg-terminal-bg border border-terminal-border rounded p-2 text-xs font-mono focus:border-terminal-accent outline-none"
                                >
                                    <option value="LONG">LONG</option>
                                    <option value="SHORT">SHORT</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-terminal-muted font-mono uppercase">Entry Price</label>
                                <div className="relative">
                                    <DollarSign size={12} className="absolute left-2.5 top-2.5 text-terminal-muted"/>
                                    <input 
                                        type="number" 
                                        name="entryPrice" 
                                        value={formData.entryPrice} 
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-8 text-xs font-mono focus:border-terminal-accent outline-none" 
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-terminal-muted font-mono uppercase">Exit Price</label>
                                <div className="relative">
                                    <DollarSign size={12} className="absolute left-2.5 top-2.5 text-terminal-muted"/>
                                    <input 
                                        type="number" 
                                        name="exitPrice" 
                                        value={formData.exitPrice} 
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-8 text-xs font-mono focus:border-terminal-accent outline-none" 
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-terminal-muted font-mono uppercase">Size (BTC)</label>
                                <input 
                                    type="number" 
                                    name="size" 
                                    value={formData.size} 
                                    onChange={handleInputChange}
                                    className="w-full bg-terminal-bg border border-terminal-border rounded p-2 text-xs font-mono focus:border-terminal-accent outline-none" 
                                />
                            </div>
                             <div className="space-y-1">
                                <label className="text-[10px] text-terminal-muted font-mono uppercase">Leverage (x)</label>
                                <input 
                                    type="number" 
                                    name="leverage" 
                                    value={formData.leverage} 
                                    onChange={handleInputChange}
                                    className="w-full bg-terminal-bg border border-terminal-border rounded p-2 text-xs font-mono focus:border-terminal-accent outline-none" 
                                />
                            </div>
                        </div>
                        
                        {/* Live Preview */}
                        <div className={`p-3 rounded border ${stats.pnl >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'} flex justify-between items-center`}>
                             <div>
                                 <div className="text-[10px] text-terminal-muted font-mono uppercase">Calculated PnL</div>
                                 <div className={`text-sm font-mono font-bold ${stats.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                     {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(2)}
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="text-[10px] text-terminal-muted font-mono uppercase">ROE %</div>
                                 <div className={`text-sm font-mono font-bold ${stats.roe >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                     {stats.roe.toFixed(2)}%
                                 </div>
                             </div>
                        </div>

                        <div className="space-y-1">
                             <label className="text-[10px] text-terminal-muted font-mono uppercase">Analysis / Notes</label>
                             <textarea 
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                className="w-full bg-terminal-bg border border-terminal-border rounded p-2 text-xs font-mono focus:border-terminal-accent outline-none h-20 resize-none"
                                placeholder="Why did you take this trade? Mistakes made?"
                             />
                        </div>
                    </form>
                    <div className="p-3 border-t border-terminal-border bg-terminal-bg/50">
                        <button 
                            onClick={handleSubmit}
                            className="w-full bg-terminal-accent text-terminal-bg font-mono font-bold text-xs py-3 rounded flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            <Save size={14} /> SAVE ENTRY TO LOG
                        </button>
                    </div>
                </div>
            )}

            {/* List View */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-terminal-bg text-[10px] text-terminal-muted font-mono uppercase sticky top-0 z-10">
                        <tr>
                            <th className="p-3 border-b border-terminal-border">Time</th>
                            <th className="p-3 border-b border-terminal-border">Pair</th>
                            <th className="p-3 border-b border-terminal-border">Type</th>
                            <th className="p-3 border-b border-terminal-border">Price</th>
                            <th className="p-3 text-right border-b border-terminal-border">PnL</th>
                            <th className="p-3 text-center border-b border-terminal-border">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-mono">
                        {entries.map(entry => (
                            <tr key={entry.id} className="border-b border-terminal-border/50 hover:bg-terminal-border/30 transition-colors">
                                <td className="p-3 text-terminal-muted whitespace-nowrap">
                                    {new Date(entry.exitTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    <br/>
                                    <span className="text-[9px] opacity-50">{new Date(entry.exitTime).toLocaleDateString()}</span>
                                </td>
                                <td className="p-3 font-bold">{entry.pair}</td>
                                <td className={`p-3 ${entry.type === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {entry.type}
                                </td>
                                <td className="p-3">${entry.exitPrice.toLocaleString()}</td>
                                <td className={`p-3 text-right ${entry.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
                                    <div className="text-[9px] opacity-70">{entry.pnlPercent.toFixed(2)}%</div>
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => handleAnalyze(entry)}
                                        className="text-[10px] bg-terminal-border hover:bg-terminal-accent hover:text-terminal-bg px-2 py-1 rounded transition-colors"
                                    >
                                        ANALYZE
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-terminal-muted italic">
                                    No trades recorded. Click "LOG TRADE" to add manual entries.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* AI Feedback Panel */}
        <div className="col-span-5 bg-terminal-card border border-terminal-border rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 text-terminal-accent mb-4 shrink-0">
                <MessageSquare size={18} />
                <h3 className="font-mono font-bold text-sm">AI EXECUTION CRITIQUE</h3>
            </div>
            
            <div className="flex-1 bg-terminal-bg border border-terminal-border rounded-lg p-4 overflow-y-auto scrollbar-hide">
                {!selectedEntry && (
                    <div className="h-full flex flex-col items-center justify-center text-terminal-muted text-xs font-mono text-center opacity-60 gap-3">
                        <TrendingUp size={32} className="opacity-20"/>
                        <span>Select a trade from the log to generate <br/>Post-Trade Analysis.</span>
                    </div>
                )}
                
                {loadingFeedback && (
                    <div className="h-full flex items-center justify-center text-terminal-accent text-xs font-mono animate-pulse">
                        ANALYZING PRICE ACTION AND EXECUTION TIMING...
                    </div>
                )}

                {selectedEntry && !loadingFeedback && aiFeedback && (
                    <div className="animate-in fade-in duration-300">
                        <div className="mb-3 pb-3 border-b border-terminal-border/50 flex justify-between items-start">
                            <div>
                                <div className="text-xs text-terminal-muted font-mono uppercase">Trade ID</div>
                                <div className="text-xs font-mono text-terminal-text">{selectedEntry.id.slice(0,12)}...</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-terminal-muted font-mono uppercase">Outcome</div>
                                <div className={`text-sm font-mono font-bold ${selectedEntry.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {selectedEntry.pnl >= 0 ? 'WIN' : 'LOSS'}
                                </div>
                            </div>
                        </div>
                        
                        <div className="mb-4 bg-terminal-card border border-terminal-border rounded p-2 text-xs font-mono text-terminal-muted italic">
                            "{selectedEntry.notes}"
                        </div>

                        <div className="prose prose-invert prose-sm font-mono text-xs leading-relaxed">
                            <ReactMarkdown>{aiFeedback}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

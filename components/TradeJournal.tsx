
import React, { useState } from 'react';
import { BookOpen, Plus, Save, Tag, Brain, Calendar, MessageSquare, TrendingUp } from 'lucide-react';
import { JournalEntry } from '../types';
import { useStore } from '../store/useStore';
import { analyzeTradeJournal } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

export const TradeJournal: React.FC = () => {
  const { journal: entries, addJournalEntry: onAddEntry } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({
    pair: 'BTCUSDT',
    type: 'LONG',
    result: 'WIN',
    tags: []
  });

  // AI Analysis State
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.pair || !newEntry.entryPrice || !newEntry.exitPrice) return;

    const entry: JournalEntry = {
      id: Date.now().toString(),
      date: Date.now(),
      pair: newEntry.pair,
      type: newEntry.type as 'LONG' | 'SHORT',
      entryPrice: Number(newEntry.entryPrice),
      exitPrice: Number(newEntry.exitPrice),
      pnl: Number(newEntry.pnl) || 0,
      notes: newEntry.notes || '',
      tags: newEntry.tags || [],
      mood: newEntry.mood || 'NEUTRAL',
      result: Number(newEntry.pnl) > 0 ? 'WIN' : 'LOSS',
      entryTime: Date.now() - 3600000,
      exitTime: Date.now(),
      pnlPercent: 0 // Placeholder
    };

    onAddEntry(entry);
    setIsAdding(false);
    setNewEntry({ pair: 'BTCUSDT', type: 'LONG', result: 'WIN', tags: [] });
  };

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

  return (
    <div className="h-full grid grid-cols-12 gap-4">
      {/* Journal List Section */}
      <div className="col-span-7 bg-terminal-card border border-terminal-border rounded-lg p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-terminal-accent">
            <BookOpen size={18} />
            <h3 className="font-mono font-bold text-sm tracking-wider">TRADE JOURNAL</h3>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 bg-terminal-accent text-terminal-bg px-2 py-1 rounded text-xs font-bold hover:bg-opacity-90 transition-colors"
          >
            <Plus size={14} /> NEW ENTRY
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmit} className="mb-4 p-4 bg-terminal-bg/50 border border-terminal-border rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-terminal-muted uppercase block mb-1">Pair</label>
                <input
                  type="text"
                  value={newEntry.pair}
                  onChange={e => setNewEntry({ ...newEntry, pair: e.target.value })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono focus:border-terminal-accent outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-terminal-muted uppercase block mb-1">Type</label>
                <select
                  value={newEntry.type}
                  onChange={e => setNewEntry({ ...newEntry, type: e.target.value as 'LONG' | 'SHORT' })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono focus:border-terminal-accent outline-none"
                >
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-terminal-muted uppercase block mb-1">Entry Price</label>
                <input
                  type="number"
                  value={newEntry.entryPrice || ''}
                  onChange={e => setNewEntry({ ...newEntry, entryPrice: Number(e.target.value) })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono focus:border-terminal-accent outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-terminal-muted uppercase block mb-1">Exit Price</label>
                <input
                  type="number"
                  value={newEntry.exitPrice || ''}
                  onChange={e => setNewEntry({ ...newEntry, exitPrice: Number(e.target.value) })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono focus:border-terminal-accent outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-terminal-muted uppercase block mb-1">PnL ($)</label>
                <input
                  type="number"
                  value={newEntry.pnl || ''}
                  onChange={e => setNewEntry({ ...newEntry, pnl: Number(e.target.value) })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono focus:border-terminal-accent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-terminal-muted uppercase block mb-1">Notes</label>
              <textarea
                value={newEntry.notes || ''}
                onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-mono focus:border-terminal-accent outline-none h-16 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 text-xs text-terminal-muted hover:text-terminal-text transition-colors"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex items-center gap-1 bg-terminal-accent text-terminal-bg px-3 py-1 rounded text-xs font-bold hover:bg-opacity-90 transition-colors"
              >
                <Save size={14} /> SAVE ENTRY
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {entries.map(entry => (
            <div key={entry.id} className="p-3 bg-terminal-bg/30 border border-terminal-border rounded hover:bg-terminal-bg/50 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${entry.type === 'LONG' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                    {entry.type}
                  </span>
                  <span className="font-mono text-sm font-bold text-terminal-text">{entry.pair}</span>
                  <span className="text-[10px] text-terminal-muted flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                </div>
                <div className={`font-mono font-bold ${entry.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-2">
                <div>
                  <span className="text-terminal-muted mr-2">ENTRY:</span>
                  ${entry.entryPrice}
                </div>
                <div>
                  <span className="text-terminal-muted mr-2">EXIT:</span>
                  ${entry.exitPrice}
                </div>
              </div>

              {entry.notes && (
                <div className="text-xs text-terminal-muted italic border-l-2 border-terminal-border pl-2 mb-2">
                  "{entry.notes}"
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-terminal-border rounded text-terminal-muted flex items-center gap-1">
                      <Tag size={8} /> {tag}
                    </span>
                  ))}
                  {entry.mood && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded flex items-center gap-1">
                      <Brain size={8} /> {entry.mood}
                    </span>
                  )}
                </div>
                <button 
                    onClick={() => handleAnalyze(entry)}
                    className="text-[10px] bg-terminal-border hover:bg-terminal-accent hover:text-terminal-bg px-2 py-1 rounded transition-colors"
                >
                    ANALYZE
                </button>
              </div>
            </div>
          ))}

          {entries.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center h-full text-terminal-muted opacity-50">
              <BookOpen size={32} className="mb-2" />
              <span className="text-xs font-mono">NO JOURNAL ENTRIES</span>
            </div>
          )}
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

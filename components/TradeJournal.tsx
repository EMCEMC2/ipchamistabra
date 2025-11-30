
import React, { useState } from 'react';
import { BookOpen, Plus, Save, Tag, Brain, Calendar } from 'lucide-react';
import { JournalEntry } from '../types';
import { useJournalWithActions } from '../store/selectors';

export const TradeJournal: React.FC = () => {
  const { journal: entries, addJournalEntry: onAddEntry } = useJournalWithActions();
  const safeEntries = entries || [];
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({
    pair: 'BTCUSDT',
    type: 'LONG',
    result: 'WIN',
    tags: []
  });

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
      pnlPercent: newEntry.entryPrice ? ((newEntry.type === 'LONG' ? newEntry.exitPrice - newEntry.entryPrice : newEntry.entryPrice - newEntry.exitPrice) / newEntry.entryPrice) * 100 : 0
    };

    onAddEntry(entry);
    setIsAdding(false);
    setNewEntry({ pair: 'BTCUSDT', type: 'LONG', result: 'WIN', tags: [] });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Journal List Section */}
      <div className="bg-terminal-card border border-terminal-border rounded-lg p-4 h-full flex flex-col">
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
          {safeEntries.map(entry => (
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
                    {new Date(entry.date).toLocaleDateString('en-IL', {timeZone: 'Asia/Jerusalem'})}
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
                  {(entry.tags || []).map(tag => (
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
              </div>
            </div>
          ))}

          {safeEntries.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center h-full text-terminal-muted opacity-50">
              <BookOpen size={32} className="mb-2" />
              <span className="text-xs font-mono">NO JOURNAL ENTRIES</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { addBreadcrumb } from '../services/errorMonitor';

type ViewMode = 'TERMINAL' | 'SWARM' | 'CORTEX' | 'JOURNAL' | 'BACKTEST';

interface ShortcutOptions {
  setActiveView: (view: ViewMode) => void;
}

export const useKeyboardShortcuts = ({ setActiveView }: ShortcutOptions) => {
  // CRITICAL FIX: Only get action functions from the hook (stable references)
  // Use getState() inside handlers to get fresh data and avoid stale closures
  const { setExecutionSide, closePosition, resetDailyPnL } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Shift + L: Set Long
      if (e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        setExecutionSide('LONG');
        if (import.meta.env.DEV) {
          console.log('[Shortcut] Set Side: LONG');
        }
      }

      // Shift + S: Set Short
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setExecutionSide('SHORT');
        if (import.meta.env.DEV) {
          console.log('[Shortcut] Set Side: SHORT');
        }
      }

      // Alt + Number: Switch Views
      if (e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveView('TERMINAL');
            addBreadcrumb('Switched to TERMINAL view', 'keyboard');
            break;
          case '2':
            e.preventDefault();
            setActiveView('SWARM');
            addBreadcrumb('Switched to SWARM view', 'keyboard');
            break;
          case '3':
            e.preventDefault();
            setActiveView('CORTEX');
            addBreadcrumb('Switched to CORTEX view', 'keyboard');
            break;
          case '4':
            e.preventDefault();
            setActiveView('BACKTEST');
            addBreadcrumb('Switched to BACKTEST view', 'keyboard');
            break;
          case '5':
            e.preventDefault();
            setActiveView('JOURNAL');
            addBreadcrumb('Switched to JOURNAL view', 'keyboard');
            break;
        }
      }

      // Ctrl + Shift + C: Close All Positions (EMERGENCY)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && e.shiftKey) {
        e.preventDefault();
        // CRITICAL FIX: Get fresh positions data to avoid stale closure
        const freshPositions = useStore.getState().positions;
        const posCount = freshPositions.length;
        if (posCount > 0 && window.confirm(`[WARNING] CLOSE ALL ${posCount} POSITIONS? This cannot be undone.`)) {
          freshPositions.forEach(pos => {
            closePosition(pos.id, pos.pnl);
          });
          addBreadcrumb(`Emergency close: ${posCount} positions closed`, 'keyboard');
          if (import.meta.env.DEV) {
            console.log(`[Shortcut] EMERGENCY: Closed all ${posCount} positions`);
          }
        }
      }

      // Ctrl + R: Reset Daily P&L (requires confirmation)
      if (e.ctrlKey && (e.key === 'r' || e.key === 'R') && e.shiftKey) {
        e.preventDefault();
        if (window.confirm('[WARNING] RESET DAILY P&L? This will reset your daily loss limit tracker.')) {
          resetDailyPnL();
          addBreadcrumb('Daily P&L reset manually', 'keyboard');
          if (import.meta.env.DEV) {
            console.log('[Shortcut] Daily P&L reset');
          }
        }
      }

      // F1: Show keyboard shortcuts help
      if (e.key === 'F1') {
        e.preventDefault();
        alert(`KEYBOARD SHORTCUTS:

VIEW SWITCHING:
Alt + 1: Terminal View
Alt + 2: Agent Swarm
Alt + 3: ML Cortex
Alt + 4: Backtest
Alt + 5: Journal

TRADING:
Shift + L: Set LONG bias
Shift + S: Set SHORT bias

EMERGENCY:
Ctrl + Shift + C: Close ALL positions
Ctrl + Shift + R: Reset daily P&L

HELP:
F1: Show this help`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // CRITICAL FIX: Removed `positions` from deps - we now use getState() for fresh data
  }, [setExecutionSide, setActiveView, closePosition, resetDailyPnL]);
};

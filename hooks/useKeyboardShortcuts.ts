import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { addBreadcrumb } from '../services/errorMonitor';

type ViewMode = 'TERMINAL' | 'SWARM' | 'CORTEX' | 'JOURNAL' | 'BACKTEST';

interface ShortcutOptions {
  setActiveView: (view: ViewMode) => void;
}

export const useKeyboardShortcuts = ({ setActiveView }: ShortcutOptions) => {
  const { setExecutionSide, positions, closePosition, resetDailyPnL } = useStore();

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
        console.log('[Shortcut] Set Side: LONG');
      }

      // Shift + S: Set Short
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setExecutionSide('SHORT');
        console.log('[Shortcut] Set Side: SHORT');
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

      // Ctrl + C: Close All Positions (EMERGENCY)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && e.shiftKey) {
        e.preventDefault();
        const posCount = positions.length;
        if (posCount > 0 && window.confirm(`⚠️ CLOSE ALL ${posCount} POSITIONS? This cannot be undone.`)) {
          positions.forEach(pos => {
            closePosition(pos.id, pos.pnl);
          });
          addBreadcrumb(`Emergency close: ${posCount} positions closed`, 'keyboard');
          console.log(`[Shortcut] EMERGENCY: Closed all ${posCount} positions`);
        }
      }

      // Ctrl + R: Reset Daily P&L (requires confirmation)
      if (e.ctrlKey && (e.key === 'r' || e.key === 'R') && e.shiftKey) {
        e.preventDefault();
        if (window.confirm('⚠️ RESET DAILY P&L? This will reset your daily loss limit tracker.')) {
          resetDailyPnL();
          addBreadcrumb('Daily P&L reset manually', 'keyboard');
          console.log('[Shortcut] Daily P&L reset');
        }
      }

      // F1: Show keyboard shortcuts help
      if (e.key === 'F1') {
        e.preventDefault();
        alert(`⌨️ KEYBOARD SHORTCUTS:

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
  }, [setExecutionSide, setActiveView, positions, closePosition, resetDailyPnL]);
};

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
            break;
          case '2':
            e.preventDefault();
            setActiveView('SWARM');
            break;
          case '3':
            e.preventDefault();
            setActiveView('CORTEX');
            break;
          case '4':
            e.preventDefault();
            setActiveView('BACKTEST');
            break;
          case '5':
            e.preventDefault();
            setActiveView('JOURNAL');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setExecutionSide, setActiveView]);
};

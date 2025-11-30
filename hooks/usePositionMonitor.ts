/**
 * POSITION MONITORING HOOK
 * Runs in background, updates PnL, auto-closes positions on SL/TP
 * This is the "heartbeat" of the trading engine.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { calculatePositionPnL, checkPositionClose } from '../utils/tradingCalculations';

const MONITOR_INTERVAL_MS = 1000; // Check every 1 second

export function usePositionMonitor() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogRef = useRef<number>(0);
  // Mutex: Track positions currently being closed to prevent race conditions
  const closingPositionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('[Position Monitor] Starting...');

    intervalRef.current = setInterval(() => {
      const { positions, price, updatePositionPnl, closePosition, addJournalEntry } = useStore.getState();

      if (!positions || positions.length === 0) {
        // No positions, no work to do
        return;
      }

      if (price === 0) {
        // Price not loaded yet
        return;
      }

      // Process each position
      positions.forEach((position) => {
        // Skip if position is already being closed (mutex check)
        if (closingPositionsRef.current.has(position.id)) {
          return;
        }

        // 1. Calculate current PnL
        const { pnlUSD, pnlPercent } = calculatePositionPnL(position, price);

        // 2. Update PnL in state
        updatePositionPnl(position.id, pnlUSD, pnlPercent);

        // 3. Check if position should close
        const { shouldClose, reason } = checkPositionClose(position, price);

        if (shouldClose && reason) {
          // Add to mutex BEFORE closing to prevent race condition
          closingPositionsRef.current.add(position.id);

          // Close the position
          closePosition(position.id, pnlUSD);

          // Add to journal
          addJournalEntry({
            id: `journal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            date: Date.now(),
            pair: position.pair,
            type: position.type,
            entryPrice: position.entryPrice,
            exitPrice: price,
            size: position.size,
            leverage: position.leverage,
            pnl: pnlUSD,
            pnlPercent: pnlPercent,
            entryTime: position.timestamp,
            exitTime: Date.now(),
            notes: `Auto-closed: ${reason.replace('_', ' ')}`,
            tags: [reason, position.type],
            mood: pnlUSD > 0 ? 'CONFIDENT' : 'FRUSTRATED',
            result: pnlUSD > 0 ? 'WIN' : pnlUSD < 0 ? 'LOSS' : 'BE'
          });

          // Log the close
          const emoji = reason === 'TAKE_PROFIT' ? '[TP]' : reason === 'STOP_LOSS' ? '[SL]' : '[LIQ]';
          console.log(
            `[Position Monitor] ${emoji} CLOSED ${position.type} @ $${price.toFixed(2)} | ` +
            `Reason: ${reason} | PnL: ${pnlUSD > 0 ? '+' : ''}$${pnlUSD.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`
          );

          // Remove from mutex after close is complete
          closingPositionsRef.current.delete(position.id);
        }
      });

      // Log status periodically (every 10 seconds)
      const now = Date.now();
      if (now - lastLogRef.current > 10000) {
        const totalPnL = positions.reduce((sum, p) => {
          const { pnlUSD } = calculatePositionPnL(p, price);
          return sum + pnlUSD;
        }, 0);

        console.log(
          `[Position Monitor] Active: ${positions.length} | ` +
          `Total Unrealized PnL: ${totalPnL > 0 ? '+' : ''}$${totalPnL.toFixed(2)} | ` +
          `BTC: $${price.toFixed(2)}`
        );

        lastLogRef.current = now;
      }
    }, MONITOR_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        console.log('[Position Monitor] Stopping...');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Clear mutex on cleanup
      closingPositionsRef.current.clear();
    };
  }, []); // Run once on mount

  return null; // This hook doesn't render anything
}

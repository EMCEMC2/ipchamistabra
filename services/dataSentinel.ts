/**
 * DATA SENTINEL
 * Responsible for validating incoming data before it affects state.
 * Implements Spike Filtering and Cross-Exchange Sanity Checks.
 */

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

interface SpikeFilterState {
  lastValidPrice: number;
  lastValidTimestamp: number;
  suspiciousTicks: { price: number; timestamp: number }[];
}

// Singleton state for the filter (reset on reload is fine)
const filterState: SpikeFilterState = {
  lastValidPrice: 0,
  lastValidTimestamp: 0,
  suspiciousTicks: [],
};

const SPIKE_THRESHOLD = 0.02; // 2%
const CONFIRMATION_TICKS = 3;

/**
 * Validates a new price tick against the last known valid price.
 * Filters out massive spikes unless confirmed by subsequent ticks.
 */
export function validateTick(newPrice: number, timestamp: number = Date.now()): ValidationResult {
  if (newPrice <= 0) return { valid: false, reason: 'Non-positive price' };
  
  // Initialize if first tick
  if (filterState.lastValidPrice === 0) {
    filterState.lastValidPrice = newPrice;
    filterState.lastValidTimestamp = timestamp;
    return { valid: true };
  }

  const deviation = Math.abs(newPrice - filterState.lastValidPrice) / filterState.lastValidPrice;

  // Check for spike
  if (deviation > SPIKE_THRESHOLD) {
    // Log for tuning (Dev only)
    if (import.meta.env.DEV) {
      console.warn(`[DataSentinel] Spike detected: ${newPrice} (Deviation: ${(deviation * 100).toFixed(2)}%)`);
    }

    // Add to suspicious buffer
    filterState.suspiciousTicks.push({ price: newPrice, timestamp });

    // Keep buffer small
    if (filterState.suspiciousTicks.length > CONFIRMATION_TICKS * 2) {
        filterState.suspiciousTicks.shift();
    }

    // Check if we have enough confirmation ticks (consecutive ticks in the same direction)
    // For simplicity, just checking if we have N recent ticks that are all "spiked" relative to the OLD valid price
    // and close to the NEW price.
    const recentSpikes = filterState.suspiciousTicks.filter(t => {
        const d = Math.abs(t.price - filterState.lastValidPrice) / filterState.lastValidPrice;
        return d > SPIKE_THRESHOLD && Math.sign(t.price - filterState.lastValidPrice) === Math.sign(newPrice - filterState.lastValidPrice);
    });

    if (recentSpikes.length >= CONFIRMATION_TICKS) {
        // Confirmed move
        filterState.lastValidPrice = newPrice;
        filterState.lastValidTimestamp = timestamp;
        filterState.suspiciousTicks = []; // Reset buffer
        return { valid: true };
    }

    return { 
      valid: false, 
      reason: `Spike detected (${(deviation * 100).toFixed(2)}%). Waiting for confirmation.` 
    };
  }

  // Normal tick
  filterState.lastValidPrice = newPrice;
  filterState.lastValidTimestamp = timestamp;
  filterState.suspiciousTicks = []; // Reset buffer on good tick
  return { valid: true };
}

/**
 * Checks the primary price against a secondary source (e.g. Bybit/Coinbase).
 * Note: In this MVP, we might not have a live secondary connection, so this is a placeholder structure
 * or assumes we pass in a secondary price if available.
 */
export function checkCrossExchange(primaryPrice: number, secondaryPrice: number | null): ValidationResult {
  if (!secondaryPrice || secondaryPrice === 0) {
    // Fail open if no secondary source (don't block just because backup is down)
    return { valid: true }; 
  }

  const deviation = Math.abs(primaryPrice - secondaryPrice) / secondaryPrice;
  const MAX_CROSS_EXCHANGE_DEVIATION = 0.005; // 0.5%

  if (deviation > MAX_CROSS_EXCHANGE_DEVIATION) {
    return {
      valid: false,
      reason: `Cross-exchange divergence: Primary ${primaryPrice}, Secondary ${secondaryPrice} (${(deviation * 100).toFixed(2)}%)`
    };
  }

  return { valid: true };
}

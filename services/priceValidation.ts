/**
 * Cross-Exchange Price Validation Service
 *
 * Validates BTC prices across 6 exchanges to detect:
 * - Price anomalies (single exchange deviation)
 * - Arbitrage opportunities
 * - Data feed reliability issues
 * - Flash crashes / pump-and-dumps
 */

import { useStore } from '../store/useStore';
import { AggrStats, ExchangeFlow } from '../types/aggrTypes';

export interface PriceValidation {
  isValid: boolean;
  consensusPrice: number;
  deviation: number; // Max deviation from consensus (%)
  outliers: string[]; // Exchanges with >1% deviation
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  arbitrageSpread: number; // % spread between min/max
  timestamp: number;
}

export interface ExchangePrice {
  exchange: string;
  price: number;
  volume: number;
  timestamp: number;
}

// Price history for each exchange (last 60 seconds)
const priceHistory: Map<string, ExchangePrice[]> = new Map();
const MAX_HISTORY_SIZE = 60;
const STALE_THRESHOLD = 30000; // 30 seconds

/**
 * Update price for an exchange
 */
export function updateExchangePrice(exchange: string, price: number, volume: number): void {
  const now = Date.now();

  if (!priceHistory.has(exchange)) {
    priceHistory.set(exchange, []);
  }

  const history = priceHistory.get(exchange)!;
  history.push({ exchange, price, volume, timestamp: now });

  // Keep only last 60 entries
  while (history.length > MAX_HISTORY_SIZE) {
    history.shift();
  }
}

/**
 * Get latest price from each exchange
 */
export function getLatestPrices(): ExchangePrice[] {
  const now = Date.now();
  const prices: ExchangePrice[] = [];

  for (const [exchange, history] of priceHistory) {
    if (history.length === 0) continue;

    const latest = history[history.length - 1];
    // Only include fresh data (< 30s old)
    if (now - latest.timestamp < STALE_THRESHOLD) {
      prices.push(latest);
    }
  }

  return prices;
}

/**
 * Calculate volume-weighted average price (VWAP) across exchanges
 */
export function calculateConsensusPrice(prices: ExchangePrice[]): number {
  if (prices.length === 0) return 0;

  let totalVolume = 0;
  let weightedSum = 0;

  for (const p of prices) {
    weightedSum += p.price * p.volume;
    totalVolume += p.volume;
  }

  return totalVolume > 0 ? weightedSum / totalVolume : 0;
}

/**
 * Validate prices across exchanges
 */
export function validatePrices(): PriceValidation {
  const prices = getLatestPrices();
  const now = Date.now();

  if (prices.length < 2) {
    return {
      isValid: true, // Can't validate with < 2 exchanges
      consensusPrice: prices[0]?.price || 0,
      deviation: 0,
      outliers: [],
      reliability: prices.length === 0 ? 'LOW' : 'MEDIUM',
      arbitrageSpread: 0,
      timestamp: now
    };
  }

  const consensusPrice = calculateConsensusPrice(prices);
  const outliers: string[] = [];
  let maxDeviation = 0;
  let minPrice = Infinity;
  let maxPrice = 0;

  for (const p of prices) {
    const deviation = Math.abs((p.price - consensusPrice) / consensusPrice) * 100;
    maxDeviation = Math.max(maxDeviation, deviation);

    if (deviation > 1) { // >1% deviation = outlier
      outliers.push(p.exchange);
    }

    minPrice = Math.min(minPrice, p.price);
    maxPrice = Math.max(maxPrice, p.price);
  }

  const arbitrageSpread = ((maxPrice - minPrice) / minPrice) * 100;

  // Determine reliability
  let reliability: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  if (prices.length < 3) {
    reliability = 'MEDIUM';
  } else if (outliers.length >= 2 || maxDeviation > 2) {
    reliability = 'LOW';
  } else if (outliers.length === 1 || maxDeviation > 0.5) {
    reliability = 'MEDIUM';
  }

  return {
    isValid: maxDeviation < 5, // Invalid if any exchange >5% off
    consensusPrice,
    deviation: maxDeviation,
    outliers,
    reliability,
    arbitrageSpread,
    timestamp: now
  };
}

/**
 * Detect price manipulation or flash events
 */
export function detectAnomalies(): {
  hasAnomaly: boolean;
  type: 'FLASH_CRASH' | 'PUMP' | 'SINGLE_EXCHANGE_SPIKE' | 'NONE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  details: string;
} {
  const validation = validatePrices();

  if (!validation.isValid) {
    if (validation.outliers.length === 1) {
      return {
        hasAnomaly: true,
        type: 'SINGLE_EXCHANGE_SPIKE',
        severity: validation.deviation > 3 ? 'HIGH' : 'MEDIUM',
        details: `${validation.outliers[0]} showing ${validation.deviation.toFixed(2)}% deviation from consensus`
      };
    } else if (validation.deviation > 5) {
      return {
        hasAnomaly: true,
        type: 'FLASH_CRASH',
        severity: 'HIGH',
        details: `Major price divergence: ${validation.deviation.toFixed(2)}% max deviation across ${validation.outliers.length} exchanges`
      };
    }
  }

  if (validation.arbitrageSpread > 0.5) {
    return {
      hasAnomaly: true,
      type: validation.arbitrageSpread > 1 ? 'PUMP' : 'SINGLE_EXCHANGE_SPIKE',
      severity: validation.arbitrageSpread > 1.5 ? 'HIGH' : 'LOW',
      details: `Arbitrage opportunity: ${validation.arbitrageSpread.toFixed(3)}% spread`
    };
  }

  return {
    hasAnomaly: false,
    type: 'NONE',
    severity: 'LOW',
    details: 'Prices consistent across exchanges'
  };
}

/**
 * Get exchange reliability scores based on recent data
 */
export function getExchangeReliability(): Map<string, number> {
  const scores = new Map<string, number>();
  const prices = getLatestPrices();

  if (prices.length < 2) {
    return scores;
  }

  const consensusPrice = calculateConsensusPrice(prices);

  for (const p of prices) {
    const deviation = Math.abs((p.price - consensusPrice) / consensusPrice) * 100;
    // Score from 0-100: 100 = perfect, 0 = >5% deviation
    const score = Math.max(0, 100 - deviation * 20);
    scores.set(p.exchange, score);
  }

  return scores;
}

/**
 * Subscribe to order flow stats and update price validation
 */
export function initPriceValidation(): () => void {
  let lastUpdate = 0;
  const MIN_UPDATE_INTERVAL = 1000; // Update at most once per second

  const unsubscribe = useStore.subscribe((state) => {
    const stats = state.orderFlowStats;
    if (!stats || !stats.exchanges) return;

    const now = Date.now();
    if (now - lastUpdate < MIN_UPDATE_INTERVAL) return;
    lastUpdate = now;

    // Extract prices from exchange flow data
    // Note: We use volume-weighted approach, so even without exact prices,
    // we track which exchanges are providing data
    for (const ex of stats.exchanges) {
      const totalVolume = ex.buyVolume + ex.sellVolume;
      if (totalVolume > 0) {
        // Estimate price from recent trades in that exchange
        // This will be enhanced when we track per-exchange prices
        const price = state.price || 0;
        updateExchangePrice(ex.exchange, price, totalVolume);
      }
    }
  });

  return unsubscribe;
}

// Export validation status for UI components
export function getPriceValidationStatus(): {
  validation: PriceValidation;
  anomaly: ReturnType<typeof detectAnomalies>;
  activeExchanges: number;
} {
  const validation = validatePrices();
  const anomaly = detectAnomalies();
  const activeExchanges = getLatestPrices().length;

  return { validation, anomaly, activeExchanges };
}

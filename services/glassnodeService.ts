/**
 * GLASSNODE ON-CHAIN INTELLIGENCE SERVICE
 * Real whale tracking, not order book theater
 * Free tier: 1-week lag (acceptable for regime detection)
 * Paid tier ($39/mo): T-1 data (yesterday's metrics)
 */

export interface OnChainMetrics {
  exchangeNetFlow: number; // BTC flowing in/out of exchanges (negative = accumulation)
  mvrv: number; // MVRV Z-Score (>7 = overvalued, <0 = undervalued)
  minerPosition: number; // Miner net position change (selling pressure)
  timestamp: number;
}

export interface OnChainIntelItem {
  metric: string;
  value: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
}

const GLASSNODE_API_BASE = 'https://api.glassnode.com/v1/metrics';

/**
 * Get API key from environment or localStorage
 * Free tier: Use 'demo' as API key (1-week lagged data)
 */
function getApiKey(): string {
  const fromEnv = import.meta.env.VITE_GLASSNODE_API_KEY;
  const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('GLASSNODE_API_KEY') : null;

  // If no key provided, use 'demo' for free tier
  return fromEnv || fromStorage || 'demo';
}

/**
 * Fetch a single Glassnode metric
 */
async function fetchMetric(
  category: string,
  metric: string,
  asset: string = 'BTC'
): Promise<number> {
  const apiKey = getApiKey();
  const url = `${GLASSNODE_API_BASE}/${category}/${metric}?a=${asset}&api_key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Glassnode rate limit exceeded. Upgrade to paid tier or reduce polling frequency.');
      }
      throw new Error(`Glassnode API error: ${response.status}`);
    }

    const data = await response.json();

    // Glassnode returns array of {t: timestamp, v: value}
    // We want the latest value
    if (Array.isArray(data) && data.length > 0) {
      return data[data.length - 1].v;
    }

    // Some endpoints return single object
    if (data.v !== undefined) {
      return data.v;
    }

    throw new Error('Unexpected Glassnode response format');
  } catch (error) {
    console.error(`[Glassnode] Failed to fetch ${category}/${metric}:`, error);
    return 0; // Fallback to neutral value
  }
}

/**
 * Fetch all on-chain metrics in parallel
 */
export async function fetchOnChainMetrics(): Promise<OnChainMetrics> {
  console.log('[Glassnode] Fetching on-chain metrics...');

  try {
    // Fetch multiple metrics in parallel
    const [exchangeNetFlow, mvrv, minerPosition] = await Promise.all([
      // Exchange Net Flow: Negative = coins leaving exchanges (bullish)
      fetchMetric('transactions', 'transfers_volume_exchanges_net'),

      // MVRV Z-Score: Market Value / Realized Value (fair value metric)
      fetchMetric('market', 'mvrv_z_score'),

      // Miner Position: Are miners selling? (supply pressure)
      fetchMetric('mining', 'revenue_from_fees')
    ]);

    const metrics: OnChainMetrics = {
      exchangeNetFlow,
      mvrv,
      minerPosition,
      timestamp: Date.now()
    };

    console.log('[Glassnode] ✅ Metrics fetched:', {
      netFlow: exchangeNetFlow.toFixed(0),
      mvrv: mvrv.toFixed(2),
      miner: minerPosition.toFixed(0)
    });

    return metrics;
  } catch (error) {
    console.error('[Glassnode] ❌ Failed to fetch metrics:', error);

    // Return neutral fallback
    return {
      exchangeNetFlow: 0,
      mvrv: 0,
      minerPosition: 0,
      timestamp: Date.now()
    };
  }
}

/**
 * Analyze on-chain metrics and generate intel items
 */
export function analyzeOnChainMetrics(metrics: OnChainMetrics): OnChainIntelItem[] {
  const intel: OnChainIntelItem[] = [];

  // 1. Exchange Net Flow Analysis
  if (metrics.exchangeNetFlow !== 0) {
    const flowAbs = Math.abs(metrics.exchangeNetFlow);
    const isOutflow = metrics.exchangeNetFlow < 0;

    intel.push({
      metric: 'Exchange Net Flow',
      value: metrics.exchangeNetFlow,
      signal: isOutflow ? 'BULLISH' : 'BEARISH',
      severity: flowAbs > 5000 ? 'HIGH' : flowAbs > 1000 ? 'MEDIUM' : 'LOW',
      explanation: isOutflow
        ? `${flowAbs.toFixed(0)} BTC moved OFF exchanges (accumulation signal - whales buying)`
        : `${flowAbs.toFixed(0)} BTC moved TO exchanges (distribution signal - potential selling)`
    });
  }

  // 2. MVRV Z-Score Analysis
  if (metrics.mvrv !== 0) {
    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let explanation = '';

    if (metrics.mvrv > 7) {
      signal = 'BEARISH';
      severity = 'HIGH';
      explanation = `MVRV Z-Score: ${metrics.mvrv.toFixed(2)} (Overvalued - historically precedes corrections)`;
    } else if (metrics.mvrv < 0) {
      signal = 'BULLISH';
      severity = 'HIGH';
      explanation = `MVRV Z-Score: ${metrics.mvrv.toFixed(2)} (Undervalued - historically good entry zone)`;
    } else if (metrics.mvrv > 3) {
      signal = 'BEARISH';
      severity = 'MEDIUM';
      explanation = `MVRV Z-Score: ${metrics.mvrv.toFixed(2)} (Elevated - approaching overvalued territory)`;
    } else if (metrics.mvrv < 1) {
      signal = 'BULLISH';
      severity = 'MEDIUM';
      explanation = `MVRV Z-Score: ${metrics.mvrv.toFixed(2)} (Fair Value - historically good risk/reward)`;
    } else {
      explanation = `MVRV Z-Score: ${metrics.mvrv.toFixed(2)} (Neutral - market trading at equilibrium)`;
    }

    intel.push({
      metric: 'MVRV Z-Score',
      value: metrics.mvrv,
      signal,
      severity,
      explanation
    });
  }

  // 3. Miner Position Analysis
  if (metrics.minerPosition !== 0) {
    const isHigh = metrics.minerPosition > 10000000; // $10M in fees = high activity

    intel.push({
      metric: 'Miner Revenue',
      value: metrics.minerPosition,
      signal: isHigh ? 'NEUTRAL' : 'NEUTRAL', // Miner revenue is not directional
      severity: isHigh ? 'MEDIUM' : 'LOW',
      explanation: isHigh
        ? `Miner fee revenue: $${(metrics.minerPosition / 1000000).toFixed(1)}M (High network activity)`
        : `Miner fee revenue: $${(metrics.minerPosition / 1000000).toFixed(1)}M (Normal activity)`
    });
  }

  return intel;
}

/**
 * Get on-chain regime classification
 * Combines exchange flow + MVRV for macro bias
 */
export function getOnChainRegime(metrics: OnChainMetrics): {
  regime: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | 'OVERHEATED';
  confidence: number;
} {
  let score = 0; // +1 per bullish signal, -1 per bearish

  // Exchange flow (stronger signal)
  if (metrics.exchangeNetFlow < -1000) score += 2; // Strong outflow
  else if (metrics.exchangeNetFlow < 0) score += 1; // Weak outflow
  else if (metrics.exchangeNetFlow > 1000) score -= 2; // Strong inflow
  else if (metrics.exchangeNetFlow > 0) score -= 1; // Weak inflow

  // MVRV (weaker signal, but important for extremes)
  if (metrics.mvrv > 7) score -= 2; // Overvalued
  else if (metrics.mvrv > 3) score -= 1; // Elevated
  else if (metrics.mvrv < 0) score += 2; // Undervalued
  else if (metrics.mvrv < 1) score += 1; // Fair value

  // Classify
  if (score >= 3) return { regime: 'ACCUMULATION', confidence: Math.min(100, score * 20) };
  if (score <= -3) return { regime: 'DISTRIBUTION', confidence: Math.min(100, Math.abs(score) * 20) };
  if (metrics.mvrv > 7) return { regime: 'OVERHEATED', confidence: 80 };

  return { regime: 'NEUTRAL', confidence: 50 };
}

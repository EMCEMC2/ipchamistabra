/**
 * AGGR.TRADE INTELLIGENCE ANALYZER
 * Converts raw order flow data into actionable trading intelligence
 */

import {
  AggrStats,
  AggrLiquidation,
  AggrTrade,
  CascadeEvent,
  MarketPressure
} from './aggrService';
import { IntelItem } from '../types';

export interface TradingSignal {
  type: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number; // 0-100
  reasoning: string[];
  triggers: string[];
}

/**
 * Analyze CVD for trend signals
 */
export function analyzeCVD(stats: AggrStats): {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  reasoning: string;
} {
  const { cvd } = stats;
  const deltaPercent = (cvd.delta / stats.totalVolume) * 100;

  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let strength: 'weak' | 'moderate' | 'strong' = 'weak';
  let reasoning = '';

  if (Math.abs(deltaPercent) < 5) {
    trend = 'neutral';
    strength = 'weak';
    reasoning = `CVD balanced (${deltaPercent.toFixed(1)}% net pressure)`;
  } else if (deltaPercent > 0) {
    trend = 'bullish';
    if (deltaPercent > 20) {
      strength = 'strong';
      reasoning = `Strong buy pressure: ${deltaPercent.toFixed(1)}% net buying (CVD: ${(cvd.cumulativeDelta / 1000000).toFixed(1)}M)`;
    } else if (deltaPercent > 10) {
      strength = 'moderate';
      reasoning = `Moderate buy pressure: ${deltaPercent.toFixed(1)}% net buying`;
    } else {
      strength = 'weak';
      reasoning = `Slight buy pressure: ${deltaPercent.toFixed(1)}% net buying`;
    }
  } else {
    trend = 'bearish';
    const absDelta = Math.abs(deltaPercent);
    if (absDelta > 20) {
      strength = 'strong';
      reasoning = `Strong sell pressure: ${absDelta.toFixed(1)}% net selling (CVD: ${(cvd.cumulativeDelta / 1000000).toFixed(1)}M)`;
    } else if (absDelta > 10) {
      strength = 'moderate';
      reasoning = `Moderate sell pressure: ${absDelta.toFixed(1)}% net selling`;
    } else {
      strength = 'weak';
      reasoning = `Slight sell pressure: ${absDelta.toFixed(1)}% net selling`;
    }
  }

  return { trend, strength, reasoning };
}

/**
 * Analyze market pressure for signals
 */
export function analyzeMarketPressure(pressure: MarketPressure): IntelItem | null {
  if (pressure.strength === 'weak') return null;

  const severity: 'HIGH' | 'MEDIUM' | 'LOW' =
    pressure.strength === 'extreme' ? 'HIGH' :
    pressure.strength === 'strong' ? 'MEDIUM' : 'LOW';

  let title = '';
  let summary = '';

  if (pressure.dominantSide === 'buy') {
    title = 'Strong Buy Pressure Detected';
    summary = `${pressure.buyPressure.toFixed(1)}% buying dominance in last 60s. ` +
              `Market showing ${pressure.strength} bullish flow. ` +
              `Net pressure: +${pressure.netPressure.toFixed(1)}%`;
  } else if (pressure.dominantSide === 'sell') {
    title = 'Strong Sell Pressure Detected';
    summary = `${pressure.sellPressure.toFixed(1)}% selling dominance in last 60s. ` +
              `Market showing ${pressure.strength} bearish flow. ` +
              `Net pressure: ${pressure.netPressure.toFixed(1)}%`;
  } else {
    return null;
  }

  return {
    id: `pressure-${Date.now()}`,
    title,
    severity,
    category: 'ORDERFLOW',
    timestamp: Date.now(),
    source: 'Aggr.trade',
    summary,
    btcSentiment: pressure.dominantSide === 'buy' ? 'BULLISH' : 'BEARISH'
  };
}

/**
 * Analyze liquidation event
 */
export function analyzeLiquidation(liq: AggrLiquidation): IntelItem | null {
  // Only alert on large liquidations (>$1M)
  if (liq.usdValue < 1000000) return null;

  const severity: 'HIGH' | 'MEDIUM' | 'LOW' =
    liq.usdValue > 10000000 ? 'HIGH' :
    liq.usdValue > 5000000 ? 'MEDIUM' : 'LOW';

  const title = `Large ${liq.side === 'long' ? 'Long' : 'Short'} Liquidation`;
  const summary =
    `$${(liq.usdValue / 1000000).toFixed(2)}M ${liq.side} liquidated on ${liq.exchange} at $${liq.price.toFixed(0)}. ` +
    `${liq.amount.toFixed(2)} BTC forced ${liq.side === 'long' ? 'sold' : 'bought'}. ` +
    `Watch for ${liq.side === 'long' ? 'downside' : 'upside'} cascade risk.`;

  return {
    id: `liq-${liq.timestamp}`,
    title,
    severity,
    category: 'LIQUIDATION',
    timestamp: liq.timestamp,
    source: 'Aggr.trade',
    summary,
    btcSentiment: liq.side === 'long' ? 'BEARISH' : 'BULLISH'
  };
}

/**
 * Analyze liquidation cascade
 */
export function analyzeCascade(cascade: CascadeEvent): IntelItem {
  const duration = (cascade.endTime - cascade.startTime) / 1000 / 60; // minutes
  const severity: 'HIGH' | 'MEDIUM' | 'LOW' =
    cascade.severity === 'extreme' || cascade.severity === 'major' ? 'HIGH' :
    cascade.severity === 'moderate' ? 'MEDIUM' : 'LOW';

  const title = `${cascade.severity.toUpperCase()} Liquidation Cascade`;
  const summary =
    `$${(cascade.totalLiquidated / 1000000).toFixed(1)}M ${cascade.side}s liquidated ` +
    `across ${cascade.exchanges.length} exchanges in ${duration.toFixed(1)} minutes. ` +
    `Exchanges: ${cascade.exchanges.join(', ')}. ` +
    `Expect ${cascade.side === 'long' ? 'continued selling pressure' : 'short covering rally'}.`;

  return {
    id: `cascade-${cascade.startTime}`,
    title,
    severity,
    category: 'LIQUIDATION',
    timestamp: cascade.endTime,
    source: 'Aggr.trade',
    summary,
    btcSentiment: cascade.side === 'long' ? 'BEARISH' : 'BULLISH'
  };
}

/**
 * Analyze large trade
 */
export function analyzeLargeTrade(trade: AggrTrade): IntelItem | null {
  // Only alert on very large trades (>$5M)
  if (trade.usdValue < 5000000) return null;

  const severity: 'HIGH' | 'MEDIUM' | 'LOW' =
    trade.usdValue > 20000000 ? 'HIGH' :
    trade.usdValue > 10000000 ? 'MEDIUM' : 'LOW';

  const title = `Whale ${trade.side === 'buy' ? 'Buy' : 'Sell'} Detected`;
  const summary =
    `$${(trade.usdValue / 1000000).toFixed(2)}M market ${trade.side} on ${trade.exchange}. ` +
    `${trade.amount.toFixed(2)} BTC at $${trade.price.toFixed(0)}. ` +
    `${trade.side === 'buy' ? 'Strong demand signal' : 'Large supply hitting market'}.`;

  return {
    id: `whale-${trade.timestamp}`,
    title,
    severity,
    category: 'ORDERFLOW',
    timestamp: trade.timestamp,
    source: 'Aggr.trade',
    summary,
    btcSentiment: trade.side === 'buy' ? 'BULLISH' : 'BEARISH'
  };
}

/**
 * Analyze exchange flow imbalance
 */
export function analyzeExchangeFlow(stats: AggrStats): IntelItem | null {
  if (stats.exchanges.length === 0) return null;

  // Find dominant exchange
  const dominant = stats.exchanges[0];
  if (!dominant || dominant.dominance < 40) return null; // Need >40% dominance

  const netFlowPercent = (dominant.netFlow / (dominant.buyVolume + dominant.sellVolume)) * 100;

  if (Math.abs(netFlowPercent) < 20) return null; // Need >20% imbalance

  const severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  const title = `${dominant.exchange} Flow Imbalance`;
  const summary =
    `${dominant.exchange} showing ${Math.abs(netFlowPercent).toFixed(1)}% ` +
    `${netFlowPercent > 0 ? 'net buying' : 'net selling'} ` +
    `(${dominant.dominance.toFixed(1)}% of market volume). ` +
    `${netFlowPercent > 0 ? 'Bullish' : 'Bearish'} signal from leading exchange.`;

  return {
    id: `flow-${Date.now()}`,
    title,
    severity,
    category: 'ORDERFLOW',
    timestamp: Date.now(),
    source: 'Aggr.trade',
    summary,
    btcSentiment: netFlowPercent > 0 ? 'BULLISH' : 'BEARISH'
  };
}

/**
 * Generate comprehensive trading signal
 */
export function generateTradingSignal(stats: AggrStats): TradingSignal {
  const cvdAnalysis = analyzeCVD(stats);
  const pressure = stats.pressure;

  let score = 0; // -100 to +100
  const reasoning: string[] = [];
  const triggers: string[] = [];

  // CVD Analysis (40% weight)
  if (cvdAnalysis.trend === 'bullish') {
    const cvdScore = cvdAnalysis.strength === 'strong' ? 40 : cvdAnalysis.strength === 'moderate' ? 25 : 15;
    score += cvdScore;
    reasoning.push(`CVD: ${cvdAnalysis.reasoning}`);
    triggers.push('Positive CVD');
  } else if (cvdAnalysis.trend === 'bearish') {
    const cvdScore = cvdAnalysis.strength === 'strong' ? -40 : cvdAnalysis.strength === 'moderate' ? -25 : -15;
    score += cvdScore;
    reasoning.push(`CVD: ${cvdAnalysis.reasoning}`);
    triggers.push('Negative CVD');
  }

  // Market Pressure (30% weight)
  if (pressure.dominantSide === 'buy') {
    const pressureScore =
      pressure.strength === 'extreme' ? 30 :
      pressure.strength === 'strong' ? 20 :
      pressure.strength === 'moderate' ? 10 : 5;
    score += pressureScore;
    reasoning.push(`Buy Pressure: ${pressure.buyPressure.toFixed(1)}% (${pressure.strength})`);
    triggers.push('Buy Pressure');
  } else if (pressure.dominantSide === 'sell') {
    const pressureScore =
      pressure.strength === 'extreme' ? -30 :
      pressure.strength === 'strong' ? -20 :
      pressure.strength === 'moderate' ? -10 : -5;
    score += pressureScore;
    reasoning.push(`Sell Pressure: ${pressure.sellPressure.toFixed(1)}% (${pressure.strength})`);
    triggers.push('Sell Pressure');
  }

  // Liquidation Risk (20% weight)
  if (stats.liquidationVolume > 0) {
    const liqPercent = (stats.liquidationVolume / stats.totalVolume) * 100;
    if (liqPercent > 10) {
      const recentLongs = stats.recentLiquidations.filter(l => l.side === 'long').length;
      const recentShorts = stats.recentLiquidations.filter(l => l.side === 'short').length;

      if (recentLongs > recentShorts) {
        score -= 20; // Long liquidations = bearish
        reasoning.push(`Liquidation Cascade: ${recentLongs} long liqs (bearish)`);
        triggers.push('Long Liquidations');
      } else if (recentShorts > recentLongs) {
        score += 20; // Short liquidations = bullish
        reasoning.push(`Liquidation Cascade: ${recentShorts} short liqs (bullish)`);
        triggers.push('Short Liquidations');
      }
    }
  }

  // Exchange Flow (10% weight)
  if (stats.exchanges.length > 0) {
    const topExchange = stats.exchanges[0];
    const netFlowPercent = (topExchange.netFlow / (topExchange.buyVolume + topExchange.sellVolume)) * 100;

    if (netFlowPercent > 15) {
      score += 10;
      reasoning.push(`${topExchange.exchange}: +${netFlowPercent.toFixed(1)}% net buying`);
    } else if (netFlowPercent < -15) {
      score -= 10;
      reasoning.push(`${topExchange.exchange}: ${netFlowPercent.toFixed(1)}% net selling`);
    }
  }

  // Determine signal
  let type: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  const confidence = Math.min(Math.abs(score), 100);

  if (score > 30) {
    type = 'LONG';
  } else if (score < -30) {
    type = 'SHORT';
  }

  return {
    type,
    confidence,
    reasoning,
    triggers
  };
}

/**
 * Generate intelligence summary
 */
export function generateIntelligenceSummary(stats: AggrStats): string {
  const cvdAnalysis = analyzeCVD(stats);
  const signal = generateTradingSignal(stats);

  const parts: string[] = [];

  // Overall sentiment
  parts.push(`**Market Flow: ${signal.type}** (${signal.confidence}% confidence)`);

  // CVD
  parts.push(`\n**CVD:** ${cvdAnalysis.reasoning}`);

  // Pressure
  parts.push(`\n**Pressure:** ${stats.pressure.buyPressure.toFixed(1)}% buys / ${stats.pressure.sellPressure.toFixed(1)}% sells (${stats.pressure.strength})`);

  // Volume
  parts.push(`\n**Volume:** $${(stats.totalVolume / 1000000).toFixed(2)}M (60s)`);

  // Liquidations
  if (stats.liquidationCount > 0) {
    parts.push(`\n**Liquidations:** ${stats.liquidationCount} events, $${(stats.liquidationVolume / 1000000).toFixed(2)}M total`);
  }

  // Top exchange
  if (stats.exchanges.length > 0) {
    const top = stats.exchanges[0];
    parts.push(`\n**Top Exchange:** ${top.exchange} (${top.dominance.toFixed(1)}% volume)`);
  }

  // Reasoning
  if (signal.reasoning.length > 0) {
    parts.push(`\n\n**Analysis:**\n${signal.reasoning.map(r => `- ${r}`).join('\n')}`);
  }

  return parts.join('');
}

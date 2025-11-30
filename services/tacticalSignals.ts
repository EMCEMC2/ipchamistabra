/**
 * TACTICAL V2 LIVE SIGNAL GENERATOR
 * Implements the same confluence scoring logic used in backtests
 * NOW WITH ORDER FLOW INTEGRATION for enhanced accuracy
 * This ensures backtest results are representative of live performance
 */

import { ChartDataPoint, TradeSignal } from '../types';
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateADX,
  calculateSMA,
  calculateRMA,
  calculateStdev,
  calculateTR
} from '../utils/technicalAnalysis';
import { AggrStats } from './aggrService';
import { generateTradingSignal, analyzeCVD } from './aggrIntelligence';

export interface TacticalSignalConfig {
  minScoreLowVol: number;    // Default: 5.5
  minScoreNormal: number;    // Default: 4.5
  minScoreHighVol: number;   // Default: 4.0
  cooldownLowVol: number;    // Default: 12 bars
  cooldownNormal: number;    // Default: 8 bars
  cooldownHighVol: number;   // Default: 5 bars
  useOrderFlow: boolean;     // NEW: Enable order flow integration
  orderFlowWeight: number;   // NEW: 0.0-1.0 weight for order flow (0.3 = 30%)
}

const DEFAULT_CONFIG: TacticalSignalConfig = {
  minScoreLowVol: 5.5,
  minScoreNormal: 4.5,
  minScoreHighVol: 4.0,
  cooldownLowVol: 12,
  cooldownNormal: 8,
  cooldownHighVol: 5,
  useOrderFlow: true,    // Enable by default
  orderFlowWeight: 0.3   // 30% weight for order flow
};

export interface TacticalSignalResult {
  signal: TradeSignal | null;
  bullScore: number;
  bearScore: number;
  regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL';
  reasoning: string[];
  lastSignalBar: number; // Return updated state
}

/**
 * FIX #4: Slippage model for realistic execution simulation
 * Applies basis points slippage based on order type and volatility
 */
interface SlippageConfig {
  marketOrderBps: number;  // Market order slippage (default: 3 bps)
  stopOrderBps: number;    // Stop loss slippage (worse fills) (default: 5 bps)
  limitOrderBps: number;   // Limit target slippage (better fills possible) (default: 2 bps)
  volMultiplier: number;   // Volatility scaling factor (default: 2.0)
}

const DEFAULT_SLIPPAGE: SlippageConfig = {
  marketOrderBps: 3,
  stopOrderBps: 5,
  limitOrderBps: 2,
  volMultiplier: 2.0
};

/**
 * Apply slippage to a price based on order type and market conditions
 * @param price - Base price
 * @param side - BUY or SELL
 * @param orderType - MARKET, STOP, or LIMIT
 * @param atr - Current ATR (for volatility adjustment)
 * @param avgPrice - Average price (for volatility normalization)
 */
function applySlippage(
  price: number,
  side: 'BUY' | 'SELL',
  orderType: 'MARKET' | 'STOP' | 'LIMIT',
  atr: number,
  avgPrice: number,
  config: SlippageConfig = DEFAULT_SLIPPAGE
): number {
  // Base slippage in basis points
  const baseBps = orderType === 'STOP' ? config.stopOrderBps :
                  orderType === 'LIMIT' ? config.limitOrderBps :
                  config.marketOrderBps;

  // Volatility adjustment (high ATR = more slippage)
  const volRatio = atr / (avgPrice * 0.02);  // Normalize to 2% baseline ATR
  const adjustedBps = baseBps * Math.min(volRatio * config.volMultiplier, 3.0);  // Cap at 3x

  // Convert basis points to decimal
  const slippageDecimal = adjustedBps / 10000;
  const slippage = price * slippageDecimal;

  // Apply slippage direction (buy = worse = higher, sell = worse = lower)
  return side === 'BUY' ? price + slippage : price - slippage;
}

/**
 * Generate Tactical v2 signal from current market data
 * Uses exact same logic as backtest for consistency
 * NOW ENHANCED with Order Flow integration for better accuracy
 *
 * @param chartData - OHLCV candle data (minimum 200 candles)
 * @param config - Configuration for signal generation
 * @param orderFlowStats - OPTIONAL: Real-time order flow data (CVD, liquidations, pressure)
 * @param lastSignalBar - State from previous run (default: -999)
 */
export function generateTacticalSignal(
  chartData: ChartDataPoint[],
  config: TacticalSignalConfig = DEFAULT_CONFIG,
  orderFlowStats?: AggrStats | null,
  lastSignalBar: number = -999
): TacticalSignalResult {
  if (!chartData || chartData.length < 200) {
    return {
      signal: null,
      bullScore: 0,
      bearScore: 0,
      regime: 'NORMAL',
      reasoning: ['Insufficient data (need 200+ candles)'],
      lastSignalBar
    };
  }

  const closes = chartData.map(d => d.close);
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);

  // Calculate indicators
  const emaFast_Low = calculateEMA(closes, 27);
  const emaFast_Norm = calculateEMA(closes, 21);
  const emaFast_High = calculateEMA(closes, 15);

  const emaSlow_Low = calculateEMA(closes, 72);
  const emaSlow_Norm = calculateEMA(closes, 55);
  const emaSlow_High = calculateEMA(closes, 39);

  const ema200 = calculateEMA(closes, 200);
  const rsiRaw = calculateRSI(closes, 14);
  // RSI array is shorter than closes by `period` elements
  // Pad with NaN at the start so rsi[i] aligns with closes[i]
  const rsi = new Array(14).fill(NaN).concat(rsiRaw);

  // Regime detection
  const tr = calculateTR(chartData);
  const atr = calculateRMA(tr, 14);
  const atrSMA = calculateSMA(atr, 100);
  const atrStd = calculateStdev(atr, 100);

  const i = chartData.length - 1; // Current bar index

  const normATR = atrStd[i] && atrStd[i] > 0 ? (atr[i] - atrSMA[i]) / atrStd[i] : 0;
  const regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' =
    normATR < -0.5 ? 'LOW_VOL' :
    normATR > 1.0 ? 'HIGH_VOL' : 'NORMAL';

  const minScore = regime === 'LOW_VOL' ? config.minScoreLowVol :
                   regime === 'HIGH_VOL' ? config.minScoreHighVol :
                   config.minScoreNormal;

  const cooldown = regime === 'LOW_VOL' ? config.cooldownLowVol :
                   regime === 'HIGH_VOL' ? config.cooldownHighVol :
                   config.cooldownNormal;

  const valFast = regime === 'LOW_VOL' ? emaFast_Low[i] :
                  regime === 'HIGH_VOL' ? emaFast_High[i] :
                  emaFast_Norm[i];

  const valSlow = regime === 'LOW_VOL' ? emaSlow_Low[i] :
                  regime === 'HIGH_VOL' ? emaSlow_High[i] :
                  emaSlow_Norm[i];

  let bullScore = 0;
  let bearScore = 0;
  const reasoning: string[] = [];

  // 1. Trend (1.0 point)
  if (closes[i] > ema200[i]) {
    bullScore += 1.0;
    reasoning.push(`Price above EMA200 ($${ema200[i].toFixed(0)}) +1.0 bull`);
  } else {
    bearScore += 1.0;
    reasoning.push(`Price below EMA200 ($${ema200[i].toFixed(0)}) +1.0 bear`);
  }

  // 2. Alignment (1.5 points)
  if (valFast > valSlow) {
    bullScore += 1.5;
    reasoning.push(`Fast EMA > Slow EMA (aligned bullish) +1.5 bull`);
  } else {
    bearScore += 1.5;
    reasoning.push(`Fast EMA < Slow EMA (aligned bearish) +1.5 bear`);
  }

  // 3. RSI (0.5-1.0 points) - with NaN safety
  const rsiVal = Number.isFinite(rsi[i]) ? rsi[i] : 50; // Default to neutral if NaN
  if (rsiVal > 55) {
    bullScore += 0.5;
    reasoning.push(`RSI ${rsiVal.toFixed(1)} > 55 +0.5 bull`);
  }
  if (rsiVal < 45) {
    bearScore += 0.5;
    reasoning.push(`RSI ${rsiVal.toFixed(1)} < 45 +0.5 bear`);
  }
  if (rsiVal > 65) {
    bullScore += 0.5;
    reasoning.push(`RSI ${rsiVal.toFixed(1)} > 65 +0.5 bull (strong)`);
  }
  if (rsiVal < 35) {
    bearScore += 0.5;
    reasoning.push(`RSI ${rsiVal.toFixed(1)} < 35 +0.5 bear (strong)`);
  }

  // 4. Crossover (2.5 points) - strongest signal
  const prevFast = regime === 'LOW_VOL' ? emaFast_Low[i - 1] :
                   regime === 'HIGH_VOL' ? emaFast_High[i - 1] :
                   emaFast_Norm[i - 1];

  const prevSlow = regime === 'LOW_VOL' ? emaSlow_Low[i - 1] :
                   regime === 'HIGH_VOL' ? emaSlow_High[i - 1] :
                   emaSlow_Norm[i - 1];

  if (prevFast <= prevSlow && valFast > valSlow) {
    bullScore += 2.5;
    reasoning.push(`Golden Cross detected! +2.5 bull`);
  }
  if (prevFast >= prevSlow && valFast < valSlow) {
    bearScore += 2.5;
    reasoning.push(`Death Cross detected! +2.5 bear`);
  }

  const barsSinceLast = i - lastSignalBar;
  reasoning.push(`Regime: ${regime} | Min Score: ${minScore} | Cooldown: ${barsSinceLast}/${cooldown} bars`);
  reasoning.push(`Bull Score: ${bullScore.toFixed(1)} | Bear Score: ${bearScore.toFixed(1)}`);

  // ORDER FLOW INTEGRATION (NEW)
  if (config.useOrderFlow && orderFlowStats) {
    // Check if order flow is banned/rate-limited before using stale data
    if (orderFlowStats.banned?.isBanned) {
      const remainingMin = orderFlowStats.banned.remainingMinutes ?? 0;
      reasoning.push(`[ORDER FLOW] Data unavailable (rate limit, ~${remainingMin}min remaining). Proceeding without flow analysis.`);
    } else if (orderFlowStats.lastUpdate && (Date.now() - orderFlowStats.lastUpdate) > 30000) {
      // Staleness check: Skip order flow if data is older than 30 seconds
      const staleSecs = Math.floor((Date.now() - orderFlowStats.lastUpdate) / 1000);
      reasoning.push(`[ORDER FLOW] Data stale (${staleSecs}s old, threshold: 30s). Proceeding without flow analysis.`);
    } else {
      try {
        const flowSignal = generateTradingSignal(orderFlowStats);
        const cvdAnalysis = analyzeCVD(orderFlowStats);

        // Add order flow confluence to scores
        if (flowSignal.type === 'LONG' && flowSignal.confidence > 30) {
          const flowBoost = (flowSignal.confidence / 100) * config.orderFlowWeight * 6.0; // Max 1.8 pts
          bullScore += flowBoost;
          reasoning.push(`Order Flow LONG: +${flowBoost.toFixed(2)} (CVD: ${cvdAnalysis.trend}, Pressure: ${orderFlowStats.pressure.dominantSide})`);
        } else if (flowSignal.type === 'SHORT' && flowSignal.confidence > 30) {
          const flowBoost = (flowSignal.confidence / 100) * config.orderFlowWeight * 6.0;
          bearScore += flowBoost;
          reasoning.push(`Order Flow SHORT: +${flowBoost.toFixed(2)} (CVD: ${cvdAnalysis.trend}, Pressure: ${orderFlowStats.pressure.dominantSide})`);
        }

        // CRITICAL: Liquidation cascade override
        if (orderFlowStats.liquidationVolume > 50000000) {
          const longLiqs = orderFlowStats.recentLiquidations.filter(l => l.side === 'long').length;
          const shortLiqs = orderFlowStats.recentLiquidations.filter(l => l.side === 'short').length;

          if (longLiqs > shortLiqs * 2 && longLiqs > 5) {
            // Massive long liquidations -> bearish override
            bearScore += 3.0;
            reasoning.push(`LIQUIDATION CASCADE: ${longLiqs} long liqs ($${(orderFlowStats.liquidationVolume / 1000000).toFixed(1)}M) -> BEARISH`);
          } else if (shortLiqs > longLiqs * 2 && shortLiqs > 5) {
            // Massive short liquidations -> bullish override
            bullScore += 3.0;
            reasoning.push(`SHORT SQUEEZE: ${shortLiqs} short liqs ($${(orderFlowStats.liquidationVolume / 1000000).toFixed(1)}M) -> BULLISH`);
          }
        }

        // Extreme pressure override
        if (orderFlowStats.pressure.strength === 'extreme') {
          if (orderFlowStats.pressure.dominantSide === 'buy') {
            bullScore += 1.5;
            reasoning.push(`EXTREME BUY PRESSURE: ${orderFlowStats.pressure.buyPressure.toFixed(1)}% -> +1.5 bull`);
          } else if (orderFlowStats.pressure.dominantSide === 'sell') {
            bearScore += 1.5;
            reasoning.push(`EXTREME SELL PRESSURE: ${orderFlowStats.pressure.sellPressure.toFixed(1)}% -> +1.5 bear`);
          }
        }

        // Update reasoning with final scores after order flow
        reasoning.push(`Final Scores (with Order Flow): Bull ${bullScore.toFixed(1)} | Bear ${bearScore.toFixed(1)}`);
      } catch (error) {
        console.error('[Tactical v2] Order flow integration error:', error);
        reasoning.push('[ORDER FLOW] Integration error - proceeding without flow analysis');
      }
    }
  }

  // Check if signal threshold met
  if (bullScore >= minScore && bearScore < 2 && barsSinceLast > cooldown) {
    // Calculate entry, stop, target based on current price and ATR
    const currentPrice = closes[i];
    const currentATR = atr[i];
    const stopDistance = currentATR * 1.5; // 1.5x ATR for stop
    const targetDistance = currentATR * 3.0; // 3x ATR for target

    // Base prices (without slippage)
    const baseEntryPrice = currentPrice;
    const baseStopPrice = currentPrice - stopDistance;
    const baseTargetPrice = currentPrice + targetDistance;

    // FIX #4: Apply slippage to make prices realistic
    const entryPrice = applySlippage(baseEntryPrice, 'BUY', 'MARKET', currentATR, currentPrice);
    const stopPrice = applySlippage(baseStopPrice, 'SELL', 'STOP', currentATR, currentPrice);
    const targetPrice = applySlippage(baseTargetPrice, 'SELL', 'LIMIT', currentATR, currentPrice);

    // FIX #2: Calculate R:R dynamically from actual distances (with slippage)
    const actualRiskDistance = Math.abs(entryPrice - stopPrice);
    const actualRewardDistance = Math.abs(targetPrice - entryPrice);
    const calculatedRR = actualRewardDistance / actualRiskDistance;

    const signal: TradeSignal = {
      id: `tactical-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      pair: 'BTCUSDT',
      type: 'LONG',
      entryZone: entryPrice.toFixed(2),
      invalidation: stopPrice.toFixed(2),
      targets: [targetPrice.toFixed(2)],
      riskRewardRatio: parseFloat(calculatedRR.toFixed(2)), // Dynamic calculation with slippage
      confidence: Math.min(Math.round((bullScore / minScore) * 100), 95),
      regime: regime,
      reasoning: `Tactical v2: ${reasoning.join(' | ')}`,
      status: 'ACTIVE',
      timestamp: Date.now(),
      source: 'tactical', // Rule-based system - trusted
      approvalStatus: 'active' // No human approval needed for tactical signals
    };

    return {
      signal,
      bullScore,
      bearScore,
      regime,
      reasoning,
      lastSignalBar: i // Update last signal bar
    };
  } else if (bearScore >= minScore && bullScore < 2 && barsSinceLast > cooldown) {
    const currentPrice = closes[i];
    const currentATR = atr[i];
    const stopDistance = currentATR * 1.5;
    const targetDistance = currentATR * 3.0;

    // Base prices (without slippage)
    const baseEntryPrice = currentPrice;
    const baseStopPrice = currentPrice + stopDistance;
    const baseTargetPrice = currentPrice - targetDistance;

    // FIX #4: Apply slippage to make prices realistic
    const entryPrice = applySlippage(baseEntryPrice, 'SELL', 'MARKET', currentATR, currentPrice);
    const stopPrice = applySlippage(baseStopPrice, 'BUY', 'STOP', currentATR, currentPrice);
    const targetPrice = applySlippage(baseTargetPrice, 'BUY', 'LIMIT', currentATR, currentPrice);

    // FIX #2: Calculate R:R dynamically from actual distances (with slippage)
    const actualRiskDistance = Math.abs(entryPrice - stopPrice);
    const actualRewardDistance = Math.abs(targetPrice - entryPrice);
    const calculatedRR = actualRewardDistance / actualRiskDistance;

    const signal: TradeSignal = {
      id: `tactical-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      pair: 'BTCUSDT',
      type: 'SHORT',
      entryZone: entryPrice.toFixed(2),
      invalidation: stopPrice.toFixed(2),
      targets: [targetPrice.toFixed(2)],
      riskRewardRatio: parseFloat(calculatedRR.toFixed(2)), // Dynamic calculation with slippage
      confidence: Math.min(Math.round((bearScore / minScore) * 100), 95),
      regime: regime,
      reasoning: `Tactical v2: ${reasoning.join(' | ')}`,
      status: 'ACTIVE',
      timestamp: Date.now(),
      source: 'tactical', // Rule-based system - trusted
      approvalStatus: 'active' // No human approval needed for tactical signals
    };

    return {
      signal,
      bullScore,
      bearScore,
      regime,
      reasoning,
      lastSignalBar: i // Update last signal bar
    };
  }

  // No signal
  return {
    signal: null,
    bullScore,
    bearScore,
    regime,
    reasoning,
    lastSignalBar // Return unchanged
  };
}



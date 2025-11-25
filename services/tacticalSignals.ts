/**
 * TACTICAL V2 LIVE SIGNAL GENERATOR
 * Implements the same confluence scoring logic used in backtests
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

export interface TacticalSignalConfig {
  minScoreLowVol: number;    // Default: 5.5
  minScoreNormal: number;    // Default: 4.5
  minScoreHighVol: number;   // Default: 4.0
  cooldownLowVol: number;    // Default: 12 bars
  cooldownNormal: number;    // Default: 8 bars
  cooldownHighVol: number;   // Default: 5 bars
}

const DEFAULT_CONFIG: TacticalSignalConfig = {
  minScoreLowVol: 5.5,
  minScoreNormal: 4.5,
  minScoreHighVol: 4.0,
  cooldownLowVol: 12,
  cooldownNormal: 8,
  cooldownHighVol: 5
};

export interface TacticalSignalResult {
  signal: TradeSignal | null;
  bullScore: number;
  bearScore: number;
  regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL';
  reasoning: string[];
}

let lastSignalBar = -999; // Track last signal to enforce cooldown

/**
 * Generate Tactical v2 signal from current market data
 * Uses exact same logic as backtest for consistency
 */
export function generateTacticalSignal(
  chartData: ChartDataPoint[],
  config: TacticalSignalConfig = DEFAULT_CONFIG
): TacticalSignalResult {
  if (chartData.length < 200) {
    return {
      signal: null,
      bullScore: 0,
      bearScore: 0,
      regime: 'NORMAL',
      reasoning: ['Insufficient data (need 200+ candles)']
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
  const rsi = calculateRSI(closes, 14);

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

  // 3. RSI (0.5-1.0 points)
  if (rsi[i] > 55) {
    bullScore += 0.5;
    reasoning.push(`RSI ${rsi[i].toFixed(1)} > 55 +0.5 bull`);
  }
  if (rsi[i] < 45) {
    bearScore += 0.5;
    reasoning.push(`RSI ${rsi[i].toFixed(1)} < 45 +0.5 bear`);
  }
  if (rsi[i] > 65) {
    bullScore += 0.5;
    reasoning.push(`RSI ${rsi[i].toFixed(1)} > 65 +0.5 bull (strong)`);
  }
  if (rsi[i] < 35) {
    bearScore += 0.5;
    reasoning.push(`RSI ${rsi[i].toFixed(1)} < 35 +0.5 bear (strong)`);
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

  // Check if signal threshold met
  if (bullScore >= minScore && bearScore < 2 && barsSinceLast > cooldown) {
    lastSignalBar = i;

    // Calculate entry, stop, target based on current price and ATR
    const currentPrice = closes[i];
    const currentATR = atr[i];
    const stopDistance = currentATR * 1.5; // 1.5x ATR for stop
    const targetDistance = currentATR * 3.0; // 3x ATR for target (2:1 R:R)

    const signal: TradeSignal = {
      id: `tactical-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pair: 'BTCUSDT',
      type: 'LONG',
      entryZone: currentPrice.toFixed(2),
      invalidation: (currentPrice - stopDistance).toFixed(2),
      targets: [(currentPrice + targetDistance).toFixed(2)],
      riskRewardRatio: 2.0,
      confidence: Math.min(Math.round((bullScore / minScore) * 100), 95),
      regime: regime,
      reasoning: `Tactical v2: ${reasoning.join(' | ')}`,
      status: 'ACTIVE',
      timestamp: Date.now()
    };

    return {
      signal,
      bullScore,
      bearScore,
      regime,
      reasoning
    };
  } else if (bearScore >= minScore && bullScore < 2 && barsSinceLast > cooldown) {
    lastSignalBar = i;

    const currentPrice = closes[i];
    const currentATR = atr[i];
    const stopDistance = currentATR * 1.5;
    const targetDistance = currentATR * 3.0;

    const signal: TradeSignal = {
      id: `tactical-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pair: 'BTCUSDT',
      type: 'SHORT',
      entryZone: currentPrice.toFixed(2),
      invalidation: (currentPrice + stopDistance).toFixed(2),
      targets: [(currentPrice - targetDistance).toFixed(2)],
      riskRewardRatio: 2.0,
      confidence: Math.min(Math.round((bearScore / minScore) * 100), 95),
      regime: regime,
      reasoning: `Tactical v2: ${reasoning.join(' | ')}`,
      status: 'ACTIVE',
      timestamp: Date.now()
    };

    return {
      signal,
      bullScore,
      bearScore,
      regime,
      reasoning
    };
  }

  // No signal
  return {
    signal: null,
    bullScore,
    bearScore,
    regime,
    reasoning
  };
}

/**
 * Reset cooldown (useful for testing or manual override)
 */
export function resetSignalCooldown(): void {
  lastSignalBar = -999;
}

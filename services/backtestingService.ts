/**
 * HISTORICAL BACKTESTING ENGINE
 * Tests Tactical v2 strategy on past data
 * Calculates win rate, Sharpe ratio, max drawdown
 */

import { ChartDataPoint } from '../types';
import { calculateEMA, calculateRSI, calculateATR, calculateADX, calculateSMA, calculateRMA, calculateStdev, calculateTR } from '../utils/technicalAnalysis';

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  type: 'LONG' | 'SHORT';
  pnl: number;
  pnlPercent: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIMEOUT';
}

export interface BacktestResults {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number; // Total wins / Total losses
  maxDrawdown: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equity: number[]; // Equity curve
}

/**
 * Fetch historical candles from Binance
 */
export async function fetchHistoricalCandles(
  symbol: string = 'BTCUSDT',
  interval: string = '15m',
  days: number = 30
): Promise<ChartDataPoint[]> {
  const limit = Math.min(1000, days * 96); // 96 15-min candles per day
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  if (import.meta.env.DEV) {
    console.log(`[Backtest] Fetching ${limit} candles (${days} days) for ${symbol}...`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance API failed: ${response.status}`);
    }

    const data = await response.json();

    const candles: ChartDataPoint[] = data.map((d: any[]) => ({
      time: d[0] / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));

    if (import.meta.env.DEV) {
      console.log(`[Backtest] Fetched ${candles.length} candles`);
    }
    return candles;
  } catch (error) {
    console.error('[Backtest] Failed to fetch historical data:', error);
    return [];
  }
}

/**
 * Run Tactical v2 backtest on historical data
 */
export function backtestTacticalV2(
  data: ChartDataPoint[],
  params: {
    stopLossPercent: number; // e.g., 1.5 = 1.5% SL
    takeProfitPercent: number; // e.g., 3.0 = 3.0% TP
    maxHoldBars: number; // e.g., 96 = 24 hours for 15m chart
  } = {
    stopLossPercent: 1.5,
    takeProfitPercent: 3.0,
    maxHoldBars: 96
  }
): BacktestResults {
  if (data.length < 200) {
    throw new Error('Insufficient data for backtesting (need at least 200 candles)');
  }

  if (import.meta.env.DEV) {
    console.log(`[Backtest] Running Tactical v2 on ${data.length} candles...`);
    console.log(`[Backtest] Params: SL=${params.stopLossPercent}%, TP=${params.takeProfitPercent}%, MaxHold=${params.maxHoldBars} bars`);
  }

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  // Calculate indicators (same as ChartPanel.tsx)
  const emaFast_Low = calculateEMA(closes, 27);
  const emaFast_Norm = calculateEMA(closes, 21);
  const emaFast_High = calculateEMA(closes, 15);

  const emaSlow_Low = calculateEMA(closes, 72);
  const emaSlow_Norm = calculateEMA(closes, 55);
  const emaSlow_High = calculateEMA(closes, 39);

  const ema200 = calculateEMA(closes, 200);
  const rsi = calculateRSI(closes, 14);

  // Regime detection
  const tr = calculateTR(data);
  const atr = calculateRMA(tr, 14);
  const atrSMA = calculateSMA(atr, 100);
  const atrStd = calculateStdev(atr, 100);

  const trades: BacktestTrade[] = [];
  let currentTrade: BacktestTrade | null = null;
  let equity = 10000; // Starting capital
  const equityCurve: number[] = [equity];

  let lastSignalBar = -999;

  for (let i = 200; i < data.length; i++) {
    // If in trade, check exit conditions
    if (currentTrade) {
      const trade = currentTrade; // Capture for closure safety
      const holdBars = i - data.findIndex(d => d.time === trade.entryTime);
      const currentPrice = data[i].close;
      const currentHigh = data[i].high;
      const currentLow = data[i].low;

      let exitTriggered = false;
      let exitReason: BacktestTrade['exitReason'] = 'TIMEOUT';
      let exitPrice = currentPrice;

      if (currentTrade.type === 'LONG') {
        // Check SL (low of bar)
        const slPrice = currentTrade.entryPrice * (1 - params.stopLossPercent / 100);
        if (currentLow <= slPrice) {
          exitTriggered = true;
          exitReason = 'STOP_LOSS';
          exitPrice = slPrice;
        }

        // Check TP (high of bar)
        const tpPrice = currentTrade.entryPrice * (1 + params.takeProfitPercent / 100);
        if (!exitTriggered && currentHigh >= tpPrice) {
          exitTriggered = true;
          exitReason = 'TAKE_PROFIT';
          exitPrice = tpPrice;
        }
      } else {
        // SHORT
        const slPrice = currentTrade.entryPrice * (1 + params.stopLossPercent / 100);
        if (currentHigh >= slPrice) {
          exitTriggered = true;
          exitReason = 'STOP_LOSS';
          exitPrice = slPrice;
        }

        const tpPrice = currentTrade.entryPrice * (1 - params.takeProfitPercent / 100);
        if (!exitTriggered && currentLow <= tpPrice) {
          exitTriggered = true;
          exitReason = 'TAKE_PROFIT';
          exitPrice = tpPrice;
        }
      }

      // Timeout
      if (!exitTriggered && holdBars >= params.maxHoldBars) {
        exitTriggered = true;
        exitReason = 'TIMEOUT';
      }

      if (exitTriggered) {
        // Close trade
        const pnl = currentTrade.type === 'LONG'
          ? exitPrice - currentTrade.entryPrice
          : currentTrade.entryPrice - exitPrice;

        const pnlPercent = (pnl / currentTrade.entryPrice) * 100;

        currentTrade.exitTime = data[i].time;
        currentTrade.exitPrice = exitPrice;
        currentTrade.pnl = pnl;
        currentTrade.pnlPercent = pnlPercent;
        currentTrade.exitReason = exitReason;

        trades.push(currentTrade);

        // Update equity
        equity += pnl;
        equityCurve.push(equity);

        currentTrade = null;
      }
      continue;
    }

    // Signal detection logic (same as ChartPanel.tsx)
    const normATR = atrStd[i] && atrStd[i] > 0 ? (atr[i] - atrSMA[i]) / atrStd[i] : 0;
    const regime = normATR < -0.5 ? 0 : normATR > 1.0 ? 2 : 1;

    let minScore = regime === 0 ? 5.5 : regime === 2 ? 4.0 : 4.5;
    let cooldown = regime === 0 ? 12 : regime === 2 ? 5 : 8;

    const valFast = regime === 0 ? emaFast_Low[i] : regime === 2 ? emaFast_High[i] : emaFast_Norm[i];
    const valSlow = regime === 0 ? emaSlow_Low[i] : regime === 2 ? emaSlow_High[i] : emaSlow_Norm[i];

    let bullScore = 0;
    let bearScore = 0;

    // Trend
    if (closes[i] > ema200[i]) bullScore += 1.0;
    else bearScore += 1.0;

    // Alignment
    if (valFast > valSlow) bullScore += 1.5;
    else bearScore += 1.5;

    // RSI
    if (rsi[i] > 55) bullScore += 0.5;
    if (rsi[i] < 45) bearScore += 0.5;
    if (rsi[i] > 65) bullScore += 0.5;
    if (rsi[i] < 35) bearScore += 0.5;

    // Cross
    const prevFast = regime === 0 ? emaFast_Low[i - 1] : regime === 2 ? emaFast_High[i - 1] : emaFast_Norm[i - 1];
    const prevSlow = regime === 0 ? emaSlow_Low[i - 1] : regime === 2 ? emaSlow_High[i - 1] : emaSlow_Norm[i - 1];

    if (prevFast <= prevSlow && valFast > valSlow) bullScore += 2.5;
    if (prevFast >= prevSlow && valFast < valSlow) bearScore += 2.5;

    const barsSinceLast = i - lastSignalBar;

    if (bullScore >= minScore && bearScore < 2 && barsSinceLast > cooldown) {
      // Open LONG
      currentTrade = {
        entryTime: data[i].time,
        entryPrice: data[i].close,
        type: 'LONG',
        exitTime: 0,
        exitPrice: 0,
        pnl: 0,
        pnlPercent: 0,
        exitReason: 'TIMEOUT'
      };
      lastSignalBar = i;
    } else if (bearScore >= minScore && bullScore < 2 && barsSinceLast > cooldown) {
      // Open SHORT
      currentTrade = {
        entryTime: data[i].time,
        entryPrice: data[i].close,
        type: 'SHORT',
        exitTime: 0,
        exitPrice: 0,
        pnl: 0,
        pnlPercent: 0,
        exitReason: 'TIMEOUT'
      };
      lastSignalBar = i;
    }
  }

  // Close any open trade at end
  if (currentTrade) {
    const lastBar = data[data.length - 1];
    const pnl = currentTrade.type === 'LONG'
      ? lastBar.close - currentTrade.entryPrice
      : currentTrade.entryPrice - lastBar.close;

    currentTrade.exitTime = lastBar.time;
    currentTrade.exitPrice = lastBar.close;
    currentTrade.pnl = pnl;
    currentTrade.pnlPercent = (pnl / currentTrade.entryPrice) * 100;
    currentTrade.exitReason = 'TIMEOUT';

    trades.push(currentTrade);
  }

  // Calculate statistics
  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl < 0);

  const totalWins = winners.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));

  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
  const avgWin = winners.length > 0 ? totalWins / winners.length : 0;
  const avgLoss = losers.length > 0 ? totalLosses / losers.length : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);

  // Max drawdown
  let peak = equityCurve[0];
  let maxDD = 0;
  equityCurve.forEach(eq => {
    if (eq > peak) peak = eq;
    const dd = ((peak - eq) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });

  // Sharpe ratio (simplified)
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

  const results: BacktestResults = {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate,
    totalPnL,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown: maxDD,
    sharpeRatio: sharpe,
    trades,
    equity: equityCurve
  };

  if (import.meta.env.DEV) {
    console.log(`[Backtest] Complete:`, {
      trades: results.totalTrades,
      winRate: `${results.winRate.toFixed(1)}%`,
      totalPnL: `$${results.totalPnL.toFixed(2)}`,
      sharpe: results.sharpeRatio.toFixed(2),
      maxDD: `${results.maxDrawdown.toFixed(2)}%`
    });
  }

  return results;
}

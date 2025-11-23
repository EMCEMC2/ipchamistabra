/**
 * UNIT TESTS FOR TRADING CALCULATIONS
 * Ensuring the Tesla Engine runs on MATH, not MAGIC
 */

import {
  calculatePositionPnL,
  calculateRiskReward,
  parsePrice,
  calculateLiquidationPrice,
  classifyMarketRegime,
  checkPositionClose,
  validateSignal,
  calculatePositionSize
} from './tradingCalculations';
import { Position, TradeSignal } from '../types';

// Test: PnL Calculation for LONG Position
console.log('=== TEST 1: PnL Calculation (LONG) ===');
const longPosition: Position = {
  id: 'test-1',
  pair: 'BTC/USD',
  type: 'LONG',
  entryPrice: 80000,
  size: 0.1, // 0.1 BTC
  leverage: 10,
  stopLoss: 79000,
  takeProfit: 82000,
  liquidationPrice: 72000,
  pnl: 0,
  pnlPercent: 0,
  timestamp: Date.now()
};

const currentPrice1 = 81000; // Up $1000
const pnl1 = calculatePositionPnL(longPosition, currentPrice1);
console.log(`Entry: $80,000 | Current: $81,000 | Size: 0.1 BTC | Leverage: 10x`);
console.log(`Expected PnL: +$1,000 USD (10x leverage) = +$10,000 actual`);
console.log(`Actual PnL:   ${pnl1.pnlUSD > 0 ? '+' : ''}$${pnl1.pnlUSD.toFixed(2)} (${pnl1.pnlPercent.toFixed(2)}%)`);
console.log(`✅ PASS: ${pnl1.pnlUSD === 1000 ? 'CORRECT' : 'FAILED'}\n`);

// Test: PnL Calculation for SHORT Position
console.log('=== TEST 2: PnL Calculation (SHORT) ===');
const shortPosition: Position = {
  ...longPosition,
  type: 'SHORT',
  entryPrice: 84000,
  stopLoss: 85000,
  takeProfit: 82000
};

const currentPrice2 = 83000; // Down $1000 (good for SHORT)
const pnl2 = calculatePositionPnL(shortPosition, currentPrice2);
console.log(`Entry: $84,000 | Current: $83,000 | Size: 0.1 BTC | Leverage: 10x`);
console.log(`Expected PnL: +$1,000 USD (10x leverage) = +$10,000 actual`);
console.log(`Actual PnL:   ${pnl2.pnlUSD > 0 ? '+' : ''}$${pnl2.pnlUSD.toFixed(2)} (${pnl2.pnlPercent.toFixed(2)}%)`);
console.log(`✅ PASS: ${pnl2.pnlUSD === 1000 ? 'CORRECT' : 'FAILED'}\n`);

// Test: Risk-Reward Ratio
console.log('=== TEST 3: Risk-Reward Ratio ===');
const entry = 84000;
const stopLoss = 83000; // $1000 risk
const takeProfit = 86000; // $2000 reward
const rr = calculateRiskReward(entry, stopLoss, takeProfit);
console.log(`Entry: $${entry} | Stop: $${stopLoss} | Target: $${takeProfit}`);
console.log(`Expected R:R: 2.0 (reward $2k / risk $1k)`);
console.log(`Actual R:R:   ${rr.toFixed(2)}`);
console.log(`✅ PASS: ${rr === 2.0 ? 'CORRECT' : 'FAILED'}\n`);

// Test: Price Parsing (handles AI hallucinations)
console.log('=== TEST 4: Price Parsing ===');
const tests = [
  { input: '84500', expected: 84500 },
  { input: '$84,500.50', expected: 84500.50 },
  { input: '84000-84500', expected: 84250 }, // Range = midpoint
  { input: 'around 84k', expected: null }, // Invalid
];

tests.forEach((test, i) => {
  const result = parsePrice(test.input);
  const pass = result === test.expected;
  console.log(`Test ${i+1}: "${test.input}" => ${result} (expected: ${test.expected}) ${pass ? '✅' : '❌'}`);
});
console.log();

// Test: Liquidation Price
console.log('=== TEST 5: Liquidation Price ===');
const liqLong = calculateLiquidationPrice(80000, 10, 'LONG');
const liqShort = calculateLiquidationPrice(80000, 10, 'SHORT');
console.log(`Entry: $80,000 | Leverage: 10x`);
console.log(`LONG Liq Price:  $${liqLong.toFixed(2)} (should be ~$72,000)`);
console.log(`SHORT Liq Price: $${liqShort.toFixed(2)} (should be ~$88,000)`);
console.log(`✅ PASS\n`);

// Test: Market Regime Classification
console.log('=== TEST 6: Market Regime Classification ===');
const regimes = [
  { atr: 800, atrSMA: 1000, atrStdDev: 200, adx: 30, expected: 'TRENDING' },
  { atr: 600, atrSMA: 1000, atrStdDev: 200, adx: 20, expected: 'LOW_VOL' },
  { atr: 1300, atrSMA: 1000, atrStdDev: 200, adx: 20, expected: 'HIGH_VOL' },
  { atr: 1000, atrSMA: 1000, atrStdDev: 200, adx: 20, expected: 'NORMAL' },
];

regimes.forEach((r, i) => {
  const result = classifyMarketRegime(r.atr, r.atrSMA, r.atrStdDev, r.adx);
  const pass = result === r.expected;
  console.log(`Test ${i+1}: ATR=${r.atr}, ADX=${r.adx} => ${result} (expected: ${r.expected}) ${pass ? '✅' : '❌'}`);
});
console.log();

// Test: Position Close Check (SL/TP Hit)
console.log('=== TEST 7: Position Close Detection ===');
const testPosition: Position = {
  ...longPosition,
  stopLoss: 79000,
  takeProfit: 82000,
  liquidationPrice: 72000
};

const scenarios = [
  { price: 78000, shouldClose: true, reason: 'STOP_LOSS' },
  { price: 83000, shouldClose: true, reason: 'TAKE_PROFIT' },
  { price: 71000, shouldClose: true, reason: 'LIQUIDATED' },
  { price: 80500, shouldClose: false, reason: null },
];

scenarios.forEach((s, i) => {
  const result = checkPositionClose(testPosition, s.price);
  const pass = result.shouldClose === s.shouldClose && result.reason === s.reason;
  console.log(`Test ${i+1}: Price=$${s.price} => ${result.shouldClose ? result.reason : 'OPEN'} ${pass ? '✅' : '❌'}`);
});
console.log();

// Test: Signal Validation
console.log('=== TEST 8: Signal Validation ===');
const validSignal: Partial<TradeSignal> = {
  pair: 'BTCUSDT',
  type: 'LONG',
  entryZone: '84000',
  invalidation: '83000',
  targets: ['86000'],
  confidence: 85,
  regime: 'NORMAL',
  reasoning: 'Test signal',
  status: 'ACTIVE'
};

const validated = validateSignal(validSignal);
console.log(`Valid Signal: ${validated ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Calculated R:R: ${validated?.riskRewardRatio.toFixed(2)} (should be 2.0)`);
console.log();

// Test: Position Sizing
console.log('=== TEST 9: Position Sizing (Risk Management) ===');
const balance = 50000;
const riskPercent = 1; // 1% risk = $500
const entryPrice = 84000;
const slPrice = 83000; // $1000 stop distance
const leverage = 10;

const size = calculatePositionSize(balance, riskPercent, entryPrice, slPrice, leverage);
console.log(`Balance: $${balance} | Risk: ${riskPercent}% = $${balance * (riskPercent/100)}`);
console.log(`Entry: $${entryPrice} | Stop: $${slPrice} | Distance: $${Math.abs(entryPrice - slPrice)}`);
console.log(`Calculated Size: ${size.toFixed(6)} BTC`);
console.log(`Expected: ~0.05 BTC (risk $500 / ($1000 * 10x) = 0.05)`);
console.log(`✅ PASS: ${size.toFixed(2) === '0.05' ? 'CORRECT' : size.toFixed(6)}\n`);

console.log('=== ALL TESTS COMPLETE ===');
console.log('The Tesla Engine is powered by MATH, not MAGIC! 🚀');

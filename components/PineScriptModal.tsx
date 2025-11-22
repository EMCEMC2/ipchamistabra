
import React, { useState } from 'react';
import { X, Copy, Check, Terminal } from 'lucide-react';

interface PineScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PineScriptModal: React.FC<PineScriptModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // "Tactical Intelligence v2" Script - Fixed for compilation errors
  const pineScriptCode = `//@version=6
indicator("BitMind Elite Intelligence [Tactical v2]", overlay=true, shorttitle="BM-TAC", max_labels_count=500)

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

// Adaptive System
adaptivePeriod = input.int(100, "Adaptation Lookback", minval=50, group="Adaptive System")
numClusters = input.int(5, "S/R Cluster Count", minval=3, maxval=10, group="Adaptive System")
regimeSmoothing = input.int(10, "Regime Smoothing", minval=1, group="Adaptive System")

// Base Indicators
rsiLenBase = input.int(14, "Base RSI Length", minval=1, group="Base Indicators")

// Risk Management
atrLen = input.int(14, "ATR Length", minval=1, group="Risk")
slMult = input.float(1.5, "Stop Loss ATR Mult", minval=0.5, group="Risk")
tpMult = input.float(3.0, "Take Profit ATR Mult", minval=1.0, group="Risk")

// Display
showClusters = input.bool(true, "Show S/R Clusters", group="Display")
showRegime = input.bool(true, "Show Regime", group="Display")
showDashboard = input.bool(true, "Show Dashboard", group="Display")

// ══════════════════════════════════════════════════════════════════════════════
// VOLATILITY REGIME DETECTION
// ══════════════════════════════════════════════════════════════════════════════

// Calculate volatility metrics
atr = ta.atr(atrLen)
atrMA = ta.sma(atr, adaptivePeriod)
atrStd = ta.stdev(atr, adaptivePeriod)
normalizedATR = atrStd > 0 ? (atr - atrMA) / atrStd : 0

// Trend strength via ADX approximation
tr = ta.tr
dmPlus = math.max(high - high[1], 0)
dmMinus = math.max(low[1] - low, 0)
smTR = ta.rma(tr, 14)
smDMPlus = ta.rma(dmPlus, 14)
smDMMinus = ta.rma(dmMinus, 14)
diPlus = (smDMPlus / smTR) * 100
diMinus = (smDMMinus / smTR) * 100
dx = math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100
adx = ta.rma(dx, 14)

// Classify regime (0: Low Vol, 1: Normal, 2: High Vol, 3: Trending)
var int regime = 1
regimeRaw = normalizedATR < -0.5 ? 0 : normalizedATR > 1.0 ? 2 : adx > 25 ? 3 : 1
regime := math.round(ta.sma(regimeRaw, regimeSmoothing))

// Regime names for display
regimeName = regime == 0 ? "LOW VOL" : regime == 1 ? "NORMAL" : regime == 2 ? "HIGH VOL" : "TRENDING"
regimeColor = regime == 0 ? color.blue : regime == 1 ? color.gray : regime == 2 ? color.orange : color.green

// ══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE PARAMETERS BASED ON REGIME
// ══════════════════════════════════════════════════════════════════════════════

// Adaptive RSI thresholds
rsiOB = regime == 2 ? 75 : regime == 3 ? 80 : regime == 0 ? 65 : 70
rsiOS = regime == 2 ? 25 : regime == 3 ? 20 : regime == 0 ? 35 : 30

// Adaptive signal threshold
minScoreAdaptive = regime == 0 ? 6.0 : regime == 2 ? 4.0 : 5.0

// ══════════════════════════════════════════════════════════════════════════════
// K-MEANS CLUSTERING FOR SUPPORT/RESISTANCE
// ══════════════════════════════════════════════════════════════════════════════

highestHigh = ta.highest(high, adaptivePeriod)
lowestLow = ta.lowest(low, adaptivePeriod)
priceRange = highestHigh - lowestLow

var float[] centroids = array.new_float(numClusters, 0.0)
var bool clustersInitialized = false

if not clustersInitialized
    for i = 0 to numClusters - 1
        array.set(centroids, i, lowestLow + priceRange * (i + 0.5) / numClusters)
    clustersInitialized := true

if bar_index % 5 == 0 
    var float[] prices = array.new_float(0)
    array.clear(prices)
    for i = 0 to math.min(adaptivePeriod - 1, bar_index)
        array.push(prices, close[i])
    
    var float[] clusterSums = array.new_float(numClusters, 0.0)
    var int[] clusterCounts = array.new_int(numClusters, 0)
    
    for i = 0 to array.size(prices) - 1
        price = array.get(prices, i)
        minDist = 999999999.0
        nearestCluster = 0
        for j = 0 to numClusters - 1
            dist = math.abs(price - array.get(centroids, j))
            if dist < minDist
                minDist := dist
                nearestCluster := j
        array.set(clusterSums, nearestCluster, array.get(clusterSums, nearestCluster) + price)
        array.set(clusterCounts, nearestCluster, array.get(clusterCounts, nearestCluster) + 1)
    
    for i = 0 to numClusters - 1
        if array.get(clusterCounts, i) > 0
            array.set(centroids, i, array.get(clusterSums, i) / array.get(clusterCounts, i))

nearestSupport = 0.0
nearestResistance = 999999999.0

for i = 0 to numClusters - 1
    level = array.get(centroids, i)
    if level < close and level > nearestSupport
        nearestSupport := level
    if level > close and level < nearestResistance
        nearestResistance := level

distToSupport = nearestSupport > 0 ? (close - nearestSupport) / close * 100 : 0
distToResistance = nearestResistance < 999999999 ? (nearestResistance - close) / close * 100 : 0

// ══════════════════════════════════════════════════════════════════════════════
// INDICATOR CALCULATIONS
// ══════════════════════════════════════════════════════════════════════════════

// To fix "simple int" errors, we calculate all potential EMAs with constant lengths
// and then switch between them based on the current regime.

// 1. Low Volatility EMAs (Longer length to filter noise)
emaFast_Low = ta.ema(close, 27)
emaSlow_Low = ta.ema(close, 72)

// 2. Normal Volatility EMAs (Standard)
emaFast_Norm = ta.ema(close, 21)
emaSlow_Norm = ta.ema(close, 55)

// 3. High Volatility EMAs (Shorter length for reactivity)
emaFast_High = ta.ema(close, 15)
emaSlow_High = ta.ema(close, 39)

// Select active EMA based on regime
emaFast = regime == 0 ? emaFast_Low : regime == 2 ? emaFast_High : emaFast_Norm
emaSlow = regime == 0 ? emaSlow_Low : regime == 2 ? emaSlow_High : emaSlow_Norm

ema200 = ta.ema(close, 200)

// RSI & MACD
rsi = ta.rsi(close, rsiLenBase)
[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)

// Volume analysis
volMA = ta.sma(volume, 20)
volRatio = volume / volMA

// ══════════════════════════════════════════════════════════════════════════════
// WEIGHTED CONFLUENCE SCORING
// ══════════════════════════════════════════════════════════════════════════════

var float bullScore = 0.0
bullScore := 0.0
trendWeight = regime == 3 ? 3.5 : 2.5

// Bullish Factors
bullScore := bullScore + (close > ema200 ? trendWeight * 0.5 : 0)
bullScore := bullScore + (emaFast > emaSlow ? trendWeight * 0.3 : 0)
bullScore := bullScore + (rsi < rsiOB and rsi > rsi[1] ? 1.5 : 0)
bullScore := bullScore + (ta.crossover(macdLine, signalLine) ? 1.5 : 0)
bullScore := bullScore + (distToSupport < 1.0 and distToSupport > 0 ? 1.5 : 0)

var float bearScore = 0.0
bearScore := 0.0

// Bearish Factors
bearScore := bearScore + (close < ema200 ? trendWeight * 0.5 : 0)
bearScore := bearScore + (emaFast < emaSlow ? trendWeight * 0.3 : 0)
bearScore := bearScore + (rsi > rsiOS and rsi < rsi[1] ? 1.5 : 0)
bearScore := bearScore + (ta.crossunder(macdLine, signalLine) ? 1.5 : 0)
bearScore := bearScore + (distToResistance < 1.0 and distToResistance > 0 ? 1.5 : 0)

// ══════════════════════════════════════════════════════════════════════════════
// SIGNALS
// ══════════════════════════════════════════════════════════════════════════════

cooldownBars = regime == 2 ? 2 : regime == 0 ? 5 : 3
var int lastBuy = 0
var int lastSell = 0

buySignal = bullScore >= minScoreAdaptive and bullScore > bearScore and (bar_index - lastBuy > cooldownBars)
sellSignal = bearScore >= minScoreAdaptive and bearScore > bullScore and (bar_index - lastSell > cooldownBars)

if buySignal
    lastBuy := bar_index
if sellSignal
    lastSell := bar_index

// ══════════════════════════════════════════════════════════════════════════════
// PLOTTING
// ══════════════════════════════════════════════════════════════════════════════

plot(emaFast, "Adaptive Fast EMA", color=color.new(color.blue, 50))
plot(emaSlow, "Adaptive Slow EMA", color=color.new(color.orange, 50))
plot(ema200, "200 EMA", color=color.new(color.purple, 30))

bgcolor(showRegime ? color.new(regimeColor, 95) : na)

plot(showClusters and nearestSupport > 0 ? nearestSupport : na, "Cluster Sup", color=color.green, style=plot.style_circles)
plot(showClusters and nearestResistance < 999999999 ? nearestResistance : na, "Cluster Res", color=color.red, style=plot.style_circles)

plotshape(buySignal, "BUY", shape.triangleup, location.belowbar, color.green, size=size.small)
plotshape(sellSignal, "SELL", shape.triangledown, location.abovebar, color.red, size=size.small)

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

if showDashboard and barstate.islast
    var table dash = table.new(position.top_right, 2, 10, bgcolor=color.new(color.black, 20), border_width=1)
    
    table.cell(dash, 0, 0, "BITMIND TACTICAL", bgcolor=color.new(color.orange, 20), text_color=color.orange)
    table.cell(dash, 1, 0, "v2.1", bgcolor=color.new(color.orange, 20), text_color=color.white)
    
    table.cell(dash, 0, 1, "REGIME", text_color=color.white)
    table.cell(dash, 1, 1, regimeName, text_color=regimeColor)
    
    table.cell(dash, 0, 2, "BULL SCORE", text_color=color.white)
    table.cell(dash, 1, 2, str.tostring(bullScore, "#.0"), text_color=color.teal)
    
    table.cell(dash, 0, 3, "BEAR SCORE", text_color=color.white)
    table.cell(dash, 1, 3, str.tostring(bearScore, "#.0"), text_color=color.red)
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pineScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-terminal-card border border-terminal-border rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-terminal-border">
          <div className="flex items-center gap-2 text-terminal-accent">
            <Terminal size={20} />
            <h2 className="font-mono font-bold tracking-wider">PINE SCRIPT: TACTICAL v2</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-terminal-muted hover:text-terminal-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-hidden flex flex-col flex-1">
          <p className="text-sm text-terminal-muted font-mono mb-4">
            Copy this advanced code to TradingView's Pine Editor to visualize the full BitMind Tactical v2 System (Regimes, Clusters, and Signals).
          </p>
          
          <div className="relative flex-1 bg-terminal-bg border border-terminal-border rounded p-4 overflow-auto group">
             <pre className="font-mono text-xs text-blue-300 whitespace-pre-wrap">
               {pineScriptCode}
             </pre>
             
             <button
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-terminal-card border border-terminal-border p-2 rounded hover:bg-terminal-border transition-colors"
             >
               {copied ? <Check size={16} className="text-terminal-accent" /> : <Copy size={16} className="text-terminal-muted" />}
             </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-terminal-border bg-terminal-bg/50 flex justify-end">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-terminal-accent text-terminal-bg px-4 py-2 rounded font-mono font-bold text-xs hover:bg-opacity-90 transition-all"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY SOURCE CODE'}
          </button>
        </div>
      </div>
    </div>
  );
};

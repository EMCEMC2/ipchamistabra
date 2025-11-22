
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  CrosshairMode,
  IChartApi,
  LineStyle,
  ColorType,
  SeriesMarker,
  Time
} from 'lightweight-charts';
import { ChartDataPoint, TradeSignal } from '../types';
import { Code, Eye, EyeOff, Activity, Layers } from 'lucide-react';
import { PineScriptModal } from './PineScriptModal';

interface ChartPanelProps {
  data: ChartDataPoint[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  signals?: TradeSignal[];
}

// --- TACTICAL V2 ENGINE (Ported from Pine Script) ---

// Helper: Simple Moving Average
const calculateSMA = (data: number[], period: number) => {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    sma.push(sum / period);
  }
  return sma;
};

// Helper: True Range
const calculateTR = (data: ChartDataPoint[]) => {
  const tr = [0]; // First TR is 0 or high-low
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high;
    const l = data[i].low;
    const pc = data[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr;
};

// Helper: Wilder's Smoothing (RMA)
const calculateRMA = (src: number[], length: number) => {
  const rma = [];
  let alpha = 1 / length;
  let sum = 0;

  // Initialize with SMA for first value
  for (let i = 0; i < length; i++) sum += src[i] || 0;
  let prev = sum / length;
  rma[length - 1] = prev;

  for (let i = 0; i < length - 1; i++) rma.push(NaN); // pad

  for (let i = length; i < src.length; i++) {
    const val = alpha * src[i] + (1 - alpha) * prev;
    rma.push(val);
    prev = val;
  }
  return rma;
};

// Helper: RSI
const calculateRSI = (prices: number[], period: number) => {
  const rsi = [];
  const changes = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);

  // We need to align indexes. changes[0] corresponds to prices[1]
  // Simple implementation for visualization
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < prices.length; i++) {
    if (i <= period) { rsi.push(NaN); continue; }
    const change = changes[i - 1];

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) rsi.push(100);
    else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
};

// Helper: Standard Deviation
const calculateStdev = (data: number[], period: number) => {
  const stdev = [];
  const sma = calculateSMA(data, period);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { stdev.push(NaN); continue; }
    let sumSqDiff = 0;
    const avg = sma[i];
    for (let j = 0; j < period; j++) {
      sumSqDiff += Math.pow(data[i - j] - avg, 2);
    }
    stdev.push(Math.sqrt(sumSqDiff / period));
  }
  return stdev;
};

// Refactored Stable EMA
const calculateEMA = (data: number[], count: number) => {
  if (data.length === 0) return [];
  const k = 2 / (count + 1);
  const emaData = [];
  let ema = data[0];
  emaData.push(ema);

  for (let i = 1; i < data.length; i++) {
    ema = ema + k * (data[i] - ema);
    emaData.push(ema);
  }
  return emaData;
};

// Helper: Parse Price
const parsePrice = (priceStr: string): number | null => {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
};

export const ChartPanel: React.FC<ChartPanelProps> = ({ data, timeframe, onTimeframeChange, signals = [] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Series Refs - using any to bypass strict generic checks on setMarkers which varies by version
  const candleSeriesRef = useRef<any>(null);
  const emaFastSeriesRef = useRef<any>(null);
  const emaSlowSeriesRef = useRef<any>(null);
  const ema200SeriesRef = useRef<any>(null);

  // Overlay Refs
  const activePriceLinesRef = useRef<any[]>([]);
  const clusterLinesRef = useRef<any[]>([]);

  // UI State
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [showSignals, setShowSignals] = useState(true);
  const [showTactical, setShowTactical] = useState(true);

  const timeframes = [
    { label: '15m', value: '15m' },
    { label: '1H', value: '1h' },
    { label: '4H', value: '4h' },
    { label: '1D', value: '1d' },
  ];

  // --- CHART INITIALIZATION ---
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#18181b' },
        textColor: '#a1a1aa',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: '#27272a', timeVisible: true },
      rightPriceScale: { borderColor: '#27272a' },
    });

    // Lightweight Charts v4 API
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });

    // Tactical Series
    const emaFast = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 });
    const emaSlow = chart.addLineSeries({ color: '#f97316', lineWidth: 2 });
    const ema200 = chart.addLineSeries({ color: '#a855f7', lineWidth: 1, lineStyle: LineStyle.Dotted });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastSeriesRef.current = emaFast;
    emaSlowSeriesRef.current = emaSlow;
    ema200SeriesRef.current = ema200;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0].contentRect || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height
      });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // --- TACTICAL ENGINE & DATA UPDATE ---
  useEffect(() => {
    if (!data || data.length === 0 || !candleSeriesRef.current) return;

    // 1. Basic Candle Data
    candleSeriesRef.current.setData(data.map(d => ({
      time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close
    })));

    if (!showTactical) {
      emaFastSeriesRef.current?.setData([]);
      emaSlowSeriesRef.current?.setData([]);
      ema200SeriesRef.current?.setData([]);
      candleSeriesRef.current.setMarkers([]);
      // Clear Clusters
      clusterLinesRef.current.forEach(l => candleSeriesRef.current?.removePriceLine(l));
      clusterLinesRef.current = [];
      return;
    }

    // 2. Run Tactical Engine
    const closes = data.map(d => d.close);

    // 2a. Calculate Base EMAs
    const emaFast_Low = calculateEMA(closes, 27);
    const emaFast_Norm = calculateEMA(closes, 21);
    const emaFast_High = calculateEMA(closes, 15);

    const emaSlow_Low = calculateEMA(closes, 72);
    const emaSlow_Norm = calculateEMA(closes, 55);
    const emaSlow_High = calculateEMA(closes, 39);

    const ema200Arr = calculateEMA(closes, 200);
    const rsiArr = calculateRSI(closes, 14); // Add RSI for confluence

    // 2b. Calculate Regime (Simplified ATR/StdDev approach)
    const tr = calculateTR(data);
    const atr = calculateRMA(tr, 14);
    const atrSMA = calculateSMA(atr, 100);
    const atrStd = calculateStdev(atr, 100);

    // 2c. Build Adaptive Series & Markers
    const adaptiveFastData = [];
    const adaptiveSlowData = [];
    const ema200Data = [];
    const markers: SeriesMarker<Time>[] = [];

    // 2d. Support/Resistance Clustering (Last 100 bars)
    const lookback = 100;
    const recentData = data.slice(-lookback);
    const clusterPrices = [...recentData.map(d => d.high), ...recentData.map(d => d.low), ...recentData.map(d => d.close)].sort((a, b) => a - b);

    // Simple 1D Density Clustering
    const clusters: { sum: number, count: number }[] = [];
    const threshold = (recentData[0]?.close || 100) * 0.005; // 0.5% gap

    if (clusterPrices.length > 0) {
      let currentCluster = { sum: clusterPrices[0], count: 1 };
      for (let i = 1; i < clusterPrices.length; i++) {
        if (clusterPrices[i] - (currentCluster.sum / currentCluster.count) < threshold) {
          currentCluster.sum += clusterPrices[i];
          currentCluster.count++;
        } else {
          clusters.push(currentCluster);
          currentCluster = { sum: clusterPrices[i], count: 1 };
        }
      }
      clusters.push(currentCluster);
    }

    // Sort clusters by density (count) and take top ones
    const sortedClusters = clusters.sort((a, b) => b.count - a.count).slice(0, 5).map(c => c.sum / c.count);
    const currentPrice = closes[closes.length - 1];
    const nearestSupp = sortedClusters.filter(p => p < currentPrice).sort((a, b) => b - a)[0];
    const nearestRes = sortedClusters.filter(p => p > currentPrice).sort((a, b) => a - b)[0];

    // 2e. Iterate for Indicators & Signals
    let lastSignalTime = -999;

    for (let i = 0; i < data.length; i++) {
      // Regime Logic
      const normATR = atrStd[i] && atrStd[i] > 0 ? (atr[i] - atrSMA[i]) / atrStd[i] : 0;
      const regime = normATR < -0.5 ? 0 : normATR > 1.0 ? 2 : 1; // 0: Low, 1: Norm, 2: High

      // Dynamic thresholds & Cooldowns
      let minScore = 4.0;
      let cooldown = 5;

      if (regime === 0) {
        // Low Volatility: Needs high confidence to avoid chop
        minScore = 5.5;
        cooldown = 12;
      } else if (regime === 2) {
        // High Volatility: Reactive but validated
        minScore = 4.0;
        cooldown = 5;
      } else {
        // Normal
        minScore = 4.5;
        cooldown = 8;
      }

      // Select EMA
      const valFast = regime === 0 ? emaFast_Low[i] : regime === 2 ? emaFast_High[i] : emaFast_Norm[i];
      const valSlow = regime === 0 ? emaSlow_Low[i] : regime === 2 ? emaSlow_High[i] : emaSlow_Norm[i];

      adaptiveFastData.push({ time: data[i].time as Time, value: valFast });
      adaptiveSlowData.push({ time: data[i].time as Time, value: valSlow });
      ema200Data.push({ time: data[i].time as Time, value: ema200Arr[i] });

      // Signal Logic (Refined Confluence)
      if (i > 200) {
        let bullScore = 0;
        let bearScore = 0;

        // 1. Trend (EMA 200) - Weight 1.0
        if (closes[i] > ema200Arr[i]) bullScore += 1.0;
        else bearScore += 1.0;

        // 2. Alignment (Fast vs Slow) - Weight 1.5
        if (valFast > valSlow) bullScore += 1.5;
        else bearScore += 1.5;

        // 3. Momentum (RSI) - Weight 1.0
        const rsiVal = rsiArr[i];
        if (rsiVal > 55) bullScore += 0.5;
        if (rsiVal < 45) bearScore += 0.5;
        // Bonus momentum
        if (rsiVal > 65) bullScore += 0.5;
        if (rsiVal < 35) bearScore += 0.5;

        // 4. Cross Trigger - Weight 2.5
        const prevFast = regime === 0 ? emaFast_Low[i - 1] : regime === 2 ? emaFast_High[i - 1] : emaFast_Norm[i - 1];
        const prevSlow = regime === 0 ? emaSlow_Low[i - 1] : regime === 2 ? emaSlow_High[i - 1] : emaSlow_Norm[i - 1];

        if (prevFast <= prevSlow && valFast > valSlow) bullScore += 2.5;
        if (prevFast >= prevSlow && valFast < valSlow) bearScore += 2.5;

        // Trigger
        const barsSinceLast = i - lastSignalTime;
        if (bullScore >= minScore && bearScore < 2 && barsSinceLast > cooldown) {
          markers.push({
            time: data[i].time as Time,
            position: 'belowBar',
            color: '#10b981',
            shape: 'arrowUp',
            text: 'BUY'
          });
          lastSignalTime = i;
        } else if (bearScore >= minScore && bullScore < 2 && barsSinceLast > cooldown) {
          markers.push({
            time: data[i].time as Time,
            position: 'aboveBar',
            color: '#ef4444',
            shape: 'arrowDown',
            text: 'SELL'
          });
          lastSignalTime = i;
        }
      }
    }

    // 3. Update Series
    emaFastSeriesRef.current?.setData(adaptiveFastData);
    emaSlowSeriesRef.current?.setData(adaptiveSlowData);
    ema200SeriesRef.current?.setData(ema200Data);
    candleSeriesRef.current.setMarkers(markers);

    // 4. Update Cluster Lines
    // Clear old
    clusterLinesRef.current.forEach(l => candleSeriesRef.current?.removePriceLine(l));
    clusterLinesRef.current = [];

    if (nearestSupp) {
      const l = candleSeriesRef.current.createPriceLine({
        price: nearestSupp, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'CLUSTER SUP'
      });
      clusterLinesRef.current.push(l);
    }
    if (nearestRes) {
      const l = candleSeriesRef.current.createPriceLine({
        price: nearestRes, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'CLUSTER RES'
      });
      clusterLinesRef.current.push(l);
    }

  }, [data, showTactical]); // Re-run when data or toggle changes

  // --- AI OVERLAY (EXISTING) ---
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    activePriceLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
    activePriceLinesRef.current = [];

    if (!showSignals) return;

    signals.filter(s => s.status === 'ACTIVE').forEach(signal => {
      const entryPrice = parsePrice(signal.entryZone);
      const stopPrice = parsePrice(signal.invalidation);
      const targetPrice = parsePrice(signal.targets[0]);

      if (entryPrice) {
        activePriceLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: entryPrice, color: '#3b82f6', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `ENTRY (${signal.type})`
        }));
      }
      if (stopPrice) {
        activePriceLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: stopPrice, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `STOP LOSS`
        }));
      }
      if (targetPrice) {
        activePriceLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: targetPrice, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `TARGET 1`
        }));
      }
    });
  }, [signals, showSignals, data]);

  return (
    <div className="h-full w-full bg-terminal-card border border-terminal-border rounded-lg p-4 flex flex-col relative">
      <div className="flex justify-between items-center mb-2 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-terminal-muted font-mono text-sm uppercase tracking-wider flex items-center gap-2">
            BTCUSDT.P
            <span className="text-terminal-text font-bold hidden sm:inline">
              • {timeframes.find(t => t.value === timeframe)?.label}
            </span>
          </h2>
          <div className="flex bg-terminal-bg border border-terminal-border rounded p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${timeframe === tf.value
                  ? 'bg-terminal-border text-terminal-accent font-bold'
                  : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-border/50'
                  }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* TACTICAL V2 TOGGLE */}
          <button
            onClick={() => setShowTactical(!showTactical)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all border ${showTactical
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-terminal-border text-terminal-muted border-terminal-border'
              }`}
            title="Toggle BitMind Tactical v2 Indicators"
          >
            <Layers size={12} />
            <span className="text-[10px] font-mono font-bold uppercase">TACTICAL v2</span>
          </button>

          <button
            onClick={() => setShowSignals(!showSignals)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all border ${showSignals
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-terminal-border text-terminal-muted border-terminal-border'
              }`}
            title="Toggle AI Signal Overlay"
          >
            {showSignals ? <Eye size={12} /> : <EyeOff size={12} />}
            <span className="text-[10px] font-mono font-bold uppercase">AI OVERLAY</span>
          </button>

          <button
            onClick={() => setIsScriptModalOpen(true)}
            className="flex items-center gap-1.5 bg-terminal-border hover:bg-terminal-accent/10 border border-terminal-border hover:border-terminal-accent text-terminal-muted hover:text-terminal-accent px-2 py-1 rounded transition-all group"
          >
            <Code size={12} className="group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-mono font-bold uppercase">PINE SCRIPT</span>
          </button>
        </div>
      </div>
      <div className="flex-grow relative w-full h-full overflow-hidden" ref={chartContainerRef} />

      <PineScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
      />
    </div>
  );
};

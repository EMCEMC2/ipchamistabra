
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  CrosshairMode,
  IChartApi,
  LineStyle,
  ColorType,
  SeriesMarker,
  Time,
  ISeriesApi,
  IPriceLine
} from 'lightweight-charts';
import { Code, Eye, EyeOff, Activity, Layers, ZoomIn, ZoomOut, Maximize2, Target } from 'lucide-react';
import { PineScriptModal } from './PineScriptModal';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateTR,
  calculateRMA,
  calculateStdev
} from '../utils/technicalAnalysis';
import { useChartState, usePositions } from '../store/selectors';

// Helper: Parse Price
const parsePrice = (priceStr: string): number | null => {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
};

export const ChartPanel: React.FC = () => {
  const { chartData: data, timeframe, setTimeframe: onTimeframeChange, signals } = useChartState();
  const positions = usePositions();
  const safeData = data || [];
  const safePositions = positions || [];

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Series Refs
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaFastSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Overlay Refs
  const activePriceLinesRef = useRef<IPriceLine[]>([]);
  const positionLinesRef = useRef<IPriceLine[]>([]);
  const clusterLinesRef = useRef<IPriceLine[]>([]);

  // UI State
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [showSignals, setShowSignals] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
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

    // Clean up previous chart if exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#27272a', style: LineStyle.Solid, visible: true },
        horzLines: { color: '#27272a', style: LineStyle.Solid, visible: true },
      },
      width: chartContainerRef.current.clientWidth || 800,
      height: chartContainerRef.current.clientHeight || 400,
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: '#6b7280',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#374151',
        },
        horzLine: {
          color: '#6b7280',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#374151',
        },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 4,
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Lightweight Charts v4 API
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });

    // Tactical Series
    const emaFast = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 });
    const emaSlow = chart.addLineSeries({ color: '#f97316', lineWidth: 1 });
    const ema200 = chart.addLineSeries({ color: '#a855f7', lineWidth: 1, lineStyle: LineStyle.Dotted });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    emaFastSeriesRef.current = emaFast;
    emaSlowSeriesRef.current = emaSlow;
    ema200SeriesRef.current = ema200;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0].contentRect || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []); // Run once on mount

  // --- TACTICAL ENGINE & DATA UPDATE ---
  // 2. Run Tactical Engine (Memoized)
  const { adaptiveFastData, adaptiveSlowData, ema200Data, markers, clusterLines } = useMemo(() => {
      if (!showTactical || safeData.length === 0) {
        return { adaptiveFastData: [], adaptiveSlowData: [], ema200Data: [], markers: [], clusterLines: [] };
      }

      const closes = safeData.map(d => d.close);

      // 2a. Calculate Base EMAs
      const emaFast_Low = calculateEMA(closes, 27);
      const emaFast_Norm = calculateEMA(closes, 21);
      const emaFast_High = calculateEMA(closes, 15);

      const emaSlow_Low = calculateEMA(closes, 72);
      const emaSlow_Norm = calculateEMA(closes, 55);
      const emaSlow_High = calculateEMA(closes, 39);

      const ema200Arr = calculateEMA(closes, 200);
      const rsiArr = calculateRSI(closes, 14);

      // 2b. Calculate Regime
      const tr = calculateTR(safeData);
      const atr = calculateRMA(tr, 14);
      const atrSMA = calculateSMA(atr, 100);
      const atrStd = calculateStdev(atr, 100);

      const adaptiveFast: any[] = [];
      const adaptiveSlow: any[] = [];
      const ema200: any[] = [];
      const newMarkers: SeriesMarker<Time>[] = [];

      // 2d. Support/Resistance Clustering
      const lookback = 100;
      const recentData = safeData.slice(-lookback);
      const clusterPrices = [...recentData.map(d => d.high), ...recentData.map(d => d.low), ...recentData.map(d => d.close)].sort((a, b) => a - b);

      const clusters: { sum: number, count: number }[] = [];
      const threshold = (recentData[0]?.close || 100) * 0.005;

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

      const sortedClusters = clusters.sort((a, b) => b.count - a.count).slice(0, 5).map(c => c.sum / c.count);
      const currentPrice = closes[closes.length - 1];
      const nearestSupp = sortedClusters.filter(p => p < currentPrice).sort((a, b) => b - a)[0];
      const nearestRes = sortedClusters.filter(p => p > currentPrice).sort((a, b) => a - b)[0];

      const newClusterLines: number[] = [];
      if (nearestSupp) newClusterLines.push(nearestSupp);
      if (nearestRes) newClusterLines.push(nearestRes);

      // 2e. Iterate for Indicators & Signals
      let lastSignalTime = -999;

      for (let i = 0; i < safeData.length; i++) {
        const normATR = atrStd[i] && atrStd[i] > 0 ? (atr[i] - atrSMA[i]) / atrStd[i] : 0;
        const regime = normATR < -0.5 ? 0 : normATR > 1.0 ? 2 : 1;

        let minScore = 4.0;
        let cooldown = 5;

        if (regime === 0) { minScore = 5.5; cooldown = 12; }
        else if (regime === 2) { minScore = 4.0; cooldown = 5; }
        else { minScore = 4.5; cooldown = 8; }

        const valFast = regime === 0 ? emaFast_Low[i] : regime === 2 ? emaFast_High[i] : emaFast_Norm[i];
        const valSlow = regime === 0 ? emaSlow_Low[i] : regime === 2 ? emaSlow_High[i] : emaSlow_Norm[i];

        adaptiveFast.push({ time: safeData[i].time as Time, value: valFast });
        adaptiveSlow.push({ time: safeData[i].time as Time, value: valSlow });
        ema200.push({ time: safeData[i].time as Time, value: ema200Arr[i] });

        if (i > 200) {
          let bullScore = 0;
          let bearScore = 0;

          if (closes[i] > ema200Arr[i]) bullScore += 1.0; else bearScore += 1.0;
          if (valFast > valSlow) bullScore += 1.5; else bearScore += 1.5;

          const rsiVal = rsiArr[i];
          if (rsiVal > 55) bullScore += 0.5;
          if (rsiVal < 45) bearScore += 0.5;
          if (rsiVal > 65) bullScore += 0.5;
          if (rsiVal < 35) bearScore += 0.5;

          const prevFast = regime === 0 ? emaFast_Low[i - 1] : regime === 2 ? emaFast_High[i - 1] : emaFast_Norm[i - 1];
          const prevSlow = regime === 0 ? emaSlow_Low[i - 1] : regime === 2 ? emaSlow_High[i - 1] : emaSlow_Norm[i - 1];

          if (prevFast <= prevSlow && valFast > valSlow) bullScore += 2.5;
          if (prevFast >= prevSlow && valFast < valSlow) bearScore += 2.5;

          const barsSinceLast = i - lastSignalTime;
          if (bullScore >= minScore && bearScore < 2 && barsSinceLast > cooldown) {
            newMarkers.push({ time: safeData[i].time as Time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'BUY' });
            lastSignalTime = i;
          } else if (bearScore >= minScore && bullScore < 2 && barsSinceLast > cooldown) {
            newMarkers.push({ time: safeData[i].time as Time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SELL' });
            lastSignalTime = i;
          }
        }
      }

      return {
        adaptiveFastData: adaptiveFast,
        adaptiveSlowData: adaptiveSlow,
        ema200Data: ema200,
        markers: newMarkers,
        clusterLines: newClusterLines
      };
    }, [safeData, showTactical]);

    // 3. Update Series (Effect)
    useEffect(() => {
      if (!candleSeriesRef.current) return;

      // Update Candles
      candleSeriesRef.current.setData(safeData.map(d => ({
        time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close
      })));

      if (!showTactical) {
        emaFastSeriesRef.current?.setData([]);
        emaSlowSeriesRef.current?.setData([]);
        ema200SeriesRef.current?.setData([]);
        candleSeriesRef.current.setMarkers([]);
        clusterLinesRef.current.forEach(l => candleSeriesRef.current?.removePriceLine(l));
        clusterLinesRef.current = [];
        return;
      }

      emaFastSeriesRef.current?.setData(adaptiveFastData);
      emaSlowSeriesRef.current?.setData(adaptiveSlowData);
      ema200SeriesRef.current?.setData(ema200Data);
      candleSeriesRef.current.setMarkers(markers);

      // Update Cluster Lines
      clusterLinesRef.current.forEach(l => candleSeriesRef.current?.removePriceLine(l));
      clusterLinesRef.current = [];

      clusterLines.forEach(price => {
        const color = price < (safeData[safeData.length - 1]?.close || 0) ? '#10b981' : '#ef4444';
        const l = candleSeriesRef.current!.createPriceLine({
          price, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: ''
        });
        clusterLinesRef.current.push(l);
      });

    }, [safeData, showTactical, adaptiveFastData, adaptiveSlowData, ema200Data, markers, clusterLines]);

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
          price: entryPrice, color: '#3b82f6', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `ENTRY`
        }));
      }
      if (stopPrice) {
        activePriceLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: stopPrice, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `STOP`
        }));
      }
      if (targetPrice) {
        activePriceLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: targetPrice, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `TP`
        }));
      }
    });
  }, [signals, showSignals, safeData]);

  // --- POSITION OVERLAY ---
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clear existing position lines
    positionLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
    positionLinesRef.current = [];

    if (!showPositions || safePositions.length === 0) return;

    safePositions.forEach((pos, idx) => {
      const posLabel = `P${idx + 1}`;

      // Entry line (cyan for visibility)
      if (pos.entryPrice > 0) {
        positionLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: pos.entryPrice,
          color: '#06b6d4', // cyan
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${posLabel} ENTRY`
        }));
      }

      // Stop Loss line (red)
      if (pos.stopLoss > 0) {
        positionLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: pos.stopLoss,
          color: '#dc2626', // red
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${posLabel} SL`
        }));
      }

      // Take Profit line (green)
      if (pos.takeProfit > 0) {
        positionLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: pos.takeProfit,
          color: '#16a34a', // green
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${posLabel} TP`
        }));
      }

      // Liquidation line (orange warning)
      if (pos.liquidationPrice > 0) {
        positionLinesRef.current.push(candleSeriesRef.current!.createPriceLine({
          price: pos.liquidationPrice,
          color: '#f97316', // orange
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${posLabel} LIQ`
        }));
      }
    });
  }, [safePositions, showPositions, safeData]);

  // Zoom Controls
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange) {
      const from = visibleRange.from as number;
      const to = visibleRange.to as number;
      const diff = to - from;
      const newDiff = diff * 0.75; // Zoom in 25%
      const center = (from + to) / 2;
      timeScale.setVisibleRange({
        from: (center - newDiff / 2) as Time,
        to: (center + newDiff / 2) as Time,
      });
    }
  };

  const handleZoomOut = () => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (visibleRange) {
      const from = visibleRange.from as number;
      const to = visibleRange.to as number;
      const diff = to - from;
      const newDiff = diff * 1.25; // Zoom out 25%
      const center = (from + to) / 2;
      timeScale.setVisibleRange({
        from: (center - newDiff / 2) as Time,
        to: (center + newDiff / 2) as Time,
      });
    }
  };

  const handleResetZoom = () => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
  };

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden group bg-terminal-bg border border-terminal-border rounded-sm">
      {/* Header Controls */}
      <div className="flex justify-between items-center px-2 py-1.5 border-b border-terminal-border bg-terminal-card shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-gray-400 font-sans text-xs uppercase tracking-wider flex items-center gap-2">
            <Activity size={12} className="text-green-400" />
            BTCUSDT.P
            <span className="text-gray-500 font-semibold hidden sm:inline">
              • {timeframes.find(t => t.value === timeframe)?.label}
            </span>
          </h2>

          {/* Timeframe Selector */}
          <div className="flex bg-terminal-card rounded-sm p-0.5 gap-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-sm transition-all duration-200 ${
                  timeframe === tf.value
                    ? 'bg-terminal-border text-green-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Zoom Controls */}
          <div className="flex bg-terminal-card rounded-sm overflow-hidden">
            <button
              onClick={handleZoomIn}
              className="px-1.5 py-1 text-gray-500 hover:text-green-400 hover:bg-white/5 transition-all duration-200 border-r border-terminal-border"
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={handleZoomOut}
              className="px-1.5 py-1 text-gray-500 hover:text-green-400 hover:bg-white/5 transition-all duration-200 border-r border-terminal-border"
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1.5 py-1 text-gray-500 hover:text-green-400 hover:bg-white/5 transition-all duration-200"
              title="Fit Content"
            >
              <Maximize2 size={12} />
            </button>
          </div>

          {/* TACTICAL V2 TOGGLE */}
          <button
            onClick={() => setShowTactical(!showTactical)}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all duration-200 border ${
              showTactical
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-transparent text-gray-500 border-transparent hover:text-amber-400'
            }`}
            title="Toggle BitMind Tactical v2 Indicators"
          >
            <Layers size={12} />
            <span className="text-[10px] font-medium uppercase hidden sm:inline">TACTICAL</span>
          </button>

          <button
            onClick={() => setShowSignals(!showSignals)}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all duration-200 border ${
              showSignals
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-transparent text-gray-500 border-transparent hover:text-blue-400'
            }`}
            title="Toggle AI Signal Overlay"
          >
            {showSignals ? <Eye size={12} /> : <EyeOff size={12} />}
            <span className="text-[10px] font-medium uppercase hidden sm:inline">SIGNALS</span>
          </button>

          <button
            onClick={() => setShowPositions(!showPositions)}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all duration-200 border ${
              showPositions
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                : 'bg-transparent text-gray-500 border-transparent hover:text-cyan-400'
            }`}
            title="Toggle Position Overlay (Entry/SL/TP)"
          >
            <Target size={12} />
            <span className="text-[10px] font-medium uppercase hidden sm:inline">POS</span>
          </button>

          <button
            onClick={() => setIsScriptModalOpen(true)}
            className="flex items-center gap-1 bg-transparent hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 text-gray-500 hover:text-purple-400 px-2 py-1 rounded-sm transition-all duration-200 group"
          >
            <Code size={12} className="group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-[10px] font-medium uppercase hidden sm:inline">PINE</span>
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 w-full relative overflow-hidden bg-terminal-bg" ref={chartContainerRef}>
      </div>

      <PineScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
      />
    </div>
  );
};

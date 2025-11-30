import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Layout, Users, Brain, BookOpen, LineChart } from 'lucide-react';
import { ChartPanel } from './components/ChartPanel';
import { AiTacticalBot } from './components/AiTacticalBot';
import { IntelDeck } from './components/IntelDeck';
import { MLCortex } from './components/MLCortex';
import { AgentSwarm } from './components/AgentSwarm/SwarmCore';
import { ActiveSignals } from './components/ActiveSignals';
import { PositionsPanel } from './components/PositionsPanel';
import { TradeJournal } from './components/TradeJournal';
import { BacktestPanel } from './components/BacktestPanel';
import { AggrOrderFlow } from './components/AggrOrderFlow';
import { AiCommandCenter } from './components/AiCommandCenter';
import { startMarketDataSync, fetchChartData } from './services/marketData';
import { calculateRSI, calculateATR, calculateADX, calculateEMA, calculateMACD } from './utils/technicalAnalysis';
import { BinancePriceFeed } from './services/websocket';
import { useStore } from './store/useStore';
import { TradeSignal } from './types';
import { BlockedBanner } from './components/BlockedBanner';
import { usePositionMonitor } from './hooks/usePositionMonitor';
import { aggrService } from './services/aggrService';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { captureError } from './services/errorMonitor';

type ViewMode = 'TERMINAL' | 'SWARM' | 'CORTEX' | 'JOURNAL' | 'BACKTEST' | 'LIVEFEED';

function App() {
  // Global State
  const {
    chartData,
    timeframe,
    setTechnicals,
    setActiveTradeSetup,
    isLiveMode
  } = useStore();

  // Local State for Dashboard
  const [activeView, setActiveView] = useState<ViewMode>('TERMINAL');

  // Keyboard Shortcuts
  useKeyboardShortcuts({ setActiveView });

  // WebSocket Management for Live Mode
  useEffect(() => {
    if (isLiveMode) {
      import('./services/binanceWebSocket').then(({ binanceWS }) => {
        binanceWS.connect();
      });
    } else {
      import('./services/binanceWebSocket').then(({ binanceWS }) => {
        binanceWS.disconnect();
      });
    }

    return () => {
      import('./services/binanceWebSocket').then(({ binanceWS }) => {
        binanceWS.disconnect();
      });
    };
  }, [isLiveMode]);

  // Refs
  const binanceWS = useRef(new BinancePriceFeed());

  // Expire stale signals on mount
  useEffect(() => {
    const currentTime = Date.now();
    const SIGNAL_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours
    const signals = useStore.getState().signals || [];
    if (signals && signals.length > 0) {
      const validSignals = signals.filter(s => currentTime - s.timestamp < SIGNAL_EXPIRY);

      if (validSignals.length < signals.length) {
        useStore.setState({ signals: validSignals });
        if (import.meta.env.DEV) {
          console.log(`[Signals] Expired ${signals.length - validSignals.length} stale signals`);
        }
      }
    }
  }, []);

  // Start Market Data Sync
  useEffect(() => {
    const cleanup = startMarketDataSync();
    return cleanup;
  }, []);

  // Fetch Chart Data when timeframe changes
  useEffect(() => {
    fetchChartData();
  }, [timeframe]);

  // WebSocket Connection
  useEffect(() => {
    const ws = binanceWS.current;

    try {
      ws.connect();
    } catch (error) {
      console.error('[App] Binance WS connection failed:', error);
      captureError(error as Error, 'WebSocket Connection Failed', {
        component: 'App',
        websocket: 'BinancePriceFeed'
      });
    }

    return () => {
      try {
        ws.disconnect();
      } catch (error) {
        console.error('[App] Binance WS disconnect error:', error);
      }
    };
  }, []);

  // Aggr Order Flow Connection (Real-time liquidations, CVD, market pressure)
  useEffect(() => {
    aggrService.connect((stats) => {
      if (import.meta.env.DEV) {
        console.log('[Aggr] CVD:', stats.cvd.cumulativeDelta, 'Pressure:', stats.pressure.dominantSide);
      }
    });

    return () => aggrService.disconnect();
  }, []);

  // CRITICAL: Position Monitoring (The Engine Heartbeat)
  usePositionMonitor();

  // Helper for Trend Logic
  const getTrend = (metric: string, value: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
    if (metric === 'VIX') return value > 20 ? 'BEARISH' : value < 15 ? 'BULLISH' : 'NEUTRAL';
    if (metric === 'FUNDING') return value > 0.01 ? 'BULLISH' : value < 0 ? 'BEARISH' : 'NEUTRAL';
    if (metric === 'LS') return value > 1.2 ? 'BULLISH' : value < 0.8 ? 'BEARISH' : 'NEUTRAL';
    return 'NEUTRAL';
  };

  // Signal Execution Handler
  const handleSignalExecute = useCallback((signal: TradeSignal) => {
    setActiveTradeSetup({
      type: signal.type,
      stopLoss: parseFloat(signal.invalidation),
      takeProfit: parseFloat(signal.targets[0])
    });
  }, [setActiveTradeSetup]);

  // Premium Navigation Button Component
  const NavButton = ({ id, label, icon: Icon }: { id: ViewMode, label: string, icon: any }) => {
    const isActive = activeView === id;

    return (
      <button
        onClick={() => setActiveView(id)}
        title={`Switch to ${label} View`}
        className={`
          relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300
          text-xs font-semibold tracking-wide
          ${isActive
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.25)]'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent hover:border-white/10'
          }
        `}
      >
        {/* Icon */}
        <Icon size={16} />

        {/* Label */}
        <span>{label}</span>

        {/* Active Indicator Dot */}
        {isActive && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-400 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
        )}
      </button>
    );
  };

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  // Calculate Technicals when Chart Data updates
  useEffect(() => {
    if (!chartData || chartData.length < 50) return;

    const closes = chartData.map(c => c.close);
    const highs = chartData.map(c => c.high);
    const lows = chartData.map(c => c.low);

    // Calculate Indicators
    const rsiArray = calculateRSI(closes, 14);
    const rsi = (rsiArray && rsiArray.length > 0) ? rsiArray[rsiArray.length - 1] : 50;

    const macdData = calculateMACD(closes, 12, 26, 9);
    const macdHist = (macdData.histogram && macdData.histogram.length > 0) ? macdData.histogram[macdData.histogram.length - 1] : 0;
    const macdSignal = (macdData.signalLine && macdData.signalLine.length > 0) ? macdData.signalLine[macdData.signalLine.length - 1] : 0;
    const macdVal = (macdData.macdLine && macdData.macdLine.length > 0) ? macdData.macdLine[macdData.macdLine.length - 1] : 0;

    const adxData = calculateADX(highs, lows, closes, 14);
    const adx = (adxData.adx && adxData.adx.length > 0) ? adxData.adx[adxData.adx.length - 1] : 0;

    const atrArray = calculateATR(highs, lows, closes, 14);
    const atr = (atrArray && atrArray.length > 0) ? atrArray[atrArray.length - 1] : 0;

    // Trend Detection (EMA 21 vs 55)
    const ema21 = calculateEMA(closes, 21);
    const ema55 = calculateEMA(closes, 55);
    const last21 = (ema21 && ema21.length > 0) ? ema21[ema21.length - 1] : 0;
    const last55 = (ema55 && ema55.length > 0) ? ema55[ema55.length - 1] : 0;
    const trend = last21 > last55 ? 'BULLISH' : 'BEARISH';

    setTechnicals({
      rsi,
      macd: { histogram: macdHist, signal: macdSignal, macd: macdVal },
      adx,
      atr,
      trend
    });
  }, [chartData]);

  // Helper to map store trends to UI trends
  const mapTrend = (t: 'up' | 'down' | 'neutral'): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
    if (t === 'up') return 'BULLISH';
    if (t === 'down') return 'BEARISH';
    return 'NEUTRAL';
  };

  return (
    <div className="h-screen bg-black text-gray-200 font-sans selection:bg-green-900 selection:text-white overflow-hidden flex flex-col">
      {/* Elite Header with Glass Morphism */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 glass relative z-50 shrink-0">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-blue-500/5 pointer-events-none"></div>

        <div className="flex items-center gap-8 relative z-10">
          {/* Premium Branding */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Terminal className="w-6 h-6 text-green-400" />
              <div className="absolute inset-0 blur-md bg-green-500/30"></div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-wider text-lg text-gradient-bullish leading-none">
                IPCHA MISTABRA
              </span>
              <span className="text-[10px] text-gray-500 tracking-widest font-medium">ELITE TRADING INTELLIGENCE</span>
            </div>
          </div>

          {/* Navigation Tabs - Premium Edition */}
          <div className="flex items-center gap-2 border-l border-white/10 pl-8 h-10">
            <NavButton id="TERMINAL" label="TERMINAL" icon={Layout} />
            <NavButton id="SWARM" label="SWARM" icon={Users} />
            <NavButton id="CORTEX" label="ML CORTEX" icon={Brain} />
            <NavButton id="BACKTEST" label="BACKTEST" icon={LineChart} />
            <NavButton id="JOURNAL" label="JOURNAL" icon={BookOpen} />
          </div>
        </div>

        {/* Right Side Controls - Premium Status */}
        <div className="flex items-center gap-4 relative z-10">
          {/* Elite Status Indicators */}
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 hover:border-green-500/30 transition-all duration-300 group">
              <div className="status-indicator status-live"></div>
              <span className="text-gray-400 group-hover:text-green-400 transition-colors">LIVE FEED</span>
              <span className="text-gray-600">|</span>
              <span className="text-green-400 font-mono text-[10px]">3/3</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all duration-300 group">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-gray-400 group-hover:text-blue-400 transition-colors">AI CORE</span>
              <span className="text-gray-600">|</span>
              <span className="text-blue-400 font-mono text-[10px]">READY</span>
            </div>
          </div>

          {/* Version Badge */}
          <div className="badge-premium text-purple-400 border-purple-500/30 bg-purple-500/10">
            <span className="text-[10px] font-bold">v2.1 PRO</span>
          </div>
        </div>
      </header>

      {/* NEW: Blocked Status Banner */}
      <BlockedBanner />

      {/* Main Content Grid - PROFESSIONAL TRADING TERMINAL LAYOUT */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="grid grid-cols-12 gap-2 h-full fade-in">
          {/* LEFT SIDEBAR: AI Command + Order Flow (3 cols) */}
          <div className="col-span-3 flex flex-col gap-2 h-full overflow-hidden">
            {activeView === 'TERMINAL' && (
              <>
                {/* AI Command Center (Top 30%) */}
                <div className="h-[30%] min-h-[180px]">
                  <AiCommandCenter />
                </div>

                {/* Order Flow (Bottom 70% - LARGEST) */}
                <div className="h-[70%] flex flex-col">
                  <div className="flex-1 min-h-0">
                    <AggrOrderFlow />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* CENTER: Chart + Active Signals (6 cols) */}
          <div className="col-span-6 flex flex-col gap-2 h-full overflow-hidden">
            {activeView === 'TERMINAL' && (
              <>
                {/* Chart (75% height - DOMINANT VIEW) */}
                <div className="h-[75%] min-h-[450px]">
                  <ChartPanel />
                </div>

                {/* Active Signals (25% height) */}
                <div className="h-[25%] flex flex-col min-h-0">
                  <ActiveSignals onTrade={handleSignalExecute} />
                </div>
              </>
            )}
            {activeView === 'LIVEFEED' && (
              <div className="h-full w-full">
                <IntelDeck />
              </div>
            )}
            {activeView === 'SWARM' && <AgentSwarm />}
            {activeView === 'CORTEX' && <MLCortex />}
            {activeView === 'BACKTEST' && <BacktestPanel />}
            {activeView === 'JOURNAL' && (
              <div className="h-full grid grid-cols-12 gap-4">
                {/* Trade Journal (Left 7 cols) */}
                <div className="col-span-7 h-full">
                  <TradeJournal />
                </div>
                {/* Open Positions (Right 5 cols) */}
                <div className="col-span-5 h-full">
                  <PositionsPanel />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: AI TACTICAL BOT (3 cols) */}
          <div className="col-span-3 flex flex-col gap-2 h-full overflow-hidden">
            {activeView === 'TERMINAL' && (
              <div className="h-full">
                <AiTacticalBot />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

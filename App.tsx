import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Terminal, Layout, Users, Brain, BookOpen, LineChart } from 'lucide-react';
import { ChartPanel } from './components/ChartPanel';
import { IntelDeck } from './components/IntelDeck';
import { MetricCard } from './components/MetricCard';
import { AiCommandCenter } from './components/AiCommandCenter';
import { MLCortex } from './components/MLCortex';
import { AgentSwarm } from './components/AgentSwarm/SwarmCore';
import { ActiveSignals } from './components/ActiveSignals';
import { TradeSetupPanel } from './components/TradeSetupPanel';
import { TradeJournal } from './components/TradeJournal';
import { BacktestPanel } from './components/BacktestPanel';
import { AggrOrderFlow } from './components/AggrOrderFlow';
import {
  getSentimentAnalysis,
  getMacroMarketMetrics,
  getDerivativesMetrics,
  MacroMetrics,
} from './services/gemini';
import { startMarketDataSync, fetchChartData, fetchSignals } from './services/marketData';
import { calculateRSI, calculateATR, calculateADX, calculateEMA, calculateMACD } from './utils/technicalAnalysis';
import { BinancePriceFeed } from './services/websocket';
import { useStore } from './store/useStore';
import { ChartDataPoint } from './types';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { usePositionMonitor } from './hooks/usePositionMonitor';

type ViewMode = 'TERMINAL' | 'SWARM' | 'CORTEX' | 'JOURNAL' | 'BACKTEST';

function App() {
  // Global State
  const {
    price, priceChange,
    setPrice, setPriceChange,
    chartData, setChartData,
    signals, setSignals,
    journal, addJournalEntry,
    // New Global State
    vix, dxy, btcd, sentimentScore, sentimentLabel,
    derivatives, intel, trends,
    timeframe, setTimeframe,
    technicals, setTechnicals, // Global technicals
    isScanning // Scanning state
  } = useStore();

  // Local State for Dashboard
  const [activeView, setActiveView] = useState<ViewMode>('TERMINAL');
  const [bottomTab, setBottomTab] = useState<'SIGNALS' | 'ORDERFLOW'>('SIGNALS');
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // Refs
  const binanceWS = useRef(new BinancePriceFeed());

  // Check for API Key on Mount
  useEffect(() => {
    const fromProcessEnv = import.meta.env.VITE_GEMINI_API_KEY;
    const fromStorage = localStorage.getItem('GEMINI_API_KEY');

    if (!fromProcessEnv && !fromStorage) {
      setIsApiKeyMissing(true);
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
    ws.connect();
    return () => ws.disconnect();
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



  // Premium Navigation Button Component
  const NavButton = ({ id, label, icon: Icon }: { id: ViewMode, label: string, icon: any }) => {
    const isActive = activeView === id;

    return (
      <button
        onClick={() => setActiveView(id)}
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
    if (chartData.length < 50) return;

    const closes = chartData.map(c => c.close);
    const highs = chartData.map(c => c.high);
    const lows = chartData.map(c => c.low);

    // Calculate Indicators
    const rsiArray = calculateRSI(closes, 14);
    const rsi = rsiArray[rsiArray.length - 1] || 50;

    const macdData = calculateMACD(closes, 12, 26, 9);
    const macdHist = macdData.histogram[macdData.histogram.length - 1] || 0;
    const macdSignal = macdData.signalLine[macdData.signalLine.length - 1] || 0;
    const macdVal = macdData.macdLine[macdData.macdLine.length - 1] || 0;

    const adxData = calculateADX(highs, lows, closes, 14);
    const adx = adxData.adx[adxData.adx.length - 1] || 0;

    const atrArray = calculateATR(highs, lows, closes, 14);
    const atr = atrArray[atrArray.length - 1] || 0;

    // Trend Detection (EMA 21 vs 55)
    const ema21 = calculateEMA(closes, 21);
    const ema55 = calculateEMA(closes, 55);
    const last21 = ema21[ema21.length - 1];
    const last55 = ema55[ema55.length - 1];
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
      {isApiKeyMissing && <ApiKeyModal />}

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

      {/* Main Content Grid with Enhanced Spacing */}
      <main className="flex-1 overflow-hidden p-3">
        <div className="grid grid-cols-12 gap-3 h-full fade-in">
          {/* Left Column: Intel & Metrics (3 cols) */}
          <div className="col-span-3 flex flex-col gap-2 h-full overflow-hidden">
            <div className="h-1/3 min-h-[200px] grid grid-cols-2 gap-2">
              <MetricCard
                title="BTC PRICE"
                value={`$${price.toLocaleString()}`}
                subValue={`${priceChange > 0 ? '+' : ''}${priceChange}%`}
                color={priceChange >= 0 ? 'text-green-400' : 'text-red-400'}
                trend={mapTrend(trends.price)}
              />
              <MetricCard
                title="SENTIMENT"
                value={sentimentLabel}
                subValue={`Score: ${sentimentScore}`}
                color={sentimentScore > 60 ? 'text-green-400' : sentimentScore < 40 ? 'text-red-400' : 'text-yellow-400'}
                trend={mapTrend(trends.sentiment)}
              />
              <MetricCard
                title="VIX"
                value={vix.toFixed(2)}
                subValue="Volatility"
                color={vix > 20 ? 'text-red-400' : 'text-green-400'}
                trend={mapTrend(trends.vix)}
              />
              <MetricCard
                title="BTC DOM"
                value={`${btcd.toFixed(1)}%`}
                subValue="Dominance"
                color="text-yellow-400"
                trend={mapTrend(trends.btcd)}
              />
            </div>
            <div className="h-2/3 flex-1 min-h-0">
              <IntelDeck />
            </div>
          </div>

          {/* Center Column: Chart & Signals (6 cols) */}
          <div className="col-span-6 flex flex-col gap-2 h-full overflow-hidden">
            {activeView === 'TERMINAL' && (
              <>
                <div className="h-[60%] min-h-[300px]">
                  <ChartPanel />
                </div>
                <div className="h-[40%] flex-1 min-h-0 grid grid-cols-12 gap-3">
                  {/* Left Column: Signals & Order Flow (Tabs) */}
                  <div className="col-span-8 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <button
                        onClick={() => setBottomTab('SIGNALS')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-t-md border-t border-x border-transparent transition-all ${
                          bottomTab === 'SIGNALS'
                            ? 'bg-white/5 border-white/10 text-green-400 border-b-black'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        ACTIVE SIGNALS
                      </button>
                      <button
                        onClick={() => setBottomTab('ORDERFLOW')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-t-md border-t border-x border-transparent transition-all ${
                          bottomTab === 'ORDERFLOW'
                            ? 'bg-white/5 border-white/10 text-blue-400 border-b-black'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        ORDER FLOW
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 relative">
                      {bottomTab === 'SIGNALS' && <ActiveSignals />}
                      {bottomTab === 'ORDERFLOW' && <AggrOrderFlow />}
                    </div>
                  </div>

                  {/* Right Column: Trade Setup (Always Visible) */}
                  <div className="col-span-4 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-2 px-1 h-[34px]">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Target size={14} />
                            <span className="text-xs font-semibold tracking-wide">TRADE SETUP</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <TradeSetupPanel />
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeView === 'SWARM' && <AgentSwarm />}
            {activeView === 'CORTEX' && <MLCortex />}
            {activeView === 'BACKTEST' && <BacktestPanel />}
            {activeView === 'JOURNAL' && <TradeJournal />}
          </div>

          {/* Right Column: AI Command Center (3 cols) */}
          <div className="col-span-3 h-full overflow-hidden">
            <AiCommandCenter />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Terminal, Layout, Users, Brain, BookOpen } from 'lucide-react';
import { ChartPanel } from './components/ChartPanel';
import { IntelDeck } from './components/IntelDeck';
import { MetricCard } from './components/MetricCard';
import { AiCommandCenter } from './components/AiCommandCenter';
import { MLCortex } from './components/MLCortex';
import { AgentSwarm } from './components/AgentSwarm/SwarmCore';
import { ActiveSignals } from './components/ActiveSignals';
import { TradeSetupPanel } from './components/TradeSetupPanel';
import { TradeJournal } from './components/TradeJournal';
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

type ViewMode = 'TERMINAL' | 'SWARM' | 'CORTEX' | 'JOURNAL';

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
  const [latestAnalysis, setLatestAnalysis] = useState<string>("");
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

  // Helper for Trend Logic
  const getTrend = (metric: string, value: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
    if (metric === 'VIX') return value > 20 ? 'BEARISH' : value < 15 ? 'BULLISH' : 'NEUTRAL';
    if (metric === 'FUNDING') return value > 0.01 ? 'BULLISH' : value < 0 ? 'BEARISH' : 'NEUTRAL';
    if (metric === 'LS') return value > 1.2 ? 'BULLISH' : value < 0.8 ? 'BEARISH' : 'NEUTRAL';
    return 'NEUTRAL';
  };

  const handleNewAnalysis = (text: string) => {
    setLatestAnalysis(text);
  };

  // Navigation Button Component
  const NavButton = ({ id, label, icon: Icon }: { id: ViewMode, label: string, icon: any }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all font-mono text-xs ${activeView === id
        ? 'bg-terminal-accent/20 text-terminal-accent border border-terminal-accent/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
        }`}
    >
      <Icon size={14} />
      <span className="font-bold tracking-wider">{label}</span>
    </button>
  );

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
    <div className="h-screen bg-black text-gray-200 font-mono selection:bg-green-900 selection:text-white overflow-hidden flex flex-col">
      {isApiKeyMissing && <ApiKeyModal />}

      {/* Header */}
      <header className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-500" />
            <span className="font-bold tracking-widest text-green-500">IPCHA MISTABRA <span className="text-xs text-gray-500">v2.1</span></span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-l border-white/10 pl-6 h-8">
            <NavButton id="TERMINAL" label="TERMINAL" icon={Layout} />
            <NavButton id="SWARM" label="SWARM COUNCIL" icon={Users} />
            <NavButton id="CORTEX" label="ML CORTEX" icon={Brain} />
            <NavButton id="JOURNAL" label="JOURNAL" icon={BookOpen} />
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-4">
          {/* Status Indicators */}
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${binanceWS.current ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-gray-400">FEED</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-gray-400">AI CORE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="grid grid-cols-12 gap-2 h-full">
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
              <IntelDeck items={intel} />
            </div>
          </div>

          {/* Center Column: Chart & Signals (6 cols) */}
          <div className="col-span-6 flex flex-col gap-2 h-full overflow-hidden">
            {activeView === 'TERMINAL' && (
              <>
                <div className="h-[60%] min-h-[300px]">
                  <ChartPanel
                    data={chartData}
                    timeframe={timeframe}
                    onTimeframeChange={setTimeframe}
                    signals={signals}
                  />
                </div>
                <div className="h-[40%] flex-1 min-h-0 grid grid-cols-2 gap-2">
                  <ActiveSignals
                    signals={signals}
                    onScan={fetchSignals}
                    isScanning={isScanning}
                  />
                  <TradeSetupPanel latestAnalysis={latestAnalysis} />
                </div>
              </>
            )}
            {activeView === 'SWARM' && <AgentSwarm />}
            {activeView === 'CORTEX' && (
              <MLCortex
                data={chartData}
                macro={{ vix, dxy, btcd }}
                sentiment={{ score: sentimentScore, label: sentimentLabel }}
              />
            )}
            {activeView === 'JOURNAL' && (
              <TradeJournal
                entries={journal}
                onAddEntry={addJournalEntry}
              />
            )}
          </div>

          {/* Right Column: AI Command Center (3 cols) */}
          <div className="col-span-3 h-full overflow-hidden">
            <AiCommandCenter
              onNewAnalysis={handleNewAnalysis}
              marketData={{
                price,
                change: priceChange,
                vix: vix,
                btcd: btcd,
                sentiment: sentimentScore
              }}
              signals={signals}
              chartData={chartData}
              technicalIndicators={technicals}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

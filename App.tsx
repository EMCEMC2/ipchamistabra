import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Terminal, Layout, Users, Brain, BookOpen } from 'lucide-react';
import { ChartPanel } from './components/ChartPanel';
import { IntelDeck } from './components/IntelDeck';
import { MetricCard } from './components/MetricCard';
import { AiCommandCenter } from './components/AiCommandCenter';
import { MLCortex } from './components/MLCortex';
import { AgentSwarm } from './components/AgentSwarm/SwarmCore';
import { TradeJournal } from './components/TradeJournal';
import {
  getSentimentAnalysis,
  getMacroMarketMetrics,
  scanGlobalIntel,
  getDerivativesMetrics,
  MacroMetrics,
  TradeSignal,
  IntelItem
} from './services/gemini';
import { BinancePriceFeed } from './services/websocket';
import { useStore } from './store/useStore';
import { ChartDataPoint } from './types';

type ViewMode = 'TERMINAL' | 'SWARM' | 'CORTEX' | 'JOURNAL';

function App() {
  // Global State
  const {
    price, priceChange,
    setPrice, setPriceChange,
    chartData, setChartData,
    signals, setSignals,
    journal, addJournalEntry
  } = useStore();

  // Local State for Dashboard
  const [activeView, setActiveView] = useState<ViewMode>('TERMINAL');
  const [sentiment, setSentiment] = useState({ score: 50, label: 'Neutral' });
  const [macro, setMacro] = useState<MacroMetrics>({ vix: 0, dxy: 0, btcd: 0 });
  const [derivatives, setDerivatives] = useState({ openInterest: '-', fundingRate: '-', longShortRatio: 1.0 });
  const [intel, setIntel] = useState<IntelItem[]>([]);
  const [timeframe, setTimeframe] = useState('15m');
  const [latestAnalysis, setLatestAnalysis] = useState<string>("");

  // Refs
  const binanceWS = useRef(new BinancePriceFeed());

  // --- Data Fetching ---

  // 1. Chart History (Binance API)
  const fetchChartHistory = useCallback(async () => {
    try {
      // Map timeframe to Binance interval
      const intervalMap: Record<string, string> = {
        '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d'
      };
      const interval = intervalMap[timeframe] || '15m';

      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=200`);
      const data = await response.json();

      const formattedData: ChartDataPoint[] = data.map((d: any[]) => ({
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));

      setChartData(formattedData);
    } catch (e) {
      console.error("Chart Fetch Error:", e);
    }
  }, [timeframe, setChartData]);

  // 2. Global Data Loop
  useEffect(() => {
    const fetchData = async () => {
      try {
        const macroData = await getMacroMarketMetrics();
        setMacro(macroData);

        const derivData = await getDerivativesMetrics();
        setDerivatives(derivData);

        const sent = await getSentimentAnalysis();
        setSentiment(sent);

        const intelData = await scanGlobalIntel();
        setIntel(intelData);

      } catch (e) {
        console.error("Data Fetch Error:", e);
      }
    };

    fetchData();
    fetchChartHistory(); // Initial chart fetch

    const interval = setInterval(fetchData, 300000); // 5 minutes for macro
    const chartInterval = setInterval(fetchChartHistory, 60000); // 1 minute for chart

    return () => {
      clearInterval(interval);
      clearInterval(chartInterval);
    };
  }, [fetchChartHistory]);

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

  return (
    <div className="min-h-screen bg-black text-gray-200 font-mono selection:bg-green-900 selection:text-white overflow-hidden flex flex-col">
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

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">BTC/USDT</span>
            <span className={`font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-green-500 animate-pulse">SYSTEM OPTIMAL</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-2 overflow-hidden flex flex-col gap-2">

        {/* Top Row: Metrics */}
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-7 gap-2 h-[80px]">
          <MetricCard
            title="BITCOIN PRICE"
            value={`$${price.toLocaleString()}`}
            subValue={`${priceChange > 0 ? '+' : ''}${priceChange}% (24h)`}
            color={priceChange >= 0 ? 'text-green-400' : 'text-red-400'}
            trend={priceChange > 0 ? 'BULLISH' : 'BEARISH'}
          />
          <MetricCard
            title="SENTIMENT"
            value={sentiment.label}
            subValue={`Score: ${sentiment.score}`}
            color={sentiment.score > 50 ? 'text-green-400' : 'text-red-400'}
            trend={sentiment.score > 60 ? 'BULLISH' : sentiment.score < 40 ? 'BEARISH' : 'NEUTRAL'}
          />
          <MetricCard
            title="VIX (VOLATILITY)"
            value={macro.vix.toFixed(2)}
            subValue="Market Fear Index"
            color={macro.vix > 20 ? 'text-red-400' : 'text-green-400'}
            trend={getTrend('VIX', macro.vix)}
          />
          <MetricCard
            title="BTC DOMINANCE"
            value={`${macro.btcd.toFixed(1)}%`}
            subValue="Market Cap %"
            color="text-yellow-400"
            trend="NEUTRAL"
          />
          <MetricCard
            title="OPEN INTEREST"
            value={derivatives.openInterest}
            subValue="Total Active Positions"
            color="text-blue-400"
            trend="BULLISH"
          />
          <MetricCard
            title="FUNDING RATE"
            value={derivatives.fundingRate}
            subValue="Weighted Avg (8h)"
            color={parseFloat(derivatives.fundingRate) > 0 ? 'text-green-400' : 'text-red-400'}
            trend={getTrend('FUNDING', parseFloat(derivatives.fundingRate))}
          />
          <MetricCard
            title="LONG/SHORT RATIO"
            value={derivatives.longShortRatio.toFixed(2)}
            subValue="Global Sentiment"
            color={derivatives.longShortRatio > 1 ? 'text-green-400' : 'text-red-400'}
            trend={getTrend('LS', derivatives.longShortRatio)}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 min-h-0">

          {/* Left Column: Main View + Intel */}
          <div className="col-span-12 lg:col-span-9 flex flex-col gap-2 h-full min-h-0">

            {/* Main View (Chart/Swarm/Cortex) - Flex 1 to take available space */}
            <div className="flex-[2] bg-black/40 border border-white/10 rounded-sm overflow-hidden relative min-h-0">
              {activeView === 'TERMINAL' && (
                <ChartPanel
                  data={chartData}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  signals={signals}
                />
              )}
              {activeView === 'SWARM' && <AgentSwarm />}
              {activeView === 'CORTEX' && <MLCortex />}
              {activeView === 'JOURNAL' && (
                <TradeJournal
                  entries={journal}
                  onAddEntry={addJournalEntry}
                />
              )}
            </div>

            {/* Intel Deck - Fixed height or Flex 1 */}
            <div className="flex-1 bg-black/40 border border-white/10 rounded-sm overflow-hidden min-h-[200px]">
              <IntelDeck items={intel} latestAnalysis={latestAnalysis} />
            </div>
          </div>

          {/* Right Column: AI Command Center */}
          <div className="col-span-12 lg:col-span-3 h-full min-h-0">
            <div className="h-full bg-black/40 border border-white/10 rounded-sm overflow-hidden">
              <AiCommandCenter
                onNewAnalysis={handleNewAnalysis}
                marketData={{
                  price,
                  change: priceChange,
                  vix: macro.vix,
                  btcd: macro.btcd,
                  sentiment: sentiment.score
                }}
                signals={signals}
                chartData={chartData}
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;

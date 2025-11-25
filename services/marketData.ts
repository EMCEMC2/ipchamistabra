
import { useStore } from '../store/useStore';
import {
    getSentimentAnalysis,
    scanGlobalIntel,
    scanMarketForSignals
} from './gemini';
import { fetchMacroData, fetchDerivativesMetrics } from './macroDataService';

export const fetchGlobalData = async () => {
    try {
        // Parallel fetch for efficiency - NOW USING REAL APIs (not AI search)
        const [macro, derivatives, sentiment, intel] = await Promise.all([
            fetchMacroData(), // REAL Yahoo Finance + CoinGecko
            fetchDerivativesMetrics(), // REAL CoinGlass API
            getSentimentAnalysis(), // REAL Fear & Greed Index
            scanGlobalIntel() // Still AI-powered (for news), but not for metrics
        ]);

        useStore.setState({
            vix: macro.vix,
            dxy: macro.dxy,
            btcd: macro.btcd,
            derivatives: {
                openInterest: derivatives.openInterest,
                fundingRate: derivatives.fundingRate,
                longShortRatio: derivatives.longShortRatio
            },
            sentimentScore: sentiment.score,
            sentimentLabel: sentiment.label,
            intel: intel
        });

        console.log("✅ Global Data Synced (REAL APIs)");
    } catch (error) {
        console.error("❌ Global Data Sync Error:", error);
    }
};

export const fetchChartData = async () => {
    try {
        const timeframe = useStore.getState().timeframe;
        const intervalMap: Record<string, string> = {
            '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d'
        };
        const interval = intervalMap[timeframe] || '15m';

        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=200`);
        const data = await response.json();

        const formattedData = data.map((d: any[]) => ({
            time: d[0] / 1000,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        }));

        useStore.setState({ chartData: formattedData });

        // Note: Price updates come from WebSocket (primary source)
        // We don't update price from chart data to avoid conflicts
        // Chart data is for historical OHLCV only

        console.log("Chart Data Synced");
    } catch (e) {
        console.error("Chart Fetch Error:", e);
    }
};

export const fetchSignals = async () => {
    try {
        useStore.setState({ isScanning: true });
        const { price, vix, btcd, sentimentScore, technicals, chartData } = useStore.getState();

        // HYBRID APPROACH: Tactical v2 (rule-based) + AI validation
        // Step 1: Generate Tactical v2 signal from chart data
        const { generateTacticalSignal } = await import('./tacticalSignals');
        const tacticalResult = generateTacticalSignal(chartData);

        if (import.meta.env.DEV) {
            console.log('[Signal Gen] Tactical v2:', {
                signal: tacticalResult.signal ? tacticalResult.signal.type : 'NONE',
                bullScore: tacticalResult.bullScore,
                bearScore: tacticalResult.bearScore,
                regime: tacticalResult.regime
            });
        }

        // Step 2: Construct context for AI
        const context = `
            Price: ${price}
            VIX: ${vix}
            BTC.D: ${btcd}
            Sentiment: ${sentimentScore}
            Technicals: ${JSON.stringify(technicals || {})}
        `;

        // Step 3: Get AI signals with Tactical v2 context
        const rawSignals = await scanMarketForSignals(context, tacticalResult);

        // Step 4: Combine signals (prioritize Tactical v2 if strong)
        const signals = rawSignals.map(s => ({
            ...s,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now()
        }));

        // If Tactical v2 generated a signal with high score, include it
        if (tacticalResult.signal && (tacticalResult.bullScore >= 5.0 || tacticalResult.bearScore >= 5.0)) {
            signals.unshift({
                ...tacticalResult.signal,
                id: `tactical-${Date.now()}`,
                timestamp: Date.now()
            });
        }

        useStore.setState({ signals, isScanning: false });
        console.log(`[Signal Gen] Complete: ${signals.length} signals (Tactical: ${tacticalResult.signal ? 1 : 0}, AI: ${rawSignals.length})`);
    } catch (e) {
        console.error("Signal Fetch Error:", e);
        useStore.setState({ isScanning: false });
    }
};

export const startMarketDataSync = () => {
    // Initial Fetch
    fetchGlobalData();
    fetchChartData();

    // Adaptive chart polling based on timeframe
    const getChartInterval = (): number => {
        const timeframe = useStore.getState().timeframe;
        const intervalMap: Record<string, number> = {
            '1m': 5000,    // 5s for 1-minute chart (needs frequent updates)
            '5m': 15000,   // 15s for 5-minute chart
            '15m': 30000,  // 30s for 15-minute chart
            '1h': 60000,   // 1m for 1-hour chart
            '4h': 120000,  // 2m for 4-hour chart
            '1d': 300000   // 5m for daily chart
        };
        return intervalMap[timeframe] || 30000;
    };

    // Intervals
    const globalInterval = setInterval(fetchGlobalData, 60000); // 1 min
    let chartInterval = setInterval(fetchChartData, getChartInterval());

    // Subscribe to timeframe changes to adjust polling
    const unsubscribe = useStore.subscribe(
        (state) => state.timeframe,
        () => {
            clearInterval(chartInterval);
            chartInterval = setInterval(fetchChartData, getChartInterval());
            if (import.meta.env.DEV) {
                console.log(`[MarketData] Chart polling adjusted: ${getChartInterval()}ms`);
            }
        }
    );

    return () => {
        clearInterval(globalInterval);
        clearInterval(chartInterval);
        unsubscribe();
    };
};

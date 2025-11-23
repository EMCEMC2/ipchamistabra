
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

        // Update current price from the last candle
        if (formattedData.length > 0) {
            const lastCandle = formattedData[formattedData.length - 1];
            useStore.setState({ price: lastCandle.close });
        }

        console.log("Chart Data Synced");
    } catch (e) {
        console.error("Chart Fetch Error:", e);
    }
};

export const fetchSignals = async () => {
    try {
        useStore.setState({ isScanning: true });
        const { price, vix, btcd, sentimentScore, technicals } = useStore.getState();

        // Construct context for the AI
        const context = `
            Price: ${price}
            VIX: ${vix}
            BTC.D: ${btcd}
            Sentiment: ${sentimentScore}
            Technicals: ${JSON.stringify(technicals || {})}
        `;

        const rawSignals = await scanMarketForSignals(context);
        const signals = rawSignals.map(s => ({
            ...s,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now()
        }));

        useStore.setState({ signals, isScanning: false });
        console.log("Signals Synced:", signals.length);
    } catch (e) {
        console.error("Signal Fetch Error:", e);
        useStore.setState({ isScanning: false });
    }
};

export const startMarketDataSync = () => {
    // Initial Fetch
    fetchGlobalData();
    fetchChartData();

    // Intervals
    const globalInterval = setInterval(fetchGlobalData, 60000); // 1 min
    const chartInterval = setInterval(fetchChartData, 5000); // 5 sec

    return () => {
        clearInterval(globalInterval);
        clearInterval(chartInterval);
    };
};

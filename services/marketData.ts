
import { useStore } from '../store/useStore';
import {
    getSentimentAnalysis,
    scanGlobalIntel,
    scanMarketForSignals,
    generateMarketAnalysis,
    isAiAvailable
} from './gemini';
import { fetchMacroData, fetchDerivativesMetrics } from './macroDataService';
import { captureError, addBreadcrumb } from './errorMonitor';
import { dataSyncAgent } from './dataSyncAgent';

// Singleton Worker Instance
let tradingWorker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>();

const getWorker = () => {
    if (!tradingWorker) {
        tradingWorker = new Worker(new URL('./tradingWorker.ts', import.meta.url), { type: 'module' });
        
        tradingWorker.onmessage = (e) => {
            const { type, payload, requestId } = e.data;
            
            if (requestId && pendingRequests.has(requestId)) {
                const { resolve, reject } = pendingRequests.get(requestId)!;
                if (type === 'SIGNALS_GENERATED') {
                    resolve(payload);
                } else if (type === 'ERROR') {
                    reject(new Error(payload));
                }
                pendingRequests.delete(requestId);
            }
        };

        tradingWorker.onerror = (e) => {
            console.error('[Worker] Error:', e);
        };
    }
    return tradingWorker;
};

export const fetchGlobalData = async () => {
    try {
        addBreadcrumb('Fetching global market data', 'marketData');

        // Parallel fetch for efficiency - NOW USING REAL APIs (not AI search)
        const [macro, derivatives, sentiment, intel] = await Promise.all([
            fetchMacroData(), // REAL Yahoo Finance + CoinGecko
            fetchDerivativesMetrics(), // REAL Binance Futures API
            getSentimentAnalysis(), // REAL Fear & Greed Index
            isAiAvailable() ? scanGlobalIntel() : Promise.resolve([]) // Gate AI call
        ]);

        // Validate macro data before setting
        const macroValidation = dataSyncAgent.validateMacroData(macro);
        if (!macroValidation.isValid) {
            console.warn('[MarketData] Macro validation errors:', macroValidation.errors);
        }

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

        // Mark data source as updated
        dataSyncAgent.markDataUpdated('MACRO_DATA');

        addBreadcrumb('Global data synced successfully', 'marketData');
        console.log("Global Data Synced (REAL APIs)");
    } catch (error) {
        captureError(error as Error, 'Global Data Sync Failed', {
            macro: 'failed',
            timestamp: Date.now()
        });
        dataSyncAgent.updateSourceStatus('MACRO_DATA', 'error', (error as Error).message);
        console.error("Global Data Sync Error:", error);
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

        // Validate chart data before setting
        const chartValidation = dataSyncAgent.validateChartData(formattedData);
        if (!chartValidation.isValid) {
            console.warn('[MarketData] Chart validation errors:', chartValidation.errors);
        }

        useStore.setState({ chartData: formattedData });

        // Mark data source as updated
        dataSyncAgent.markDataUpdated('BINANCE_CHART');

        // Note: Price updates come from WebSocket (primary source)
        // We don't update price from chart data to avoid conflicts
        // Chart data is for historical OHLCV only

        console.log("Chart Data Synced");
    } catch (e) {
        dataSyncAgent.updateSourceStatus('BINANCE_CHART', 'error', (e as Error).message);
        console.error("Chart Fetch Error:", e);
    }
};

export const fetchSignals = async () => {
    try {
        useStore.setState({ isScanning: true });
        const { price, vix, btcd, sentimentScore, technicals, chartData } = useStore.getState();

        // HYBRID APPROACH: Tactical v2 (rule-based) + AI validation + ORDER FLOW
        // Step 1: Get current order flow stats (REAL-TIME)
        // Step 1: Get current order flow stats (REAL-TIME)
        const { aggrService } = await import('./aggrService');
        const orderFlowStats = aggrService.getStats();

        // Step 2: Offload to Web Worker (Singleton)
        const runWorkerTask = () => new Promise<{ tacticalResult: any; consensusData: any }>((resolve, reject) => {
            const worker = getWorker();
            const requestId = Math.random().toString(36).substr(2, 9);
            
            pendingRequests.set(requestId, { resolve, reject });

            // Send snapshot of state needed for calculation
            worker.postMessage({
                type: 'GENERATE_SIGNALS',
                payload: {
                    chartData,
                    orderFlowStats,
                    state: JSON.parse(JSON.stringify(useStore.getState()))
                },
                requestId
            });
        });

        const { tacticalResult, consensusData } = await runWorkerTask();

        if (import.meta.env.DEV) {
            console.log('[Signal Gen] Worker Result:', {
                signal: tacticalResult.signal ? tacticalResult.signal.type : 'NONE',
                consensus: consensusData.votes.length
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

        // Step 3: Get AI signals with Tactical v2 context (ONLY IF KEY EXISTS)
        let rawSignals: any[] = [];
        if (isAiAvailable()) {
            rawSignals = await scanMarketForSignals(context, tacticalResult);
        } else {
            console.log('[Signal Gen] Skipping AI scan (No API Key)');
        }

        // Step 4: Combine signals (prioritize Tactical v2 if strong)
        const signals = rawSignals.map(s => ({
            ...s,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            // Attach Consensus Data (Votes only, as breakdown is specific to Tactical)
            consensus: {
                votes: consensusData.votes,
                totalScore: s.confidence
            },
            // Add synthetic breakdown for AI signals so UI renders the Glass Box
            confidenceBreakdown: [
                {
                    label: 'AI Model Confidence',
                    value: s.confidence,
                    type: 'sentiment'
                }
            ]
        }));

        // If Tactical v2 generated a signal with high score, include it
        if (tacticalResult.signal && (tacticalResult.bullScore >= 5.0 || tacticalResult.bearScore >= 5.0)) {
            signals.unshift({
                ...tacticalResult.signal,
                id: `tactical-${Date.now()}`,
                timestamp: Date.now(),
                // Attach Consensus Data
                consensus: {
                    votes: consensusData.votes,
                    totalScore: tacticalResult.signal.confidence
                },
                confidenceBreakdown: consensusData.breakdown
            });
        }

        useStore.setState({ signals, isScanning: false });
        dataSyncAgent.markDataUpdated('SIGNALS');
        console.log(`[Signal Gen] Complete: ${signals.length} signals (Tactical: ${tacticalResult.signal ? 1 : 0}, AI: ${rawSignals.length})`);
    } catch (e) {
        console.error("Signal Fetch Error:", e);
        useStore.setState({ isScanning: false });
    }
};

/**
 * Fetch AI market analysis and update store
 */
export const fetchAiAnalysis = async () => {
    if (!isAiAvailable()) {
        console.log('[AI Analysis] Skipping - No API Key');
        return;
    }

    try {
        const { price, vix, btcd, sentimentScore, technicals, signals } = useStore.getState();

        const query = `
            Analyze the current BTC market conditions:
            - Price: $${price?.toLocaleString() || 'N/A'}
            - VIX: ${vix || 'N/A'}
            - BTC Dominance: ${btcd || 'N/A'}%
            - Fear & Greed: ${sentimentScore || 'N/A'}
            - RSI: ${technicals?.rsi?.toFixed(1) || 'N/A'}
            - MACD: ${technicals?.macd?.histogram?.toFixed(2) || 'N/A'}
            - Trend: ${technicals?.trend || 'N/A'}

            Provide a concise tactical analysis for short-term trading.
        `;

        const result = await generateMarketAnalysis(query, signals);

        if (result.text) {
            useStore.getState().setLatestAnalysis(result.text);
            console.log('[AI Analysis] Updated latestAnalysis');
        }
    } catch (error) {
        console.error('[AI Analysis] Error:', error);
    }
};

export const startMarketDataSync = () => {
    // Start the DataSyncAgent
    dataSyncAgent.start();

    // Initial Fetch
    fetchGlobalData();
    fetchChartData();

    // Delayed AI analysis (wait for initial data to load)
    setTimeout(() => {
        fetchAiAnalysis();
    }, 5000);

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
    const aiAnalysisInterval = setInterval(fetchAiAnalysis, 120000); // 2 min for AI analysis

    // Subscribe to timeframe changes to adjust polling
    // Subscribe to timeframe changes to adjust polling
    let lastTimeframe = useStore.getState().timeframe;
    const unsubscribe = useStore.subscribe((state) => {
        const newTimeframe = state.timeframe;
        if (newTimeframe !== lastTimeframe) {
            lastTimeframe = newTimeframe;
            clearInterval(chartInterval);
            chartInterval = setInterval(fetchChartData, getChartInterval());
            if (import.meta.env.DEV) {
                console.log(`[MarketData] Chart polling adjusted: ${getChartInterval()}ms`);
            }
        }
    });

    return () => {
        clearInterval(globalInterval);
        clearInterval(chartInterval);
        clearInterval(aiAnalysisInterval);
        unsubscribe();
        dataSyncAgent.stop();
    };
};

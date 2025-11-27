import express from 'express';
import cors from 'cors';
import http from 'http';
import WebSocket from 'ws';
import { config } from './config';
import { tradingRoutes } from './routes/trading';
import { macroRoutes } from './routes/macro';

const app = express();
const server = http.createServer(app);

// WebSocket Server for Order Flow Proxy
const wss = new WebSocket.Server({ server, path: '/ws/orderflow' });

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/trading', tradingRoutes);
app.use('/api/macro', macroRoutes);

// ==================== ORDER FLOW REST API ====================

// Open Interest endpoint
app.get('/api/orderflow/open-interest', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch open interest' });
    }
});

// Long/Short Ratio endpoint
app.get('/api/orderflow/long-short-ratio', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch long/short ratio' });
    }
});

// Top Trader Long/Short Ratio (Positions)
app.get('/api/orderflow/top-trader-ratio', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=5m&limit=1');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top trader ratio' });
    }
});

// Taker Buy/Sell Volume
app.get('/api/orderflow/taker-volume', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=5m&limit=1');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch taker volume' });
    }
});

// Funding Rate endpoint
app.get('/api/orderflow/funding-rate', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch funding rate' });
    }
});

// Recent Trades (for aggregation)
app.get('/api/orderflow/recent-trades', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/trades?symbol=BTCUSDT&limit=500');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent trades' });
    }
});

// Aggregated Trades (last 1 minute)
app.get('/api/orderflow/agg-trades', async (req, res) => {
    try {
        const endTime = Date.now();
        const startTime = endTime - 60000; // 1 minute
        const response = await fetch(`https://fapi.binance.com/fapi/v1/aggTrades?symbol=BTCUSDT&startTime=${startTime}&endTime=${endTime}&limit=1000`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch aggregated trades' });
    }
});

// Liquidation Orders (forced orders)
app.get('/api/orderflow/liquidations', async (req, res) => {
    try {
        const response = await fetch('https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=50');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch liquidations' });
    }
});

// ==================== WEBSOCKET PROXY ====================

interface ExchangeConnection {
    ws: WebSocket | null;
    exchange: string;
    reconnectAttempts: number;
}

const exchangeConnections: Map<string, ExchangeConnection> = new Map();

function connectToExchange(clientWs: WebSocket, exchange: string, url: string, subscribeMsg: any) {
    const key = `${exchange}-${clientWs}`;

    const exchangeWs = new WebSocket(url);

    exchangeWs.on('open', () => {
        console.log(`[WS Proxy] Connected to ${exchange}`);
        exchangeWs.send(JSON.stringify(subscribeMsg));
    });

    exchangeWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ exchange, data: JSON.parse(data.toString()) }));
        }
    });

    exchangeWs.on('close', () => {
        console.log(`[WS Proxy] ${exchange} connection closed`);
    });

    exchangeWs.on('error', (error) => {
        console.error(`[WS Proxy] ${exchange} error:`, error.message);
    });

    return exchangeWs;
}

wss.on('connection', (clientWs) => {
    console.log('[WS Proxy] Client connected');

    const connections: WebSocket[] = [];

    // Connect to Binance Futures
    const binanceFutures = connectToExchange(
        clientWs,
        'binance_futures',
        'wss://fstream.binance.com/ws',
        { method: 'SUBSCRIBE', params: ['btcusdt@aggTrade', 'btcusdt@forceOrder'], id: 1 }
    );
    connections.push(binanceFutures);

    // Connect to Bybit
    const bybit = connectToExchange(
        clientWs,
        'bybit',
        'wss://stream.bybit.com/v5/public/linear',
        { op: 'subscribe', args: ['publicTrade.BTCUSDT', 'liquidation.BTCUSDT'] }
    );
    connections.push(bybit);

    clientWs.on('close', () => {
        console.log('[WS Proxy] Client disconnected');
        connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
    });

    clientWs.on('error', (error) => {
        console.error('[WS Proxy] Client error:', error);
    });
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Start Server
server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`WebSocket proxy available at ws://localhost:${config.port}/ws/orderflow`);
    console.log(`Environment: ${config.binance.apiKey ? 'Keys Loaded' : 'Keys Missing'}`);
});

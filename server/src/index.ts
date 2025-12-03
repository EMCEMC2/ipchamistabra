import express from 'express';
import cors from 'cors';
import http from 'http';
import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { config } from './config';
import { tradingRoutes } from './routes/trading';
import { macroRoutes } from './routes/macro';
import { keyRoutes } from './routes/keys';
import { aiRoutes } from './routes/ai';

// WebSocket Security Configuration
const WS_MAX_CONNECTIONS_PER_IP = 5;
const WS_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const WS_MAX_CONNECTIONS_TOTAL = 100;

// Environment Configuration (needed before WebSocket server init)
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = isDev
    ? (process.env.CORS_ORIGINS_DEV ? process.env.CORS_ORIGINS_DEV.split(',') : ['http://localhost:5173', 'http://localhost:3000'])
    : (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []);

const app = express();
const server = http.createServer(app);

// WebSocket Server for Order Flow Proxy with verification
const wss = new WebSocket.Server({
    server,
    path: '/ws/orderflow',
    verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }, callback) => {
        // Get client IP
        const clientIp = info.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
                        info.req.socket.remoteAddress ||
                        'unknown';

        // Check total connections limit
        if (wss.clients.size >= WS_MAX_CONNECTIONS_TOTAL) {
            console.warn(`[WS Security] Rejecting connection: Total limit reached (${WS_MAX_CONNECTIONS_TOTAL})`);
            callback(false, 503, 'Server at capacity');
            return;
        }

        // Check per-IP connection limit
        const connectionsFromIp = Array.from(wss.clients).filter(client => {
            const clientData = (client as any)._clientIp;
            return clientData === clientIp;
        }).length;

        if (connectionsFromIp >= WS_MAX_CONNECTIONS_PER_IP) {
            console.warn(`[WS Security] Rejecting connection from ${clientIp}: Per-IP limit reached`);
            callback(false, 429, 'Too many connections from this IP');
            return;
        }

        // Origin validation (in production)
        const origin = info.origin || info.req.headers.origin;
        if (!isDev && origin) {
            if (!allowedOrigins.includes(origin)) {
                console.warn(`[WS Security] Rejecting connection from unauthorized origin: ${origin}`);
                callback(false, 403, 'Origin not allowed');
                return;
            }
        }

        // Optional: Token-based authentication via query string
        const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token');

        // If WS_AUTH_REQUIRED is set, require token
        if (process.env.WS_AUTH_REQUIRED === 'true') {
            const validToken = process.env.WS_AUTH_TOKEN;
            if (!validToken || token !== validToken) {
                console.warn(`[WS Security] Rejecting connection: Invalid or missing token`);
                callback(false, 401, 'Authentication required');
                return;
            }
        }

        // Store client IP for tracking
        (info.req as any)._clientIp = clientIp;

        callback(true);
    }
});

// CORS Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) ONLY in Dev
        if (!origin) {
            if (isDev) return callback(null, true);
            console.warn('CORS: Blocked request with no origin in Production');
            return callback(new Error('Not allowed by CORS'));
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS: Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-trading-key', 'X-MBX-APIKEY', 'x-admin-secret']
}));
app.use(express.json());

// Routes
app.use('/api/trading', tradingRoutes);
app.use('/api/macro', macroRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/ai', aiRoutes);

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

wss.on('connection', (clientWs, req) => {
    // Store client IP from verification phase for tracking
    const clientIp = (req as any)._clientIp || 'unknown';
    (clientWs as any)._clientIp = clientIp;

    console.log(`[WS Proxy] Client connected from ${clientIp}`);

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
    console.log('AI Routes Registered: /api/ai');
});

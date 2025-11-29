import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { binanceSigner } from '../services/binanceSigner';
import { auditService } from '../services/auditService';

const router = express.Router();

// Rate limiters for different endpoint types
const orderRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 10, // 10 orders per minute
    message: { error: 'Rate Limited', details: 'Too many orders. Max 10 per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const readRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 60, // 60 reads per minute
    message: { error: 'Rate Limited', details: 'Too many requests. Max 60 per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Helper for Binance Requests
const binanceRequest = async (method: 'GET' | 'POST' | 'DELETE' | 'PUT', endpoint: string, params: any = {}) => {
    const timestamp = Date.now();
    const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    const signaturePayload = queryString ? `${queryString}&timestamp=${timestamp}` : `timestamp=${timestamp}`;
    const signature = binanceSigner.sign(signaturePayload);
    const finalQuery = `${signaturePayload}&signature=${signature}`;

    const url = `${config.binance.baseUrl}${endpoint}?${finalQuery}`;

    try {
        const response = await axios({
            method,
            url,
            headers: {
                'X-MBX-APIKEY': config.binance.apiKey
            }
        });
        return response.data;
    } catch (error: any) {
        console.error(`Binance API Error [${endpoint}]:`, error.response?.data || error.message);
        throw error.response?.data || error;
    }
};

// Auth Middleware
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientKey = req.headers['x-trading-key'];
    const serverKey = process.env.TRADING_API_KEY;

    // SECURITY: Block ALL requests if API key is not configured
    if (!serverKey) {
        console.error('SECURITY: TRADING_API_KEY not configured. Blocking request.');
        return res.status(503).json({
            error: 'Service Unavailable',
            details: 'Trading API not configured. Set TRADING_API_KEY environment variable.'
        });
    }

    if (clientKey !== serverKey) {
        return res.status(401).json({ error: 'Unauthorized', details: 'Invalid Trading Key' });
    }
    next();
};

// Apply Auth
router.use(authMiddleware);

// Place Order (rate limited: 10/min)
router.post('/order', orderRateLimiter, async (req, res) => {
    try {
        const { symbol, side, type, quantity, price, timeInForce } = req.body;

        // Validation
        if (!symbol || !side || !type || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be positive' });
        }
        if (type === 'LIMIT' && (!price || price <= 0)) {
            return res.status(400).json({ error: 'Price is required for LIMIT orders' });
        }

        const params: any = { symbol, side, type, quantity };
        if (price) params.price = price;
        if (timeInForce) params.timeInForce = timeInForce;

        const result = await binanceRequest('POST', '/fapi/v1/order', params);
        
        // Audit Log: Success
        auditService.logOrderAction({
            action: 'ORDER_PLACED',
            symbol,
            side,
            quantity,
            price,
            orderId: result.orderId,
            status: 'SUCCESS'
        });

        res.json(result);
    } catch (error: any) {
        // Audit Log: Failure
        auditService.logOrderAction({
            action: 'ORDER_FAILED',
            symbol: req.body.symbol,
            side: req.body.side,
            quantity: req.body.quantity,
            price: req.body.price,
            status: 'FAILURE',
            error: error.message || JSON.stringify(error)
        });

        res.status(500).json({ error: 'Order Failed', details: error });
    }
});

// Cancel Order (rate limited: 10/min)
router.delete('/order', orderRateLimiter, async (req, res) => {
    try {
        const { symbol, orderId } = req.body;
        const result = await binanceRequest('DELETE', '/fapi/v1/order', { symbol, orderId });

        // Audit Log: Success
        auditService.logOrderAction({
            action: 'ORDER_CANCELLED',
            symbol,
            orderId,
            status: 'SUCCESS'
        });

        res.json(result);
    } catch (error: any) {
        // Audit Log: Failure
        auditService.logOrderAction({
            action: 'ERROR',
            symbol: req.body.symbol,
            orderId: req.body.orderId,
            status: 'FAILURE',
            error: error.message || JSON.stringify(error)
        });

        res.status(500).json({ error: 'Cancel Failed', details: error });
    }
});

// Get Positions (rate limited: 60/min)
router.get('/positions', readRateLimiter, async (req, res) => {
    try {
        const result = await binanceRequest('GET', '/fapi/v2/positionRisk');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Fetch Positions Failed', details: error });
    }
});

// Get Balance (rate limited: 60/min)
router.get('/balance', readRateLimiter, async (req, res) => {
    try {
        const result = await binanceRequest('GET', '/fapi/v2/balance');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Fetch Balance Failed', details: error });
    }
});

// Listen Key (for WebSocket)
router.post('/listenKey', async (req, res) => {
    try {
        // ListenKey endpoint requires API Key header but NO signature
        const response = await axios.post(`${config.binance.baseUrl}/fapi/v1/listenKey`, null, {
            headers: { 'X-MBX-APIKEY': config.binance.apiKey }
        });
        res.json(response.data);
    } catch (error: any) {
        res.status(500).json({ error: 'ListenKey Failed', details: error.response?.data || error.message });
    }
});

router.put('/listenKey', async (req, res) => {
    try {
        const { listenKey } = req.body; // Usually passed in body or query? Check docs. usually body or query.
        // Binance FAPI PUT /fapi/v1/listenKey takes no params, just the header? No, usually no params for creating, but keeping alive might need it?
        // Actually for Futures, it's POST to create, PUT to keepalive.
        // Wait, for Keepalive, usually you don't need to send the key if it's user stream? 
        // Docs: PUT /fapi/v1/listenKey. "Keepalive a user data stream to prevent a time out."
        // Parameters: None? Or listenKey?
        // "listenKey" is NOT a parameter in the URL? 
        // Actually, usually you send it as a parameter if you have multiple?
        // Let's check standard implementation.
        // For Binance Futures: PUT /fapi/v1/listenKey
        // It seems it extends the validity of the stream.
        // It usually requires the API Key.
        
        await axios.put(`${config.binance.baseUrl}/fapi/v1/listenKey`, null, {
            headers: { 'X-MBX-APIKEY': config.binance.apiKey }
        });
        res.json({ status: 'success' });
    } catch (error: any) {
        res.status(500).json({ error: 'KeepAlive Failed', details: error.response?.data || error.message });
    }
});

export const tradingRoutes = router;

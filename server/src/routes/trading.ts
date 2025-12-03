import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import * as crypto from 'crypto';
import { config } from '../config';
import { binanceSigner } from '../services/binanceSigner';
import { auditService } from '../services/auditService';

const router = express.Router();

// SECURITY: Allowed values for order parameters
const VALID_SIDES = ['BUY', 'SELL'] as const;
const VALID_ORDER_TYPES = ['MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'] as const;
const VALID_TIME_IN_FORCE = ['GTC', 'IOC', 'FOK'] as const;
const VALID_SYMBOL_PATTERN = /^[A-Z]{2,10}USDT?$/; // e.g., BTCUSDT, ETHUSDT
const MAX_QUANTITY = 100; // Max 100 BTC per order (safety limit)

/**
 * SECURITY: Generate correlation ID for error tracking
 * Returns sanitized error without exposing internal details
 */
function sanitizeError(error: any, context: string): { correlationId: string; message: string } {
    const correlationId = crypto.randomBytes(8).toString('hex');
    const timestamp = new Date().toISOString();

    // Log detailed error server-side with correlation ID
    console.error(`[${timestamp}] [${correlationId}] ${context}:`, {
        message: error.message || 'Unknown error',
        code: error.code,
        response: error.response?.data,
        stack: error.stack
    });

    // Return sanitized error to client
    return {
        correlationId,
        message: 'An error occurred processing your request'
    };
}

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

        // SECURITY: Strict input validation with whitelisting
        if (!symbol || !side || !type || quantity === undefined) {
            return res.status(400).json({ error: 'Missing required fields: symbol, side, type, quantity' });
        }

        // Validate symbol format
        const upperSymbol = String(symbol).toUpperCase();
        if (!VALID_SYMBOL_PATTERN.test(upperSymbol)) {
            return res.status(400).json({ error: 'Invalid symbol format. Expected: BTCUSDT, ETHUSDT, etc.' });
        }

        // Validate side
        const upperSide = String(side).toUpperCase();
        if (!VALID_SIDES.includes(upperSide as any)) {
            return res.status(400).json({ error: `Invalid side. Must be one of: ${VALID_SIDES.join(', ')}` });
        }

        // Validate type
        const upperType = String(type).toUpperCase();
        if (!VALID_ORDER_TYPES.includes(upperType as any)) {
            return res.status(400).json({ error: `Invalid order type. Must be one of: ${VALID_ORDER_TYPES.join(', ')}` });
        }

        // Validate quantity
        const numQuantity = Number(quantity);
        if (!Number.isFinite(numQuantity) || numQuantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive number' });
        }
        if (numQuantity > MAX_QUANTITY) {
            return res.status(400).json({ error: `Quantity exceeds maximum limit of ${MAX_QUANTITY}` });
        }

        // Validate price for LIMIT orders
        if (upperType === 'LIMIT') {
            const numPrice = Number(price);
            if (!Number.isFinite(numPrice) || numPrice <= 0) {
                return res.status(400).json({ error: 'Price is required and must be positive for LIMIT orders' });
            }
        }

        // Validate timeInForce if provided
        if (timeInForce) {
            const upperTIF = String(timeInForce).toUpperCase();
            if (!VALID_TIME_IN_FORCE.includes(upperTIF as any)) {
                return res.status(400).json({ error: `Invalid timeInForce. Must be one of: ${VALID_TIME_IN_FORCE.join(', ')}` });
            }
        }

        const params: any = {
            symbol: upperSymbol,
            side: upperSide,
            type: upperType,
            quantity: numQuantity
        };
        if (price) params.price = Number(price);
        if (timeInForce) params.timeInForce = String(timeInForce).toUpperCase();

        const result = await binanceRequest('POST', '/fapi/v1/order', params);

        // Audit Log: Success
        auditService.logOrderAction({
            action: 'ORDER_PLACED',
            symbol: upperSymbol,
            side: upperSide,
            quantity: numQuantity,
            price: params.price,
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
            error: error.message || 'Unknown error'
        });

        // SECURITY: Return sanitized error without internal details
        const sanitized = sanitizeError(error, 'Order Failed');
        res.status(500).json({
            error: 'Order Failed',
            correlationId: sanitized.correlationId,
            message: sanitized.message
        });
    }
});

// Cancel Order (rate limited: 10/min)
router.delete('/order', orderRateLimiter, async (req, res) => {
    try {
        const { symbol, orderId } = req.body;

        // Validate inputs
        if (!symbol || !orderId) {
            return res.status(400).json({ error: 'Missing required fields: symbol, orderId' });
        }

        const upperSymbol = String(symbol).toUpperCase();
        if (!VALID_SYMBOL_PATTERN.test(upperSymbol)) {
            return res.status(400).json({ error: 'Invalid symbol format' });
        }

        const result = await binanceRequest('DELETE', '/fapi/v1/order', { symbol: upperSymbol, orderId });

        // Audit Log: Success
        auditService.logOrderAction({
            action: 'ORDER_CANCELLED',
            symbol: upperSymbol,
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
            error: error.message || 'Unknown error'
        });

        // SECURITY: Return sanitized error
        const sanitized = sanitizeError(error, 'Cancel Failed');
        res.status(500).json({
            error: 'Cancel Failed',
            correlationId: sanitized.correlationId,
            message: sanitized.message
        });
    }
});

// Get Positions (rate limited: 60/min)
router.get('/positions', readRateLimiter, async (req, res) => {
    try {
        const result = await binanceRequest('GET', '/fapi/v2/positionRisk');
        res.json(result);
    } catch (error) {
        const sanitized = sanitizeError(error, 'Fetch Positions Failed');
        res.status(500).json({
            error: 'Fetch Positions Failed',
            correlationId: sanitized.correlationId,
            message: sanitized.message
        });
    }
});

// Get Balance (rate limited: 60/min)
router.get('/balance', readRateLimiter, async (req, res) => {
    try {
        const result = await binanceRequest('GET', '/fapi/v2/balance');
        res.json(result);
    } catch (error) {
        const sanitized = sanitizeError(error, 'Fetch Balance Failed');
        res.status(500).json({
            error: 'Fetch Balance Failed',
            correlationId: sanitized.correlationId,
            message: sanitized.message
        });
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
        const sanitized = sanitizeError(error, 'ListenKey Failed');
        res.status(500).json({
            error: 'ListenKey Failed',
            correlationId: sanitized.correlationId,
            message: sanitized.message
        });
    }
});

router.put('/listenKey', async (req, res) => {
    try {
        await axios.put(`${config.binance.baseUrl}/fapi/v1/listenKey`, null, {
            headers: { 'X-MBX-APIKEY': config.binance.apiKey }
        });
        res.json({ status: 'success' });
    } catch (error: any) {
        const sanitized = sanitizeError(error, 'KeepAlive Failed');
        res.status(500).json({
            error: 'KeepAlive Failed',
            correlationId: sanitized.correlationId,
            message: sanitized.message
        });
    }
});

export const tradingRoutes = router;

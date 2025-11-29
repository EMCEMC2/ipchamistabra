import express from 'express';
import { keyManager } from '../services/keyManager';

import { config } from '../config';

const router = express.Router();

// Middleware to check for Admin Secret
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminSecret = config.adminSecret;
    const providedSecret = req.headers['x-admin-secret'];

    if (providedSecret !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized', details: 'Invalid Admin Secret' });
    }
    next();
};

// Check if keys are configured (Public - no secret needed to check status)
router.get('/check', (req, res) => {
    const apiKey = keyManager.getKey('BINANCE_TESTNET_KEY');
    const apiSecret = keyManager.getKey('BINANCE_TESTNET_SECRET');
    const geminiKey = keyManager.getKey('GEMINI_API_KEY');
    
    res.json({
        configured: !!(apiKey && apiSecret),
        binanceKeyConfigured: !!apiKey,
        binanceSecretConfigured: !!apiSecret,
        geminiKeyConfigured: !!geminiKey
    });
});

// Set Keys (Protected)
router.post('/', adminAuth, (req, res) => {
    const { apiKey, apiSecret, tradingKey, geminiKey } = req.body;

    if (!apiKey && !apiSecret && !tradingKey && !geminiKey) {
        return res.status(400).json({ error: 'No keys provided' });
    }

    const updates: any = {};
    if (apiKey) updates.BINANCE_TESTNET_KEY = apiKey;
    if (apiSecret) updates.BINANCE_TESTNET_SECRET = apiSecret;
    if (tradingKey) updates.TRADING_API_KEY = tradingKey;
    if (geminiKey) updates.GEMINI_API_KEY = geminiKey;

    keyManager.setSecrets(updates);

    res.json({ status: 'success', message: 'Keys updated successfully' });
});

export const keyRoutes = router;

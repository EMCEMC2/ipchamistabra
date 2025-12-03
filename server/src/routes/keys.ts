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

// Check if keys are configured (Protected - requires admin secret)
router.get('/check', adminAuth, (req, res) => {
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

// Set Keys (Protected) - DISABLED for security
// Keys must be configured via environment variables
router.post('/', adminAuth, (req, res) => {
    // SECURITY: File-based secret storage has been disabled
    // All secrets must be configured via environment variables
    res.status(403).json({
        error: 'Disabled',
        details: 'Runtime key updates are disabled for security. Configure secrets via environment variables: BINANCE_TESTNET_KEY, BINANCE_TESTNET_SECRET, TRADING_API_KEY, GEMINI_API_KEY'
    });
});

export const keyRoutes = router;

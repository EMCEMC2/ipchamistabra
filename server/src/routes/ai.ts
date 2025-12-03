import express from 'express';
import rateLimit from 'express-rate-limit';
import { aiService } from '../services/aiService';
import { config } from '../config';

const router = express.Router();

// Rate limiter for AI endpoints (more restrictive than trading)
const aiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 20, // 20 AI requests per minute
    message: { error: 'Rate Limited', details: 'Too many AI requests. Max 20 per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth Middleware for AI endpoints
const aiAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminSecret = config.adminSecret;
    const providedSecret = req.headers['x-admin-secret'];

    if (!adminSecret) {
        return res.status(503).json({
            error: 'Service Unavailable',
            details: 'AI service not configured'
        });
    }

    if (providedSecret !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized', details: 'Invalid credentials' });
    }
    next();
};

// Generate Content Proxy (authenticated + rate limited)
router.post('/generate', aiAuth, aiRateLimiter, async (req, res) => {
    try {
        const { model, contents, config } = req.body;

        if (!model || !contents) {
            return res.status(400).json({ error: 'Missing model or contents' });
        }

        const response = await aiService.generateContent(model, contents, config);
        res.json(response);
    } catch (error: any) {
        console.error('AI Proxy Error:', error);
        res.status(500).json({ 
            error: 'AI Generation Failed', 
            details: error.message || 'Unknown error' 
        });
    }
});

export const aiRoutes = router;

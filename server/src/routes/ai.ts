import express from 'express';
import { aiService } from '../services/aiService';

const router = express.Router();

// Generate Content Proxy
router.post('/generate', async (req, res) => {
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

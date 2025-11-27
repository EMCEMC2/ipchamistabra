import express from 'express';
import cors from 'cors';
import { config } from './config';
import { tradingRoutes } from './routes/trading';
import { macroRoutes } from './routes/macro';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/trading', tradingRoutes);
app.use('/api/macro', macroRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Start Server
app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Environment: ${config.binance.apiKey ? 'Keys Loaded' : 'Keys Missing'}`);
});

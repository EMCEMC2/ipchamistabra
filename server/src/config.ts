import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
// Load environment variables from .env file
dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    binance: {
        apiKey: process.env.BINANCE_TESTNET_KEY || '',
        apiSecret: process.env.BINANCE_TESTNET_SECRET || '',
        baseUrl: 'https://testnet.binancefuture.com'
    }
};

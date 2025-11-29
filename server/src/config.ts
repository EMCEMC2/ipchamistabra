import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
// Load environment variables from .env file
dotenv.config();

import { keyManager } from './services/keyManager';

export const config = {
    port: process.env.PORT || 3000,
    adminSecret: process.env.ADMIN_SECRET || 'admin-secret',
    binance: {
        apiKey: keyManager.getKey('BINANCE_TESTNET_KEY'),
        apiSecret: keyManager.getKey('BINANCE_TESTNET_SECRET'),
        baseUrl: 'https://testnet.binancefuture.com'
    }
};

// Enforce strong admin secret in production
if (process.env.NODE_ENV === 'production' && config.adminSecret === 'admin-secret') {
    throw new Error('CRITICAL SECURITY ERROR: ADMIN_SECRET must be set in production environment.');
}

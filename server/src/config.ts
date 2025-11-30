import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

import { keyManager } from './services/keyManager';

// Fail fast if ADMIN_SECRET is not set (no weak defaults)
const getAdminSecret = (): string => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CRITICAL: ADMIN_SECRET environment variable must be set in production');
        }
        console.warn('[Config] WARNING: ADMIN_SECRET not set. Using development fallback. DO NOT use in production.');
        return 'dev-only-secret-' + Math.random().toString(36).slice(2);
    }
    if (secret.length < 32) {
        console.warn('[Config] WARNING: ADMIN_SECRET should be at least 32 characters for security');
    }
    return secret;
};

export const config = {
    port: process.env.PORT || 3000,
    adminSecret: getAdminSecret(),
    binance: {
        apiKey: keyManager.getKey('BINANCE_TESTNET_KEY'),
        apiSecret: keyManager.getKey('BINANCE_TESTNET_SECRET'),
        baseUrl: 'https://testnet.binancefuture.com'
    }
};

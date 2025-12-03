/**
 * Key Manager - Environment Variables Only
 *
 * SECURITY: All secrets are read from environment variables only.
 * File-based secret storage has been removed for security.
 *
 * Required environment variables:
 * - BINANCE_TESTNET_KEY
 * - BINANCE_TESTNET_SECRET
 * - TRADING_API_KEY
 * - GEMINI_API_KEY
 */

interface Secrets {
    BINANCE_TESTNET_KEY?: string;
    BINANCE_TESTNET_SECRET?: string;
    TRADING_API_KEY?: string;
    GEMINI_API_KEY?: string;
}

export const keyManager = {
    /**
     * Get all configured secrets from environment variables
     */
    getSecrets: (): Secrets => {
        return {
            BINANCE_TESTNET_KEY: process.env.BINANCE_TESTNET_KEY,
            BINANCE_TESTNET_SECRET: process.env.BINANCE_TESTNET_SECRET,
            TRADING_API_KEY: process.env.TRADING_API_KEY,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        };
    },

    /**
     * Set secrets - DISABLED for security
     * Secrets must be configured via environment variables
     */
    setSecrets: (_newSecrets: Partial<Secrets>): void => {
        console.warn('SECURITY: setSecrets is disabled. Configure secrets via environment variables.');
        // No-op: File-based secret storage removed for security
    },

    /**
     * Get a specific key from environment variables
     */
    getKey: (keyName: keyof Secrets): string => {
        return process.env[keyName] || '';
    },

    /**
     * Check if a key is configured
     */
    hasKey: (keyName: keyof Secrets): boolean => {
        return !!process.env[keyName];
    }
};

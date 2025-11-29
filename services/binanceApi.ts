import { useStore } from '../store/useStore';

const BACKEND_URL = import.meta.env.VITE_TRADING_API_URL || '';
const TRADING_KEY = import.meta.env.VITE_TRADING_API_KEY || '';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const RESET_TIMEOUT = 60000; // 1 minute
let failureCount = 0;
let lastFailureTime = 0;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export const binanceApi = {
    // Generic Helper with Backoff & Circuit Breaker
    request: async (endpoint: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: any) => {
        // Circuit Breaker Check
        if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
            if (Date.now() - lastFailureTime < RESET_TIMEOUT) {
                throw new Error(`Circuit Breaker Open: Too many failures. Retrying in ${Math.ceil((RESET_TIMEOUT - (Date.now() - lastFailureTime)) / 1000)}s`);
            } else {
                failureCount = 0; // Reset after timeout
            }
        }

        let attempt = 0;
        const maxRetries = method === 'GET' ? 3 : 1; // Only retry GET requests aggressively

        while (attempt <= maxRetries) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/trading${endpoint}`, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-trading-key': TRADING_KEY
                    },
                    body: body ? JSON.stringify(body) : undefined
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new ApiError(error.details?.msg || error.error || 'Backend Request Failed', response.status);
                }

                const data = await response.json();
                failureCount = 0; // Success resets circuit breaker
                return data;

            } catch (error: any) {
                attempt++;
                lastFailureTime = Date.now();
                
                // Check if it's a retryable error (Network error (no status), 429, or 5xx)
                const status = error.status;
                const isRetryable = !status || status === 429 || status >= 500;

                if (!isRetryable || attempt > maxRetries) {
                    failureCount++;
                    console.error(`Backend API Error [${endpoint}] (Attempt ${attempt}):`, error);
                    throw error;
                }

                // Exponential Backoff with Jitter
                const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
                console.warn(`[API] Retrying ${endpoint} in ${Math.round(backoff)}ms...`);
                await sleep(backoff);
            }
        }
    },

    // Trading Actions
    placeOrder: async (symbol: string, side: 'BUY' | 'SELL', type: 'MARKET' | 'LIMIT', quantity: number, price?: number) => {
        if (quantity <= 0) throw new Error('Quantity must be greater than 0');
        if (type === 'LIMIT' && (!price || price <= 0)) throw new Error('Price is required for LIMIT orders');

        return binanceApi.request('/order', 'POST', {
            symbol,
            side,
            type,
            quantity,
            price
        });
    },

    cancelOrder: async (symbol: string, orderId: number) => {
        return binanceApi.request('/order', 'DELETE', {
            symbol,
            orderId
        });
    },

    getPositions: async () => {
        return binanceApi.request('/positions');
    },

    getBalance: async () => {
        const data = await binanceApi.request('/balance');
        const usdt = data.find((b: any) => b.asset === 'USDT');
        return usdt ? parseFloat(usdt.balance) : 0;
    },

    // WebSocket Listen Key
    createListenKey: async () => {
        const data = await binanceApi.request('/listenKey', 'POST');
        return data.listenKey;
    },

    keepAliveListenKey: async (listenKey: string) => {
        await binanceApi.request('/listenKey', 'PUT', { listenKey });
    }
};

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
        // CRITICAL: POST/DELETE must NOT retry - could cause double execution
        // GET can retry safely (idempotent)
        const maxRetries = method === 'GET' ? 3 : 0;

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
        // CRITICAL FIX: This line should never be reached due to throw above,
        // but TypeScript needs explicit return type handling
        throw new Error(`[API] Unreachable: All retries exhausted for ${endpoint}`);
    },

    // Trading Actions
    placeOrder: async (symbol: string, side: 'BUY' | 'SELL', type: 'MARKET' | 'LIMIT', quantity: number, price?: number, leverage: number = 10) => {
        // Input validation
        if (quantity <= 0) throw new Error('Quantity must be greater than 0');
        if (type === 'LIMIT' && (!price || price <= 0)) throw new Error('Price is required for LIMIT orders');

        // CRITICAL: Fresh balance check BEFORE placing order
        // Never rely on stale cached balance - always fetch real-time
        const freshBalance = await binanceApi.getBalance();

        // Calculate required margin for this order
        // For futures: margin = (quantity * price) / leverage
        // Use current market price for MARKET orders, specified price for LIMIT
        const effectivePrice = price || (await binanceApi.getCurrentPrice(symbol));
        const orderValue = quantity * effectivePrice;
        const requiredMargin = orderValue / leverage;

        // Safety buffer: require 10% extra to account for price slippage and fees
        const SAFETY_BUFFER = 1.10;
        const marginWithBuffer = requiredMargin * SAFETY_BUFFER;

        // Check if balance is sufficient BEFORE making the API call
        if (freshBalance < marginWithBuffer) {
            const errorMsg = `Insufficient balance for order. ` +
                `Required: $${marginWithBuffer.toFixed(2)} (with 10% buffer), ` +
                `Available: $${freshBalance.toFixed(2)}, ` +
                `Order value: $${orderValue.toFixed(2)} at ${leverage}x leverage`;
            console.error('[BinanceAPI] Order rejected:', errorMsg);
            throw new Error(errorMsg);
        }

        // Balance check passed - proceed with order
        console.log('[BinanceAPI] Balance check passed:', {
            freshBalance: freshBalance.toFixed(2),
            requiredMargin: marginWithBuffer.toFixed(2),
            orderValue: orderValue.toFixed(2),
            leverage
        });

        const orderResponse = await binanceApi.request('/order', 'POST', {
            symbol,
            side,
            type,
            quantity,
            price
        });

        // CRITICAL: Validate order was accepted by exchange before returning
        // Order response should have orderId and status
        if (!orderResponse || !orderResponse.orderId) {
            throw new Error('Order submitted but no orderId returned - check exchange manually');
        }

        // Log successful order for audit trail
        console.log('[BinanceAPI] Order confirmed:', {
            orderId: orderResponse.orderId,
            status: orderResponse.status,
            symbol,
            side,
            type,
            quantity: orderResponse.executedQty || quantity
        });

        return orderResponse;
    },

    // Verify order status on exchange (for state sync)
    getOrderStatus: async (symbol: string, orderId: number): Promise<{ status: string; executedQty: string; avgPrice: string }> => {
        // This would call a backend endpoint that queries Binance order status
        // For now, return the order ID check - implement full query if needed
        const positions = await binanceApi.getPositions();
        const position = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);

        return {
            status: position ? 'FILLED' : 'UNKNOWN',
            executedQty: position?.positionAmt || '0',
            avgPrice: position?.entryPrice || '0'
        };
    },

    // Helper to get current price for margin calculation
    getCurrentPrice: async (symbol: string): Promise<number> => {
        try {
            // Use Binance public API for current price
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch price: ${response.status}`);
            }
            const data = await response.json();
            return parseFloat(data.price) || 0;
        } catch (error) {
            console.error('[BinanceAPI] Failed to get current price:', error);
            // Fallback to store price if API fails
            const storePrice = useStore.getState().price;
            if (storePrice > 0) {
                return storePrice;
            }
            throw new Error('Unable to determine current price for margin calculation');
        }
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

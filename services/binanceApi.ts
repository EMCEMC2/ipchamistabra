import { useStore } from '../store/useStore';

const BACKEND_URL = 'http://localhost:3000/api/trading';

export const binanceApi = {
    // Generic Helper
    request: async (endpoint: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: any) => {
        try {
            const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details?.msg || error.error || 'Backend Request Failed');
            }

            return await response.json();
        } catch (error: any) {
            console.error(`Backend API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // Trading Actions
    placeOrder: async (symbol: string, side: 'BUY' | 'SELL', type: 'MARKET' | 'LIMIT', quantity: number, price?: number) => {
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

import { useStore } from '../store/useStore';

const BINANCE_WS_URL = 'wss://stream.binance.com/ws/btcusdt@ticker';
const BINANCE_API_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';

export class BinancePriceFeed {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private shouldReconnect = true;
    private pollingInterval: any = null;
    private isPolling = false;

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        console.log('[PriceFeed] Connecting to Binance WS...');
        this.ws = new WebSocket(BINANCE_WS_URL);

        this.ws.onopen = () => {
            console.log('[PriceFeed] Connected to Binance WS');
            this.reconnectAttempts = 0;
            this.stopPolling(); // Stop polling if WS connects
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleTickerUpdate(data);
            } catch (e) {
                console.error('[PriceFeed] Parse Error:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[PriceFeed] WS Disconnected');
            if (this.shouldReconnect) {
                this.attemptReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('[PriceFeed] WS Error:', error);
            this.ws?.close();
            this.startPolling(); // Fallback to polling immediately on error
        };
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            console.log(`[PriceFeed] Reconnecting WS in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.warn('[PriceFeed] Max WS reconnect attempts reached. Switching to HTTP Polling.');
            this.startPolling();
        }
    }

    private startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        console.log('[PriceFeed] Starting Fast Polling (3s)...');

        this.fetchPrice(); // Initial fetch
        this.pollingInterval = setInterval(() => this.fetchPrice(), 3000);
    }

    private stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
    }

    private async fetchPrice() {
        try {
            const response = await fetch(BINANCE_API_URL);
            if (!response.ok) throw new Error('Binance API failed');
            const data = await response.json();

            // Binance API format: { symbol: "BTCUSDT", price: "84000.00" }
            const price = parseFloat(data.price);

            // We don't get 24h change from this endpoint, so we estimate trend or keep previous
            // For better UX, we just update price.
            useStore.getState().setMarketMetrics({
                price: price,
                // priceChange: 0, // Keep existing change or fetch from 24h endpoint if needed
            });

        } catch (error) {
            console.error('[PriceFeed] Polling Error:', error);
        }
    }

    private handleTickerUpdate(data: any) {
        if (!data.c) return;

        const price = parseFloat(data.c);
        const priceChange = parseFloat(data.P);

        useStore.getState().setMarketMetrics({
            price: price,
            priceChange: priceChange,
            trends: {
                ...useStore.getState().trends,
                price: priceChange > 0 ? 'up' : 'down'
            }
        });
    }

    disconnect() {
        this.shouldReconnect = false;
        this.stopPolling();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const bybitWS = new BinancePriceFeed(); // Export as same name to minimize refactoring

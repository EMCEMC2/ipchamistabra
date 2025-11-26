import { useStore } from '../store/useStore';
import { binanceApi } from './binanceApi';

let ws: WebSocket | null = null;
let keepAliveInterval: any = null;

export const binanceWS = {
    connect: async () => {
        try {
            const { isLiveMode } = useStore.getState();
            if (!isLiveMode) return;

            console.log('[Binance WS] Requesting ListenKey...');
            const listenKey = await binanceApi.createListenKey();
            
            const wsUrl = `wss://stream.binancefuture.com/ws/${listenKey}`;
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('[Binance WS] Connected to User Data Stream');
                
                // Keep-alive every 50 mins (Binance requires every 60m)
                if (keepAliveInterval) clearInterval(keepAliveInterval);
                keepAliveInterval = setInterval(() => {
                    binanceApi.keepAliveListenKey(listenKey)
                        .then(() => console.log('[Binance WS] ListenKey kept alive'))
                        .catch(e => console.error('[Binance WS] Keep-alive failed', e));
                }, 50 * 60 * 1000);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleMessage(data);
            };

            ws.onerror = (err) => {
                console.error('[Binance WS] Error:', err);
            };

            ws.onclose = () => {
                console.log('[Binance WS] Disconnected');
                if (keepAliveInterval) clearInterval(keepAliveInterval);
                // Simple reconnect logic could go here
            };

        } catch (error) {
            console.error('[Binance WS] Connection Failed:', error);
        }
    },

    disconnect: () => {
        if (ws) {
            ws.close();
            ws = null;
        }
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
    }
};

function handleMessage(data: any) {
    const { updateBalance, updatePositionPnl, addPosition, closePosition } = useStore.getState();

    // Event: ORDER_TRADE_UPDATE
    if (data.e === 'ORDER_TRADE_UPDATE') {
        const order = data.o;
        const orderId = order.i.toString(); // Use Client Order ID or Exchange Order ID?
        // Note: Our local IDs are timestamps. We might need to map them or just use exchange IDs.
        
        console.log('[Binance WS] Order Update:', order.s, order.S, order.X);

        // If filled, we might want to refresh positions from API to be safe
        if (order.X === 'FILLED') {
            // For POC, let's just re-fetch all positions to sync state
            binanceApi.getPositions().then(positions => {
                // We need to map Binance positions to our App's Position type
                // This is a bit complex because we need to merge with existing state
                // For now, let's just log it.
                console.log('[Binance WS] Positions Synced:', positions);
            });
        }
    }

    // Event: ACCOUNT_UPDATE (Balance & PnL)
    if (data.e === 'ACCOUNT_UPDATE') {
        const update = data.a;
        
        // Update Balance
        const walletBalance = parseFloat(update.B[0].wb);
        useStore.setState({ balance: walletBalance });

        // Update Positions PnL
        update.P.forEach((pos: any) => {
            const symbol = pos.s;
            const unrealizedPnL = parseFloat(pos.up);
            const amount = parseFloat(pos.pa);
            
            // Find matching position in store (by symbol)
            // This is imperfect if we have multiple positions per symbol (hedge mode), 
            // but for One-Way mode it works.
            const storePositions = useStore.getState().positions;
            const match = storePositions.find(p => p.pair.replace('/', '') === symbol || p.pair === symbol);
            
            if (match) {
                // Calculate % PnL roughly
                const margin = (match.entryPrice * match.size) / match.leverage;
                const pnlPercent = margin > 0 ? (unrealizedPnL / margin) * 100 : 0;
                
                updatePositionPnl(match.id, unrealizedPnL, pnlPercent);
            }
        });
    }
}

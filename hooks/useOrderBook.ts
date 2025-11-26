import { useState, useEffect, useRef } from 'react';

interface OrderBookLevel {
  price: number;
  size: number;
  total: number; // For depth visualization
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  isLoading: boolean;
}

export const useOrderBook = (symbol: string = 'btcusdt') => {
  const [data, setData] = useState<OrderBookData>({ bids: [], asks: [], isLoading: true });
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = `wss://stream.binance.com/ws/${symbol.toLowerCase()}@depth5`;
    
    const connect = () => {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        // console.log('[OrderBook] Connected');
      };

      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // msg.bids = [[price, size], ...]
          // msg.asks = [[price, size], ...]
          
          if (msg.bids && msg.asks) {
            const bids = msg.bids.map((b: string[]) => ({
              price: parseFloat(b[0]),
              size: parseFloat(b[1]),
              total: 0 // Calculated below
            }));

            const asks = msg.asks.map((a: string[]) => ({
              price: parseFloat(a[0]),
              size: parseFloat(a[1]),
              total: 0
            })).reverse(); // Asks usually come ascending, we want descending for display (highest ask at top? No, lowest ask at bottom closest to spread)
            // Actually, standard order book:
            // Asks: High -> Low (Bottom is lowest ask / best price)
            // Bids: High -> Low (Top is highest bid / best price)
            
            // Binance sends Asks ascending (Lowest Price First).
            // For display:
            // Asks (Red):
            // 90005
            // 90004
            // 90003
            // 90002
            // 90001 (Best Ask)
            // --- SPREAD ---
            // 90000 (Best Bid)
            // 89999
            // ...
            
            // So we need Asks to be sorted Descending (High to Low) so the Lowest is at the bottom.
            const asksSorted = asks.sort((a: any, b: any) => b.price - a.price);
            
            // Bids come Descending (Highest Price First).
            // For display:
            // 90000 (Best Bid)
            // 89999
            // ...
            // So Bids are already in correct order (High to Low).
            
            setData({ 
              bids, 
              asks: asksSorted, 
              isLoading: false 
            });
          }
        } catch (err) {
          console.error('[OrderBook] Parse Error', err);
        }
      };

      ws.current.onclose = () => {
        // console.log('[OrderBook] Disconnected');
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [symbol]);

  return data;
};

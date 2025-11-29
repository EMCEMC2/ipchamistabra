/**
 * MSW Request Handlers
 * Mock API endpoints for testing
 */

import { http, HttpResponse } from 'msw';

// Binance API handlers
const binanceHandlers = [
  // Ticker price
  http.get('https://api.binance.com/api/v3/ticker/price', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');

    if (symbol === 'BTCUSDT') {
      return HttpResponse.json({
        symbol: 'BTCUSDT',
        price: '95000.00'
      });
    }

    return HttpResponse.json({
      symbol: symbol || 'BTCUSDT',
      price: '95000.00'
    });
  }),

  // 24h ticker
  http.get('https://api.binance.com/api/v3/ticker/24hr', ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');

    return HttpResponse.json({
      symbol: symbol || 'BTCUSDT',
      priceChange: '1500.00',
      priceChangePercent: '1.60',
      weightedAvgPrice: '94500.00',
      prevClosePrice: '93500.00',
      lastPrice: '95000.00',
      lastQty: '0.05',
      bidPrice: '94999.00',
      bidQty: '1.5',
      askPrice: '95001.00',
      askQty: '2.0',
      openPrice: '93500.00',
      highPrice: '96000.00',
      lowPrice: '93000.00',
      volume: '15000.00',
      quoteVolume: '1425000000.00',
      openTime: Date.now() - 86400000,
      closeTime: Date.now(),
      firstId: 1000000,
      lastId: 1100000,
      count: 100000
    });
  }),

  // Klines (candlestick data)
  http.get('https://api.binance.com/api/v3/klines', ({ request }) => {
    const url = new URL(request.url);
    const interval = url.searchParams.get('interval') || '15m';
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const klines = [];
    const now = Date.now();
    const intervalMs = interval === '1h' ? 3600000 : interval === '4h' ? 14400000 : 900000;

    for (let i = limit - 1; i >= 0; i--) {
      const openTime = now - (i * intervalMs);
      const basePrice = 95000 - (i * 10);
      klines.push([
        openTime,                           // Open time
        (basePrice - 50).toString(),        // Open
        (basePrice + 100).toString(),       // High
        (basePrice - 100).toString(),       // Low
        basePrice.toString(),               // Close
        '100.5',                            // Volume
        openTime + intervalMs - 1,          // Close time
        '9547500.00',                        // Quote asset volume
        1500,                               // Number of trades
        '50.25',                            // Taker buy base volume
        '4773750.00',                        // Taker buy quote volume
        '0'                                 // Ignore
      ]);
    }

    return HttpResponse.json(klines);
  }),

  // Exchange info
  http.get('https://api.binance.com/api/v3/exchangeInfo', () => {
    return HttpResponse.json({
      timezone: 'UTC',
      serverTime: Date.now(),
      symbols: [
        {
          symbol: 'BTCUSDT',
          status: 'TRADING',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          baseAssetPrecision: 8,
          quoteAssetPrecision: 8
        }
      ]
    });
  }),

  // Depth (order book)
  http.get('https://api.binance.com/api/v3/depth', () => {
    return HttpResponse.json({
      lastUpdateId: Date.now(),
      bids: [
        ['94999.00', '1.5'],
        ['94998.00', '2.0'],
        ['94997.00', '3.5']
      ],
      asks: [
        ['95001.00', '1.0'],
        ['95002.00', '2.5'],
        ['95003.00', '1.8']
      ]
    });
  })
];

// CoinGlass API handlers (derivatives data)
const coinglassHandlers = [
  http.get('https://open-api.coinglass.com/public/v2/funding', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          symbol: 'BTCUSDT',
          fundingRate: 0.0001,
          nextFundingTime: Date.now() + 3600000
        }
      ]
    });
  }),

  http.get('https://open-api.coinglass.com/public/v2/open_interest', () => {
    return HttpResponse.json({
      success: true,
      data: {
        symbol: 'BTC',
        openInterest: 25000000000,
        openInterestChange24h: 2.5
      }
    });
  })
];

// Alternative.me Fear & Greed API
const alternativeHandlers = [
  http.get('https://api.alternative.me/fng/', () => {
    return HttpResponse.json({
      name: 'Fear and Greed Index',
      data: [
        {
          value: '65',
          value_classification: 'Greed',
          timestamp: Math.floor(Date.now() / 1000).toString(),
          time_until_update: '43200'
        }
      ]
    });
  })
];

// AI Proxy handlers
const aiProxyHandlers = [
  http.post('/api/ai/analyze', async ({ request }) => {
    const body = await request.json() as { prompt?: string };
    return HttpResponse.json({
      success: true,
      response: `Analysis complete. Based on the current market conditions: ${body?.prompt || 'general analysis'}`
    });
  }),

  http.post('/api/ai/signal', () => {
    return HttpResponse.json({
      success: true,
      signal: {
        type: 'LONG',
        confidence: 0.75,
        entryPrice: 95000,
        stopLoss: 93000,
        takeProfit: 98000,
        reasoning: 'Bullish momentum detected with strong support at 94000'
      }
    });
  })
];

// Health check handlers
const healthHandlers = [
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        database: 'connected',
        cache: 'connected',
        websocket: 'connected'
      }
    });
  })
];

export const handlers = [
  ...binanceHandlers,
  ...coinglassHandlers,
  ...alternativeHandlers,
  ...aiProxyHandlers,
  ...healthHandlers
];

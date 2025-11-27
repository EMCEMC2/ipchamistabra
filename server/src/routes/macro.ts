import { Router, Request, Response } from 'express';

const router = Router();

/**
 * MACRO DATA PROXY ROUTES
 * Fixes CORS issues by proxying Yahoo Finance and CoinGecko requests through backend
 */

/**
 * GET /api/macro/vix
 * Proxy for Yahoo Finance VIX data
 */
router.get('/vix', async (req: Request, res: Response) => {
  try {
    const symbol = '^VIX';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API failed: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.chart.result[0].meta.regularMarketPrice;

    if (typeof quote !== 'number' || isNaN(quote)) {
      throw new Error('Invalid VIX data');
    }

    res.json({ vix: quote, timestamp: Date.now() });
  } catch (error) {
    console.error('[Macro Proxy] VIX fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch VIX', vix: 0 });
  }
});

/**
 * GET /api/macro/dxy
 * Proxy for Yahoo Finance DXY (US Dollar Index) data
 */
router.get('/dxy', async (req: Request, res: Response) => {
  try {
    const symbol = 'DX-Y.NYB';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API failed: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.chart.result[0].meta.regularMarketPrice;

    if (typeof quote !== 'number' || isNaN(quote)) {
      throw new Error('Invalid DXY data');
    }

    res.json({ dxy: quote, timestamp: Date.now() });
  } catch (error) {
    console.error('[Macro Proxy] DXY fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch DXY', dxy: 0 });
  }
});

/**
 * GET /api/macro/btcd
 * Proxy for CoinGecko BTC Dominance data
 */
router.get('/btcd', async (req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API failed: ${response.status}`);
    }

    const data = await response.json();
    const btcd = data.data.market_cap_percentage.btc;

    if (typeof btcd !== 'number' || isNaN(btcd)) {
      throw new Error('Invalid BTC dominance data');
    }

    res.json({ btcd, timestamp: Date.now() });
  } catch (error) {
    console.error('[Macro Proxy] BTC.D fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch BTC Dominance', btcd: 0 });
  }
});

/**
 * GET /api/macro/all
 * Fetch all macro data in one request (more efficient)
 */
router.get('/all', async (req: Request, res: Response) => {
  try {
    const [vixRes, dxyRes, btcdRes] = await Promise.allSettled([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      }),
      fetch('https://api.coingecko.com/api/v3/global', {
        headers: { 'Accept': 'application/json' }
      })
    ]);

    let vix = 0;
    let dxy = 0;
    let btcd = 0;

    // Parse VIX
    if (vixRes.status === 'fulfilled' && vixRes.value.ok) {
      const data = await vixRes.value.json();
      vix = data.chart.result[0].meta.regularMarketPrice;
    }

    // Parse DXY
    if (dxyRes.status === 'fulfilled' && dxyRes.value.ok) {
      const data = await dxyRes.value.json();
      dxy = data.chart.result[0].meta.regularMarketPrice;
    }

    // Parse BTC.D
    if (btcdRes.status === 'fulfilled' && btcdRes.value.ok) {
      const data = await btcdRes.value.json();
      btcd = data.data.market_cap_percentage.btc;
    }

    res.json({ vix, dxy, btcd, timestamp: Date.now() });
  } catch (error) {
    console.error('[Macro Proxy] All fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch macro data', vix: 0, dxy: 0, btcd: 0 });
  }
});

export { router as macroRoutes };

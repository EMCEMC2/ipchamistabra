import express from 'express';
import axios from 'axios';

const router = express.Router();

const fetchYahooQuote = async (symbol: string): Promise<number> => {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    }
  });

  const quote = response.data?.quoteResponse?.result?.[0]?.regularMarketPrice;
  if (typeof quote !== 'number' || isNaN(quote)) {
    throw new Error(`Invalid quote for ${symbol}`);
  }
  return quote;
};

router.get('/vix', async (_req, res) => {
  try {
    const value = await fetchYahooQuote('^VIX');
    res.json({ value });
  } catch (error: any) {
    console.error('[Macro API] VIX fetch error:', error.message || error);
    res.status(502).json({ error: 'Failed to fetch VIX' });
  }
});

router.get('/dxy', async (_req, res) => {
  try {
    const value = await fetchYahooQuote('DX-Y.NYB');
    res.json({ value });
  } catch (error: any) {
    console.error('[Macro API] DXY fetch error:', error.message || error);
    res.status(502).json({ error: 'Failed to fetch DXY' });
  }
});

export const macroRoutes = router;

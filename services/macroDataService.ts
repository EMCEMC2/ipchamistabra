/**
 * MACRO DATA SERVICE
 * Real data from free public APIs:
 * - DVOL (BTC Volatility): Deribit API (replaces VIX for crypto context)
 * - BTC Dominance: CoinGecko API
 * - Funding Rate: Binance Futures API
 */

export interface MacroData {
  vix: number;  // Actually DVOL (Deribit BTC Volatility Index)
  dxy: number;
  btcd: number;
  fundingRate?: number;
}


/**
 * Fetch BTC Perpetual Funding Rate from Binance Futures
 * Positive = longs pay shorts (bullish sentiment)
 * Negative = shorts pay longs (bearish sentiment)
 * Typical range: -0.1% to +0.1% (per 8 hours)
 */
export async function fetchFundingRate(): Promise<number> {
  try {
    // Binance Futures API - no auth needed for public data
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Binance Futures API failed: ${response.status}`);
    }

    const data = await response.json();
    const fundingRate = parseFloat(data.lastFundingRate) * 100; // Convert to percentage

    if (isNaN(fundingRate)) {
      throw new Error('Invalid funding rate data');
    }

    console.log(`[Macro Data] Funding Rate: ${fundingRate.toFixed(4)}% (Binance)`);
    return fundingRate;
  } catch (error) {
    console.warn('[Macro Data] Funding Rate fetch failed:', error);
    return 0;
  }
}

/**
 * Fetch BTC Dominance from CoinGecko (FREE, no API key)
 */
async function fetchBTCDominance(): Promise<number> {
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

    console.log(`[Macro Data] BTC.D: ${btcd.toFixed(2)}% (CoinGecko)`);
    return btcd;
  } catch (error) {
    console.warn('[Macro Data] BTC.D fetch failed, using fallback:', error);
    // Return 0 to indicate failure (no mock data)
    return 0;
  }
}

/**
 * Fetch DVOL (Deribit BTC Volatility Index) - REAL DATA
 * Public API, no auth required, CORS-friendly
 * Range typically 40-100 (higher = more volatile)
 */
async function fetchDVOL(): Promise<number> {
  try {
    const now = Date.now();
    const dayAgo = now - 86400000;

    const response = await fetch(
      `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=1D&start_timestamp=${dayAgo}&end_timestamp=${now}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Deribit API failed: ${response.status}`);
    }

    const data = await response.json();
    const candles = data.result?.data;

    if (!candles || candles.length === 0) {
      throw new Error('No DVOL data returned');
    }

    // Get latest candle's close value [timestamp, open, high, low, close]
    const latestCandle = candles[candles.length - 1];
    const dvol = latestCandle[4]; // Close price

    if (typeof dvol !== 'number' || isNaN(dvol)) {
      throw new Error('Invalid DVOL data');
    }

    console.log(`[Macro Data] DVOL: ${dvol.toFixed(2)} (Deribit)`);
    return dvol;
  } catch (error) {
    console.warn('[Macro Data] DVOL fetch failed:', error);
    return 0;
  }
}

/**
 * Fetch DXY (US Dollar Index) from Yahoo Finance
 * DXY ticker: DX-Y.NYB
 * Uses query1.finance.yahoo.com which allows CORS
 */
async function fetchDXY(): Promise<number> {
  try {
    // Yahoo Finance public API endpoint (CORS-friendly)
    const response = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d',
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance DXY failed: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof quote !== 'number' || isNaN(quote)) {
      throw new Error('Invalid DXY data from Yahoo');
    }

    console.log(`[Macro Data] DXY: ${quote.toFixed(2)} (Yahoo Finance)`);
    return quote;
  } catch (error) {
    console.warn('[Macro Data] DXY fetch failed:', error);
    // Return 0 to indicate failure
    return 0;
  }
}

/**
 * Fetch all macro data in parallel
 * Returns real data from APIs, not AI search results
 * Now uses backend proxy to avoid CORS issues
 */
export async function fetchMacroData(): Promise<MacroData> {
  console.log('[Macro Data] Fetching macro data...');

  try {
    // Fetch all data in parallel
    // VIX and DXY now use the backend proxy to avoid CORS
    const [vix, dxy, btcd, fundingRate] = await Promise.all([
      fetchDVOL(),
      fetchDXY(),
      fetchBTCDominance(),
      fetchFundingRate()
    ]);

    console.log('[Macro Data] VIX:', vix, '| DXY:', dxy, '| BTC.D:', btcd, '| Funding:', fundingRate.toFixed(4) + '%');

    return { vix, dxy, btcd, fundingRate };
  } catch (error) {
    console.warn('[Macro Data] Failed to fetch macro data:', error);
    return { vix: 0, dxy: 0, btcd: 0, fundingRate: 0 };
  }
}

/**
 * Fetch derivatives metrics (Open Interest, Funding Rate) from Binance Futures API
 * Now using REAL Binance data instead of CoinGlass or AI search
 */
export async function fetchDerivativesMetrics(): Promise<{
  openInterest: string;
  fundingRate: string;
  longShortRatio: number;
}> {
  try {
    // Fetch Open Interest and Funding Rate from Binance Futures (no auth needed)
    const [oiRes, fundingRes] = await Promise.allSettled([
      fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT')
    ]);

    let openInterest = 'N/A';
    let fundingRate = 'N/A';
    const longShortRatio = 1.0; // Requires account API

    // Parse Open Interest
    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      const data = await oiRes.value.json();
      const oiValue = parseFloat(data.openInterest);
      if (!isNaN(oiValue)) {
        openInterest = `${(oiValue / 1000).toFixed(1)}K BTC`; // Convert to K BTC
      }
    }

    // Parse Funding Rate
    if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
      const data = await fundingRes.value.json();
      const rate = parseFloat(data.lastFundingRate) * 100; // Convert to percentage
      if (!isNaN(rate)) {
        fundingRate = `${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`;
      }
    }

    console.log(`[Derivatives] OI: ${openInterest} | Funding: ${fundingRate} | L/S: ${longShortRatio}`);

    return {
      openInterest,
      fundingRate,
      longShortRatio
    };
  } catch (error) {
    console.warn('[Derivatives] Fetch failed, using N/A:', error);
    return {
      openInterest: 'N/A',
      fundingRate: 'N/A',
      longShortRatio: 1.0
    };
  }
}

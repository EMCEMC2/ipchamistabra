/**
 * REAL MACRO DATA SERVICE
 * Fetches VIX, DXY, BTC Dominance from actual APIs (no AI search hallucinations)
 * Now uses backend proxy to avoid CORS issues
 */

export interface MacroData {
  vix: number;
  dxy: number;
  btcd: number;
  fundingRate?: number; // Optional: BTC perpetual funding rate (%)
}

// Backend proxy URL (adjust port if needed)
const PROXY_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

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
 * Fetch VIX from Yahoo Finance API (via yfinance alternative - no key needed)
 * VIX ticker: ^VIX
 */
async function fetchVIX(): Promise<number> {
  try {
    // Fetch from backend proxy to avoid browser CORS failures
    const apiBase = import.meta.env.VITE_API_BASE || '';
    const response = await fetch(`${apiBase}/api/macro/vix`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Macro API VIX failed: ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.value !== 'number' || isNaN(data.value)) {
      throw new Error('Invalid VIX data');
    }

    console.log(`[Macro Data] VIX: ${data.value.toFixed(2)} (backend proxy)`);
    return data.value;
  } catch (error) {
    console.warn('[Macro Data] VIX fetch failed, using fallback:', error);
    // Return 0 to indicate failure (no mock data)
    return 0;
  }
}

/**
 * Fetch DXY (US Dollar Index) from Yahoo Finance
 * DXY ticker: DX-Y.NYB
 */
async function fetchDXY(): Promise<number> {
  try {
    const apiBase = import.meta.env.VITE_API_BASE || '';
    const response = await fetch(`${apiBase}/api/macro/dxy`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Macro API DXY failed: ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.value !== 'number' || isNaN(data.value)) {
      throw new Error('Invalid DXY data');
    }

    console.log(`[Macro Data] DXY: ${data.value.toFixed(2)} (backend proxy)`);
    return data.value;
  } catch (error) {
    console.warn('[Macro Data] DXY fetch failed, using fallback:', error);
    // Return 0 to indicate failure (no mock data)
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
      fetchVIX(),
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

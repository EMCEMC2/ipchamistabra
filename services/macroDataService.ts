/**
 * MACRO DATA SERVICE - Enhanced BTC Trading Metrics
 * Real data from free public APIs:
 * - DVOL (BTC Volatility): Deribit API
 * - BTC Dominance: CoinGecko API
 * - Funding Rate & OI: Binance Futures API
 * - Fear & Greed: Alternative.me API
 * - Volume & ATR: Binance Spot API
 */

export interface MacroData {
  vix: number;  // DVOL (Deribit BTC Volatility Index)
  dxy: number;
  btcd: number;
  fundingRate?: number;
}

export interface EnhancedBTCMetrics {
  // Volatility
  dvol: number;              // Deribit implied volatility (30-day)
  atr14d: number;            // 14-day ATR in USD
  todayRange: number;        // Today's high-low range in USD
  rangeVsAtr: number;        // Today's range as multiple of ATR (0.8 = 80% of normal)

  // Volume
  volume24h: number;         // 24h volume in USD
  volumeAvg30d: number;      // 30-day average volume
  volumeRatio: number;       // Current vs avg (1.2 = 120% of normal)
  volumeTag: 'SPIKE' | 'HIGH' | 'NORMAL' | 'QUIET';

  // Derivatives Positioning
  fundingRate: number;       // Current funding rate %
  fundingTrend: 'RISING' | 'FALLING' | 'STABLE';
  openInterest: number;      // OI in BTC
  oiChange24h: number;       // OI change % in 24h

  // Risk / Levels
  distanceToHigh24h: number; // % distance to 24h high
  distanceToLow24h: number;  // % distance to 24h low
  above200dMA: boolean;      // Is price above 200-day MA?
  ma200: number;             // 200-day MA value

  // Sentiment
  fearGreedIndex: number;    // 0-100 (Alternative.me)
  fearGreedLabel: string;    // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"

  // BTC Dominance
  btcDominance: number;
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

/**
 * Fetch Fear & Greed Index from Alternative.me (FREE API)
 */
async function fetchFearGreed(): Promise<{ index: number; label: string }> {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Alternative.me API failed: ${response.status}`);
    }

    const data = await response.json();
    const fng = data.data?.[0];

    if (!fng) {
      throw new Error('No Fear & Greed data');
    }

    const index = parseInt(fng.value, 10);
    const label = fng.value_classification || 'Unknown';

    console.log(`[Macro Data] Fear & Greed: ${index} (${label})`);
    return { index, label };
  } catch (error) {
    console.warn('[Macro Data] Fear & Greed fetch failed:', error);
    return { index: 0, label: 'N/A' };
  }
}

/**
 * Fetch 24h ticker data from Binance Spot (volume, high, low, price)
 */
async function fetchBinance24hTicker(): Promise<{
  volume24h: number;
  high24h: number;
  low24h: number;
  lastPrice: number;
}> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Binance ticker API failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      volume24h: parseFloat(data.quoteVolume) || 0, // Volume in USDT
      high24h: parseFloat(data.highPrice) || 0,
      low24h: parseFloat(data.lowPrice) || 0,
      lastPrice: parseFloat(data.lastPrice) || 0
    };
  } catch (error) {
    console.warn('[Macro Data] Binance 24h ticker fetch failed:', error);
    return { volume24h: 0, high24h: 0, low24h: 0, lastPrice: 0 };
  }
}

/**
 * Fetch historical klines from Binance to calculate ATR and 200-day MA
 */
async function fetchBinanceKlines(interval: string, limit: number): Promise<number[][]> {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Binance klines API failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('[Macro Data] Binance klines fetch failed:', error);
    return [];
  }
}

/**
 * Calculate ATR (Average True Range) from klines
 * Kline format: [openTime, open, high, low, close, volume, ...]
 */
function calculateATR(klines: number[][], period: number = 14): number {
  if (klines.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < klines.length; i++) {
    const high = parseFloat(String(klines[i][2]));
    const low = parseFloat(String(klines[i][3]));
    const prevClose = parseFloat(String(klines[i - 1][4]));

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Simple moving average of last 'period' true ranges
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;

  return atr;
}

/**
 * Calculate Simple Moving Average from klines
 */
function calculateSMA(klines: number[][], period: number): number {
  if (klines.length < period) return 0;

  const closes = klines.slice(-period).map(k => parseFloat(String(k[4])));
  return closes.reduce((a, b) => a + b, 0) / closes.length;
}

/**
 * Fetch Open Interest history from Binance to calculate 24h change
 */
async function fetchOIHistory(): Promise<{ current: number; change24h: number }> {
  try {
    const [currentRes, historyRes] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
      fetch('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=24')
    ]);

    if (!currentRes.ok || !historyRes.ok) {
      throw new Error('OI fetch failed');
    }

    const currentData = await currentRes.json();
    const historyData = await historyRes.json();

    const currentOI = parseFloat(currentData.openInterest) || 0;

    // Get OI from 24h ago
    let oi24hAgo = currentOI;
    if (historyData && historyData.length > 0) {
      oi24hAgo = parseFloat(historyData[0].sumOpenInterest) || currentOI;
    }

    const change24h = oi24hAgo > 0 ? ((currentOI - oi24hAgo) / oi24hAgo) * 100 : 0;

    console.log(`[Macro Data] OI: ${currentOI.toFixed(0)} BTC, 24h change: ${change24h.toFixed(2)}%`);

    return { current: currentOI, change24h };
  } catch (error) {
    console.warn('[Macro Data] OI history fetch failed:', error);
    return { current: 0, change24h: 0 };
  }
}

/**
 * Fetch funding rate history to determine trend
 */
async function fetchFundingHistory(): Promise<{ rate: number; trend: 'RISING' | 'FALLING' | 'STABLE' }> {
  try {
    const response = await fetch(
      'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=8', // Last 8 periods (24h)
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`Funding rate history failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('No funding rate data');
    }

    const rates = data.map((d: any) => parseFloat(d.fundingRate) * 100);
    const currentRate = rates[rates.length - 1];

    // Calculate trend: compare average of last 3 vs previous 3
    let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    if (rates.length >= 6) {
      const recent = rates.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3;
      const older = rates.slice(-6, -3).reduce((a: number, b: number) => a + b, 0) / 3;
      const diff = recent - older;

      if (diff > 0.005) trend = 'RISING';
      else if (diff < -0.005) trend = 'FALLING';
    }

    console.log(`[Macro Data] Funding: ${currentRate.toFixed(4)}%, trend: ${trend}`);

    return { rate: currentRate, trend };
  } catch (error) {
    console.warn('[Macro Data] Funding history fetch failed:', error);
    return { rate: 0, trend: 'STABLE' };
  }
}

/**
 * Get volume tag based on ratio to average
 */
function getVolumeTag(ratio: number): 'SPIKE' | 'HIGH' | 'NORMAL' | 'QUIET' {
  if (ratio >= 2.0) return 'SPIKE';
  if (ratio >= 1.3) return 'HIGH';
  if (ratio >= 0.7) return 'NORMAL';
  return 'QUIET';
}

/**
 * Fetch all enhanced BTC metrics in parallel
 * This is the main function for the new metrics panel
 */
export async function fetchEnhancedBTCMetrics(): Promise<EnhancedBTCMetrics> {
  console.log('[Enhanced Metrics] Fetching all BTC metrics...');

  try {
    // Parallel fetch all data sources
    const [
      dvol,
      fearGreed,
      ticker24h,
      dailyKlines,
      btcd,
      oiData,
      fundingData
    ] = await Promise.all([
      fetchDVOL(),
      fetchFearGreed(),
      fetchBinance24hTicker(),
      fetchBinanceKlines('1d', 201), // 200 days + 1 for ATR calc
      fetchBTCDominance(),
      fetchOIHistory(),
      fetchFundingHistory()
    ]);

    // Calculate ATR from daily klines
    const atr14d = calculateATR(dailyKlines, 14);

    // Calculate 200-day MA
    const ma200 = calculateSMA(dailyKlines, 200);

    // Today's range
    const todayRange = ticker24h.high24h - ticker24h.low24h;
    const rangeVsAtr = atr14d > 0 ? todayRange / atr14d : 0;

    // Volume: calculate 30-day average from klines
    const last30DaysVolume = dailyKlines.slice(-30).map(k => parseFloat(String(k[7]))); // quoteVolume
    const volumeAvg30d = last30DaysVolume.reduce((a, b) => a + b, 0) / 30;
    const volumeRatio = volumeAvg30d > 0 ? ticker24h.volume24h / volumeAvg30d : 1;

    // Distance to 24h high/low
    const price = ticker24h.lastPrice;
    const distanceToHigh24h = price > 0 ? ((ticker24h.high24h - price) / price) * 100 : 0;
    const distanceToLow24h = price > 0 ? ((price - ticker24h.low24h) / price) * 100 : 0;

    const metrics: EnhancedBTCMetrics = {
      // Volatility
      dvol,
      atr14d,
      todayRange,
      rangeVsAtr,

      // Volume
      volume24h: ticker24h.volume24h,
      volumeAvg30d,
      volumeRatio,
      volumeTag: getVolumeTag(volumeRatio),

      // Derivatives
      fundingRate: fundingData.rate,
      fundingTrend: fundingData.trend,
      openInterest: oiData.current,
      oiChange24h: oiData.change24h,

      // Risk / Levels
      distanceToHigh24h,
      distanceToLow24h,
      above200dMA: price > ma200,
      ma200,

      // Sentiment
      fearGreedIndex: fearGreed.index,
      fearGreedLabel: fearGreed.label,

      // Dominance
      btcDominance: btcd
    };

    console.log('[Enhanced Metrics] All metrics fetched successfully');
    return metrics;

  } catch (error) {
    console.error('[Enhanced Metrics] Failed to fetch metrics:', error);

    // Return empty/default metrics
    return {
      dvol: 0,
      atr14d: 0,
      todayRange: 0,
      rangeVsAtr: 0,
      volume24h: 0,
      volumeAvg30d: 0,
      volumeRatio: 1,
      volumeTag: 'NORMAL',
      fundingRate: 0,
      fundingTrend: 'STABLE',
      openInterest: 0,
      oiChange24h: 0,
      distanceToHigh24h: 0,
      distanceToLow24h: 0,
      above200dMA: false,
      ma200: 0,
      fearGreedIndex: 0,
      fearGreedLabel: 'N/A',
      btcDominance: 0
    };
  }
}

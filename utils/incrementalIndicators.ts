/**
 * Incremental Technical Indicators
 * O(1) per-tick updates instead of O(n) full recalculation
 */

/**
 * Incremental Exponential Moving Average
 * Formula: EMA = (Price - EMA_prev) * k + EMA_prev
 * where k = 2 / (period + 1)
 */
export class IncrementalEMA {
  private value: number | null = null;
  private readonly multiplier: number;
  private readonly period: number;
  private warmupCount: number = 0;
  private sum: number = 0;

  constructor(period: number) {
    if (period < 1) throw new Error('EMA period must be at least 1');
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }

  /**
   * Update with new price - O(1)
   */
  update(price: number): number {
    if (this.value === null) {
      // Warmup phase: collect initial values for SMA seed
      this.sum += price;
      this.warmupCount++;

      if (this.warmupCount >= this.period) {
        // Use SMA as initial EMA value
        this.value = this.sum / this.period;
      }
      return this.value ?? price;
    }

    // Standard EMA calculation
    this.value = (price - this.value) * this.multiplier + this.value;
    return this.value;
  }

  /**
   * Get current EMA value
   */
  getValue(): number | null {
    return this.value;
  }

  /**
   * Check if indicator has warmed up
   */
  isReady(): boolean {
    return this.value !== null;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.value = null;
    this.warmupCount = 0;
    this.sum = 0;
  }

  /**
   * Initialize with existing EMA value (for restore from state)
   */
  seed(value: number): void {
    this.value = value;
    this.warmupCount = this.period;
  }
}

/**
 * Incremental Relative Strength Index
 * Uses Wilder's smoothing (exponential moving average of gains/losses)
 */
export class IncrementalRSI {
  private avgGain: number | null = null;
  private avgLoss: number | null = null;
  private prevPrice: number | null = null;
  private readonly period: number;
  private warmupGains: number[] = [];
  private warmupLosses: number[] = [];

  constructor(period: number = 14) {
    if (period < 1) throw new Error('RSI period must be at least 1');
    this.period = period;
  }

  /**
   * Update with new price - O(1)
   */
  update(price: number): number | null {
    if (this.prevPrice === null) {
      this.prevPrice = price;
      return null;
    }

    const change = price - this.prevPrice;
    this.prevPrice = price;

    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);

    if (this.avgGain === null || this.avgLoss === null) {
      // Warmup phase
      this.warmupGains.push(gain);
      this.warmupLosses.push(loss);

      if (this.warmupGains.length >= this.period) {
        // Calculate initial averages
        this.avgGain = this.warmupGains.reduce((a, b) => a + b, 0) / this.period;
        this.avgLoss = this.warmupLosses.reduce((a, b) => a + b, 0) / this.period;
        this.warmupGains = [];
        this.warmupLosses = [];
      } else {
        return null;
      }
    } else {
      // Wilder's smoothing
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
    }

    // Calculate RSI
    if (this.avgLoss === 0) {
      return 100;
    }
    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Get current RSI value
   */
  getValue(): number | null {
    if (this.avgGain === null || this.avgLoss === null) return null;
    if (this.avgLoss === 0) return 100;
    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Check if indicator has warmed up
   */
  isReady(): boolean {
    return this.avgGain !== null && this.avgLoss !== null;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.avgGain = null;
    this.avgLoss = null;
    this.prevPrice = null;
    this.warmupGains = [];
    this.warmupLosses = [];
  }

  /**
   * Seed with existing values
   */
  seed(avgGain: number, avgLoss: number, prevPrice: number): void {
    this.avgGain = avgGain;
    this.avgLoss = avgLoss;
    this.prevPrice = prevPrice;
  }
}

/**
 * Incremental Average True Range
 * Uses Wilder's smoothing for ATR calculation
 */
export class IncrementalATR {
  private atr: number | null = null;
  private prevClose: number | null = null;
  private readonly period: number;
  private warmupTRs: number[] = [];

  constructor(period: number = 14) {
    if (period < 1) throw new Error('ATR period must be at least 1');
    this.period = period;
  }

  /**
   * Update with new candle data - O(1)
   */
  update(high: number, low: number, close: number): number | null {
    let tr: number;

    if (this.prevClose === null) {
      // First candle - TR is simply high - low
      tr = high - low;
    } else {
      // True Range = max(high - low, |high - prevClose|, |low - prevClose|)
      tr = Math.max(
        high - low,
        Math.abs(high - this.prevClose),
        Math.abs(low - this.prevClose)
      );
    }

    this.prevClose = close;

    if (this.atr === null) {
      // Warmup phase
      this.warmupTRs.push(tr);

      if (this.warmupTRs.length >= this.period) {
        // Calculate initial ATR as SMA of TRs
        this.atr = this.warmupTRs.reduce((a, b) => a + b, 0) / this.period;
        this.warmupTRs = [];
      } else {
        return null;
      }
    } else {
      // Wilder's smoothing
      this.atr = (this.atr * (this.period - 1) + tr) / this.period;
    }

    return this.atr;
  }

  /**
   * Get current ATR value
   */
  getValue(): number | null {
    return this.atr;
  }

  /**
   * Check if indicator has warmed up
   */
  isReady(): boolean {
    return this.atr !== null;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.atr = null;
    this.prevClose = null;
    this.warmupTRs = [];
  }

  /**
   * Seed with existing values
   */
  seed(atr: number, prevClose: number): void {
    this.atr = atr;
    this.prevClose = prevClose;
  }
}

/**
 * Incremental MACD
 * Combines two EMAs and calculates signal line
 */
export class IncrementalMACD {
  private fastEMA: IncrementalEMA;
  private slowEMA: IncrementalEMA;
  private signalEMA: IncrementalEMA;

  constructor(
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ) {
    this.fastEMA = new IncrementalEMA(fastPeriod);
    this.slowEMA = new IncrementalEMA(slowPeriod);
    this.signalEMA = new IncrementalEMA(signalPeriod);
  }

  /**
   * Update with new price - O(1)
   */
  update(price: number): { macd: number; signal: number; histogram: number } | null {
    const fast = this.fastEMA.update(price);
    const slow = this.slowEMA.update(price);

    if (!this.fastEMA.isReady() || !this.slowEMA.isReady()) {
      return null;
    }

    const macd = fast - slow;
    const signal = this.signalEMA.update(macd);

    if (!this.signalEMA.isReady()) {
      return null;
    }

    return {
      macd,
      signal,
      histogram: macd - signal
    };
  }

  /**
   * Get current MACD values
   */
  getValue(): { macd: number; signal: number; histogram: number } | null {
    const fast = this.fastEMA.getValue();
    const slow = this.slowEMA.getValue();
    const signal = this.signalEMA.getValue();

    if (fast === null || slow === null || signal === null) {
      return null;
    }

    const macd = fast - slow;
    return {
      macd,
      signal,
      histogram: macd - signal
    };
  }

  /**
   * Check if indicator has warmed up
   */
  isReady(): boolean {
    return this.fastEMA.isReady() && this.slowEMA.isReady() && this.signalEMA.isReady();
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.fastEMA.reset();
    this.slowEMA.reset();
    this.signalEMA.reset();
  }
}

/**
 * Incremental Volume Weighted Average Price (VWAP)
 * Maintains running totals for O(1) updates
 */
export class IncrementalVWAP {
  private cumulativeVolume: number = 0;
  private cumulativeVolumePrice: number = 0;

  /**
   * Update with new candle data - O(1)
   * @param typicalPrice - (high + low + close) / 3
   * @param volume - candle volume
   */
  update(typicalPrice: number, volume: number): number {
    this.cumulativeVolume += volume;
    this.cumulativeVolumePrice += typicalPrice * volume;

    if (this.cumulativeVolume === 0) return typicalPrice;
    return this.cumulativeVolumePrice / this.cumulativeVolume;
  }

  /**
   * Get current VWAP value
   */
  getValue(): number {
    if (this.cumulativeVolume === 0) return 0;
    return this.cumulativeVolumePrice / this.cumulativeVolume;
  }

  /**
   * Reset (typically at session start)
   */
  reset(): void {
    this.cumulativeVolume = 0;
    this.cumulativeVolumePrice = 0;
  }
}

/**
 * Indicator Manager - Manages multiple indicators with O(1) updates
 */
export class IndicatorManager {
  public ema12: IncrementalEMA;
  public ema26: IncrementalEMA;
  public ema200: IncrementalEMA;
  public rsi: IncrementalRSI;
  public atr: IncrementalATR;
  public macd: IncrementalMACD;
  public vwap: IncrementalVWAP;

  constructor() {
    this.ema12 = new IncrementalEMA(12);
    this.ema26 = new IncrementalEMA(26);
    this.ema200 = new IncrementalEMA(200);
    this.rsi = new IncrementalRSI(14);
    this.atr = new IncrementalATR(14);
    this.macd = new IncrementalMACD(12, 26, 9);
    this.vwap = new IncrementalVWAP();
  }

  /**
   * Update all indicators with new candle - O(1)
   */
  updateCandle(open: number, high: number, low: number, close: number, volume: number): {
    ema12: number | null;
    ema26: number | null;
    ema200: number | null;
    rsi: number | null;
    atr: number | null;
    macd: { macd: number; signal: number; histogram: number } | null;
    vwap: number;
  } {
    const typicalPrice = (high + low + close) / 3;

    return {
      ema12: this.ema12.update(close),
      ema26: this.ema26.update(close),
      ema200: this.ema200.update(close),
      rsi: this.rsi.update(close),
      atr: this.atr.update(high, low, close),
      macd: this.macd.update(close),
      vwap: this.vwap.update(typicalPrice, volume)
    };
  }

  /**
   * Update with just price (for tick data) - O(1)
   */
  updatePrice(price: number): {
    ema12: number | null;
    ema26: number | null;
    ema200: number | null;
    rsi: number | null;
    macd: { macd: number; signal: number; histogram: number } | null;
  } {
    return {
      ema12: this.ema12.update(price),
      ema26: this.ema26.update(price),
      ema200: this.ema200.update(price),
      rsi: this.rsi.update(price),
      macd: this.macd.update(price)
    };
  }

  /**
   * Check if all indicators are ready
   */
  isFullyWarmed(): boolean {
    return (
      this.ema12.isReady() &&
      this.ema26.isReady() &&
      this.ema200.isReady() &&
      this.rsi.isReady() &&
      this.atr.isReady() &&
      this.macd.isReady()
    );
  }

  /**
   * Reset all indicators
   */
  reset(): void {
    this.ema12.reset();
    this.ema26.reset();
    this.ema200.reset();
    this.rsi.reset();
    this.atr.reset();
    this.macd.reset();
    this.vwap.reset();
  }

  /**
   * Reset VWAP only (for session reset)
   */
  resetSession(): void {
    this.vwap.reset();
  }
}

/* eslint-disable no-restricted-globals */

/**
 * Indicator Calculation Worker
 * Offloads heavy technical analysis computations from main thread
 */

// Inline types to avoid import issues in worker
interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorResult {
  ema12: number | null;
  ema26: number | null;
  ema200: number | null;
  rsi: number | null;
  atr: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  sma20: number | null;
  sma50: number | null;
  bb: { upper: number; middle: number; lower: number } | null;
  adx: number | null;
}

interface WorkerRequest {
  type: 'CALCULATE_INDICATORS' | 'UPDATE_PRICE' | 'RESET';
  payload?: {
    candles?: CandleData[];
    price?: number;
  };
  requestId?: string;
}

interface WorkerResponse {
  type: 'INDICATOR_RESULT' | 'ERROR';
  payload: IndicatorResult | { error: string };
  requestId?: string;
}

// Incremental EMA implementation
class IncrementalEMA {
  private value: number | null = null;
  private readonly multiplier: number;
  private readonly period: number;
  private warmupCount: number = 0;
  private sum: number = 0;

  constructor(period: number) {
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }

  update(price: number): number | null {
    if (this.value === null) {
      this.sum += price;
      this.warmupCount++;
      if (this.warmupCount >= this.period) {
        this.value = this.sum / this.period;
      }
      return this.value;
    }
    this.value = (price - this.value) * this.multiplier + this.value;
    return this.value;
  }

  getValue(): number | null {
    return this.value;
  }

  reset(): void {
    this.value = null;
    this.warmupCount = 0;
    this.sum = 0;
  }
}

// SMA calculation
class IncrementalSMA {
  private readonly period: number;
  private values: number[] = [];

  constructor(period: number) {
    this.period = period;
  }

  update(price: number): number | null {
    this.values.push(price);
    if (this.values.length > this.period) {
      this.values.shift();
    }
    if (this.values.length < this.period) {
      return null;
    }
    return this.values.reduce((a, b) => a + b, 0) / this.period;
  }

  getValue(): number | null {
    if (this.values.length < this.period) return null;
    return this.values.reduce((a, b) => a + b, 0) / this.period;
  }

  getValues(): number[] {
    return [...this.values];
  }

  reset(): void {
    this.values = [];
  }
}

// RSI calculation
class IncrementalRSI {
  private avgGain: number | null = null;
  private avgLoss: number | null = null;
  private prevPrice: number | null = null;
  private readonly period: number;
  private warmupGains: number[] = [];
  private warmupLosses: number[] = [];

  constructor(period: number = 14) {
    this.period = period;
  }

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
      this.warmupGains.push(gain);
      this.warmupLosses.push(loss);

      if (this.warmupGains.length >= this.period) {
        this.avgGain = this.warmupGains.reduce((a, b) => a + b, 0) / this.period;
        this.avgLoss = this.warmupLosses.reduce((a, b) => a + b, 0) / this.period;
        this.warmupGains = [];
        this.warmupLosses = [];
      } else {
        return null;
      }
    } else {
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
    }

    if (this.avgLoss === 0) return 100;
    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }

  reset(): void {
    this.avgGain = null;
    this.avgLoss = null;
    this.prevPrice = null;
    this.warmupGains = [];
    this.warmupLosses = [];
  }
}

// ATR calculation
class IncrementalATR {
  private atr: number | null = null;
  private prevClose: number | null = null;
  private readonly period: number;
  private warmupTRs: number[] = [];

  constructor(period: number = 14) {
    this.period = period;
  }

  update(high: number, low: number, close: number): number | null {
    let tr: number;

    if (this.prevClose === null) {
      tr = high - low;
    } else {
      tr = Math.max(
        high - low,
        Math.abs(high - this.prevClose),
        Math.abs(low - this.prevClose)
      );
    }

    this.prevClose = close;

    if (this.atr === null) {
      this.warmupTRs.push(tr);
      if (this.warmupTRs.length >= this.period) {
        this.atr = this.warmupTRs.reduce((a, b) => a + b, 0) / this.period;
        this.warmupTRs = [];
      } else {
        return null;
      }
    } else {
      this.atr = (this.atr * (this.period - 1) + tr) / this.period;
    }

    return this.atr;
  }

  reset(): void {
    this.atr = null;
    this.prevClose = null;
    this.warmupTRs = [];
  }
}

// MACD calculation
class IncrementalMACD {
  private fastEMA: IncrementalEMA;
  private slowEMA: IncrementalEMA;
  private signalEMA: IncrementalEMA;

  constructor(fast: number = 12, slow: number = 26, signal: number = 9) {
    this.fastEMA = new IncrementalEMA(fast);
    this.slowEMA = new IncrementalEMA(slow);
    this.signalEMA = new IncrementalEMA(signal);
  }

  update(price: number): { macd: number; signal: number; histogram: number } | null {
    const fast = this.fastEMA.update(price);
    const slow = this.slowEMA.update(price);

    if (fast === null || slow === null) return null;

    const macd = fast - slow;
    const signal = this.signalEMA.update(macd);

    if (signal === null) return null;

    return {
      macd,
      signal,
      histogram: macd - signal
    };
  }

  reset(): void {
    this.fastEMA.reset();
    this.slowEMA.reset();
    this.signalEMA.reset();
  }
}

// Bollinger Bands calculation
class BollingerBands {
  private readonly period: number;
  private readonly stdDev: number;
  private sma: IncrementalSMA;

  constructor(period: number = 20, stdDev: number = 2) {
    this.period = period;
    this.stdDev = stdDev;
    this.sma = new IncrementalSMA(period);
  }

  update(price: number): { upper: number; middle: number; lower: number } | null {
    const middle = this.sma.update(price);
    if (middle === null) return null;

    const values = this.sma.getValues();
    const variance = values.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / this.period;
    const std = Math.sqrt(variance);

    return {
      upper: middle + this.stdDev * std,
      middle,
      lower: middle - this.stdDev * std
    };
  }

  reset(): void {
    this.sma.reset();
  }
}

// ADX calculation (simplified)
class IncrementalADX {
  private readonly period: number;
  private prevHigh: number | null = null;
  private prevLow: number | null = null;
  private prevClose: number | null = null;
  private smoothedDMPlus: number | null = null;
  private smoothedDMMinus: number | null = null;
  private smoothedTR: number | null = null;
  private smoothedADX: number | null = null;
  private warmupCount: number = 0;
  private dxValues: number[] = [];

  constructor(period: number = 14) {
    this.period = period;
  }

  update(high: number, low: number, close: number): number | null {
    if (this.prevHigh === null || this.prevLow === null || this.prevClose === null) {
      this.prevHigh = high;
      this.prevLow = low;
      this.prevClose = close;
      return null;
    }

    // Calculate DM+ and DM-
    const upMove = high - this.prevHigh;
    const downMove = this.prevLow - low;

    let dmPlus = 0;
    let dmMinus = 0;

    if (upMove > downMove && upMove > 0) {
      dmPlus = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      dmMinus = downMove;
    }

    // True Range
    const tr = Math.max(
      high - low,
      Math.abs(high - this.prevClose),
      Math.abs(low - this.prevClose)
    );

    this.prevHigh = high;
    this.prevLow = low;
    this.prevClose = close;

    this.warmupCount++;

    if (this.smoothedDMPlus === null) {
      if (this.warmupCount >= this.period) {
        // Initialize smoothed values (this is simplified)
        this.smoothedDMPlus = dmPlus;
        this.smoothedDMMinus = dmMinus;
        this.smoothedTR = tr;
      }
      return null;
    }

    // Smooth the values
    this.smoothedDMPlus = this.smoothedDMPlus - (this.smoothedDMPlus / this.period) + dmPlus;
    this.smoothedDMMinus = this.smoothedDMMinus! - (this.smoothedDMMinus! / this.period) + dmMinus;
    this.smoothedTR = this.smoothedTR! - (this.smoothedTR! / this.period) + tr;

    if (this.smoothedTR === 0) return null;

    const diPlus = (this.smoothedDMPlus / this.smoothedTR) * 100;
    const diMinus = (this.smoothedDMMinus! / this.smoothedTR) * 100;

    const diSum = diPlus + diMinus;
    if (diSum === 0) return null;

    const dx = (Math.abs(diPlus - diMinus) / diSum) * 100;
    this.dxValues.push(dx);

    if (this.dxValues.length < this.period) {
      return null;
    }

    if (this.smoothedADX === null) {
      this.smoothedADX = this.dxValues.reduce((a, b) => a + b, 0) / this.period;
    } else {
      this.smoothedADX = (this.smoothedADX * (this.period - 1) + dx) / this.period;
    }

    return this.smoothedADX;
  }

  reset(): void {
    this.prevHigh = null;
    this.prevLow = null;
    this.prevClose = null;
    this.smoothedDMPlus = null;
    this.smoothedDMMinus = null;
    this.smoothedTR = null;
    this.smoothedADX = null;
    this.warmupCount = 0;
    this.dxValues = [];
  }
}

// Main indicator manager
class IndicatorCalculator {
  private ema12: IncrementalEMA;
  private ema26: IncrementalEMA;
  private ema200: IncrementalEMA;
  private sma20: IncrementalSMA;
  private sma50: IncrementalSMA;
  private rsi: IncrementalRSI;
  private atr: IncrementalATR;
  private macd: IncrementalMACD;
  private bb: BollingerBands;
  private adx: IncrementalADX;

  constructor() {
    this.ema12 = new IncrementalEMA(12);
    this.ema26 = new IncrementalEMA(26);
    this.ema200 = new IncrementalEMA(200);
    this.sma20 = new IncrementalSMA(20);
    this.sma50 = new IncrementalSMA(50);
    this.rsi = new IncrementalRSI(14);
    this.atr = new IncrementalATR(14);
    this.macd = new IncrementalMACD(12, 26, 9);
    this.bb = new BollingerBands(20, 2);
    this.adx = new IncrementalADX(14);
  }

  processCandles(candles: CandleData[]): IndicatorResult {
    this.reset();

    let result: IndicatorResult = {
      ema12: null,
      ema26: null,
      ema200: null,
      rsi: null,
      atr: null,
      macd: null,
      sma20: null,
      sma50: null,
      bb: null,
      adx: null
    };

    for (const candle of candles) {
      result = this.updateCandle(candle);
    }

    return result;
  }

  updateCandle(candle: CandleData): IndicatorResult {
    return {
      ema12: this.ema12.update(candle.close),
      ema26: this.ema26.update(candle.close),
      ema200: this.ema200.update(candle.close),
      rsi: this.rsi.update(candle.close),
      atr: this.atr.update(candle.high, candle.low, candle.close),
      macd: this.macd.update(candle.close),
      sma20: this.sma20.update(candle.close),
      sma50: this.sma50.update(candle.close),
      bb: this.bb.update(candle.close),
      adx: this.adx.update(candle.high, candle.low, candle.close)
    };
  }

  updatePrice(price: number): IndicatorResult {
    return {
      ema12: this.ema12.update(price),
      ema26: this.ema26.update(price),
      ema200: this.ema200.update(price),
      rsi: this.rsi.update(price),
      atr: null, // ATR needs OHLC
      macd: this.macd.update(price),
      sma20: this.sma20.update(price),
      sma50: this.sma50.update(price),
      bb: this.bb.update(price),
      adx: null // ADX needs OHLC
    };
  }

  reset(): void {
    this.ema12.reset();
    this.ema26.reset();
    this.ema200.reset();
    this.sma20.reset();
    this.sma50.reset();
    this.rsi.reset();
    this.atr.reset();
    this.macd.reset();
    this.bb.reset();
    this.adx.reset();
  }
}

// Worker instance
const calculator = new IndicatorCalculator();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, payload, requestId } = event.data;

  try {
    let result: IndicatorResult;

    switch (type) {
      case 'CALCULATE_INDICATORS':
        if (!payload?.candles) {
          throw new Error('No candles provided');
        }
        result = calculator.processCandles(payload.candles);
        break;

      case 'UPDATE_PRICE':
        if (payload?.price === undefined) {
          throw new Error('No price provided');
        }
        result = calculator.updatePrice(payload.price);
        break;

      case 'RESET':
        calculator.reset();
        return;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = {
      type: 'INDICATOR_RESULT',
      payload: result,
      requestId
    };
    self.postMessage(response);

  } catch (error) {
    const response: WorkerResponse = {
      type: 'ERROR',
      payload: { error: String(error) },
      requestId
    };
    self.postMessage(response);
  }
};

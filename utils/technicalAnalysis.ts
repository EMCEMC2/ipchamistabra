import { ChartDataPoint } from '../types';

export const calculateEMA = (data: number[], period: number): number[] => {
    // CRITICAL FIX: Guard against empty or invalid data
    if (!data || data.length === 0 || !Number.isFinite(data[0])) {
        return [];
    }
    const k = 2 / (period + 1);
    const emaArray = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
};

export const calculateRSI = (data: number[], period: number = 14): number[] => {
    const rsiArray: number[] = [];
    let gains = 0;
    let losses = 0;

    // First average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Guard against division by zero: if avgLoss is 0, RSI is 100 (max bullish)
    if (avgLoss === 0) {
        rsiArray.push(avgGain === 0 ? 50 : 100);
    } else {
        rsiArray.push(100 - (100 / (1 + avgGain / avgLoss)));
    }

    // Smoothed averages
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        // Guard against division by zero in smoothed calculation
        if (avgLoss === 0) {
            rsiArray.push(avgGain === 0 ? 50 : 100);
        } else {
            rsiArray.push(100 - (100 / (1 + avgGain / avgLoss)));
        }
    }

    return rsiArray; // Note: Array length is data.length - period
};

export const calculateMACD = (data: number[], fast: number = 12, slow: number = 26, signal: number = 9) => {
    const fastEMA = calculateEMA(data, fast);
    const slowEMA = calculateEMA(data, slow);

    // Align arrays (slow EMA is shorter)
    const macdLine: number[] = [];
    const startIdx = slow - 1; // Index where slow EMA starts being valid

    for (let i = 0; i < slowEMA.length; i++) {
        // Fast EMA corresponds to data[i + (slow - fast)] roughly? 
        // Actually calculateEMA returns array same length as input? No, usually EMA starts after period.
        // My simple EMA implementation returns array same length as input, starting from index 0 (using first value as seed).
        // So we can just subtract.
        macdLine.push(fastEMA[i] - slowEMA[i]);
    }

    const signalLine = calculateEMA(macdLine, signal);
    const histogram = macdLine.map((val, i) => val - signalLine[i]);

    return { macdLine, signalLine, histogram };
};

export const calculateATR = (high: number[], low: number[], close: number[], period: number = 14): number[] => {
    const tr: number[] = [high[0] - low[0]];

    for (let i = 1; i < high.length; i++) {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i - 1]);
        const lc = Math.abs(low[i] - close[i - 1]);
        tr.push(Math.max(hl, hc, lc));
    }

    return calculateRMA(tr, period);
};

export const calculateADX = (high: number[], low: number[], close: number[], period: number = 14) => {
    // 1. Calculate TR, +DM, -DM
    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < high.length; i++) {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i - 1]);
        const lc = Math.abs(low[i] - close[i - 1]);
        tr.push(Math.max(hl, hc, lc));

        const upMove = high[i] - high[i - 1];
        const downMove = low[i - 1] - low[i];

        if (upMove > downMove && upMove > 0) plusDM.push(upMove); else plusDM.push(0);
        if (downMove > upMove && downMove > 0) minusDM.push(downMove); else minusDM.push(0);
    }

    // 2. Smooth TR, +DM, -DM (Wilder's Smoothing)
    // Helper for Wilder's smoothing
    const smooth = (data: number[], p: number) => {
        const smoothed: number[] = [];
        let sum = 0;
        for (let i = 0; i < p; i++) sum += data[i];
        smoothed.push(sum / p);
        for (let i = p; i < data.length; i++) {
            smoothed.push((smoothed[smoothed.length - 1] * (p - 1) + data[i]) / p);
        }
        return smoothed;
    };

    const smoothTR = smooth(tr, period);
    const smoothPlusDM = smooth(plusDM, period);
    const smoothMinusDM = smooth(minusDM, period);

    // 3. Calculate +DI, -DI
    const plusDI: number[] = [];
    const minusDI: number[] = [];
    const dx: number[] = [];

    // Align arrays
    const len = Math.min(smoothTR.length, smoothPlusDM.length, smoothMinusDM.length);

    for (let i = 0; i < len; i++) {
        const pDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
        const mDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
        plusDI.push(pDI);
        minusDI.push(mDI);

        const val = Math.abs(pDI - mDI) / (pDI + mDI) * 100;
        dx.push(isNaN(val) ? 0 : val);
    }

    // 4. Calculate ADX (Smoothed DX)
    const adx = smooth(dx, period);

    return { adx, plusDI, minusDI };
};

export const calculateSMA = (data: number[], period: number): number[] => {
    const sma: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(NaN);
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j];
        sma.push(sum / period);
    }
    return sma;
};

export const calculateTR = (data: ChartDataPoint[]): number[] => {
    const tr = [0]; // First TR is 0 or high-low
    for (let i = 1; i < data.length; i++) {
        const h = data[i].high;
        const l = data[i].low;
        const pc = data[i - 1].close;
        tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    return tr;
};

export const calculateRMA = (src: number[], length: number): number[] => {
    const rma: number[] = [];
    const alpha = 1 / length;

    // Pad initial values with NaN
    for (let i = 0; i < length - 1; i++) {
        rma.push(NaN);
    }

    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < length; i++) {
        sum += src[i];
    }
    let prev = sum / length;
    rma.push(prev);

    // Calculate RMA for the rest
    for (let i = length; i < src.length; i++) {
        const val = (prev * (length - 1) + src[i]) / length;
        rma.push(val);
        prev = val;
    }

    return rma;
};

export const calculateStdev = (data: number[], period: number): number[] => {
    const stdev: number[] = [];
    const sma = calculateSMA(data, period);
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { stdev.push(NaN); continue; }
        let sumSqDiff = 0;
        const avg = sma[i];
        for (let j = 0; j < period; j++) {
            sumSqDiff += Math.pow(data[i - j] - avg, 2);
        }
        stdev.push(Math.sqrt(sumSqDiff / period));
    }
    return stdev;
};

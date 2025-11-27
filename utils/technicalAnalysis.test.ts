import { describe, it, expect } from 'vitest';
import { calculateRMA, calculateATR, calculateADX } from './technicalAnalysis';

describe('Technical Analysis Utils', () => {
    describe('calculateRMA', () => {
        it('should return correct RMA values', () => {
            const src = [10, 10, 10, 10, 10];
            const length = 3;
            // SMA of first 3 is 10.
            // Next: (10 * 2 + 10) / 3 = 10
            const rma = calculateRMA(src, length);
            
            // First length-1 should be NaN
            expect(rma[0]).toBeNaN();
            expect(rma[1]).toBeNaN();
            
            // Index length-1 (2) should be SMA (10)
            expect(rma[2]).toBe(10);
            
            // Subsequent values
            expect(rma[3]).toBe(10);
            expect(rma[4]).toBe(10);
        });

        it('should handle varying inputs correctly', () => {
            // Wilder's example or simple math
            // src: 1, 2, 3, 4, 5. length: 2
            // SMA(1,2) = 1.5. Index 1.
            // Next (3): (1.5 * 1 + 3) / 2 = 2.25
            // Next (4): (2.25 * 1 + 4) / 2 = 3.125
            // Next (5): (3.125 * 1 + 5) / 2 = 4.0625
            
            const src = [1, 2, 3, 4, 5];
            const length = 2;
            const rma = calculateRMA(src, length);
            
            expect(rma[0]).toBeNaN();
            expect(rma[1]).toBe(1.5);
            expect(rma[2]).toBe(2.25);
            expect(rma[3]).toBe(3.125);
            expect(rma[4]).toBe(4.0625);
        });
    });

    describe('calculateATR', () => {
        it('should calculate ATR correctly', () => {
            // High, Low, Close
            // Day 1: 10, 8, 9. TR = 2.
            // Day 2: 12, 10, 11. TR = max(2, |12-9|=3, |10-9|=1) = 3.
            // Day 3: 13, 11, 12. TR = max(2, |13-11|=2, |11-11|=0) -> Wait.
            // TR calculation: max(H-L, |H-Cp|, |L-Cp|)
            
            const high = [10, 12, 13];
            const low = [8, 10, 11];
            const close = [9, 11, 12];
            const period = 2;
            
            // TRs:
            // 0: 10-8 = 2
            // 1: max(12-10=2, |12-9|=3, |10-9|=1) = 3
            // 2: max(13-11=2, |13-11|=2, |11-11|=0) = 2
            
            // TR array: [2, 3, 2]
            // RMA(period 2) of [2, 3, 2]
            // Index 1 (SMA of 2,3): 2.5
            // Index 2: (2.5 * 1 + 2) / 2 = 2.25
            
            const atr = calculateATR(high, low, close, period);
            
            expect(atr[0]).toBeNaN();
            expect(atr[1]).toBe(2.5);
            expect(atr[2]).toBe(2.25);
        });
    });
});

/**
 * safeParseFloat.test.ts
 *
 * Unit tests for the safeParseFloat utility functions.
 * Tests critical edge cases that can cause NaN propagation in trading calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  safeParseFloat,
  safeParseFloatClamped,
  safeParseFloatOrNull
} from '../../../utils/safeParseFloat';

describe('safeParseFloat', () => {
  describe('valid numeric strings', () => {
    it('parses positive integers', () => {
      expect(safeParseFloat('84500')).toBe(84500);
    });

    it('parses negative integers', () => {
      expect(safeParseFloat('-1500')).toBe(-1500);
    });

    it('parses decimal numbers', () => {
      expect(safeParseFloat('84500.50')).toBe(84500.5);
    });

    it('parses negative decimals', () => {
      expect(safeParseFloat('-123.456')).toBe(-123.456);
    });

    it('parses zero', () => {
      expect(safeParseFloat('0')).toBe(0);
    });

    it('parses zero with decimals', () => {
      expect(safeParseFloat('0.00')).toBe(0);
    });
  });

  describe('null and undefined', () => {
    it('returns fallback for null', () => {
      expect(safeParseFloat(null)).toBe(0);
      expect(safeParseFloat(null, -1)).toBe(-1);
    });

    it('returns fallback for undefined', () => {
      expect(safeParseFloat(undefined)).toBe(0);
      expect(safeParseFloat(undefined, 100)).toBe(100);
    });
  });

  describe('empty and whitespace strings', () => {
    it('returns fallback for empty string', () => {
      expect(safeParseFloat('')).toBe(0);
      expect(safeParseFloat('', 999)).toBe(999);
    });

    it('returns fallback for whitespace-only string', () => {
      expect(safeParseFloat('   ')).toBe(0);
      expect(safeParseFloat('\t\n')).toBe(0);
    });
  });

  describe('NaN string handling', () => {
    it('returns fallback for "NaN" string', () => {
      expect(safeParseFloat('NaN')).toBe(0);
      expect(safeParseFloat('NaN', -1)).toBe(-1);
    });

    it('handles case-insensitive NaN', () => {
      expect(safeParseFloat('nan')).toBe(0);
      expect(safeParseFloat('NAN')).toBe(0);
    });
  });

  describe('non-numeric strings', () => {
    it('returns fallback for alphabetic strings', () => {
      expect(safeParseFloat('abc')).toBe(0);
      expect(safeParseFloat('hello world')).toBe(0);
    });

    it('returns fallback for placeholder values', () => {
      expect(safeParseFloat('-')).toBe(0);
      expect(safeParseFloat('N/A')).toBe(0);
      expect(safeParseFloat('n/a')).toBe(0);
      expect(safeParseFloat('--')).toBe(0);
    });
  });

  describe('range strings (trading entry zones)', () => {
    it('extracts first number from range "84500-85000"', () => {
      expect(safeParseFloat('84500-85000')).toBe(84500);
    });

    it('extracts first number from range with decimals', () => {
      expect(safeParseFloat('84500.50-85000.75')).toBe(84500.5);
    });

    it('handles negative range start', () => {
      expect(safeParseFloat('-100-200')).toBe(-100);
    });
  });

  describe('currency and formatted strings', () => {
    it('strips dollar sign', () => {
      expect(safeParseFloat('$84500')).toBe(84500);
    });

    it('strips commas', () => {
      expect(safeParseFloat('84,500')).toBe(84500);
    });

    it('handles full currency format', () => {
      expect(safeParseFloat('$84,500.00')).toBe(84500);
    });
  });

  describe('edge cases', () => {
    it('handles very large numbers', () => {
      expect(safeParseFloat('999999999999')).toBe(999999999999);
    });

    it('handles very small decimals', () => {
      expect(safeParseFloat('0.00000001')).toBe(0.00000001);
    });

    it('handles scientific notation', () => {
      expect(safeParseFloat('1e10')).toBe(1e10);
    });

    it('handles numbers with leading zeros', () => {
      expect(safeParseFloat('007')).toBe(7);
    });

    it('handles strings with trailing text', () => {
      // Should extract the leading number
      expect(safeParseFloat('100abc')).toBe(100);
    });
  });

  describe('custom fallback values', () => {
    it('uses provided fallback for invalid input', () => {
      expect(safeParseFloat('invalid', 42)).toBe(42);
    });

    it('uses provided fallback for null', () => {
      expect(safeParseFloat(null, 999)).toBe(999);
    });

    it('default fallback is 0', () => {
      expect(safeParseFloat('invalid')).toBe(0);
    });
  });
});

describe('safeParseFloatClamped', () => {
  it('clamps value above maximum', () => {
    expect(safeParseFloatClamped('150', 1, 125, 10)).toBe(125);
  });

  it('clamps value below minimum', () => {
    expect(safeParseFloatClamped('-5', 1, 125, 10)).toBe(1);
  });

  it('returns value within range unchanged', () => {
    expect(safeParseFloatClamped('50', 1, 125, 10)).toBe(50);
  });

  it('returns fallback for invalid input', () => {
    expect(safeParseFloatClamped('abc', 1, 125, 10)).toBe(10);
  });

  it('clamps at boundaries', () => {
    expect(safeParseFloatClamped('1', 1, 125, 10)).toBe(1);
    expect(safeParseFloatClamped('125', 1, 125, 10)).toBe(125);
  });

  it('handles decimal ranges', () => {
    expect(safeParseFloatClamped('0.5', 0.1, 1.0, 0.5)).toBe(0.5);
    expect(safeParseFloatClamped('0.05', 0.1, 1.0, 0.5)).toBe(0.1);
    expect(safeParseFloatClamped('1.5', 0.1, 1.0, 0.5)).toBe(1.0);
  });
});

describe('safeParseFloatOrNull', () => {
  it('returns number for valid input', () => {
    expect(safeParseFloatOrNull('84500')).toBe(84500);
  });

  it('returns 0 for "0" (not null)', () => {
    expect(safeParseFloatOrNull('0')).toBe(0);
  });

  it('returns null for null input', () => {
    expect(safeParseFloatOrNull(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(safeParseFloatOrNull(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseFloatOrNull('')).toBeNull();
  });

  it('returns null for NaN string', () => {
    expect(safeParseFloatOrNull('NaN')).toBeNull();
  });

  it('returns null for placeholder values', () => {
    expect(safeParseFloatOrNull('-')).toBeNull();
    expect(safeParseFloatOrNull('N/A')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(safeParseFloatOrNull('abc')).toBeNull();
  });

  it('extracts first number from range', () => {
    expect(safeParseFloatOrNull('84500-85000')).toBe(84500);
  });
});

describe('trading-specific scenarios', () => {
  it('handles signal invalidation parsing', () => {
    // These are real scenarios from trading signals
    expect(safeParseFloat('84000')).toBe(84000);
    expect(safeParseFloat('83,500.00')).toBe(83500);
    expect(safeParseFloat('')).toBe(0); // Missing stop loss
  });

  it('handles target price parsing', () => {
    expect(safeParseFloat('86000')).toBe(86000);
    expect(safeParseFloat('87500-88000')).toBe(87500); // Range target
  });

  it('handles entry zone parsing', () => {
    expect(safeParseFloat('84500-85000')).toBe(84500);
    expect(safeParseFloat('84500')).toBe(84500);
  });

  it('handles balance/margin calculations', () => {
    expect(safeParseFloat('50000.00')).toBe(50000);
    expect(safeParseFloat('$1,234.56')).toBe(1234.56);
  });

  it('handles leverage parsing', () => {
    expect(safeParseFloatClamped('10', 1, 125, 1)).toBe(10);
    expect(safeParseFloatClamped('200', 1, 125, 1)).toBe(125); // Clamped to max
    expect(safeParseFloatClamped('0', 1, 125, 1)).toBe(1); // Clamped to min
    expect(safeParseFloatClamped('invalid', 1, 125, 1)).toBe(1); // Fallback
  });
});

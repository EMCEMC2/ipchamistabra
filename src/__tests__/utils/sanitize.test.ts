/**
 * Sanitization Tests
 * Tests for input validation and XSS prevention
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeForDisplay,
  sanitizeUrl,
  sanitizeNumber,
  sanitizeForStorage,
  isValidSymbol,
  isValidOrderSide,
  isValidApiKey,
  validateRange,
  ValidationError
} from '../../utils/sanitize';

describe('sanitizeHtml', () => {
  it('should escape HTML entities', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(sanitizeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape quotes', () => {
    expect(sanitizeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    expect(sanitizeHtml("It's fine")).toBe('It&#x27;s fine');
  });

  it('should handle empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeForDisplay', () => {
  it('should strip script tags', () => {
    expect(sanitizeForDisplay('<script>evil()</script>normal text')).toBe('normal text');
  });

  it('should strip event handlers', () => {
    expect(sanitizeForDisplay('<img onerror="evil()" src="x">')).not.toContain('onerror');
  });

  it('should strip javascript: URLs', () => {
    expect(sanitizeForDisplay('<a href="javascript:evil()">click</a>')).not.toContain('javascript:');
  });

  it('should preserve normal text', () => {
    expect(sanitizeForDisplay('Hello, World!')).toBe('Hello, World!');
  });

  it('should handle unicode', () => {
    expect(sanitizeForDisplay('Hello 世界 🌍')).toBe('Hello 世界 🌍');
  });
});

describe('sanitizeUrl', () => {
  it('should allow https URLs', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('should allow http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('should allow relative URLs', () => {
    expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
  });

  it('should block javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('should block data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>evil()</script>')).toBe('');
  });

  it('should handle malformed URLs', () => {
    expect(sanitizeUrl('not a url at all')).toBe('');
  });
});

describe('sanitizeNumber', () => {
  it('should parse valid integers', () => {
    expect(sanitizeNumber('42')).toBe(42);
  });

  it('should parse valid floats', () => {
    expect(sanitizeNumber('3.14')).toBe(3.14);
  });

  it('should parse negative numbers', () => {
    expect(sanitizeNumber('-10.5')).toBe(-10.5);
  });

  it('should return default for NaN', () => {
    expect(sanitizeNumber('not a number', 0)).toBe(0);
  });

  it('should clamp to min value', () => {
    expect(sanitizeNumber('-100', 0, { min: 0 })).toBe(0);
  });

  it('should clamp to max value', () => {
    expect(sanitizeNumber('1000', 0, { max: 100 })).toBe(100);
  });

  it('should handle Infinity', () => {
    expect(sanitizeNumber('Infinity', 0)).toBe(0);
  });
});

describe('sanitizeForStorage', () => {
  it('should strip functions from objects', () => {
    const input = {
      name: 'test',
      callback: () => console.log('evil')
    };
    const result = sanitizeForStorage(input);
    expect(result).not.toHaveProperty('callback');
  });

  it('should handle nested objects', () => {
    const input = {
      user: {
        name: 'test',
        nested: {
          value: 42
        }
      }
    };
    const result = sanitizeForStorage(input);
    expect(result.user.nested.value).toBe(42);
  });

  it('should handle arrays', () => {
    const input = [1, 2, { value: 3 }];
    const result = sanitizeForStorage(input);
    expect(result).toEqual([1, 2, { value: 3 }]);
  });

  it('should handle circular references gracefully', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    obj.self = obj;

    // Should not throw
    expect(() => sanitizeForStorage(obj)).not.toThrow();
  });
});

describe('isValidSymbol', () => {
  it('should accept valid crypto pairs', () => {
    expect(isValidSymbol('BTCUSDT')).toBe(true);
    expect(isValidSymbol('ETHBTC')).toBe(true);
    expect(isValidSymbol('DOGEUSDT')).toBe(true);
  });

  it('should reject invalid symbols', () => {
    expect(isValidSymbol('')).toBe(false);
    expect(isValidSymbol('BTC_USDT')).toBe(false);
    expect(isValidSymbol('btc/usdt')).toBe(false);
    expect(isValidSymbol('123')).toBe(false);
  });

  it('should reject symbols with special characters', () => {
    expect(isValidSymbol('BTC<script>')).toBe(false);
    expect(isValidSymbol("BTC' OR '1'='1")).toBe(false);
  });
});

describe('isValidOrderSide', () => {
  it('should accept valid sides', () => {
    expect(isValidOrderSide('BUY')).toBe(true);
    expect(isValidOrderSide('SELL')).toBe(true);
  });

  it('should be case-sensitive', () => {
    expect(isValidOrderSide('buy')).toBe(false);
    expect(isValidOrderSide('Buy')).toBe(false);
  });

  it('should reject invalid sides', () => {
    expect(isValidOrderSide('')).toBe(false);
    expect(isValidOrderSide('HOLD')).toBe(false);
  });
});

describe('isValidApiKey', () => {
  it('should accept valid API keys', () => {
    expect(isValidApiKey('abcdef1234567890ABCDEF1234567890')).toBe(true);
  });

  it('should reject keys that are too short', () => {
    expect(isValidApiKey('abc')).toBe(false);
  });

  it('should reject keys with invalid characters', () => {
    expect(isValidApiKey('abc$def!ghi@jkl')).toBe(false);
  });
});

describe('validateRange', () => {
  it('should pass for values in range', () => {
    expect(() => validateRange(50, 0, 100, 'value')).not.toThrow();
  });

  it('should throw for values below min', () => {
    expect(() => validateRange(-1, 0, 100, 'value')).toThrow(ValidationError);
  });

  it('should throw for values above max', () => {
    expect(() => validateRange(101, 0, 100, 'value')).toThrow(ValidationError);
  });

  it('should include field name in error message', () => {
    try {
      validateRange(-1, 0, 100, 'myField');
    } catch (e) {
      expect((e as Error).message).toContain('myField');
    }
  });
});

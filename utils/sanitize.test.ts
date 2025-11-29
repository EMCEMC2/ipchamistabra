/**
 * Unit Tests for Input Sanitization
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeNumber,
  sanitizePercentage,
  sanitizePrice,
  sanitizeQuantity,
  sanitizeTradingPair,
  sanitizeApiKey,
  sanitizeJson,
  sanitizeUrl,
  sanitizeWsUrl,
  sanitizeOrderType,
  sanitizeTradeSide,
  sanitizeStringArray,
  checkRateLimit
} from './sanitize';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles non-string input', () => {
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<div>Hello</div>')).toBe('Hello');
  });

  it('removes nested tags', () => {
    expect(stripHtml('<div><span>Test</span></div>')).toBe('Test');
  });

  it('handles self-closing tags', () => {
    expect(stripHtml('Line<br/>Break')).toBe('LineBreak');
  });
});

describe('sanitizeString', () => {
  it('sanitizes malicious input', () => {
    const malicious = '<script>document.cookie</script>';
    const result = sanitizeString(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('handles null and undefined', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(sanitizeString(123)).toBe('123');
  });

  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });
});

describe('sanitizeNumber', () => {
  it('parses valid numbers', () => {
    expect(sanitizeNumber(42)).toBe(42);
    expect(sanitizeNumber('42.5')).toBe(42.5);
  });

  it('respects min/max bounds', () => {
    expect(sanitizeNumber(150, { max: 100 })).toBe(100);
    expect(sanitizeNumber(-10, { min: 0 })).toBe(0);
  });

  it('returns default for invalid input', () => {
    expect(sanitizeNumber('invalid', { defaultValue: 0 })).toBe(0);
    expect(sanitizeNumber(NaN, { defaultValue: 10 })).toBe(10);
  });

  it('handles negative numbers', () => {
    expect(sanitizeNumber(-5, { allowNegative: false })).toBe(5);
  });

  it('rounds to specified decimals', () => {
    expect(sanitizeNumber(3.14159, { decimals: 2 })).toBe(3.14);
  });

  it('strips non-numeric characters from strings', () => {
    expect(sanitizeNumber('$1,234.56')).toBe(1234.56);
  });
});

describe('sanitizePercentage', () => {
  it('clamps to 0-100', () => {
    expect(sanitizePercentage(150)).toBe(100);
    expect(sanitizePercentage(-10)).toBe(0);
    expect(sanitizePercentage(50)).toBe(50);
  });
});

describe('sanitizePrice', () => {
  it('returns valid price', () => {
    expect(sanitizePrice(100.12345678)).toBe(100.12345678);
  });

  it('prevents negative prices', () => {
    expect(sanitizePrice(-100)).toBe(0);
  });

  it('caps at maximum', () => {
    expect(sanitizePrice(2000000000)).toBe(1000000000);
  });
});

describe('sanitizeQuantity', () => {
  it('returns valid quantity', () => {
    expect(sanitizeQuantity(0.001)).toBe(0.001);
  });

  it('prevents negative quantities', () => {
    expect(sanitizeQuantity(-1)).toBe(0);
  });
});

describe('sanitizeTradingPair', () => {
  it('normalizes trading pair', () => {
    expect(sanitizeTradingPair('btcusdt')).toBe('BTCUSDT');
    expect(sanitizeTradingPair('ETH-USDT')).toBe('ETHUSDT');
  });

  it('returns default for invalid pairs', () => {
    expect(sanitizeTradingPair('AB')).toBe('BTCUSDT');
    expect(sanitizeTradingPair('')).toBe('BTCUSDT');
  });

  it('handles non-string input', () => {
    expect(sanitizeTradingPair(123)).toBe('BTCUSDT');
  });
});

describe('sanitizeApiKey', () => {
  it('accepts valid API keys', () => {
    const key = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456';
    expect(sanitizeApiKey(key)).toBe(key);
  });

  it('rejects keys with invalid characters', () => {
    expect(sanitizeApiKey('key with spaces')).toBe('');
    expect(sanitizeApiKey('key<script>')).toBe('');
  });

  it('rejects too short keys', () => {
    expect(sanitizeApiKey('short')).toBe('');
  });

  it('handles non-string input', () => {
    expect(sanitizeApiKey(null)).toBe('');
  });
});

describe('sanitizeJson', () => {
  it('parses valid JSON', () => {
    expect(sanitizeJson('{"key": "value"}', {})).toEqual({ key: 'value' });
  });

  it('returns default for invalid JSON', () => {
    expect(sanitizeJson('invalid', { fallback: true })).toEqual({ fallback: true });
  });

  it('handles non-string input', () => {
    expect(sanitizeJson(123, [])).toEqual([]);
  });
});

describe('sanitizeUrl', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('accepts valid HTTP URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('rejects non-http protocols', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('file:///etc/passwd')).toBe('');
  });

  it('rejects invalid URLs', () => {
    expect(sanitizeUrl('not-a-url')).toBe('');
  });
});

describe('sanitizeWsUrl', () => {
  it('accepts valid WSS URLs', () => {
    expect(sanitizeWsUrl('wss://stream.binance.com:9443')).toBe('wss://stream.binance.com:9443/');
  });

  it('accepts valid WS URLs', () => {
    expect(sanitizeWsUrl('ws://localhost:8080')).toBe('ws://localhost:8080/');
  });

  it('rejects HTTP URLs', () => {
    expect(sanitizeWsUrl('https://example.com')).toBe('');
  });
});

describe('sanitizeOrderType', () => {
  it('returns valid order types', () => {
    expect(sanitizeOrderType('MARKET')).toBe('MARKET');
    expect(sanitizeOrderType('limit')).toBe('LIMIT');
  });

  it('defaults to MARKET for invalid types', () => {
    expect(sanitizeOrderType('INVALID')).toBe('MARKET');
    expect(sanitizeOrderType('')).toBe('MARKET');
  });
});

describe('sanitizeTradeSide', () => {
  it('normalizes trade side', () => {
    expect(sanitizeTradeSide('long')).toBe('LONG');
    expect(sanitizeTradeSide('SHORT')).toBe('SHORT');
    expect(sanitizeTradeSide('buy')).toBe('LONG');
    expect(sanitizeTradeSide('sell')).toBe('SHORT');
  });

  it('defaults to LONG for invalid sides', () => {
    expect(sanitizeTradeSide('INVALID')).toBe('LONG');
  });
});

describe('sanitizeStringArray', () => {
  it('filters and sanitizes strings', () => {
    expect(sanitizeStringArray(['hello', 123, 'world'])).toEqual(['hello', 'world']);
  });

  it('handles non-array input', () => {
    expect(sanitizeStringArray('not-array')).toEqual([]);
    expect(sanitizeStringArray(null)).toEqual([]);
  });

  it('removes empty strings', () => {
    expect(sanitizeStringArray(['a', '', 'b'])).toEqual(['a', 'b']);
  });
});

describe('checkRateLimit', () => {
  it('allows requests within limit', () => {
    const key = 'test-' + Date.now();
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
  });

  it('blocks requests over limit', () => {
    const key = 'test-blocked-' + Date.now();
    checkRateLimit(key, 2, 10000);
    checkRateLimit(key, 2, 10000);
    expect(checkRateLimit(key, 2, 10000)).toBe(false);
  });
});

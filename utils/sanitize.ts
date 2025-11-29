/**
 * Input Sanitization Utilities
 * Protects against XSS, injection, and malformed input
 */

/**
 * HTML entity encoding map
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Strip all HTML tags from string
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize string for safe display
 * Combines HTML stripping and entity escaping
 */
export function sanitizeString(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') {
    input = String(input);
  }
  return escapeHtml(stripHtml(input as string)).trim();
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumber(
  input: unknown,
  options: {
    min?: number;
    max?: number;
    defaultValue?: number;
    allowNegative?: boolean;
    decimals?: number;
  } = {}
): number {
  const {
    min = -Infinity,
    max = Infinity,
    defaultValue = 0,
    allowNegative = true,
    decimals
  } = options;

  let num: number;

  if (typeof input === 'number') {
    num = input;
  } else if (typeof input === 'string') {
    num = parseFloat(input.replace(/[^0-9.-]/g, ''));
  } else {
    return defaultValue;
  }

  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }

  if (!allowNegative && num < 0) {
    num = Math.abs(num);
  }

  num = Math.max(min, Math.min(max, num));

  if (decimals !== undefined) {
    num = Number(num.toFixed(decimals));
  }

  return num;
}

/**
 * Validate and sanitize percentage (0-100)
 */
export function sanitizePercentage(input: unknown): number {
  return sanitizeNumber(input, {
    min: 0,
    max: 100,
    defaultValue: 0,
    decimals: 2
  });
}

/**
 * Validate and sanitize price value
 */
export function sanitizePrice(input: unknown): number {
  return sanitizeNumber(input, {
    min: 0,
    max: 1000000000,
    defaultValue: 0,
    allowNegative: false,
    decimals: 8
  });
}

/**
 * Validate and sanitize quantity
 */
export function sanitizeQuantity(input: unknown): number {
  return sanitizeNumber(input, {
    min: 0,
    max: 1000000000,
    defaultValue: 0,
    allowNegative: false,
    decimals: 8
  });
}

/**
 * Validate trading pair format (e.g., BTCUSDT)
 */
export function sanitizeTradingPair(input: unknown): string {
  if (typeof input !== 'string') return 'BTCUSDT';

  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (cleaned.length < 5 || cleaned.length > 12) {
    return 'BTCUSDT';
  }

  return cleaned;
}

/**
 * Validate API key format
 * Returns sanitized key or empty string if invalid
 */
export function sanitizeApiKey(input: unknown): string {
  if (typeof input !== 'string') return '';

  const cleaned = input.trim();

  // API keys are typically alphanumeric
  if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) {
    return '';
  }

  // Reasonable length bounds for API keys
  if (cleaned.length < 10 || cleaned.length > 256) {
    return '';
  }

  return cleaned;
}

/**
 * Validate JSON string and parse safely
 */
export function sanitizeJson<T>(input: unknown, defaultValue: T): T {
  if (typeof input !== 'string') return defaultValue;

  try {
    const parsed = JSON.parse(input);
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Validate URL format
 */
export function sanitizeUrl(input: unknown): string {
  if (typeof input !== 'string') return '';

  try {
    const url = new URL(input.trim());

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Validate WebSocket URL format
 */
export function sanitizeWsUrl(input: unknown): string {
  if (typeof input !== 'string') return '';

  try {
    const url = new URL(input.trim());

    // Only allow ws/wss protocols
    if (!['ws:', 'wss:'].includes(url.protocol)) {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item))
    .filter(item => item.length > 0);
}

/**
 * Validate order type
 */
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
export function sanitizeOrderType(input: unknown): OrderType {
  const validTypes: OrderType[] = ['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'];
  if (typeof input === 'string' && validTypes.includes(input.toUpperCase() as OrderType)) {
    return input.toUpperCase() as OrderType;
  }
  return 'MARKET';
}

/**
 * Validate trade side
 */
export type TradeSide = 'LONG' | 'SHORT';
export function sanitizeTradeSide(input: unknown): TradeSide {
  if (typeof input === 'string') {
    const upper = input.toUpperCase();
    if (upper === 'LONG' || upper === 'BUY') return 'LONG';
    if (upper === 'SHORT' || upper === 'SELL') return 'SHORT';
  }
  return 'LONG';
}

/**
 * Rate limit tracking for input validation
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Deep sanitize object properties
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  input: unknown,
  schema: Record<keyof T, (value: unknown) => unknown>
): Partial<T> {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const result: Partial<T> = {};
  const obj = input as Record<string, unknown>;

  for (const [key, sanitizer] of Object.entries(schema)) {
    if (key in obj) {
      (result as Record<string, unknown>)[key] = sanitizer(obj[key]);
    }
  }

  return result;
}

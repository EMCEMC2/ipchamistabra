/**
 * Credential Validation Service
 * Validates API credentials on startup and provides secure access
 */

import { sanitizeApiKey, sanitizeUrl, sanitizeWsUrl } from '../../utils/sanitize';

export interface CredentialStatus {
  hasGeminiKey: boolean;
  hasBinanceCredentials: boolean;
  hasValidEndpoints: boolean;
  warnings: string[];
  errors: string[];
}

interface CredentialConfig {
  geminiApiKey?: string;
  binanceApiKey?: string;
  binanceApiSecret?: string;
  binanceWsUrl?: string;
  binanceRestUrl?: string;
}

let cachedStatus: CredentialStatus | null = null;
let lastValidation = 0;
const VALIDATION_CACHE_MS = 60000; // Re-validate every minute

/**
 * Validate all credentials on startup
 */
export function validateCredentials(): CredentialStatus {
  const now = Date.now();

  // Return cached result if recent
  if (cachedStatus && (now - lastValidation) < VALIDATION_CACHE_MS) {
    return cachedStatus;
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  // Check Gemini API key
  const geminiKey = getEnvVar('VITE_GEMINI_API_KEY');
  const hasGeminiKey = isValidApiKey(geminiKey);

  if (!hasGeminiKey) {
    warnings.push('Gemini API key not configured - AI features disabled');
  }

  // Check Binance credentials
  const binanceKey = getEnvVar('VITE_BINANCE_API_KEY');
  const binanceSecret = getEnvVar('VITE_BINANCE_API_SECRET');
  const hasBinanceCredentials = isValidApiKey(binanceKey) && isValidApiKey(binanceSecret);

  if (!hasBinanceCredentials) {
    warnings.push('Binance credentials not configured - using public endpoints only');
  }

  // Check endpoint URLs
  const wsUrl = getEnvVar('VITE_BINANCE_WS_URL') || 'wss://stream.binance.com:9443';
  const restUrl = getEnvVar('VITE_BINANCE_REST_URL') || 'https://api.binance.com';

  const validWs = sanitizeWsUrl(wsUrl).length > 0;
  const validRest = sanitizeUrl(restUrl).length > 0;
  const hasValidEndpoints = validWs && validRest;

  if (!validWs) {
    errors.push('Invalid WebSocket URL configuration');
  }
  if (!validRest) {
    errors.push('Invalid REST API URL configuration');
  }

  // Check for credentials in localStorage (security issue)
  if (typeof window !== 'undefined') {
    const localStorageKeys = Object.keys(localStorage);
    const sensitivePatterns = [/api.?key/i, /secret/i, /password/i, /token/i];

    for (const key of localStorageKeys) {
      for (const pattern of sensitivePatterns) {
        if (pattern.test(key)) {
          errors.push(`Sensitive data found in localStorage: ${key}`);
          break;
        }
      }
    }
  }

  cachedStatus = {
    hasGeminiKey,
    hasBinanceCredentials,
    hasValidEndpoints,
    warnings,
    errors
  };

  lastValidation = now;
  return cachedStatus;
}

/**
 * Get environment variable safely
 */
function getEnvVar(name: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[name] || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || '';
  }
  return '';
}

/**
 * Check if API key format is valid
 */
function isValidApiKey(key: string | undefined): boolean {
  if (!key) return false;
  const sanitized = sanitizeApiKey(key);
  return sanitized.length > 0;
}

/**
 * Get Gemini API key (throws if not available)
 */
export function getGeminiApiKey(): string {
  const key = getEnvVar('VITE_GEMINI_API_KEY');
  const sanitized = sanitizeApiKey(key);

  if (!sanitized) {
    throw new CredentialError('Gemini API key not configured');
  }

  return sanitized;
}

/**
 * Get Gemini API key if available (returns null otherwise)
 */
export function getGeminiApiKeyOrNull(): string | null {
  const key = getEnvVar('VITE_GEMINI_API_KEY');
  const sanitized = sanitizeApiKey(key);
  return sanitized || null;
}

/**
 * Get Binance credentials (throws if not available)
 */
export function getBinanceCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = sanitizeApiKey(getEnvVar('VITE_BINANCE_API_KEY'));
  const apiSecret = sanitizeApiKey(getEnvVar('VITE_BINANCE_API_SECRET'));

  if (!apiKey || !apiSecret) {
    throw new CredentialError('Binance credentials not configured');
  }

  return { apiKey, apiSecret };
}

/**
 * Get Binance WebSocket URL
 */
export function getBinanceWsUrl(): string {
  const url = getEnvVar('VITE_BINANCE_WS_URL') || 'wss://stream.binance.com:9443';
  const sanitized = sanitizeWsUrl(url);

  if (!sanitized) {
    return 'wss://stream.binance.com:9443';
  }

  return sanitized;
}

/**
 * Get Binance REST URL
 */
export function getBinanceRestUrl(): string {
  const url = getEnvVar('VITE_BINANCE_REST_URL') || 'https://api.binance.com';
  const sanitized = sanitizeUrl(url);

  if (!sanitized) {
    return 'https://api.binance.com';
  }

  return sanitized;
}

/**
 * Check if AI features are available
 */
export function isAiAvailable(): boolean {
  const key = getEnvVar('VITE_GEMINI_API_KEY');
  return isValidApiKey(key);
}

/**
 * Check if authenticated trading is available
 */
export function isAuthenticatedTradingAvailable(): boolean {
  const apiKey = getEnvVar('VITE_BINANCE_API_KEY');
  const apiSecret = getEnvVar('VITE_BINANCE_API_SECRET');
  return isValidApiKey(apiKey) && isValidApiKey(apiSecret);
}

/**
 * Custom error for credential issues
 */
export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

/**
 * Log credential status on startup (safe - no sensitive data)
 */
export function logCredentialStatus(): void {
  const status = validateCredentials();

  console.log('[Security] Credential validation complete:');
  console.log(`  - Gemini API: ${status.hasGeminiKey ? 'Configured' : 'Not configured'}`);
  console.log(`  - Binance Auth: ${status.hasBinanceCredentials ? 'Configured' : 'Public only'}`);
  console.log(`  - Endpoints: ${status.hasValidEndpoints ? 'Valid' : 'Invalid'}`);

  for (const warning of status.warnings) {
    console.warn(`[Security] Warning: ${warning}`);
  }

  for (const error of status.errors) {
    console.error(`[Security] Error: ${error}`);
  }
}

/**
 * safeParseFloat.ts
 *
 * Safely parses numeric values from strings, handling edge cases that would
 * otherwise produce NaN and propagate through trading calculations.
 *
 * CRITICAL: This is a safety-critical utility for trading systems.
 * NaN values in stop-loss, take-profit, or position size calculations
 * can result in uncontrolled risk exposure.
 */

/**
 * Safely parses a float value, returning fallback if the result would be NaN.
 *
 * Handles the following edge cases:
 * - null, undefined
 * - Empty string ""
 * - String "NaN"
 * - Non-numeric strings like "abc", "N/A", "-"
 * - Range strings like "84500-85000" (extracts first number)
 * - Whitespace-only strings
 * - Strings with currency symbols like "$84,500"
 *
 * @param value - The value to parse (string, null, or undefined)
 * @param fallback - The value to return if parsing fails (default: 0)
 * @returns The parsed number or the fallback value
 *
 * @example
 * safeParseFloat("84500.50") // 84500.5
 * safeParseFloat("84500-85000") // 84500
 * safeParseFloat("", 0) // 0
 * safeParseFloat(null, -1) // -1
 * safeParseFloat("NaN", 0) // 0
 * safeParseFloat("$84,500", 0) // 84500
 */
export function safeParseFloat(
  value: string | null | undefined,
  fallback: number = 0
): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  // Convert to string and trim whitespace
  const str = String(value).trim();

  // Handle empty string
  if (str === '') {
    return fallback;
  }

  // Handle explicit "NaN" string
  if (str.toLowerCase() === 'nan') {
    return fallback;
  }

  // Handle common placeholder values
  if (str === '-' || str === 'N/A' || str === 'n/a' || str === '--') {
    return fallback;
  }

  // Handle range strings like "84500-85000" - extract first number
  // Match pattern: optional negative sign, digits, optional decimal, optional more digits
  // The negative lookahead (?!-) ensures we don't match the hyphen in a range
  const rangeMatch = str.match(/^(-?\d+\.?\d*)/);
  if (rangeMatch) {
    const parsed = parseFloat(rangeMatch[1]);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // Clean currency symbols, commas, and spaces from the string
  // This handles "$84,500.00" -> "84500.00"
  const cleaned = str
    .replace(/[$,\s]/g, '')
    .replace(/^[^\d.-]+/, ''); // Remove leading non-numeric chars except minus and dot

  // Try parsing the cleaned string
  const parsed = parseFloat(cleaned);

  // Validate the result is a finite number
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

/**
 * Parses a float and clamps it within a valid range.
 * Useful for values that must stay within bounds (e.g., leverage 1-125).
 *
 * @param value - The value to parse
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fallback - Value to use if parsing fails (must be within min/max)
 * @returns The parsed and clamped number
 *
 * @example
 * safeParseFloatClamped("150", 1, 125, 10) // 125
 * safeParseFloatClamped("-5", 1, 125, 10) // 1
 * safeParseFloatClamped("abc", 1, 125, 10) // 10
 */
export function safeParseFloatClamped(
  value: string | null | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = safeParseFloat(value, fallback);
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Parses a float and returns null if invalid.
 * Useful when you need to distinguish between "0" and "invalid".
 *
 * @param value - The value to parse
 * @returns The parsed number or null if invalid
 *
 * @example
 * safeParseFloatOrNull("84500") // 84500
 * safeParseFloatOrNull("0") // 0
 * safeParseFloatOrNull("abc") // null
 * safeParseFloatOrNull("") // null
 */
export function safeParseFloatOrNull(
  value: string | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const str = String(value).trim();

  if (str === '' || str.toLowerCase() === 'nan' || str === '-' || str === 'N/A') {
    return null;
  }

  // Handle range strings - extract first number
  const rangeMatch = str.match(/^(-?\d+\.?\d*)/);
  if (rangeMatch) {
    const parsed = parseFloat(rangeMatch[1]);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // Clean and parse
  const cleaned = str.replace(/[$,\s]/g, '').replace(/^[^\d.-]+/, '');
  const parsed = parseFloat(cleaned);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export default safeParseFloat;

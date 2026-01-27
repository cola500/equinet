/**
 * Date utilities for consistent date handling across the application.
 *
 * These utilities solve cross-browser compatibility issues, particularly
 * with Safari/WebKit which handles ISO date strings differently.
 */

/**
 * Parse a YYYY-MM-DD date string to a Date object in UTC.
 *
 * This function creates a UTC date to ensure consistency when storing
 * dates in PostgreSQL DATE columns via Prisma. Using UTC avoids timezone
 * issues where the same date string could map to different database values
 * depending on the server's timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object set to midnight UTC
 * @throws Error if dateStr is not in valid YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * const date = parseDate("2026-01-27")
 * // Returns: 2026-01-27T00:00:00.000Z (UTC)
 * ```
 */
export function parseDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`)
  }

  // Use UTC to ensure consistent date storage/retrieval regardless of timezone
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * Format a Date object to YYYY-MM-DD string using UTC values.
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * const str = formatDateToString(new Date("2026-01-27T00:00:00.000Z"))
 * // Returns: "2026-01-27"
 * ```
 */
export function formatDateToString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Check if a string is a valid YYYY-MM-DD date format.
 *
 * @param dateStr - String to validate
 * @returns true if valid YYYY-MM-DD format
 */
export function isValidDateString(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}

/**
 * Helpers for formatting rich notification messages.
 */

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
]

/** Format a date as "15 feb" */
export function formatNotifDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

/** Full name from first + last, e.g. "Anna Svensson" */
export function customerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
}

/** Truncate text to max length, adding "..." if truncated */
export function truncate(text: string, max = 30): string {
  if (text.length <= max) return text
  return text.slice(0, max - 3) + "..."
}

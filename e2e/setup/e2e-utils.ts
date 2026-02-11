/**
 * Shared E2E utilities - single source of truth for test configuration
 */

/** Emails that should NEVER be deleted during cleanup */
export const KEEP_EMAILS = ['test@example.com', 'provider@example.com', 'admin@example.com'] as const

/**
 * Assert that we're not running against a production database.
 * Throws if DATABASE_URL looks like a production Supabase instance.
 *
 * Override with E2E_ALLOW_REMOTE_DB=true for hosted dev databases.
 */
export function assertSafeDatabase(): void {
  if (process.env.E2E_ALLOW_REMOTE_DB === 'true') return

  const url = process.env.DATABASE_URL || ''

  // Allow localhost, Docker, and local Supabase (127.0.0.1, localhost, local containers)
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('host.docker.internal') ||
    url.includes('db.localhost')

  // Block hosted Supabase (*.supabase.co) unless it's local
  if (url.includes('.supabase.co') && !isLocal) {
    throw new Error(
      'SAFETY: DATABASE_URL points to a hosted Supabase instance. ' +
      'E2E tests must run against a local database. ' +
      'Set E2E_ALLOW_REMOTE_DB=true to override (for dev databases only).'
    )
  }
}

/**
 * Check if cleanup should be skipped (for debugging).
 * Set E2E_CLEANUP=false to keep test data after run.
 */
export function shouldSkipCleanup(): boolean {
  return process.env.E2E_CLEANUP === 'false'
}

/** Returns a date N days in the future */
export function futureDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(10, 0, 0, 0)
  return date
}

/**
 * Returns a date N days in the future, guaranteed to be a weekday (Mon-Fri).
 * If the result lands on Saturday, it shifts to Monday (+2).
 * If Sunday, it shifts to Monday (+1).
 * Use this for bookings that depend on provider availability (typically Mon-Fri).
 */
export function futureWeekday(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const dow = date.getDay()
  if (dow === 0) date.setDate(date.getDate() + 1) // Sun -> Mon
  if (dow === 6) date.setDate(date.getDate() + 2) // Sat -> Mon
  date.setHours(10, 0, 0, 0)
  return date
}

/** Returns a date N days in the past */
export function pastDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(10, 0, 0, 0)
  return date
}

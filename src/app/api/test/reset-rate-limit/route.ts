import { NextResponse } from 'next/server'
import { clearAllInMemoryRateLimits } from '@/lib/rate-limit'

/**
 * Test-only endpoint to reset in-memory rate limits.
 * Prevents rate limit accumulation across E2E test runs.
 *
 * BLOCKED in production via NODE_ENV check.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 })
  }

  clearAllInMemoryRateLimits()

  return NextResponse.json({ ok: true })
}

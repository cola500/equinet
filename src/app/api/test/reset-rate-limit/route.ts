import { NextResponse } from 'next/server'
import { clearAllInMemoryRateLimits, resetRateLimit } from '@/lib/rate-limit'

/**
 * Test-only endpoint to reset ALL rate limits (in-memory + Upstash).
 * Prevents rate limit accumulation across E2E test runs.
 *
 * BLOCKED unless ALLOW_TEST_ENDPOINTS env var is explicitly set.
 * This prevents access on Vercel (prod + preview) where the var is not configured.
 */
export async function POST() {
  if (!process.env.ALLOW_TEST_ENDPOINTS) {
    return new Response('Not found', { status: 404 })
  }

  // 1. Clear in-memory fallback state
  clearAllInMemoryRateLimits()

  // 2. Reset Upstash rate limits for common test IPs (all limiter types)
  const testIPs = ['127.0.0.1', '::1', 'unknown']
  const limiterTypes = [
    'login', 'registration', 'api', 'passwordReset',
    'booking', 'profileUpdate', 'serviceCreate', 'geocode', 'resendVerification', 'ai', 'loginIp',
  ]

  for (const ip of testIPs) {
    for (const type of limiterTypes) {
      await resetRateLimit(ip, type)
    }
  }

  return NextResponse.json({ ok: true })
}

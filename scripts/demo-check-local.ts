/**
 * Local demo-readiness check.
 *
 * Verifies that the local stack is ready to demo:
 *   1. Supabase CLI is running (port 54321)
 *   2. provider@example.com exists in DB
 *   3. Demo bookings exist (count > 0)
 *   4. Demo customers exist (count > 0)
 *
 * Read-only — uses Prisma `findFirst` and `count` only. Never writes.
 *
 * Usage: npm run demo:check:local
 */

import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface CheckResult {
  status: CheckStatus
  detail?: string
  hint?: string
}

// ---------------------------------------------------------------------------
// Pure classifiers (testable)
// ---------------------------------------------------------------------------

export function classifySupabaseStatus(stdout: string | null): CheckResult {
  if (stdout === null) {
    return {
      status: 'fail',
      hint: 'Supabase CLI är inte uppe. Kör: npm run db:up',
    }
  }
  return { status: 'ok', detail: 'Supabase CLI uppe' }
}

export function classifyProviderLookup(
  user: { id: string; email: string | null } | null
): CheckResult {
  if (!user) {
    return {
      status: 'fail',
      hint: 'provider@example.com saknas. Kör: npm run db:seed',
    }
  }
  return { status: 'ok', detail: 'provider@example.com finns' }
}

export function classifyDemoBookings(count: number): CheckResult {
  if (count === 0) {
    return {
      status: 'fail',
      detail: '0 demo-bokningar',
      hint: 'Demo-bokningar saknas. Kör: npm run db:seed:demo:reset',
    }
  }
  return { status: 'ok', detail: `${count} demo-bokningar` }
}

export function classifyDemoCustomers(count: number): CheckResult {
  if (count === 0) {
    return {
      status: 'fail',
      detail: '0 demo-kunder',
      hint: 'Demo-kunder (@demo.equinet.se) saknas. Kör: npm run db:seed:demo',
    }
  }
  return { status: 'ok', detail: `${count} demo-kunder` }
}

// ---------------------------------------------------------------------------
// IO layer
// ---------------------------------------------------------------------------

function probeSupabaseStatus(): string | null {
  try {
    return execSync('supabase status', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    })
  } catch {
    return null
  }
}

function format(name: string, result: CheckResult): string {
  const icon =
    result.status === 'ok' ? '✓' : result.status === 'warn' ? '⚠' : '✗'
  const detail = result.detail ? ` — ${result.detail}` : ''
  const hint = result.hint ? `\n    hint: ${result.hint}` : ''
  return `${icon} ${name}${detail}${hint}`
}

async function main(): Promise<void> {
  console.log('[demo:check:local] Lokal demo-readiness-check\n')

  const results: Array<{ name: string; result: CheckResult }> = []

  // 1. Supabase status — fail-fast (resten kräver DB)
  const supabaseStdout = probeSupabaseStatus()
  const supabaseCheck = classifySupabaseStatus(supabaseStdout)
  results.push({ name: 'Supabase CLI', result: supabaseCheck })
  console.log(format('Supabase CLI', supabaseCheck))
  if (supabaseCheck.status === 'fail') {
    process.exit(1)
  }

  // 2-4: Read-only DB queries
  const prisma = new PrismaClient()
  try {
    const provider = await prisma.user.findUnique({
      where: { email: 'provider@example.com' },
      select: { id: true, email: true },
    })
    const providerCheck = classifyProviderLookup(provider)
    results.push({ name: 'provider@example.com', result: providerCheck })
    console.log(format('provider@example.com', providerCheck))
    if (providerCheck.status === 'fail') {
      process.exit(1)
    }

    const demoCustomerCount = await prisma.user.count({
      where: { email: { endsWith: '@demo.equinet.se' }, userType: 'customer' },
    })
    const customerCheck = classifyDemoCustomers(demoCustomerCount)
    results.push({ name: 'Demo-kunder', result: customerCheck })
    console.log(format('Demo-kunder', customerCheck))

    const demoCustomers = await prisma.user.findMany({
      where: { email: { endsWith: '@demo.equinet.se' } },
      select: { id: true },
    })
    const demoCustomerIds = demoCustomers.map(c => c.id)
    const bookingCount =
      demoCustomerIds.length > 0
        ? await prisma.booking.count({
            where: { customerId: { in: demoCustomerIds } },
          })
        : 0
    const bookingCheck = classifyDemoBookings(bookingCount)
    results.push({ name: 'Demo-bokningar', result: bookingCheck })
    console.log(format('Demo-bokningar', bookingCheck))
  } finally {
    await prisma.$disconnect()
  }

  // Summary
  const fails = results.filter(r => r.result.status === 'fail').length
  const warns = results.filter(r => r.result.status === 'warn').length
  const oks = results.filter(r => r.result.status === 'ok').length
  console.log(`\nSummary: ${oks} ok, ${warns} warn, ${fails} fail`)
  if (fails > 0) {
    process.exit(1)
  }
}

const isDirectInvocation =
  typeof require !== 'undefined' && require.main === module
if (isDirectInvocation || process.argv[1]?.endsWith('demo-check-local.ts')) {
  main().catch(err => {
    console.error('[demo:check:local] Unexpected error:', err)
    process.exit(1)
  })
}

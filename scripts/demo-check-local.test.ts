import { describe, it, expect } from 'vitest'
import {
  classifySupabaseStatus,
  classifyProviderLookup,
  classifyDemoBookings,
  classifyDemoCustomers,
  type CheckResult,
} from './demo-check-local'

describe('classifySupabaseStatus', () => {
  it('OK when stdout indicates Supabase is running', () => {
    const result = classifySupabaseStatus(
      'API URL: http://127.0.0.1:54321\nDB URL: postgresql://...'
    )
    expect(result.status).toBe('ok')
  })

  it('FAIL when CLI throws (Supabase down)', () => {
    const result = classifySupabaseStatus(null)
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/db:up/)
  })
})

describe('classifyProviderLookup', () => {
  it('OK when provider exists', () => {
    const result = classifyProviderLookup({ id: 'abc', email: 'provider@example.com' })
    expect(result.status).toBe('ok')
  })

  it('FAIL when provider missing', () => {
    const result = classifyProviderLookup(null)
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/db:seed/)
  })
})

describe('classifyDemoBookings', () => {
  it('OK when count > 0', () => {
    const result = classifyDemoBookings(7)
    expect(result.status).toBe('ok')
    expect(result.detail).toBe('7 demo-bokningar')
  })

  it('FAIL when count === 0', () => {
    const result = classifyDemoBookings(0)
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/db:seed:demo:reset/)
  })
})

describe('classifyDemoCustomers', () => {
  it('OK when count > 0', () => {
    const result = classifyDemoCustomers(4)
    expect(result.status).toBe('ok')
    expect(result.detail).toBe('4 demo-kunder')
  })

  it('FAIL when count === 0', () => {
    const result = classifyDemoCustomers(0)
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/db:seed:demo/)
  })
})

describe('CheckResult shape', () => {
  it('all classifiers return ok|warn|fail status', () => {
    const samples: CheckResult[] = [
      classifySupabaseStatus('API URL: http://x'),
      classifyProviderLookup({ id: 'a', email: 'b' }),
      classifyDemoBookings(1),
      classifyDemoCustomers(1),
    ]
    for (const s of samples) {
      expect(['ok', 'warn', 'fail']).toContain(s.status)
    }
  })
})

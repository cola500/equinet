import { describe, it, expect } from 'vitest'
import {
  classify,
  boolStatus,
  providerStatus,
  parseEnvFile,
  buildReport,
} from './audit-prod-env-safe.mjs'

describe('classify', () => {
  it('returns MISSING when the key is absent (undefined)', () => {
    expect(classify(undefined)).toBe('MISSING')
  })
  it('returns EMPTY for an empty string', () => {
    expect(classify('')).toBe('EMPTY')
  })
  it('returns WHITESPACE_ONLY for whitespace-only values', () => {
    expect(classify('   ')).toBe('WHITESPACE_ONLY')
    expect(classify('\t')).toBe('WHITESPACE_ONLY')
  })
  it('returns SET for a real value', () => {
    expect(classify('postgresql://x')).toBe('SET')
  })
})

describe('boolStatus (non-secret booleans)', () => {
  it('UNSET when absent or empty', () => {
    expect(boolStatus(undefined)).toBe('UNSET')
    expect(boolStatus('')).toBe('UNSET')
  })
  it('TRUE / FALSE case-insensitive', () => {
    expect(boolStatus('true')).toBe('TRUE')
    expect(boolStatus('TRUE')).toBe('TRUE')
    expect(boolStatus('false')).toBe('FALSE')
  })
  it('OTHER for unexpected values (never echoes the raw value)', () => {
    expect(boolStatus('1')).toBe('OTHER')
    expect(boolStatus('yes')).toBe('OTHER')
  })
})

describe('providerStatus (PAYMENT_PROVIDER, non-secret enum)', () => {
  it('UNSET when absent', () => {
    expect(providerStatus(undefined)).toBe('UNSET')
  })
  it('shows known providers mock/stripe', () => {
    expect(providerStatus('mock')).toBe('mock')
    expect(providerStatus('stripe')).toBe('stripe')
  })
  it('OTHER for unknown values (never echoes raw)', () => {
    expect(providerStatus('weird-value')).toBe('OTHER')
  })
})

describe('parseEnvFile', () => {
  it('parses KEY=value lines, stripping quotes, ignoring comments/blanks', () => {
    const content = [
      '# comment',
      '',
      'APP_URL="https://x"',
      "FROM_EMAIL='a@b.se'",
      'EMPTY_VAR=',
      'PLAIN=mock',
    ].join('\n')
    const map = parseEnvFile(content)
    expect(map.get('APP_URL')).toBe('https://x')
    expect(map.get('FROM_EMAIL')).toBe('a@b.se')
    expect(map.get('EMPTY_VAR')).toBe('')
    expect(map.get('PLAIN')).toBe('mock')
    expect(map.has('# comment')).toBe(false)
  })
})

describe('buildReport', () => {
  it('never prints secret values — only status tokens', () => {
    // Sentinel values stand in for real secrets; the assertion proves they are never echoed.
    const map = new Map<string, string>([
      ['DATABASE_URL', 'SENTINEL_DB_VALUE_MUST_NOT_LEAK'],
      ['SUPABASE_SERVICE_ROLE_KEY', 'SENTINEL_KEY_VALUE_MUST_NOT_LEAK'],
      ['PAYMENT_PROVIDER', 'mock'],
    ])
    const report = buildReport(map)
    expect(report).not.toContain('SENTINEL_DB_VALUE_MUST_NOT_LEAK')
    expect(report).not.toContain('SENTINEL_KEY_VALUE_MUST_NOT_LEAK')
    expect(report).toContain('DATABASE_URL')
    expect(report).toContain('SET')
  })

  it('skips Stripe vars when PAYMENT_PROVIDER != stripe', () => {
    const report = buildReport(new Map([['PAYMENT_PROVIDER', 'mock']]))
    expect(report).toMatch(/PAYMENT_PROVIDER != stripe|hoppas över/i)
    expect(report).not.toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('includes Stripe vars when PAYMENT_PROVIDER=stripe', () => {
    const report = buildReport(new Map([['PAYMENT_PROVIDER', 'stripe']]))
    expect(report).toContain('STRIPE_SECRET_KEY')
    expect(report).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    expect(report).toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('reports NEXT_PUBLIC_DEMO_MODE status', () => {
    const report = buildReport(new Map([['NEXT_PUBLIC_DEMO_MODE', 'true']]))
    expect(report).toContain('NEXT_PUBLIC_DEMO_MODE')
    expect(report).toContain('TRUE')
  })
})

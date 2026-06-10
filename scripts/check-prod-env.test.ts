import { describe, it, expect } from 'vitest'
import { checkProdEnv, checkCronsEnabled, REQUIRED_PROD_VARS } from './check-prod-env'

const allVarsPresent = Object.fromEntries(REQUIRED_PROD_VARS.map(v => [v, 'value']))

describe('checkProdEnv', () => {
  it('returns no missing vars when all required vars are set', () => {
    const { missing } = checkProdEnv(allVarsPresent)
    expect(missing).toHaveLength(0)
  })

  it('returns missing vars when some are absent', () => {
    const env = { ...allVarsPresent }
    delete env['APP_URL']
    delete env['RESEND_API_KEY']

    const { missing } = checkProdEnv(env)

    expect(missing).toContain('APP_URL')
    expect(missing).toContain('RESEND_API_KEY')
    expect(missing).toHaveLength(2)
  })

  it('returns missing vars when value is empty string', () => {
    const env = { ...allVarsPresent, APP_URL: '' }

    const { missing } = checkProdEnv(env)

    expect(missing).toContain('APP_URL')
  })

  it('returns missing vars when value is whitespace-only', () => {
    const env = { ...allVarsPresent, APP_URL: '   ' }

    const { missing } = checkProdEnv(env)

    expect(missing).toContain('APP_URL')
  })

  it('passes when all required vars have non-empty values', () => {
    const { missing } = checkProdEnv(allVarsPresent)
    expect(missing).toHaveLength(0)
  })

  it('exports the full list of required vars', () => {
    expect(REQUIRED_PROD_VARS).toBeDefined()
  })
})

describe('checkProdEnv — STRIPE_WEBHOOK_SECRET (conditional on active Stripe)', () => {
  // Stripe vars are only required when Stripe is the active payment provider.
  // This keeps the Production Parity deploy (Stripe off) from being blocked by an
  // unused webhook secret, while enforcing it once Stripe Live is enabled (Post-Parity).
  it('does NOT require STRIPE_WEBHOOK_SECRET when PAYMENT_PROVIDER is unset', () => {
    const { missing } = checkProdEnv(allVarsPresent)
    expect(missing).not.toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('does NOT require STRIPE_WEBHOOK_SECRET when PAYMENT_PROVIDER=mock', () => {
    const { missing } = checkProdEnv({ ...allVarsPresent, PAYMENT_PROVIDER: 'mock' })
    expect(missing).not.toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('REQUIRES STRIPE_WEBHOOK_SECRET when PAYMENT_PROVIDER=stripe and it is absent', () => {
    const { missing } = checkProdEnv({ ...allVarsPresent, PAYMENT_PROVIDER: 'stripe' })
    expect(missing).toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('flags STRIPE_WEBHOOK_SECRET when PAYMENT_PROVIDER=stripe and value is whitespace-only', () => {
    const { missing } = checkProdEnv({
      ...allVarsPresent,
      PAYMENT_PROVIDER: 'stripe',
      STRIPE_WEBHOOK_SECRET: '   ',
    })
    expect(missing).toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('passes when PAYMENT_PROVIDER=stripe and STRIPE_WEBHOOK_SECRET is set', () => {
    const { missing } = checkProdEnv({
      ...allVarsPresent,
      PAYMENT_PROVIDER: 'stripe',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_x',
    })
    expect(missing).not.toContain('STRIPE_WEBHOOK_SECRET')
  })
})

describe('checkCronsEnabled', () => {
  it('returns ok when DISABLE_CRONS is unset', () => {
    const result = checkCronsEnabled({})
    expect(result.ok).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('returns ok when DISABLE_CRONS is empty', () => {
    const result = checkCronsEnabled({ DISABLE_CRONS: '' })
    expect(result.ok).toBe(true)
  })

  it('returns ok when DISABLE_CRONS is "false"', () => {
    const result = checkCronsEnabled({ DISABLE_CRONS: 'false' })
    expect(result.ok).toBe(true)
  })

  it('returns FAIL when DISABLE_CRONS is "true"', () => {
    const result = checkCronsEnabled({ DISABLE_CRONS: 'true' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/DISABLE_CRONS=true/)
    expect(result.reason).toMatch(/skipped/)
  })

  it('treats non-"true" string as enabled (truthy strings other than "true" do not skip)', () => {
    const result = checkCronsEnabled({ DISABLE_CRONS: '1' })
    expect(result.ok).toBe(true)
  })

  it('FAILs in real prod (no STAGING_PROJECT) when DISABLE_CRONS=true', () => {
    const result = checkCronsEnabled({ DISABLE_CRONS: 'true' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/DISABLE_CRONS=true/)
  })

  it('PASSes in staging-project (STAGING_PROJECT=true) with DISABLE_CRONS=true', () => {
    const result = checkCronsEnabled({
      STAGING_PROJECT: 'true',
      DISABLE_CRONS: 'true',
    })
    expect(result.ok).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('PASSes in staging-project even when DISABLE_CRONS unset', () => {
    const result = checkCronsEnabled({ STAGING_PROJECT: 'true' })
    expect(result.ok).toBe(true)
  })

  it('treats STAGING_PROJECT=other-value as not staging (still blocks DISABLE_CRONS=true)', () => {
    const result = checkCronsEnabled({
      STAGING_PROJECT: '1',
      DISABLE_CRONS: 'true',
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/DISABLE_CRONS=true/)
  })
})

describe('REQUIRED_PROD_VARS', () => {
  it('is the canonical list of required vars', () => {
    const expectedVars = [
      'APP_URL',
      'DATABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
      'FROM_EMAIL',
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ]
    for (const v of expectedVars) {
      expect(REQUIRED_PROD_VARS).toContain(v)
    }
  })
})

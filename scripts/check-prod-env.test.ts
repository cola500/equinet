import { describe, it, expect } from 'vitest'
import { checkProdEnv, REQUIRED_PROD_VARS } from './check-prod-env'

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

  it('passes when all required vars have non-empty values', () => {
    const { missing } = checkProdEnv(allVarsPresent)
    expect(missing).toHaveLength(0)
  })

  it('exports the full list of required vars', () => {
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

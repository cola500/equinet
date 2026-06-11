import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

// Tests the shared bash helpers by sourcing the lib and invoking functions.
// Fixture URLs use localhost hosts + fake passwords so they are not real secrets
// (the secret-scan exempts localhost). The logic under test (mask/normalise) is
// host-agnostic, so localhost exercises it exactly like a pooler host would.
const LIB = join(process.cwd(), 'scripts/lib/vercel-env-lib.sh')
const bash = (snippet: string): string =>
  execFileSync('bash', ['-c', `source "${LIB}"; ${snippet}`], { encoding: 'utf8' }).trim()

describe('venv_mask', () => {
  it('hides the password in a postgres URL', () => {
    const out = bash(`venv_mask 'postgresql://postgres.ref:HIDE_ME_PW@localhost:6543/postgres'`)
    expect(out).not.toContain('HIDE_ME_PW')
    expect(out).toContain(':***@')
    expect(out).toContain('localhost:6543')
  })
})

describe('venv_normalize_db_url', () => {
  it('fixes a &-suffix to ?pgbouncer=true&connection_limit=1', () => {
    const out = bash(`venv_normalize_db_url 'postgresql://postgres.ref:pw@localhost:6543/postgres&connection_limit=1'`)
    expect(out).toBe('postgresql://postgres.ref:pw@localhost:6543/postgres?pgbouncer=true&connection_limit=1')
  })
  it('does not clip the postgres.<ref> username (uses the last /postgres)', () => {
    // postgres.abc123 username must survive (not clipped at //postgres); localhost host is secret-scan-exempt.
    const out = bash(`venv_normalize_db_url 'postgresql://postgres.abc123:pw@localhost:6543/postgres'`)
    expect(out).toBe('postgresql://postgres.abc123:pw@localhost:6543/postgres?pgbouncer=true&connection_limit=1')
  })
  it('is idempotent on an already-correct URL', () => {
    const correct = 'postgresql://postgres.ref:pw@localhost:6543/postgres?pgbouncer=true&connection_limit=1'
    expect(bash(`venv_normalize_db_url '${correct}'`)).toBe(correct)
  })
})

describe('venv_project_name', () => {
  it('maps prod/production/staging and rejects others', () => {
    expect(bash('venv_project_name prod')).toBe('equinet-app')
    expect(bash('venv_project_name production')).toBe('equinet-app')
    expect(bash('venv_project_name staging')).toBe('equinet-staging-app')
    expect(() => bash('venv_project_name dev')).toThrow()
  })
})

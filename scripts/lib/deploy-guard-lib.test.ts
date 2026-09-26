import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Tests the shared guard helpers used by sync-vercel-token.sh and
// deploy-production.sh. No real token, gh, or vercel session is ever used --
// external commands are stubbed via a throwaway PATH entry, and auth.json is
// a fixture pointed to via DEPLOY_GUARD_AUTH_JSON (never the real file).
const LIB = join(process.cwd(), 'scripts/lib/deploy-guard-lib.sh')

const cleanupDirs: string[] = []
afterEach(() => {
  while (cleanupDirs.length) rmSync(cleanupDirs.pop()!, { recursive: true, force: true })
})

function makeBinDir(scripts: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'dgl-bin-'))
  cleanupDirs.push(dir)
  for (const [name, body] of Object.entries(scripts)) {
    const p = join(dir, name)
    writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(p, 0o755)
  }
  return dir
}

function run(snippet: string, opts: { bin?: string; cwd?: string; env?: Record<string, string> } = {}): { out: string; code: number } {
  const env = { ...process.env, ...(opts.env ?? {}) }
  if (opts.bin) env.PATH = `${opts.bin}:${env.PATH}`
  try {
    const out = execFileSync('bash', ['-c', `source "${LIB}"; ${snippet}`], {
      encoding: 'utf8',
      cwd: opts.cwd,
      env,
    })
    return { out, code: 0 }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return { out: (err.stdout ?? '') + (err.stderr ?? ''), code: err.status ?? 1 }
  }
}

describe('dgl_require_auth_json / dgl_read_vercel_token', () => {
  it('fails when auth.json does not exist', () => {
    const { code, out } = run('dgl_require_auth_json', {
      env: { DEPLOY_GUARD_AUTH_JSON: '/nonexistent/auth.json' },
    })
    expect(code).not.toBe(0)
    expect(out).toContain('saknas')
  })

  it('reads the token field from a fixture auth.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dgl-auth-'))
    cleanupDirs.push(dir)
    const authPath = join(dir, 'auth.json')
    writeFileSync(authPath, JSON.stringify({ token: 'fixture-not-a-real-token-123' }))
    const { code, out } = run('dgl_read_vercel_token', { env: { DEPLOY_GUARD_AUTH_JSON: authPath } })
    expect(code).toBe(0)
    expect(out.trim()).toBe('fixture-not-a-real-token-123')
  })

  it('fails when the token field is empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dgl-auth-'))
    cleanupDirs.push(dir)
    const authPath = join(dir, 'auth.json')
    writeFileSync(authPath, JSON.stringify({ token: '' }))
    const { code, out } = run('dgl_read_vercel_token', { env: { DEPLOY_GUARD_AUTH_JSON: authPath } })
    expect(code).not.toBe(0)
    expect(out).toContain('Kunde inte läsa')
  })
})

describe('dgl_require_vercel_whoami', () => {
  it('succeeds and prints the username when whoami succeeds', () => {
    const bin = makeBinDir({ vercel: 'echo "cola500"' })
    const { code, out } = run('dgl_require_vercel_whoami', { bin })
    expect(code).toBe(0)
    expect(out).toContain('cola500')
  })

  it('fails when vercel whoami exits non-zero', () => {
    const bin = makeBinDir({ vercel: 'echo "not logged in" >&2; exit 1' })
    const { code, out } = run('dgl_require_vercel_whoami', { bin })
    expect(code).not.toBe(0)
    expect(out).toContain('misslyckades')
  })
})

describe('dgl_require_gh_auth', () => {
  it('succeeds when gh auth status exits 0', () => {
    const bin = makeBinDir({ gh: 'exit 0' })
    expect(run('dgl_require_gh_auth', { bin }).code).toBe(0)
  })

  it('fails when gh auth status exits non-zero', () => {
    const bin = makeBinDir({ gh: 'exit 1' })
    const { code, out } = run('dgl_require_gh_auth', { bin })
    expect(code).not.toBe(0)
    expect(out).toContain('gh auth login')
  })
})

describe('dgl_require_repo', () => {
  it('succeeds when gh repo view matches the expected repo', () => {
    const bin = makeBinDir({ gh: 'echo "cola500/equinet"' })
    expect(run('dgl_require_repo "cola500/equinet"', { bin }).code).toBe(0)
  })

  it('fails when gh repo view returns a different repo', () => {
    const bin = makeBinDir({ gh: 'echo "someone-else/fork"' })
    const { code, out } = run('dgl_require_repo "cola500/equinet"', { bin })
    expect(code).not.toBe(0)
    expect(out).toContain('Fel repo')
  })
})

describe('dgl_require_clean_tree / dgl_require_branch', () => {
  function makeRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'dgl-repo-'))
    cleanupDirs.push(dir)
    execFileSync('git', ['init', '-q', '-b', 'main', dir])
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'])
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'])
    writeFileSync(join(dir, 'f.txt'), 'x')
    execFileSync('git', ['-C', dir, 'add', '.'])
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'init'])
    return dir
  }

  it('clean tree passes, dirty tree fails', () => {
    const dir = makeRepo()
    expect(run('dgl_require_clean_tree', { cwd: dir }).code).toBe(0)
    writeFileSync(join(dir, 'f.txt'), 'changed')
    const { code, out } = run('dgl_require_clean_tree', { cwd: dir })
    expect(code).not.toBe(0)
    expect(out).toContain('Okommitterade')
  })

  it('an untracked file lying around does NOT count as dirty (it cannot be part of any deployed SHA)', () => {
    const dir = makeRepo()
    writeFileSync(join(dir, 'scratch-notes.md'), 'not part of any commit')
    expect(run('dgl_require_clean_tree', { cwd: dir }).code).toBe(0)
  })

  it('branch check passes on main, fails on other branches', () => {
    const dir = makeRepo()
    expect(run('dgl_require_branch main', { cwd: dir }).code).toBe(0)
    execFileSync('git', ['-C', dir, 'checkout', '-q', '-b', 'other'])
    const { code, out } = run('dgl_require_branch main', { cwd: dir })
    expect(code).not.toBe(0)
    expect(out).toContain('Fel branch')
  })
})

describe('dgl_require_sha_match', () => {
  it('passes when SHAs match', () => {
    expect(run('dgl_require_sha_match abc123 abc123').code).toBe(0)
  })

  it('fails when SHAs differ', () => {
    const { code, out } = run('dgl_require_sha_match abc123 def456')
    expect(code).not.toBe(0)
    expect(out).toContain('matchar inte')
  })

  it('fails when either SHA is empty', () => {
    expect(run('dgl_require_sha_match "" abc123').code).not.toBe(0)
    expect(run('dgl_require_sha_match abc123 ""').code).not.toBe(0)
  })
})

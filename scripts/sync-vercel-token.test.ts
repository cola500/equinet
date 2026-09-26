import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Exercises scripts/sync-vercel-token.sh end to end with every external
// command (vercel, gh) stubbed and a fixture auth.json -- never a real
// token, never a real gh/vercel session. The only path that can ever reach
// "gh secret set" is --dry-run's absence AND every guard passing; the "gh"
// stub records a marker file if "secret set" is invoked so tests can assert
// it was (or, for --dry-run, was NOT) called.
const SCRIPT = join(process.cwd(), 'scripts/sync-vercel-token.sh')

const cleanupDirs: string[] = []
afterEach(() => {
  while (cleanupDirs.length) rmSync(cleanupDirs.pop()!, { recursive: true, force: true })
})

function makeFixtureAuth(token = 'fixture-not-a-real-token-123'): string {
  const dir = mkdtempSync(join(tmpdir(), 'sync-auth-'))
  cleanupDirs.push(dir)
  const p = join(dir, 'auth.json')
  writeFileSync(p, JSON.stringify({ token }))
  return p
}

function makeBinDir(opts: {
  whoamiOk?: boolean
  ghAuthOk?: boolean
  repo?: string
  secretSetOk?: boolean
} = {}): { bin: string; secretSetMarker: string; secretSetInputFile: string } {
  const { whoamiOk = true, ghAuthOk = true, repo = 'cola500/equinet', secretSetOk = true } = opts
  const dir = mkdtempSync(join(tmpdir(), 'sync-bin-'))
  cleanupDirs.push(dir)
  const secretSetMarker = join(dir, 'secret-set-called')
  const secretSetInputFile = join(dir, 'secret-set-input')

  writeFileSync(
    join(dir, 'vercel'),
    `#!/usr/bin/env bash\nif [ "$1" = "whoami" ]; then ${whoamiOk ? 'echo cola500; exit 0' : 'echo "not logged in" >&2; exit 1'}; fi\n`
  )
  writeFileSync(
    join(dir, 'gh'),
    `#!/usr/bin/env bash
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  ${ghAuthOk ? 'exit 0' : 'exit 1'}
fi
if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  echo "${repo}"
  exit 0
fi
if [ "$1" = "secret" ] && [ "$2" = "set" ]; then
  touch "${secretSetMarker}"
  cat > "${secretSetInputFile}"
  ${secretSetOk ? 'exit 0' : 'exit 1'}
fi
if [ "$1" = "secret" ] && [ "$2" = "list" ]; then
  echo "VERCEL_TOKEN\t2026-09-26T00:00:00Z"
  exit 0
fi
exit 1
`
  )
  for (const f of ['vercel', 'gh']) chmodSync(join(dir, f), 0o755)
  return { bin: dir, secretSetMarker, secretSetInputFile }
}

function run(args: string[], bin: string, authJson: string): { out: string; code: number } {
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, DEPLOY_GUARD_AUTH_JSON: authJson }
  try {
    const out = execFileSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env })
    return { out, code: 0 }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return { out: (err.stdout ?? '') + (err.stderr ?? ''), code: err.status ?? 1 }
  }
}

describe('sync-vercel-token.sh', () => {
  it('rejects an unknown flag', () => {
    const { bin } = makeBinDir()
    const { code, out } = run(['--bogus'], bin, makeFixtureAuth())
    expect(code).not.toBe(0)
    expect(out).toContain('Okänd flagga')
  })

  it('fails before touching gh when auth.json is missing', () => {
    const { bin, secretSetMarker } = makeBinDir()
    const { code, out } = run(['--dry-run'], bin, '/nonexistent/auth.json')
    expect(code).not.toBe(0)
    expect(out).toContain('saknas')
    expect(existsSync(secretSetMarker)).toBe(false)
  })

  it('fails when vercel whoami fails', () => {
    const { bin, secretSetMarker } = makeBinDir({ whoamiOk: false })
    const { code } = run(['--dry-run'], bin, makeFixtureAuth())
    expect(code).not.toBe(0)
    expect(existsSync(secretSetMarker)).toBe(false)
  })

  it('fails when gh auth status fails', () => {
    const { bin, secretSetMarker } = makeBinDir({ ghAuthOk: false })
    const { code } = run(['--dry-run'], bin, makeFixtureAuth())
    expect(code).not.toBe(0)
    expect(existsSync(secretSetMarker)).toBe(false)
  })

  it('fails when the repo does not match cola500/equinet', () => {
    const { bin, secretSetMarker } = makeBinDir({ repo: 'someone-else/fork' })
    const { code, out } = run(['--dry-run'], bin, makeFixtureAuth())
    expect(code).not.toBe(0)
    expect(out).toContain('Fel repo')
    expect(existsSync(secretSetMarker)).toBe(false)
  })

  it('--dry-run passes every guard but never calls gh secret set, and never prints the token', () => {
    const { bin, secretSetMarker } = makeBinDir()
    const { code, out } = run(['--dry-run'], bin, makeFixtureAuth('super-secret-fixture-value'))
    expect(code).toBe(0)
    expect(out).toContain('DRY-RUN')
    expect(out).not.toContain('super-secret-fixture-value')
    expect(existsSync(secretSetMarker)).toBe(false)
  })

  it('without --dry-run, calls gh secret set via stdin with the token and confirms via secret list', () => {
    const { bin, secretSetMarker, secretSetInputFile } = makeBinDir()
    const { code, out } = run([], bin, makeFixtureAuth('super-secret-fixture-value'))
    expect(code).toBe(0)
    expect(existsSync(secretSetMarker)).toBe(true)
    // The token must have reached gh only via stdin, and the script's own
    // stdout must never contain it.
    expect(readFileSync(secretSetInputFile, 'utf8')).toBe('super-secret-fixture-value')
    expect(out).not.toContain('super-secret-fixture-value')
    expect(out).toContain('uppdaterad')
  })

  it('reports failure when gh secret set itself fails', () => {
    const { bin } = makeBinDir({ secretSetOk: false })
    const { code, out } = run([], bin, makeFixtureAuth())
    expect(code).not.toBe(0)
    expect(out).toContain('misslyckades')
  })
})

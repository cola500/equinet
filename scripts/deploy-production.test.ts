import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Exercises scripts/deploy-production.sh end to end with git, gh and curl
// all stubbed -- never a real repo, GitHub run, or network call. "git" is a
// real temp repo (so status/branch/rev-parse behave exactly like production)
// except "fetch", which is stubbed to a no-op since there is no real origin.
const SCRIPT = join(process.cwd(), 'scripts/deploy-production.sh')

const cleanupDirs: string[] = []
afterEach(() => {
  while (cleanupDirs.length) rmSync(cleanupDirs.pop()!, { recursive: true, force: true })
})

function makeRepo(): { dir: string; sha: string } {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-repo-'))
  cleanupDirs.push(dir)
  execFileSync('git', ['init', '-q', '-b', 'main', dir])
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'])
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'])
  writeFileSync(join(dir, 'f.txt'), 'x')
  execFileSync('git', ['-C', dir, 'add', '.'])
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'init commit'])
  const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  // Fake a remote "origin/main" ref pointing at the same commit, without a
  // real remote -- deploy-production.sh's own `git fetch origin main` is
  // stubbed to a no-op below, so this ref just needs to already resolve.
  execFileSync('git', ['-C', dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD'])
  return { dir, sha }
}

function makeBinDir(opts: {
  sha: string
  repo?: string
  runExists?: boolean
  runStatus?: 'completed' | 'in_progress'
  deployJobConclusion?: 'success' | 'failure' | 'missing'
  rerunOk?: boolean
  watchOk?: boolean
}): { bin: string; rerunMarker: string; watchMarker: string } {
  const {
    sha,
    repo = 'cola500/equinet',
    runExists = true,
    runStatus = 'completed',
    deployJobConclusion = 'failure',
    rerunOk = true,
    watchOk = true,
  } = opts
  const dir = mkdtempSync(join(tmpdir(), 'deploy-bin-'))
  cleanupDirs.push(dir)
  const rerunMarker = join(dir, 'rerun-called')
  const watchMarker = join(dir, 'watch-called')

  const runListJson = runExists
    ? JSON.stringify([{ databaseId: 999, headSha: sha, status: runStatus, conclusion: null, url: 'https://x', createdAt: '2026-01-01' }])
    : '[]'
  const jobsJson = JSON.stringify({
    jobs: deployJobConclusion === 'missing' ? [] : [{ name: 'Deploy to Production', conclusion: deployJobConclusion }],
  })

  writeFileSync(
    join(dir, 'gh'),
    `#!/usr/bin/env bash
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then exit 0; fi
if [ "$1" = "repo" ] && [ "$2" = "view" ]; then echo "${repo}"; exit 0; fi
if [ "$1" = "run" ] && [ "$2" = "list" ]; then echo '${runListJson}'; exit 0; fi
if [ "$1" = "run" ] && [ "$2" = "view" ]; then echo '${jobsJson}'; exit 0; fi
if [ "$1" = "run" ] && [ "$2" = "rerun" ]; then touch "${rerunMarker}"; ${rerunOk ? 'exit 0' : 'exit 1'}; fi
if [ "$1" = "run" ] && [ "$2" = "watch" ]; then touch "${watchMarker}"; ${watchOk ? 'exit 0' : 'exit 1'}; fi
exit 1
`
  )
  writeFileSync(join(dir, 'curl'), `#!/usr/bin/env bash\necho '{"status":"ok"}'\n`)
  for (const f of ['gh', 'curl']) chmodSync(join(dir, f), 0o755)
  return { bin: dir, rerunMarker, watchMarker }
}

function run(
  args: string[],
  bin: string,
  cwd: string,
  input?: string
): { out: string; code: number } {
  const env = { ...process.env, PATH: `${bin}:/usr/bin:/bin:${process.env.PATH}` }
  try {
    const out = execFileSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env, cwd, input: input ?? '' })
    return { out, code: 0 }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return { out: (err.stdout ?? '') + (err.stderr ?? ''), code: err.status ?? 1 }
  }
}

// deploy-production.sh calls a real `git fetch origin main`. There is no
// real origin in the throwaway repo, so shadow `git` with a wrapper that
// no-ops fetch and delegates everything else to the real git binary --
// keeps status/branch/rev-parse fully real while never touching a network.
function withFetchStub(bin: string): void {
  const wrapper = join(bin, 'git')
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim()
  writeFileSync(
    wrapper,
    `#!/usr/bin/env bash
if [ "$1" = "fetch" ]; then exit 0; fi
exec "${realGit}" "$@"
`
  )
  chmodSync(wrapper, 0o755)
}

describe('deploy-production.sh', () => {
  it('rejects an unknown flag', () => {
    const { dir, sha } = makeRepo()
    const { bin } = makeBinDir({ sha })
    const { code, out } = run(['--bogus'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Okänd flagga')
  })

  it('fails on a dirty working tree', () => {
    const { dir, sha } = makeRepo()
    writeFileSync(join(dir, 'f.txt'), 'changed')
    const { bin } = makeBinDir({ sha })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Okommitterade')
  })

  it('fails on a non-main branch', () => {
    const { dir, sha } = makeRepo()
    execFileSync('git', ['-C', dir, 'checkout', '-q', '-b', 'feature/x'])
    const { bin } = makeBinDir({ sha })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Fel branch')
  })

  it('fails when local main diverges from origin/main', () => {
    const { dir, sha } = makeRepo()
    writeFileSync(join(dir, 'g.txt'), 'y')
    execFileSync('git', ['-C', dir, 'add', '.'])
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'diverge locally'])
    const { bin } = makeBinDir({ sha })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('matchar inte')
  })

  it('fails when the repo does not match cola500/equinet', () => {
    const { dir, sha } = makeRepo()
    const { bin } = makeBinDir({ sha, repo: 'someone-else/fork' })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Fel repo')
  })

  it('fails when no workflow run exists yet for this SHA', () => {
    const { dir, sha } = makeRepo()
    const { bin } = makeBinDir({ sha, runExists: false })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Ingen quality-gates-körning')
  })

  it('fails when the run for this SHA is still in progress', () => {
    const { dir, sha } = makeRepo()
    const { bin } = makeBinDir({ sha, runStatus: 'in_progress' })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('inte klar')
  })

  it('reports already-deployed and exits 0 without rerunning, when the job already succeeded', () => {
    const { dir, sha } = makeRepo()
    const { bin, rerunMarker } = makeBinDir({ sha, deployJobConclusion: 'success' })
    withFetchStub(bin)
    const { code, out } = run([], bin, dir)
    expect(code).toBe(0)
    expect(out).toContain('redan deployad')
    expect(existsSync(rerunMarker)).toBe(false)
  })

  it('--dry-run shows the plan but never calls rerun/watch and never prompts', () => {
    const { dir, sha } = makeRepo()
    const { bin, rerunMarker, watchMarker } = makeBinDir({ sha })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).toBe(0)
    expect(out).toContain('DRY-RUN')
    expect(existsSync(rerunMarker)).toBe(false)
    expect(existsSync(watchMarker)).toBe(false)
  })

  it('aborts without triggering anything when the confirmation phrase does not match', () => {
    const { dir, sha } = makeRepo()
    const { bin, rerunMarker } = makeBinDir({ sha })
    withFetchStub(bin)
    const { code, out } = run([], bin, dir, 'nope\n')
    expect(code).not.toBe(0)
    expect(out).toContain('matchade inte')
    expect(existsSync(rerunMarker)).toBe(false)
  })

  it('with the correct confirmation, triggers rerun and watch and reports success', () => {
    const { dir, sha } = makeRepo()
    const { bin, rerunMarker, watchMarker } = makeBinDir({ sha })
    withFetchStub(bin)
    const short = sha.slice(0, 7)
    const { code, out } = run([], bin, dir, `DEPLOY ${short}\n`)
    expect(code).toBe(0)
    expect(existsSync(rerunMarker)).toBe(true)
    expect(existsSync(watchMarker)).toBe(true)
    expect(out).toContain('klar')
  })
})

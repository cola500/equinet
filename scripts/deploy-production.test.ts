import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Exercises scripts/deploy-production.sh end to end with git, gh, node and
// date all real except "git fetch" and gh's network-touching subcommands,
// which are stubbed -- never a real repo, GitHub Actions run, or network
// call. "git" is a real temp repo (so status/branch/rev-parse behave
// exactly like production) except "fetch", stubbed to a no-op since there
// is no real origin.
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
  repo?: string
  dispatchOk?: boolean
  runListable?: boolean
  watchOk?: boolean
}): { bin: string; dispatchMarker: string; watchMarker: string; dispatchArgsFile: string } {
  const { repo = 'cola500/equinet', dispatchOk = true, runListable = true, watchOk = true } = opts
  const dir = mkdtempSync(join(tmpdir(), 'deploy-bin-'))
  cleanupDirs.push(dir)
  const dispatchMarker = join(dir, 'dispatch-called')
  const dispatchArgsFile = join(dir, 'dispatch-args')
  const watchMarker = join(dir, 'watch-called')

  const runListJson = runListable
    ? JSON.stringify([{ databaseId: 42, createdAt: '2099-01-01T00:00:00Z' }])
    : '[]'

  writeFileSync(
    join(dir, 'gh'),
    `#!/usr/bin/env bash
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then exit 0; fi
if [ "$1" = "repo" ] && [ "$2" = "view" ]; then echo "${repo}"; exit 0; fi
if [ "$1" = "workflow" ] && [ "$2" = "run" ]; then
  echo "$@" > "${dispatchArgsFile}"
  touch "${dispatchMarker}"
  ${dispatchOk ? 'exit 0' : 'exit 1'}
fi
if [ "$1" = "run" ] && [ "$2" = "list" ]; then echo '${runListJson}'; exit 0; fi
if [ "$1" = "run" ] && [ "$2" = "watch" ]; then touch "${watchMarker}"; ${watchOk ? 'exit 0' : 'exit 1'}; fi
exit 1
`
  )
  chmodSync(join(dir, 'gh'), 0o755)
  return { bin: dir, dispatchMarker, watchMarker, dispatchArgsFile }
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
    const { dir } = makeRepo()
    const { bin } = makeBinDir({})
    const { code, out } = run(['--bogus'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Okänd flagga')
  })

  it('fails on a dirty working tree', () => {
    const { dir } = makeRepo()
    writeFileSync(join(dir, 'f.txt'), 'changed')
    const { bin } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Okommitterade')
  })

  it('fails on a non-main branch', () => {
    const { dir } = makeRepo()
    execFileSync('git', ['-C', dir, 'checkout', '-q', '-b', 'feature/x'])
    const { bin } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Fel branch')
  })

  it('fails when local main diverges from origin/main', () => {
    const { dir } = makeRepo()
    writeFileSync(join(dir, 'g.txt'), 'y')
    execFileSync('git', ['-C', dir, 'add', '.'])
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'diverge locally'])
    const { bin } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('matchar inte')
  })

  it('fails when the repo does not match cola500/equinet', () => {
    const { dir } = makeRepo()
    const { bin } = makeBinDir({ repo: 'someone-else/fork' })
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('Fel repo')
  })

  it('fails when --staging-verified-sha is missing', () => {
    const { dir } = makeRepo()
    const { bin } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--dry-run'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('staging-verified-sha saknas')
  })

  it('fails when staging-verified-sha differs from main SHA and no override-reason is given', () => {
    const { dir } = makeRepo()
    const { bin } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--dry-run', '--staging-verified-sha', 'deadbeef'], bin, dir)
    expect(code).not.toBe(0)
    expect(out).toContain('matchar inte main-SHA')
  })

  it('--dry-run accepts a mismatched staging-verified-sha when override-reason is given, but never dispatches', () => {
    const { dir, sha } = makeRepo()
    const { bin, dispatchMarker } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(
      ['--dry-run', '--staging-verified-sha', 'deadbeef', '--override-reason', 'hotfix, staging body redeployed separately'],
      bin,
      dir
    )
    expect(code).toBe(0)
    expect(out).toContain('DRY-RUN')
    expect(out).toContain('Override-skäl')
    expect(existsSync(dispatchMarker)).toBe(false)
    void sha
  })

  it('--dry-run shows the plan but never dispatches and never prompts', () => {
    const { dir, sha } = makeRepo()
    const { bin, dispatchMarker, watchMarker } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--dry-run', '--staging-verified-sha', sha], bin, dir)
    expect(code).toBe(0)
    expect(out).toContain('DRY-RUN')
    expect(existsSync(dispatchMarker)).toBe(false)
    expect(existsSync(watchMarker)).toBe(false)
  })

  it('aborts without dispatching when the confirmation phrase does not match', () => {
    const { dir, sha } = makeRepo()
    const { bin, dispatchMarker } = makeBinDir({})
    withFetchStub(bin)
    const { code, out } = run(['--staging-verified-sha', sha], bin, dir, 'nope\n')
    expect(code).not.toBe(0)
    expect(out).toContain('matchade inte')
    expect(existsSync(dispatchMarker)).toBe(false)
  })

  it('with the correct confirmation, dispatches deploy-production.yml with dry_run=false and watches it', () => {
    const { dir, sha } = makeRepo()
    const { bin, dispatchMarker, watchMarker, dispatchArgsFile } = makeBinDir({})
    withFetchStub(bin)
    const short = sha.slice(0, 7)
    const { code, out } = run(['--staging-verified-sha', sha], bin, dir, `DEPLOY ${short}\n`)
    expect(code).toBe(0)
    expect(existsSync(dispatchMarker)).toBe(true)
    expect(existsSync(watchMarker)).toBe(true)
    expect(out).toContain('klar')
    const dispatchArgs = readFileSync(dispatchArgsFile, 'utf8')
    expect(dispatchArgs).toContain('deploy-production.yml')
    expect(dispatchArgs).toContain(`sha=${sha}`)
    expect(dispatchArgs).toContain(`staging_verified_sha=${sha}`)
    expect(dispatchArgs).toContain('dry_run=false')
  })

  it('with an override reason and mismatched staging SHA, dispatches including the reason', () => {
    const { dir, sha } = makeRepo()
    const { bin, dispatchArgsFile } = makeBinDir({})
    withFetchStub(bin)
    const short = sha.slice(0, 7)
    const { code } = run(
      ['--staging-verified-sha', 'deadbeef', '--override-reason', 'hotfix approved verbally'],
      bin,
      dir,
      `DEPLOY ${short}\n`
    )
    expect(code).toBe(0)
    const dispatchArgs = readFileSync(dispatchArgsFile, 'utf8')
    expect(dispatchArgs).toContain('staging_verified_sha=deadbeef')
    expect(dispatchArgs).toContain('override_reason=hotfix approved verbally')
  })

  it(
    'fails cleanly if the dispatched run cannot be found afterwards',
    () => {
      const { dir, sha } = makeRepo()
      const { bin } = makeBinDir({ runListable: false })
      withFetchStub(bin)
      const short = sha.slice(0, 7)
      const { code, out } = run(['--staging-verified-sha', sha], bin, dir, `DEPLOY ${short}\n`)
      expect(code).not.toBe(0)
      expect(out).toContain('Kunde inte hitta')
    },
    40000
  )

  it('fails when the dispatched run itself fails', () => {
    const { dir, sha } = makeRepo()
    const { bin } = makeBinDir({ watchOk: false })
    withFetchStub(bin)
    const short = sha.slice(0, 7)
    const { code, out } = run(['--staging-verified-sha', sha], bin, dir, `DEPLOY ${short}\n`)
    expect(code).not.toBe(0)
    expect(out).toContain('misslyckades')
  })
})

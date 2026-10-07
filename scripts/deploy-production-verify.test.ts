import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Verifies the post-deploy step "Verify deployment and health" in
// .github/workflows/deploy-production.yml. The step's `run:` block is extracted
// from the workflow file and executed with a stubbed `curl` and `sleep` (real
// bash and jq), so what is tested is exactly what runs in CI -- no network.
const WORKFLOW = join(process.cwd(), '.github/workflows/deploy-production.yml')
const STEP_NAME = 'Verify deployment and health'
const TOKEN = 'vcp_SECRET_TOKEN_VALUE'
const SHA = '6c33337fe308f45dde6f47f83120f290c86781e1'
const DEPLOY_URL = 'https://equinet-axhxaijfh-cola500s-projects.vercel.app'
const PROD_HEALTH_URL = 'https://equinet.johanlindengard.com/api/health'

const cleanup: string[] = []
afterEach(() => {
  while (cleanup.length) rmSync(cleanup.pop()!, { recursive: true, force: true })
})

function workflowText(): string {
  return readFileSync(WORKFLOW, 'utf8')
}

// Returns the `run: |` block of the named step, de-indented, or null.
function extractRunBlock(text: string, stepName: string): string | null {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`)
  if (start === -1) return null
  const stepIndent = lines[start].indexOf('-')
  let i = start + 1
  while (i < lines.length && !/^\s*run:\s*\|\s*$/.test(lines[i])) {
    // stop if we walked into the next step
    if (/^\s*- name:/.test(lines[i]) && lines[i].indexOf('-') <= stepIndent) return null
    i++
  }
  if (i >= lines.length) return null
  const runIndent = lines[i].search(/\S/)
  const body: string[] = []
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j]
    if (line.trim() !== '' && line.search(/\S/) <= runIndent) break
    body.push(line.slice(runIndent + 2))
  }
  return body.join('\n')
}

interface Scenario {
  api?: Record<string, unknown> | string // body returned for api.vercel.com
  apiSequence?: Array<Record<string, unknown>> // successive api bodies (e.g. BUILDING -> READY)
  health?: { code?: string; headers?: string; body?: string; curlRc?: number }
  env?: Record<string, string>
}

const goodApi = {
  readyState: 'READY',
  target: 'production',
  alias: ['equinet.johanlindengard.com', 'equinet-app.vercel.app'],
  meta: { githubCommitSha: SHA },
}

function run(s: Scenario = {}): { code: number; out: string; summary: string; urls: string[]; headers: string[]; apiCalls: number } {
  const dir = mkdtempSync(join(tmpdir(), 'verify-deploy-'))
  cleanup.push(dir)
  const bin = join(dir, 'bin')
  spawnSync('mkdir', ['-p', bin])

  // stub sleep (instant) and curl (routes by URL)
  writeFileSync(join(bin, 'sleep'), '#!/bin/bash\nexit 0\n')
  const apiBodies = s.apiSequence ?? [typeof s.api === 'string' ? ({} as Record<string, unknown>) : (s.api ?? goodApi)]
  const apiRaw = typeof s.api === 'string' ? s.api : null
  writeFileSync(join(dir, 'api-seq.json'), JSON.stringify(apiBodies))
  if (apiRaw !== null) writeFileSync(join(dir, 'api-raw.txt'), apiRaw)
  const h = s.health ?? { code: '200', headers: 'HTTP/2 200\r\ncontent-type: application/json\r\n', body: '{"status":"ok"}' }
  writeFileSync(join(dir, 'health-body.txt'), h.body ?? '')
  writeFileSync(join(dir, 'health-headers.txt'), h.headers ?? '')
  writeFileSync(join(bin, 'curl'), `#!/bin/bash
# stub: record URL, route api.vercel.com vs health URL
url=""; out=""; dump=""; wfmt=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2;;
    -D) dump="$2"; shift 2;;
    -w) wfmt="$2"; shift 2;;
    -H) echo "$2" >> "${dir}/curl-headers.log"; shift 2;;
    --max-time) shift 2;;
    -*) shift;;
    *) url="$1"; shift;;
  esac
done
echo "$url" >> "${dir}/curl-urls.log"
case "$url" in
  *api.vercel.com*)
    n=$(cat "${dir}/api-count" 2>/dev/null || echo 0)
    echo $((n+1)) > "${dir}/api-count"
    if [ -f "${dir}/api-raw.txt" ]; then cat "${dir}/api-raw.txt"; exit 0; fi
    jq -c --argjson n "$n" '.[ ( if $n >= length then length-1 else $n end ) ]' "${dir}/api-seq.json"
    exit 0;;
  *)
    ${h.curlRc ? `exit ${h.curlRc}` : ':'}
    [ -n "$dump" ] && cp "${dir}/health-headers.txt" "$dump"
    [ -n "$out" ] && cp "${dir}/health-body.txt" "$out"
    [ -n "$wfmt" ] && printf '%s' "${h.code ?? '200'}"
    exit 0;;
esac
`)
  chmodSync(join(bin, 'curl'), 0o755)
  chmodSync(join(bin, 'sleep'), 0o755)

  const block = extractRunBlock(workflowText(), STEP_NAME)
  if (block === null) return { code: -1, out: `STEP NOT FOUND: ${STEP_NAME}`, summary: '', urls: [], headers: [], apiCalls: 0 }
  const scriptPath = join(dir, 'step.sh')
  writeFileSync(scriptPath, '#!/bin/bash\nset -e\n' + block)
  const summaryPath = join(dir, 'summary.md')
  writeFileSync(summaryPath, '')

  const res = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      DEPLOY_URL,
      EXPECTED_SHA: SHA,
      PROD_HEALTH_URL,
      VERCEL_TOKEN: TOKEN,
      VERCEL_ORG_ID: 'team_test',
      GITHUB_STEP_SUMMARY: summaryPath,
      ...s.env,
    },
  })
  let urls: string[] = []
  try {
    urls = readFileSync(join(dir, 'curl-urls.log'), 'utf8').split('\n').filter(Boolean)
  } catch {
    // no curl calls were made
  }
  let headers: string[] = []
  try {
    headers = readFileSync(join(dir, 'curl-headers.log'), 'utf8').split('\n').filter(Boolean)
  } catch {
    // no headers were sent
  }
  return {
    code: res.status ?? -1,
    out: `${res.stdout}\n${res.stderr}`,
    summary: readFileSync(summaryPath, 'utf8'),
    urls,
    headers,
    apiCalls: urls.filter((u) => u.includes('api.vercel.com')).length,
  }
}

describe('workflow structure', () => {
  const text = workflowText()

  it('has a step "Verify deployment and health" that only runs for real deploys', () => {
    const lines = text.split('\n')
    const i = lines.findIndex((l) => l.trim() === `- name: ${STEP_NAME}`)
    expect(i).toBeGreaterThan(-1)
    expect(lines.slice(i, i + 4).join('\n')).toContain('if: inputs.dry_run == false')
  })

  it('captures the deployment URL from the Deploy step and feeds it to the verification', () => {
    expect(text).toMatch(/- name: Deploy\n\s+id: deploy/)
    expect(text).toContain('steps.deploy.outputs.url')
  })

  it('takes the deployment URL from stdout first and only falls back to stderr', () => {
    const iOut = text.indexOf("grep -Eo 'https://[A-Za-z0-9.-]+\\.vercel\\.app' deploy.out")
    const iErr = text.indexOf("grep -Eo 'https://[A-Za-z0-9.-]+\\.vercel\\.app' deploy.err")
    expect(iOut).toBeGreaterThan(-1)
    expect(iErr).toBeGreaterThan(iOut)
  })

  it('no longer swallows an unreachable app as a warning-only curl check', () => {
    expect(text).not.toMatch(/if curl -fsS --max-time 15 "\$PROD_HEALTH_URL"/)
    expect(text).not.toContain('- name: Health check')
  })

  it('extracts a non-empty run block', () => {
    const block = extractRunBlock(text, STEP_NAME)
    expect(block).not.toBeNull()
    expect(block!.length).toBeGreaterThan(200)
  })
})

describe('Verify deployment and health', () => {
  it('passes when the deployment is verified and the app answers healthy', () => {
    const r = run()
    expect(r.code).toBe(0)
    expect(r.summary).toContain('Produktionsverifiering')
    expect(r.summary).toMatch(/READY/)
    expect(r.summary).toMatch(/Appens hälsa.*✓/s)
    expect(r.out).not.toContain('::error::')
  })

  it('queries the exact deployment host and team through the Vercel API, then the production health URL', () => {
    const r = run()
    expect(r.code).toBe(0)
    expect(r.urls[0]).toBe(
      'https://api.vercel.com/v13/deployments/equinet-axhxaijfh-cola500s-projects.vercel.app?teamId=team_test'
    )
    expect(r.urls).toContain(PROD_HEALTH_URL)
  })

  it('waits for the deployment to become READY instead of failing on the first poll', () => {
    const r = run({
      apiSequence: [{ ...goodApi, readyState: 'BUILDING' }, { ...goodApi, readyState: 'BUILDING' }, goodApi],
    })
    expect(r.code).toBe(0)
  })

  it('fails when the deployment never becomes READY', () => {
    const r = run({ apiSequence: [{ ...goodApi, readyState: 'BUILDING' }] })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
    expect(r.summary).toMatch(/READY/)
  })

  it('fails when the deployment is not a production deployment', () => {
    const r = run({ api: { ...goodApi, target: 'preview' } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
  })

  it('fails when the production alias is not attached to the new deployment', () => {
    const r = run({ api: { ...goodApi, alias: ['equinet-app.vercel.app'] } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('equinet.johanlindengard.com')
  })

  it('fails when the deployed commit differs from the requested SHA', () => {
    const r = run({ api: { ...goodApi, meta: { githubCommitSha: 'f'.repeat(40) } } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
  })

  it('only warns when the API response carries no commit SHA', () => {
    const r = run({ api: { ...goodApi, meta: {} } })
    expect(r.code).toBe(0)
    expect(r.out).toContain('::warning::')
  })

  it('fails with a clear message when no deployment URL was captured', () => {
    const r = run({ env: { DEPLOY_URL: '' } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
  })

  it('fails when the API answer is not valid JSON', () => {
    const r = run({ api: 'upstream connect error' })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
  })

  it('reports the app as NOT VERIFIED (not as OK) when the Vercel bot challenge blocks the request', () => {
    const r = run({
      health: {
        code: '429',
        headers: 'HTTP/2 429\r\nserver: Vercel\r\nx-vercel-mitigated: challenge\r\ncontent-type: text/html\r\n',
        body: '<!DOCTYPE html><html><title>Vercel Security Checkpoint</title>',
      },
    })
    expect(r.code).toBe(0) // the deployment itself is verified via the API
    expect(r.out).toContain('::warning::')
    expect(r.summary).toMatch(/EJ verifierad/)
    expect(r.summary).not.toMatch(/Appens hälsa[^\n]*✓/)
  })

  it('fails when the app answers but is unhealthy (5xx)', () => {
    const r = run({ health: { code: '503', headers: 'HTTP/2 503\r\n', body: '{"status":"error"}' } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
    expect(r.out).toContain('vercel-token-sync-and-production-deploy.md')
  })

  it('fails when the app answers 200 without status ok', () => {
    const r = run({ health: { code: '200', headers: 'HTTP/2 200\r\n', body: '<html>maintenance</html>' } })
    expect(r.code).toBe(1)
  })

  it('fails when the app cannot be reached at all', () => {
    const r = run({ health: { curlRc: 7 } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('::error::')
  })

  it('authenticates the Vercel API call with the token as a Bearer header', () => {
    const r = run()
    expect(r.headers).toContain(`Authorization: Bearer ${TOKEN}`)
  })

  it('stops at once on a terminal deployment state instead of retrying', () => {
    for (const state of ['ERROR', 'CANCELED']) {
      const r = run({ apiSequence: [{ ...goodApi, readyState: state }] })
      expect(r.code).toBe(1)
      expect(r.apiCalls).toBe(1)
      expect(r.out).toContain(state)
    }
  })

  it('does not treat a firewall deny (x-vercel-mitigated: deny) as a bot challenge', () => {
    const r = run({
      health: { code: '403', headers: 'HTTP/2 403\r\nx-vercel-mitigated: deny\r\n', body: 'Forbidden' },
    })
    expect(r.code).toBe(1)
    expect(r.summary).not.toMatch(/EJ verifierad/)
  })

  it('treats a rate-limit 429 from the app itself (no mitigation header) as unhealthy', () => {
    const r = run({ health: { code: '429', headers: 'HTTP/2 429\r\n', body: '{"error":"for manga forfragningar"}' } })
    expect(r.code).toBe(1)
  })

  it('accepts a pretty-printed health body', () => {
    const r = run({
      health: { code: '200', headers: 'HTTP/2 200\r\n', body: '{\n  "timestamp": "2026-10-07T09:57:57Z",\n  "status": "ok",\n  "checks": { "database": "connected" }\n}' },
    })
    expect(r.code).toBe(0)
    expect(r.summary).toMatch(/Appens hälsa.*✓/s)
  })

  it('does not let values from the API inject workflow annotations or break the summary table', () => {
    const r = run({ apiSequence: [{ ...goodApi, readyState: 'BUILDING\n::error::injected | pipe \\n' }] })
    expect(r.code).toBe(1)
    const annotationLines = r.out.split('\n').filter((l) => l.startsWith('::error::'))
    expect(annotationLines.every((l) => !l.includes('injected') || !l.startsWith('::error::injected'))).toBe(true)
    // the summary stays a well-formed table: every table row has exactly three pipes
    const rows = r.summary.split('\n').filter((l) => l.startsWith('|'))
    expect(rows.length).toBeGreaterThan(2)
    expect(rows.every((l) => (l.match(/\|/g) ?? []).length === 3)).toBe(true)
  })

  it('never prints the Vercel token', () => {
    for (const s of [run(), run({ health: { code: '503', body: 'x' } }), run({ api: { ...goodApi, target: 'preview' } })]) {
      expect(s.code).not.toBe(-1) // the step was actually found and executed
      expect(s.out).not.toContain(TOKEN)
      expect(s.summary).not.toContain(TOKEN)
    }
  })
})

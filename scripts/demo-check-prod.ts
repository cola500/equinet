/**
 * Read-only demo-readiness check for production.
 *
 * Performs HTTPS GETs against publicly-exposed endpoints to verify that
 * a production deployment is reachable and configured for demo. Does NOT
 * connect to a database, does NOT use service-role credentials, does NOT
 * write anything.
 *
 * Hard fail (exit 1):
 *   - APP_URL missing or not https
 *   - GET /login returns non-200 or body lacks "Logga in på Equinet"
 *   - GET /api/feature-flags has technical error (5xx, malformed JSON, timeout)
 *
 * Warning (exit 0, logged as ⚠):
 *   - demo_mode missing from feature-flags response
 *   - demo_mode === false
 *
 * Usage: APP_URL=https://equinet-app.vercel.app npm run demo:check:prod
 */

export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface CheckResult {
  status: CheckStatus
  detail?: string
  hint?: string
}

const FETCH_TIMEOUT_MS = 10_000
const EXPECTED_LOGIN_TEXT = 'Logga in på Equinet'

const BOT_ID_WARN_HINT =
  'Programmatic prod smoke was blocked by Vercel BotID. This is exit 0 because the app itself did not return a verified application failure, but prod demo readiness is NOT fully verified by this script. Verify manually in browser or via Playwright browser-based smoke.'

// ---------------------------------------------------------------------------
// Header helpers
// ---------------------------------------------------------------------------

type HeaderInput = Headers | Record<string, string>

function getHeaderValue(headers: HeaderInput, name: string): string | null {
  const lower = name.toLowerCase()
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(lower)
  }
  for (const [k, v] of Object.entries(headers as Record<string, string>)) {
    if (k.toLowerCase() === lower) return v
  }
  return null
}

// ---------------------------------------------------------------------------
// Pure check functions (testable)
// ---------------------------------------------------------------------------

/**
 * Detect Vercel BotID / Attack Challenge mitigation.
 *
 * Returns a WARN result if the response is a Vercel platform-level challenge
 * (programmatic clients without browser fingerprint get blocked). Returns null
 * if no challenge detected — caller should fall through to normal checks.
 *
 * Primary signal: `x-vercel-mitigated: challenge` header.
 * Heuristic: 429 + content-type text/html + server: Vercel.
 */
export function detectBotIdChallenge(
  status: number,
  headers: HeaderInput
): CheckResult | null {
  const mitigated = getHeaderValue(headers, 'x-vercel-mitigated')
  if (mitigated?.toLowerCase() === 'challenge') {
    return {
      status: 'warn',
      detail: 'Vercel BotID challenge',
      hint: BOT_ID_WARN_HINT,
    }
  }
  if (status === 429) {
    const contentType =
      getHeaderValue(headers, 'content-type')?.toLowerCase() ?? ''
    const server = getHeaderValue(headers, 'server')?.toLowerCase() ?? ''
    if (contentType.includes('text/html') && server.includes('vercel')) {
      return {
        status: 'warn',
        detail: 'Vercel BotID challenge (heuristic)',
        hint: BOT_ID_WARN_HINT,
      }
    }
  }
  return null
}

export function checkAppUrl(value: string | undefined): CheckResult {
  if (!value) {
    return {
      status: 'fail',
      hint: 'Sätt APP_URL till deployment-URL, t.ex. APP_URL=https://equinet-app.vercel.app',
    }
  }
  if (!value.startsWith('https://')) {
    return {
      status: 'fail',
      detail: value,
      hint: 'APP_URL måste börja med https://',
    }
  }
  const normalized = value.replace(/\/+$/, '')
  return { status: 'ok', detail: normalized }
}

export function checkLoginResponse(status: number, body: string): CheckResult {
  if (status !== 200) {
    return {
      status: 'fail',
      detail: `HTTP ${status}`,
      hint: 'Förvänta 200 från /login. Kontrollera att deployment är uppe',
    }
  }
  if (!body.includes(EXPECTED_LOGIN_TEXT)) {
    return {
      status: 'fail',
      hint: `Body saknar "${EXPECTED_LOGIN_TEXT}". Kontrollera att rätt build är deployad`,
    }
  }
  return { status: 'ok', detail: '200 + login-text' }
}

export function checkFeatureFlagsResponse(
  status: number,
  body: unknown
): CheckResult {
  if (status >= 500) {
    return {
      status: 'fail',
      detail: `HTTP ${status}`,
      hint: '5xx från /api/feature-flags. Kontrollera DB-anslutning i prod',
    }
  }
  if (status !== 200 || body === null || typeof body !== 'object') {
    return {
      status: 'fail',
      detail: `HTTP ${status}, body=${typeof body}`,
      hint: 'Förvänta JSON-objekt från /api/feature-flags',
    }
  }
  const flags = body as Record<string, unknown>
  if (!('demo_mode' in flags)) {
    return {
      status: 'warn',
      hint: 'demo_mode-flaggan saknas i respons. Demo kanske inte är konfigurerad',
    }
  }
  if (flags.demo_mode === false) {
    return {
      status: 'warn',
      hint: 'demo_mode=false. Sätt till true via /admin/system om demo ska visas',
    }
  }
  return { status: 'ok', detail: 'demo_mode=true' }
}

// ---------------------------------------------------------------------------
// IO layer (not unit-tested — lutar på pure functions ovan)
// ---------------------------------------------------------------------------

async function timedFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal, method: 'GET' })
  } finally {
    clearTimeout(timeout)
  }
}

function format(name: string, result: CheckResult): string {
  const icon =
    result.status === 'ok' ? '✓' : result.status === 'warn' ? '⚠' : '✗'
  const detail = result.detail ? ` — ${result.detail}` : ''
  const hint = result.hint ? `\n    hint: ${result.hint}` : ''
  return `${icon} ${name}${detail}${hint}`
}

async function main(): Promise<void> {
  console.log('[demo:check:prod] Read-only demo-readiness check\n')

  const results: Array<{ name: string; result: CheckResult }> = []

  // 1. APP_URL
  const appUrlCheck = checkAppUrl(process.env.APP_URL)
  results.push({ name: 'APP_URL', result: appUrlCheck })
  console.log(format('APP_URL', appUrlCheck))
  if (appUrlCheck.status === 'fail') {
    process.exit(1)
  }
  const appUrl = appUrlCheck.detail!

  // 2. GET /login
  let loginCheck: CheckResult
  try {
    const res = await timedFetch(`${appUrl}/login`)
    const challenge = detectBotIdChallenge(res.status, res.headers)
    if (challenge) {
      loginCheck = challenge
    } else {
      const body = await res.text()
      loginCheck = checkLoginResponse(res.status, body)
    }
  } catch (err) {
    loginCheck = {
      status: 'fail',
      detail: err instanceof Error ? err.message : 'unknown error',
      hint: '/login svarade inte inom 10s. Kontrollera deployment-status',
    }
  }
  results.push({ name: 'GET /login', result: loginCheck })
  console.log(format('GET /login', loginCheck))

  // 3. GET /api/feature-flags
  let flagsCheck: CheckResult
  try {
    const res = await timedFetch(`${appUrl}/api/feature-flags`)
    const challenge = detectBotIdChallenge(res.status, res.headers)
    if (challenge) {
      flagsCheck = challenge
    } else {
      const text = await res.text()
      let body: unknown = null
      try {
        body = JSON.parse(text)
      } catch {
        flagsCheck = {
          status: 'fail',
          detail: 'malformed JSON',
          hint: '/api/feature-flags returnerade icke-JSON',
        }
        results.push({ name: 'GET /api/feature-flags', result: flagsCheck })
        console.log(format('GET /api/feature-flags', flagsCheck))
        summarize(results)
        return
      }
      flagsCheck = checkFeatureFlagsResponse(res.status, body)
    }
  } catch (err) {
    flagsCheck = {
      status: 'fail',
      detail: err instanceof Error ? err.message : 'unknown error',
      hint: '/api/feature-flags svarade inte inom 10s',
    }
  }
  results.push({ name: 'GET /api/feature-flags', result: flagsCheck })
  console.log(format('GET /api/feature-flags', flagsCheck))

  summarize(results)
}

function summarize(
  results: Array<{ name: string; result: CheckResult }>
): void {
  const fails = results.filter(r => r.result.status === 'fail').length
  const warns = results.filter(r => r.result.status === 'warn').length
  const oks = results.filter(r => r.result.status === 'ok').length
  console.log(`\nSummary: ${oks} ok, ${warns} warn, ${fails} fail`)
  if (fails > 0) {
    process.exit(1)
  }
}

// CLI entry point
const isDirectInvocation =
  typeof require !== 'undefined' && require.main === module
if (isDirectInvocation || process.argv[1]?.endsWith('demo-check-prod.ts')) {
  main().catch(err => {
    console.error('[demo:check:prod] Unexpected error:', err)
    process.exit(1)
  })
}

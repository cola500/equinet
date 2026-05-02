import { describe, it, expect } from 'vitest'
import {
  checkAppUrl,
  checkLoginResponse,
  checkFeatureFlagsResponse,
  detectBotIdChallenge,
  type CheckResult,
} from './demo-check-prod'

describe('checkAppUrl', () => {
  it('FAIL when APP_URL missing', () => {
    const result = checkAppUrl(undefined)
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/APP_URL/)
  })

  it('FAIL when APP_URL is empty', () => {
    const result = checkAppUrl('')
    expect(result.status).toBe('fail')
  })

  it('FAIL when APP_URL is http (not https)', () => {
    const result = checkAppUrl('http://example.com')
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/https/i)
  })

  it('OK when APP_URL is https', () => {
    const result = checkAppUrl('https://equinet-app.vercel.app')
    expect(result.status).toBe('ok')
  })

  it('OK strips trailing slash from APP_URL in detail', () => {
    const result = checkAppUrl('https://equinet-app.vercel.app/')
    expect(result.status).toBe('ok')
    expect(result.detail).toBe('https://equinet-app.vercel.app')
  })
})

describe('checkLoginResponse', () => {
  it('OK when status 200 and body contains "Logga in på Equinet"', () => {
    const result = checkLoginResponse(200, '<html>...Logga in på Equinet...</html>')
    expect(result.status).toBe('ok')
  })

  it('FAIL when status not 200', () => {
    const result = checkLoginResponse(500, 'Server Error')
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/200/)
  })

  it('FAIL when body missing expected text', () => {
    const result = checkLoginResponse(200, '<html>404 not found</html>')
    expect(result.status).toBe('fail')
    expect(result.hint).toMatch(/Logga in/)
  })
})

describe('checkFeatureFlagsResponse', () => {
  it('OK when flags include demo_mode=true', () => {
    const result = checkFeatureFlagsResponse(200, { demo_mode: true, messaging: true })
    expect(result.status).toBe('ok')
  })

  it('WARN when demo_mode missing from flags', () => {
    const result = checkFeatureFlagsResponse(200, { messaging: true })
    expect(result.status).toBe('warn')
    expect(result.hint).toMatch(/demo_mode/)
  })

  it('WARN when demo_mode=false', () => {
    const result = checkFeatureFlagsResponse(200, { demo_mode: false })
    expect(result.status).toBe('warn')
    expect(result.hint).toMatch(/demo_mode/)
  })

  it('FAIL when status 5xx (technical error)', () => {
    const result = checkFeatureFlagsResponse(503, null)
    expect(result.status).toBe('fail')
  })

  it('FAIL when body is not a JSON object', () => {
    const result = checkFeatureFlagsResponse(200, null)
    expect(result.status).toBe('fail')
  })
})

describe('detectBotIdChallenge', () => {
  it('WARN when x-vercel-mitigated=challenge on 429', () => {
    const result = detectBotIdChallenge(429, {
      'x-vercel-mitigated': 'challenge',
      'content-type': 'text/html',
      server: 'Vercel',
    })
    expect(result).not.toBeNull()
    expect(result!.status).toBe('warn')
    expect(result!.detail).toMatch(/BotID/)
    expect(result!.hint).toMatch(/blocked by Vercel BotID/)
    expect(result!.hint).toMatch(/exit 0/)
    expect(result!.hint).toMatch(/NOT fully verified/)
  })

  it('WARN when x-vercel-mitigated=challenge even on 200 (defensive)', () => {
    const result = detectBotIdChallenge(200, {
      'x-vercel-mitigated': 'challenge',
    })
    expect(result?.status).toBe('warn')
  })

  it('null when x-vercel-mitigated header is absent and status is 200', () => {
    const result = detectBotIdChallenge(200, { 'content-type': 'text/html' })
    expect(result).toBeNull()
  })

  it('null when x-vercel-mitigated has a non-challenge value', () => {
    const result = detectBotIdChallenge(429, {
      'x-vercel-mitigated': 'passed',
    })
    expect(result).toBeNull()
  })

  it('WARN via heuristic: 429 + text/html + server: Vercel', () => {
    const result = detectBotIdChallenge(429, {
      'content-type': 'text/html; charset=utf-8',
      server: 'Vercel',
    })
    expect(result?.status).toBe('warn')
    expect(result?.detail).toMatch(/heuristic/)
  })

  it('null on 429 with application/json (our own rate-limit, not BotID)', () => {
    const result = detectBotIdChallenge(429, {
      'content-type': 'application/json',
      server: 'Vercel',
    })
    expect(result).toBeNull()
  })

  it('null on 500 even from Vercel (real server errors must not WARN)', () => {
    const result = detectBotIdChallenge(500, {
      'content-type': 'text/html',
      server: 'Vercel',
    })
    expect(result).toBeNull()
  })

  it('case-insensitive header lookup (X-Vercel-Mitigated)', () => {
    const result = detectBotIdChallenge(429, {
      'X-Vercel-Mitigated': 'challenge',
    })
    expect(result?.status).toBe('warn')
  })

  it('works with a Headers instance, not just plain object', () => {
    const headers = new Headers({
      'x-vercel-mitigated': 'challenge',
    })
    const result = detectBotIdChallenge(429, headers)
    expect(result?.status).toBe('warn')
  })
})

describe('CheckResult shape', () => {
  it('all check helpers return ok|warn|fail', () => {
    const samples: CheckResult[] = [
      checkAppUrl('https://x.com'),
      checkLoginResponse(200, 'Logga in på Equinet'),
      checkFeatureFlagsResponse(200, { demo_mode: true }),
    ]
    for (const s of samples) {
      expect(['ok', 'warn', 'fail']).toContain(s.status)
    }
  })
})

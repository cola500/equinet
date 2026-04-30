import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { dataRetentionWarningEmail } from './data-retention-warning'

describe('dataRetentionWarningEmail', () => {
  const originalEnv = process.env.APP_URL

  afterEach(() => {
    process.env.APP_URL = originalEnv
  })

  it('uses APP_URL when set', () => {
    process.env.APP_URL = 'https://equinet-app.vercel.app'
    const { html, text } = dataRetentionWarningEmail()

    expect(html).toContain('https://equinet-app.vercel.app')
    expect(text).toContain('https://equinet-app.vercel.app')
    expect(html).not.toContain('equinet.vercel.app')
  })

  it('falls back to localhost when APP_URL is not set', () => {
    delete process.env.APP_URL
    const { html, text } = dataRetentionWarningEmail()

    expect(html).toContain('http://localhost:3000')
    expect(text).toContain('http://localhost:3000')
    expect(html).not.toContain('equinet.vercel.app')
  })

  it('never uses the old hardcoded domain', () => {
    process.env.APP_URL = 'https://equinet-app.vercel.app'
    const { html, text } = dataRetentionWarningEmail()

    // equinet.vercel.app (without -app) was the incorrect hardcoded fallback
    expect(html).not.toMatch(/https?:\/\/equinet\.vercel\.app/)
    expect(text).not.toMatch(/https?:\/\/equinet\.vercel\.app/)
  })
})

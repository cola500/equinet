export const REQUIRED_PROD_VARS = [
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

export function checkProdEnv(env: Record<string, string | undefined>): { missing: string[] } {
  const missing = REQUIRED_PROD_VARS.filter(v => !env[v])
  return { missing }
}

export function checkCronsEnabled(env: Record<string, string | undefined>): { ok: boolean; reason?: string } {
  // Staging projects (e.g. equinet-staging-app) are deployed with VERCEL_ENV=production
  // since their staging branch is the production target. STAGING_PROJECT=true marks
  // them as staging so DISABLE_CRONS=true is allowed (and required) there.
  if (env.STAGING_PROJECT === 'true') {
    return { ok: true }
  }
  if (env.DISABLE_CRONS === 'true') {
    return {
      ok: false,
      reason: 'DISABLE_CRONS=true is set on production. Cron jobs would be silently skipped (no reminders sent, no data retention).',
    }
  }
  return { ok: true }
}

// CLI entry point — only runs when VERCEL_ENV=production
if (process.env.VERCEL_ENV === 'production') {
  const env = process.env as Record<string, string | undefined>
  const { missing } = checkProdEnv(env)
  if (missing.length > 0) {
    console.error(`\n[check-prod-env] FAIL: Missing required environment variables:`)
    for (const v of missing) {
      console.error(`  - ${v}`)
    }
    console.error(`\nFix: Set these variables in Vercel Project Settings > Environment Variables (Production).\n`)
    process.exit(1)
  }

  const cronCheck = checkCronsEnabled(env)
  if (!cronCheck.ok) {
    console.error(`\n[check-prod-env] FAIL: ${cronCheck.reason}`)
    console.error(`\nFix: Remove DISABLE_CRONS or set it to 'false' in production. DISABLE_CRONS is meant for staging projects only.\n`)
    process.exit(1)
  }

  if (env.STAGING_PROJECT === 'true') {
    console.log('[check-prod-env] OK: Staging project detected (STAGING_PROJECT=true). Required vars set; cron-enabled-check skipped.')
  } else {
    console.log('[check-prod-env] OK: All required production environment variables are set and crons are enabled.')
  }
}

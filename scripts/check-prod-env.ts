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

// CLI entry point — only runs when VERCEL_ENV=production
if (process.env.VERCEL_ENV === 'production') {
  const { missing } = checkProdEnv(process.env as Record<string, string | undefined>)
  if (missing.length > 0) {
    console.error(`\n[check-prod-env] FAIL: Missing required environment variables:`)
    for (const v of missing) {
      console.error(`  - ${v}`)
    }
    console.error(`\nFix: Set these variables in Vercel Project Settings > Environment Variables (Production).\n`)
    process.exit(1)
  } else {
    console.log('[check-prod-env] OK: All required production environment variables are set.')
  }
}

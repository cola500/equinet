/**
 * Guard against accidentally seeding a hosted (staging/production) Supabase
 * project. The seed script creates users with a hardcoded test password —
 * running it against prod would set real accounts to that password.
 *
 * Override with ALLOW_SEED_PROD=true if you genuinely need to seed a hosted
 * environment (e.g. demo provisioning).
 */
export interface AssertSeedSafeOptions {
  supabaseUrl: string
  allowProd: boolean
}

export function assertSeedSafe(options: AssertSeedSafeOptions): void {
  const { supabaseUrl, allowProd } = options

  if (allowProd) return

  const lower = supabaseUrl.toLowerCase()
  const isHosted = lower.includes("supabase.co") || lower.includes("supabase.com")

  if (isHosted) {
    throw new Error(
      `Refusing to seed against hosted Supabase (target: ${supabaseUrl}). ` +
        `Set ALLOW_SEED_PROD=true to override (only for demo provisioning).`
    )
  }
}

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

/** Known Supabase project refs for this codebase. */
export const STAGING_PROJECT_REF = "zzdamokfeenencuggjjp"
export const PROD_PROJECT_REF = "xybyzflfxnqqyxnvjklv"

/**
 * Extract the Supabase project ref from a connection string or Supabase URL.
 *
 * Handles the three shapes we use:
 *   - Pooler:  postgresql://postgres.<ref>@aws-0-...pooler.supabase.com:6543/postgres
 *   - Direct:  postgresql://postgres@db.<ref>.supabase.co:5432/postgres
 *   - API URL: https://<ref>.supabase.co
 *
 * Returns null for localhost or anything we can't parse a ref from.
 */
export function extractSupabaseProjectRef(url: string): string | null {
  if (!url) return null
  // Pooler: ref lives in the username (postgres.<ref>)
  const pooler = url.match(/\/\/postgres\.([a-z0-9]{16,})/i)
  if (pooler) return pooler[1].toLowerCase()
  // Direct DB host: @db.<ref>.supabase.co|com
  const direct = url.match(/@db\.([a-z0-9]{16,})\.supabase\.(?:co|com)/i)
  if (direct) return direct[1].toLowerCase()
  // Supabase API URL: //<ref>.supabase.co|com
  const api = url.match(/\/\/([a-z0-9]{16,})\.supabase\.(?:co|com)/i)
  if (api) return api[1].toLowerCase()
  return null
}

export interface AssertStagingSeedSafeOptions {
  /** Where Prisma writes land — the primary target to validate. */
  databaseUrl: string
  /** Fallback used only when databaseUrl yields no project ref. */
  supabaseUrl?: string
  /** When true (e.g. SEED_TARGET=staging), localhost is refused. */
  requireStaging?: boolean
  /** Override the allowed staging ref (defaults to the staging project). */
  allowedStagingRef?: string
  /** Override the denied production ref. */
  prodRef?: string
}

/**
 * Guard the demo-provider seed so it can only target the staging Supabase
 * project (or localhost in local dev). Refuses prod and unknown hosted projects.
 *
 * - localhost/127.0.0.1: allowed unless requireStaging is set
 * - production project ref: always refused
 * - any non-staging hosted ref (or unparseable hosted url): refused
 */
export function assertStagingSeedSafe(options: AssertStagingSeedSafeOptions): void {
  const {
    databaseUrl,
    supabaseUrl,
    requireStaging = false,
    allowedStagingRef = STAGING_PROJECT_REF,
    prodRef = PROD_PROJECT_REF,
  } = options

  const lower = databaseUrl.toLowerCase()
  const isLocal = lower.includes("localhost") || lower.includes("127.0.0.1")

  if (isLocal) {
    if (requireStaging) {
      throw new Error(
        "Refusing to seed: DATABASE_URL points to localhost but staging was required " +
          "(SEED_TARGET=staging)."
      )
    }
    return
  }

  const ref =
    extractSupabaseProjectRef(databaseUrl) ?? extractSupabaseProjectRef(supabaseUrl ?? "")

  if (ref === prodRef) {
    throw new Error(
      `Refusing to seed: target project ref '${ref}' is PRODUCTION. Aborting.`
    )
  }

  if (ref !== allowedStagingRef) {
    throw new Error(
      `Refusing to seed: target project ref '${ref ?? "unknown"}' is not the allowed ` +
        `staging project '${allowedStagingRef}'.`
    )
  }
}

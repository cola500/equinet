import { logger } from "./logger"
import type { IFeatureFlagRepository } from "@/infrastructure/persistence/feature-flag"
import { featureFlagRepository as defaultRepository } from "@/infrastructure/persistence/feature-flag"
import { FEATURE_FLAGS } from "./feature-flag-definitions"
import type { FeatureFlag } from "./feature-flag-definitions"

// Re-export for backward compatibility
export { FEATURE_FLAGS }
export type { FeatureFlag }

// --- Repository + Cache ---

const CACHE_TTL_MS = 30_000 // 30 seconds

let repository: IFeatureFlagRepository | null = null
let cache: { data: Record<string, boolean>; timestamp: number } | null = null

function getRepository(): IFeatureFlagRepository {
  return repository ?? defaultRepository
}

function invalidateCache(): void {
  cache = null
}

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS
}

/**
 * Get all feature flags with their current enabled state.
 *
 * Priority: env variable > database override > code default
 *
 * Caches DB results for 30s. Falls back to code defaults on DB error.
 */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const keys = Object.keys(FEATURE_FLAGS)
  const result: Record<string, boolean> = {}

  // Fetch DB overrides (with cache)
  let dbOverrides: Record<string, boolean> = {}
  if (isCacheValid()) {
    dbOverrides = cache!.data
  } else {
    try {
      const repo = getRepository()
      const flags = await repo.findAll()
      for (const flag of flags) {
        dbOverrides[flag.key] = flag.enabled
      }
      cache = { data: dbOverrides, timestamp: Date.now() }
    } catch (error) {
      logger.warn("Failed to fetch feature flags from database, using defaults", error as Error)
      // Fall through -- dbOverrides stays empty, we use code defaults
    }
  }

  for (const key of keys) {
    const flag = FEATURE_FLAGS[key]

    // 1. Env variable (highest priority)
    const envKey = `FEATURE_${key.toUpperCase()}`
    const envValue = process.env[envKey]
    if (envValue !== undefined) {
      result[key] = envValue === "true"
      continue
    }

    // 2. Database override
    if (key in dbOverrides) {
      result[key] = dbOverrides[key]
      continue
    }

    // 3. Code default
    result[key] = flag.defaultEnabled
  }

  return result
}

/**
 * Get only client-visible feature flags.
 * Used by the public API to avoid disclosing internal/admin-only flags.
 */
export async function getClientVisibleFlags(): Promise<Record<string, boolean>> {
  const allFlags = await getFeatureFlags()
  const result: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(allFlags)) {
    if (FEATURE_FLAGS[key]?.clientVisible !== false) {
      result[key] = value
    }
  }
  return result
}

/**
 * Check if a specific feature flag is enabled.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  if (!FEATURE_FLAGS[key]) return false
  const flags = await getFeatureFlags()
  return flags[key] ?? false
}

/**
 * Set a feature flag override in the database.
 * Invalidates cache so the change is visible immediately.
 * Throws a descriptive error on DB failure.
 */
export async function setFeatureFlagOverride(
  key: string,
  value: string
): Promise<void> {
  try {
    const repo = getRepository()
    await repo.upsert(key, value === "true")
    invalidateCache()
  } catch (error) {
    const message = error instanceof Error ? error.message : "okänt fel"
    throw new Error(`Kunde inte uppdatera flaggan ${key}: ${message}`)
  }
}

/**
 * Remove a feature flag override (resets to code default).
 * Writes the default value to the database to ensure consistency.
 */
export async function removeFeatureFlagOverride(key: string): Promise<void> {
  const flag = FEATURE_FLAGS[key]
  const defaultValue = flag?.defaultEnabled ?? false
  try {
    const repo = getRepository()
    await repo.upsert(key, defaultValue)
    invalidateCache()
  } catch (error) {
    const message = error instanceof Error ? error.message : "okänt fel"
    throw new Error(`Kunde inte uppdatera flaggan ${key}: ${message}`)
  }
}

/**
 * Get feature flag definitions (metadata) for admin UI.
 */
export function getFeatureFlagDefinitions(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS)
}

/** Set repository for testing (replaces the default Prisma repository) */
export function _setRepositoryForTesting(repo: IFeatureFlagRepository | null): void {
  repository = repo
  invalidateCache()
}

/** Backward-compatible alias for _setRepositoryForTesting(null) */
export function _resetRedisForTesting(): void {
  _setRepositoryForTesting(null)
}

import { logger } from "./logger"
import type { IFeatureFlagRepository } from "@/infrastructure/persistence/feature-flag"
import { featureFlagRepository as defaultRepository } from "@/infrastructure/persistence/feature-flag"

export interface FeatureFlag {
  key: string
  label: string
  description: string
  defaultEnabled: boolean
}

export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  voice_logging: {
    key: "voice_logging",
    label: "Röstloggning",
    description: "Röstbaserad arbetsloggning med AI-tolkning",
    defaultEnabled: true,
  },
  route_planning: {
    key: "route_planning",
    label: "Ruttplanering",
    description: "Ruttplaneringsverktyg för leverantörer",
    defaultEnabled: true,
  },
  route_announcements: {
    key: "route_announcements",
    label: "Rutt-annonser",
    description: "Publicera och hantera rutt-annonser",
    defaultEnabled: true,
  },
  customer_insights: {
    key: "customer_insights",
    label: "Kundinsikter",
    description: "AI-genererade kundinsikter i kundregistret",
    defaultEnabled: true,
  },
  due_for_service: {
    key: "due_for_service",
    label: "Besöksplanering",
    description: "Planera och följ upp återkommande besök",
    defaultEnabled: true,
  },
  group_bookings: {
    key: "group_bookings",
    label: "Gruppbokningar",
    description: "Gruppbokningsfunktionalitet (under utveckling)",
    defaultEnabled: false,
  },
  business_insights: {
    key: "business_insights",
    label: "Affärsinsikter",
    description: "Utökad analytics-sida med tjänsteanalys, tidsanalys och kundretention",
    defaultEnabled: true,
  },
  self_reschedule: {
    key: "self_reschedule",
    label: "Självservice-ombokning",
    description: "Kunder kan boka om sina bokningar utan att kontakta leverantören",
    defaultEnabled: true,
  },
  recurring_bookings: {
    key: "recurring_bookings",
    label: "Återkommande bokningar",
    description: "Möjlighet att skapa återkommande bokningsserier",
    defaultEnabled: false,
  },
  offline_mode: {
    key: "offline_mode",
    label: "Offlineläge",
    description: "PWA-stöd med offline-cachning av bokningar och rutter",
    defaultEnabled: true,
  },
  follow_provider: {
    key: "follow_provider",
    label: "Följ leverantör",
    description: "Kunder kan följa leverantörer och få notiser vid nya rutt-annonser",
    defaultEnabled: false,
  },
  municipality_watch: {
    key: "municipality_watch",
    label: "Bevaka kommun",
    description: "Kunder kan bevaka kommun + tjänstetyp och få notiser vid nya rutt-annonser",
    defaultEnabled: false,
  },
}

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

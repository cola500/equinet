import { Redis } from "@upstash/redis"
import { getRuntimeSetting, setRuntimeSetting, deleteRuntimeSetting } from "./settings/runtime-settings"

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
    defaultEnabled: false,
  },
}

const REDIS_PREFIX = "feature_flag:"

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (
    !redis &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

/**
 * Set a feature flag override.
 * When Redis is configured: writes to Redis only (in-memory is useless in serverless).
 * When Redis is NOT configured (local dev): writes to in-memory fallback.
 * Redis errors are propagated so the admin UI can show the failure.
 */
export async function setFeatureFlagOverride(
  key: string,
  value: string
): Promise<void> {
  const r = getRedis()
  if (r) {
    await r.set(`${REDIS_PREFIX}${key}`, value)
    return
  }

  // Local dev fallback (no Redis configured)
  setRuntimeSetting(`feature_${key}`, value)
}

/**
 * Remove a feature flag override.
 * When Redis is configured: deletes from Redis only.
 * When Redis is NOT configured (local dev): deletes from in-memory.
 * Redis errors are propagated so the admin UI can show the failure.
 */
export async function removeFeatureFlagOverride(key: string): Promise<void> {
  const r = getRedis()
  if (r) {
    await r.del(`${REDIS_PREFIX}${key}`)
    return
  }

  // Local dev fallback
  deleteRuntimeSetting(`feature_${key}`)
}

/**
 * Get all feature flags with their current enabled state.
 * Reads from Redis in production (single mget call), falls back to in-memory.
 *
 * Priority: env variable > Redis/runtime override > default
 */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const keys = Object.keys(FEATURE_FLAGS)
  const result: Record<string, boolean> = {}

  // Batch-fetch all overrides from Redis (single network call)
  const redisOverrides: Record<string, string | null> = {}
  const r = getRedis()
  if (r) {
    try {
      const redisKeys = keys.map((k) => `${REDIS_PREFIX}${k}`)
      const values = await r.mget<(string | null)[]>(...redisKeys)
      keys.forEach((k, i) => {
        redisOverrides[k] = values[i]
      })
    } catch {
      // Redis unavailable, fall through to in-memory/defaults
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

    // 2. Redis override (production)
    const redisValue = redisOverrides[key]
    if (redisValue !== null && redisValue !== undefined) {
      result[key] = String(redisValue) === "true"
      continue
    }

    // 3. In-memory runtime (dev fallback)
    const runtimeValue = getRuntimeSetting(`feature_${key}`)
    if (runtimeValue !== undefined) {
      result[key] = runtimeValue === "true"
      continue
    }

    // 4. Default
    result[key] = flag.defaultEnabled
  }

  return result
}

/**
 * Check if a specific feature flag is enabled.
 * Delegates to getFeatureFlags for a single code path.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  if (!FEATURE_FLAGS[key]) return false
  const flags = await getFeatureFlags()
  return flags[key] ?? false
}

/**
 * Get feature flag definitions (metadata) for admin UI.
 */
export function getFeatureFlagDefinitions(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS)
}

/** Reset cached Redis instance (test helper only) */
export function _resetRedisForTesting(): void {
  redis = null
}


import { NextResponse } from "next/server"
import { z } from "zod"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import {
  getAllRuntimeSettings,
  setRuntimeSetting,
} from "@/lib/settings/runtime-settings"
import { FEATURE_FLAGS, setFeatureFlagOverride, getFeatureFlags } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

const STATIC_KEYS = ["disable_emails"]
const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS).map((k) => `feature_${k}`)
const ALL_ALLOWED_KEYS = new Set([...STATIC_KEYS, ...FEATURE_FLAG_KEYS])

const patchSchema = z
  .object({
    key: z.string().refine((k) => ALL_ALLOWED_KEYS.has(k), {
      message: "Ogiltig nyckel",
    }),
    value: z.string(),
  })
  .strict()

export const GET = withApiHandler(
  { auth: "admin" },
  async () => {
    // Build env overrides for feature flags
    const featureFlagEnvOverrides: Record<string, boolean> = {}
    for (const key of Object.keys(FEATURE_FLAGS)) {
      const envKey = `FEATURE_${key.toUpperCase()}`
      if (process.env[envKey] !== undefined) {
        featureFlagEnvOverrides[key] = process.env[envKey] === "true"
      }
    }

    // Get actual flag states from database
    const featureFlagStates = await getFeatureFlags()

    return NextResponse.json(
      {
        settings: getAllRuntimeSettings(),
        env: {
          emailDisabledByEnv: process.env.DISABLE_EMAILS === "true",
          featureFlagOverrides: featureFlagEnvOverrides,
        },
        featureFlagStates,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  },
)

export const PATCH = withApiHandler(
  { auth: "admin", schema: patchSchema },
  async ({ body }) => {
    const { key, value } = body

    // Feature flag keys -> database via setFeatureFlagOverride
    if (key.startsWith("feature_")) {
      const flagKey = key.replace("feature_", "")
      try {
        await setFeatureFlagOverride(flagKey, value)
      } catch (flagError) {
        logger.error(
          `Failed to update feature flag ${key}=${value}`,
          flagError as Error
        )
        const message = flagError instanceof Error ? flagError.message : "Databasfel"
        return NextResponse.json(
          { error: message },
          { status: 503 }
        )
      }
    } else {
      setRuntimeSetting(key, value)
    }

    logger.info(`Admin runtime setting changed: ${key}=${value}`)

    return NextResponse.json({ key, value })
  },
)

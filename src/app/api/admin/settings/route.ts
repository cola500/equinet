import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import {
  getAllRuntimeSettings,
  setRuntimeSetting,
} from "@/lib/settings/runtime-settings"
import { FEATURE_FLAGS, setFeatureFlagOverride } from "@/lib/feature-flags"

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

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    await requireAdmin(session)

    // Build env overrides for feature flags
    const featureFlagEnvOverrides: Record<string, boolean> = {}
    for (const key of Object.keys(FEATURE_FLAGS)) {
      const envKey = `FEATURE_${key.toUpperCase()}`
      if (process.env[envKey] !== undefined) {
        featureFlagEnvOverrides[key] = process.env[envKey] === "true"
      }
    }

    return NextResponse.json({
      settings: getAllRuntimeSettings(),
      env: {
        emailDisabledByEnv: process.env.DISABLE_EMAILS === "true",
        featureFlagOverrides: featureFlagEnvOverrides,
      },
    })
  } catch (error) {
    if (error instanceof Response) return error
    logger.error("Failed to fetch admin settings", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    await requireAdmin(session)

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { key, value } = parsed.data

    // Feature flag keys -> Redis + in-memory via setFeatureFlagOverride
    if (key.startsWith("feature_")) {
      const flagKey = key.replace("feature_", "")
      await setFeatureFlagOverride(flagKey, value)
    } else {
      setRuntimeSetting(key, value)
    }

    logger.info(`Admin runtime setting changed: ${key}=${value}`)

    return NextResponse.json({ key, value })
  } catch (error) {
    if (error instanceof Response) return error
    logger.error("Failed to update admin settings", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

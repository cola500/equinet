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

const ALLOWED_KEYS = ["disable_emails"] as const

const patchSchema = z
  .object({
    key: z.enum(ALLOWED_KEYS),
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

    return NextResponse.json({
      settings: getAllRuntimeSettings(),
      env: {
        emailDisabledByEnv: process.env.DISABLE_EMAILS === "true",
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
    setRuntimeSetting(key, value)

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

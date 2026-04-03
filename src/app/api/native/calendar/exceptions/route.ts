/**
 * POST /api/native/calendar/exceptions - Create/update availability exception
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase).
 * Upserts an availability exception for the authenticated provider.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { parseDate } from "@/lib/date-utils"
import { dateSchema, strictTimeSchema } from "@/lib/zod-schemas"

const exceptionSchema = z.object({
  date: dateSchema,
  isClosed: z.boolean().default(true),
  startTime: strictTimeSchema.optional().nullable(),
  endTime: strictTimeSchema.optional().nullable(),
  reason: z.string()
    .max(200)
    .transform(val => val?.trim() || null)
    .nullable()
    .optional(),
  location: z.string()
    .max(100)
    .transform(val => val?.trim() || null)
    .nullable()
    .optional(),
}).strict()

export async function POST(request: NextRequest) {
  try {
    // 1. Auth (dual-auth)
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Find provider for this user
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Parse body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    // 5. Validate
    const parseResult = exceptionSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parseResult.error.issues },
        { status: 400 }
      )
    }
    const validated = parseResult.data

    // If not closed, require both startTime and endTime
    if (!validated.isClosed && (!validated.startTime || !validated.endTime)) {
      return NextResponse.json(
        { error: "startTime och endTime krävs när dagen inte är stängd" },
        { status: 400 }
      )
    }

    // 6. Upsert exception
    const parsedDate = parseDate(validated.date)
    const exception = await prisma.availabilityException.upsert({
      where: {
        providerId_date: {
          providerId: provider.id,
          date: parsedDate,
        },
      },
      update: {
        isClosed: validated.isClosed,
        startTime: validated.isClosed ? null : validated.startTime,
        endTime: validated.isClosed ? null : validated.endTime,
        reason: validated.reason ?? null,
        location: validated.location ?? null,
      },
      create: {
        providerId: provider.id,
        date: parsedDate,
        isClosed: validated.isClosed,
        startTime: validated.isClosed ? null : validated.startTime,
        endTime: validated.isClosed ? null : validated.endTime,
        reason: validated.reason ?? null,
        location: validated.location ?? null,
      },
      select: {
        date: true,
        isClosed: true,
        startTime: true,
        endTime: true,
        reason: true,
        location: true,
      },
    })

    logger.info("Native calendar exception saved", {
      userId: authUser.id,
      providerId: provider.id,
      date: validated.date,
      isClosed: validated.isClosed,
    })

    return NextResponse.json({
      ...exception,
      date: exception.date.toISOString().split("T")[0],
    }, { status: 201 })
  } catch (error) {
    logger.error("Failed to save native calendar exception", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

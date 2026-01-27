import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { parseDate } from "@/lib/date-utils"
import { z } from "zod"

// Validation schema for query parameters
const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)").optional(),
})

// Validation schema for creating an exception
const createExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  isClosed: z.boolean().default(true),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  reason: z.string()
    .max(200)
    .transform(val => val?.trim() || null)
    .nullable()
    .optional(),
})

/**
 * GET /api/providers/[id]/availability-exceptions
 * Hämta datumbaserade undantag för en leverantör
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined

    // Validate query parameters
    const queryResult = querySchema.safeParse({ from, to })
    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryResult.error.issues },
        { status: 400 }
      )
    }

    // Verify provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      )
    }

    // Build where clause
    const validatedQuery = queryResult.data
    const whereClause: {
      providerId: string
      date?: { gte?: Date; lte?: Date }
    } = { providerId }

    if (validatedQuery.from || validatedQuery.to) {
      whereClause.date = {}
      if (validatedQuery.from) {
        whereClause.date.gte = new Date(validatedQuery.from)
      }
      if (validatedQuery.to) {
        whereClause.date.lte = new Date(validatedQuery.to)
      }
    }

    const exceptions = await prisma.availabilityException.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
    })

    // Convert dates to ISO strings for JSON response
    const formattedExceptions = exceptions.map((e) => ({
      ...e,
      date: e.date.toISOString().split("T")[0], // YYYY-MM-DD
    }))

    return NextResponse.json(formattedExceptions)
  } catch (error) {
    console.error("Error fetching availability exceptions:", error)
    return new Response("Internal error", { status: 500 })
  }
}

/**
 * POST /api/providers/[id]/availability-exceptions
 * Skapa ett datumbaserat undantag
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth
    const session = await auth()

    // Provider check
    if (session.user.userType !== "provider") {
      return new Response("Only providers can create availability exceptions", { status: 403 })
    }

    // Rate limiting - use profileUpdate limiter (20/hour is reasonable for schedule changes)
    const isAllowed = await rateLimiters.profileUpdate(session.user.id)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before making more changes." },
        { status: 429 }
      )
    }

    const { id: providerId } = await params

    // Authorization check - verify the provider owns this profile
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    })

    if (!provider || provider.userId !== session.user.id) {
      return new Response("Forbidden - not your provider profile", { status: 403 })
    }

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Validate
    const validated = createExceptionSchema.parse(body)

    // If not closed, require both startTime and endTime
    if (!validated.isClosed && (!validated.startTime || !validated.endTime)) {
      return NextResponse.json(
        { error: "startTime and endTime required when not closed" },
        { status: 400 }
      )
    }

    // Create or update exception (upsert to handle duplicates gracefully)
    const parsedDate = parseDate(validated.date)
    const exception = await prisma.availabilityException.upsert({
      where: {
        providerId_date: {
          providerId,
          date: parsedDate,
        },
      },
      update: {
        isClosed: validated.isClosed,
        startTime: validated.isClosed ? null : validated.startTime,
        endTime: validated.isClosed ? null : validated.endTime,
        reason: validated.reason,
      },
      create: {
        providerId,
        date: parsedDate,
        isClosed: validated.isClosed,
        startTime: validated.isClosed ? null : validated.startTime,
        endTime: validated.isClosed ? null : validated.endTime,
        reason: validated.reason,
      },
    })

    return NextResponse.json({
      ...exception,
      date: exception.date.toISOString().split("T")[0],
    }, { status: 201 })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", JSON.stringify(error.issues, null, 2))
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error creating availability exception:", error)
    return new Response("Internal error", { status: 500 })
  }
}

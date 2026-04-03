import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import {
  requireAuth,
  requireProvider,
  requireCustomer,
  type AuthenticatedUser,
  type ProviderUser,
  type CustomerUser,
} from "@/lib/roles"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"
import { z, type ZodType } from "zod"

// --- Config types ---

type AuthLevel = "none" | "any" | "provider" | "customer"
type RateLimiterKey = keyof typeof rateLimiters

interface HandlerConfig<TSchema extends ZodType | undefined = undefined> {
  /** Auth-krav. Default: "any" (kräver inloggning, ingen specifik roll). */
  auth?: AuthLevel
  /** Rate limiter. Default: "api". Sätt false för att hoppa över. */
  rateLimit?: RateLimiterKey | false
  /** Feature flag som måste vara aktiverad. */
  featureFlag?: string
  /** Zod-schema för request body. */
  schema?: TSchema
}

// --- Handler context types ---

type UserFor<TAuth extends AuthLevel> = TAuth extends "provider"
  ? ProviderUser
  : TAuth extends "customer"
    ? CustomerUser
    : TAuth extends "any"
      ? AuthenticatedUser
      : never

type HandlerContext<
  TAuth extends AuthLevel,
  TSchema extends ZodType | undefined,
> = {
  request: NextRequest
} & (TAuth extends "none"
  ? object
  : { user: UserFor<TAuth> }) &
  (TSchema extends ZodType ? { body: z.infer<TSchema> } : object)

// --- Huvudfunktion ---

/**
 * Wrapper för API route handlers som centraliserar:
 * - Auth + rollkrav (via requireProvider/requireCustomer/requireAuth)
 * - Rate limiting (via rateLimiters)
 * - Feature flag-kontroll
 * - JSON-parsing + Zod-validering
 * - Standardiserad felhantering
 *
 * Ordning: auth -> rate limit -> feature flag -> body parse -> handler
 */
export function withApiHandler<
  TAuth extends AuthLevel = "any",
  TSchema extends ZodType | undefined = undefined,
>(
  config: HandlerConfig<TSchema> & { auth?: TAuth },
  handler: (ctx: HandlerContext<TAuth, TSchema>) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const ctx: Record<string, unknown> = { request }

      // 1. Auth (dual-auth: Bearer > NextAuth > Supabase)
      const authLevel = config.auth ?? "any"
      if (authLevel !== "none") {
        const authUser = await getAuthUser(request)
        const sessionLike = authUser
          ? {
              user: {
                id: authUser.id,
                email: authUser.email,
                userType: authUser.userType,
                isAdmin: authUser.isAdmin,
                providerId: authUser.providerId,
                stableId: authUser.stableId,
              },
            }
          : null
        if (authLevel === "provider") {
          ctx.user = requireProvider(sessionLike)
        } else if (authLevel === "customer") {
          ctx.user = requireCustomer(sessionLike)
        } else {
          ctx.user = requireAuth(sessionLike)
        }
      }

      // 2. Rate limiting
      if (config.rateLimit !== false) {
        const limiterKey = config.rateLimit ?? "api"
        const ip = getClientIP(request)
        try {
          const allowed = await rateLimiters[limiterKey](ip)
          if (!allowed) {
            return NextResponse.json(
              { error: "För många förfrågningar" },
              { status: 429 },
            )
          }
        } catch (error) {
          if (error instanceof RateLimitServiceError) {
            return NextResponse.json(
              { error: "Tjänsten är tillfälligt otillgänglig" },
              { status: 503 },
            )
          }
          throw error
        }
      }

      // 3. Feature flag
      if (config.featureFlag) {
        if (!(await isFeatureEnabled(config.featureFlag))) {
          return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
        }
      }

      // 4. Body parsing + Zod
      if (config.schema) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return NextResponse.json(
            { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
            { status: 400 },
          )
        }
        const result = config.schema.safeParse(raw)
        if (!result.success) {
          return NextResponse.json(
            { error: "Valideringsfel", details: result.error.issues },
            { status: 400 },
          )
        }
        ctx.body = result.data
      }

      // 5. Handler
      return await handler(ctx as HandlerContext<TAuth, TSchema>)
    } catch (error) {
      // Thrown Response (från requireAuth/requireProvider etc.)
      if (error instanceof Response) {
        return error as NextResponse
      }

      // Oväntat fel
      logger.error(
        "Unhandled API error",
        error instanceof Error ? error : new Error(String(error)),
      )
      return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
    }
  }
}

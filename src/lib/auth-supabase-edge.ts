/**
 * Edge-compatible Supabase cookie helper for middleware.
 *
 * Reads Supabase Auth cookies from the request and returns minimal user info
 * for middleware routing decisions (userType, isAdmin).
 *
 * IMPORTANT: This runs in Edge runtime -- no Prisma, no DB lookup.
 * Claims from Supabase JWT are trusted ONLY for routing in middleware.
 * Full DB verification happens in getAuthUser() in API routes.
 */
import { createServerClient } from "@supabase/ssr"
import { type NextRequest } from "next/server"

export interface SupabaseEdgeUser {
  id: string
  email: string
  userType: string
  isAdmin: boolean
}

/**
 * Extract Supabase user from cookies in an Edge-compatible way.
 * Returns null if no valid Supabase session exists.
 */
export async function getSupabaseUserFromCookie(
  request: NextRequest
): Promise<SupabaseEdgeUser | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // Middleware cannot set cookies on the request -- token refresh
            // is handled by the response middleware or API route.
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    const appMetadata = user.app_metadata ?? {}

    return {
      id: user.id,
      email: user.email ?? "",
      userType: (appMetadata.userType as string) ?? "customer",
      isAdmin: (appMetadata.isAdmin as boolean) ?? false,
    }
  } catch {
    return null
  }
}

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { NextResponse } from "next/server"

/**
 * Verify that the session user is an admin.
 * Throws a Response (401/403) if not authorized.
 *
 * Usage in API routes:
 * ```
 * const admin = await requireAdmin(session)
 * ```
 */
export async function requireAdmin(
  session: { user?: { id?: string } } | null
): Promise<{ id: string; isAdmin: boolean }> {
  if (!session?.user?.id) {
    throw NextResponse.json(
      { error: "Ej inloggad" },
      { status: 401 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true },
  })

  if (!user?.isAdmin) {
    logger.security("Non-admin attempted admin access", "medium", {
      userId: session.user.id,
    })
    throw NextResponse.json(
      { error: "Åtkomst nekad" },
      { status: 403 }
    )
  }

  return user
}

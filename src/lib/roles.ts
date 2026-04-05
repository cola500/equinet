import { NextResponse } from "next/server"

// --- Roll-konstanter ---

export const ROLES = {
  PROVIDER: "provider",
  CUSTOMER: "customer",
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// --- Session-typ ---

interface SessionLike {
  user?: {
    id?: string
    email?: string
    name?: string
    userType?: string
    isAdmin?: boolean
    providerId?: string | null
    stableId?: string | null
  }
}

// --- Returtyper ---

export interface AuthenticatedUser {
  userId: string
  email: string
  userType: string
  isAdmin: boolean
}

export interface ProviderUser extends AuthenticatedUser {
  userType: "provider"
  providerId: string
}

export interface CustomerUser extends AuthenticatedUser {
  userType: "customer"
}

export interface AdminUser extends AuthenticatedUser {
  isAdmin: true
}

// --- Guard-funktioner ---

/**
 * Kräver inloggad användare. Kastar Response(401) om ej inloggad.
 *
 * Obs: auth() i auth-server.ts kastar redan vid saknad session,
 * men denna funktion fungerar som extra säkerhet och ger typsäker retur.
 */
export function requireAuth(session: SessionLike | null): AuthenticatedUser {
  if (!session?.user?.id) {
    throw NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    userType: session.user.userType ?? "",
    isAdmin: session.user.isAdmin === true,
  }
}

/**
 * Kräver inloggad leverantör med providerId.
 * Kastar 401 om ej inloggad, 403 om fel roll eller saknad profil.
 */
export function requireProvider(session: SessionLike | null): ProviderUser {
  const user = requireAuth(session)

  if (user.userType !== ROLES.PROVIDER) {
    throw NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
  }

  const providerId = session!.user!.providerId
  if (!providerId) {
    throw NextResponse.json(
      { error: "Leverantörsprofil saknas" },
      { status: 403 }
    )
  }

  return { ...user, userType: "provider", providerId }
}

/**
 * Kräver inloggad kund.
 * Kastar 401 om ej inloggad, 403 om fel roll.
 */
export function requireCustomer(session: SessionLike | null): CustomerUser {
  const user = requireAuth(session)

  if (user.userType !== ROLES.CUSTOMER) {
    throw NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
  }

  return { ...user, userType: "customer" }
}

/** Max admin session age in seconds (15 minutes) */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 15 * 60

/**
 * Kräver inloggad admin.
 * Kastar 401 om ej inloggad eller session för gammal, 403 om ej admin.
 *
 * NOTE: This checks the session-level isAdmin flag. For full DB-verified
 * admin check, withApiHandler also calls enrichFromDatabase() via getAuthUser()
 * which always reads isAdmin from the database.
 *
 * @param tokenIssuedAt - Unix timestamp (seconds) from JWT `iat` claim.
 *   If provided, enforces a 15-minute session timeout for admin operations.
 *   If undefined, timeout check is skipped (caller couldn't extract iat).
 */
export function requireAdminRole(
  session: SessionLike | null,
  tokenIssuedAt?: number,
): AdminUser {
  const user = requireAuth(session)

  if (!user.isAdmin) {
    throw NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
  }

  // Enforce shorter session timeout for admin
  if (tokenIssuedAt) {
    const ageSeconds = Math.floor(Date.now() / 1000) - tokenIssuedAt
    if (ageSeconds > ADMIN_SESSION_MAX_AGE_SECONDS) {
      throw NextResponse.json(
        { error: "Admin-session utgången, logga in igen" },
        { status: 401 },
      )
    }
  }

  return { ...user, isAdmin: true }
}

import { NextResponse } from "next/server"

// --- Roll-konstanter ---

export const ROLES = {
  PROVIDER: "provider",
  CUSTOMER: "customer",
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// --- Session-typ (matchar next-auth Session.user) ---

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

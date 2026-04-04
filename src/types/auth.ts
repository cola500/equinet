/**
 * SessionUser - Type for session.user with provider-specific fields.
 *
 * Used with type assertions (e.g. `session.user as SessionUser`) where
 * TypeScript cannot infer the full session user type.
 */
export interface SessionUser {
  id: string
  email: string
  name: string
  userType: string
  isAdmin?: boolean
  providerId?: string | null
}

/**
 * SessionUser - Type for session.user with provider-specific fields.
 *
 * Mirrors the next-auth Session.user declaration in next-auth.d.ts,
 * but as a plain interface that can be imported and used with type assertions
 * (e.g. `session.user as SessionUser`) where TypeScript cannot infer
 * the augmented Session type.
 */
export interface SessionUser {
  id: string
  email: string
  name: string
  userType: string
  isAdmin?: boolean
  providerId?: string | null
}

/**
 * Maps AuthError types to HTTP status codes.
 * Shared by all auth routes (DRY -- not duplicated per route).
 *
 * Security note: Token errors return 400 (not 404) to avoid
 * revealing token existence to attackers.
 */
import type { AuthError } from './AuthService'

export function mapAuthErrorToStatus(error: AuthError): number {
  switch (error.type) {
    case 'EMAIL_ALREADY_EXISTS':
    case 'TOKEN_NOT_FOUND':
    case 'TOKEN_ALREADY_USED':
    case 'TOKEN_EXPIRED':
      return 400
    case 'INVALID_CREDENTIALS':
      return 401
    case 'EMAIL_NOT_VERIFIED':
      return 403
    default:
      return 500
  }
}

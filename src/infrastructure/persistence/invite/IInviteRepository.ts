/**
 * IInviteRepository - Repository interface for customer invite tokens
 *
 * Handles creation, lookup, invalidation, and acceptance of invite tokens
 * that allow ghost users to upgrade to real accounts.
 */

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface CreateInviteTokenData {
  token: string
  userId: string
  invitedByProviderId: string
  expiresAt: Date
}

export interface InviteTokenWithUser {
  id: string
  token: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  userEmail: string
  userFirstName: string
  isManualCustomer: boolean
}

// -----------------------------------------------------------
// Interface
// -----------------------------------------------------------

export interface IInviteRepository {
  /**
   * Create an invite token for a ghost user
   */
  createInviteToken(data: CreateInviteTokenData): Promise<void>

  /**
   * Find an invite token by token string (with user info)
   */
  findInviteToken(token: string): Promise<InviteTokenWithUser | null>

  /**
   * Invalidate all pending (unused) invite tokens for a user
   */
  invalidatePendingInvites(userId: string): Promise<void>

  /**
   * Accept an invite: atomically update user (passwordHash, isManualCustomer=false,
   * emailVerified=true) and mark token as used.
   */
  acceptInvite(tokenId: string, userId: string, passwordHash: string): Promise<void>
}

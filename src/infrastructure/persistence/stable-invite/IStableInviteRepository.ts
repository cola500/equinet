/**
 * IStableInviteRepository - Repository interface for stable invite tokens
 *
 * Handles creation, lookup, invalidation, and acceptance of invite tokens
 * that allow stable owners to invite horse owners to the platform.
 */

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface CreateStableInviteData {
  token: string
  email: string
  stableId: string
  expiresAt: Date
}

export interface StableInviteTokenWithStable {
  id: string
  token: string
  email: string
  stableId: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
  stableName: string
  stableMunicipality: string | null
}

export interface StableInviteListItem {
  id: string
  email: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

// -----------------------------------------------------------
// Interface
// -----------------------------------------------------------

export interface IStableInviteRepository {
  /**
   * Create an invite token for a stable
   */
  create(data: CreateStableInviteData): Promise<void>

  /**
   * Find an invite token by token string (with stable info)
   */
  findByToken(token: string): Promise<StableInviteTokenWithStable | null>

  /**
   * List all invites for a stable (ordered by newest first)
   */
  findByStableId(stableId: string): Promise<StableInviteListItem[]>

  /**
   * Invalidate all pending (unused) invite tokens for an email+stable combo
   */
  invalidatePending(email: string, stableId: string): Promise<void>

  /**
   * Mark a token as used
   */
  markUsed(tokenId: string): Promise<void>

  /**
   * Revoke an invite (soft-delete by marking as used).
   * Verifies ownership via stableId in WHERE clause.
   * Returns true if a matching invite was found and revoked.
   */
  revoke(id: string, stableId: string): Promise<boolean>
}

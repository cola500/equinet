/**
 * IAuthRepository - Repository interface for Auth domain
 *
 * Handles user registration, email verification, and token management.
 * Domain layer depends on this interface, not the implementation.
 * Passwords are handled by Supabase Auth -- not stored in public.User.
 */

// -----------------------------------------------------------
// Types -- safe projections
// -----------------------------------------------------------

/** Safe user data */
export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  userType: string
}

/** Minimal user data for resend-verification */
export interface UserForResend {
  id: string
  firstName: string
  email: string
  emailVerified: boolean
}

/** Verification token with user email (for verify-email response) */
export interface VerificationTokenWithUser {
  id: string
  token: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  userEmail: string
}

// -----------------------------------------------------------
// DTOs -- data for creation
// -----------------------------------------------------------

export interface CreateUserData {
  id?: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  userType: string
}

export interface CreateProviderData {
  userId: string
  businessName: string
  description?: string
  city?: string
}

export interface CreateVerificationTokenData {
  token: string
  userId: string
  expiresAt: Date
}

// -----------------------------------------------------------
// Interface
// -----------------------------------------------------------

/** Password reset token with user info */
export interface PasswordResetTokenWithUser {
  id: string
  token: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  userEmail: string
  userFirstName: string
}

export interface CreatePasswordResetTokenData {
  token: string
  userId: string
  expiresAt: Date
}

/** Data for upgrading a ghost user to a real account */
export interface UpgradeGhostUserData {
  userId: string
  firstName: string
  lastName: string
  phone?: string
}

/** Customer invite token with user info (for accept-invite flow) */
export interface CustomerInviteTokenWithUser {
  id: string
  token: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  userEmail: string
  userFirstName: string
}

export interface IAuthRepository {
  /**
   * Find user by email (returns id + ghost status for duplicate/upgrade check)
   */
  findUserByEmail(email: string): Promise<{ id: string; isManualCustomer: boolean } | null>

  /**
   * Upgrade a ghost user to a real account (in-place update).
   * Sets isManualCustomer=false and updates profile fields.
   */
  upgradeGhostUser(data: UpgradeGhostUserData): Promise<AuthUser>

  /**
   * Find user for resend-verification (minimal projection)
   */
  findUserForResend(email: string): Promise<UserForResend | null>

  /**
   * Create a new user (returns safe projection)
   */
  createUser(data: CreateUserData): Promise<AuthUser>

  /**
   * Create a provider profile
   */
  createProvider(data: CreateProviderData): Promise<void>

  /**
   * Create an email verification token
   */
  createVerificationToken(data: CreateVerificationTokenData): Promise<void>

  /**
   * Find verification token by token string (with user email)
   */
  findVerificationToken(token: string): Promise<VerificationTokenWithUser | null>

  /**
   * Verify email: atomically set emailVerified=true and mark token as used.
   * Uses $transaction for consistency.
   */
  verifyEmail(userId: string, tokenId: string): Promise<void>

  // -----------------------------------------------------------
  // Password reset
  // -----------------------------------------------------------

  /**
   * Create a password reset token
   */
  createPasswordResetToken(data: CreatePasswordResetTokenData): Promise<void>

  /**
   * Find password reset token by token string (with user info)
   */
  findPasswordResetToken(token: string): Promise<PasswordResetTokenWithUser | null>

  /**
   * Invalidate all existing reset tokens for a user (set usedAt)
   */
  invalidatePasswordResetTokens(userId: string): Promise<void>

  /**
   * Mark a password reset token as used.
   * Actual password update happens via Supabase Auth admin API.
   */
  markResetTokenUsed(tokenId: string): Promise<void>

  /**
   * Update userType for a user (e.g., after Supabase signup + provider creation).
   */
  updateUserType(userId: string, userType: 'customer' | 'provider'): Promise<void>

  // -----------------------------------------------------------
  // Customer invite
  // -----------------------------------------------------------

  /**
   * Find customer invite token by token string (with user info)
   */
  findCustomerInviteToken(token: string): Promise<CustomerInviteTokenWithUser | null>

  /**
   * Accept invite: atomically upgrade user (isManualCustomer=false, emailVerified=true)
   * and mark token as used. Analogous to verifyEmail.
   */
  acceptInvite(userId: string, tokenId: string): Promise<void>

  /**
   * Execute the full 11-step ghost merge transaction atomically.
   * Redirects all data from ghost to real user, then deletes the ghost.
   * requestingProviderId is needed to correctly handle ProviderCustomer links.
   */
  executeMergeTransaction(ghostUserId: string, realUserId: string, requestingProviderId: string): Promise<void>
}

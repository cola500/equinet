/**
 * StableInviteService - Domain service for stable invitations
 *
 * Handles creating, validating, and accepting stable invite tokens.
 * Constructor injection for testability.
 */
import { randomBytes } from "crypto"
import { Result } from "@/domain/shared"
import type {
  IStableInviteRepository,
  StableInviteTokenWithStable,
  StableInviteListItem,
} from "@/infrastructure/persistence/stable-invite/IStableInviteRepository"

export type StableInviteError =
  | "TOKEN_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "TOKEN_USED"

const EXPIRY_DAYS = 7

interface CreateInviteResult {
  token: string
  expiresAt: Date
}

interface AcceptInviteResult {
  stableId: string
  stableName: string
}

export class StableInviteService {
  constructor(private readonly repo: IStableInviteRepository) {}

  async createInvite(
    stableId: string,
    email: string
  ): Promise<Result<CreateInviteResult, StableInviteError>> {
    // Invalidate old pending invites for same email+stable
    await this.repo.invalidatePending(email, stableId)

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    await this.repo.create({ token, email, stableId, expiresAt })

    return Result.ok({ token, expiresAt })
  }

  async validateToken(
    token: string
  ): Promise<Result<StableInviteTokenWithStable, StableInviteError>> {
    const invite = await this.repo.findByToken(token)

    if (!invite) {
      return Result.fail("TOKEN_NOT_FOUND")
    }

    if (invite.usedAt) {
      return Result.fail("TOKEN_USED")
    }

    if (invite.expiresAt < new Date()) {
      return Result.fail("TOKEN_EXPIRED")
    }

    return Result.ok(invite)
  }

  async acceptInvite(
    token: string
  ): Promise<Result<AcceptInviteResult, StableInviteError>> {
    const validation = await this.validateToken(token)
    if (validation.isFailure) {
      return Result.fail(validation.error)
    }

    const invite = validation.value
    await this.repo.markUsed(invite.id)

    return Result.ok({
      stableId: invite.stableId,
      stableName: invite.stableName,
    })
  }

  async listInvites(stableId: string): Promise<StableInviteListItem[]> {
    return this.repo.findByStableId(stableId)
  }

  async revokeInvite(id: string, stableId: string): Promise<boolean> {
    return this.repo.revoke(id, stableId)
  }
}

/**
 * GhostMergeService - Merges a ghost user's data into a real user account.
 *
 * This is an irreversible operation. All bookings, reviews, horses etc.
 * are redirected from the ghost user to the real user, and the ghost
 * user row is deleted.
 */
import { Result } from '@/domain/shared'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export type MergeErrorType =
  | 'GHOST_NOT_IN_REGISTER'
  | 'NOT_A_GHOST'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_IS_GHOST'
  | 'SAME_USER'

export interface MergeError {
  type: MergeErrorType
  message: string
}

export interface MergeResult {
  mergedInto: string
}

interface UserLookup {
  id: string
  isManualCustomer: boolean
  email: string
}

export interface GhostMergeServiceDeps {
  findProviderCustomerLink: (providerId: string, customerId: string) => Promise<{ id: string } | null>
  findUserById: (userId: string) => Promise<UserLookup | null>
  findUserByEmail: (email: string) => Promise<UserLookup | null>
  executeMergeTransaction: (ghostUserId: string, realUserId: string) => Promise<void>
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class GhostMergeService {
  private readonly deps: GhostMergeServiceDeps

  constructor(deps: GhostMergeServiceDeps) {
    this.deps = deps
  }

  async merge(
    ghostUserId: string,
    targetEmail: string,
    requestingProviderId: string
  ): Promise<Result<MergeResult, MergeError>> {
    // 1. IDOR check: ghost must be in provider's register
    const link = await this.deps.findProviderCustomerLink(requestingProviderId, ghostUserId)
    if (!link) {
      return Result.fail({
        type: 'GHOST_NOT_IN_REGISTER',
        message: 'Kunden finns inte i ditt kundregister',
      })
    }

    // 2. Verify ghost user exists and is actually a ghost
    const ghostUser = await this.deps.findUserById(ghostUserId)
    if (!ghostUser || !ghostUser.isManualCustomer) {
      return Result.fail({
        type: 'NOT_A_GHOST',
        message: 'Kunden är inte en manuellt tillagd kund',
      })
    }

    // 3. Find target real user
    const realUser = await this.deps.findUserByEmail(targetEmail)
    if (!realUser) {
      return Result.fail({
        type: 'TARGET_NOT_FOUND',
        message: 'Ingen användare hittades med den e-postadressen',
      })
    }

    // 4. Target must not be a ghost
    if (realUser.isManualCustomer) {
      return Result.fail({
        type: 'TARGET_IS_GHOST',
        message: 'Målkontot är också en manuellt tillagd kund',
      })
    }

    // 5. Prevent self-merge
    if (ghostUser.id === realUser.id) {
      return Result.fail({
        type: 'SAME_USER',
        message: 'Kan inte slå ihop en användare med sig själv',
      })
    }

    // 6. Execute merge transaction
    await this.deps.executeMergeTransaction(ghostUserId, realUser.id)

    return Result.ok({ mergedInto: realUser.id })
  }
}

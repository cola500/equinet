/**
 * @domain data-retention
 * @routes GET /api/cron/data-retention
 *
 * GDPR Art. 17 -- automated data retention for inactive accounts.
 * Finds users inactive for 2+ years, notifies, deletes after 30-day grace period.
 * Tracks notification state via Supabase app_metadata (no schema change needed).
 *
 * Limitations (MVP):
 * - app_metadata is not indexable -- O(N) scan of all auth users each run
 * - Acceptable for <10k users; revisit with DB table if user base grows
 */
import { logger } from "@/lib/logger"

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  last_sign_in_at: string | null
}

export interface PublicUser {
  id: string
  email: string
  isAdmin: boolean
  isManualCustomer: boolean
}

export interface InactiveUser {
  userId: string
  authId: string
  email: string
  lastSignInAt: Date
}

export interface RetentionResult {
  notified: number
  deleted: number
  skipped: number
  errors: number
}

export interface DataRetentionServiceDeps {
  listAuthUsers: () => Promise<AuthUser[]>
  findUserByEmail: (email: string) => Promise<PublicUser | null>
  getAppMetadata: (authId: string) => Promise<Record<string, unknown>>
  setAppMetadata: (authId: string, metadata: Record<string, unknown>) => Promise<void>
  sendRetentionWarning: (email: string) => Promise<void>
  deleteAccount: (userId: string) => Promise<{ deleted: boolean }>
}

// -----------------------------------------------------------
// Constants
// -----------------------------------------------------------

const INACTIVE_THRESHOLD_YEARS = 2
const GRACE_PERIOD_DAYS = 30

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class DataRetentionService {
  private readonly deps: DataRetentionServiceDeps

  constructor(deps: DataRetentionServiceDeps) {
    this.deps = deps
  }

  async findInactiveUsers(): Promise<InactiveUser[]> {
    const allAuthUsers = await this.deps.listAuthUsers()
    const thresholdDate = new Date()
    thresholdDate.setFullYear(thresholdDate.getFullYear() - INACTIVE_THRESHOLD_YEARS)

    const inactiveUsers: InactiveUser[] = []

    for (const authUser of allAuthUsers) {
      if (!authUser.last_sign_in_at) continue

      const lastSignIn = new Date(authUser.last_sign_in_at)
      if (lastSignIn >= thresholdDate) continue

      const publicUser = await this.deps.findUserByEmail(authUser.email)
      if (!publicUser) continue
      if (publicUser.isAdmin) continue
      if (publicUser.isManualCustomer) continue

      inactiveUsers.push({
        userId: publicUser.id,
        authId: authUser.id,
        email: authUser.email,
        lastSignInAt: lastSignIn,
      })
    }

    return inactiveUsers
  }

  async processRetention(): Promise<RetentionResult> {
    const result: RetentionResult = { notified: 0, deleted: 0, skipped: 0, errors: 0 }

    const inactiveUsers = await this.findInactiveUsers()

    for (const user of inactiveUsers) {
      try {
        const metadata = await this.deps.getAppMetadata(user.authId)
        const notifiedAt = metadata.data_retention_notified_at as string | undefined

        if (!notifiedAt) {
          // Not yet notified -- send warning
          await this.deps.sendRetentionWarning(user.email)
          await this.deps.setAppMetadata(user.authId, {
            ...metadata,
            data_retention_notified_at: new Date().toISOString(),
          })
          result.notified++
          logger.info("Data retention: notified inactive user", { email: user.email })
        } else {
          // Guard: if notification was sent BEFORE the user's last sign-in,
          // the user logged in during grace period -- clear stale notice
          if (new Date(notifiedAt) < user.lastSignInAt) {
            await this.deps.setAppMetadata(user.authId, {
              ...metadata,
              data_retention_notified_at: undefined,
            })
            result.skipped++
            logger.info("Data retention: cleared stale notice (user logged in after notification)", { email: user.email })
            continue
          }

          // Check if grace period has passed
          const notifiedDate = new Date(notifiedAt)
          const gracePeriodEnd = new Date(notifiedDate)
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS)

          if (new Date() >= gracePeriodEnd) {
            // Grace period expired -- delete
            const deleteResult = await this.deps.deleteAccount(user.userId)
            if (deleteResult.deleted) {
              result.deleted++
            } else {
              result.errors++
            }
            logger.security("Data retention: deleted inactive account (GDPR Art. 17)", "high", {
              userId: user.userId,
              email: user.email,
              lastSignIn: user.lastSignInAt.toISOString(),
            })
          } else {
            // Still within grace period
            result.skipped++
          }
        }
      } catch (error) {
        result.errors++
        logger.error("Data retention: error processing user", {
          userId: user.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createDataRetentionService(): DataRetentionService {
  // Lazy imports to avoid server-only module issues in tests
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createSupabaseAdminClient } = require("@/lib/supabase/admin")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("@/lib/prisma")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAccountDeletionService } = require("@/domain/account/AccountDeletionService")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sendDataRetentionWarning } = require("@/lib/email")

  const supabase = createSupabaseAdminClient()
  const accountDeletionService = createAccountDeletionService()

  return new DataRetentionService({
    listAuthUsers: async () => {
      const allUsers: AuthUser[] = []
      let page = 1
      const perPage = 100

      while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        })

        if (error) {
          throw new Error(`Failed to list auth users: ${error.message}`)
        }

        allUsers.push(
          ...data.users.map((u: { id: string; email?: string; last_sign_in_at?: string }) => ({
            id: u.id,
            email: u.email ?? "",
            last_sign_in_at: u.last_sign_in_at ?? null,
          }))
        )

        if (data.users.length < perPage) break
        page++
      }

      return allUsers
    },

    findUserByEmail: async (email) => {
      return prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          isAdmin: true,
          isManualCustomer: true,
        },
      })
    },

    getAppMetadata: async (authId) => {
      const { data, error } = await supabase.auth.admin.getUserById(authId)
      if (error) throw new Error(`Failed to get user metadata: ${error.message}`)
      return (data.user.app_metadata as Record<string, unknown>) ?? {}
    },

    setAppMetadata: async (authId, metadata) => {
      const { error } = await supabase.auth.admin.updateUserById(authId, {
        app_metadata: metadata,
      })
      if (error) throw new Error(`Failed to set app metadata: ${error.message}`)
    },

    sendRetentionWarning: async (email) => {
      await sendDataRetentionWarning(email)
    },

    deleteAccount: async (userId) => {
      // System-initiated deletion via AccountDeletionService.deleteAccountBySystem()
      const result = await accountDeletionService.deleteAccountBySystem(userId)

      if (result.isFailure) {
        logger.warn("Data retention: could not delete account", {
          userId,
          error: result.error.message,
        })
        return { deleted: false }
      }

      return { deleted: true }
    },
  })
}

/**
 * @domain auth
 * @consumers POST /api/provider/customers/[customerId]/merge
 */
import { prisma } from '@/lib/prisma'
import { PrismaAuthRepository } from '@/infrastructure/persistence/auth/PrismaAuthRepository'
import { GhostMergeService } from './GhostMergeService'

/**
 * Creates a GhostMergeService wired with Prisma-backed dependencies.
 * requestingProviderId is curried into executeMergeTransaction for ProviderCustomer handling.
 */
export function createGhostMergeService(requestingProviderId: string): GhostMergeService {
  const repo = new PrismaAuthRepository()

  return new GhostMergeService({
    findProviderCustomerLink: (pId, cId) =>
      prisma.providerCustomer.findUnique({
        where: { providerId_customerId: { providerId: pId, customerId: cId } },
        select: { providerId: true },
      }).then((link) => (link ? { id: link.providerId } : null)),

    findUserById: (userId) =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, isManualCustomer: true },
      }),

    findUserByEmail: (email) =>
      prisma.user.findFirst({
        where: { email },
        select: { id: true, email: true, isManualCustomer: true },
      }),

    executeMergeTransaction: (ghostId, realId) =>
      repo.executeMergeTransaction(ghostId, realId, requestingProviderId),
  })
}

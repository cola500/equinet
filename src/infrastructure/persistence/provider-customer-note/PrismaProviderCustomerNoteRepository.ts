/**
 * PrismaProviderCustomerNoteRepository - Prisma implementation
 *
 * Uses `select` (never `include`) to prevent PII leaks.
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IProviderCustomerNoteRepository,
  ProviderCustomerNote,
  CreateProviderCustomerNoteData,
} from './IProviderCustomerNoteRepository'

const noteSelect = {
  id: true,
  providerId: true,
  customerId: true,
  content: true,
  createdAt: true,
} satisfies Prisma.ProviderCustomerNoteSelect

export class PrismaProviderCustomerNoteRepository implements IProviderCustomerNoteRepository {
  async findByProviderAndCustomer(providerId: string, customerId: string): Promise<ProviderCustomerNote[]> {
    return prisma.providerCustomerNote.findMany({
      where: { providerId, customerId },
      select: noteSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(data: CreateProviderCustomerNoteData): Promise<ProviderCustomerNote> {
    return prisma.providerCustomerNote.create({
      data: {
        providerId: data.providerId,
        customerId: data.customerId,
        content: data.content,
      },
      select: noteSelect,
    })
  }

  async deleteWithAuth(id: string, providerId: string): Promise<boolean> {
    try {
      // Atomic: WHERE { id, providerId } ensures IDOR protection
      await prisma.providerCustomerNote.delete({
        where: { id, providerId },
      })
      return true
    } catch {
      // Record not found or not owned
      return false
    }
  }
}

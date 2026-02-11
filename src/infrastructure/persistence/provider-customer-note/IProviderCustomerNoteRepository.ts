/**
 * IProviderCustomerNoteRepository - Repository interface for ProviderCustomerNote
 *
 * Provider's private journal notes about customers.
 * Immutable: create + delete only, no edits.
 */

// Core entity (maps to Prisma schema)
export interface ProviderCustomerNote {
  id: string
  providerId: string
  customerId: string
  content: string
  createdAt: Date
}

// Data needed to create a note
export interface CreateProviderCustomerNoteData {
  providerId: string
  customerId: string
  content: string
}

export interface IProviderCustomerNoteRepository {
  /**
   * Find all notes for a specific provider-customer pair (newest first)
   */
  findByProviderAndCustomer(providerId: string, customerId: string): Promise<ProviderCustomerNote[]>

  /**
   * Create a new note
   */
  create(data: CreateProviderCustomerNoteData): Promise<ProviderCustomerNote>

  /**
   * Delete a note -- only if it belongs to the given provider (IDOR protection)
   * Returns true if deleted, false if not found or not owned
   */
  deleteWithAuth(id: string, providerId: string): Promise<boolean>
}

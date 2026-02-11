/**
 * MockProviderCustomerNoteRepository - In-memory implementation for testing
 */
import type {
  IProviderCustomerNoteRepository,
  ProviderCustomerNote,
  CreateProviderCustomerNoteData,
} from './IProviderCustomerNoteRepository'

export class MockProviderCustomerNoteRepository implements IProviderCustomerNoteRepository {
  private notes: Map<string, ProviderCustomerNote> = new Map()

  async findByProviderAndCustomer(providerId: string, customerId: string): Promise<ProviderCustomerNote[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.providerId === providerId && n.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async create(data: CreateProviderCustomerNoteData): Promise<ProviderCustomerNote> {
    const now = new Date()
    const note: ProviderCustomerNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      providerId: data.providerId,
      customerId: data.customerId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    }
    this.notes.set(note.id, note)
    return note
  }

  async updateWithAuth(id: string, providerId: string, content: string): Promise<ProviderCustomerNote | null> {
    const note = this.notes.get(id)
    if (!note || note.providerId !== providerId) return null
    const updated: ProviderCustomerNote = { ...note, content, updatedAt: new Date() }
    this.notes.set(id, updated)
    return updated
  }

  async deleteWithAuth(id: string, providerId: string): Promise<boolean> {
    const note = this.notes.get(id)
    if (!note || note.providerId !== providerId) return false
    this.notes.delete(id)
    return true
  }

  // Test helpers
  clear(): void {
    this.notes.clear()
  }

  seed(notes: ProviderCustomerNote[]): void {
    for (const note of notes) {
      this.notes.set(note.id, note)
    }
  }
}

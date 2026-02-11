import { describe, it, expect, beforeEach } from 'vitest'
import { ProviderCustomerNoteService } from './ProviderCustomerNoteService'
import { MockProviderCustomerNoteRepository } from '@/infrastructure/persistence/provider-customer-note/MockProviderCustomerNoteRepository'

describe('ProviderCustomerNoteService', () => {
  let noteRepo: MockProviderCustomerNoteRepository
  let service: ProviderCustomerNoteService
  let hasCompletedBooking: boolean

  beforeEach(() => {
    noteRepo = new MockProviderCustomerNoteRepository()
    hasCompletedBooking = true

    service = new ProviderCustomerNoteService({
      noteRepository: noteRepo,
      hasCompletedBookingWith: async () => hasCompletedBooking,
    })
  })

  // -----------------------------------------------------------
  // createNote
  // -----------------------------------------------------------
  describe('createNote', () => {
    it('should fail if provider has no completed booking with customer', async () => {
      hasCompletedBooking = false

      const result = await service.createNote({
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: 'Test note',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NO_BOOKING_RELATION')
    })

    it('should create note when provider has completed booking with customer', async () => {
      const result = await service.createNote({
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: 'Behöver extra tid vid besök',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.providerId).toBe('provider-1')
      expect(result.value.customerId).toBe('customer-1')
      expect(result.value.content).toBe('Behöver extra tid vid besök')
    })

    it('should sanitize content (strip XSS)', async () => {
      const result = await service.createNote({
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: '<script>alert("xss")</script>Normal text\nNew line',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.content).not.toContain('<script>')
      expect(result.value.content).toContain('Normal text')
      expect(result.value.content).toContain('\n')
    })

    it('should fail if content is empty after sanitization', async () => {
      const result = await service.createNote({
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: '   ',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('EMPTY_CONTENT')
    })
  })

  // -----------------------------------------------------------
  // deleteNote
  // -----------------------------------------------------------
  describe('deleteNote', () => {
    it('should fail if note does not exist', async () => {
      const result = await service.deleteNote({
        noteId: 'nonexistent',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NOT_FOUND')
    })

    it('should fail if note belongs to another provider', async () => {
      // Seed a note owned by a different provider
      noteRepo.seed([{
        id: 'note-1',
        providerId: 'other-provider',
        customerId: 'customer-1',
        content: 'Some note',
        createdAt: new Date(),
      }])

      const result = await service.deleteNote({
        noteId: 'note-1',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NOT_FOUND')
    })

    it('should delete note owned by the provider', async () => {
      noteRepo.seed([{
        id: 'note-1',
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: 'Will be deleted',
        createdAt: new Date(),
      }])

      const result = await service.deleteNote({
        noteId: 'note-1',
        providerId: 'provider-1',
      })

      expect(result.isSuccess).toBe(true)

      // Verify it's gone
      const notes = await noteRepo.findByProviderAndCustomer('provider-1', 'customer-1')
      expect(notes).toHaveLength(0)
    })
  })
})

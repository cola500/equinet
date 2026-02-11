/**
 * ProviderCustomerNoteService - Domain service for provider customer notes
 *
 * Business rules:
 * - Provider must have at least one completed booking with the customer
 * - Content is sanitized (XSS stripped, multiline preserved)
 * - Immutable: create + delete only
 */
import { Result } from '@/domain/shared'
import { sanitizeMultilineString } from '@/lib/sanitize'
import { stripXss } from '@/lib/sanitize'
import type {
  IProviderCustomerNoteRepository,
  ProviderCustomerNote,
} from '@/infrastructure/persistence/provider-customer-note/IProviderCustomerNoteRepository'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface ProviderCustomerNoteServiceDeps {
  noteRepository: IProviderCustomerNoteRepository
  hasCompletedBookingWith: (providerId: string, customerId: string) => Promise<boolean>
}

export interface CreateNoteInput {
  providerId: string
  customerId: string
  content: string
}

export interface DeleteNoteInput {
  noteId: string
  providerId: string
}

export type NoteErrorType =
  | 'NO_BOOKING_RELATION'
  | 'EMPTY_CONTENT'
  | 'NOT_FOUND'

export interface NoteError {
  type: NoteErrorType
  message: string
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class ProviderCustomerNoteService {
  private readonly noteRepo: IProviderCustomerNoteRepository
  private readonly hasCompletedBookingWith: ProviderCustomerNoteServiceDeps['hasCompletedBookingWith']

  constructor(deps: ProviderCustomerNoteServiceDeps) {
    this.noteRepo = deps.noteRepository
    this.hasCompletedBookingWith = deps.hasCompletedBookingWith
  }

  async createNote(input: CreateNoteInput): Promise<Result<ProviderCustomerNote, NoteError>> {
    // 1. Business rule: provider must have completed booking with this customer
    const hasRelation = await this.hasCompletedBookingWith(input.providerId, input.customerId)
    if (!hasRelation) {
      return Result.fail({
        type: 'NO_BOOKING_RELATION',
        message: 'Provider must have a completed booking with this customer',
      })
    }

    // 2. Sanitize content
    const sanitized = sanitizeMultilineString(stripXss(input.content))
    if (!sanitized) {
      return Result.fail({
        type: 'EMPTY_CONTENT',
        message: 'Note content cannot be empty',
      })
    }

    // 3. Create note
    const note = await this.noteRepo.create({
      providerId: input.providerId,
      customerId: input.customerId,
      content: sanitized,
    })

    return Result.ok(note)
  }

  async deleteNote(input: DeleteNoteInput): Promise<Result<void, NoteError>> {
    // Atomic: deleteWithAuth checks ownership in WHERE clause
    const deleted = await this.noteRepo.deleteWithAuth(input.noteId, input.providerId)
    if (!deleted) {
      return Result.fail({
        type: 'NOT_FOUND',
        message: 'Note not found or not owned by this provider',
      })
    }

    return Result.ok(undefined as void)
  }
}

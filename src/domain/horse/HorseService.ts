/**
 * HorseService - Domain service for Horse aggregate
 *
 * Contains business rules for horse management, notes, timeline access control,
 * export, and profile token generation.
 * Uses Result pattern for explicit error handling.
 */
import { Result } from '@/domain/shared'
import { randomBytes } from 'crypto'
import {
  mergeTimeline,
  type TimelineBooking,
  type TimelineNote,
  type TimelineItem,
} from '@/lib/timeline'
import type {
  IHorseRepository,
  Horse,
  HorseWithBookings,
  HorseNoteWithAuthor,
  CreateHorseData,
  UpdateHorseData,
  CreateNoteData,
  UpdateNoteData,
  TimelineNoteData,
  ExportBookingData,
} from '@/infrastructure/persistence/horse/IHorseRepository'
import { HorseRepository } from '@/infrastructure/persistence/horse/HorseRepository'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export type HorseErrorType =
  | 'HORSE_NOT_FOUND'
  | 'NOTE_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'NO_PROVIDER_ACCESS'

export interface HorseError {
  type: HorseErrorType
  message: string
}

export interface HorseServiceDeps {
  horseRepository: IHorseRepository
}

// Categories visible to providers (privacy: exclude general/injury)
const PROVIDER_VISIBLE_CATEGORIES = ['veterinary', 'farrier', 'medication']

const PROFILE_EXPIRY_DAYS = 30

export interface TimelineResult {
  timeline: TimelineItem[]
}

export interface ExportResult {
  horse: {
    name: string
    breed: string | null
    birthYear: number | null
    color: string | null
    gender: string | null
    specialNeeds: string | null
    registrationNumber: string | null
    microchipNumber: string | null
  }
  bookings: ExportBookingData[]
  notes: TimelineNoteData[]
  timeline: TimelineItem[]
}

export interface ProfileResult {
  token: string
  expiresAt: Date
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class HorseService {
  private readonly repo: IHorseRepository

  constructor(deps: HorseServiceDeps) {
    this.repo = deps.horseRepository
  }

  // ==========================================
  // HORSE CRUD
  // ==========================================

  async listHorses(ownerId: string): Promise<Result<Horse[], HorseError>> {
    const horses = await this.repo.findByOwnerId(ownerId)
    return Result.ok(horses)
  }

  async getHorse(id: string, ownerId: string): Promise<Result<HorseWithBookings, HorseError>> {
    const horse = await this.repo.findByIdWithBookings(id, ownerId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }
    return Result.ok(horse)
  }

  async createHorse(data: Omit<CreateHorseData, 'ownerId'>, ownerId: string): Promise<Result<Horse, HorseError>> {
    const horse = await this.repo.create({ ...data, ownerId })
    return Result.ok(horse)
  }

  async updateHorse(id: string, data: UpdateHorseData, ownerId: string): Promise<Result<Horse, HorseError>> {
    const updated = await this.repo.updateWithAuth(id, data, ownerId)
    if (!updated) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }
    return Result.ok(updated)
  }

  async softDeleteHorse(id: string, ownerId: string): Promise<Result<void, HorseError>> {
    const deleted = await this.repo.softDeleteWithAuth(id, ownerId)
    if (!deleted) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }
    return Result.ok(undefined as void)
  }

  // ==========================================
  // NOTE CRUD
  // ==========================================

  async listNotes(
    horseId: string,
    ownerId: string,
    category?: string
  ): Promise<Result<HorseNoteWithAuthor[], HorseError>> {
    // Verify horse ownership
    const horse = await this.repo.findByIdForOwner(horseId, ownerId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }

    const notes = await this.repo.findNotesByHorseId(horseId, category)
    return Result.ok(notes)
  }

  async createNote(
    horseId: string,
    data: Omit<CreateNoteData, 'horseId' | 'authorId'>,
    authorId: string
  ): Promise<Result<HorseNoteWithAuthor, HorseError>> {
    // Verify horse ownership
    const horse = await this.repo.findByIdForOwner(horseId, authorId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }

    const note = await this.repo.createNote({
      ...data,
      horseId,
      authorId,
    })
    return Result.ok(note)
  }

  async updateNote(
    horseId: string,
    noteId: string,
    data: UpdateNoteData,
    ownerId: string
  ): Promise<Result<HorseNoteWithAuthor, HorseError>> {
    // Verify horse ownership
    const horse = await this.repo.findByIdForOwner(horseId, ownerId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }

    // Verify note exists on this horse
    const existingNote = await this.repo.findNoteById(noteId, horseId)
    if (!existingNote) {
      return Result.fail({ type: 'NOTE_NOT_FOUND', message: 'Anteckningen hittades inte' })
    }

    const updated = await this.repo.updateNote(noteId, horseId, data)
    if (!updated) {
      return Result.fail({ type: 'NOTE_NOT_FOUND', message: 'Anteckningen hittades inte' })
    }

    return Result.ok(updated)
  }

  async deleteNote(
    horseId: string,
    noteId: string,
    ownerId: string
  ): Promise<Result<void, HorseError>> {
    // Verify horse ownership
    const horse = await this.repo.findByIdForOwner(horseId, ownerId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }

    // Verify note exists on this horse
    const existingNote = await this.repo.findNoteById(noteId, horseId)
    if (!existingNote) {
      return Result.fail({ type: 'NOTE_NOT_FOUND', message: 'Anteckningen hittades inte' })
    }

    await this.repo.deleteNote(noteId, horseId)
    return Result.ok(undefined as void)
  }

  // ==========================================
  // TIMELINE
  // ==========================================

  async getTimeline(
    horseId: string,
    userId: string,
    category?: string
  ): Promise<Result<TimelineItem[], HorseError>> {
    // 1. Check if user is the horse owner
    const ownedHorse = await this.repo.findByIdForOwner(horseId, userId)
    const isOwner = !!ownedHorse

    let isProviderWithAccess = false

    if (!isOwner) {
      // Check if horse exists at all
      const exists = await this.repo.existsAndActive(horseId)
      if (!exists) {
        return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
      }

      // Check if user's provider has a booking for this horse
      isProviderWithAccess = await this.repo.hasProviderBookingForHorse(horseId, userId)
      if (!isProviderWithAccess) {
        return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
      }
    }

    // 2. Fetch bookings
    const bookings = await this.repo.getTimelineBookings(horseId)

    // 3. Determine note categories
    let noteCategories: string[] | undefined
    if (isProviderWithAccess) {
      noteCategories = PROVIDER_VISIBLE_CATEGORIES
    }

    // If category filter specified, apply it
    if (category) {
      if (isProviderWithAccess && !PROVIDER_VISIBLE_CATEGORIES.includes(category)) {
        // Provider filtering by restricted category -- return empty notes
        noteCategories = [category]
      } else {
        noteCategories = [category]
      }
    }

    const notes = await this.repo.getTimelineNotes(horseId, noteCategories)

    // 4. Transform to timeline items
    const timelineBookings: TimelineBooking[] = bookings.map((b) => ({
      type: 'booking' as const,
      id: b.id,
      date: b.bookingDate instanceof Date ? b.bookingDate.toISOString() : String(b.bookingDate),
      title: b.service.name,
      providerName: b.provider.businessName,
      status: b.status,
      notes: b.customerNotes,
      providerNotes: isProviderWithAccess ? b.providerNotes : null,
    }))

    const timelineNotes: TimelineNote[] = notes.map((n) => ({
      type: 'note' as const,
      id: n.id,
      date: n.noteDate instanceof Date ? n.noteDate.toISOString() : String(n.noteDate),
      title: n.title,
      category: n.category,
      content: n.content,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
    }))

    // If category filter is applied, exclude bookings (they don't have categories)
    const filteredBookings = category ? [] : timelineBookings
    const timeline = mergeTimeline(filteredBookings, timelineNotes)

    return Result.ok(timeline)
  }

  // ==========================================
  // EXPORT
  // ==========================================

  async exportData(
    horseId: string,
    ownerId: string
  ): Promise<Result<ExportResult, HorseError>> {
    const horse = await this.repo.findByIdForOwner(horseId, ownerId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }

    const bookings = await this.repo.getExportBookings(horseId)
    const notes = await this.repo.getExportNotes(horseId)

    // Build timeline (export = owner view, no providerNotes)
    const timelineBookings: TimelineBooking[] = bookings.map((b) => ({
      type: 'booking' as const,
      id: b.id,
      date: b.bookingDate instanceof Date ? b.bookingDate.toISOString() : String(b.bookingDate),
      title: b.service.name,
      providerName: b.provider.businessName,
      status: b.status,
      notes: b.customerNotes,
      providerNotes: null,
    }))

    const timelineNotes: TimelineNote[] = notes.map((n) => ({
      type: 'note' as const,
      id: n.id,
      date: n.noteDate instanceof Date ? n.noteDate.toISOString() : String(n.noteDate),
      title: n.title,
      category: n.category,
      content: n.content,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
    }))

    const timeline = mergeTimeline(timelineBookings, timelineNotes)

    return Result.ok({
      horse: {
        name: horse.name,
        breed: horse.breed,
        birthYear: horse.birthYear,
        color: horse.color,
        gender: horse.gender,
        specialNeeds: horse.specialNeeds,
        registrationNumber: horse.registrationNumber,
        microchipNumber: horse.microchipNumber,
      },
      bookings,
      notes,
      timeline,
    })
  }

  // ==========================================
  // PROFILE TOKEN
  // ==========================================

  async createProfileToken(
    horseId: string,
    ownerId: string
  ): Promise<Result<ProfileResult, HorseError>> {
    const horse = await this.repo.findByIdForOwner(horseId, ownerId)
    if (!horse) {
      return Result.fail({ type: 'HORSE_NOT_FOUND', message: 'Hasten hittades inte' })
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PROFILE_EXPIRY_DAYS)

    await this.repo.createProfileToken(horseId, token, expiresAt)

    return Result.ok({ token, expiresAt })
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createHorseService(): HorseService {
  return new HorseService({
    horseRepository: new HorseRepository(),
  })
}

/**
 * IHorseRepository - Repository interface for Horse aggregate
 *
 * Defines data access operations for horses, notes, timeline, and profile tokens.
 * Domain layer depends on this interface, not the implementation.
 */

// -----------------------------------------------------------
// Core entities
// -----------------------------------------------------------

export interface Horse {
  id: string
  ownerId: string
  name: string
  breed: string | null
  birthYear: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
  registrationNumber: string | null
  microchipNumber: string | null
  photoUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface HorseBooking {
  id: string
  bookingDate: Date
  startTime: string
  endTime: string
  status: string
  customerNotes: string | null
  provider: { businessName: string }
  service: { name: string }
}

export interface HorseWithBookings extends Horse {
  bookings: HorseBooking[]
}

export interface HorseNote {
  id: string
  horseId: string
  authorId: string
  category: string
  title: string
  content: string | null
  noteDate: Date
  createdAt: Date
  updatedAt: Date
}

export interface HorseNoteWithAuthor extends HorseNote {
  author: { firstName: string; lastName: string }
}

export interface ProfileToken {
  id: string
  horseId: string
  token: string
  expiresAt: Date
  createdAt: Date
}

// -----------------------------------------------------------
// DTOs
// -----------------------------------------------------------

export interface CreateHorseData {
  ownerId: string
  name: string
  breed?: string
  birthYear?: number
  color?: string
  gender?: string
  specialNeeds?: string
  registrationNumber?: string
  microchipNumber?: string
}

export interface UpdateHorseData {
  name?: string
  breed?: string | null
  birthYear?: number | null
  color?: string | null
  gender?: string | null
  specialNeeds?: string | null
  registrationNumber?: string | null
  microchipNumber?: string | null
}

export interface CreateNoteData {
  horseId: string
  authorId: string
  category: string
  title: string
  content?: string
  noteDate: Date
}

export interface UpdateNoteData {
  category?: string
  title?: string
  content?: string | null
  noteDate?: Date
}

// -----------------------------------------------------------
// Timeline & Export
// -----------------------------------------------------------

export interface TimelineBookingData {
  id: string
  bookingDate: Date
  status: string
  customerNotes: string | null
  providerNotes: string | null
  service: { name: string }
  provider: { businessName: string }
}

export interface TimelineNoteData {
  id: string
  category: string
  title: string
  content: string | null
  noteDate: Date
  author: { firstName: string; lastName: string }
}

export interface ExportBookingData {
  id: string
  bookingDate: Date
  startTime: string
  endTime: string
  status: string
  customerNotes: string | null
  service: { name: string }
  provider: { businessName: string }
  horse: { name: string } | null
}

// -----------------------------------------------------------
// Interface
// -----------------------------------------------------------

export interface IHorseRepository {
  // ==========================================
  // HORSE CRUD
  // ==========================================

  findByOwnerId(ownerId: string): Promise<Horse[]>

  findByIdForOwner(id: string, ownerId: string): Promise<Horse | null>

  findByIdWithBookings(id: string, ownerId: string): Promise<HorseWithBookings | null>

  create(data: CreateHorseData): Promise<Horse>

  updateWithAuth(id: string, data: UpdateHorseData, ownerId: string): Promise<Horse | null>

  softDeleteWithAuth(id: string, ownerId: string): Promise<boolean>

  // ==========================================
  // NOTE CRUD
  // ==========================================

  findNotesByHorseId(horseId: string, category?: string): Promise<HorseNoteWithAuthor[]>

  createNote(data: CreateNoteData): Promise<HorseNoteWithAuthor>

  findNoteById(noteId: string, horseId: string): Promise<HorseNote | null>

  updateNote(noteId: string, horseId: string, data: UpdateNoteData): Promise<HorseNoteWithAuthor | null>

  deleteNote(noteId: string, horseId: string): Promise<boolean>

  // ==========================================
  // TIMELINE & EXPORT
  // ==========================================

  getTimelineBookings(horseId: string): Promise<TimelineBookingData[]>

  getTimelineNotes(horseId: string, categories?: string[]): Promise<TimelineNoteData[]>

  getExportBookings(horseId: string): Promise<ExportBookingData[]>

  getExportNotes(horseId: string): Promise<TimelineNoteData[]>

  // ==========================================
  // ACCESS CHECKS
  // ==========================================

  /**
   * Check if horse exists and is active (regardless of ownership)
   */
  existsAndActive(horseId: string): Promise<boolean>

  /**
   * Check if a user (via their provider) has any booking for this horse
   */
  hasProviderBookingForHorse(horseId: string, userId: string): Promise<boolean>

  // ==========================================
  // PROFILE TOKEN
  // ==========================================

  createProfileToken(horseId: string, token: string, expiresAt: Date): Promise<ProfileToken>
}

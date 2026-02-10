/**
 * MockHorseRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * Supports seedable relations (not hardcoded "Test User").
 */
import type {
  IHorseRepository,
  Horse,
  HorseWithBookings,
  HorseBooking,
  HorseNote,
  HorseNoteWithAuthor,
  CreateHorseData,
  UpdateHorseData,
  CreateNoteData,
  UpdateNoteData,
  TimelineBookingData,
  TimelineNoteData,
  ExportBookingData,
  ProfileToken,
} from './IHorseRepository'

export class MockHorseRepository implements IHorseRepository {
  private horses: Map<string, Horse> = new Map()
  private notes: Map<string, HorseNote> = new Map()
  private bookings: Map<string, TimelineBookingData & { horseId: string; startTime?: string; endTime?: string; horse?: { name: string } }> = new Map()
  private profileTokens: Map<string, ProfileToken> = new Map()

  // Seedable relation data
  private authorNames: Map<string, { firstName: string; lastName: string }> = new Map()
  private providerBookings: Map<string, Set<string>> = new Map() // userId -> Set<horseId>

  // ==========================================
  // HORSE CRUD
  // ==========================================

  async findByOwnerId(ownerId: string): Promise<Horse[]> {
    return Array.from(this.horses.values())
      .filter((h) => h.ownerId === ownerId && h.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<Horse | null> {
    const horse = this.horses.get(id)
    if (!horse || horse.ownerId !== ownerId || !horse.isActive) return null
    return horse
  }

  async findByIdWithBookings(id: string, ownerId: string): Promise<HorseWithBookings | null> {
    const horse = this.horses.get(id)
    if (!horse || horse.ownerId !== ownerId || !horse.isActive) return null

    const horseBookings: HorseBooking[] = Array.from(this.bookings.values())
      .filter((b) => b.horseId === id)
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
      .slice(0, 20)
      .map((b) => ({
        id: b.id,
        bookingDate: b.bookingDate,
        startTime: b.startTime || '09:00',
        endTime: b.endTime || '10:00',
        status: b.status,
        customerNotes: b.customerNotes,
        provider: b.provider,
        service: b.service,
      }))

    return { ...horse, bookings: horseBookings }
  }

  async create(data: CreateHorseData): Promise<Horse> {
    const horse: Horse = {
      id: `horse-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ownerId: data.ownerId,
      name: data.name,
      breed: data.breed ?? null,
      birthYear: data.birthYear ?? null,
      color: data.color ?? null,
      gender: data.gender ?? null,
      specialNeeds: data.specialNeeds ?? null,
      registrationNumber: data.registrationNumber ?? null,
      microchipNumber: data.microchipNumber ?? null,
      photoUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.horses.set(horse.id, horse)
    return horse
  }

  async updateWithAuth(id: string, data: UpdateHorseData, ownerId: string): Promise<Horse | null> {
    const horse = this.horses.get(id)
    if (!horse || horse.ownerId !== ownerId || !horse.isActive) return null

    const updated: Horse = {
      ...horse,
      ...data,
      updatedAt: new Date(),
    }
    // Only apply defined fields (preserve null vs undefined distinction)
    if (data.name !== undefined) updated.name = data.name
    if (data.breed !== undefined) updated.breed = data.breed ?? null
    if (data.birthYear !== undefined) updated.birthYear = data.birthYear ?? null
    if (data.color !== undefined) updated.color = data.color ?? null
    if (data.gender !== undefined) updated.gender = data.gender ?? null
    if (data.specialNeeds !== undefined) updated.specialNeeds = data.specialNeeds ?? null
    if (data.registrationNumber !== undefined) updated.registrationNumber = data.registrationNumber ?? null
    if (data.microchipNumber !== undefined) updated.microchipNumber = data.microchipNumber ?? null

    this.horses.set(id, updated)
    return updated
  }

  async softDeleteWithAuth(id: string, ownerId: string): Promise<boolean> {
    const horse = this.horses.get(id)
    if (!horse || horse.ownerId !== ownerId || !horse.isActive) return false

    this.horses.set(id, { ...horse, isActive: false, updatedAt: new Date() })
    return true
  }

  // ==========================================
  // NOTE CRUD
  // ==========================================

  async findNotesByHorseId(horseId: string, category?: string): Promise<HorseNoteWithAuthor[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.horseId === horseId && (!category || n.category === category))
      .sort((a, b) => new Date(b.noteDate).getTime() - new Date(a.noteDate).getTime())
      .map((n) => this.noteWithAuthor(n))
  }

  async createNote(data: CreateNoteData): Promise<HorseNoteWithAuthor> {
    const note: HorseNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      horseId: data.horseId,
      authorId: data.authorId,
      category: data.category,
      title: data.title,
      content: data.content ?? null,
      noteDate: data.noteDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.notes.set(note.id, note)
    return this.noteWithAuthor(note)
  }

  async findNoteById(noteId: string, horseId: string): Promise<HorseNote | null> {
    const note = this.notes.get(noteId)
    if (!note || note.horseId !== horseId) return null
    return note
  }

  async updateNote(noteId: string, horseId: string, data: UpdateNoteData): Promise<HorseNoteWithAuthor | null> {
    const note = this.notes.get(noteId)
    if (!note || note.horseId !== horseId) return null

    const updated: HorseNote = { ...note, updatedAt: new Date() }
    if (data.category !== undefined) updated.category = data.category
    if (data.title !== undefined) updated.title = data.title
    if (data.content !== undefined) updated.content = data.content
    if (data.noteDate !== undefined) updated.noteDate = data.noteDate

    this.notes.set(noteId, updated)
    return this.noteWithAuthor(updated)
  }

  async deleteNote(noteId: string, horseId: string): Promise<boolean> {
    const note = this.notes.get(noteId)
    if (!note || note.horseId !== horseId) return false

    this.notes.delete(noteId)
    return true
  }

  // ==========================================
  // TIMELINE & EXPORT
  // ==========================================

  async getTimelineBookings(horseId: string): Promise<TimelineBookingData[]> {
    return Array.from(this.bookings.values())
      .filter((b) => b.horseId === horseId && b.status === 'completed')
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
      .map(({ id, bookingDate, status, customerNotes, providerNotes, service, provider }) => ({
        id, bookingDate, status, customerNotes, providerNotes: providerNotes ?? null, service, provider,
      }))
  }

  async getTimelineNotes(horseId: string, categories?: string[]): Promise<TimelineNoteData[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.horseId === horseId && (!categories || categories.includes(n.category)))
      .sort((a, b) => new Date(b.noteDate).getTime() - new Date(a.noteDate).getTime())
      .map((n) => ({
        id: n.id,
        category: n.category,
        title: n.title,
        content: n.content,
        noteDate: n.noteDate,
        author: this.authorNames.get(n.authorId) || { firstName: 'Test', lastName: 'Author' },
      }))
  }

  async getExportBookings(horseId: string): Promise<ExportBookingData[]> {
    const horse = Array.from(this.horses.values()).find((h) => h.id === horseId)
    return Array.from(this.bookings.values())
      .filter((b) => b.horseId === horseId)
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
      .map((b) => ({
        id: b.id,
        bookingDate: b.bookingDate,
        startTime: b.startTime || '09:00',
        endTime: b.endTime || '10:00',
        status: b.status,
        customerNotes: b.customerNotes,
        service: b.service,
        provider: b.provider,
        horse: b.horse || { name: horse?.name || 'Unknown' },
      }))
  }

  async getExportNotes(horseId: string): Promise<TimelineNoteData[]> {
    return this.getTimelineNotes(horseId)
  }

  // ==========================================
  // ACCESS CHECKS
  // ==========================================

  async existsAndActive(horseId: string): Promise<boolean> {
    const horse = this.horses.get(horseId)
    return !!horse && horse.isActive
  }

  async hasProviderBookingForHorse(horseId: string, userId: string): Promise<boolean> {
    const horseIds = this.providerBookings.get(userId)
    return !!horseIds && horseIds.has(horseId)
  }

  // ==========================================
  // PROFILE TOKEN
  // ==========================================

  async createProfileToken(horseId: string, token: string, expiresAt: Date): Promise<ProfileToken> {
    const profileToken: ProfileToken = {
      id: `pt-${Date.now()}`,
      horseId,
      token,
      expiresAt,
      createdAt: new Date(),
    }
    this.profileTokens.set(token, profileToken)
    return profileToken
  }

  // ==========================================
  // TEST HELPERS
  // ==========================================

  clear(): void {
    this.horses.clear()
    this.notes.clear()
    this.bookings.clear()
    this.profileTokens.clear()
    this.authorNames.clear()
    this.providerBookings.clear()
  }

  seedHorses(horses: Horse[]): void {
    for (const horse of horses) {
      this.horses.set(horse.id, horse)
    }
  }

  seedNotes(notes: HorseNote[]): void {
    for (const note of notes) {
      this.notes.set(note.id, note)
    }
  }

  seedBookings(bookings: Array<TimelineBookingData & { horseId: string; startTime?: string; endTime?: string; horse?: { name: string } }>): void {
    for (const booking of bookings) {
      this.bookings.set(booking.id, booking)
    }
  }

  seedAuthorNames(authors: Map<string, { firstName: string; lastName: string }>): void {
    for (const [id, name] of authors) {
      this.authorNames.set(id, name)
    }
  }

  seedProviderBookings(userId: string, horseIds: string[]): void {
    this.providerBookings.set(userId, new Set(horseIds))
  }

  getAll(): Horse[] {
    return Array.from(this.horses.values())
  }

  getAllNotes(): HorseNote[] {
    return Array.from(this.notes.values())
  }

  // ==========================================
  // Private helpers
  // ==========================================

  private noteWithAuthor(note: HorseNote): HorseNoteWithAuthor {
    return {
      ...note,
      author: this.authorNames.get(note.authorId) || { firstName: 'Test', lastName: 'Author' },
    }
  }
}

/**
 * HorseRepository - Prisma implementation
 *
 * Uses `select` (never `include`) to prevent passwordHash leaks.
 * Authorization is atomic in WHERE clauses (IDOR protection).
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IHorseRepository,
  Horse,
  HorseWithBookings,
  HorseNote,
  HorseNoteWithAuthor,
  CreateHorseData,
  UpdateHorseData,
  CreateNoteData,
  UpdateNoteData,
  TimelineBookingData,
  TimelineNoteData,
  ExportBookingData,
  PassportToken,
} from './IHorseRepository'

// -----------------------------------------------------------
// Select objects (never expose passwordHash or sensitive data)
// -----------------------------------------------------------

const horseSelect = {
  id: true,
  ownerId: true,
  name: true,
  breed: true,
  birthYear: true,
  color: true,
  gender: true,
  specialNeeds: true,
  photoUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HorseSelect

const bookingSelect = {
  id: true,
  bookingDate: true,
  startTime: true,
  endTime: true,
  status: true,
  customerNotes: true,
  provider: { select: { businessName: true } },
  service: { select: { name: true } },
} satisfies Prisma.BookingSelect

const noteSelect = {
  id: true,
  horseId: true,
  authorId: true,
  category: true,
  title: true,
  content: true,
  noteDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HorseNoteSelect

const noteWithAuthorSelect = {
  ...noteSelect,
  author: { select: { firstName: true, lastName: true } },
} satisfies Prisma.HorseNoteSelect

// -----------------------------------------------------------
// Implementation
// -----------------------------------------------------------

export class HorseRepository implements IHorseRepository {
  // ==========================================
  // HORSE CRUD
  // ==========================================

  async findByOwnerId(ownerId: string): Promise<Horse[]> {
    return prisma.horse.findMany({
      where: { ownerId, isActive: true },
      select: horseSelect,
      orderBy: { name: 'asc' },
    })
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<Horse | null> {
    return prisma.horse.findFirst({
      where: { id, ownerId, isActive: true },
      select: horseSelect,
    })
  }

  async findByIdWithBookings(id: string, ownerId: string): Promise<HorseWithBookings | null> {
    return prisma.horse.findFirst({
      where: { id, ownerId, isActive: true },
      select: {
        ...horseSelect,
        bookings: {
          select: bookingSelect,
          orderBy: { bookingDate: 'desc' },
          take: 20,
        },
      },
    })
  }

  async create(data: CreateHorseData): Promise<Horse> {
    return prisma.horse.create({
      data: {
        ownerId: data.ownerId,
        name: data.name,
        breed: data.breed,
        birthYear: data.birthYear,
        color: data.color,
        gender: data.gender,
        specialNeeds: data.specialNeeds,
      },
      select: horseSelect,
    })
  }

  async updateWithAuth(id: string, data: UpdateHorseData, ownerId: string): Promise<Horse | null> {
    // Atomic ownership check: findFirst + update
    const existing = await prisma.horse.findFirst({
      where: { id, ownerId, isActive: true },
      select: { id: true },
    })

    if (!existing) return null

    return prisma.horse.update({
      where: { id },
      data,
      select: horseSelect,
    })
  }

  async softDeleteWithAuth(id: string, ownerId: string): Promise<boolean> {
    const existing = await prisma.horse.findFirst({
      where: { id, ownerId, isActive: true },
      select: { id: true },
    })

    if (!existing) return false

    await prisma.horse.update({
      where: { id },
      data: { isActive: false },
    })

    return true
  }

  // ==========================================
  // NOTE CRUD
  // ==========================================

  async findNotesByHorseId(horseId: string, category?: string): Promise<HorseNoteWithAuthor[]> {
    const where: Prisma.HorseNoteWhereInput = { horseId }
    if (category) {
      where.category = category
    }

    return prisma.horseNote.findMany({
      where,
      select: noteWithAuthorSelect,
      orderBy: { noteDate: 'desc' },
    })
  }

  async createNote(data: CreateNoteData): Promise<HorseNoteWithAuthor> {
    return prisma.horseNote.create({
      data: {
        horseId: data.horseId,
        authorId: data.authorId,
        category: data.category,
        title: data.title,
        content: data.content,
        noteDate: data.noteDate,
      },
      select: noteWithAuthorSelect,
    })
  }

  async findNoteById(noteId: string, horseId: string): Promise<HorseNote | null> {
    return prisma.horseNote.findFirst({
      where: { id: noteId, horseId },
      select: noteSelect,
    })
  }

  async updateNote(
    noteId: string,
    horseId: string,
    data: UpdateNoteData
  ): Promise<HorseNoteWithAuthor | null> {
    const existing = await prisma.horseNote.findFirst({
      where: { id: noteId, horseId },
      select: { id: true },
    })

    if (!existing) return null

    const updateData: Record<string, unknown> = {}
    if (data.category !== undefined) updateData.category = data.category
    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) updateData.content = data.content
    if (data.noteDate !== undefined) updateData.noteDate = data.noteDate

    return prisma.horseNote.update({
      where: { id: noteId },
      data: updateData,
      select: noteWithAuthorSelect,
    })
  }

  async deleteNote(noteId: string, horseId: string): Promise<boolean> {
    const existing = await prisma.horseNote.findFirst({
      where: { id: noteId, horseId },
      select: { id: true },
    })

    if (!existing) return false

    await prisma.horseNote.delete({ where: { id: noteId } })
    return true
  }

  // ==========================================
  // TIMELINE & EXPORT
  // ==========================================

  async getTimelineBookings(horseId: string): Promise<TimelineBookingData[]> {
    return prisma.booking.findMany({
      where: { horseId, status: 'completed' },
      select: {
        id: true,
        bookingDate: true,
        status: true,
        customerNotes: true,
        service: { select: { name: true } },
        provider: { select: { businessName: true } },
      },
      orderBy: { bookingDate: 'desc' },
    })
  }

  async getTimelineNotes(horseId: string, categories?: string[]): Promise<TimelineNoteData[]> {
    const where: Prisma.HorseNoteWhereInput = { horseId }
    if (categories) {
      where.category = { in: categories }
    }

    return prisma.horseNote.findMany({
      where,
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        noteDate: true,
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { noteDate: 'desc' },
    })
  }

  async getExportBookings(horseId: string): Promise<ExportBookingData[]> {
    return prisma.booking.findMany({
      where: { horseId },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        customerNotes: true,
        service: { select: { name: true } },
        provider: { select: { businessName: true } },
        horse: { select: { name: true } },
      },
      orderBy: { bookingDate: 'desc' },
    })
  }

  async getExportNotes(horseId: string): Promise<TimelineNoteData[]> {
    return prisma.horseNote.findMany({
      where: { horseId },
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        noteDate: true,
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { noteDate: 'desc' },
    })
  }

  // ==========================================
  // ACCESS CHECKS
  // ==========================================

  async existsAndActive(horseId: string): Promise<boolean> {
    const count = await prisma.horse.count({
      where: { id: horseId, isActive: true },
    })
    return count > 0
  }

  async hasProviderBookingForHorse(horseId: string, userId: string): Promise<boolean> {
    const count = await prisma.booking.count({
      where: {
        horseId,
        provider: { userId },
      },
    })
    return count > 0
  }

  // ==========================================
  // PASSPORT
  // ==========================================

  async createPassportToken(horseId: string, token: string, expiresAt: Date): Promise<PassportToken> {
    return prisma.horsePassportToken.create({
      data: { horseId, token, expiresAt },
    })
  }
}

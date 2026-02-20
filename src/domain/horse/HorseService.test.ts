import { describe, it, expect, beforeEach } from 'vitest'
import { HorseService } from './HorseService'
import { MockHorseRepository } from '@/infrastructure/persistence/horse/MockHorseRepository'
import type { Horse, HorseNote } from '@/infrastructure/persistence/horse/IHorseRepository'

// -----------------------------------------------------------
// Fixtures
// -----------------------------------------------------------

const makeHorse = (overrides: Partial<Horse> = {}): Horse => ({
  id: 'horse-1',
  ownerId: 'owner-1',
  name: 'Blansen',
  breed: 'Svenskt varmblod',
  birthYear: 2018,
  color: 'Brun',
  gender: 'gelding',
  specialNeeds: null,
  registrationNumber: null,
  microchipNumber: null,
  photoUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeNote = (overrides: Partial<HorseNote> = {}): HorseNote => ({
  id: 'note-1',
  horseId: 'horse-1',
  authorId: 'owner-1',
  category: 'veterinary',
  title: 'Vaccination',
  content: 'Influensa',
  noteDate: new Date('2026-01-15'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('HorseService', () => {
  let repo: MockHorseRepository
  let service: HorseService

  beforeEach(() => {
    repo = new MockHorseRepository()
    service = new HorseService({ horseRepository: repo })

    // Seed author names for notes
    repo.seedAuthorNames(
      new Map([
        ['owner-1', { firstName: 'Anna', lastName: 'Svensson' }],
        ['provider-user-1', { firstName: 'Magnus', lastName: 'Johansson' }],
      ])
    )
  })

  // ==========================================
  // HORSE CRUD
  // ==========================================

  describe('listHorses', () => {
    it('should return horses for owner', async () => {
      repo.seedHorses([makeHorse(), makeHorse({ id: 'horse-2', name: 'Stansen' })])

      const result = await service.listHorses('owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveLength(2)
    })

    it('should return empty array when owner has no horses', async () => {
      const result = await service.listHorses('owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value).toEqual([])
    })

    it('should not return inactive horses', async () => {
      repo.seedHorses([makeHorse({ isActive: false })])

      const result = await service.listHorses('owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value).toEqual([])
    })
  })

  describe('getHorse', () => {
    it('should return horse with bookings for owner', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.getHorse('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value.name).toBe('Blansen')
      expect(result.value.bookings).toBeDefined()
    })

    it('should fail if horse not found', async () => {
      const result = await service.getHorse('nonexistent', 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })

    it('should fail if horse belongs to different owner (IDOR)', async () => {
      repo.seedHorses([makeHorse({ ownerId: 'other-owner' })])

      const result = await service.getHorse('horse-1', 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })

  describe('createHorse', () => {
    it('should create horse with all fields', async () => {
      const result = await service.createHorse(
        { name: 'Blansen', breed: 'Varmblod', birthYear: 2018 },
        'owner-1'
      )

      expect(result.isSuccess).toBe(true)
      expect(result.value.name).toBe('Blansen')
      expect(result.value.ownerId).toBe('owner-1')
      expect(result.value.isActive).toBe(true)
    })

    it('should create horse with only required field', async () => {
      const result = await service.createHorse({ name: 'Minimal' }, 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value.name).toBe('Minimal')
      expect(result.value.breed).toBeNull()
    })
  })

  describe('updateHorse', () => {
    it('should update horse for owner', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.updateHorse('horse-1', { name: 'Blansen III' }, 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value.name).toBe('Blansen III')
    })

    it('should fail if not owner (IDOR)', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.updateHorse('horse-1', { name: 'Hacked' }, 'attacker')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })

  describe('softDeleteHorse', () => {
    it('should soft-delete horse (isActive=false)', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.softDeleteHorse('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)

      // Verify isActive is false
      const all = repo.getAll()
      expect(all[0].isActive).toBe(false)
    })

    it('should fail if not owner', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.softDeleteHorse('horse-1', 'attacker')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })

    it('should fail if horse already deleted', async () => {
      repo.seedHorses([makeHorse({ isActive: false })])

      const result = await service.softDeleteHorse('horse-1', 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })

  // ==========================================
  // NOTE CRUD
  // ==========================================

  describe('listNotes', () => {
    it('should return notes for horse owner', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])

      const result = await service.listNotes('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveLength(1)
      expect(result.value[0].title).toBe('Vaccination')
      expect(result.value[0].author.firstName).toBe('Anna')
    })

    it('should filter by category', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([
        makeNote({ id: 'note-1', category: 'veterinary' }),
        makeNote({ id: 'note-2', category: 'general', title: 'General note' }),
      ])

      const result = await service.listNotes('horse-1', 'owner-1', 'veterinary')

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveLength(1)
      expect(result.value[0].category).toBe('veterinary')
    })

    it('should fail if horse not owned (IDOR)', async () => {
      repo.seedHorses([makeHorse({ ownerId: 'other-owner' })])

      const result = await service.listNotes('horse-1', 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })

  describe('createNote', () => {
    it('should create note for owned horse', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.createNote(
        'horse-1',
        { category: 'veterinary', title: 'Vaccination', noteDate: new Date('2026-01-15') },
        'owner-1'
      )

      expect(result.isSuccess).toBe(true)
      expect(result.value.title).toBe('Vaccination')
      expect(result.value.horseId).toBe('horse-1')
      expect(result.value.authorId).toBe('owner-1')
    })

    it('should fail if horse not owned', async () => {
      repo.seedHorses([makeHorse({ ownerId: 'other-owner' })])

      const result = await service.createNote(
        'horse-1',
        { category: 'general', title: 'Test', noteDate: new Date() },
        'owner-1'
      )

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })

  describe('updateNote', () => {
    it('should update note for horse owner', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])

      const result = await service.updateNote('horse-1', 'note-1', { title: 'Updated' }, 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value.title).toBe('Updated')
    })

    it('should fail if horse not owned (IDOR)', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])

      const result = await service.updateNote('horse-1', 'note-1', { title: 'Hack' }, 'attacker')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })

    it('should fail if note not found on horse', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.updateNote('horse-1', 'nonexistent', { title: 'Test' }, 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NOTE_NOT_FOUND')
    })
  })

  describe('deleteNote', () => {
    it('should delete note for horse owner', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])

      const result = await service.deleteNote('horse-1', 'note-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(repo.getAllNotes()).toHaveLength(0)
    })

    it('should fail if horse not owned (IDOR)', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])

      const result = await service.deleteNote('horse-1', 'note-1', 'attacker')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })

    it('should fail if note not found', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.deleteNote('horse-1', 'nonexistent', 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NOTE_NOT_FOUND')
    })
  })

  // ==========================================
  // TIMELINE (complex access control)
  // ==========================================

  describe('getTimeline', () => {
    it('should return full timeline for owner', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])
      repo.seedBookings([
        {
          id: 'b1',
          horseId: 'horse-1',
          bookingDate: new Date('2026-01-20'),
          status: 'completed',
          customerNotes: null,
          service: { name: 'Massage' },
          provider: { businessName: 'Sara' },
        },
      ])

      const result = await service.getTimeline('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveLength(2)
      // Most recent first
      expect(result.value[0].type).toBe('booking')
      expect(result.value[1].type).toBe('note')
    })

    it('should return limited categories for provider with booking', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedProviderBookings('provider-user-1', ['horse-1'])
      repo.seedNotes([
        makeNote({ id: 'n1', category: 'veterinary' }),
        makeNote({ id: 'n2', category: 'general', title: 'General' }),
        makeNote({ id: 'n3', category: 'injury', title: 'Injury' }),
      ])

      const result = await service.getTimeline('horse-1', 'provider-user-1')

      expect(result.isSuccess).toBe(true)
      // Only veterinary should be visible (general and injury are restricted)
      const noteItems = result.value.filter((i) => i.type === 'note')
      expect(noteItems).toHaveLength(1)
      expect((noteItems[0] as any).category).toBe('veterinary')
    })

    it('should return 404 for user without access', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.getTimeline('horse-1', 'stranger')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })

    it('should return 404 for non-existent horse', async () => {
      const result = await service.getTimeline('nonexistent', 'owner-1')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })

    it('should filter by category for owner', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([
        makeNote({ id: 'n1', category: 'veterinary' }),
        makeNote({ id: 'n2', category: 'general', title: 'General' }),
      ])
      repo.seedBookings([
        {
          id: 'b1',
          horseId: 'horse-1',
          bookingDate: new Date('2026-01-20'),
          status: 'completed',
          customerNotes: null,
          service: { name: 'Massage' },
          provider: { businessName: 'Sara' },
        },
      ])

      const result = await service.getTimeline('horse-1', 'owner-1', 'veterinary')

      expect(result.isSuccess).toBe(true)
      // Should only have veterinary note (bookings excluded when filtering by category)
      expect(result.value).toHaveLength(1)
      expect(result.value[0].type).toBe('note')
    })
  })

  // ==========================================
  // EXPORT
  // ==========================================

  describe('exportData', () => {
    it('should return export data for owner', async () => {
      repo.seedHorses([makeHorse()])
      repo.seedNotes([makeNote()])
      repo.seedBookings([
        {
          id: 'b1',
          horseId: 'horse-1',
          bookingDate: new Date('2026-01-20'),
          startTime: '09:00',
          endTime: '10:00',
          status: 'completed',
          customerNotes: null,
          service: { name: 'Hovslagning' },
          provider: { businessName: 'Magnus' },
          horse: { name: 'Blansen' },
        },
      ])

      const result = await service.exportData('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value.horse.name).toBe('Blansen')
      expect(result.value.bookings).toHaveLength(1)
      expect(result.value.notes).toHaveLength(1)
      expect(result.value.timeline).toBeDefined()
    })

    it('should fail if not owner', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.exportData('horse-1', 'attacker')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })

  // ==========================================
  // PROFILE TOKEN
  // ==========================================

  describe('createProfileToken', () => {
    it('should create profile token for owner', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.createProfileToken('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      expect(result.value.token).toBeDefined()
      expect(result.value.token.length).toBeGreaterThan(0)
      expect(result.value.expiresAt).toBeDefined()
    })

    it('should set 30 day expiry', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.createProfileToken('horse-1', 'owner-1')

      expect(result.isSuccess).toBe(true)
      const now = Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      const expiresAt = result.value.expiresAt.getTime()
      expect(expiresAt - now).toBeGreaterThan(thirtyDays - 60000)
      expect(expiresAt - now).toBeLessThan(thirtyDays + 60000)
    })

    it('should fail if not owner', async () => {
      repo.seedHorses([makeHorse()])

      const result = await service.createProfileToken('horse-1', 'attacker')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('HORSE_NOT_FOUND')
    })
  })
})

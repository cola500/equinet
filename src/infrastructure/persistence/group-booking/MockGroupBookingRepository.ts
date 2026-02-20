/**
 * MockGroupBookingRepository - In-memory implementation for testing
 *
 * Provides a fast, predictable repository for unit tests.
 * No database required. Seedable with test data.
 */
import type {
  IGroupBookingRepository,
  GroupBookingRequest,
  GroupBookingParticipant,
  ParticipantWithUser,
  GroupBookingWithParticipants,
  GroupBookingWithDetails,
  GroupBookingForMatch,
  CreateGroupBookingData,
  UpdateGroupBookingData,
  CreateParticipantData,
  MatchBookingData,
} from './IGroupBookingRepository'

export class MockGroupBookingRepository implements IGroupBookingRepository {
  private requests: Map<string, GroupBookingRequest> = new Map()
  private participants: Map<string, GroupBookingParticipant> = new Map()
  private userNames: Map<string, { firstName: string }> = new Map()
  private createdBookingIds: string[] = []

  // ==========================================
  // QUERY METHODS
  // ==========================================

  async findByIdWithAccess(
    id: string,
    userId: string,
    userType: string
  ): Promise<GroupBookingWithDetails | null> {
    const request = this.requests.get(id)
    if (!request) return null

    const isCreator = request.creatorId === userId
    const isParticipant = this.getActiveParticipantsForRequest(id).some((p) => p.userId === userId)
    const isMatchedProvider = request.providerId !== null // simplified check
    const isOpenForProvider = userType === 'provider' && request.status === 'open'

    if (!isCreator && !isParticipant && !isMatchedProvider && !isOpenForProvider) return null

    return this.toWithDetails(request)
  }

  async findByUserId(userId: string): Promise<GroupBookingWithParticipants[]> {
    const results: GroupBookingWithParticipants[] = []
    for (const request of this.requests.values()) {
      const isCreator = request.creatorId === userId
      const isParticipant = this.getActiveParticipantsForRequest(request.id).some((p) => p.userId === userId)
      if (isCreator || isParticipant) {
        results.push(this.toWithParticipants(request))
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async findAvailableForProvider(_userId: string): Promise<{
    provider: { id: string } | null
    requests: GroupBookingWithParticipants[]
  }> {
    // In mock, always assume provider exists with a fake ID
    const now = new Date()
    const results: GroupBookingWithParticipants[] = []
    for (const request of this.requests.values()) {
      if (request.status === 'open' && request.dateFrom >= now) {
        results.push(this.toWithParticipants(request))
      }
    }
    return {
      provider: { id: 'mock-provider-id' },
      requests: results.sort((a, b) => a.dateFrom.getTime() - b.dateFrom.getTime()),
    }
  }

  async findByInviteCode(
    inviteCode: string
  ): Promise<(GroupBookingRequest & { _count: { participants: number } }) | null> {
    for (const request of this.requests.values()) {
      if (request.inviteCode === inviteCode) {
        const activeCount = this.getActiveParticipantsForRequest(request.id).length
        return { ...request, _count: { participants: activeCount } }
      }
    }
    return null
  }

  async findForMatch(id: string): Promise<GroupBookingForMatch | null> {
    const request = this.requests.get(id)
    if (!request || request.status !== 'open') return null

    const participants = this.getActiveParticipantsForRequest(id).map((p) => ({
      id: p.id,
      userId: p.userId,
      horseName: p.horseName,
      horseInfo: p.horseInfo,
      horseId: p.horseId,
      notes: p.notes,
      user: { id: p.userId, firstName: this.userNames.get(p.userId)?.firstName || 'Test' },
    }))

    return {
      id: request.id,
      status: request.status,
      serviceType: request.serviceType,
      participants,
    }
  }

  async isUserParticipant(groupBookingRequestId: string, userId: string): Promise<boolean> {
    for (const p of this.participants.values()) {
      if (p.groupBookingRequestId === groupBookingRequestId && p.userId === userId) {
        return true
      }
    }
    return false
  }

  async findByIdForCreator(
    id: string,
    creatorId: string
  ): Promise<(GroupBookingRequest & { participants: { userId: true }[] }) | null> {
    const request = this.requests.get(id)
    if (!request || request.creatorId !== creatorId) return null

    const activeParticipants = this.getActiveParticipantsForRequest(id)
      .map((_p) => ({ userId: true as const }))

    return { ...request, participants: activeParticipants }
  }

  async findParticipantWithAccess(
    participantId: string,
    groupBookingRequestId: string,
    userId: string
  ): Promise<(GroupBookingParticipant & {
    groupBookingRequest: {
      id: string
      creatorId: string
      status: string
      serviceType: string
    }
  }) | null> {
    const participant = this.participants.get(participantId)
    if (!participant) return null
    if (participant.groupBookingRequestId !== groupBookingRequestId) return null
    if (participant.status === 'cancelled') return null

    const request = this.requests.get(groupBookingRequestId)
    if (!request) return null

    // Access: self or creator
    const isSelf = participant.userId === userId
    const isCreator = request.creatorId === userId
    if (!isSelf && !isCreator) return null

    return {
      ...participant,
      groupBookingRequest: {
        id: request.id,
        creatorId: request.creatorId,
        status: request.status,
        serviceType: request.serviceType,
      },
    }
  }

  async countActiveParticipants(groupBookingRequestId: string): Promise<number> {
    return this.getActiveParticipantsForRequest(groupBookingRequestId).length
  }

  // ==========================================
  // COMMAND METHODS
  // ==========================================

  async create(data: CreateGroupBookingData): Promise<GroupBookingWithParticipants> {
    const now = new Date()
    const request: GroupBookingRequest = {
      id: `gbr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      creatorId: data.creatorId,
      serviceType: data.serviceType,
      providerId: data.providerId || null,
      locationName: data.locationName,
      address: data.address,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      notes: data.notes || null,
      maxParticipants: data.maxParticipants,
      status: 'open',
      inviteCode: data.inviteCode,
      joinDeadline: data.joinDeadline || null,
      createdAt: now,
      updatedAt: now,
    }
    this.requests.set(request.id, request)

    const participant: GroupBookingParticipant = {
      id: `gbp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      groupBookingRequestId: request.id,
      userId: data.creatorId,
      numberOfHorses: data.creatorParticipant.numberOfHorses,
      horseId: data.creatorParticipant.horseId || null,
      horseName: data.creatorParticipant.horseName || null,
      horseInfo: data.creatorParticipant.horseInfo || null,
      notes: null,
      status: 'joined',
      bookingId: null,
      joinedAt: now,
      updatedAt: now,
    }
    this.participants.set(participant.id, participant)

    return this.toWithParticipants(request)
  }

  async update(
    id: string,
    data: UpdateGroupBookingData
  ): Promise<GroupBookingWithParticipants> {
    const request = this.requests.get(id)
    if (!request) throw new Error(`GroupBookingRequest ${id} not found`)

    const updated: GroupBookingRequest = {
      ...request,
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.maxParticipants !== undefined && { maxParticipants: data.maxParticipants }),
      ...(data.joinDeadline !== undefined && { joinDeadline: data.joinDeadline }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),
    }
    this.requests.set(id, updated)

    return this.toWithParticipants(updated)
  }

  async addParticipant(data: CreateParticipantData): Promise<GroupBookingParticipant> {
    const now = new Date()
    const participant: GroupBookingParticipant = {
      id: `gbp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      groupBookingRequestId: data.groupBookingRequestId,
      userId: data.userId,
      numberOfHorses: data.numberOfHorses,
      horseId: data.horseId || null,
      horseName: data.horseName || null,
      horseInfo: data.horseInfo || null,
      notes: data.notes || null,
      status: 'joined',
      bookingId: null,
      joinedAt: now,
      updatedAt: now,
    }
    this.participants.set(participant.id, participant)
    return participant
  }

  async cancelParticipant(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId)
    if (participant) {
      this.participants.set(participantId, { ...participant, status: 'cancelled', updatedAt: new Date() })
    }
  }

  async cancelRequest(id: string): Promise<void> {
    const request = this.requests.get(id)
    if (request) {
      this.requests.set(id, { ...request, status: 'cancelled', updatedAt: new Date() })
    }
  }

  async matchAndCreateBookings(
    groupBookingRequestId: string,
    providerId: string,
    bookings: MatchBookingData[],
    participantBookingLinks: { participantId: string; bookingIndex: number }[]
  ): Promise<{ bookingIds: string[]; errors: string[] }> {
    const bookingIds: string[] = []
    const errors: string[] = []

    for (let i = 0; i < bookings.length; i++) {
      const bookingId = `booking-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
      bookingIds.push(bookingId)

      // Link participant
      const link = participantBookingLinks.find((l) => l.bookingIndex === i)
      if (link) {
        const participant = this.participants.get(link.participantId)
        if (participant) {
          this.participants.set(link.participantId, {
            ...participant,
            bookingId,
            status: 'booked',
            updatedAt: new Date(),
          })
        }
      }
    }

    // Update request status
    if (bookingIds.length > 0) {
      const request = this.requests.get(groupBookingRequestId)
      if (request) {
        this.requests.set(groupBookingRequestId, {
          ...request,
          status: 'matched',
          providerId,
          updatedAt: new Date(),
        })
      }
    }

    this.createdBookingIds = bookingIds
    return { bookingIds, errors }
  }

  // ==========================================
  // TEST HELPERS
  // ==========================================

  clear(): void {
    this.requests.clear()
    this.participants.clear()
    this.userNames.clear()
    this.createdBookingIds = []
  }

  seedRequests(requests: GroupBookingRequest[]): void {
    for (const r of requests) {
      this.requests.set(r.id, r)
    }
  }

  seedParticipants(participants: GroupBookingParticipant[]): void {
    for (const p of participants) {
      this.participants.set(p.id, p)
    }
  }

  seedUserNames(names: Map<string, { firstName: string }>): void {
    for (const [id, name] of names) {
      this.userNames.set(id, name)
    }
  }

  getAll(): GroupBookingRequest[] {
    return Array.from(this.requests.values())
  }

  getAllParticipants(): GroupBookingParticipant[] {
    return Array.from(this.participants.values())
  }

  getCreatedBookingIds(): string[] {
    return this.createdBookingIds
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private getActiveParticipantsForRequest(requestId: string): GroupBookingParticipant[] {
    return Array.from(this.participants.values())
      .filter((p) => p.groupBookingRequestId === requestId && p.status !== 'cancelled')
  }

  private toParticipantWithUser(p: GroupBookingParticipant): ParticipantWithUser {
    return {
      ...p,
      user: { firstName: this.userNames.get(p.userId)?.firstName || 'Test' },
      horse: p.horseName ? { name: p.horseName } : null,
    }
  }

  private toWithParticipants(request: GroupBookingRequest): GroupBookingWithParticipants {
    const active = this.getActiveParticipantsForRequest(request.id)
    return {
      ...request,
      participants: active.map((p) => this.toParticipantWithUser(p)),
      _count: { participants: active.length },
    }
  }

  private toWithDetails(request: GroupBookingRequest): GroupBookingWithDetails {
    return {
      ...this.toWithParticipants(request),
      provider: request.providerId ? { id: request.providerId, businessName: 'Mock Provider' } : null,
    }
  }
}

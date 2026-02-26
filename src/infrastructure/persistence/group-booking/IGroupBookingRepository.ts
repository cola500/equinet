/**
 * IGroupBookingRepository - Repository interface for GroupBooking aggregate
 *
 * GroupBookingRequest + GroupBookingParticipant form one aggregate.
 * Participants don't exist without a request.
 *
 * All finder methods take userId/userType for IDOR protection.
 * Uses `select` (never `include` with raw user data).
 */

// -----------------------------------------------------------
// Core entities
// -----------------------------------------------------------

export interface GroupBookingRequest {
  id: string
  creatorId: string
  serviceType: string
  providerId: string | null
  locationName: string
  address: string
  latitude: number | null
  longitude: number | null
  dateFrom: Date
  dateTo: Date
  notes: string | null
  maxParticipants: number
  status: string
  inviteCode: string
  joinDeadline: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface GroupBookingParticipant {
  id: string
  groupBookingRequestId: string
  userId: string
  numberOfHorses: number
  horseId: string | null
  horseName: string | null
  horseInfo: string | null
  notes: string | null
  status: string
  bookingId: string | null
  joinedAt: Date
  updatedAt: Date
}

export interface ParticipantWithUser extends GroupBookingParticipant {
  user: { firstName: string }
  horse: { name: string } | null
}

export interface GroupBookingWithParticipants extends GroupBookingRequest {
  participants: ParticipantWithUser[]
  _count: { participants: number }
}

export interface GroupBookingWithDetails extends GroupBookingWithParticipants {
  provider: { id: string; businessName: string } | null
}

// For match operation - needs user info for sequential booking creation
export interface ParticipantForMatch {
  id: string
  userId: string
  horseName: string | null
  horseInfo: string | null
  horseId: string | null
  notes: string | null
  user: { id: string; firstName: string }
}

export interface GroupBookingForMatch {
  id: string
  status: string
  serviceType: string
  participants: ParticipantForMatch[]
}

// -----------------------------------------------------------
// DTOs
// -----------------------------------------------------------

export interface CreateGroupBookingData {
  creatorId: string
  serviceType: string
  providerId?: string
  locationName: string
  address: string
  latitude?: number
  longitude?: number
  dateFrom: Date
  dateTo: Date
  notes?: string
  maxParticipants: number
  inviteCode: string
  joinDeadline?: Date
  // Creator's participant data
  creatorParticipant: {
    numberOfHorses: number
    horseId?: string
    horseName?: string
    horseInfo?: string
  }
}

export interface UpdateGroupBookingData {
  notes?: string
  maxParticipants?: number
  joinDeadline?: Date
  status?: string
}

export interface CreateParticipantData {
  groupBookingRequestId: string
  userId: string
  numberOfHorses: number
  horseId?: string
  horseName?: string
  horseInfo?: string
  notes?: string
}

export interface MatchBookingData {
  customerId: string
  providerId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  endTime: string
  horseName: string | null
  horseInfo: string | null
  horseId: string | null
  customerNotes: string | null
}

// -----------------------------------------------------------
// Interface
// -----------------------------------------------------------

export interface IGroupBookingRepository {
  // ==========================================
  // QUERY METHODS
  // ==========================================

  /**
   * Find group booking by ID with access control.
   * Access: creator, participant, matched provider, or any provider for open requests.
   */
  findByIdWithAccess(
    id: string,
    userId: string,
    userType: string
  ): Promise<GroupBookingWithDetails | null>

  /**
   * Find all group bookings where user is creator OR participant
   */
  findByUserId(userId: string): Promise<GroupBookingWithParticipants[]>

  /**
   * Find open group bookings for providers (future dates only)
   */
  findAvailableForProvider(userId: string): Promise<{
    provider: { id: string } | null
    requests: GroupBookingWithParticipants[]
  }>

  /**
   * Find group booking by invite code (for join flow)
   */
  findByInviteCode(inviteCode: string): Promise<(GroupBookingRequest & { _count: { participants: number } }) | null>

  /**
   * Find group booking for match operation
   */
  findForMatch(id: string): Promise<GroupBookingForMatch | null>

  /**
   * Check if user already joined a group booking
   */
  isUserParticipant(groupBookingRequestId: string, userId: string): Promise<boolean>

  /**
   * Find group booking by ID, only if user is creator (for update/cancel)
   */
  findByIdForCreator(
    id: string,
    creatorId: string
  ): Promise<(GroupBookingRequest & { participants: { userId: string }[] }) | null>

  /**
   * Find participant with access check (self or creator)
   */
  findParticipantWithAccess(
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
  }) | null>

  /**
   * Count active participants in a group booking
   */
  countActiveParticipants(groupBookingRequestId: string): Promise<number>

  // ==========================================
  // COMMAND METHODS
  // ==========================================

  /**
   * Create group booking request + creator as first participant (atomic)
   */
  create(data: CreateGroupBookingData): Promise<GroupBookingWithParticipants>

  /**
   * Update group booking (creator only - auth checked by caller)
   */
  update(id: string, data: UpdateGroupBookingData): Promise<GroupBookingWithParticipants>

  /**
   * Add participant to group booking
   */
  addParticipant(data: CreateParticipantData): Promise<GroupBookingParticipant>

  /**
   * Soft-delete participant (set status to "cancelled")
   */
  cancelParticipant(participantId: string): Promise<void>

  /**
   * Cancel entire group booking
   */
  cancelRequest(id: string): Promise<void>

  /**
   * Match provider to group booking - creates bookings in $transaction
   * Returns booking IDs for successfully created bookings + any errors
   */
  matchAndCreateBookings(
    groupBookingRequestId: string,
    providerId: string,
    bookings: MatchBookingData[],
    participantBookingLinks: { participantId: string; bookingIndex: number }[]
  ): Promise<{ bookingIds: string[]; errors: string[] }>
}

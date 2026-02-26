/**
 * BaseRepository - Abstract repository interface
 *
 * Repositories abstract data access logic from the domain layer.
 * They provide a collection-like interface for accessing aggregates.
 *
 * Key principles:
 * - Domain layer depends on repository interfaces (not implementations)
 * - Infrastructure layer provides concrete implementations (Prisma, Mock, etc.)
 * - Repositories work with domain entities, not database models
 * - Each aggregate root has one repository
 *
 * @example
 * ```typescript
 * // Domain layer defines the interface
 * interface IBookingRepository extends IRepository<Booking> {
 *   findByCustomerId(customerId: string): Promise<Booking[]>
 *   findOverlapping(timeSlot: TimeSlot): Promise<Booking[]>
 * }
 *
 * // Infrastructure provides implementation
 * class PrismaBookingRepository implements IBookingRepository {
 *   async findById(id: string): Promise<Booking | null> {
 *     const record = await prisma.booking.findUnique({ where: { id } })
 *     return record ? BookingMapper.toDomain(record) : null
 *   }
 * }
 * ```
 */
/**
 * Generic repository interface for aggregate roots
 */
export interface IRepository<T> {
  /**
   * Find entity by ID
   */
  findById(id: string): Promise<T | null>

  /**
   * Find all entities matching criteria
   */
  findMany(criteria?: Record<string, unknown>): Promise<T[]>

  /**
   * Save (insert or update) entity
   */
  save(entity: T): Promise<T>

  /**
   * Delete entity by ID
   */
  delete(id: string): Promise<void>

  /**
   * Check if entity exists
   */
  exists(id: string): Promise<boolean>
}

/**
 * Base repository implementation with common functionality
 */
export abstract class BaseRepository<T> implements IRepository<T> {
  abstract findById(id: string): Promise<T | null>
  abstract findMany(criteria?: Record<string, unknown>): Promise<T[]>
  abstract save(entity: T): Promise<T>
  abstract delete(id: string): Promise<void>

  async exists(id: string): Promise<boolean> {
    const entity = await this.findById(id)
    return entity !== null
  }
}

/**
 * Mapper interface for converting between domain and persistence models
 *
 * @example
 * ```typescript
 * class BookingMapper implements IMapper<Booking, PrismaBooking> {
 *   toDomain(prismaBooking: PrismaBooking): Booking {
 *     return new Booking({
 *       id: prismaBooking.id,
 *       customerId: prismaBooking.customerId,
 *       // ... map properties
 *     })
 *   }
 *
 *   toPersistence(booking: Booking): PrismaBooking {
 *     return {
 *       id: booking.id,
 *       customerId: booking.customerId,
 *       // ... map properties
 *     }
 *   }
 * }
 * ```
 */
export interface IMapper<DomainEntity, PersistenceModel> {
  /**
   * Convert persistence model to domain entity
   */
  toDomain(persistence: PersistenceModel): DomainEntity

  /**
   * Convert domain entity to persistence model
   */
  toPersistence(domain: DomainEntity): PersistenceModel

  /**
   * Convert array of persistence models to domain entities
   */
  toDomainList?(persistence: PersistenceModel[]): DomainEntity[]

  /**
   * Convert array of domain entities to persistence models
   */
  toPersistenceList?(domain: DomainEntity[]): PersistenceModel[]
}

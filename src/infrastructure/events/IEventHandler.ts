import type { IDomainEvent } from './IDomainEvent'

/**
 * Interface for domain event handlers.
 *
 * Each handler reacts to a specific event type. Handlers run in
 * isolation -- if one fails, others still execute.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IEventHandler<T extends IDomainEvent<any> = IDomainEvent> {
  handle(event: T): Promise<void>
}

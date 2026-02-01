import type { IDomainEvent } from './IDomainEvent'

/**
 * Interface for dispatching domain events to registered handlers.
 */
export interface IEventDispatcher {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch(event: IDomainEvent<any>): Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatchAll(events: IDomainEvent<any>[]): Promise<void>
}

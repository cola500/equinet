import type { IDomainEvent } from './IDomainEvent'
import type { IEventHandler } from './IEventHandler'
import type { IEventDispatcher } from './IEventDispatcher'
import { logger } from '@/lib/logger'

/**
 * In-memory event dispatcher. Serverless-safe: create per request, no globals.
 *
 * Each handler runs in its own try-catch so a failing handler
 * does NOT block other handlers or the HTTP response.
 */
export class InMemoryEventDispatcher implements IEventDispatcher {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<string, IEventHandler<IDomainEvent<any>>[]>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(eventType: string, handler: IEventHandler<IDomainEvent<any>>): void {
    const existing = this.handlers.get(eventType) ?? []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async dispatch(event: IDomainEvent<any>): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? []

    for (const handler of handlers) {
      try {
        await handler.handle(event)
      } catch (error) {
        logger.error(`Event handler failed for ${event.eventType}`, error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async dispatchAll(events: IDomainEvent<any>[]): Promise<void> {
    for (const event of events) {
      await this.dispatch(event)
    }
  }
}

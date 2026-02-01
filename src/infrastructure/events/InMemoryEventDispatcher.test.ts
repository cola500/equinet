import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventDispatcher } from './InMemoryEventDispatcher'
import type { IDomainEvent } from './IDomainEvent'
import type { IEventHandler } from './IEventHandler'

function createTestEvent(overrides?: Partial<IDomainEvent>): IDomainEvent {
  return {
    eventId: 'evt-1',
    eventType: 'TEST_EVENT',
    occurredAt: new Date('2026-01-01'),
    payload: { foo: 'bar' },
    ...overrides,
  }
}

function createMockHandler(): IEventHandler & { handle: ReturnType<typeof vi.fn> } {
  return { handle: vi.fn().mockResolvedValue(undefined) }
}

describe('InMemoryEventDispatcher', () => {
  let dispatcher: InMemoryEventDispatcher

  beforeEach(() => {
    dispatcher = new InMemoryEventDispatcher()
  })

  it('dispatches event to a registered handler', async () => {
    const handler = createMockHandler()
    dispatcher.register('TEST_EVENT', handler)

    const event = createTestEvent()
    await dispatcher.dispatch(event)

    expect(handler.handle).toHaveBeenCalledWith(event)
    expect(handler.handle).toHaveBeenCalledTimes(1)
  })

  it('dispatches event to multiple handlers for same event type', async () => {
    const handler1 = createMockHandler()
    const handler2 = createMockHandler()
    dispatcher.register('TEST_EVENT', handler1)
    dispatcher.register('TEST_EVENT', handler2)

    const event = createTestEvent()
    await dispatcher.dispatch(event)

    expect(handler1.handle).toHaveBeenCalledWith(event)
    expect(handler2.handle).toHaveBeenCalledWith(event)
  })

  it('does not call handlers registered for a different event type', async () => {
    const handler = createMockHandler()
    dispatcher.register('OTHER_EVENT', handler)

    await dispatcher.dispatch(createTestEvent({ eventType: 'TEST_EVENT' }))

    expect(handler.handle).not.toHaveBeenCalled()
  })

  it('does nothing when no handlers are registered for event type', async () => {
    // Should not throw
    await expect(dispatcher.dispatch(createTestEvent())).resolves.toBeUndefined()
  })

  it('continues dispatching to other handlers when one handler throws', async () => {
    const failingHandler: IEventHandler = {
      handle: vi.fn().mockRejectedValue(new Error('Handler failed')),
    }
    const successHandler = createMockHandler()

    dispatcher.register('TEST_EVENT', failingHandler)
    dispatcher.register('TEST_EVENT', successHandler)

    const event = createTestEvent()
    // dispatch should NOT throw even though a handler fails
    await expect(dispatcher.dispatch(event)).resolves.toBeUndefined()

    expect(successHandler.handle).toHaveBeenCalledWith(event)
  })

  it('dispatches multiple events via dispatchAll', async () => {
    const handler = createMockHandler()
    dispatcher.register('TEST_EVENT', handler)

    const event1 = createTestEvent({ eventId: 'evt-1' })
    const event2 = createTestEvent({ eventId: 'evt-2' })
    await dispatcher.dispatchAll([event1, event2])

    expect(handler.handle).toHaveBeenCalledTimes(2)
    expect(handler.handle).toHaveBeenCalledWith(event1)
    expect(handler.handle).toHaveBeenCalledWith(event2)
  })

  it('handles empty event array in dispatchAll', async () => {
    await expect(dispatcher.dispatchAll([])).resolves.toBeUndefined()
  })
})

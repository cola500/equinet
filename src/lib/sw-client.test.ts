import { describe, it, expect, vi, afterEach } from "vitest"
import { clearServiceWorkerUserCaches } from "./sw-client"
import { SW_MESSAGE_CLEAR_USER_CACHES, SW_MESSAGE_USER_CACHES_CLEARED } from "./sw-messages"

describe("clearServiceWorkerUserCaches", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("resolves immediately when serviceWorker is unsupported", async () => {
    vi.stubGlobal("navigator", {})
    await expect(clearServiceWorkerUserCaches()).resolves.toBeUndefined()
  })

  it("resolves immediately when there is no active controller", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: null } })
    await expect(clearServiceWorkerUserCaches()).resolves.toBeUndefined()
  })

  it("posts CLEAR_USER_CACHES and resolves when the SW acknowledges", async () => {
    const postMessage = vi.fn((_msg, ports: MessagePort[]) => {
      // Simulate the SW handling the message and replying on the port.
      ports[0].postMessage({ type: SW_MESSAGE_USER_CACHES_CLEARED })
    })
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } })

    await clearServiceWorkerUserCaches()

    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage.mock.calls[0][0]).toEqual({ type: SW_MESSAGE_CLEAR_USER_CACHES })
  })

  it("ignores unrelated messages on the port and still resolves on the real ack", async () => {
    const postMessage = vi.fn((_msg, ports: MessagePort[]) => {
      ports[0].postMessage({ type: "SOMETHING_ELSE" })
      ports[0].postMessage({ type: SW_MESSAGE_USER_CACHES_CLEARED })
    })
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } })

    await expect(clearServiceWorkerUserCaches()).resolves.toBeUndefined()
  })

  it("resolves via timeout if the SW never acknowledges", async () => {
    vi.useFakeTimers()
    const postMessage = vi.fn() // never replies
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } })

    const promise = clearServiceWorkerUserCaches(50)
    await vi.advanceTimersByTimeAsync(50)
    await expect(promise).resolves.toBeUndefined()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const mockGuardMutation = vi.fn(async (action: () => Promise<unknown>) => action())

const mockFetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id: "test-id", content: "test", notes: [] }),
    status: 200,
  })
) as unknown as typeof globalThis.fetch

vi.stubGlobal("fetch", mockFetch)

import { useCustomerNotes } from "./useCustomerNotes"

describe("useCustomerNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "note-new", content: "test", notes: [], customerId: "cust-1", providerId: "p1", createdAt: "2026-01-01", updatedAt: "2026-01-01" }),
      status: 200,
    } as never)
  })

  it("fetchNotes fetches and stores notes for a customer", async () => {
    const notes = [{ id: "n1", customerId: "cust-1", content: "hello", providerId: "p1", createdAt: "", updatedAt: "" }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ notes }),
      status: 200,
    } as never)

    const { result } = renderHook(() => useCustomerNotes(mockGuardMutation))

    await act(async () => {
      await result.current.fetchNotes("cust-1")
    })

    expect(result.current.customerNotes.get("cust-1")).toEqual(notes)
    expect(mockFetch).toHaveBeenCalledWith("/api/provider/customers/cust-1/notes")
  })

  it("fetchNotes skips if already cached", async () => {
    const notes = [{ id: "n1", customerId: "cust-1", content: "hello", providerId: "p1", createdAt: "", updatedAt: "" }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ notes }),
      status: 200,
    } as never)

    const { result } = renderHook(() => useCustomerNotes(mockGuardMutation))

    await act(async () => {
      await result.current.fetchNotes("cust-1")
    })
    mockFetch.mockClear()

    await act(async () => {
      await result.current.fetchNotes("cust-1")
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("handleAddNote passes offlineOptions with entityType customer-note", async () => {
    const { result } = renderHook(() => useCustomerNotes(mockGuardMutation))

    await act(async () => {
      await result.current.handleAddNote("cust-1", "Hello")
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "POST",
        url: "/api/provider/customers/cust-1/notes",
        entityType: "customer-note",
      })
    )
  })

  it("handleEditNote passes offlineOptions with entityType customer-note", async () => {
    const { result } = renderHook(() => useCustomerNotes(mockGuardMutation))
    const note = { id: "note-1", customerId: "cust-1", content: "old", providerId: "p1", createdAt: "", updatedAt: "" }

    await act(async () => {
      await result.current.handleEditNote(note, "updated")
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "PUT",
        url: "/api/provider/customers/cust-1/notes/note-1",
        entityType: "customer-note",
        entityId: "note-1",
      })
    )
  })

  it("handleDeleteNote passes offlineOptions with entityType customer-note", async () => {
    const { result } = renderHook(() => useCustomerNotes(mockGuardMutation))
    const note = { id: "note-2", customerId: "cust-1", content: "del", providerId: "p1", createdAt: "", updatedAt: "" }

    await act(async () => {
      await result.current.handleDeleteNote(note)
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "DELETE",
        entityType: "customer-note",
        entityId: "note-2",
      })
    )
  })

  it("clearNotesForCustomer removes cached notes", async () => {
    const notes = [{ id: "n1", customerId: "cust-1", content: "hello", providerId: "p1", createdAt: "", updatedAt: "" }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ notes }),
      status: 200,
    } as never)

    const { result } = renderHook(() => useCustomerNotes(mockGuardMutation))

    await act(async () => {
      await result.current.fetchNotes("cust-1")
    })
    expect(result.current.customerNotes.has("cust-1")).toBe(true)

    act(() => {
      result.current.clearNotesForCustomer("cust-1")
    })

    expect(result.current.customerNotes.has("cust-1")).toBe(false)
  })
})

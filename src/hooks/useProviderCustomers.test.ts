import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

// Mock guardMutation to capture offlineOptions
const mockGuardMutation = vi.fn(async (action: () => Promise<unknown>) => action())

vi.mock("./useOfflineGuard", () => ({
  useOfflineGuard: () => ({ guardMutation: mockGuardMutation, isOnline: true }),
}))

vi.mock("./useDialogState", () => ({
  useDialogState: () => ({
    open: false,
    openDialog: vi.fn(),
    close: vi.fn(),
    setOpen: vi.fn(),
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id: "test-id", content: "test", notes: [], customers: [], horses: [] }),
    status: 200,
  })
) as unknown as typeof globalThis.fetch

vi.stubGlobal("fetch", mockFetch)

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { useProviderCustomers } from "./useProviderCustomers"

describe("useProviderCustomers offline mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "test-id", content: "test", notes: [], customers: [], horses: [] }),
      status: 200,
    } as Response)
  })

  it("handleAddNote passes offlineOptions with entityType customer-note", async () => {
    const { result } = renderHook(() => useProviderCustomers(true))

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
    const { result } = renderHook(() => useProviderCustomers(true))

    const note = { id: "note-1", customerId: "cust-1", content: "old", createdAt: "", updatedAt: "" }

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
    const { result } = renderHook(() => useProviderCustomers(true))

    const note = { id: "note-2", customerId: "cust-1", content: "del", createdAt: "", updatedAt: "" }

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

  it("handleAddCustomer passes offlineOptions with entityType customer", async () => {
    const { result } = renderHook(() => useProviderCustomers(true))

    await act(async () => {
      await result.current.handleAddCustomer({
        firstName: "Anna",
        lastName: "Svensson",
        phone: "",
        email: "",
      })
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "POST",
        url: "/api/provider/customers",
        entityType: "customer",
      })
    )
  })

  it("handleEditCustomer passes offlineOptions with entityType customer", async () => {
    const { result } = renderHook(() => useProviderCustomers(true))

    await act(async () => {
      await result.current.handleEditCustomer("cust-1", {
        firstName: "Anna",
        lastName: "Ny",
        phone: "",
        email: "",
      })
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "PUT",
        url: "/api/provider/customers/cust-1",
        entityType: "customer",
        entityId: "cust-1",
      })
    )
  })

  it("handleSaveHorse passes offlineOptions with entityType customer-horse", async () => {
    const { result } = renderHook(() => useProviderCustomers(true))

    await act(async () => {
      await result.current.handleSaveHorse(
        "cust-1",
        { name: "Blansen", breed: "", birthYear: "", color: "", gender: "", specialNeeds: "", registrationNumber: "", microchipNumber: "" },
        false
      )
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "POST",
        url: "/api/provider/customers/cust-1/horses",
        entityType: "customer-horse",
      })
    )
  })

  it("handleDeleteHorse passes offlineOptions with entityType customer-horse", async () => {
    const { result } = renderHook(() => useProviderCustomers(true))

    // Set up horseToDelete state
    act(() => {
      result.current.setHorseToDelete({
        horse: { id: "horse-1", name: "Blansen", customerId: "cust-1" } as never,
        customerId: "cust-1",
      })
    })

    await act(async () => {
      await result.current.handleDeleteHorse()
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "DELETE",
        entityType: "customer-horse",
        entityId: "horse-1",
      })
    )
  })
})

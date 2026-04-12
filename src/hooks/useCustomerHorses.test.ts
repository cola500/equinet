import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockGuardMutation = vi.fn(async (action: () => Promise<unknown>) => action())

const mockFetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ horses: [], id: "horse-new", name: "Test" }),
    status: 200,
  })
) as unknown as typeof globalThis.fetch

vi.stubGlobal("fetch", mockFetch)

import { useCustomerHorses } from "./useCustomerHorses"

describe("useCustomerHorses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ horses: [], id: "horse-new", name: "Blansen" }),
      status: 200,
    } as never)
  })

  it("fetchHorses fetches and stores horses for a customer", async () => {
    const horses = [{ id: "h1", name: "Blansen", customerId: "cust-1" }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ horses }),
      status: 200,
    } as never)

    const { result } = renderHook(() => useCustomerHorses(mockGuardMutation))

    await act(async () => {
      await result.current.fetchHorses("cust-1")
    })

    expect(result.current.customerHorses.get("cust-1")).toEqual(horses)
    expect(mockFetch).toHaveBeenCalledWith("/api/provider/customers/cust-1/horses")
  })

  it("fetchHorses skips if already cached", async () => {
    const horses = [{ id: "h1", name: "Blansen", customerId: "cust-1" }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ horses }),
      status: 200,
    } as never)

    const { result } = renderHook(() => useCustomerHorses(mockGuardMutation))

    await act(async () => {
      await result.current.fetchHorses("cust-1")
    })
    mockFetch.mockClear()

    await act(async () => {
      await result.current.fetchHorses("cust-1")
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("handleSaveHorse (create) passes offlineOptions with entityType customer-horse", async () => {
    const { result } = renderHook(() => useCustomerHorses(mockGuardMutation))

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

  it("handleSaveHorse (edit) passes offlineOptions with PUT method", async () => {
    const { result } = renderHook(() => useCustomerHorses(mockGuardMutation))

    await act(async () => {
      await result.current.handleSaveHorse(
        "cust-1",
        { name: "Blansen", breed: "Warmblood", birthYear: "", color: "", gender: "", specialNeeds: "", registrationNumber: "", microchipNumber: "" },
        true,
        "horse-1"
      )
    })

    expect(mockGuardMutation).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        method: "PUT",
        url: "/api/provider/customers/cust-1/horses/horse-1",
        entityType: "customer-horse",
        entityId: "horse-1",
      })
    )
  })

  it("handleDeleteHorse passes offlineOptions with entityType customer-horse", async () => {
    const { result } = renderHook(() => useCustomerHorses(mockGuardMutation))

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

  it("clearHorsesForCustomer removes cached horses", async () => {
    const horses = [{ id: "h1", name: "Blansen", customerId: "cust-1" }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ horses }),
      status: 200,
    } as never)

    const { result } = renderHook(() => useCustomerHorses(mockGuardMutation))

    await act(async () => {
      await result.current.fetchHorses("cust-1")
    })
    expect(result.current.customerHorses.has("cust-1")).toBe(true)

    act(() => {
      result.current.clearHorsesForCustomer("cust-1")
    })

    expect(result.current.customerHorses.has("cust-1")).toBe(false)
  })
})

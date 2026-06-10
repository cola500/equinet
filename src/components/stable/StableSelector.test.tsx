import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { StableSelector } from "./StableSelector"

vi.mock("@/lib/client-logger", () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("StableSelector", () => {
  it("visar valt stall som text utan länk till stallägar-sidan", () => {
    // Stallägar-profilsidan (/stables/[id]) hör till stable_profiles och hålls
    // avstängd i denna slice — namnet ska därför inte vara en (död) länk.
    render(
      <StableSelector
        horseId="horse-1"
        currentStable={{ id: "stable-1", name: "Stall Solbacken", municipality: "Alingsås" }}
        onStableChanged={vi.fn()}
      />,
    )

    expect(screen.getByText("Stall Solbacken")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Stall Solbacken" })).not.toBeInTheDocument()
    expect(screen.getByText("Alingsås")).toBeInTheDocument()
  })

  it("parsar sökresultat ur API-svarets { data }-form", async () => {
    // API returnerar { data: [...] }. Komponenten måste läsa json.data, inte json.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "stable-1", name: "Stall Solbacken", municipality: "Alingsås" },
          { id: "stable-2", name: "Ekängens Ridklubb", municipality: "Vårgårda" },
        ],
      }),
    })

    render(
      <StableSelector horseId="horse-1" currentStable={null} onStableChanged={vi.fn()} />,
    )

    fireEvent.change(screen.getByPlaceholderText("Sök stall..."), {
      target: { value: "stall" },
    })

    await waitFor(() => {
      expect(screen.getByText("Stall Solbacken")).toBeInTheDocument()
    })
    expect(screen.getByText("Ekängens Ridklubb")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stables?search=stall"),
    )
  })

  it("kopplar häst till valt stall via PATCH", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: "stable-1", name: "Stall Solbacken", municipality: null }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const onStableChanged = vi.fn()
    render(
      <StableSelector horseId="horse-1" currentStable={null} onStableChanged={onStableChanged} />,
    )

    fireEvent.change(screen.getByPlaceholderText("Sök stall..."), {
      target: { value: "stall" },
    })
    await waitFor(() => expect(screen.getByText("Stall Solbacken")).toBeInTheDocument())

    fireEvent.click(screen.getByText("Stall Solbacken"))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/horses/horse-1/stable",
        expect.objectContaining({ method: "PATCH" }),
      )
    })
    expect(onStableChanged).toHaveBeenCalledWith(
      expect.objectContaining({ id: "stable-1" }),
    )
  })
})

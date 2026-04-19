import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, beforeEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isLoading: false, isCustomer: true }),
}))

const mockMutate = vi.fn()
const mockHorsesList = vi.fn()
vi.mock("@/hooks/useHorses", () => ({
  useHorses: () => mockHorsesList(),
}))

vi.mock("@/hooks/useDueForService", () => ({
  useDueForService: () => ({ items: [] }),
}))

vi.mock("@/components/layout/CustomerLayout", () => ({
  CustomerLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/horses/HorseForm", () => ({
  HorseForm: ({ onSubmit }: { onSubmit: (e: React.FormEvent) => void }) => (
    <form onSubmit={onSubmit} data-testid="horse-form">
      <button type="submit">Spara</button>
    </form>
  ),
  emptyHorseForm: { name: "", breed: "", birthYear: "", color: "", gender: "", specialNeeds: "", registrationNumber: "", microchipNumber: "" },
}))

vi.mock("@/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/components/ui/image-upload", () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}))

vi.mock("@/components/loading/HorseCardSkeleton", () => ({
  HorseCardSkeleton: () => <div data-testid="skeleton" />,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/client-logger", () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import CustomerHorsesPage from "./page"
import { toast } from "sonner"

const mockHorse = {
  id: "horse-1",
  name: "Blansen",
  breed: "Fjordhäst",
  birthYear: 2015,
  color: "Brun",
  gender: "mare",
  specialNeeds: null,
  registrationNumber: null,
  microchipNumber: null,
  photoUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

function renderWithHorses(horses = [mockHorse]) {
  mockHorsesList.mockReturnValue({ horses, isLoading: false, mutate: mockMutate })
  return render(<CustomerHorsesPage />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CustomerHorsesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it("renders empty state when no horses", () => {
    mockHorsesList.mockReturnValue({ horses: [], isLoading: false, mutate: mockMutate })
    render(<CustomerHorsesPage />)
    expect(screen.getByText(/inga hästar registrerade/i)).toBeInTheDocument()
  })

  it("renders horse list when horses exist", () => {
    renderWithHorses()
    expect(screen.getByText("Blansen")).toBeInTheDocument()
    expect(screen.getByText(/fjordhäst/i)).toBeInTheDocument()
  })

  it("shows skeleton when loading", () => {
    mockHorsesList.mockReturnValue({ horses: [], isLoading: true, mutate: mockMutate })
    render(<CustomerHorsesPage />)
    expect(screen.getByTestId("skeleton")).toBeInTheDocument()
  })

  it("opens delete confirmation dialog when 'Ta bort' is clicked", async () => {
    const user = userEvent.setup()
    renderWithHorses()

    // Use getAllByRole + [0] to avoid ambiguity if dialog is already in DOM
    await user.click(screen.getAllByRole("button", { name: /ta bort/i })[0])

    expect(screen.getByText(/ta bort blansen/i)).toBeInTheDocument()
    expect(screen.getByText(/befintliga bokningar/i)).toBeInTheDocument()
  })

  it("closes delete dialog and calls DELETE fetch when confirmed", async () => {
    const user = userEvent.setup()
    renderWithHorses()

    await user.click(screen.getAllByRole("button", { name: /ta bort/i })[0])
    // Confirm button has exact text "Ta bort" (AlertDialogAction)
    await user.click(screen.getByRole("button", { name: /^ta bort$/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/horses/horse-1", { method: "DELETE" })
    })
    expect(toast.success).toHaveBeenCalledWith("Blansen har tagits bort")
    expect(mockMutate).toHaveBeenCalled()
  })

  it("closes delete dialog without fetch when cancel is clicked", async () => {
    const user = userEvent.setup()
    renderWithHorses()

    await user.click(screen.getAllByRole("button", { name: /ta bort/i })[0])
    await user.click(screen.getByRole("button", { name: /avbryt/i }))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.queryByText(/ta bort blansen/i)).not.toBeInTheDocument()
  })

  it("shows toast error when delete fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const user = userEvent.setup()
    renderWithHorses()

    await user.click(screen.getAllByRole("button", { name: /ta bort/i })[0])
    await user.click(screen.getByRole("button", { name: /^ta bort$/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Kunde inte ta bort häst")
    })
  })
})

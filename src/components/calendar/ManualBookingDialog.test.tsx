import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ManualBookingDialog } from "./ManualBookingDialog"

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockServices = [
  { id: "s1", name: "Hovvård", price: 500, durationMinutes: 60 },
]

describe("ManualBookingDialog prefill", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prefills date and time when props are provided", () => {
    render(
      <ManualBookingDialog
        open={true}
        onOpenChange={vi.fn()}
        services={mockServices}
        onBookingCreated={vi.fn()}
        prefillDate="2026-03-15"
        prefillTime="10:00"
      />
    )

    const dateInput = screen.getByLabelText("Datum") as HTMLInputElement
    expect(dateInput.value).toBe("2026-03-15")

    const startTimeSelect = screen.getByLabelText("Starttid") as HTMLSelectElement
    expect(startTimeSelect.value).toBe("10:00")
  })

  it("uses today's date when no prefillDate is provided", () => {
    const today = new Date().toISOString().slice(0, 10)

    render(
      <ManualBookingDialog
        open={true}
        onOpenChange={vi.fn()}
        services={mockServices}
        onBookingCreated={vi.fn()}
      />
    )

    const dateInput = screen.getByLabelText("Datum") as HTMLInputElement
    expect(dateInput.value).toBe(today)
  })

  it("uses empty start time when no prefillTime is provided", () => {
    render(
      <ManualBookingDialog
        open={true}
        onOpenChange={vi.fn()}
        services={mockServices}
        onBookingCreated={vi.fn()}
      />
    )

    const startTimeSelect = screen.getByLabelText("Starttid") as HTMLSelectElement
    expect(startTimeSelect.value).toBe("")
  })
})

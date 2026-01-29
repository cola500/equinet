import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DayColumn } from "./DayColumn"
import { TimeSlot } from "@/lib/utils/slotCalculator"

describe("DayColumn", () => {
  const mockSlots: TimeSlot[] = [
    { startTime: "09:00", endTime: "09:30", isAvailable: true },
    { startTime: "09:15", endTime: "09:45", isAvailable: false },
    { startTime: "09:30", endTime: "10:00", isAvailable: true },
  ]

  it("renders date header", () => {
    render(
      <DayColumn
        date="2026-01-05"
        slots={mockSlots}
        isClosed={false}
        selectedTime={null}
        onSlotSelect={() => {}}
      />
    )

    // Should show day name and date
    expect(screen.getByText(/mån/i)).toBeInTheDocument()
    // Check for the day number in the header specifically
    const header = screen.getByText(/mån/i).parentElement
    expect(header?.textContent).toContain("5")
  })

  it("renders all time slots", () => {
    render(
      <DayColumn
        date="2026-01-05"
        slots={mockSlots}
        isClosed={false}
        selectedTime={null}
        onSlotSelect={() => {}}
      />
    )

    expect(screen.getByText("09:00")).toBeInTheDocument()
    expect(screen.getByText("09:15")).toBeInTheDocument()
    expect(screen.getByText("09:30")).toBeInTheDocument()
  })

  it("shows 'Stängt' when isClosed is true", () => {
    render(
      <DayColumn
        date="2026-01-05"
        slots={[]}
        isClosed={true}
        selectedTime={null}
        onSlotSelect={() => {}}
      />
    )

    expect(screen.getByText("Stängt")).toBeInTheDocument()
  })

  it("calls onSlotSelect when clicking an available slot", () => {
    const onSlotSelect = vi.fn()
    render(
      <DayColumn
        date="2026-01-05"
        slots={mockSlots}
        isClosed={false}
        selectedTime={null}
        onSlotSelect={onSlotSelect}
      />
    )

    fireEvent.click(screen.getByText("09:00"))
    expect(onSlotSelect).toHaveBeenCalledWith("2026-01-05", "09:00", "09:30")
  })

  it("marks the selected slot", () => {
    render(
      <DayColumn
        date="2026-01-05"
        slots={mockSlots}
        isClosed={false}
        selectedTime="09:00"
        onSlotSelect={() => {}}
      />
    )

    // The 09:00 button should have ring styling
    const selectedButton = screen.getByText("09:00").closest("button")
    expect(selectedButton?.className).toMatch(/ring/)
  })

  it("shows unavailable slots as disabled when all are booked", () => {
    const bookedSlots: TimeSlot[] = [
      { startTime: "09:00", endTime: "09:30", isAvailable: false },
      { startTime: "09:15", endTime: "09:45", isAvailable: false },
    ]

    render(
      <DayColumn
        date="2026-01-05"
        slots={bookedSlots}
        isClosed={false}
        selectedTime={null}
        onSlotSelect={() => {}}
      />
    )

    // Slots should be rendered but disabled (gray)
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(2)
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
      expect(button.className).toMatch(/bg-gray/)
    })
  })
})

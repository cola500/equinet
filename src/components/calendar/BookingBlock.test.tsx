import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BookingBlock } from "./BookingBlock"
import { CalendarBooking } from "@/types"

const booking: CalendarBooking = {
  id: "b1",
  bookingDate: "2026-03-16",
  startTime: "10:00",
  endTime: "10:30",
  status: "confirmed",
  service: { name: "Hovvård", price: 800 },
  customer: { firstName: "Anna", lastName: "Svensson", email: "anna@test.com" },
}

describe("BookingBlock -- touch target", () => {
  it("har 44px minimihöjd på mobil och 28px från sm och uppåt", () => {
    render(<BookingBlock booking={booking} onClick={vi.fn()} />)
    const block = screen.getByRole("button")
    expect(block).toHaveClass("min-h-[44px]", "sm:min-h-[28px]")
  })

  it("sätter inte minHeight inline, som skulle slå ut responsiva klasser", () => {
    render(<BookingBlock booking={booking} onClick={vi.fn()} />)
    expect(screen.getByRole("button").style.minHeight).toBe("")
  })
})

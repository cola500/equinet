import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PendingBookingsBanner } from "./PendingBookingsBanner"
import { CalendarBooking } from "@/types"

function createBooking(overrides: Partial<CalendarBooking> = {}): CalendarBooking {
  return {
    id: "b1",
    bookingDate: "2026-03-15",
    startTime: "10:00",
    endTime: "11:00",
    status: "pending",
    service: { name: "Hovvård", price: 800 },
    customer: { firstName: "Anna", lastName: "Svensson", email: "anna@test.com" },
    ...overrides,
  }
}

describe("PendingBookingsBanner", () => {
  it("renderar ingenting vid 0 pending", () => {
    const { container } = render(
      <PendingBookingsBanner pendingBookings={[]} onBookingClick={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("visar rätt antal i badge", () => {
    const bookings = [
      createBooking({ id: "b1" }),
      createBooking({ id: "b2" }),
      createBooking({ id: "b3" }),
    ]
    render(
      <PendingBookingsBanner pendingBookings={bookings} onBookingClick={vi.fn()} />
    )
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("visar singular text för 1 bokning", () => {
    render(
      <PendingBookingsBanner
        pendingBookings={[createBooking()]}
        onBookingClick={vi.fn()}
      />
    )
    expect(screen.getByText(/1 bokning väntar/i)).toBeInTheDocument()
  })

  it("visar plural text för flera bokningar", () => {
    const bookings = [
      createBooking({ id: "b1" }),
      createBooking({ id: "b2" }),
      createBooking({ id: "b3" }),
    ]
    render(
      <PendingBookingsBanner pendingBookings={bookings} onBookingClick={vi.fn()} />
    )
    expect(screen.getByText(/3 bokningar väntar/i)).toBeInTheDocument()
  })

  it("expanderar lista vid klick", async () => {
    const user = userEvent.setup()
    render(
      <PendingBookingsBanner
        pendingBookings={[createBooking()]}
        onBookingClick={vi.fn()}
      />
    )

    // Listan ska inte vara synlig initialt
    expect(screen.queryByText("Hovvård")).not.toBeInTheDocument()

    // Klicka på bannern för att expandera
    await user.click(screen.getByRole("button", { name: /bokning väntar/i }))

    // Nu ska listan visas
    expect(screen.getByText("Hovvård")).toBeInTheDocument()
  })

  it("kollapsar vid andra klick", async () => {
    const user = userEvent.setup()
    render(
      <PendingBookingsBanner
        pendingBookings={[createBooking()]}
        onBookingClick={vi.fn()}
      />
    )

    const toggleButton = screen.getByRole("button", { name: /bokning väntar/i })

    // Expandera
    await user.click(toggleButton)
    expect(screen.getByText("Hovvård")).toBeInTheDocument()

    // Kollapsa
    await user.click(toggleButton)
    expect(screen.queryByText("Hovvård")).not.toBeInTheDocument()
  })

  it("anropar onBookingClick med rätt bokning vid klick på rad", async () => {
    const user = userEvent.setup()
    const booking = createBooking()
    const onClick = vi.fn()

    render(
      <PendingBookingsBanner pendingBookings={[booking]} onBookingClick={onClick} />
    )

    // Expandera listan
    await user.click(screen.getByRole("button", { name: /bokning väntar/i }))

    // Klicka på bokningsraden
    await user.click(screen.getByText("Hovvård"))

    expect(onClick).toHaveBeenCalledWith(booking)
  })

  it("visar hästnamn om det finns", async () => {
    const user = userEvent.setup()
    const booking = createBooking({ horseName: "Blansen" })

    render(
      <PendingBookingsBanner pendingBookings={[booking]} onBookingClick={vi.fn()} />
    )

    await user.click(screen.getByRole("button", { name: /bokning väntar/i }))
    expect(screen.getByText(/Blansen/)).toBeInTheDocument()
  })

  it("visar datum och tid för varje bokning", async () => {
    const user = userEvent.setup()
    const booking = createBooking({
      bookingDate: "2026-03-15",
      startTime: "10:00",
      endTime: "11:00",
    })

    render(
      <PendingBookingsBanner pendingBookings={[booking]} onBookingClick={vi.fn()} />
    )

    await user.click(screen.getByRole("button", { name: /bokning väntar/i }))
    expect(screen.getByText(/15 mar/i)).toBeInTheDocument()
    expect(screen.getByText(/10:00/)).toBeInTheDocument()
  })
})

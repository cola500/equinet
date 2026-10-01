import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MonthCalendar } from "./MonthCalendar"
import { CalendarBooking } from "@/types"

// Oktober 2026; 14 oktober är en onsdag i månadsgridet
const currentDate = new Date(2026, 9, 15)

function booking(overrides: Partial<CalendarBooking> = {}): CalendarBooking {
  return {
    id: "b1",
    bookingDate: "2026-10-14",
    startTime: "10:00",
    endTime: "11:00",
    status: "confirmed",
    service: { name: "Hovvård", price: 800 },
    customer: { firstName: "Anna", lastName: "Svensson", email: "anna@test.com" },
    ...overrides,
  }
}

function renderMonth(
  props: Partial<React.ComponentProps<typeof MonthCalendar>> = {}
) {
  const onBookingClick = vi.fn()
  const onTimeSlotClick = vi.fn()
  const onDateClick = vi.fn()
  const utils = render(
    <MonthCalendar
      currentDate={currentDate}
      bookings={[booking()]}
      onBookingClick={onBookingClick}
      onTimeSlotClick={onTimeSlotClick}
      onDateClick={onDateClick}
      {...props}
    />
  )
  return { ...utils, onBookingClick, onTimeSlotClick, onDateClick }
}

describe("MonthCalendar -- tangentbord och tillgänglighet", () => {
  it("har inga nästlade interaktiva element", () => {
    const { container } = renderMonth()
    expect(container.querySelectorAll("button button")).toHaveLength(0)
    expect(container.querySelectorAll('[role="button"] button')).toHaveLength(0)
    expect(container.querySelectorAll('[role="button"] [role="button"]')).toHaveLength(0)
  })

  it("ger varje dag en datumknapp med beskrivande label", () => {
    renderMonth()
    expect(screen.getByRole("button", { name: "Ny bokning 14 oktober" })).toBeInTheDocument()
  })

  it("märker datumknappen 'Ändra tillgänglighet' när bara onDateClick finns", async () => {
    const user = userEvent.setup()
    const { onDateClick } = renderMonth({ onTimeSlotClick: undefined })
    await user.click(screen.getByRole("button", { name: "Ändra tillgänglighet 14 oktober" }))
    expect(onDateClick).toHaveBeenCalledWith("2026-10-14")
  })

  it("har ingen datumknapp när varken onTimeSlotClick eller onDateClick finns", () => {
    renderMonth({ onTimeSlotClick: undefined, onDateClick: undefined })
    expect(screen.queryByRole("button", { name: /14 oktober/ })).not.toBeInTheDocument()
  })

  it("Enter på datumknappen öppnar en dialog och flyttar fokus till Skapa bokning", async () => {
    const user = userEvent.setup()
    renderMonth()
    screen.getByRole("button", { name: "Ny bokning 14 oktober" }).focus()
    await user.keyboard("{Enter}")
    const dialog = screen.getByRole("dialog", { name: /ny bokning 14 oktober/i })
    expect(within(dialog).getByRole("button", { name: "Skapa bokning" })).toHaveFocus()
  })

  it("Escape stänger dialogen och återställer fokus till datumknappen", async () => {
    const user = userEvent.setup()
    renderMonth()
    const dateButton = screen.getByRole("button", { name: "Ny bokning 14 oktober" })
    dateButton.focus()
    await user.keyboard("{Enter}")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(dateButton).toHaveFocus()
  })

  it("Skapa bokning anropar onTimeSlotClick och återställer fokus till datumknappen", async () => {
    const user = userEvent.setup()
    const { onTimeSlotClick } = renderMonth()
    const dateButton = screen.getByRole("button", { name: "Ny bokning 14 oktober" })
    dateButton.focus()
    await user.keyboard("{Enter}")
    await user.keyboard("{Enter}")
    expect(onTimeSlotClick).toHaveBeenCalledWith("2026-10-14", "")
    expect(dateButton).toHaveFocus()
  })

  it("Ändra tillgänglighet i dialogen anropar onDateClick", async () => {
    const user = userEvent.setup()
    const { onDateClick } = renderMonth()
    screen.getByRole("button", { name: "Ny bokning 14 oktober" }).focus()
    await user.keyboard("{Enter}")
    await user.click(screen.getByRole("button", { name: "Ändra tillgänglighet" }))
    expect(onDateClick).toHaveBeenCalledWith("2026-10-14")
  })

  it("bokningschip är knappar vars namn innehåller tid, tjänst och status", () => {
    renderMonth()
    expect(
      screen.getByRole("button", { name: "10:00 Hovvård, Bekräftad" })
    ).toBeInTheDocument()
  })

  it("använder svensk statusetikett även för väntande och avbokade bokningar", () => {
    renderMonth({
      bookings: [
        booking({ id: "p", status: "pending", startTime: "09:00" }),
        booking({ id: "c", status: "cancelled", startTime: "12:00" }),
      ],
    })
    expect(screen.getByRole("button", { name: "09:00 Hovvård, Väntar på svar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "12:00 Hovvård, Avbokad" })).toBeInTheDocument()
  })

  it("Enter på ett chip öppnar bokningen och inte dagens dialog", async () => {
    const user = userEvent.setup()
    const b = booking()
    const { onBookingClick } = renderMonth({ bookings: [b] })
    screen.getByRole("button", { name: "10:00 Hovvård, Bekräftad" }).focus()
    await user.keyboard("{Enter}")
    expect(onBookingClick).toHaveBeenCalledWith(b)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("visar en dekorativ statusikon i varje chip (status får inte bara bero på färg)", () => {
    renderMonth()
    const chip = screen.getByRole("button", { name: "10:00 Hovvård, Bekräftad" })
    const icon = chip.querySelector("svg")
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute("aria-hidden", "true")
  })

  it("mus: klick på cellen öppnar dialogen utan att flytta fokus in i den", async () => {
    const user = userEvent.setup()
    renderMonth()
    const dateButton = screen.getByRole("button", { name: "Ny bokning 14 oktober" })
    // Cellen är dateButtonens förälder; klicka på cellens tomma yta
    await user.click(dateButton.closest("div.relative")!)
    const dialog = screen.getByRole("dialog", { name: /ny bokning 14 oktober/i })
    expect(within(dialog).getByRole("button", { name: "Skapa bokning" })).not.toHaveFocus()
  })

  it("mus: klick på datumsiffran öppnar dialogen utan att flytta fokus in i den", async () => {
    const user = userEvent.setup()
    renderMonth()
    await user.click(screen.getByRole("button", { name: "Ny bokning 14 oktober" }))
    const dialog = screen.getByRole("dialog", { name: /ny bokning 14 oktober/i })
    expect(within(dialog).getByRole("button", { name: "Skapa bokning" })).not.toHaveFocus()
  })

  it("en tidigare tangentbordsöppning påverkar inte nästa musklick", async () => {
    const user = userEvent.setup()
    renderMonth()
    const dateButton = screen.getByRole("button", { name: "Ny bokning 14 oktober" })
    dateButton.focus()
    await user.keyboard("{Enter}")
    await user.keyboard("{Escape}")
    await user.click(dateButton)
    const dialog = screen.getByRole("dialog", { name: /ny bokning 14 oktober/i })
    expect(within(dialog).getByRole("button", { name: "Skapa bokning" })).not.toHaveFocus()
  })

  it("alla bokningsstatusar får en dekorativ ikon", () => {
    renderMonth({
      bookings: [
        booking({ id: "1", status: "pending", startTime: "08:00", bookingDate: "2026-10-01" }),
        booking({ id: "2", status: "confirmed", startTime: "09:00", bookingDate: "2026-10-02" }),
        booking({ id: "3", status: "completed", startTime: "10:00", bookingDate: "2026-10-03" }),
        booking({ id: "4", status: "cancelled", startTime: "11:00", bookingDate: "2026-10-04" }),
        booking({ id: "5", status: "no_show", startTime: "12:00", bookingDate: "2026-10-05" }),
        booking({
          id: "6",
          status: "confirmed",
          startTime: "13:00",
          bookingDate: "2026-10-06",
          payment: { status: "succeeded" } as CalendarBooking["payment"],
        }),
      ],
    })
    // En bokning per dag så att alla sex chips är synliga (max 3 per dag visas)
    const chips = screen.getAllByRole("button", { name: /^\d\d:\d\d .*, / })
    expect(chips).toHaveLength(6)
    for (const chip of chips) {
      expect(chip.querySelector('svg[aria-hidden="true"]'), chip.getAttribute("aria-label") ?? "").not.toBeNull()
    }
  })

  it("använder olika ikoner för olika statusar", () => {
    renderMonth({
      bookings: [
        booking({ id: "a", status: "confirmed", startTime: "08:00" }),
        booking({ id: "b", status: "pending", startTime: "09:00" }),
      ],
    })
    const confirmed = screen.getByRole("button", { name: /Bekräftad/ }).querySelector("svg")!
    const pending = screen.getByRole("button", { name: /Väntar på svar/ }).querySelector("svg")!
    expect(confirmed.getAttribute("class")).not.toBe(pending.getAttribute("class"))
  })
})

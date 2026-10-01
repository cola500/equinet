import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WeekCalendar, positionToTime, getNowPosition } from "./WeekCalendar"
import { AvailabilityDay, CalendarBooking } from "@/types"

describe("positionToTime", () => {
  it("converts 0% to 08:00 (start of day)", () => {
    expect(positionToTime(0)).toBe("08:00")
  })

  it("converts 50% to 13:00 (midday)", () => {
    expect(positionToTime(50)).toBe("13:00")
  })

  it("converts 100% to 18:00 (end of day)", () => {
    expect(positionToTime(100)).toBe("18:00")
  })

  it("snaps 32.5% to 11:15 (nearest 15-min interval)", () => {
    // 32.5% of 600 min = 195 min -> already on 15-min boundary -> 08:00 + 3h15m = 11:15
    expect(positionToTime(32.5)).toBe("11:15")
  })

  it("snaps 34.2% to 11:30 (nearest 15-min interval)", () => {
    // 34.2% of 600 min = 205.2 min -> round to nearest 15 = 210 -> 08:00 + 3h30m = 11:30
    expect(positionToTime(34.2)).toBe("11:30")
  })

  it("clamps negative values to 08:00", () => {
    expect(positionToTime(-10)).toBe("08:00")
  })

  it("clamps values above 100 to 18:00", () => {
    expect(positionToTime(150)).toBe("18:00")
  })
})

describe("getNowPosition", () => {
  it("returns percentage for time within 08:00-18:00", () => {
    // 12:00 = 4h into 10h range = 40%
    expect(getNowPosition(12, 0)).toBe(40)
  })

  it("returns 0 at exactly 08:00", () => {
    expect(getNowPosition(8, 0)).toBe(0)
  })

  it("returns 100 at exactly 18:00", () => {
    expect(getNowPosition(18, 0)).toBe(100)
  })

  it("handles half hours correctly", () => {
    // 13:30 = 5.5h into 10h range = 55%
    expect(getNowPosition(13, 30)).toBeCloseTo(55, 5)
  })

  it("returns null before START_HOUR", () => {
    expect(getNowPosition(7, 30)).toBeNull()
  })

  it("returns null after END_HOUR", () => {
    expect(getNowPosition(18, 30)).toBeNull()
  })
})

describe("WeekCalendar -- tangentbordsbokning i dagkolumnen", () => {
  // Måndag 2026-03-16, dagvy => en enda kolumn
  const monday = new Date(2026, 2, 16)
  const openMonday: AvailabilityDay[] = [
    { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isClosed: false },
  ]
  const booking: CalendarBooking = {
    id: "b1",
    bookingDate: "2026-03-16",
    startTime: "10:00",
    endTime: "11:00",
    status: "confirmed",
    service: { name: "Hovvård", price: 800 },
    customer: { firstName: "Anna", lastName: "Svensson", email: "anna@test.com" },
  }

  function renderCalendar(
    props: Partial<React.ComponentProps<typeof WeekCalendar>> = {}
  ) {
    const onTimeSlotClick = vi.fn()
    const onBookingClick = vi.fn()
    render(
      <WeekCalendar
        currentDate={monday}
        bookings={[]}
        availability={openMonday}
        viewMode="day"
        onBookingClick={onBookingClick}
        onTimeSlotClick={onTimeSlotClick}
        {...props}
      />
    )
    return { onTimeSlotClick, onBookingClick }
  }

  it("exponerar dagkolumnen som fokuserbar knapp med beskrivande label", () => {
    renderCalendar()
    const column = screen.getByRole("button", { name: /ny bokning.*16 mars/i })
    expect(column).toHaveAttribute("tabindex", "0")
  })

  it("öppnar popup vid första öppettid när man trycker Enter", async () => {
    const user = userEvent.setup()
    renderCalendar()
    screen.getByRole("button", { name: /ny bokning.*16 mars/i }).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByText(/Ny bokning 16 mars kl 09:00\?/)).toBeInTheDocument()
  })

  it("öppnar popup med mellanslag", async () => {
    const user = userEvent.setup()
    renderCalendar()
    screen.getByRole("button", { name: /ny bokning.*16 mars/i }).focus()
    await user.keyboard(" ")
    expect(screen.getByText(/kl 09:00/)).toBeInTheDocument()
  })

  it("flyttar fokus till Skapa bokning så att flödet kan slutföras med tangentbord", async () => {
    const user = userEvent.setup()
    const { onTimeSlotClick } = renderCalendar()
    screen.getByRole("button", { name: /ny bokning.*16 mars/i }).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("button", { name: "Skapa bokning" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onTimeSlotClick).toHaveBeenCalledWith("2026-03-16", "09:00")
  })

  it("faller tillbaka på 08:00 när dagen saknar öppettider", async () => {
    const user = userEvent.setup()
    renderCalendar({ availability: [] })
    screen.getByRole("button", { name: /ny bokning.*16 mars/i }).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByText(/kl 08:00/)).toBeInTheDocument()
  })

  it("bokningsblock aktiverat med tangentbord öppnar bokningen, inte popupen", async () => {
    const user = userEvent.setup()
    const { onBookingClick } = renderCalendar({ bookings: [booking] })
    screen.getByRole("button", { name: /Hovvård/ }).focus()
    await user.keyboard("{Enter}")
    expect(onBookingClick).toHaveBeenCalledWith(booking)
    expect(screen.queryByText(/Ny bokning 16 mars kl/)).not.toBeInTheDocument()
  })

  it("Escape stänger popupen och återställer fokus till dagkolumnen", async () => {
    const user = userEvent.setup()
    renderCalendar()
    const column = screen.getByRole("button", { name: /ny bokning.*16 mars/i })
    column.focus()
    await user.keyboard("{Enter}")
    expect(screen.getByText(/kl 09:00/)).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByText(/kl 09:00/)).not.toBeInTheDocument()
    expect(column).toHaveFocus()
  })

  it("återställer fokus till dagkolumnen efter Skapa bokning", async () => {
    const user = userEvent.setup()
    const { onTimeSlotClick } = renderCalendar()
    const column = screen.getByRole("button", { name: /ny bokning.*16 mars/i })
    column.focus()
    await user.keyboard("{Enter}")
    await user.keyboard("{Enter}")
    expect(onTimeSlotClick).toHaveBeenCalledTimes(1)
    expect(column).toHaveFocus()
  })

  it("är inte en knapp när onTimeSlotClick saknas", () => {
    renderCalendar({ onTimeSlotClick: undefined })
    expect(
      screen.queryByRole("button", { name: /ny bokning/i })
    ).not.toBeInTheDocument()
  })
})

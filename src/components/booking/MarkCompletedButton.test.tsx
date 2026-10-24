import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MarkCompletedButton } from "./MarkCompletedButton"

// Base example: 10 Nov 2026, 10:00–11:00 Stockholm (UTC+1) => ends 10:00 UTC
const booking = {
  bookingDate: "2026-11-10T00:00:00.000Z",
  endTime: "11:00",
  timezone: "Europe/Stockholm",
}

describe("MarkCompletedButton", () => {
  it("SC-BOOK-003 – knappen är inaktiverad med förklaring medan besöket pågår", () => {
    const onClick = vi.fn()
    render(<MarkCompletedButton booking={booking} onClick={onClick} now={new Date("2026-11-10T09:30:00.000Z")} />)

    const button = screen.getByRole("button", { name: "Markera som genomförd" })
    expect(button).toBeDisabled()
    expect(screen.getByText("Kan markeras som genomförd efter kl. 11:00")).toBeInTheDocument()

    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it("SC-BOOK-001 – knappen är aktiv efter sluttid och anropar onClick", () => {
    const onClick = vi.fn()
    render(<MarkCompletedButton booking={booking} onClick={onClick} now={new Date("2026-11-10T10:30:00.000Z")} />)

    const button = screen.getByRole("button", { name: "Markera som genomförd" })
    expect(button).toBeEnabled()
    expect(screen.queryByText(/Kan markeras som genomförd efter/)).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("SC-BOOK-005 – knappen är aktiv exakt vid sluttid", () => {
    render(<MarkCompletedButton booking={booking} onClick={vi.fn()} now={new Date("2026-11-10T10:00:00.000Z")} />)

    expect(screen.getByRole("button", { name: "Markera som genomförd" })).toBeEnabled()
  })

  it("utan tidszon från servern används Europe/Stockholm, inte webbläsarens tidszon", () => {
    render(
      <MarkCompletedButton
        booking={{ bookingDate: booking.bookingDate, endTime: booking.endTime }}
        onClick={vi.fn()}
        now={new Date("2026-11-10T09:59:00.000Z")}
      />
    )

    expect(screen.getByRole("button", { name: "Markera som genomförd" })).toBeDisabled()
  })
})

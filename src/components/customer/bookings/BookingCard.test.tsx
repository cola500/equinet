import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BookingCard } from "./BookingCard"
import type { Booking } from "./types"

vi.mock("./MessagingDialog", () => ({
  MessagingDialog: () => null,
}))

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    bookingDate: "2026-11-10T00:00:00.000Z",
    startTime: "10:00",
    endTime: "11:00",
    status: "confirmed",
    rescheduleCount: 0,
    service: { name: "Hovslagning", price: 800, durationMinutes: 60 },
    provider: {
      businessName: "Eriks Hovvård",
      rescheduleEnabled: false,
      rescheduleWindowHours: 24,
      maxReschedules: 0,
      rescheduleRequiresApproval: false,
      user: { firstName: "Erik", lastName: "Järnfot" },
    },
    payment: null,
    review: null,
    type: "fixed",
    ...overrides,
  }
}

function renderCard(booking: Booking) {
  return render(
    <BookingCard
      booking={booking}
      index={0}
      payingBookingId={null}
      deletingReviewId={null}
      showPayment
      onPayment={vi.fn()}
      onCancel={vi.fn()}
      onReview={vi.fn()}
      onReschedule={vi.fn()}
      onDeleteReview={vi.fn()}
    />
  )
}

describe("BookingCard – betalning (BR-PAY-001)", () => {
  it("SC-PAY-001 – utförd och obetald bokning visar Betala", () => {
    renderCard(makeBooking({ status: "completed" }))

    expect(screen.getByRole("button", { name: "Betala 800 kr" })).toBeInTheDocument()
    expect(screen.queryByText("Betalning öppnas när besöket är genomfört")).not.toBeInTheDocument()
  })

  it("SC-PAY-003 – bekräftad bokning visar ingen Betala-knapp men förklarar när betalning öppnas", () => {
    renderCard(makeBooking({ status: "confirmed" }))

    expect(screen.queryByRole("button", { name: /Betala/ })).not.toBeInTheDocument()
    expect(screen.getByText("Betalning öppnas när besöket är genomfört")).toBeInTheDocument()
  })

  it("SC-PAY-002 – väntande bokning visar varken Betala eller förklaring", () => {
    renderCard(makeBooking({ status: "pending" }))

    expect(screen.queryByRole("button", { name: /Betala/ })).not.toBeInTheDocument()
    expect(screen.queryByText("Betalning öppnas när besöket är genomfört")).not.toBeInTheDocument()
  })

  it("SC-PAY-005 – utebliven kund visar ingen Betala", () => {
    renderCard(makeBooking({ status: "no_show" }))

    expect(screen.queryByRole("button", { name: /Betala/ })).not.toBeInTheDocument()
  })

  it("förklaringen visas inte när betalning är avstängd", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed" })}
        index={0}
        payingBookingId={null}
        deletingReviewId={null}
        onPayment={vi.fn()}
        onCancel={vi.fn()}
        onReview={vi.fn()}
        onReschedule={vi.fn()}
        onDeleteReview={vi.fn()}
      />
    )

    expect(screen.queryByText("Betalning öppnas när besöket är genomfört")).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const mockGuardMutation = vi.fn(async (action: () => Promise<unknown>) => action())

vi.mock("@/hooks/useOfflineGuard", () => ({
  useOfflineGuard: () => ({ guardMutation: mockGuardMutation, isOnline: true }),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    isSupported: true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/components/booking/QuickNoteButton", () => ({
  QuickNoteButton: ({ bookingId }: { bookingId: string }) => (
    <button data-testid="quick-note-button" aria-label="Lägg till anteckning">
      QuickNote-{bookingId}
    </button>
  ),
}))

vi.mock("@/components/ui/voice-textarea", () => ({
  VoiceTextarea: ({ value, onChange, placeholder, ...props }: { value: string; onChange: (v: string) => void; placeholder?: string; [key: string]: unknown }) => (
    <textarea
      data-testid="voice-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      {...props}
    />
  ),
}))

import { BookingNotesSection } from "./BookingNotesSection"

describe("BookingNotesSection", () => {
  const defaultProps = {
    bookingId: "b1",
    providerNotes: null as string | null,
    status: "confirmed",
    onNotesUpdate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders existing note in blue box", () => {
    render(<BookingNotesSection {...defaultProps} providerNotes="Min anteckning" />)
    expect(screen.getByText("Min anteckning")).toBeInTheDocument()
    // The clickable container has bg-blue-50
    const blueBox = screen.getByText("Min anteckning").closest(".bg-blue-50")
    expect(blueBox).toBeInTheDocument()
  })

  it("shows 'Lägg till anteckning' link when no notes", () => {
    render(<BookingNotesSection {...defaultProps} />)
    const link = screen.getByText("Lägg till anteckning")
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe("BUTTON")
  })

  it("opens editing mode when clicking note", () => {
    render(<BookingNotesSection {...defaultProps} providerNotes="Min anteckning" />)
    fireEvent.click(screen.getByText("Min anteckning").closest("div")!)
    expect(screen.getByTestId("voice-textarea")).toBeInTheDocument()
  })

  it("pre-fills textarea with existing note", () => {
    render(<BookingNotesSection {...defaultProps} providerNotes="Befintlig text" />)
    fireEvent.click(screen.getByText("Befintlig text").closest("div")!)
    expect(screen.getByTestId("voice-textarea")).toHaveValue("Befintlig text")
  })

  it("opens empty textarea when clicking add link", () => {
    render(<BookingNotesSection {...defaultProps} />)
    fireEvent.click(screen.getByText("Lägg till anteckning"))
    expect(screen.getByTestId("voice-textarea")).toHaveValue("")
  })

  it("calls PUT notes endpoint on save", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = mockFetch

    render(<BookingNotesSection {...defaultProps} providerNotes="Gammal text" />)
    fireEvent.click(screen.getByText("Gammal text").closest("div")!)

    const textarea = screen.getByTestId("voice-textarea")
    fireEvent.change(textarea, { target: { value: "Ny text" } })

    fireEvent.click(screen.getByRole("button", { name: "Spara" }))

    await waitFor(() => {
      expect(mockGuardMutation).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          method: "PUT",
          url: "/api/provider/bookings/b1/notes",
          entityType: "booking-notes",
        })
      )
    })
  })

  it("closes editing mode on cancel without saving", () => {
    render(<BookingNotesSection {...defaultProps} providerNotes="Text" />)
    fireEvent.click(screen.getByText("Text").closest("div")!)
    expect(screen.getByTestId("voice-textarea")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }))
    expect(screen.queryByTestId("voice-textarea")).not.toBeInTheDocument()
    expect(defaultProps.onNotesUpdate).not.toHaveBeenCalled()
  })

  it("renders nothing for pending status", () => {
    const { container } = render(<BookingNotesSection {...defaultProps} status="pending" />)
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for cancelled status", () => {
    const { container } = render(<BookingNotesSection {...defaultProps} status="cancelled" />)
    expect(container.innerHTML).toBe("")
  })

  it("renders for completed status", () => {
    render(<BookingNotesSection {...defaultProps} status="completed" />)
    expect(screen.getByText("Lägg till anteckning")).toBeInTheDocument()
  })

  it("renders for no_show status", () => {
    render(<BookingNotesSection {...defaultProps} status="no_show" />)
    expect(screen.getByText("Lägg till anteckning")).toBeInTheDocument()
  })

  it("shows character counter in editing mode", () => {
    render(<BookingNotesSection {...defaultProps} providerNotes="Test" />)
    fireEvent.click(screen.getByText("Test").closest("div")!)
    expect(screen.getByText("4/2000")).toBeInTheDocument()
  })

  it("shows QuickNoteButton icon when not editing", () => {
    render(<BookingNotesSection {...defaultProps} providerNotes="Text" />)
    // QuickNoteButton renders with aria-label "Lägg till anteckning"
    expect(screen.getByRole("button", { name: "Lägg till anteckning" })).toBeInTheDocument()
  })
})

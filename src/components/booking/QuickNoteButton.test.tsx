import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const mockGuardMutation = vi.fn(async (action: () => Promise<unknown>) => action())

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/hooks/useOfflineGuard", () => ({
  useOfflineGuard: () => ({ guardMutation: mockGuardMutation, isOnline: true }),
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

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { QuickNoteButton } from "./QuickNoteButton"

describe("QuickNoteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

  it("button is not disabled when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<QuickNoteButton bookingId="b1" />)

    const btn = screen.getByRole("button")
    expect(btn).not.toBeDisabled()
  })

  it("opens text input when clicked offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<QuickNoteButton bookingId="b1" />)

    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByTestId("voice-textarea")).toBeInTheDocument()
  })

  it("disables mic button when offline and expanded", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<QuickNoteButton bookingId="b1" />)

    fireEvent.click(screen.getByRole("button"))

    // Find the mic toggle button inside expanded view
    const buttons = screen.getAllByRole("button")
    const micButton = buttons.find((b) => b.getAttribute("title") === "Röstloggning kräver internet")
    expect(micButton).toBeDefined()
    expect(micButton).toBeDisabled()
  })

  it("passes offlineOptions with entityType booking-notes to guardMutation", async () => {
    render(<QuickNoteButton bookingId="b1" />)

    // Open
    fireEvent.click(screen.getByRole("button"))

    // Type text
    const textarea = screen.getByTestId("voice-textarea")
    fireEvent.change(textarea, { target: { value: "Test note" } })

    // Save
    const saveBtn = screen.getByRole("button", { name: "Spara" })
    fireEvent.click(saveBtn)

    await vi.waitFor(() => {
      expect(mockGuardMutation).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          method: "POST",
          entityType: "booking-notes",
        })
      )
    })
  })
})

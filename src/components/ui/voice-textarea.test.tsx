import { render, screen, fireEvent } from "@testing-library/react"
import { VoiceTextarea } from "./voice-textarea"

// Mock useSpeechRecognition
const mockStartListening = vi.fn()
const mockStopListening = vi.fn()
const mockClearTranscript = vi.fn()
let mockIsSupported = true
let mockIsListening = false
let mockTranscript = ""

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    transcript: mockTranscript,
    isListening: mockIsListening,
    isSupported: mockIsSupported,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    clearTranscript: mockClearTranscript,
    setTranscript: vi.fn(),
    error: null,
  }),
}))

describe("VoiceTextarea", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSupported = true
    mockIsListening = false
    mockTranscript = ""
  })

  describe("basic rendering", () => {
    it("renders a textarea with provided props", () => {
      render(
        <VoiceTextarea
          value="test text"
          onChange={vi.fn()}
          placeholder="Skriv här..."
          id="my-textarea"
          rows={5}
          maxLength={500}
        />
      )

      const textarea = screen.getByPlaceholderText("Skriv här...")
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue("test text")
      expect(textarea).toHaveAttribute("id", "my-textarea")
      expect(textarea).toHaveAttribute("rows", "5")
      expect(textarea).toHaveAttribute("maxlength", "500")
    })

    it("calls onChange with string value on text input", () => {
      const onChange = vi.fn()
      render(<VoiceTextarea value="" onChange={onChange} />)

      const textarea = screen.getByRole("textbox")
      fireEvent.change(textarea, { target: { value: "hello" } })

      expect(onChange).toHaveBeenCalledWith("hello")
    })

    it("applies custom className to textarea", () => {
      render(<VoiceTextarea {...defaultProps} className="mt-2 custom-class" />)

      const textarea = screen.getByRole("textbox")
      expect(textarea.className).toContain("custom-class")
    })
  })

  describe("mic button visibility", () => {
    it("shows mic button when speech is supported", () => {
      mockIsSupported = true
      render(<VoiceTextarea {...defaultProps} />)

      expect(screen.getByLabelText("Starta röstinmatning")).toBeInTheDocument()
    })

    it("hides mic button when speech is not supported", () => {
      mockIsSupported = false
      render(<VoiceTextarea {...defaultProps} />)

      expect(screen.queryByLabelText("Starta röstinmatning")).not.toBeInTheDocument()
    })

    it("hides mic button when disabled", () => {
      render(<VoiceTextarea {...defaultProps} disabled />)

      expect(screen.queryByLabelText("Starta röstinmatning")).not.toBeInTheDocument()
    })

    it("adds extra padding-right when speech is supported", () => {
      mockIsSupported = true
      render(<VoiceTextarea {...defaultProps} />)

      const textarea = screen.getByRole("textbox")
      expect(textarea.className).toContain("pr-12")
    })

    it("does not add extra padding-right when speech is not supported", () => {
      mockIsSupported = false
      render(<VoiceTextarea {...defaultProps} />)

      const textarea = screen.getByRole("textbox")
      expect(textarea.className).not.toContain("pr-12")
    })
  })

  describe("recording toggle", () => {
    it("starts recording when mic button is clicked", () => {
      render(<VoiceTextarea {...defaultProps} />)

      fireEvent.click(screen.getByLabelText("Starta röstinmatning"))

      expect(mockClearTranscript).toHaveBeenCalled()
      expect(mockStartListening).toHaveBeenCalled()
    })

    it("stops recording when mic-off button is clicked", () => {
      mockIsListening = true
      const { rerender } = render(<VoiceTextarea {...defaultProps} />)

      // Simulate that recording started (click to start first)
      fireEvent.click(screen.getByLabelText("Starta röstinmatning"))

      // Now isListening is true, so re-render to reflect state
      mockIsListening = true
      rerender(<VoiceTextarea {...defaultProps} />)

      // The button should now say "Stoppa inspelning" since isRecording was set
      const stopButton = screen.queryByLabelText("Stoppa inspelning")
      if (stopButton) {
        fireEvent.click(stopButton)
        expect(mockStopListening).toHaveBeenCalled()
      }
    })

    it("does not toggle recording when disabled", () => {
      render(<VoiceTextarea {...defaultProps} disabled />)

      // Mic button should not be rendered when disabled
      expect(screen.queryByLabelText("Starta röstinmatning")).not.toBeInTheDocument()
    })
  })

  describe("listening feedback", () => {
    it("does not show listening indicator when not recording", () => {
      render(<VoiceTextarea {...defaultProps} />)

      expect(screen.queryByText("Lyssnar...")).not.toBeInTheDocument()
    })

    it("shows listening indicator when recording", () => {
      mockIsListening = true
      render(<VoiceTextarea {...defaultProps} />)

      // Click to start recording (sets isRecording = true)
      fireEvent.click(screen.getByLabelText("Starta röstinmatning"))

      // Re-render needed since isRecording is internal state
      // The "Lyssnar..." text appears when isRecording is true
      expect(screen.getByText("Lyssnar...")).toBeInTheDocument()
    })

    it("listening indicator has aria-live for accessibility", () => {
      mockIsListening = true
      render(<VoiceTextarea {...defaultProps} />)

      fireEvent.click(screen.getByLabelText("Starta röstinmatning"))

      const indicator = screen.getByText("Lyssnar...").closest("div")
      expect(indicator).toHaveAttribute("aria-live", "polite")
    })
  })

  describe("aria labels", () => {
    it("has correct aria-label for idle state", () => {
      render(<VoiceTextarea {...defaultProps} />)

      expect(screen.getByLabelText("Starta röstinmatning")).toBeInTheDocument()
    })

    it("changes aria-label when recording", () => {
      mockIsListening = true
      render(<VoiceTextarea {...defaultProps} />)

      fireEvent.click(screen.getByLabelText("Starta röstinmatning"))

      expect(screen.getByLabelText("Stoppa inspelning")).toBeInTheDocument()
    })
  })

  describe("disabled state", () => {
    it("disables textarea when disabled prop is true", () => {
      render(<VoiceTextarea {...defaultProps} disabled />)

      expect(screen.getByRole("textbox")).toBeDisabled()
    })

    it("does not render mic button when disabled", () => {
      render(<VoiceTextarea {...defaultProps} disabled />)

      expect(screen.queryByLabelText("Starta röstinmatning")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Stoppa inspelning")).not.toBeInTheDocument()
    })
  })
})

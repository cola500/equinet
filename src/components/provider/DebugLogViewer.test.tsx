import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DebugLogViewer } from "./DebugLogViewer"
import type { DebugLogEntry } from "@/lib/offline/db"

const mockGetDebugLogs = vi.fn()
const mockClearDebugLogs = vi.fn()

vi.mock("@/lib/offline/debug-logger", () => ({
  getDebugLogs: (...args: unknown[]) => mockGetDebugLogs(...args),
  clearDebugLogs: () => mockClearDebugLogs(),
}))

const sampleLogs: DebugLogEntry[] = [
  { id: 3, timestamp: 1708430003000, category: "error", level: "error", message: "Provider error: chunk failed" },
  { id: 2, timestamp: 1708430002000, category: "network", level: "warn", message: "Went offline" },
  { id: 1, timestamp: 1708430001000, category: "navigation", level: "info", message: "Navigated to /provider/calendar" },
]

describe("DebugLogViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDebugLogs.mockResolvedValue(sampleLogs)
    mockClearDebugLogs.mockResolvedValue(undefined)
  })

  it("renders logs from IndexedDB", async () => {
    render(<DebugLogViewer />)

    expect(await screen.findByText("Provider error: chunk failed")).toBeInTheDocument()
    expect(screen.getByText("Went offline")).toBeInTheDocument()
    expect(screen.getByText("Navigated to /provider/calendar")).toBeInTheDocument()
  })

  it("filters by category", async () => {
    const user = userEvent.setup()
    render(<DebugLogViewer />)

    // Wait for logs to load
    await screen.findByText("Provider error: chunk failed")

    // Select "network" filter
    const filterSelect = screen.getByLabelText("Filtrera kategori")
    await user.selectOptions(filterSelect, "network")

    expect(mockGetDebugLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "network" })
    )
  })

  it("copies formatted text to clipboard", async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    render(<DebugLogViewer />)
    await screen.findByText("Provider error: chunk failed")

    await user.click(screen.getByRole("button", { name: /kopiera/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Provider error: chunk failed"))
  })

  it("clears logs and refreshes", async () => {
    const user = userEvent.setup()
    render(<DebugLogViewer />)
    await screen.findByText("Provider error: chunk failed")

    mockGetDebugLogs.mockResolvedValue([])
    await user.click(screen.getByRole("button", { name: /rensa/i }))

    expect(mockClearDebugLogs).toHaveBeenCalled()
    expect(await screen.findByText(/inga loggar/i)).toBeInTheDocument()
  })

  it("shows log counter", async () => {
    render(<DebugLogViewer />)
    await screen.findByText("Provider error: chunk failed")

    expect(screen.getByText(/3.*loggar/i)).toBeInTheDocument()
  })

  it("color-codes by level", async () => {
    render(<DebugLogViewer />)

    await screen.findByText("Provider error: chunk failed")

    const rows = document.querySelectorAll("[data-level]")
    const levels = Array.from(rows).map((r) => r.getAttribute("data-level"))
    expect(levels).toContain("error")
    expect(levels).toContain("warn")
    expect(levels).toContain("info")
  })

  it("shows empty state when no logs exist", async () => {
    mockGetDebugLogs.mockResolvedValue([])
    render(<DebugLogViewer />)

    expect(await screen.findByText(/inga loggar/i)).toBeInTheDocument()
  })
})

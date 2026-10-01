import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CalendarHeader } from "./CalendarHeader"

// size="sm" buttons get no automatic 44px floor (see .claude/rules/ui-components.md),
// so every control in the header must opt in via the touch-target utility.
describe("CalendarHeader -- touch targets", () => {
  it("ger alla knappar 44px-golv på mobil", () => {
    render(
      <CalendarHeader
        currentDate={new Date(2026, 2, 16)}
        viewMode="week"
        onViewModeChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole("button")
    // 4 vyväxlare + föregående + idag + nästa
    expect(buttons).toHaveLength(7)
    for (const button of buttons) {
      expect(button, button.getAttribute("title") ?? button.textContent ?? "").toHaveClass("touch-target")
    }
  })

  it("ger ikonknapparna 44px bredd på mobil", () => {
    render(
      <CalendarHeader
        currentDate={new Date(2026, 2, 16)}
        viewMode="week"
        onViewModeChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />
    )
    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.trim() !== "Idag")
    expect(iconButtons).toHaveLength(6)
    for (const button of iconButtons) {
      expect(button, button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "").toHaveClass("min-w-[44px]", "sm:min-w-0")
    }
  })
})

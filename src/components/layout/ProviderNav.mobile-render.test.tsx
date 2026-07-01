import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, within } from "@testing-library/react"
import { ProviderNav } from "./ProviderNav"

// Render ProviderNav with the REAL BottomTabBar (not mocked) to verify the
// actual rendered mobile bottom bar — Slice 1.

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/provider/calendar",
  useRouter: () => ({ prefetch: vi.fn() }),
}))
vi.mock("@/hooks/useOnlineStatus", () => ({ useOnlineStatus: () => true }))
vi.mock("@/hooks/useBookings", () => ({ useBookings: () => ({ bookings: [] }) }))

const { mockFlags } = vi.hoisted(() => ({
  mockFlags: { current: {} as Record<string, boolean> },
}))
vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlags: () => mockFlags.current,
}))

const { mockDemo } = vi.hoisted(() => ({ mockDemo: { current: false } }))
vi.mock("@/components/providers/DemoSessionProvider", () => ({
  useDemoSession: () => mockDemo.current,
}))

function bottomBarLinkLabels(container: HTMLElement): string[] {
  const nav = container.querySelector("nav.fixed") as HTMLElement
  return within(nav).getAllByRole("link").map((a) => a.textContent?.trim() ?? "")
}

describe("ProviderNav mobile bottom bar (rendered, real BottomTabBar)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDemo.current = false
  })
  afterEach(() => {
    mockDemo.current = false
  })

  it("demo mode renders exactly 4 primary tabs + a Mer button", () => {
    mockDemo.current = true
    mockFlags.current = { messaging: true }
    const { container } = render(<ProviderNav />)

    expect(bottomBarLinkLabels(container)).toEqual([
      "Kalender",
      "Kunder",
      "Tjänster",
      "Meddelanden",
    ])
    const nav = container.querySelector("nav.fixed") as HTMLElement
    expect(within(nav).getByRole("button", { name: /Mer/ })).toBeTruthy()
  })

  it("non-demo mode renders 3 primary tabs (Översikt moved to Mer)", () => {
    mockFlags.current = { messaging: true }
    const { container } = render(<ProviderNav />)

    expect(bottomBarLinkLabels(container)).toEqual([
      "Kalender",
      "Bokningar",
      "Meddelanden",
    ])
    const nav = container.querySelector("nav.fixed") as HTMLElement
    expect(within(nav).getByRole("button", { name: /Mer/ })).toBeTruthy()
  })
})

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getStorageKey,
  isTooltipDismissed,
  dismissTooltip,
} from "@/components/ui/first-use-tooltip"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })

describe("FirstUseTooltip helpers", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe("getStorageKey", () => {
    it("returns prefixed key", () => {
      expect(getStorageKey("calendar-views")).toBe(
        "equinet-firstuse-calendar-views-dismissed"
      )
    })

    it("handles different ids", () => {
      expect(getStorageKey("dashboard-priority")).toBe(
        "equinet-firstuse-dashboard-priority-dismissed"
      )
    })
  })

  describe("isTooltipDismissed", () => {
    it("returns false when no localStorage entry", () => {
      expect(isTooltipDismissed("calendar-views")).toBe(false)
    })

    it("returns true after dismiss", () => {
      dismissTooltip("calendar-views")
      expect(isTooltipDismissed("calendar-views")).toBe(true)
    })

    it("returns false for different id after dismissing another", () => {
      dismissTooltip("calendar-views")
      expect(isTooltipDismissed("dashboard-priority")).toBe(false)
    })
  })

  describe("dismissTooltip", () => {
    it("sets localStorage to true", () => {
      dismissTooltip("calendar-views")
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "equinet-firstuse-calendar-views-dismissed",
        "true"
      )
    })
  })
})

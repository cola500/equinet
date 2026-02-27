import { describe, it, expect } from "vitest"
import { getVisibleSteps } from "@/hooks/useBookingFlow"

describe("getVisibleSteps", () => {
  describe("fixed bookings", () => {
    it("returns all 4 steps when customer has 0 horses", () => {
      const steps = getVisibleSteps(0, false)
      expect(steps).toEqual(["selectType", "selectTime", "selectHorse", "confirm"])
    })

    it("skips selectHorse when customer has exactly 1 horse", () => {
      const steps = getVisibleSteps(1, false)
      expect(steps).toEqual(["selectType", "selectTime", "confirm"])
    })

    it("returns all 4 steps when customer has 2+ horses", () => {
      const steps = getVisibleSteps(2, false)
      expect(steps).toEqual(["selectType", "selectTime", "selectHorse", "confirm"])
    })

    it("returns all 4 steps when customer has many horses", () => {
      const steps = getVisibleSteps(5, false)
      expect(steps).toEqual(["selectType", "selectTime", "selectHorse", "confirm"])
    })
  })

  describe("flexible bookings", () => {
    it("always skips selectHorse regardless of horse count", () => {
      expect(getVisibleSteps(0, true)).toEqual(["selectType", "selectTime", "confirm"])
      expect(getVisibleSteps(1, true)).toEqual(["selectType", "selectTime", "confirm"])
      expect(getVisibleSteps(3, true)).toEqual(["selectType", "selectTime", "confirm"])
    })
  })
})

import { describe, it, expect } from "vitest"
import {
  getBookingStatusStyle,
  LEGEND_STATUS_KEYS,
} from "./booking-status"

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const

// Tailwind colour family used in a class string, e.g. "bg-yellow-50" -> "yellow"
function hues(classes: string): Set<string> {
  const found = classes.match(/(?:bg|border|text)-(yellow|green|blue|red|orange|emerald|gray)-\d+/g) ?? []
  return new Set(found.map((c) => c.split("-")[1]))
}

describe("getBookingStatusStyle", () => {
  it.each([
    ["pending", "Väntar på svar"],
    ["confirmed", "Bekräftad"],
    ["completed", "Genomförd"],
    ["cancelled", "Avbokad"],
    ["no_show", "Ej infunnit"],
  ])("ger svensk etikett för %s", (status, label) => {
    expect(getBookingStatusStyle(status, false).label).toBe(label)
  })

  it("betald bokning överstyr status", () => {
    const style = getBookingStatusStyle("confirmed", true)
    expect(style.label).toBe("Betald")
    expect(hues(style.block)).toEqual(new Set(["emerald"]))
  })

  it("okänd status faller tillbaka på grått och råtext som etikett", () => {
    const style = getBookingStatusStyle("something_new", false)
    expect(style.label).toBe("something_new")
    expect(style.icon).toBeNull()
    expect(hues(style.block)).toEqual(new Set(["gray"]))
    expect(style.dot).toBe("bg-gray-400")
  })

  // Rotorsaken till tre avvikande färgsystem: varianterna kunde glida isär.
  it.each([...STATUSES, "paid"])("använder samma nyans i alla varianter för %s", (key) => {
    const style =
      key === "paid"
        ? getBookingStatusStyle("confirmed", true)
        : getBookingStatusStyle(key, false)
    const blockHue = hues(style.block)
    expect(blockHue.size).toBe(1)
    expect(hues(style.badge)).toEqual(blockHue)
    expect(hues(style.dot)).toEqual(blockHue)
    expect(hues(style.swatch)).toEqual(blockHue)
  })

  it("bevarar nuvarande färgklasser per variant", () => {
    const pending = getBookingStatusStyle("pending", false)
    expect(pending.block).toBe("bg-yellow-50 border-yellow-500 text-yellow-900")
    expect(pending.badge).toBe("bg-yellow-100 text-yellow-800")
    expect(pending.dot).toBe("bg-yellow-400")
    expect(pending.swatch).toBe("bg-yellow-50 border-l-2 border-yellow-500")
  })

  it("betald bevarar nuvarande färgklasser", () => {
    const paid = getBookingStatusStyle("completed", true)
    expect(paid.block).toBe("bg-emerald-100 border-emerald-600 text-emerald-900")
    expect(paid.badge).toBe("bg-emerald-100 text-emerald-800")
    expect(paid.dot).toBe("bg-emerald-500")
  })
})

describe("LEGEND_STATUS_KEYS", () => {
  it("täcker alla bokningsstatusar inklusive betald", () => {
    expect(LEGEND_STATUS_KEYS).toEqual(
      expect.arrayContaining([...STATUSES, "paid"])
    )
  })
})

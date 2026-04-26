import { describe, expect, it } from "vitest"
import { expandTemplate, hasInvalidVars } from "./SmartReplyChips"

describe("expandTemplate", () => {
  it("expands {key} with matching var", () => {
    expect(expandTemplate("Vi ses {datum}.", { datum: "måndag 5 maj" })).toBe("Vi ses måndag 5 maj.")
  })

  it("leaves {key} intact when var missing", () => {
    expect(expandTemplate("Ring mig på {telefon}.", {})).toBe("Ring mig på {telefon}.")
  })

  it("expands multiple {keys} in same template", () => {
    expect(
      expandTemplate("Vi ses {datum} kl {tid}.", { datum: "måndag 5 maj", tid: "09:00" })
    ).toBe("Vi ses måndag 5 maj kl 09:00.")
  })

  it("leaves {key} intact when var is explicitly undefined", () => {
    expect(expandTemplate("Hej {datum}.", { datum: undefined })).toBe("Hej {datum}.")
  })

  it("ignores non-matching braces (no false positives)", () => {
    expect(expandTemplate("Kl {tid} {okänd}.", { tid: "09:00" })).toBe("Kl 09:00 {okänd}.")
  })

  it("expands all production templates without runtime errors", () => {
    const vars = { datum: "måndag 5 maj", tid: "09:00", telefon: "0701234567" }
    expect(() => expandTemplate("Bokningen är bekräftad. Vi ses {datum} kl {tid}.", vars)).not.toThrow()
    expect(() => expandTemplate("Tack, jag återkommer så snart jag kan.", vars)).not.toThrow()
    expect(() => expandTemplate("Ring mig på {telefon} om det brådskar.", vars)).not.toThrow()
    expect(() => expandTemplate("Jag är på väg! Är framme om ca 15 minuter.", vars)).not.toThrow()
    expect(() => expandTemplate("Jag är framme nu!", vars)).not.toThrow()
  })

  it("replaces empty string var (not falls back to placeholder)", () => {
    expect(expandTemplate("Ring mig på {telefon}.", { telefon: "" })).toBe("Ring mig på .")
  })
})

describe("hasInvalidVars", () => {
  it("returns false for template with no vars", () => {
    expect(hasInvalidVars("Tack, jag återkommer.", {})).toBe(false)
  })

  it("returns false when all vars are present and non-empty", () => {
    expect(
      hasInvalidVars("Vi ses {datum} kl {tid}.", { datum: "måndag 5 maj", tid: "09:00" })
    ).toBe(false)
  })

  it("returns true when a var is empty string", () => {
    expect(hasInvalidVars("Ring mig på {telefon}.", { telefon: "" })).toBe(true)
  })

  it("returns true when a var is undefined", () => {
    expect(hasInvalidVars("Ring mig på {telefon}.", {})).toBe(true)
  })

  it("returns true when any var is missing even if others are present", () => {
    expect(
      hasInvalidVars("Vi ses {datum} kl {tid}.", { datum: "måndag 5 maj", tid: "" })
    ).toBe(true)
  })
})

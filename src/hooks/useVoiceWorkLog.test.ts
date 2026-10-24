import { describe, it, expect } from "vitest"
import { describeVoiceLogResult } from "./useVoiceWorkLog"

describe("describeVoiceLogResult", () => {
  it("SC-BOOK-001 – anteckning sparad och bokningen utförd ger vanligt bekräftelsebesked", () => {
    expect(describeVoiceLogResult({ completion: { status: "completed" } })).toEqual({
      tone: "success",
      message: "Arbetslogg sparad!",
    })
  })

  it("SC-BOOK-002 – anteckning sparad men markeringen avvisad ger varning med serverns besked", () => {
    const result = describeVoiceLogResult({
      completion: {
        status: "rejected",
        reason: "COMPLETION_BEFORE_END_TIME",
        message: "Bokningen kan markeras som genomförd först efter bokad sluttid (kl. 11:00).",
      },
    })

    expect(result).toEqual({
      tone: "warning",
      message:
        "Arbetsloggen sparades, men bokningen markerades inte som genomförd. " +
        "Bokningen kan markeras som genomförd först efter bokad sluttid (kl. 11:00).",
    })
  })

  it("markering inte begärd ger vanligt bekräftelsebesked", () => {
    expect(describeVoiceLogResult({ completion: { status: "not_requested" } }).tone).toBe("success")
  })
})

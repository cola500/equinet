import { describe, expect, it } from "vitest"
import { displayMessages } from "./messageUtils"

const makeMsg = (id: string, createdAt: string) => ({
  id,
  conversationId: "conv-1",
  senderType: "PROVIDER" as const,
  senderName: "Leverantör",
  content: `Meddelande ${id}`,
  createdAt,
  readAt: null,
  isFromSelf: true,
})

describe("displayMessages", () => {
  it("returnerar meddelanden i kronologisk ordning (äldst överst, nyast nederst)", () => {
    // API returnerar DESC: nyast först
    const descMessages = [
      makeMsg("msg-3", "2026-04-19T12:00:00Z"),
      makeMsg("msg-2", "2026-04-19T11:00:00Z"),
      makeMsg("msg-1", "2026-04-19T10:00:00Z"),
    ]

    const result = displayMessages(descMessages)

    expect(result[0].id).toBe("msg-1")
    expect(result[1].id).toBe("msg-2")
    expect(result[2].id).toBe("msg-3")
  })

  it("returnerar tom array vid tom input", () => {
    expect(displayMessages([])).toEqual([])
  })

  it("returnerar ett meddelande oförändrat", () => {
    const single = [makeMsg("msg-1", "2026-04-19T10:00:00Z")]
    expect(displayMessages(single)).toHaveLength(1)
    expect(displayMessages(single)[0].id).toBe("msg-1")
  })

  it("muterar inte original-arrayen", () => {
    const original = [
      makeMsg("msg-2", "2026-04-19T11:00:00Z"),
      makeMsg("msg-1", "2026-04-19T10:00:00Z"),
    ]
    const originalFirst = original[0].id
    displayMessages(original)
    expect(original[0].id).toBe(originalFirst)
  })
})

import { describe, it, expect } from "vitest"
import {
  parseVocabulary,
  addCorrections,
  formatForPrompt,
  detectSignificantChanges,
  type VocabularyTerms,
} from "./VocabularyService"

describe("VocabularyService", () => {
  describe("parseVocabulary", () => {
    it("returns empty corrections for null input", () => {
      const result = parseVocabulary(null)
      expect(result.corrections).toEqual([])
    })

    it("returns empty corrections for empty string", () => {
      const result = parseVocabulary("")
      expect(result.corrections).toEqual([])
    })

    it("returns empty corrections for invalid JSON", () => {
      const result = parseVocabulary("not json")
      expect(result.corrections).toEqual([])
    })

    it("returns empty corrections for JSON without corrections array", () => {
      const result = parseVocabulary(JSON.stringify({ foo: "bar" }))
      expect(result.corrections).toEqual([])
    })

    it("parses valid vocabulary JSON", () => {
      const vocab: VocabularyTerms = {
        corrections: [{ from: "hovbeslag", to: "hovkapning", count: 3 }],
      }
      const result = parseVocabulary(JSON.stringify(vocab))
      expect(result.corrections).toEqual([
        { from: "hovbeslag", to: "hovkapning", count: 3 },
      ])
    })

    it("filters out invalid correction entries", () => {
      const input = JSON.stringify({
        corrections: [
          { from: "a", to: "b", count: 1 },
          { from: "", to: "b", count: 1 }, // invalid: empty from
          { from: "a", count: 1 }, // invalid: missing to
          "not an object", // invalid
        ],
      })
      const result = parseVocabulary(input)
      expect(result.corrections).toHaveLength(1)
      expect(result.corrections[0].from).toBe("a")
    })
  })

  describe("addCorrections", () => {
    it("adds a new correction", () => {
      const vocab: VocabularyTerms = { corrections: [] }
      const result = addCorrections(vocab, [
        { original: "hovbeslag", edited: "hovkapning" },
      ])
      expect(result.corrections).toHaveLength(1)
      expect(result.corrections[0]).toEqual({
        from: "hovbeslag",
        to: "hovkapning",
        count: 1,
      })
    })

    it("increases count for existing correction", () => {
      const vocab: VocabularyTerms = {
        corrections: [{ from: "hovbeslag", to: "hovkapning", count: 2 }],
      }
      const result = addCorrections(vocab, [
        { original: "hovbeslag", edited: "hovkapning" },
      ])
      expect(result.corrections).toHaveLength(1)
      expect(result.corrections[0].count).toBe(3)
    })

    it("matches corrections case-insensitively", () => {
      const vocab: VocabularyTerms = {
        corrections: [{ from: "Stellansen", to: "Stella", count: 1 }],
      }
      const result = addCorrections(vocab, [
        { original: "stellansen", edited: "Stella" },
      ])
      expect(result.corrections).toHaveLength(1)
      expect(result.corrections[0].count).toBe(2)
    })

    it("adds multiple corrections at once", () => {
      const vocab: VocabularyTerms = { corrections: [] }
      const result = addCorrections(vocab, [
        { original: "hovbeslag", edited: "hovkapning" },
        { original: "Stellansen", edited: "Stella" },
      ])
      expect(result.corrections).toHaveLength(2)
    })

    it("enforces max 50 terms (FIFO -- removes oldest)", () => {
      const vocab: VocabularyTerms = {
        corrections: Array.from({ length: 50 }, (_, i) => ({
          from: `word${i}`,
          to: `replacement${i}`,
          count: 1,
        })),
      }
      const result = addCorrections(vocab, [
        { original: "new_word", edited: "new_replacement" },
      ])
      expect(result.corrections).toHaveLength(50)
      // Oldest (word0) should be removed
      expect(result.corrections.find((c) => c.from === "word0")).toBeUndefined()
      // New one should be present
      expect(result.corrections.find((c) => c.from === "new_word")).toBeDefined()
    })

    it("does not add empty corrections", () => {
      const vocab: VocabularyTerms = { corrections: [] }
      const result = addCorrections(vocab, [
        { original: "", edited: "something" },
        { original: "something", edited: "" },
      ])
      expect(result.corrections).toHaveLength(0)
    })
  })

  describe("formatForPrompt", () => {
    it("returns empty string for empty vocabulary", () => {
      expect(formatForPrompt({ corrections: [] })).toBe("")
    })

    it("formats corrections as readable list", () => {
      const vocab: VocabularyTerms = {
        corrections: [
          { from: "hovbeslag", to: "hovkapning", count: 3 },
          { from: "Stellansen", to: "Stella", count: 1 },
        ],
      }
      const result = formatForPrompt(vocab)
      expect(result).toContain("hovbeslag")
      expect(result).toContain("hovkapning")
      expect(result).toContain("Stellansen")
      expect(result).toContain("Stella")
    })

    it("includes section header", () => {
      const vocab: VocabularyTerms = {
        corrections: [{ from: "a", to: "b", count: 1 }],
      }
      const result = formatForPrompt(vocab)
      expect(result).toContain("Leverantörens anpassade termer")
    })
  })

  describe("detectSignificantChanges", () => {
    it("detects word replacements", () => {
      const changes = detectSignificantChanges(
        "Verkade alla fyra hovarna",
        "Verkade om alla fyra hovarna"
      )
      expect(changes.length).toBeGreaterThan(0)
    })

    it("ignores pure whitespace changes", () => {
      const changes = detectSignificantChanges(
        "Verkade  alla  fyra",
        "Verkade alla fyra"
      )
      expect(changes).toHaveLength(0)
    })

    it("ignores punctuation-only changes", () => {
      const changes = detectSignificantChanges(
        "Verkade alla fyra",
        "Verkade alla fyra."
      )
      expect(changes).toHaveLength(0)
    })

    it("detects name corrections", () => {
      const changes = detectSignificantChanges(
        "Klar med Stellansen",
        "Klar med Stella"
      )
      expect(changes.length).toBeGreaterThan(0)
      const nameChange = changes.find(
        (c) => c.original === "Stellansen" && c.edited === "Stella"
      )
      expect(nameChange).toBeDefined()
    })

    it("returns empty array for identical strings", () => {
      const changes = detectSignificantChanges(
        "Verkade alla fyra",
        "Verkade alla fyra"
      )
      expect(changes).toHaveLength(0)
    })

    it("handles null/empty inputs gracefully", () => {
      expect(detectSignificantChanges("", "")).toHaveLength(0)
      expect(detectSignificantChanges("word", "")).toHaveLength(0)
      expect(detectSignificantChanges("", "word")).toHaveLength(0)
    })
  })
})

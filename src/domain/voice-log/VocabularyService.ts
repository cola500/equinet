/**
 * VocabularyService - Manages provider-specific vocabulary for voice interpretation
 *
 * Stores word corrections learned from provider edits, and formats them
 * for injection into the LLM prompt to improve future interpretations.
 */

export interface VocabularyCorrection {
  from: string
  to: string
  count: number
}

export interface VocabularyTerms {
  corrections: VocabularyCorrection[]
}

const MAX_CORRECTIONS = 50

/**
 * Safely parse vocabulary JSON from database. Returns empty vocabulary on any error.
 */
export function parseVocabulary(json: string | null): VocabularyTerms {
  if (!json) return { corrections: [] }

  try {
    const parsed = JSON.parse(json)
    if (!parsed || !Array.isArray(parsed.corrections)) {
      return { corrections: [] }
    }

    // Filter to only valid correction entries
    const valid = parsed.corrections.filter(
      (c: unknown): c is VocabularyCorrection =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as VocabularyCorrection).from === "string" &&
        (c as VocabularyCorrection).from.length > 0 &&
        typeof (c as VocabularyCorrection).to === "string" &&
        (c as VocabularyCorrection).to.length > 0 &&
        typeof (c as VocabularyCorrection).count === "number"
    )

    return { corrections: valid }
  } catch {
    return { corrections: [] }
  }
}

/**
 * Add corrections from user edits. Increases count for existing corrections,
 * adds new ones, and enforces the max limit (FIFO).
 */
export function addCorrections(
  vocab: VocabularyTerms,
  changes: Array<{ original: string; edited: string }>
): VocabularyTerms {
  const corrections = [...vocab.corrections]

  for (const change of changes) {
    if (!change.original.trim() || !change.edited.trim()) continue

    const existingIdx = corrections.findIndex(
      (c) =>
        c.from.toLowerCase() === change.original.toLowerCase() &&
        c.to.toLowerCase() === change.edited.toLowerCase()
    )

    if (existingIdx >= 0) {
      corrections[existingIdx] = {
        ...corrections[existingIdx],
        count: corrections[existingIdx].count + 1,
      }
    } else {
      corrections.push({
        from: change.original,
        to: change.edited,
        count: 1,
      })
    }
  }

  // Enforce max limit -- remove oldest first (beginning of array)
  while (corrections.length > MAX_CORRECTIONS) {
    corrections.shift()
  }

  return { corrections }
}

/**
 * Format vocabulary as a prompt section for the LLM.
 * Returns empty string if no corrections exist.
 */
export function formatForPrompt(vocab: VocabularyTerms): string {
  if (vocab.corrections.length === 0) return ""

  const lines = vocab.corrections.map(
    (c) => `- "${c.from}" ska tolkas som "${c.to}"`
  )

  return `\nLeverantörens anpassade termer (använd dessa vid tolkning):\n${lines.join("\n")}`
}

/**
 * Detect significant word-level changes between original and edited text.
 * Uses common prefix/suffix to find the changed middle chunk.
 * Ignores whitespace and punctuation differences.
 */
export function detectSignificantChanges(
  original: string,
  edited: string
): Array<{ original: string; edited: string }> {
  if (!original.trim() || !edited.trim()) return []

  // Normalize: collapse whitespace, strip trailing punctuation per word
  const normalize = (s: string) =>
    s.replace(/[.,!?;:]+$/g, "").replace(/\s+/g, " ").trim()

  const origNorm = normalize(original)
  const editNorm = normalize(edited)

  if (origNorm === editNorm) return []

  const origWords = origNorm.split(" ")
  const editWords = editNorm.split(" ")

  // Find common prefix length
  let prefixLen = 0
  while (
    prefixLen < origWords.length &&
    prefixLen < editWords.length &&
    origWords[prefixLen] === editWords[prefixLen]
  ) {
    prefixLen++
  }

  // Find common suffix length (not overlapping prefix)
  let suffixLen = 0
  while (
    suffixLen < origWords.length - prefixLen &&
    suffixLen < editWords.length - prefixLen &&
    origWords[origWords.length - 1 - suffixLen] ===
      editWords[editWords.length - 1 - suffixLen]
  ) {
    suffixLen++
  }

  const origMiddle = origWords.slice(prefixLen, origWords.length - suffixLen)
  const editMiddle = editWords.slice(prefixLen, editWords.length - suffixLen)

  if (origMiddle.length === 0 && editMiddle.length === 0) return []

  return [
    {
      original: origMiddle.join(" "),
      edited: editMiddle.join(" "),
    },
  ]
}

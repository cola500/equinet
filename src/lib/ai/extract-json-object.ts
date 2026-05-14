/**
 * Tolerant JSON-object extractor for LLM responses.
 *
 * Finds the outermost JSON object in a text response, even when the model
 * wraps it in markdown code fences or surrounding prose. Returns the original
 * trimmed text if no `{...}` pair is found, letting downstream `JSON.parse`
 * surface the underlying issue.
 *
 * Reason: Claude (and other LLMs) sometimes add explanatory prose around the
 * JSON despite system-prompt instructions like "answer with JSON only". This
 * mirrors the learning captured in `salvage-vision/CLAUDE.md`.
 */
export function extractJsonObject(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    return text.trim()
  }
  return text.slice(start, end + 1)
}

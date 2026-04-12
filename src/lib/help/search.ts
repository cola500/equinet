import type { HelpArticle, HelpRole } from "./types"

// Client-safe article search/filter -- operates on pre-loaded arrays (no I/O)

export function filterArticles(
  articles: HelpArticle[],
  query: string,
  role?: HelpRole
): HelpArticle[] {
  const filtered = role ? articles.filter((a) => a.role === role) : articles
  const q = query.toLowerCase().trim()
  if (!q) return filtered

  return filtered.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.toLowerCase().includes(q)) ||
      a.content.some((block) =>
        [
          ...(block.paragraphs ?? []),
          ...(block.steps ?? []),
          ...(block.bullets ?? []),
        ].some((text) => text.toLowerCase().includes(q))
      )
  )
}

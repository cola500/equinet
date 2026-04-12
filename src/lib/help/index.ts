import type { HelpArticle, HelpRole } from "./types"
import { providerArticles, customerArticles } from "./loader"
import { adminArticles } from "./articles.admin"

const allArticles: HelpArticle[] = [
  ...customerArticles,
  ...providerArticles,
  ...adminArticles,
]

export function getAllArticles(role?: HelpRole): HelpArticle[] {
  if (!role) return allArticles
  return allArticles.filter((a) => a.role === role)
}

export function getArticle(
  slug: string,
  role: HelpRole
): HelpArticle | undefined {
  return allArticles.find((a) => a.slug === slug && a.role === role)
}

export function getArticleSections(role: HelpRole): string[] {
  const sections = getAllArticles(role).map((a) => a.section)
  return [...new Set(sections)]
}

export function searchArticles(
  query: string,
  role?: HelpRole
): HelpArticle[] {
  const articles = getAllArticles(role)
  const q = query.toLowerCase().trim()
  if (!q) return articles

  return articles.filter(
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

export type { HelpArticle, HelpRole, HelpContent } from "./types"

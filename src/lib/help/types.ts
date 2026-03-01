export type HelpRole = "customer" | "provider" | "admin"

export interface HelpArticle {
  slug: string
  title: string
  role: HelpRole
  section: string
  keywords: string[]
  summary: string
  content: HelpContent[]
}

export interface HelpContent {
  heading?: string
  paragraphs?: string[]
  steps?: string[]
  bullets?: string[]
  tip?: string
}

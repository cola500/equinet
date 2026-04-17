import type { HelpArticle, HelpContent, HelpRole } from "./types"
import fs from "fs"
import path from "path"

/**
 * Parse a simple YAML frontmatter string into key-value pairs.
 * Supports: string values, quoted strings, inline arrays [a, b], multiline arrays (- item).
 */
function parseFrontmatter(raw: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  const lines = raw.split("\n")
  let currentKey = ""

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Multiline array item: "  - value"
    if (trimmed.startsWith("- ") && currentKey) {
      const existing = result[currentKey]
      const value = trimmed.slice(2).trim()
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        result[currentKey] = [value]
      }
      continue
    }

    // Key-value pair: "key: value"
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value = trimmed.slice(colonIdx + 1).trim()
    currentKey = key

    // Inline array: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      continue
    }

    // Quoted string
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (value) {
      result[key] = value
    }
    // Empty value means multiline array follows
  }

  return result
}

/**
 * Parse markdown body into HelpContent[] blocks.
 *
 * Rules:
 * - `## heading` starts a new block with heading
 * - `---` (horizontal rule) starts a new block without heading
 * - `1. item` / `2. item` -> steps[]
 * - `- item` -> bullets[]
 * - `> **Tips:** text` -> tip
 * - Other non-empty lines -> paragraphs[]
 */
function parseBody(body: string): HelpContent[] {
  const blocks: HelpContent[] = []
  let current: HelpContent = {}

  function flushBlock() {
    if (hasContent(current)) {
      blocks.push(current)
    }
    current = {}
  }

  const lines = body.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()

    // Block separator (---)
    if (trimmed === "---") {
      flushBlock()
      continue
    }

    // Heading (## ...)
    if (trimmed.startsWith("## ")) {
      flushBlock()
      current.heading = trimmed.slice(3).trim()
      continue
    }

    // Tip (> **Tips:** ...)
    if (trimmed.startsWith("> **Tips:**")) {
      current.tip = trimmed.slice("> **Tips:**".length).trim()
      continue
    }

    // Ordered list item (1. ... 2. ... etc)
    const stepMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (stepMatch) {
      if (!current.steps) current.steps = []
      current.steps.push(stepMatch[1])
      continue
    }

    // Unordered list item (- ...)
    if (trimmed.startsWith("- ")) {
      if (!current.bullets) current.bullets = []
      current.bullets.push(trimmed.slice(2))
      continue
    }

    // Empty line - skip
    if (!trimmed) continue

    // Paragraph text
    if (!current.paragraphs) current.paragraphs = []
    current.paragraphs.push(trimmed)
  }

  flushBlock()
  return blocks
}

function hasContent(block: HelpContent): boolean {
  return !!(
    block.heading ||
    block.paragraphs?.length ||
    block.steps?.length ||
    block.bullets?.length ||
    block.tip
  )
}

/**
 * Parse a markdown string (frontmatter + body) into a HelpArticle.
 */
export function parseArticleMarkdown(markdown: string): HelpArticle {
  // Split frontmatter from body
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) {
    throw new Error("Invalid markdown: missing frontmatter")
  }

  const fm = parseFrontmatter(fmMatch[1])
  const body = fmMatch[2]

  return {
    slug: fm.slug as string,
    title: fm.title as string,
    role: fm.role as HelpRole,
    section: fm.section as string,
    keywords: Array.isArray(fm.keywords) ? fm.keywords : [fm.keywords as string],
    summary: fm.summary as string,
    content: parseBody(body),
  }
}

/**
 * Load all markdown articles from disk.
 * Reads from src/lib/help/articles/{role}/*.md
 */
export function loadArticlesFromDisk(role: HelpRole): HelpArticle[] {
  const dir = path.join(process.cwd(), "src", "lib", "help", "articles", role)

  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
  return files.map((file) => {
    const content = fs.readFileSync(path.join(dir, file), "utf-8")
    return parseArticleMarkdown(content)
  })
}

// Cache loaded articles (module-level)
let cachedArticles: HelpArticle[] | null = null

/**
 * Get all articles, loading from disk on first call.
 */
export function loadAllArticles(): HelpArticle[] {
  if (cachedArticles) return cachedArticles

  cachedArticles = [
    ...loadArticlesFromDisk("customer"),
    ...loadArticlesFromDisk("provider"),
    ...loadArticlesFromDisk("admin"),
  ]

  return cachedArticles
}

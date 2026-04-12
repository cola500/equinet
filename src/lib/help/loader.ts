import fs from "node:fs"
import path from "node:path"
import type { HelpArticle, HelpContent, HelpRole } from "./types"

const ARTICLES_DIR = path.join(process.cwd(), "src/lib/help/articles")

// Parse minimal YAML frontmatter (key: value and key:\n  - item arrays)
function parseFrontmatter(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) { i++; continue }

    const key = line.slice(0, colonIdx).trim()
    const rest = line.slice(colonIdx + 1).trim()

    if (rest === "") {
      // Array value -- collect following `  - item` lines
      const items: string[] = []
      i++
      while (i < lines.length && lines[i].match(/^\s+-\s/)) {
        items.push(lines[i].replace(/^\s+-\s/, "").trim())
        i++
      }
      result[key] = items
    } else {
      result[key] = rest
      i++
    }
  }
  return result
}

// Parse a single content block (between --- separators in the body)
function parseBlock(raw: string): HelpContent | null {
  const lines = raw.split("\n")
  const heading: string[] = []
  const paragraphs: string[] = []
  const steps: string[] = []
  const bullets: string[] = []
  const tipLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("### ")) {
      heading.push(trimmed.slice(4))
    } else if (trimmed.startsWith("> ")) {
      tipLines.push(trimmed.slice(2))
    } else if (/^\d+\.\s/.test(trimmed)) {
      steps.push(trimmed.replace(/^\d+\.\s+/, ""))
    } else if (trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2))
    } else {
      paragraphs.push(trimmed)
    }
  }

  const block: HelpContent = {}
  if (heading.length) block.heading = heading.join(" ")
  if (paragraphs.length) block.paragraphs = paragraphs
  if (steps.length) block.steps = steps
  if (bullets.length) block.bullets = bullets
  if (tipLines.length) block.tip = tipLines.join(" ")

  const hasContent =
    block.heading !== undefined ||
    block.paragraphs?.length ||
    block.steps?.length ||
    block.bullets?.length ||
    block.tip !== undefined
  return hasContent ? block : null
}

// Parse a full markdown article file into HelpArticle
function parseArticleFile(filePath: string): HelpArticle | null {
  const raw = fs.readFileSync(filePath, "utf-8")

  // Extract frontmatter between first two ---
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
  if (!fmMatch) return null

  const fm = parseFrontmatter(fmMatch[1])
  const body = fmMatch[2]

  const slug = fm["slug"] as string
  const title = fm["title"] as string
  const role = fm["role"] as HelpRole
  const section = fm["section"] as string
  const keywords = (fm["keywords"] as string[]) ?? []
  const summary = fm["summary"] as string

  if (!slug || !title || !role || !section || !summary) return null

  // Split body on `\n---\n` to get content blocks
  const rawBlocks = body.split(/\n---\n/)
  const content: HelpContent[] = rawBlocks
    .map((b) => parseBlock(b))
    .filter((b): b is HelpContent => b !== null)

  if (!content.length) return null

  return { slug, title, role, section, keywords, summary, content }
}

// Load all articles from a subdirectory (provider, customer, admin)
function loadRole(role: HelpRole): HelpArticle[] {
  const dir = path.join(ARTICLES_DIR, role)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseArticleFile(path.join(dir, f)))
    .filter((a): a is HelpArticle => a !== null)
}

// Cached at module initialization (avoids repeated fs reads per request)
export const providerArticles: HelpArticle[] = loadRole("provider")
export const customerArticles: HelpArticle[] = loadRole("customer")
export const adminArticlesFromMarkdown: HelpArticle[] = loadRole("admin")

import { describe, it, expect } from "vitest"
import {
  getAllArticles,
  getArticle,
  getArticleSections,
  searchArticles,
} from "./index"

describe("Help articles", () => {
  describe("getAllArticles", () => {
    it("returns all articles when no role is specified", () => {
      const articles = getAllArticles()
      expect(articles.length).toBeGreaterThan(0)
    })

    it("returns only customer articles when role is customer", () => {
      const articles = getAllArticles("customer")
      expect(articles.length).toBeGreaterThan(0)
      expect(articles.every((a) => a.role === "customer")).toBe(true)
    })

    it("returns only provider articles when role is provider", () => {
      const articles = getAllArticles("provider")
      expect(articles.length).toBeGreaterThan(0)
      expect(articles.every((a) => a.role === "provider")).toBe(true)
    })

    it("returns only admin articles when role is admin", () => {
      const articles = getAllArticles("admin")
      expect(articles.length).toBeGreaterThan(0)
      expect(articles.every((a) => a.role === "admin")).toBe(true)
    })

    it("articles from all roles sum to total", () => {
      const all = getAllArticles()
      const customer = getAllArticles("customer")
      const provider = getAllArticles("provider")
      const admin = getAllArticles("admin")
      expect(customer.length + provider.length + admin.length).toBe(all.length)
    })
  })

  describe("getArticle", () => {
    it("returns a specific article by slug and role", () => {
      const article = getArticle("boka-en-tjanst", "customer")
      expect(article).toBeDefined()
      expect(article!.title).toBe("Boka en tjänst")
      expect(article!.role).toBe("customer")
    })

    it("returns undefined for unknown slug", () => {
      const article = getArticle("nonexistent-slug", "customer")
      expect(article).toBeUndefined()
    })

    it("returns undefined when slug exists for different role", () => {
      const article = getArticle("boka-en-tjanst", "admin")
      expect(article).toBeUndefined()
    })

    it("returns provider article correctly", () => {
      const article = getArticle("ruttplanering", "provider")
      expect(article).toBeDefined()
      expect(article!.role).toBe("provider")
    })

    it("returns admin article correctly", () => {
      const article = getArticle("dashboard", "admin")
      expect(article).toBeDefined()
      expect(article!.role).toBe("admin")
    })
  })

  describe("getArticleSections", () => {
    it("returns unique section names for a role", () => {
      const sections = getArticleSections("customer")
      expect(sections.length).toBeGreaterThan(0)
      // Verify uniqueness
      expect(new Set(sections).size).toBe(sections.length)
    })

    it("returns sections for provider role", () => {
      const sections = getArticleSections("provider")
      expect(sections.length).toBeGreaterThan(0)
      expect(new Set(sections).size).toBe(sections.length)
    })

    it("returns sections for admin role", () => {
      const sections = getArticleSections("admin")
      expect(sections.length).toBeGreaterThan(0)
    })
  })

  describe("searchArticles", () => {
    it("returns all articles for empty query", () => {
      const all = getAllArticles("customer")
      const results = searchArticles("", "customer")
      expect(results.length).toBe(all.length)
    })

    it("filters by title match", () => {
      const results = searchArticles("bokning", "customer")
      expect(results.length).toBeGreaterThan(0)
      expect(
        results.some((a) => a.title.toLowerCase().includes("bokning"))
      ).toBe(true)
    })

    it("filters by keyword match", () => {
      const results = searchArticles("häst", "customer")
      expect(results.length).toBeGreaterThan(0)
    })

    it("filters by summary match", () => {
      const results = searchArticles("leverantör", "customer")
      expect(results.length).toBeGreaterThan(0)
    })

    it("returns empty array for no matches", () => {
      const results = searchArticles("xyznonexistent123", "customer")
      expect(results).toEqual([])
    })

    it("is case insensitive", () => {
      const lower = searchArticles("bokning", "customer")
      const upper = searchArticles("BOKNING", "customer")
      expect(lower.length).toBe(upper.length)
    })

    it("searches across all roles when no role specified", () => {
      const results = searchArticles("bokning")
      const customerResults = searchArticles("bokning", "customer")
      const providerResults = searchArticles("bokning", "provider")
      expect(results.length).toBe(
        customerResults.length + providerResults.length + searchArticles("bokning", "admin").length
      )
    })

    it("handles whitespace-only query as empty", () => {
      const all = getAllArticles("customer")
      const results = searchArticles("   ", "customer")
      expect(results.length).toBe(all.length)
    })
  })

  describe("article data integrity", () => {
    it("every article has required fields", () => {
      const articles = getAllArticles()
      for (const article of articles) {
        expect(article.slug).toBeTruthy()
        expect(article.title).toBeTruthy()
        expect(article.role).toMatch(/^(customer|provider|admin)$/)
        expect(article.section).toBeTruthy()
        expect(article.summary).toBeTruthy()
        expect(article.keywords.length).toBeGreaterThan(0)
        expect(article.content.length).toBeGreaterThan(0)
      }
    })

    it("every article has unique slug within its role", () => {
      for (const role of ["customer", "provider", "admin"] as const) {
        const articles = getAllArticles(role)
        const slugs = articles.map((a) => a.slug)
        expect(new Set(slugs).size).toBe(slugs.length)
      }
    })
  })
})

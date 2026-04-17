import { describe, it, expect } from "vitest"
import { parseArticleMarkdown } from "./loader"

describe("parseArticleMarkdown", () => {
  it("parses frontmatter metadata", () => {
    const md = `---
slug: test-article
title: Test Article
role: provider
section: Test
keywords:
  - test
  - example
summary: A test article
---

Some content here.
`
    const article = parseArticleMarkdown(md)
    expect(article.slug).toBe("test-article")
    expect(article.title).toBe("Test Article")
    expect(article.role).toBe("provider")
    expect(article.section).toBe("Test")
    expect(article.keywords).toEqual(["test", "example"])
    expect(article.summary).toBe("A test article")
  })

  it("parses paragraphs", () => {
    const md = `---
slug: t
title: T
role: customer
section: S
keywords:
  - k
summary: S
---

First paragraph.

Second paragraph.
`
    const article = parseArticleMarkdown(md)
    expect(article.content).toHaveLength(1)
    expect(article.content[0].paragraphs).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ])
  })

  it("parses ordered list as steps", () => {
    const md = `---
slug: t
title: T
role: provider
section: S
keywords:
  - k
summary: S
---

1. First step
2. Second step
3. Third step
`
    const article = parseArticleMarkdown(md)
    expect(article.content[0].steps).toEqual([
      "First step",
      "Second step",
      "Third step",
    ])
  })

  it("parses unordered list as bullets", () => {
    const md = `---
slug: t
title: T
role: provider
section: S
keywords:
  - k
summary: S
---

- Bullet one
- Bullet two
`
    const article = parseArticleMarkdown(md)
    expect(article.content[0].bullets).toEqual(["Bullet one", "Bullet two"])
  })

  it("parses tip from blockquote", () => {
    const md = `---
slug: t
title: T
role: provider
section: S
keywords:
  - k
summary: S
---

Some text.

> **Tips:** This is a helpful tip.
`
    const article = parseArticleMarkdown(md)
    expect(article.content[0].tip).toBe("This is a helpful tip.")
  })

  it("parses headings as new blocks", () => {
    const md = `---
slug: t
title: T
role: provider
section: S
keywords:
  - k
summary: S
---

Intro paragraph.

## First Section

- Bullet A
- Bullet B

## Second Section

Some text.
`
    const article = parseArticleMarkdown(md)
    expect(article.content).toHaveLength(3)
    expect(article.content[0].paragraphs).toEqual(["Intro paragraph."])
    expect(article.content[1].heading).toBe("First Section")
    expect(article.content[1].bullets).toEqual(["Bullet A", "Bullet B"])
    expect(article.content[2].heading).toBe("Second Section")
    expect(article.content[2].paragraphs).toEqual(["Some text."])
  })

  it("uses --- as explicit block separator", () => {
    const md = `---
slug: t
title: T
role: provider
section: S
keywords:
  - k
summary: S
---

First block paragraph.

1. Step one
2. Step two

---

Second block paragraph.
`
    const article = parseArticleMarkdown(md)
    expect(article.content).toHaveLength(2)
    expect(article.content[0].paragraphs).toEqual(["First block paragraph."])
    expect(article.content[0].steps).toEqual(["Step one", "Step two"])
    expect(article.content[1].paragraphs).toEqual(["Second block paragraph."])
  })

  it("handles mixed content in one block (paragraphs + bullets + tip)", () => {
    const md = `---
slug: t
title: T
role: provider
section: S
keywords:
  - k
summary: S
---

Toggle explanation.

- Option A: Active
- Option B: Inactive

---

Another paragraph.

> **Tips:** Helpful tip here.
`
    const article = parseArticleMarkdown(md)
    expect(article.content).toHaveLength(2)
    expect(article.content[0].paragraphs).toEqual(["Toggle explanation."])
    expect(article.content[0].bullets).toEqual(["Option A: Active", "Option B: Inactive"])
    expect(article.content[1].paragraphs).toEqual(["Another paragraph."])
    expect(article.content[1].tip).toBe("Helpful tip here.")
  })

  it("parses inline keywords format", () => {
    const md = `---
slug: t
title: T
role: admin
section: S
keywords: [admin, test, dashboard]
summary: S
---

Content.
`
    const article = parseArticleMarkdown(md)
    expect(article.keywords).toEqual(["admin", "test", "dashboard"])
  })

  it("handles quoted frontmatter values", () => {
    const md = `---
slug: test
title: "Title with: colon"
role: provider
section: "Section: name"
keywords:
  - key
summary: "Summary with: colon"
---

Content.
`
    const article = parseArticleMarkdown(md)
    expect(article.title).toBe("Title with: colon")
    expect(article.section).toBe("Section: name")
    expect(article.summary).toBe("Summary with: colon")
  })
})

import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { HelpArticleView } from "./HelpArticleView"
import type { HelpArticle } from "@/lib/help/types"

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockArticle: HelpArticle = {
  slug: "test-article",
  title: "Testartikel",
  role: "customer",
  section: "Testsektion",
  keywords: ["test"],
  summary: "En testartikel för rendering.",
  content: [
    {
      paragraphs: ["Detta är ett stycke i testartikeln."],
    },
    {
      heading: "Steg för steg",
      steps: ["Första steget", "Andra steget", "Tredje steget"],
    },
    {
      bullets: ["Punkt ett", "Punkt två"],
    },
    {
      tip: "Bra att veta: detta är ett tips.",
    },
  ],
}

describe("HelpArticleView", () => {
  it("renders article title", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(screen.getByText("Testartikel")).toBeInTheDocument()
  })

  it("renders section label", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(screen.getByText("Testsektion")).toBeInTheDocument()
  })

  it("renders back link", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    const backLink = screen.getByText("Tillbaka till hjälp")
    expect(backLink.closest("a")).toHaveAttribute("href", "/customer/help")
  })

  it("renders paragraphs", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(
      screen.getByText("Detta är ett stycke i testartikeln.")
    ).toBeInTheDocument()
  })

  it("renders steps", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(screen.getByText("Första steget")).toBeInTheDocument()
    expect(screen.getByText("Andra steget")).toBeInTheDocument()
  })

  it("renders bullets", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(screen.getByText("Punkt ett")).toBeInTheDocument()
  })

  it("renders tip box", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(
      screen.getByText("Bra att veta: detta är ett tips.")
    ).toBeInTheDocument()
  })

  it("renders heading within content", () => {
    render(
      <HelpArticleView article={mockArticle} backHref="/customer/help" />
    )

    expect(screen.getByText("Steg för steg")).toBeInTheDocument()
  })
})

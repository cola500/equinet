"use client"

import { useState, useEffect, useCallback } from "react"
import type { HelpRole } from "@/lib/help/types"
import {
  getAllArticles,
  getArticleSections,
  searchArticles,
} from "@/lib/help/index"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpSearch } from "./HelpSearch"
import { HelpArticleCard } from "./HelpArticleCard"

interface HelpCenterProps {
  role: HelpRole
  basePath: string
}

export function HelpCenter({ role, basePath }: HelpCenterProps) {
  const allArticlesForRole = getAllArticles(role)
  const [query, setQuery] = useState("")
  const [articles, setArticles] = useState(allArticlesForRole)
  const sections = getArticleSections(role)

  useEffect(() => {
    const timer = setTimeout(() => {
      setArticles(searchArticles(query, role))
    }, 200)
    return () => clearTimeout(timer)
  }, [query, role])

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery)
  }, [])

  const visibleSections = sections.filter((section) =>
    articles.some((a) => a.section === section)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Hjälp</h1>
        <p className="text-gray-600 text-sm">
          Hitta svar på vanliga frågor och lär dig använda plattformen.
        </p>
      </div>

      <HelpSearch
        query={query}
        onQueryChange={handleQueryChange}
        resultCount={articles.length}
        totalCount={allArticlesForRole.length}
      />

      {visibleSections.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-gray-500">
            Inga artiklar matchade din sökning.
          </p>
          <button
            onClick={() => setQuery("")}
            className="text-sm text-primary hover:underline"
          >
            Visa alla artiklar
          </button>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={visibleSections}>
          {visibleSections.map((section) => {
            const sectionArticles = articles.filter(
              (a) => a.section === section
            )
            return (
              <AccordionItem key={section} value={section}>
                <AccordionTrigger className="text-base font-semibold">
                  {section}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {sectionArticles.map((article) => (
                      <HelpArticleCard
                        key={article.slug}
                        article={article}
                        basePath={basePath}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

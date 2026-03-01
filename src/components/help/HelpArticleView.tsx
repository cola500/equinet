"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { HelpArticle } from "@/lib/help/types"
import { HelpContentRenderer } from "./HelpContentRenderer"

interface HelpArticleViewProps {
  article: HelpArticle
  backHref: string
}

export function HelpArticleView({ article, backHref }: HelpArticleViewProps) {
  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till hjälp
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{article.section}</p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <HelpContentRenderer content={article.content} />
      </div>
    </div>
  )
}

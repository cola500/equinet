import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { HelpArticle } from "@/lib/help/types"

interface HelpArticleCardProps {
  article: HelpArticle
  basePath: string
}

export function HelpArticleCard({ article, basePath }: HelpArticleCardProps) {
  return (
    <Link
      href={`${basePath}/${article.slug}`}
      className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{article.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {article.summary}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  )
}

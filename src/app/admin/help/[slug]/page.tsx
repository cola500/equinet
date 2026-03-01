"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { HelpArticleView } from "@/components/help/HelpArticleView"
import { getArticle } from "@/lib/help/index"

export default function AdminHelpArticlePage() {
  const params = useParams()
  const slug = params.slug as string

  const article = getArticle(slug, "admin")

  if (!article) {
    notFound()
  }

  return (
    <AdminLayout>
      <HelpArticleView article={article} backHref="/admin/help" />
    </AdminLayout>
  )
}

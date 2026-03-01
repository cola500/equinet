"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HelpArticleView } from "@/components/help/HelpArticleView"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { getArticle } from "@/lib/help/index"

export default function CustomerHelpArticlePage() {
  const params = useParams()
  const slug = params.slug as string
  const helpEnabled = useFeatureFlag("help_center")

  if (!helpEnabled) {
    notFound()
  }

  const article = getArticle(slug, "customer")

  if (!article) {
    notFound()
  }

  return (
    <CustomerLayout>
      <HelpArticleView article={article} backHref="/customer/help" />
    </CustomerLayout>
  )
}
